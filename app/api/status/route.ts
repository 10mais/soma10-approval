import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente, Post } from '@/lib/redis'
import { getPostsDoCliente } from '@/lib/postsIndex'
import { checarRate } from '@/lib/rateLimit'

export const runtime = 'nodejs'

function titulo(p: Post) { const l = (p.legenda || '').replace(/\s+/g, ' ').trim(); return l ? l.slice(0, 60) + (l.length > 60 ? '…' : '') : `Post ${(p as any).codigo || ''}`.trim() }

// GET ?token= -> status PÚBLICO do cliente (sem login)
export async function GET(req: NextRequest) {
  const rl = await checarRate(req, 'status', 60, 60); if (rl) return rl
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token obrigatório' }, { status: 400 })

  // Lookup O(1) pelo mapa reverso; se faltar (token antigo), varre uma vez e backfilla.
  let clienteId = await redis.get<string>(`statustoken:${token}`)
  let cliente: Cliente | null = clienteId ? await redis.get<Cliente>(`cliente:${clienteId}`) : null
  if (!cliente) {
    const ids = await redis.smembers('clientes')
    const clientes = ids.length ? ((await redis.mget<(Cliente | null)[]>(...ids.map(i => `cliente:${i}`))).filter(Boolean) as Cliente[]) : []
    cliente = clientes.find(c => c.statusToken && c.statusToken === token) || null
    if (cliente) { clienteId = cliente.id; await redis.set(`statustoken:${token}`, cliente.id) }
  }
  if (!cliente) return NextResponse.json({ error: 'link inválido' }, { status: 404 })
  // Cliente suspenso por inadimplência: link público de status fica indisponível.
  if (cliente.inadimplente) return NextResponse.json({ suspenso: true, clienteNome: cliente.nome })

  const meus = await getPostsDoCliente(cliente.id)

  const agora = Date.now()
  const mes = new Date(), m = mes.getMonth(), y = mes.getFullYear()
  const doMes = (iso?: string) => { if (!iso) return false; const d = new Date(iso); return d.getMonth() === m && d.getFullYear() === y }

  const pendentes = meus.filter(p => (p as any).etapa === 'aprovacao_copy' || (p as any).etapa === 'aprovacao_criativo').length
  const emProducao = meus.filter(p => (p as any).etapa && (p as any).etapa !== 'pronto' && (p as any).etapa !== 'aprovacao_copy' && (p as any).etapa !== 'aprovacao_criativo').length
  const publicadosMes = meus.filter(p => p.status === 'publicado' && doMes((p as any).dataAgendada || p.atualizadoEm || p.criadoEm)).length
  const proximos = meus.filter(p => p.status === 'agendado' && (p as any).dataAgendada && new Date((p as any).dataAgendada).getTime() >= agora)
    .sort((a, b) => new Date((a as any).dataAgendada).getTime() - new Date((b as any).dataAgendada).getTime())
    .slice(0, 6).map(p => ({ titulo: titulo(p), data: (p as any).dataAgendada }))
  const ultimos = meus.filter(p => p.status === 'publicado')
    .sort((a, b) => new Date((b as any).dataAgendada || b.atualizadoEm || 0).getTime() - new Date((a as any).dataAgendada || a.atualizadoEm || 0).getTime())
    .slice(0, 6).map(p => ({ titulo: titulo(p), data: (p as any).dataAgendada || p.atualizadoEm }))

  return NextResponse.json({
    cliente: { nome: cliente.nome, logo: cliente.logo || '', corPrimaria: cliente.corPrimaria || '#ffc00f' },
    pendentes, emProducao, publicadosMes, meta: Number(cliente.postsMensais) || 0, proximos, ultimos,
  })
}

// POST { clienteId } -> gera/retorna o token do link público (equipe)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'admin' && role !== 'gerente')) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const { clienteId } = await req.json()
  const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
  if (!cliente.statusToken) {
    cliente.statusToken = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    await redis.set(`cliente:${clienteId}`, cliente)
  }
  // Mapa reverso token -> clienteId (lookup O(1) no GET público, sem varrer clientes)
  await redis.set(`statustoken:${cliente.statusToken}`, clienteId)
  return NextResponse.json({ ok: true, token: cliente.statusToken })
}
