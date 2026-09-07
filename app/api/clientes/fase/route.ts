import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { revalidateTag } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { redis, Cliente, Marco } from '@/lib/redis'
import { getPostsDoCliente } from '@/lib/postsIndex'
import { registrarAuditoria } from '@/lib/auditoria'
import { faseDoCliente, checklistOnboarding, avaliarTransicao, FASE_ROTULO, type FaseCliente } from '@/lib/faseCliente'

export const runtime = 'nodejs'

// Transição de FASE do cliente (onboarding -> producao, ou reabrir). A regra
// vive em lib/faseCliente e é avaliada AQUI, no servidor: a tela só pede.
//
// GET  ?clienteId=  -> fase atual + checklist (auto + manual) + se pode concluir
// POST { clienteId, fase, forcar?, motivo? } -> aplica a transição (admin/gerente;
//      forçar com pendências = só admin, e fica na auditoria com o motivo)

async function carregar(clienteId: string) {
  const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
  if (!cliente) return null
  const [posts, idsMarcos] = await Promise.all([
    getPostsDoCliente(clienteId).catch(() => []),
    redis.smembers('marcos').catch(() => [] as string[]),
  ])
  const marcosTodos = idsMarcos.length ? ((await redis.mget<(Marco | null)[]>(...idsMarcos.map(i => `marco:${i}`))).filter(Boolean) as Marco[]) : []
  const marcos = marcosTodos.filter(m => (m as any).clienteId === clienteId).length
  const publicados = posts.filter(p => p.status === 'publicado').length
  const itens = checklistOnboarding({ cliente, marcos, publicados })
  return { cliente, itens }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'admin' && role !== 'gerente')) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const clienteId = req.nextUrl.searchParams.get('clienteId') || ''
  if (!clienteId) return NextResponse.json({ error: 'clienteId é obrigatório' }, { status: 400 })
  const r = await carregar(clienteId)
  if (!r) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
  const fase = faseDoCliente(r.cliente)
  return NextResponse.json({
    fase, rotulo: FASE_ROTULO[fase], faseDesde: r.cliente.faseDesde || r.cliente.criadoEm, onboardingConcluidoEm: r.cliente.onboardingConcluidoEm || null,
    itens: r.itens, feitos: r.itens.filter(i => i.ok).length, total: r.itens.length,
    podeConcluir: r.itens.every(i => i.ok), ehAdmin: role === 'admin',
    handoffVendas: (r.cliente as any).handoffVendas || '',
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'admin' && role !== 'gerente')) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const clienteId = String(body?.clienteId || '')
  const para = body?.fase as FaseCliente
  if (!clienteId || (para !== 'onboarding' && para !== 'producao')) return NextResponse.json({ error: 'pedido inválido' }, { status: 400 })

  const r = await carregar(clienteId)
  if (!r) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
  const de = faseDoCliente(r.cliente)
  const ehAdmin = role === 'admin'
  const forcar = !!body?.forcar
  const veredito = avaliarTransicao({ de, para, itens: r.itens, ehAdmin, forcar })
  if (veredito.ok === false) return NextResponse.json({ error: veredito.motivo, pendentes: veredito.pendentes || [] }, { status: 409 })

  const agora = new Date().toISOString()
  const atualizado: Cliente = { ...r.cliente, fase: para, faseDesde: agora }
  if (para === 'producao') atualizado.onboardingConcluidoEm = agora
  await redis.set(`cliente:${clienteId}`, atualizado)
  revalidateTag('clientes')
  // A Home guarda cache por pessoa (60s); a fase nova aparece no próximo minuto.
  const ator = session.user?.name || session.user?.email || 'equipe'
  const forcado = para === 'producao' && forcar && !r.itens.every(i => i.ok)
  await registrarAuditoria({
    ator, acao: para === 'producao' ? (forcado ? 'onboarding_concluido_forcado' : 'onboarding_concluido') : 'onboarding_reaberto',
    alvo: r.cliente.nome,
    detalhe: forcado ? `Pendências ignoradas: ${r.itens.filter(i => !i.ok).map(i => i.label).join('; ')}${body?.motivo ? ` — motivo: ${String(body.motivo).slice(0, 300)}` : ''}` : undefined,
  })
  return NextResponse.json({ ok: true, fase: para, rotulo: FASE_ROTULO[para], faseDesde: agora })
}
