import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'

export const runtime = 'nodejs'

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime']

// Upload via token de cliente (@vercel/blob/client): o navegador envia o arquivo
// diretamente para o armazenamento do Vercel Blob, sem passar pelo corpo da
// função serverless — isso evita o limite de ~4.5MB de payload das rotas de API
// na Vercel, que era a causa de falhas ao enviar imagens/vídeos.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const body = (await req.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        return {
          allowedContentTypes: TIPOS_PERMITIDOS,
          maximumSizeInBytes: 200 * 1024 * 1024, // 200MB
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ usuario: session.user?.email }),
        }
      },
      onUploadCompleted: async () => {
        // nada a persistir aqui — a referência da mídia é salva junto com o post
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error: any) {
    console.error('Erro no upload (Vercel Blob):', error)
    return NextResponse.json({ error: error?.message || 'erro ao processar upload' }, { status: 400 })
  }
}
