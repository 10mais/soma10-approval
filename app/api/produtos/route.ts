import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Produto } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { limparProduto } from '@/lib/estoque'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// PRODUTOS (perfil 'telefonia') — catálogo COMPARTILHADO entre as lojas. O saldo
// por loja NÃO vive aqui (chave estoque:{loja}:{produto}, ver /api/estoque).
// Molde: /api/processos. Equipe lê; escrita exige CRM/editar.

async function sessaoEquipe() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}

async function carregarTodos(): Promise<Produto[]> {
  const ids = await redis.smembers('produtos')
  if (!ids.length) return []
  return (await redis.mget<(Produto | null)[]>(...ids.map(i => `produto:${i}`))).filter(Boolean) as Produto[]
}

export async function GET(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const p = await redis.get<Produto>(`produto:${id}`)
    return p ? NextResponse.json(p) : NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  }
  const produtos = (await carregarTodos()).sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'))
  return NextResponse.json({ produtos })
}

export async function POST(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const limpo = limparProduto(await req.json())
  if ('erro' in limpo) return NextResponse.json({ error: limpo.erro }, { status: 400 })
  const agora = new Date().toISOString()
  const produto: Produto = {
    id: uuid(), ...limpo.campos,
    criadoPor: session.user?.name || session.user?.email || undefined,
    criadoEm: agora, atualizadoEm: agora,
  }
  await redis.set(`produto:${produto.id}`, produto)
  await redis.sadd('produtos', produto.id)
  return NextResponse.json({ ok: true, produto })
}

export async function PUT(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const b = await req.json()
  const atual = await redis.get<Produto>(`produto:${b.id}`)
  if (!atual) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  const limpo = limparProduto(b)
  if ('erro' in limpo) return NextResponse.json({ error: limpo.erro }, { status: 400 })
  const produto: Produto = { ...atual, ...limpo.campos, atualizadoEm: new Date().toISOString() }
  await redis.set(`produto:${produto.id}`, produto)
  return NextResponse.json({ ok: true, produto })
}

export async function DELETE(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'excluir', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await redis.del(`produto:${id}`)
  await redis.srem('produtos', id)
  return NextResponse.json({ ok: true })
}
