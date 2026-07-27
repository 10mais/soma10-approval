import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Produto } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { limparProduto } from '@/lib/estoque'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// PRODUTOS (perfil 'telefonia') — catálogo COMPARTILHADO entre as lojas: um
// cadastro vale para as 3 unidades; só o ESTOQUE é por loja (estoque:{loja}:
// {produto}). Gated ao perfil telefonia; nos outros perfis o produto não existe.

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
  // Catálogo COMPARTILHADO entre as lojas (decisão do dono): um cadastro de
  // produto vale para as 3 unidades; só o ESTOQUE é por loja. Por isso NÃO se
  // filtra por lojaId aqui — trocar de loja muda os saldos (Estoque/PDV), não a
  // lista do catálogo. (Legado sem lojaId aparece normalmente.)
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const p = await redis.get<Produto>(`produto:${id}`)
    if (!p) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
    return NextResponse.json(p)
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
  const b = await req.json()
  const limpo = limparProduto(b)
  if ('erro' in limpo) return NextResponse.json({ error: limpo.erro }, { status: 400 })
  // Catálogo COMPARTILHADO: o produto é da rede, não de uma loja — não carimba
  // lojaId. O estoque inicial (se houver) entra por loja via /api/estoque.
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
  // Catálogo COMPARTILHADO: qualquer um da equipe edita o produto da rede (sem
  // trava por loja). Limpa o lojaId legado — o catálogo não pertence a loja.
  const limpo = limparProduto(b)
  if ('erro' in limpo) return NextResponse.json({ error: limpo.erro }, { status: 400 })
  const { lojaId: _legado, ...semLoja } = atual
  const produto: Produto = { ...semLoja, ...limpo.campos, atualizadoEm: new Date().toISOString() }
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
  // Catálogo COMPARTILHADO: exclusão do produto da rede não é travada por loja.
  await redis.del(`produto:${id}`)
  await redis.srem('produtos', id)
  return NextResponse.json({ ok: true })
}
