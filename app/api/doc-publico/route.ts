import { NextRequest, NextResponse } from 'next/server'
import { redis, Documento } from '@/lib/redis'
import { checarRate } from '@/lib/rateLimit'

export const runtime = 'nodejs'

// Documento compartilhado por token, SEM login. Leitura sempre; EDIÇÃO só
// quando a equipe marcou o link como "pode editar" (Documento.acessoLink) —
// estilo Google Docs "qualquer pessoa com o link". O token é a autorização.

async function docDoToken(token: string | null): Promise<Documento | null> {
  if (!token) return null
  const id = await redis.get<string>(`doctoken:${token}`)
  if (!id) return null
  const doc = await redis.get<Documento>(`documento:${id}`)
  if (!doc || doc.token !== token) return null
  return doc
}

export async function GET(req: NextRequest) {
  const rl = await checarRate(req, 'doc-publico', 60, 60); if (rl) return rl
  const doc = await docDoToken(req.nextUrl.searchParams.get('token'))
  if (!doc) return NextResponse.json({ error: 'link inválido ou revogado' }, { status: 404 })
  return NextResponse.json({
    titulo: doc.titulo, conteudo: doc.conteudo, atualizadoEm: doc.atualizadoEm,
    autor: doc.atualizadoPorNome || doc.criadoPorNome || '',
    acessoLink: doc.acessoLink === 'editar' ? 'editar' : 'ver',
    fontSize: doc.fontSize || 15,
  })
}

// Edição pública por token (sem login). Só título/conteúdo, e só se o link
// estiver marcado como "pode editar". Nunca toca em vínculo/permissões/token.
export async function PUT(req: NextRequest) {
  const rl = await checarRate(req, 'doc-publico-put', 120, 60); if (rl) return rl
  const { token, titulo, conteudo } = await req.json().catch(() => ({} as any))
  const doc = await docDoToken(token || null)
  if (!doc) return NextResponse.json({ error: 'link inválido ou revogado' }, { status: 404 })
  if (doc.acessoLink !== 'editar') return NextResponse.json({ error: 'este link é somente leitura' }, { status: 403 })

  const atualizado: Documento = {
    ...doc,
    ...(titulo !== undefined ? { titulo: String(titulo).slice(0, 200) } : {}),
    ...(conteudo !== undefined ? { conteudo: String(conteudo).slice(0, 500000) } : {}),
    atualizadoPorNome: 'Link público',
    atualizadoEm: new Date().toISOString(),
  }
  await redis.set(`documento:${doc.id}`, atualizado)
  return NextResponse.json({ ok: true, atualizadoEm: atualizado.atualizadoEm })
}
