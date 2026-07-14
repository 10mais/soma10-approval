import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// Catálogo de PROCEDIMENTOS E MÉTODOS da clínica (perfil clinica). A equipe
// cadastra tudo o que a clínica atende; a Agenda (tipo de atendimento) e o
// pós-atendimento (o que a paciente realizou) consomem daqui.
// Padrão do catálogo simples: um array único na chave `clinica:procedimentos`
// (mesmo desenho de tipos-tarefa).

export type Procedimento = {
  id: string
  nome: string
  categoria?: string   // ex.: Facial, Corporal, Injetáveis, Método próprio
  valorPadrao?: number // R$ de referência (a doutora ajusta no atendimento)
  duracaoMin?: number
  descricao?: string
}

const CHAVE = 'clinica:procedimentos'

async function carregar(): Promise<Procedimento[]> {
  const p = await redis.get<Procedimento[]>(CHAVE)
  return Array.isArray(p) ? p : []
}

function podeEditar(role?: string) { return role === 'admin' || role === 'gerente' }

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const procedimentos = (await carregar()).sort((a, b) => (a.categoria || '').localeCompare(b.categoria || '') || a.nome.localeCompare(b.nome, 'pt'))
  return NextResponse.json({ procedimentos })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !podeEditar((session.user as any).role)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const b = await req.json()
  const nome = String(b.nome || '').trim().slice(0, 120)
  if (!nome) return NextResponse.json({ error: 'informe o nome do procedimento' }, { status: 400 })
  const lista = await carregar()
  if (lista.some(p => p.nome.toLowerCase() === nome.toLowerCase())) {
    return NextResponse.json({ error: 'já existe um procedimento com esse nome' }, { status: 400 })
  }
  const novo: Procedimento = {
    id: uuid(),
    nome,
    ...(b.categoria ? { categoria: String(b.categoria).trim().slice(0, 60) } : {}),
    ...(Number(b.valorPadrao) > 0 ? { valorPadrao: Number(b.valorPadrao) } : {}),
    ...(Number(b.duracaoMin) > 0 ? { duracaoMin: Math.min(600, Number(b.duracaoMin)) } : {}),
    ...(b.descricao ? { descricao: String(b.descricao).slice(0, 500) } : {}),
  }
  await redis.set(CHAVE, [...lista, novo])
  return NextResponse.json({ ok: true, procedimento: novo })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !podeEditar((session.user as any).role)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const b = await req.json()
  const lista = await carregar()
  const i = lista.findIndex(p => p.id === b.id)
  if (i < 0) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  const nome = b.nome !== undefined ? String(b.nome).trim().slice(0, 120) : lista[i].nome
  if (!nome) return NextResponse.json({ error: 'informe o nome do procedimento' }, { status: 400 })
  lista[i] = {
    ...lista[i],
    nome,
    ...(b.categoria !== undefined ? { categoria: String(b.categoria).trim().slice(0, 60) || undefined } : {}),
    ...(b.valorPadrao !== undefined ? { valorPadrao: Number(b.valorPadrao) > 0 ? Number(b.valorPadrao) : undefined } : {}),
    ...(b.duracaoMin !== undefined ? { duracaoMin: Number(b.duracaoMin) > 0 ? Math.min(600, Number(b.duracaoMin)) : undefined } : {}),
    ...(b.descricao !== undefined ? { descricao: String(b.descricao).slice(0, 500) || undefined } : {}),
  }
  await redis.set(CHAVE, lista)
  return NextResponse.json({ ok: true, procedimento: lista[i] })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !podeEditar((session.user as any).role)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const lista = await carregar()
  await redis.set(CHAVE, lista.filter(p => p.id !== id))
  return NextResponse.json({ ok: true })
}
