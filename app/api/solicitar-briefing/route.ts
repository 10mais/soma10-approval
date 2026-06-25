import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Tarefa, Cliente } from '@/lib/redis'
import { v4 as uuid } from 'uuid'
import { notificarEquipe } from '@/lib/notificacoes'

export const runtime = 'nodejs'

// Solicitacao de briefing/conteudo pelo cliente (ou equipe). Cai como Tarefa tipo Criativo.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })

  const role = (session.user as any).role
  const body = await req.json()

  // Cliente so solicita para o proprio projeto; equipe pode informar o clienteId
  const clienteId = role === 'cliente' ? (session.user as any).clienteId : (body.clienteId || '')
  if (!clienteId) return NextResponse.json({ error: 'cliente nao identificado' }, { status: 400 })

  const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'cliente nao encontrado' }, { status: 404 })

  const tema = (body.tema || '').toString().trim()
  if (!tema) return NextResponse.json({ error: 'informe o tema/titulo' }, { status: 400 })

  const formato = body.formato || ''
  const objetivo = body.objetivo || ''
  const dataDesejada = body.dataDesejada || ''
  const referencia = body.referencia || ''
  const observacoes = body.observacoes || ''

  const descricao = [
    'Solicitacao de conteudo enviada pelo cliente.',
    formato ? `Formato: ${formato}` : '',
    objetivo ? `Objetivo: ${objetivo}` : '',
    dataDesejada ? `Data desejada: ${dataDesejada}` : '',
    referencia ? `Referencia: ${referencia}` : '',
    observacoes ? `Observacoes: ${observacoes}` : '',
  ].filter(Boolean).join('\n')

  const agora = new Date().toISOString()
  const tarefa: Tarefa = {
    id: uuid(),
    titulo: `[Solicitacao] ${tema}`,
    descricao,
    tipo: 'criativo',
    status: 'a_fazer',
    prioridade: 'media',
    clienteId,
    clienteNome: cliente.nome,
    criadoPor: session.user?.name || cliente.nome,
    criadoEm: agora,
    atualizadoEm: agora,
    atividades: [{ id: uuid(), tipo: 'criacao', descricao: 'Solicitacao de conteudo recebida do cliente', autor: session.user?.name || cliente.nome, criadoEm: agora }],
    comentarios: [],
  }
  await redis.set(`tarefa:${tarefa.id}`, tarefa)
  await redis.sadd('tarefas', tarefa.id)

  await notificarEquipe('briefing_solicitado', `Nova solicitacao de conteudo — ${cliente.nome}`, `${cliente.nome} solicitou: "${tema}". Triar e vincular a uma etapa do Playbook.`).catch(() => {})

  return NextResponse.json({ ok: true })
}
