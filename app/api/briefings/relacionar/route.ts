import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, BriefingCampanha, Tarefa } from '@/lib/redis'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// Monta a descrição da tarefa com o BRIEFING COMPLETO (campos + conteúdo gerado).
function descricaoBriefing(b: any): string {
  const cab = [
    b?.objetivo ? `Objetivo: ${b.objetivo}` : '',
    Array.isArray(b?.plataformas) && b.plataformas.length ? `Plataformas: ${b.plataformas.join(', ')}` : '',
    b?.verba ? `Verba: ${b.verba}` : '',
    b?.periodo ? `Período: ${b.periodo}` : '',
    b?.publico ? `Público-alvo: ${b.publico}` : '',
    b?.oferta ? `Oferta: ${b.oferta}` : '',
    b?.observacoes ? `Observações: ${b.observacoes}` : '',
  ].filter(Boolean).join('\n')
  const corpo = (b?.conteudo || '').toString().trim()
  return [cab, corpo].filter(Boolean).join('\n\n')
}

// POST /api/briefings/relacionar
//   { briefingId }             -> cria uma tarefa 'campanha' com o briefing COMPLETO (idempotente)
//   { briefingId, tarefaId }   -> vincula a uma tarefa EXISTENTE (anexa o briefing à descrição)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { briefingId, tarefaId } = await req.json()
  if (!briefingId) return NextResponse.json({ error: 'briefingId obrigatório' }, { status: 400 })

  const briefing = await redis.get<BriefingCampanha>(`briefing:${briefingId}`)
  if (!briefing) return NextResponse.json({ error: 'briefing não encontrado' }, { status: 404 })
  const agora = new Date().toISOString()
  const autor = session.user?.name || ''
  const bloco = descricaoBriefing(briefing)

  // Vincular a uma tarefa JÁ EXISTENTE: anexa o briefing completo à descrição.
  if (tarefaId) {
    const tarefa = await redis.get<Tarefa>(`tarefa:${tarefaId}`)
    if (!tarefa) return NextResponse.json({ error: 'tarefa não encontrada' }, { status: 404 })
    if (briefing.clienteId && tarefa.clienteId && briefing.clienteId !== tarefa.clienteId) {
      return NextResponse.json({ error: 'A tarefa é de outro cliente.' }, { status: 400 })
    }
    const desc = (tarefa.descricao || '').trim()
    const novaDesc = [desc, `--- Briefing: ${briefing.titulo || 'Campanha'} ---`, bloco].filter(Boolean).join('\n\n')
    const atividades = [...(tarefa.atividades || []), { id: uuid(), tipo: 'criacao', descricao: `Briefing de campanha "${briefing.titulo || ''}" anexado`, autor, criadoEm: agora }]
    await redis.set(`tarefa:${tarefaId}`, { ...tarefa, descricao: novaDesc, origemBriefingId: briefing.id, atualizadoEm: agora, atividades })
    await redis.set(`briefing:${briefing.id}`, { ...briefing, tarefaId })
    return NextResponse.json({ ok: true, resultado: 'vinculadaExistente', tarefaId, titulo: tarefa.titulo })
  }

  // Já vinculado a uma tarefa que ainda existe: devolve (idempotente).
  if (briefing.tarefaId) {
    const existente = await redis.get<Tarefa>(`tarefa:${briefing.tarefaId}`)
    if (existente) return NextResponse.json({ ok: true, jaVinculada: true, tarefa: existente })
  }

  // Criar tarefa NOVA com o briefing completo.
  const tarefa: Tarefa = {
    id: uuid(),
    titulo: (briefing.titulo || 'Campanha').toString().slice(0, 80),
    descricao: bloco,
    tipo: 'campanha',
    status: 'a_fazer',
    prioridade: 'media',
    responsavelEmail: '',
    responsavelNome: '',
    clienteId: briefing.clienteId || '',
    clienteNome: briefing.clienteNome || '',
    marcoId: briefing.marcoId || '',
    prazo: '',
    origemBriefingId: briefing.id,
    criadoPor: autor,
    criadoEm: agora,
    atualizadoEm: agora,
    atividades: [{ id: uuid(), tipo: 'criacao', descricao: 'Tarefa criada a partir do briefing de campanha (briefing completo)', autor, criadoEm: agora }],
    comentarios: [],
  }
  await redis.set(`tarefa:${tarefa.id}`, tarefa)
  await redis.sadd('tarefas', tarefa.id)
  await redis.set(`briefing:${briefing.id}`, { ...briefing, tarefaId: tarefa.id })

  return NextResponse.json({ ok: true, resultado: 'criada', tarefa })
}
