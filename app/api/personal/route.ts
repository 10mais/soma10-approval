import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'

export const runtime = 'nodejs'

// Area pessoal e PRIVADA do usuario logado: rascunho livre + microtarefas em checklist.
// Nunca aparece para outros usuarios; nao entra em Tarefas nem na Esteira.
// Guardado em personal:{email} — sempre lido/escrito pela sessao, nunca por parametro.
export type PersonalItem = { id: string; texto: string; feito: boolean }
export type PersonalNota = { id: string; texto: string; cor?: string }
// Notepad: documento com título e texto formatado (HTML), estilo ClickUp Notepad.
export type PersonalNotepad = { id: string; titulo: string; conteudo: string; criadoEm?: string; atualizadoEm?: string; fixado?: boolean }
export type PersonalData = { rascunho: string; notas?: PersonalNota[]; notepads?: PersonalNotepad[]; itens: PersonalItem[]; atualizadoEm?: string }

const VAZIO: PersonalData = { rascunho: '', notas: [], notepads: [], itens: [] }

export async function GET() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const data = (await redis.get<PersonalData>(`personal:${email}`)) || VAZIO
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const body = await req.json()
  const itens: PersonalItem[] = Array.isArray(body.itens)
    ? body.itens.map((i: any) => ({ id: String(i.id), texto: String(i.texto || ''), feito: !!i.feito }))
    : []
  const notas: PersonalNota[] = Array.isArray(body.notas)
    ? body.notas.map((n: any) => ({ id: String(n.id), texto: String(n.texto || ''), cor: n.cor ? String(n.cor) : undefined }))
    : []
  const notepads: PersonalNotepad[] = Array.isArray(body.notepads)
    ? body.notepads.map((n: any) => ({ id: String(n.id), titulo: String(n.titulo || '').slice(0, 200), conteudo: String(n.conteudo || '').slice(0, 100000), criadoEm: n.criadoEm ? String(n.criadoEm) : undefined, atualizadoEm: n.atualizadoEm ? String(n.atualizadoEm) : undefined, fixado: !!n.fixado }))
    : []
  const data: PersonalData = {
    rascunho: typeof body.rascunho === 'string' ? body.rascunho : '',
    notas,
    notepads,
    itens,
    atualizadoEm: new Date().toISOString(),
  }
  await redis.set(`personal:${email}`, data)
  return NextResponse.json({ ok: true, data })
}
