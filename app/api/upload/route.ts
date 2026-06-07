import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { put } from '@vercel/blob'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime']
const TAMANHO_MAX = 200 * 1024 * 1024 // 200MB

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const form = await req.formData()
  const arquivo = form.get('arquivo') as File | null
  if (!arquivo) return NextResponse.json({ error: 'nenhum arquivo enviado' }, { status: 400 })

  if (!TIPOS_PERMITIDOS.includes(arquivo.type)) {
    return NextResponse.json({ error: 'formato não suportado. Envie imagens (JPG, PNG, WEBP, GIF) ou vídeos (MP4, MOV).' }, { status: 400 })
  }
  if (arquivo.size > TAMANHO_MAX) {
    return NextResponse.json({ error: 'arquivo muito grande. Limite de 200MB.' }, { status: 400 })
  }

  const ext = arquivo.name.split('.').pop() || 'bin'
  const nomeArquivo = `midia/${uuid()}.${ext}`

  const blob = await put(nomeArquivo, arquivo, {
    access: 'public',
    token: process.env.BLOB_READ_WRITE_TOKEN,
    contentType: arquivo.type,
  })

  return NextResponse.json({
    ok: true,
    url: blob.url,
    tipo: arquivo.type.startsWith('video') ? 'video' : 'imagem',
    nome: arquivo.name,
  })
}
