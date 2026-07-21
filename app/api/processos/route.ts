import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Processo, StatusProcesso, LancamentoFuturo } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { etapaDef, EtapaProcesso } from '@/lib/processoCidadania'
import { sanitizarLinhagem } from '@/lib/linhagem'
import { lancamentosDoProcesso } from '@/lib/lancamentosProcesso'
import type { FinanceiroContrato, MetodoPagamento, Parcela, Pagamento } from '@/lib/financeiroContrato'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// PROCESSOS DE CIDADANIA (perfil 'cidadania') — a ENTREGA pós-venda de cada caso
// (família) rumo à cidadania estrangeira. Equipe lê; escrita exige CRM/editar,
// como o resto da operação de instância. As etapas vivem em lib/processoCidadania.

const ymd = (s: any) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s) : undefined)
const STATUS: StatusProcesso[] = ['ativo', 'pausado', 'concluido', 'arquivado']

// Etapa válida ou fallback para a primeira do fluxo.
function etapaOk(v: any): EtapaProcesso {
  const d = etapaDef(v)
  return (d ? d.chave : 'viabilidade') as EtapaProcesso
}
function statusOk(v: any): StatusProcesso {
  return STATUS.includes(v) ? v : 'ativo'
}
// Lista de ids (requerentes) — strings não vazias, deduplicadas, teto de segurança.
function limparIds(arr: any): string[] {
  if (!Array.isArray(arr)) return []
  return Array.from(new Set(arr.map((s: any) => String(s || '').trim()).filter(Boolean))).slice(0, 60)
}

// A sanitização da linhagem é COMPARTILHADA com /api/crm/negocios (a árvore é
// gravada nos dois: análise pré-venda no CRM, prova pós-venda no processo).
const limparLinhagem = (arr: any) => sanitizarLinhagem(arr, uuid)
const valorOpc = (v: any) => (v === undefined || v === null || v === '' ? undefined : Math.max(0, Number(v) || 0))

const METODOS_OK: MetodoPagamento[] = ['dinheiro', 'pix', 'transferencia', 'cartao', 'boleto', 'cheque']
const metodoOk = (v: any) => (METODOS_OK.includes(v) ? (v as MetodoPagamento) : undefined)

// Financeiro do contrato (parcelas/pagamentos). Dinheiro é o dado mais sensível
// aqui: valor sempre >= 0 e arredondado ao centavo, data sempre YYYY-MM-DD.
// Parcela sem vencimento válido cai fora — vira "a receber" sem data e some da
// régua de cobrança sem ninguém perceber.
function limparFinanceiro(o: any): FinanceiroContrato | undefined {
  if (!o || typeof o !== 'object') return undefined
  const cent = (v: any) => Math.max(0, Math.round((Number(v) || 0) * 100) / 100)
  const parcelas: Parcela[] = (Array.isArray(o.parcelas) ? o.parcelas : [])
    .map((p: any, i: number): Parcela => ({
      id: String(p?.id || `p${i + 1}`),
      numero: Number.isFinite(Number(p?.numero)) ? Math.max(1, Math.floor(Number(p.numero))) : i + 1,
      valor: cent(p?.valor),
      vencimento: ymd(p?.vencimento) || '',
      metodo: metodoOk(p?.metodo),
      status: p?.status === 'pago' ? 'pago' : 'pendente',
      pagoEm: ymd(p?.pagoEm),
    }))
    .filter((p: Parcela) => p.vencimento && p.valor > 0)
    .slice(0, 120)
  const pagamentos: Pagamento[] = (Array.isArray(o.pagamentos) ? o.pagamentos : [])
    .map((p: any, i: number): Pagamento => ({
      id: String(p?.id || `pg${i + 1}`),
      data: ymd(p?.data) || '',
      valor: cent(p?.valor),
      metodo: metodoOk(p?.metodo),
      nota: (p?.nota || '').toString().slice(0, 200) || undefined,
    }))
    .filter((p: Pagamento) => p.data && p.valor > 0)
    .slice(0, 120)
  return { valorTotal: cent(o.valorTotal), parcelas, pagamentos }
}

// CONTRATO → FINANCEIRO. Espelha parcelas/pagamentos como lançamentos, com id
// determinístico: re-salvar ATUALIZA em vez de duplicar, e o que saiu do
// contrato (parcela removida, processo arquivado) sai do financeiro junto.
async function sincronizarLancamentos(p: Processo, autor?: string) {
  const novos = lancamentosDoProcesso(p)
  const chaveIdx = `processo:${p.id}:lancamentos`
  const antigos = await redis.smembers(chaveIdx)
  const idsNovos = new Set(novos.map(l => l.id))
  const remover = antigos.filter(id => !idsNovos.has(id))
  for (const id of remover) { await redis.del(`lancamento:${id}`); await redis.srem('lancamentos', id) }
  if (remover.length) await redis.srem(chaveIdx, ...remover)
  const agora = new Date().toISOString()
  for (const l of novos) {
    const lanc: LancamentoFuturo = { ...l, criadoPor: autor, criadoEm: agora }
    await redis.set(`lancamento:${lanc.id}`, lanc)
    await redis.sadd('lancamentos', lanc.id)
    await redis.sadd(chaveIdx, lanc.id)
  }
}

// Excluir o processo leva os lançamentos dele junto — lançamento derivado sem a
// origem viraria entrada fantasma no caixa.
async function removerLancamentos(processoId: string) {
  const chaveIdx = `processo:${processoId}:lancamentos`
  const ids = await redis.smembers(chaveIdx)
  for (const id of ids) { await redis.del(`lancamento:${id}`); await redis.srem('lancamentos', id) }
  await redis.del(chaveIdx)
}

async function sessaoEquipe() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}

async function carregarTodos(): Promise<Processo[]> {
  const ids = await redis.smembers('processos')
  if (!ids.length) return []
  return (await redis.mget<(Processo | null)[]>(...ids.map(i => `processo:${i}`))).filter(Boolean) as Processo[]
}

export async function GET(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const p = await redis.get<Processo>(`processo:${id}`)
    return p ? NextResponse.json(p) : NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  }
  // Mais recentes primeiro (criadoEm desc) — a esteira lida por etapa no cliente.
  const processos = (await carregarTodos()).sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''))
  return NextResponse.json({ processos })
}

export async function POST(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const b = await req.json()
  const titulo = String(b.titulo || '').trim()
  if (!titulo) return NextResponse.json({ error: 'informe o nome do caso/família' }, { status: 400 })

  const agora = new Date().toISOString()
  const processo: Processo = {
    id: uuid(),
    titulo: titulo.slice(0, 140),
    clienteId: String(b.clienteId || '').trim() || undefined,
    paisAlvo: String(b.paisAlvo || 'Luxemburgo').trim().slice(0, 60) || 'Luxemburgo',
    ascendente: (b.ascendente || '').toString().slice(0, 140) || undefined,
    requerentes: limparIds(b.requerentes),
    linhagem: limparLinhagem(b.linhagem),
    etapa: etapaOk(b.etapa),
    status: statusOk(b.status),
    responsavelEmail: (b.responsavelEmail || '').toString().trim().toLowerCase() || undefined,
    numeroProcesso: (b.numeroProcesso || '').toString().slice(0, 80) || undefined,
    valorContrato: valorOpc(b.valorContrato),
    financeiro: limparFinanceiro(b.financeiro),
    prazoEstimado: ymd(b.prazoEstimado),
    observacoes: (b.observacoes || '').toString().slice(0, 2000) || undefined,
    criadoPor: session.user?.name || session.user?.email || undefined,
    criadoEm: agora,
    atualizadoEm: agora,
  }
  await redis.set(`processo:${processo.id}`, processo)
  await redis.sadd('processos', processo.id)
  await sincronizarLancamentos(processo, session.user?.name || session.user?.email || undefined)
  return NextResponse.json({ ok: true, processo })
}

export async function PUT(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const b = await req.json()
  const atual = await redis.get<Processo>(`processo:${b.id}`)
  if (!atual) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  const p: Processo = { ...atual }
  if (b.titulo !== undefined) {
    const titulo = String(b.titulo).trim()
    if (!titulo) return NextResponse.json({ error: 'informe o nome do caso/família' }, { status: 400 })
    p.titulo = titulo.slice(0, 140)
  }
  if (b.clienteId !== undefined) p.clienteId = String(b.clienteId || '').trim() || undefined
  if (b.paisAlvo !== undefined) p.paisAlvo = String(b.paisAlvo || 'Luxemburgo').trim().slice(0, 60) || 'Luxemburgo'
  if (b.ascendente !== undefined) p.ascendente = String(b.ascendente).slice(0, 140) || undefined
  if (b.requerentes !== undefined) p.requerentes = limparIds(b.requerentes)
  if (b.linhagem !== undefined) p.linhagem = limparLinhagem(b.linhagem)
  if (b.etapa !== undefined) p.etapa = etapaOk(b.etapa)
  if (b.status !== undefined) p.status = statusOk(b.status)
  if (b.responsavelEmail !== undefined) p.responsavelEmail = String(b.responsavelEmail).trim().toLowerCase() || undefined
  if (b.numeroProcesso !== undefined) p.numeroProcesso = String(b.numeroProcesso).slice(0, 80) || undefined
  if (b.valorContrato !== undefined) p.valorContrato = valorOpc(b.valorContrato)
  if (b.financeiro !== undefined) p.financeiro = limparFinanceiro(b.financeiro)
  if (b.prazoEstimado !== undefined) p.prazoEstimado = ymd(b.prazoEstimado)
  if (b.observacoes !== undefined) p.observacoes = String(b.observacoes).slice(0, 2000) || undefined
  p.atualizadoEm = new Date().toISOString()
  await redis.set(`processo:${p.id}`, p)
  // Espelha o contrato no Financeiro. Roda SEMPRE, não só quando `financeiro`
  // vem no corpo: arquivar o processo muda o que entra na previsão.
  await sincronizarLancamentos(p, session.user?.name || session.user?.email || undefined)
  return NextResponse.json({ ok: true, processo: p })
}

export async function DELETE(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'excluir', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await removerLancamentos(id) // antes de apagar: lançamento órfão vira entrada fantasma
  await redis.del(`processo:${id}`)
  await redis.srem('processos', id)
  return NextResponse.json({ ok: true })
}
