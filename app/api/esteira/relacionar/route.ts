import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Plano, Post, Tarefa } from '@/lib/redis'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// Etapa da Esteira -> tipo de tarefa. As etapas de aprovacao usam o mesmo tipo da producao.
// 'pronto' nao gera tarefa: a pauta ja virou post no Planner.
function tipoPorEtapa(etapa?: string): Tarefa['tipo'] | null {
  switch (etapa) {
    case 'briefing': return 'briefing'
    case 'copy':
    case 'aprovacao_copy': return 'copy'
    case 'criativo':
    case 'aprovacao_criativo': return 'criativo'
    default: return null // 'pronto' ou sem etapa
  }
}

// Cria (ou reaproveita) a tarefa vinculada a UMA pauta. Idempotente.
// Retorna 'criada' | 'jaVinculada' | 'pulada' (pronto/sem etapa).
async function relacionarPauta(pauta: Post, autor: string): Promise<{ resultado: string; tipo?: string; tarefaId?: string }> {
  const tipo = tipoPorEtapa(pauta.etapa)
  if (!tipo) return { resultado: 'pulada' }
  if (pauta.tarefaId) return { resultado: 'jaVinculada', tarefaId: pauta.tarefaId }

  const agora = new Date().toISOString()
  const titulo = (pauta.briefing || pauta.legenda || 'Pauta').toString().replace(/\s+/g, ' ').trim().slice(0, 80)
  const tarefa: Tarefa = {
    id: uuid(),
    titulo,
    descricao: pauta.sugestaoLegenda || pauta.briefing || '',
    tipo,
    status: 'a_fazer',
    prioridade: 'media',
    responsavelEmail: '',
    responsavelNome: '',
    clienteId: pauta.clienteId || '',
    clienteNome: pauta.clienteNome || '',
    marcoId: pauta.marcoId || '',
    prazo: pauta.dataAgendada || '',
    origemPostId: pauta.id,
    criadoPor: autor,
    criadoEm: agora,
    atualizadoEm: agora,
    atividades: [{ id: uuid(), tipo: 'criacao', descricao: `Tarefa criada a partir da pauta na Esteira (${tipo})`, autor, criadoEm: agora }],
    comentarios: [],
  }
  await redis.set(`tarefa:${tarefa.id}`, tarefa)
  await redis.sadd('tarefas', tarefa.id)
  await redis.set(`post:${pauta.id}`, { ...pauta, tarefaId: tarefa.id })
  return { resultado: 'criada', tipo, tarefaId: tarefa.id }
}

// POST { postId }  -> relaciona UMA pauta (uso atual: individual na Esteira)
// POST { planoId } -> relaciona todas as pautas do plano (mantido por compat)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  const { postId, planoId, tarefaId } = await req.json()
  const autor = session.user?.name || ''

  // Vincular a uma tarefa JA EXISTENTE (busca na Esteira). Bidirecional.
  if (postId && tarefaId) {
    const pauta = await redis.get<Post>(`post:${postId}`)
    if (!pauta) return NextResponse.json({ error: 'pauta não encontrada' }, { status: 404 })
    const tarefa = await redis.get<Tarefa>(`tarefa:${tarefaId}`)
    if (!tarefa) return NextResponse.json({ error: 'tarefa não encontrada' }, { status: 404 })
    // Nao misturar clientes: a tarefa precisa ser do mesmo cliente da pauta (quando ha cliente).
    if (pauta.clienteId && tarefa.clienteId && pauta.clienteId !== tarefa.clienteId) {
      return NextResponse.json({ error: 'A tarefa é de outro cliente.' }, { status: 400 })
    }
    await redis.set(`post:${postId}`, { ...pauta, tarefaId })
    await redis.set(`tarefa:${tarefaId}`, { ...tarefa, origemPostId: postId })
    return NextResponse.json({ ok: true, resultado: 'vinculadaExistente', tarefaId, titulo: tarefa.titulo })
  }

  // Individual — uma pauta (cria tarefa nova)
  if (postId) {
    const pauta = await redis.get<Post>(`post:${postId}`)
    if (!pauta) return NextResponse.json({ error: 'pauta não encontrada' }, { status: 404 })
    // Pauta em produção de criativo: o caminho MANUAL converge com o automático
    // da linha de montagem — tarefa do designer com a copy/anexos dentro, como
    // subtarefa da tarefa-mãe do plano (lib/tarefasDaPauta).
    if (pauta.etapa === 'criativo') {
      const { nascerTarefaDesigner } = await import('@/lib/tarefasDaPauta')
      const r = await nascerTarefaDesigner(postId, autor)
      if (r) return NextResponse.json({ ok: true, resultado: r.reaberta ? 'jaVinculada' : 'criada', tipo: 'criativo', tarefaId: r.tarefaId })
    }
    const r = await relacionarPauta(pauta, autor)
    return NextResponse.json({ ok: true, ...r })
  }

  // Em lote — plano inteiro (compat)
  if (planoId) {
    const plano = await redis.get<Plano>(`plano:${planoId}`)
    if (!plano) return NextResponse.json({ error: 'plano não encontrado' }, { status: 404 })
    const pautaIds = await redis.smembers(`plano:${planoId}:pautas`)
    const pautas = pautaIds.length > 0 ? ((await redis.mget<(Post | null)[]>(...pautaIds.map(pid => `post:${pid}`))).filter(Boolean) as Post[]) : []
    let criadas = 0, jaVinculadas = 0, puladas = 0
    for (const pauta of pautas) {
      const r = await relacionarPauta(pauta, autor)
      if (r.resultado === 'criada') criadas++
      else if (r.resultado === 'jaVinculada') jaVinculadas++
      else puladas++
    }
    return NextResponse.json({ ok: true, criadas, jaVinculadas, puladas, total: pautas.length })
  }

  return NextResponse.json({ error: 'postId ou planoId obrigatório' }, { status: 400 })
}
