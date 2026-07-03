import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { extrairTextoDeArquivo } from '@/lib/extrairTexto'

export const runtime = 'nodejs'
export const maxDuration = 120

// Extrai o texto de um documento da base de conhecimento do agente.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'apenas admin' }, { status: 403 })
  }

  const { url, nome } = await req.json()
  const r = await extrairTextoDeArquivo(url, nome)
  if (!r.ok) return NextResponse.json({ error: r.erro || 'falha ao extrair' }, { status: 422 })
  return NextResponse.json({ ok: true, texto: r.texto })
}
