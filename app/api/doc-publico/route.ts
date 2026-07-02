import { NextRequest, NextResponse } from 'next/server'
import { redis, Documento } from '@/lib/redis'

export const runtime = 'nodejs'

// Leitura PÚBLICA de um documento compartilhado por token. Sem login.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token obrigatório' }, { status: 400 })
  const id = await redis.get<string>(`doctoken:${token}`)
  if (!id) return NextResponse.json({ error: 'link inválido ou revogado' }, { status: 404 })
  const doc = await redis.get<Documento>(`documento:${id}`)
  if (!doc || doc.token !== token) return NextResponse.json({ error: 'link inválido ou revogado' }, { status: 404 })
  return NextResponse.json({ titulo: doc.titulo, conteudo: doc.conteudo, atualizadoEm: doc.atualizadoEm, autor: doc.atualizadoPorNome || doc.criadoPorNome || '' })
}
