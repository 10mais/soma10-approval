import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { put } from '@vercel/blob'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// Aumenta o limite de parse do body para esta rota (válido no runtime Node.js no App Router)
export const maxDuration = 60 // segundos — para arquivos maiores

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime']
const TAMANHO_MAX = 10 * 1024 * 1024 // 10 MB (limite seguro na Vercel Hobby/Pro)

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  // Verificação antecipada do token — evita erro criptográfico genérico
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('[upload] BLOB_READ_WRITE_TOKEN não configurado. Configure esta variável de ambiente na Vercel.')
    return NextResponse.json({
      error: 'Armazenamento de mídia não configurado. Acesse as configurações do projeto na Vercel e confirme que a variável BLOB_READ_WRITE_TOKEN está definida.',
    }, { status: 500 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Erro ao ler o arquivo enviado.' }, { status: 400 })
  }

  const arquivo = form.get('arquivo') as File | null
  if (!arquivo) return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })

  if (!TIPOS_PERMITIDOS.includes(arquivo.type)) {
    return NextResponse.json({ error: 'Formato não suportado. Envie imagens (JPG, PNG, WEBP, GIF) ou vídeos (MP4, MOV).' }, { status: 400 })
  }
  if (arquivo.size > TAMANHO_MAX) {
    return NextResponse.json({
      error: `Arquivo muito grande (${(arquivo.size / 1024 / 1024).toFixed(1)} MB). Limite: ${TAMANHO_MAX / 1024 / 1024} MB por arquivo neste plano.`,
    }, { status: 400 })
  }

  const ext = arquivo.name.split('.').pop() || 'bin'
  const nomeArquivo = `midia/${uuid()}.${ext}`

  try {
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
  } catch (err: any) {
    const msg = err?.message ?? 'Erro desconhecido ao salvar o arquivo.'
    console.error('[upload] Erro put() Vercel Blob:', msg)
    return NextResponse.json({ error: `Erro ao salvar arquivo: ${msg}` }, { status: 500 })
  }
}
