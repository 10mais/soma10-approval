import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Documento } from '@/lib/redis'
import { clienteSuspenso } from '@/lib/suspensao'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// Documentos da equipe (tipo Google Docs). Por padrão são internos; um documento
// ATRIBUÍDO a um cliente pode ser compartilhado com ele (acessoCliente):
// 'ver' = o cliente lê no portal · 'editar' = o cliente edita título/conteúdo.
// Cliente NUNCA cria/exclui, nunca mexe em link público, vínculo ou permissão.

async function sessao() {
  return await getServerSession(authOptions)
}
const ehCliente = (s: any) => (s?.user as any)?.role === 'cliente'
const clienteIdDa = (s: any) => (s?.user as any)?.clienteId as string | undefined

// O documento está compartilhado com ESTE cliente?
function compartilhadoCom(doc: Documento, clienteId?: string): boolean {
  return !!clienteId && doc.clienteId === clienteId && (doc.acessoCliente === 'ver' || doc.acessoCliente === 'editar')
}

export async function GET(req: NextRequest) {
  const session = await sessao()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const cliente = ehCliente(session)
  if (cliente && await clienteSuspenso(clienteIdDa(session))) {
    return NextResponse.json({ error: 'acesso suspenso' }, { status: 403 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const d = await redis.get<Documento>(`documento:${id}`)
    if (!d) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
    if (cliente && !compartilhadoCom(d, clienteIdDa(session))) return NextResponse.json({ error: 'não autorizado' }, { status: 403 })
    return NextResponse.json(d)
  }

  const ids = await redis.smembers('documentos')
  let docs = ids.length ? ((await redis.mget<(Documento | null)[]>(...ids.map(i => `documento:${i}`))).filter(Boolean) as Documento[]) : []
  // Cliente: só o que foi COMPARTILHADO com ele.
  if (cliente) docs = docs.filter(d => compartilhadoCom(d, clienteIdDa(session)))
  docs.sort((a, b) => new Date(b.atualizadoEm || b.criadoEm).getTime() - new Date(a.atualizadoEm || a.criadoEm).getTime())
  return NextResponse.json(docs)
}

export async function POST(req: NextRequest) {
  const session = await sessao()
  if (!session || ehCliente(session)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const b = await req.json()
  const agora = new Date().toISOString()
  const doc: Documento = {
    id: uuid(),
    titulo: String(b.titulo || '').slice(0, 200),
    conteudo: String(b.conteudo || '').slice(0, 500000),
    criadoPor: session.user?.email || '',
    criadoPorNome: session.user?.name || '',
    atualizadoPorNome: session.user?.name || '',
    criadoEm: agora,
    atualizadoEm: agora,
  }
  await redis.set(`documento:${doc.id}`, doc)
  await redis.sadd('documentos', doc.id)
  return NextResponse.json({ ok: true, documento: doc })
}

export async function PUT(req: NextRequest) {
  const session = await sessao()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const { id, titulo, conteudo, gerarLink, revogarLink, clienteId, clienteNome, fontSize, acessoCliente } = await req.json()
  const doc = await redis.get<Documento>(`documento:${id}`)
  if (!doc) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

  // CLIENTE editando pelo portal: só com permissão 'editar' e só título/conteúdo.
  if (ehCliente(session)) {
    const cid = clienteIdDa(session)
    if (await clienteSuspenso(cid)) return NextResponse.json({ error: 'acesso suspenso' }, { status: 403 })
    if (!compartilhadoCom(doc, cid) || doc.acessoCliente !== 'editar') {
      return NextResponse.json({ error: 'sem permissão de edição' }, { status: 403 })
    }
    const atualizado: Documento = {
      ...doc,
      ...(titulo !== undefined ? { titulo: String(titulo).slice(0, 200) } : {}),
      ...(conteudo !== undefined ? { conteudo: String(conteudo).slice(0, 500000) } : {}),
      atualizadoPorNome: session.user?.name || doc.clienteNome || 'Cliente',
      atualizadoEm: new Date().toISOString(),
    }
    await redis.set(`documento:${id}`, atualizado)
    return NextResponse.json({ ok: true, documento: atualizado })
  }

  // Gerar / revogar link público de leitura
  if (gerarLink) {
    const token = doc.token || uuid()
    await redis.set(`documento:${id}`, { ...doc, token })
    await redis.set(`doctoken:${token}`, id)
    return NextResponse.json({ ok: true, token })
  }
  if (revogarLink) {
    if (doc.token) await redis.del(`doctoken:${doc.token}`)
    await redis.set(`documento:${id}`, { ...doc, token: undefined })
    return NextResponse.json({ ok: true, token: null })
  }

  const novoClienteId = clienteId !== undefined ? (clienteId ? String(clienteId) : undefined) : doc.clienteId
  const atualizado: Documento = {
    ...doc,
    ...(titulo !== undefined ? { titulo: String(titulo).slice(0, 200) } : {}),
    ...(conteudo !== undefined ? { conteudo: String(conteudo).slice(0, 500000) } : {}),
    ...(clienteId !== undefined ? { clienteId: novoClienteId, clienteNome: clienteId ? String(clienteNome || '') : undefined } : {}),
    ...(fontSize !== undefined ? { fontSize: Math.max(11, Math.min(28, Number(fontSize) || 15)) } : {}),
    // Permissão do cliente: 'ver' | 'editar' | '' (sem acesso). Sem cliente
    // vinculado não há com quem compartilhar — a permissão é limpa junto.
    ...(acessoCliente !== undefined ? { acessoCliente: acessoCliente === 'ver' || acessoCliente === 'editar' ? acessoCliente : undefined } : {}),
    atualizadoPorNome: session.user?.name || '',
    atualizadoEm: new Date().toISOString(),
  }
  if (!novoClienteId) atualizado.acessoCliente = undefined
  await redis.set(`documento:${id}`, atualizado)
  return NextResponse.json({ ok: true, documento: atualizado })
}

export async function DELETE(req: NextRequest) {
  const session = await sessao()
  if (!session || ehCliente(session)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const doc = await redis.get<Documento>(`documento:${id}`)
  if (!doc) return NextResponse.json({ ok: true })
  const role = (session.user as any).role
  // Excluir: só o autor ou um admin
  if (role !== 'admin' && doc.criadoPor && doc.criadoPor !== session.user?.email) {
    return NextResponse.json({ error: 'só o autor ou um admin pode excluir' }, { status: 403 })
  }
  await redis.del(`documento:${id}`)
  await redis.srem('documentos', id)
  return NextResponse.json({ ok: true })
}
