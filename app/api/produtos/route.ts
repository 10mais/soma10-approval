import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Produto } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { limparProduto } from '@/lib/estoque'
import { getPerfilInstancia } from '@/lib/perfisInstancia'
import { resolverEscopoLoja, podeEscreverNaLoja } from '@/lib/escopoLoja'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// PRODUTOS (perfil 'telefonia') — catálogo POR LOJA (cada produto tem lojaId; a
// loja focada vê só os seus). O saldo por loja vive em estoque:{loja}:{produto}.
// Gated ao perfil telefonia; nos outros perfis o produto não existe. Legado sem
// lojaId aparece só no consolidado (admin "Todas").

async function sessaoEquipe() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}
function escopoDe(session: any) {
  return { role: (session.user as any).role as string, lojaId: (session.user as any).lojaId as string | undefined }
}

async function carregarTodos(): Promise<Produto[]> {
  const ids = await redis.smembers('produtos')
  if (!ids.length) return []
  return (await redis.mget<(Produto | null)[]>(...ids.map(i => `produto:${i}`))).filter(Boolean) as Produto[]
}

export async function GET(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  // Escopo por loja (SÓ telefonia). Operador/loja focada vê os produtos DELA;
  // admin/gestor "Todas" vê todos (o legado sem lojaId aparece só aqui).
  const perfil = await getPerfilInstancia()
  const esc = perfil === 'telefonia' ? resolverEscopoLoja(escopoDe(session), req.nextUrl.searchParams.get('lojaId')) : null

  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const p = await redis.get<Produto>(`produto:${id}`)
    if (!p) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
    if (esc && (esc.tipo === 'bloqueado' || (esc.tipo === 'loja' && p.lojaId !== esc.lojaId))) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
    return NextResponse.json(p)
  }
  let produtos = await carregarTodos()
  if (esc) {
    if (esc.tipo === 'bloqueado') produtos = []
    else if (esc.tipo === 'loja') produtos = produtos.filter(p => p.lojaId === esc.lojaId)
  }
  produtos.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'))
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
  // Varejo: carimba a loja do escopo (operador na sua; admin precisa focar uma).
  let lojaId: string | undefined
  if ((await getPerfilInstancia()) === 'telefonia') {
    const escr = podeEscreverNaLoja(escopoDe(session), b.lojaId)
    if ('erro' in escr) return NextResponse.json({ error: escr.erro }, { status: escr.status })
    lojaId = escr.lojaId
  }
  const agora = new Date().toISOString()
  const produto: Produto = {
    id: uuid(), ...limpo.campos,
    ...(lojaId ? { lojaId } : {}),
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
  // Varejo: operador só edita produto da SUA loja (a loja do produto não muda).
  if ((await getPerfilInstancia()) === 'telefonia' && atual.lojaId) {
    const escr = podeEscreverNaLoja(escopoDe(session), atual.lojaId)
    if ('erro' in escr) return NextResponse.json({ error: escr.erro }, { status: escr.status })
  }
  const limpo = limparProduto(b)
  if ('erro' in limpo) return NextResponse.json({ error: limpo.erro }, { status: 400 })
  const produto: Produto = { ...atual, ...limpo.campos, lojaId: atual.lojaId, atualizadoEm: new Date().toISOString() }
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
  // Varejo: operador só exclui produto da SUA loja.
  if ((await getPerfilInstancia()) === 'telefonia') {
    const p = await redis.get<Produto>(`produto:${id}`)
    if (p?.lojaId) {
      const escr = podeEscreverNaLoja(escopoDe(session), p.lojaId)
      if ('erro' in escr) return NextResponse.json({ error: escr.erro }, { status: escr.status })
    }
  }
  await redis.del(`produto:${id}`)
  await redis.srem('produtos', id)
  return NextResponse.json({ ok: true })
}
