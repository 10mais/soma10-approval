import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Marco } from '@/lib/redis'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') {
    return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  }
  const clienteId = req.nextUrl.searchParams.get('clienteId')
  const ids = await redis.smembers('marcos')
  let marcos = (await Promise.all(ids.map(id => redis.get<Marco>(`marco:${id}`)))).filter(Boolean) as Marco[]
  if (clienteId) marcos = marcos.filter(m => m.clienteId === clienteId)
  marcos.sort((a, b) => new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime())
  return NextResponse.json(marcos)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') {
    return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  }
  const body = await req.json()
  const agora = new Date().toISOString()
  const marco: Marco = {
    id: uuid(),
    clienteId: body.clienteId || '',
    clienteNome: body.clienteNome || '',
    titulo: body.titulo || 'Novo marco',
    descricao: body.descricao || '',
    categoria: body.categoria || 'outro',
    status: body.status || 'planejado',
    dataInicio: body.dataInicio || agora,
    dataFim: body.dataFim || '',
    responsavelNome: body.responsavelNome || '',
    criadoPor: session.user?.name || '',
    criadoEm: agora,
    atualizadoEm: agora,
  }
  await redis.set(`marco:${marco.id}`, marco)
  await redis.sadd('marcos', marco.id)
  return NextResponse.json({ ok: true, marco })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') {
    return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  }
  const { id, ...updates } = await req.json()
  const marco = await redis.get<Marco>(`marco:${id}`)
  if (!marco) return NextResponse.json({ error: 'nao encontrado' }, { status: 404 })
  const camposPermitidos = ['titulo', 'descricao', 'categoria', 'status', 'dataInicio', 'dataFim', 'responsavelNome', 'clienteId', 'clienteNome']
  const atualizado = { ...marco, atualizadoEm: new Date().toISOString() } as any
  for (const c of camposPermitidos) { if (c in updates) atualizado[c] = updates[c] }
  await redis.set(`marco:${id}`, atualizado)

  // Automação legada (toggle antigo): etapa concluída -> notifica a equipe
  if (updates.status === 'concluido' && marco.status !== 'concluido') {
    try {
      const { getAutomacoes } = await import('@/lib/automacoes')
      if ((await getAutomacoes()).etapaConcluidaNotifica) {
        const { notificarEquipe } = await import('@/lib/notificacoes')
        await notificarEquipe('geral', 'Etapa concluída', `A etapa "${marco.titulo}"${marco.clienteNome ? ` (${marco.clienteNome})` : ''} foi marcada como concluída.`)
      }
    } catch { /* não bloqueia */ }
    const { dispararEvento } = await import('@/lib/automacoesEngine')
    await dispararEvento('etapa_concluida', { marcoId: id, titulo: atualizado.titulo, categoria: atualizado.categoria, clienteId: atualizado.clienteId, clienteNome: atualizado.clienteNome })
  }

  return NextResponse.json({ ok: true, marco: atualizado })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 })
  await redis.del(`marco:${id}`)
  await redis.srem('marcos', id)
  return NextResponse.json({ ok: true })
}
