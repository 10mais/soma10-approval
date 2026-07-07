import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente, NpsResposta } from '@/lib/redis'
import { v4 as uuid } from 'uuid'
import { checarRate } from '@/lib/rateLimit'

export const runtime = 'nodejs'

// GET ?token=  (público) — dados p/ a página de pesquisa.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || ''
  if (!token) return NextResponse.json({ error: 'token obrigatório' }, { status: 400 })
  const clienteId = await redis.get<string>(`npstoken:${token}`)
  if (!clienteId) return NextResponse.json({ error: 'link inválido' }, { status: 404 })
  const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  return NextResponse.json({ clienteNome: cliente.nome, logo: cliente.logo || '' })
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Envio público de resposta: { token, score, comentario, periodo }
  if (body?.token) {
    const rl = await checarRate(req, 'nps', 10, 60); if (rl) return rl
    const clienteId = await redis.get<string>(`npstoken:${body.token}`)
    if (!clienteId) return NextResponse.json({ error: 'link inválido' }, { status: 404 })
    const score = Math.min(Math.max(Math.round(Number(body.score)), 0), 10)
    if (isNaN(score)) return NextResponse.json({ error: 'nota inválida' }, { status: 400 })
    const resp: NpsResposta = {
      id: uuid(), clienteId, score,
      comentario: (body.comentario || '').toString().slice(0, 1000),
      periodo: body.periodo === 'trimestral' ? 'trimestral' : 'mensal',
      criadoEm: new Date().toISOString(),
    }
    await redis.set(`nps:${resp.id}`, resp)
    await redis.sadd('nps', resp.id)
    await redis.sadd(`cliente:${clienteId}:nps`, resp.id)
    return NextResponse.json({ ok: true })
  }

  // Geração do link (equipe): { clienteId, acao:'link' }
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const cliente = await redis.get<Cliente>(`cliente:${body.clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
  let token = cliente.npsToken
  if (!token) {
    token = uuid().replace(/-/g, '').slice(0, 20)
    await redis.set(`cliente:${body.clienteId}`, { ...cliente, npsToken: token })
  }
  await redis.set(`npstoken:${token}`, body.clienteId)
  return NextResponse.json({ ok: true, token })
}
