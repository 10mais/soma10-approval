import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Tarefa } from '@/lib/redis'
import { v4 as uuid } from 'uuid'
import { notificar } from '@/lib/notificacoes'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  const ids = await redis.smembers('tarefas')
  const tarefas = (await Promise.all(ids.map(id => redis.get<Tarefa>(`tarefa:${id}`)))).filter(Boolean) as Tarefa[]
  tarefas.sort((a, b) => {
    const ordem: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 }
    return (ordem[a.prioridade] ?? 9) - (ordem[b.prioridade] ?? 9) || new Date(a.prazo || '9999').getTime() - new Date(b.prazo || '9999').getTime()
  })
  return NextResponse.json(tarefas)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') {
    return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  }
  const body = await req.json()
  const agora = new Date().toISOString()
  const tarefa: Tarefa = {
    id: uuid(),
    titulo: body.titulo || 'Nova tarefa',
    descricao: body.descricao || '',
    status: body.status || 'a_fazer',
    prioridade: body.prioridade || 'media',
    responsavelEmail: body.responsavelEmail || '',
    responsavelNome: body.responsavelNome || '',
    clienteId: body.clienteId || '',
    clienteNome: body.clienteNome || '',
    prazo: body.prazo || '',
    criadoPor: session.user?.name || '',
    criadoEm: agora,
    atualizadoEm: agora,
  }
  await redis.set(`tarefa:${tarefa.id}`, tarefa)
  await redis.sadd('tarefas', tarefa.id)
  // Notifica o responsavel se for diferente de quem criou
  if (tarefa.responsavelEmail && tarefa.responsavelEmail !== (session.user as any).email) {
    await notificar(tarefa.responsavelEmail, 'geral', `Nova tarefa atribuida`, `${session.user?.name} atribuiu a tarefa "${tarefa.titulo}" a voce.${tarefa.prazo ? ` Prazo: ${new Date(tarefa.prazo).toLocaleDateString('pt-BR')}.` : ''}`)
  }
  return NextResponse.json({ ok: true, tarefa })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') {
    return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  }
  const { id, ...updates } = await req.json()
  const tarefa = await redis.get<Tarefa>(`tarefa:${id}`)
  if (!tarefa) return NextResponse.json({ error: 'nao encontrada' }, { status: 404 })

  const camposPermitidos = ['titulo', 'descricao', 'status', 'prioridade', 'responsavelEmail', 'responsavelNome', 'clienteId', 'clienteNome', 'prazo', 'anexos']
  const atualizado = { ...tarefa, atualizadoEm: new Date().toISOString() } as any
  for (const c of camposPermitidos) { if (c in updates) atualizado[c] = updates[c] }
  if (updates.status === 'concluido' && tarefa.status !== 'concluido') atualizado.concluidoEm = new Date().toISOString()
  await redis.set(`tarefa:${id}`, atualizado)
  return NextResponse.json({ ok: true, tarefa: atualizado })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') {
    return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 })
  await redis.del(`tarefa:${id}`)
  await redis.srem('tarefas', id)
  return NextResponse.json({ ok: true })
}
