import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import { v4 as uuid } from 'uuid'
import { avaliarTexto, TIPOS, type Comunicado, type TipoComunicacao } from '@/lib/comunicacao'

// COMUNICAÇÃO DIÁRIA com o cliente (dono, 08/09/2026). Um registro por comunicado:
// `comunicado:{id}` + índice `comunicados:{clienteId}`, no mesmo padrão de posts e
// tarefas. A regra do que conta e do que pode voltar mora em lib/comunicacao (testada).
//
// O cliente NUNCA vê esta rota: é o registro interno de quem falou o quê, quando.

const TIPOS_OK = new Set(TIPOS.map(t => t.key))

async function equipe() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente' || role === 'vendas') return null
  return session
}

export async function GET(req: NextRequest) {
  const session = await equipe()
  if (!session) return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const clienteId = req.nextUrl.searchParams.get('clienteId') || ''
  if (!clienteId) return NextResponse.json({ error: 'clienteId obrigatorio' }, { status: 400 })
  const ids = await redis.smembers(`comunicados:${clienteId}`)
  if (!ids.length) return NextResponse.json([])
  const lista = ((await redis.mget<(Comunicado | null)[]>(...ids.map(i => `comunicado:${i}`))).filter(Boolean) as Comunicado[])
  lista.sort((a, b) => (b.em || '').localeCompare(a.em || ''))
  return NextResponse.json(lista)
}

export async function POST(req: NextRequest) {
  const session = await equipe()
  if (!session) return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const body = await req.json()
  const clienteId = String(body.clienteId || '')
  const texto = String(body.texto || '').trim()
  const tipo = String(body.tipo || '') as TipoComunicacao
  if (!clienteId || !texto) return NextResponse.json({ error: 'clienteId e texto obrigatorios' }, { status: 400 })
  if (!TIPOS_OK.has(tipo)) return NextResponse.json({ error: 'tipo invalido' }, { status: 400 })

  // A mesma regra da tela, aplicada no servidor: o que o dono listou como "não
  // conta" não entra no registro nem pela API.
  const v = avaliarTexto(texto, tipo)
  if (!v.ok) return NextResponse.json({ error: v.motivo, dica: v.dica }, { status: 422 })

  const c: Comunicado = {
    id: uuid(),
    clienteId,
    tipo,
    texto: texto.slice(0, 4000),
    assunto: String(body.assunto || `livre:${Date.now()}`).slice(0, 120),
    estado: String(body.estado || 'unico').slice(0, 120),
    canal: body.canal === 'whatsapp' || body.canal === 'copiado' ? body.canal : 'outro',
    autor: session.user?.name || '',
    em: new Date().toISOString(),
  }
  await redis.set(`comunicado:${c.id}`, c)
  await redis.sadd(`comunicados:${clienteId}`, c.id)
  return NextResponse.json({ ok: true, comunicado: c })
}

// Desfazer (Ctrl+Z) e correção de registro errado.
export async function DELETE(req: NextRequest) {
  const session = await equipe()
  if (!session) return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id') || ''
  if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 })
  const c = await redis.get<Comunicado>(`comunicado:${id}`)
  if (!c) return NextResponse.json({ error: 'nao encontrado' }, { status: 404 })
  await redis.del(`comunicado:${id}`)
  await redis.srem(`comunicados:${c.clienteId}`, id)
  return NextResponse.json({ ok: true })
}
