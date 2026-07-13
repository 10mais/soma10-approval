import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// Modelos de mensagem (respostas rápidas) do inbox do CRM. Compartilhados pela
// equipe. Chave única: `config:msgTemplates` (array). Placeholders {nome}/{primeiro}
// são resolvidos no cliente ao inserir no compositor.

export type MsgTemplate = { id: string; titulo: string; texto: string }

async function autorizado() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}
async function carregar(): Promise<MsgTemplate[]> {
  const t = await redis.get<MsgTemplate[]>('config:msgTemplates')
  return Array.isArray(t) ? t : []
}

export async function GET() {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  return NextResponse.json({ templates: await carregar() })
}

export async function POST(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const b = await req.json()
  const titulo = String(b.titulo || '').trim().slice(0, 60)
  const texto = String(b.texto || '').trim().slice(0, 2000)
  if (!titulo || !texto) return NextResponse.json({ error: 'informe título e texto do modelo' }, { status: 400 })

  const lista = await carregar()
  if (b.id && lista.some(t => t.id === b.id)) {
    const nova = lista.map(t => t.id === b.id ? { ...t, titulo, texto } : t)
    await redis.set('config:msgTemplates', nova)
    return NextResponse.json({ ok: true, templates: nova })
  }
  const novo: MsgTemplate = { id: uuid(), titulo, texto }
  const nova = [...lista, novo]
  await redis.set('config:msgTemplates', nova)
  return NextResponse.json({ ok: true, templates: nova, criado: novo })
}

export async function DELETE(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const nova = (await carregar()).filter(t => t.id !== id)
  await redis.set('config:msgTemplates', nova)
  return NextResponse.json({ ok: true, templates: nova })
}
