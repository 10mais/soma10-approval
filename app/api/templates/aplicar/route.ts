import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, TemplateProjeto, Cliente, Marco, Tarefa } from '@/lib/redis'
import { v4 as uuid } from 'uuid'
import { bloqueiaPapel } from '@/lib/permissoesPapel'

export const runtime = 'nodejs'

// Aplica um modelo de projeto a um cliente: cria os marcos (Playbook) e as tarefas,
// com datas calculadas a partir de dataInicio + duração de cada etapa.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'admin' && role !== 'gerente')) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel(role, 'estrategia', 'editar', (session.user as any).permissoes)) return NextResponse.json({ error: 'sem permissao' }, { status: 403 })

  const { templateId, clienteId, dataInicio } = await req.json()
  const t = await redis.get<TemplateProjeto>(`template:${templateId}`)
  if (!t) return NextResponse.json({ error: 'modelo não encontrado' }, { status: 404 })
  const cliente = clienteId ? await redis.get<Cliente>(`cliente:${clienteId}`) : null
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

  const agora = new Date().toISOString()
  const inicioBase = dataInicio ? new Date(dataInicio) : new Date()
  let cursor = new Date(inicioBase)
  const marcoIds: string[] = []

  for (const m of (t.marcos || [])) {
    const ini = new Date(cursor)
    const dur = Math.max(0, Number(m.diasDuracao) || 0)
    const fim = new Date(ini.getTime() + dur * 24 * 60 * 60 * 1000)
    const marco: Marco = {
      id: uuid(), clienteId: cliente.id, clienteNome: cliente.nome,
      titulo: m.titulo, descricao: m.descricao || '', categoria: (m.categoria as any) || 'outro',
      status: 'planejado', dataInicio: ini.toISOString(), dataFim: dur > 0 ? fim.toISOString() : '',
      responsavelNome: '', criadoPor: session.user?.name || '', criadoEm: agora, atualizadoEm: agora,
    }
    await redis.set(`marco:${marco.id}`, marco)
    await redis.sadd('marcos', marco.id)
    marcoIds.push(marco.id)
    if (dur > 0) cursor = fim
  }

  let nTarefas = 0
  for (const tr of (t.tarefas || [])) {
    const marcoId = (typeof tr.marcoIndice === 'number' && marcoIds[tr.marcoIndice]) ? marcoIds[tr.marcoIndice] : undefined
    const tarefa: Tarefa = {
      id: uuid(), titulo: tr.titulo, descricao: '',
      tipo: (tr.tipo as any) || 'tarefa', status: 'a_fazer', prioridade: (tr.prioridade as any) || 'media',
      clienteId: cliente.id, clienteNome: cliente.nome, ...(marcoId ? { marcoId } : {}),
      criadoPor: session.user?.name || '', criadoEm: agora, atualizadoEm: agora,
      atividades: [{ id: uuid(), tipo: 'criacao', descricao: `Criada a partir do modelo "${t.nome}"`, autor: session.user?.name || '', criadoEm: agora }],
      comentarios: [],
    }
    await redis.set(`tarefa:${tarefa.id}`, tarefa)
    await redis.sadd('tarefas', tarefa.id)
    nTarefas++
  }

  return NextResponse.json({ ok: true, marcos: marcoIds.length, tarefas: nTarefas })
}
