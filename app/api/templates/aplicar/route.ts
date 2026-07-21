import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, TemplateProjeto, Cliente, Marco, Tarefa } from '@/lib/redis'
import { v4 as uuid } from 'uuid'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { planejarModelo } from '@/lib/aplicarModelo'

export const runtime = 'nodejs'
export const maxDuration = 300

// Aplica um modelo de projeto a UM ou VÁRIOS clientes: cria os marcos (Playbook)
// e as tarefas, com as datas calculadas por `planejarModelo` (lib/aplicarModelo).
//
// `preview: true` devolve o que SERIA criado sem gravar nada. A prévia usa a
// mesma função do caminho de escrita — não é simulação, é o mesmo cálculo.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'admin' && role !== 'gerente')) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel(role, 'estrategia', 'editar', (session.user as any).permissoes)) return NextResponse.json({ error: 'sem permissao' }, { status: 403 })

  const { templateId, clienteId, clienteIds, dataInicio, preview } = await req.json()
  const t = await redis.get<TemplateProjeto>(`template:${templateId}`)
  if (!t) return NextResponse.json({ error: 'modelo não encontrado' }, { status: 404 })

  // Aceita os dois formatos: `clienteId` (chamada antiga, um cliente) e
  // `clienteIds[]` (mutirão). Duplicata na lista viraria etapa dobrada.
  const alvos: string[] = Array.from(new Set(
    (Array.isArray(clienteIds) && clienteIds.length ? clienteIds : [clienteId]).filter((x: any) => typeof x === 'string' && x)
  ))
  if (!alvos.length) return NextResponse.json({ error: 'informe o cliente' }, { status: 400 })

  const clientes = (await redis.mget<(Cliente | null)[]>(...alvos.map(id => `cliente:${id}`))).filter(Boolean) as Cliente[]
  if (!clientes.length) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

  const plano = planejarModelo(t, dataInicio ? new Date(dataInicio) : new Date())

  // Quem JÁ tem etapas: aplicar de novo duplica o Playbook, e etapa duplicada
  // só aparece depois, no Gantt do cliente. Quem decide é a tela — aqui a
  // informação é devolvida junto para a prévia poder avisar antes.
  const idsMarcos = await redis.smembers('marcos')
  const marcosExistentes = idsMarcos.length
    ? ((await redis.mget<(Marco | null)[]>(...idsMarcos.map(id => `marco:${id}`))).filter(Boolean) as Marco[])
    : []
  const etapasPorCliente = new Map<string, number>()
  for (const m of marcosExistentes) etapasPorCliente.set(m.clienteId, (etapasPorCliente.get(m.clienteId) || 0) + 1)

  const alvosInfo = clientes.map(c => ({ id: c.id, nome: c.nome, etapasAtuais: etapasPorCliente.get(c.id) || 0 }))

  if (preview) {
    return NextResponse.json({
      ok: true, preview: true, modelo: t.nome,
      etapas: plano.etapas, tarefas: plano.tarefas, alvos: alvosInfo,
    })
  }

  const agora = new Date().toISOString()
  const autor = session.user?.name || ''
  const aplicados: { id: string; nome: string; marcos: number; tarefas: number }[] = []

  for (const cliente of clientes) {
    const marcoIds: string[] = []
    const marcos: Marco[] = plano.etapas.map(e => {
      const marco: Marco = {
        id: uuid(), clienteId: cliente.id, clienteNome: cliente.nome,
        titulo: e.titulo, descricao: e.descricao, categoria: e.categoria as any,
        status: 'planejado', dataInicio: e.dataInicio, dataFim: e.dataFim,
        responsavelNome: '', criadoPor: autor, criadoEm: agora, atualizadoEm: agora,
      }
      marcoIds.push(marco.id)
      return marco
    })
    await Promise.all(marcos.map(m => redis.set(`marco:${m.id}`, m)))
    if (marcoIds.length) await redis.sadd('marcos', ...(marcoIds as [string, ...string[]]))

    const tarefas: Tarefa[] = plano.tarefas.map(tr => ({
      id: uuid(), titulo: tr.titulo, descricao: '',
      tipo: tr.tipo as any, status: 'a_fazer', prioridade: tr.prioridade as any,
      clienteId: cliente.id, clienteNome: cliente.nome,
      ...(typeof tr.etapaIndice === 'number' && marcoIds[tr.etapaIndice] ? { marcoId: marcoIds[tr.etapaIndice] } : {}),
      criadoPor: autor, criadoEm: agora, atualizadoEm: agora,
      atividades: [{ id: uuid(), tipo: 'criacao', descricao: `Criada a partir do modelo "${t.nome}"`, autor, criadoEm: agora }],
      comentarios: [],
    }))
    await Promise.all(tarefas.map(tf => redis.set(`tarefa:${tf.id}`, tf)))
    if (tarefas.length) await redis.sadd('tarefas', ...(tarefas.map(tf => tf.id) as [string, ...string[]]))

    aplicados.push({ id: cliente.id, nome: cliente.nome, marcos: marcos.length, tarefas: tarefas.length })
  }

  const totalMarcos = aplicados.reduce((s, a) => s + a.marcos, 0)
  const totalTarefas = aplicados.reduce((s, a) => s + a.tarefas, 0)
  // `marcos`/`tarefas` no topo: formato da resposta de um cliente só, que a tela antiga lia.
  return NextResponse.json({ ok: true, aplicados, marcos: totalMarcos, tarefas: totalTarefas })
}
