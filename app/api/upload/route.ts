import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'

export const runtime = 'nodejs'

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime']
// Limite generoso — o upload vai direto do navegador para o Blob, sem passar pelo servidor.
const TAMANHO_MAX = 200 * 1024 * 1024 // 200 MB por arquivo

// Esta rota apenas autoriza o upload e devolve um token de curta duração.
// O arquivo é enviado diretamente do navegador para o Vercel Blob (sem limite de 4,5 MB).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('[upload] BLOB_READ_WRITE_TOKEN não configurado. Configure esta variável de ambiente na Vercel.')
    return NextResponse.json({
      error: 'Armazenamento de mídia não configurado. Acesse as configurações do projeto na Vercel e confirme que a variável BLOB_READ_WRITE_TOKEN está definida.',
    }, { status: 500 })
  }

  const body = (await req.json()) as HandleUploadBody

  try {
    const json = await handleUpload({
      body,
      request: req,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // clientPayload traz o content-type informado pelo navegador
        const tipo = clientPayload || ''
        if (tipo && !TIPOS_PERMITIDOS.includes(tipo)) {
          throw new Error('Formato não suportado. Envie imagens (JPG, PNG, WEBP, GIF) ou vídeos (MP4, MOV).')
        }
        return {
          allowedContentTypes: TIPOS_PERMITIDOS,
          maximumSizeInBytes: TAMANHO_MAX,
          // O cliente já envia um pathname único em midia/...; manter sufixo aleatório evita colisões.
          addRandomSuffix: true,
        }
      },
      onUploadCompleted: async () => {
        // Nada a fazer aqui — a URL é devolvida ao cliente pelo SDK.
      },
    })

    return NextResponse.json(json)
  } catch (err: any) {
    const msg = err?.message ?? 'Erro desconhecido ao salvar o arquivo.'
    console.error('[upload] Erro handleUpload Vercel Blob:', msg)
    return NextResponse.json({ error: `Erro ao salvar arquivo: ${msg}` }, { status: 400 })
  }
}
