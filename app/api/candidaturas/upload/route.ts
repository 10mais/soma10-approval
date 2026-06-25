import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'

export const runtime = 'nodejs'

// Upload PUBLICO de curriculo para a pagina "Trabalhe conosco" (sem login).
// Restrito a PDF e ate 10 MB para evitar abuso.
const TIPOS = ['application/pdf']
const MAX = 10 * 1024 * 1024

export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'Armazenamento nao configurado.' }, { status: 500 })
  }
  const body = (await req.json()) as HandleUploadBody
  try {
    const json = await handleUpload({
      body,
      request: req,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const tipo = clientPayload || ''
        if (tipo && !TIPOS.includes(tipo)) throw new Error('Envie o curriculo em PDF.')
        return { allowedContentTypes: TIPOS, maximumSizeInBytes: MAX, addRandomSuffix: true }
      },
      onUploadCompleted: async () => {},
    })
    return NextResponse.json(json)
  } catch (err: any) {
    return NextResponse.json({ error: `Erro ao enviar curriculo: ${err?.message || 'desconhecido'}` }, { status: 400 })
  }
}
