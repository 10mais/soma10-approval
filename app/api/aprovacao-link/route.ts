import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente, Post } from '@/lib/redis'
import { v4 as uuid } from 'uuid'
import { checarRate } from '@/lib/rateLimit'

export const runtime = 'nodejs'

// POST (equipe): garante o token de aprovação do cliente e devolve o token/link.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { clienteId } = await req.json()
  const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

  let token = cliente.aprovacaoToken
  if (!token) {
    token = uuid().replace(/-/g, '').slice(0, 20)
    await redis.set(`cliente:${clienteId}`, { ...cliente, aprovacaoToken: token })
  }
  await redis.set(`aprovtoken:${token}`, clienteId) // mapa reverso O(1)
  return NextResponse.json({ ok: true, token })
}

// GET ?token= (público): lista os materiais aguardando aprovação do cliente.
export async function GET(req: NextRequest) {
  const rl = await checarRate(req, 'aprov-link', 60, 60); if (rl) return rl
  const token = req.nextUrl.searchParams.get('token') || ''
  if (!token) return NextResponse.json({ error: 'token obrigatório' }, { status: 400 })

  const clienteId = await redis.get<string>(`aprovtoken:${token}`)
  if (!clienteId) return NextResponse.json({ error: 'link inválido' }, { status: 404 })
  const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  // Cliente suspenso por inadimplência: o link público não mostra/aprova conteúdo.
  if (cliente.inadimplente) return NextResponse.json({ suspenso: true, clienteNome: cliente.nome })

  const ids = await redis.smembers('posts')
  const todos = ids.length ? ((await redis.mget<(Post | null)[]>(...ids.map(i => `post:${i}`))).filter(Boolean) as Post[]) : []
  const posts = todos
    // Mostra os aguardando aprovação E os que estão EM AJUSTE (corrigir) — para o
    // criativo não sumir enquanto a agência trabalha e o cliente poder editar o ajuste.
    .filter(p => p.clienteId === clienteId && (p.status === 'aguardando_aprovacao' || p.status === 'corrigir'))
    .sort((a, b) => (a.criadoEm || '').localeCompare(b.criadoEm || ''))
    .map(p => ({
      id: p.id, codigo: (p as any).codigo, imagens: p.imagens || [], legenda: p.legenda || '',
      formato: (p as any).formato || '', dataAgendada: (p as any).dataAgendada || '', capasVideo: (p as any).capasVideo || {},
      status: p.status, anotacoes: (p as any).anotacoes || [], ajusteCriativo: (p as any).ajusteCriativo || '', motivoReprovacao: (p as any).motivoReprovacao || '',
    }))

  // Logo do perfil: cliente.logo pode estar expirado (URL do IG → 403). Manda
  // também o ativo 'logo' da marca (Blob permanente) como fallback pro mockup.
  const assetLogo = (Array.isArray(cliente.assetsMarca) ? cliente.assetsMarca : []).find(a => a?.categoria === 'logo')?.url || ''
  return NextResponse.json({ clienteNome: cliente.nome, logo: cliente.logo || '', logoAlt: assetLogo, instagram: cliente.instagram || '', posts })
}
