import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, LancamentoFuturo, CrmNegocio, CrmContato } from '@/lib/redis'
import { ganhosPendentes, dataSugerida, descricaoDoGanho, formaValida } from '@/lib/ganhosFinanceiro'
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

  const forma = String(b?.formaPagamento || '')
  if (!formaValida(forma)) return NextResponse.json({ error: 'escolha a forma de pagamento' }, { status: 400 })

  // IDEMPOTÊNCIA — a trava contra caixa inflado. Dois cliques no botão, duas
  // abas abertas, ou o mesmo ganho lançado por dois caminhos: só o primeiro vale.
  const { lancamentos } = await carregar()
  const existente = lancamentos.find(l => (l as any).negocioId === negocioId)
  if (existente) return NextResponse.json({ ok: true, jaLancado: true, lancamento: existente })

  const data = /^\d{4}-\d{2}-\d{2}$/.test(String(b?.data || '')) ? String(b.data) : dataSugerida(negocio as any, new Date())
  const contato = negocio.contatoId ? await redis.get<CrmContato>(`contato:${negocio.contatoId}`).catch(() => null) : null

  const l: LancamentoFuturo = {
    id: uuid(),
    tipo: 'entrada',
    descricao: descricaoDoGanho(negocio as any, contato?.nome),
    valor,
    data,
    recebido: b?.recebido !== false, // venda fechada na clínica costuma ser paga na hora
    negocioId,
    formaPagamento: forma as any,
    criadoPor: session.user?.name || '',
    criadoEm: new Date().toISOString(),
  }
  await redis.set(`lancamento:${l.id}`, l)
  await redis.sadd('lancamentos', l.id)
  // Se estava dispensado e foi lançado agora, a dispensa perdeu o sentido.
  await redis.srem(DISPENSADOS, negocioId).catch(() => {})
  return NextResponse.json({ ok: true, lancamento: l })
}

// Dispensar: "este ganho não vira entrada" (permuta, cortesia, cancelado).
export async function DELETE(req: NextRequest) {
  if (!(await admin())) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const negocioId = req.nextUrl.searchParams.get('negocioId')
  if (!negocioId) return NextResponse.json({ error: 'negocioId obrigatório' }, { status: 400 })
  await redis.sadd(DISPENSADOS, negocioId)
  return NextResponse.json({ ok: true })
}
