import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, LancamentoFuturo, CrmNegocio, CrmContato } from '@/lib/redis'
import { ganhosPendentes, dataSugerida, descricaoDoGanho, formaValida, FORMAS_PAGAMENTO } from '@/lib/ganhosFinanceiro'
import { PartePagamento, validarPartes, gerarParcelas } from '@/lib/pagamentoGanho'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// GANHOS DO CRM → ENTRADAS. A regra de quem está pendente mora em
// lib/ganhosFinanceiro (pura, testada); aqui é só o I/O.
//
// Financeiro é do admin — inclusive esta ponte: quem lança dinheiro no caixa é
// quem responde por ele.

const DISPENSADOS = 'financeiro:ganhosDispensados'

async function admin() {
  const session = await getServerSession(authOptions)
  return (session?.user as any)?.role === 'admin' ? session : null
}

async function carregar() {
  const [idsNeg, idsLanc, dispensados] = await Promise.all([
    redis.smembers('crm:negocios'),
    redis.smembers('lancamentos'),
    redis.smembers(DISPENSADOS),
  ])
  const negocios = idsNeg.length ? ((await redis.mget<(CrmNegocio | null)[]>(...idsNeg.map(i => `negocio:${i}`))).filter(Boolean) as CrmNegocio[]) : []
  const lancamentos = idsLanc.length ? ((await redis.mget<(LancamentoFuturo | null)[]>(...idsLanc.map(i => `lancamento:${i}`))).filter(Boolean) as LancamentoFuturo[]) : []
  return { negocios, lancamentos, dispensados: (dispensados || []).map(String) }
}

export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const { negocios, lancamentos, dispensados } = await carregar()
  const pendentes = ganhosPendentes(negocios as any, lancamentos, dispensados)

  // Nome de quem pagou: o extrato precisa dele. Busca só os contatos citados.
  const ids = Array.from(new Set(pendentes.map(n => (n as any).contatoId).filter(Boolean))) as string[]
  const contatos = ids.length ? ((await redis.mget<(CrmContato | null)[]>(...ids.map(i => `contato:${i}`))).filter(Boolean) as CrmContato[]) : []
  const nomePor = new Map(contatos.map(c => [c.id, c.nome]))
  const hoje = new Date()

  return NextResponse.json({
    pendentes: pendentes.map(n => ({
      negocioId: n.id,
      titulo: n.titulo || '',
      contatoNome: nomePor.get((n as any).contatoId) || '',
      valor: Number(n.valor) || 0,
      dataSugerida: dataSugerida(n, hoje),
      descricao: descricaoDoGanho(n, nomePor.get((n as any).contatoId)),
      // O que foi vendido já vem do CRM — o financeiro só confirma/edita.
      procedimentos: Array.isArray((n as any).procedimentos) ? (n as any).procedimentos : [],
    })),
    dispensados: dispensados.length,
  })
}

// Lança UM ganho como entrada (ou desfaz uma dispensa).
export async function POST(req: NextRequest) {
  const session = await admin()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const negocioId = String(b?.negocioId || '').trim()
  if (!negocioId) return NextResponse.json({ error: 'negocioId obrigatório' }, { status: 400 })

  // Voltar atrás numa dispensa: o ganho retorna à lista de pendentes.
  if (b?.restaurar) {
    await redis.srem(DISPENSADOS, negocioId)
    return NextResponse.json({ ok: true, restaurado: true })
  }

  const negocio = await redis.get<CrmNegocio>(`negocio:${negocioId}`)
  if (!negocio) return NextResponse.json({ error: 'oportunidade não encontrada' }, { status: 404 })
  if (negocio.status !== 'ganho') return NextResponse.json({ error: 'esta oportunidade não está como ganha' }, { status: 400 })
  const valor = Number(b?.valor) > 0 ? Number(b.valor) : Number(negocio.valor) || 0
  if (!(valor > 0)) return NextResponse.json({ error: 'a oportunidade não tem valor para lançar' }, { status: 400 })

  // Composição do pagamento: uma ou várias formas (entrada no pix + crédito
  // parcelado, por exemplo). O corpo antigo com `formaPagamento` continua
  // valendo como "uma parte à vista" — a rota não quebra para quem já a chama.
  const partes: PartePagamento[] = Array.isArray(b?.partes) && b.partes.length
    ? b.partes.map((x: any) => ({
        forma: String(x?.forma || ''),
        valor: Number(x?.valor) || 0,
        ...(x?.parcelas !== undefined && x?.parcelas !== null && x?.parcelas !== '' ? { parcelas: Number(x.parcelas) } : {}),
      }))
    : [{ forma: String(b?.formaPagamento || ''), valor }]

  const erro = validarPartes(partes, valor, FORMAS_PAGAMENTO.map(f => f.chave))
  if (erro) return NextResponse.json({ error: erro }, { status: 400 })
  if (!partes.every(x => formaValida(x.forma))) return NextResponse.json({ error: 'escolha a forma de pagamento' }, { status: 400 })

  // IDEMPOTÊNCIA — a trava contra caixa inflado. Dois cliques no botão, duas
  // abas abertas, ou o mesmo ganho lançado por dois caminhos: só o primeiro vale.
  const { lancamentos } = await carregar()
  const existente = lancamentos.find(l => (l as any).negocioId === negocioId)
  if (existente) return NextResponse.json({ ok: true, jaLancado: true, lancamento: existente })

  const data = /^\d{4}-\d{2}-\d{2}$/.test(String(b?.data || '')) ? String(b.data) : dataSugerida(negocio as any, new Date())
  const contato = negocio.contatoId ? await redis.get<CrmContato>(`contato:${negocio.contatoId}`).catch(() => null) : null

  // O que foi vendido: o financeiro pode corrigir na hora do lançamento; o que
  // vier daqui também volta para a oportunidade, senão os dois lados divergem.
  const procedimentos = (Array.isArray(b?.procedimentos) ? b.procedimentos : (negocio as any).procedimentos || [])
    .map((x: unknown) => String(x || '').trim()).filter(Boolean).slice(0, 12)

  const descricaoBase = descricaoDoGanho(negocio as any, contato?.nome)
  const agora = new Date().toISOString()
  const parcelas = gerarParcelas(partes, data)

  // Uma entrada POR PARCELA, cada uma na sua data: é assim que o caixa vê o
  // dinheiro chegar. O faturamento inteiro segue contando na meta do mês do
  // ganho (lib/metas lê o negócio, não estes lançamentos) — ver lib/pagamentoGanho.
  const criados: LancamentoFuturo[] = parcelas.map(pc => ({
    id: uuid(),
    tipo: 'entrada' as const,
    descricao: pc.totalParcelas && pc.totalParcelas > 1 ? `${descricaoBase} (${pc.parcela}/${pc.totalParcelas})` : descricaoBase,
    valor: pc.valor,
    data: pc.data,
    // Parcela futura NÃO nasce recebida: ela ainda vai cair.
    recebido: b?.recebido !== false && pc.data <= data,
    negocioId,
    formaPagamento: pc.forma as any,
    ...(pc.parcela ? { parcela: pc.parcela, totalParcelas: pc.totalParcelas } : {}),
    ...(procedimentos.length ? { procedimentos } : {}),
    criadoPor: session.user?.name || '',
    criadoEm: agora,
  }))

  await Promise.all(criados.map(l => redis.set(`lancamento:${l.id}`, l)))
  // sadd tipado com rest: manda um id por vez (a lista tem 1..36 parcelas).
  await Promise.all(criados.map(l => redis.sadd('lancamentos', l.id)))
  // Se estava dispensado e foi lançado agora, a dispensa perdeu o sentido.
  await redis.srem(DISPENSADOS, negocioId).catch(() => {})
  // Devolve o que foi vendido para a oportunidade quando o financeiro corrigiu.
  if (procedimentos.length && JSON.stringify(procedimentos) !== JSON.stringify((negocio as any).procedimentos || [])) {
    await redis.set(`negocio:${negocioId}`, { ...negocio, procedimentos }).catch(() => {})
  }
  return NextResponse.json({ ok: true, lancamentos: criados, lancamento: criados[0] })
}

// Dispensar: "este ganho não vira entrada" (permuta, cortesia, cancelado).
export async function DELETE(req: NextRequest) {
  if (!(await admin())) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const negocioId = req.nextUrl.searchParams.get('negocioId')
  if (!negocioId) return NextResponse.json({ error: 'negocioId obrigatório' }, { status: 400 })
  await redis.sadd(DISPENSADOS, negocioId)
  return NextResponse.json({ ok: true })
}
