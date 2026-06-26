import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const runtime = 'nodejs'
export const maxDuration = 300

const API = 'https://www.googleapis.com/drive/v3'

// Extrai o ID da pasta a partir do link do Google Drive
function extrairFolderId(url: string): string | null {
  if (!url) return null
  const m1 = url.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  if (m1) return m1[1]
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (m2) return m2[1]
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url.trim())) return url.trim()
  return null
}

// Ordena por numero da lamina (1, 2, ..., 10) de forma natural
function ordenarPorNumero(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name, 'pt', { numeric: true, sensitivity: 'base' })
}

// GET ?id=  -> faz proxy/stream do arquivo do Drive (o navegador nao acessa o Drive direto
// por CORS e nao deve receber a chave de API). O cliente sobe pelo fluxo de upload normal.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const KEY = process.env.GOOGLE_DRIVE_API_KEY || process.env.GOOGLE_API_KEY
  if (!KEY) return NextResponse.json({ error: 'Integração com o Google Drive não configurada.' }, { status: 500 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const mediaUrl = `${API}/files/${id}?alt=media&key=${KEY}&supportsAllDrives=true`
  const resp = await fetch(mediaUrl)
  if (!resp.ok || !resp.body) {
    return NextResponse.json({ error: `Não foi possível baixar o arquivo do Drive (${resp.status}).` }, { status: 400 })
  }
  // Stream direto (sem bufferizar na memoria) -> seguro para imagens e videos grandes
  return new Response(resp.body, {
    headers: {
      'Content-Type': resp.headers.get('content-type') || 'application/octet-stream',
      'Cache-Control': 'no-store',
    },
  })
}

// POST { url } -> lista os arquivos da pasta (id, nome, tipo) ja ordenados pela numeracao
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const KEY = process.env.GOOGLE_DRIVE_API_KEY || process.env.GOOGLE_API_KEY
  if (!KEY) return NextResponse.json({ error: 'Integração com o Google Drive não configurada (falta a chave de API).' }, { status: 500 })

  const { url } = await req.json()
  const folderId = extrairFolderId(url || '')
  if (!folderId) return NextResponse.json({ error: 'Link inválido. Cole o link de uma PASTA do Google Drive.' }, { status: 400 })

  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`)
  const listUrl = `${API}/files?q=${q}&key=${KEY}&fields=files(id,name,mimeType)&pageSize=1000&orderBy=name_natural&supportsAllDrives=true&includeItemsFromAllDrives=true`
  const lista = await fetch(listUrl).then(r => r.json()).catch(() => null)

  if (!lista || lista.error) {
    const msg = lista?.error?.message || 'Falha ao acessar a pasta.'
    const cod = lista?.error?.code
    if (cod === 404) return NextResponse.json({ error: 'Pasta não encontrada ou não compartilhada. Compartilhe como "qualquer pessoa com o link".' }, { status: 400 })
    if (cod === 403) return NextResponse.json({ error: `Acesso negado pelo Google (${msg}). Verifique se a pasta é pública e se a Drive API está habilitada na chave.` }, { status: 400 })
    return NextResponse.json({ error: `Google Drive: ${msg}` }, { status: 400 })
  }

  const arquivos = (lista.files || [])
    .filter((f: any) => (f.mimeType || '').startsWith('image/') || (f.mimeType || '').startsWith('video/'))
    .sort(ordenarPorNumero)
    .map((f: any) => ({ id: f.id, nome: f.name, mimeType: f.mimeType }))

  if (arquivos.length === 0) {
    return NextResponse.json({ error: 'Nenhuma imagem/vídeo encontrado na pasta. Confira o link e o compartilhamento.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, arquivos })
}
