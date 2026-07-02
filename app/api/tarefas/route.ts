import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Tarefa, Usuario } from '@/lib/redis'
import { v4 as uuid } from 'uuid'
import { notificar } from '@/lib/notificacoes'
import { dispararEvento } from '@/lib/automacoesEngine'

function extrairMencoes(texto: string): string[] {
  const regex = /@([a-zA-ZÀ-ÿ\s]+?)(?=\s@|\s*$|[.,!?;:\])])/g
  const mencoes: string[] = []
  let m
  while ((m = regex.exec(texto)) !== null) mencoes.push(m[1].trim())
  return mencoes
}

async function resolverEmailPorNome(nome: string): Promise<string | null> {
  const emails = await redis.smembers('usuarios')
  if (emails.length === 0) return null
  const usuarios = (await redis.mget<(Usuario | null)[]>(...emails.map(e => `usuario:${e}`))).filter(Boolean) as Usuario[]
  const u = usuarios.find(x => x.nome.toLowerCase() === nome.toLowerCase())
  return u?.email || null
}

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })

  const lixeira = req.nextUrl.searchParams.get('lixeira') === 'true'

  if (lixeira) {
    const ids = await redis.smembers('tarefas_excluidas')
    const tarefas = ids.length > 0 ? (await redis.mget<(any | null)[]>(...ids.map(id => `tarefa:${id}`))).filter(Boolean) : []
    const agora = Date.now()
    const TRINTA_DIAS = 30 * 24 * 60 * 60 * 1000
    const validas: any[] = []
    for (const t of tarefas) {
      if (t.excluidoEm && agora - new Date(t.excluidoEm).getTime() > TRINTA_DIAS) {
        await redis.del(`tarefa:${t.id}`)
        await redis.srem('tarefas_excluidas', t.id)
      } else {
        validas.push(t)
      }
    }
    validas.sort((a, b) => new Date(b.excluidoEm || 0).getTime() - new Date(a.excluidoEm || 0).getTime())
    return NextResponse.json(validas)
  }

  const ids = await redis.smembers('tarefas')
  const tarefas = ids.length > 0 ? ((await redis.mget<(Tarefa | null)[]>(...ids.map(id => `tarefa:${id}`))).filter(Boolean) as Tarefa[]) : []
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
  const { getOperacional } = await import('@/lib/operacional')
  const prioridadePadrao = (await getOperacional()).prioridadePadrao
  const tarefa: Tarefa = {
    id: uuid(),
    titulo: body.titulo || 'Nova tarefa',
    descricao: body.descricao || '',
    tipo: body.tipo || 'tarefa',
    status: body.status || 'a_fazer',
    prioridade: body.prioridade || prioridadePadrao,
    responsavelEmail: body.responsavelEmail || '',
    responsavelNome: body.responsavelNome || '',
    clienteId: body.clienteId || '',
    clienteNome: body.clienteNome || '',
    marcoId: body.marcoId || '',
    ...(body.tarefaPaiId ? { tarefaPaiId: body.tarefaPaiId } : {}),
    prazo: body.prazo || '',
    ...(body.recorrencia ? { recorrencia: body.recorrencia } : {}),
    criadoPor: session.user?.name || '',
    criadoEm: agora,
    atualizadoEm: agora,
    atividades: [{ id: uuid(), tipo: 'criacao', descricao: 'Tarefa criada', autor: session.user?.name || '', criadoEm: agora }],
    comentarios: [],
  }
  await redis.set(`tarefa:${tarefa.id}`, tarefa)
  await redis.sadd('tarefas', tarefa.id)
  // Notifica o responsavel se for diferente de quem criou
  if (tarefa.responsavelEmail && tarefa.responsavelEmail !== (session.user as any).email) {
    await notificar(tarefa.responsavelEmail, 'geral', `Nova tarefa atribuida`, `${session.user?.name} atribuiu a tarefa "${tarefa.titulo}" a voce.${tarefa.prazo ? ` Prazo: ${new Date(tarefa.prazo).toLocaleDateString('pt-BR')}.` : ''}`, undefined, tarefa.id)
  }
  await dispararEvento('tarefa_criada', { tarefaId: tarefa.id, titulo: tarefa.titulo, tipo: tarefa.tipo, prioridade: tarefa.prioridade, clienteId: tarefa.clienteId, clienteNome: tarefa.clienteNome, responsavelEmail: tarefa.responsavelEmail, responsavelNome: tarefa.responsavelNome })
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

  // Restaurar da lixeira
  if (updates.restaurar) {
    await redis.srem('tarefas_excluidas', id)
    await redis.sadd('tarefas', id)
    const restaurado = { ...tarefa } as any
    delete restaurado.excluidoEm
    delete restaurado.excluidoPor
    await redis.set(`tarefa:${id}`, restaurado)
    return NextResponse.json({ ok: true })
  }

  const camposPermitidos = ['titulo', 'descricao', 'tipo', 'status', 'prioridade', 'responsavelEmail', 'responsavelNome', 'clienteId', 'clienteNome', 'marcoId', 'prazo', 'recorrencia', 'anexos', 'checklist']
  const atualizado = { ...tarefa, atualizadoEm: new Date().toISOString() } as any
  const autor = session.user?.name || ''
  const agora = new Date().toISOString()
  const novasAtividades = [...(tarefa.atividades || [])]

  // Registra mudancas no activity log
  const statusLabels: Record<string, string> = { a_fazer: 'A fazer', em_andamento: 'Em andamento', em_revisao: 'Em revisao', concluido: 'Concluido' }
  if (updates.status && updates.status !== tarefa.status) novasAtividades.push({ id: uuid(), tipo: 'status', descricao: `Status alterado para ${statusLabels[updates.status] || updates.status}`, autor, criadoEm: agora })
  if (updates.responsavelNome && updates.responsavelNome !== tarefa.responsavelNome) novasAtividades.push({ id: uuid(), tipo: 'responsavel', descricao: `Responsavel alterado para ${updates.responsavelNome}`, autor, criadoEm: agora })
  if (updates.prioridade && updates.prioridade !== tarefa.prioridade) novasAtividades.push({ id: uuid(), tipo: 'prioridade', descricao: `Prioridade alterada para ${updates.prioridade}`, autor, criadoEm: agora })
  if (updates.prazo && updates.prazo !== tarefa.prazo) novasAtividades.push({ id: uuid(), tipo: 'prazo', descricao: `Prazo definido para ${new Date(updates.prazo).toLocaleDateString('pt-BR')}`, autor, criadoEm: agora })
  if (updates.clienteNome && updates.clienteNome !== tarefa.clienteNome) novasAtividades.push({ id: uuid(), tipo: 'cliente', descricao: `Cliente alterado para ${updates.clienteNome}`, autor, criadoEm: agora })

  // Editar comentario existente
  if (updates.editarComentario) {
    const { id: comId, texto: novoTexto } = updates.editarComentario
    const comentarios = [...(tarefa.comentarios || [])]
    const idx = comentarios.findIndex((c: any) => c.id === comId)
    if (idx >= 0) {
      comentarios[idx] = { ...comentarios[idx], texto: novoTexto, editadoEm: agora }
      atualizado.comentarios = comentarios
      novasAtividades.push({ id: uuid(), tipo: 'comentario', descricao: `Editou comentario`, autor, criadoEm: agora })
    }
    atualizado.atividades = novasAtividades
    await redis.set(`tarefa:${id}`, atualizado)
    return NextResponse.json({ ok: true, tarefa: atualizado })
  }

  // Excluir comentario
  if (updates.excluirComentario) {
    const comentarios = (tarefa.comentarios || []).filter((c: any) => c.id !== updates.excluirComentario)
    atualizado.comentarios = comentarios
    novasAtividades.push({ id: uuid(), tipo: 'comentario', descricao: `Removeu um comentario`, autor, criadoEm: agora })
    atualizado.atividades = novasAtividades
    await redis.set(`tarefa:${id}`, atualizado)
    return NextResponse.json({ ok: true, tarefa: atualizado })
  }

  // Apontamento de horas — adicionar
  if (updates.apontarHoras) {
    const { minutos, descricao, data } = updates.apontarHoras
    const min = Math.max(0, Math.round(Number(minutos) || 0))
    if (min > 0) {
      const apont = { id: uuid(), usuarioEmail: (session.user as any).email, usuarioNome: autor, minutos: min, descricao: descricao || '', data: data || agora, criadoEm: agora }
      atualizado.apontamentos = [...(tarefa.apontamentos || []), apont]
      novasAtividades.push({ id: uuid(), tipo: 'comentario', descricao: `Apontou ${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')} de trabalho`, autor, criadoEm: agora })
      atualizado.atividades = novasAtividades
      await redis.set(`tarefa:${id}`, atualizado)
    }
    return NextResponse.json({ ok: true, tarefa: atualizado })
  }

  // Relacionar tarefa (vinculo bidirecional manual)
  if (updates.relacionarTarefa) {
    const outroId = String(updates.relacionarTarefa)
    if (outroId !== id) {
      const outro = await redis.get<Tarefa>(`tarefa:${outroId}`)
      if (outro) {
        atualizado.relacionadas = Array.from(new Set([...(tarefa.relacionadas || []), outroId]))
        await redis.set(`tarefa:${id}`, atualizado)
        await redis.set(`tarefa:${outroId}`, { ...outro, relacionadas: Array.from(new Set([...(outro.relacionadas || []), id])) })
      }
    }
    return NextResponse.json({ ok: true, tarefa: atualizado })
  }

  // Desfazer relacionamento (remove dos dois lados)
  if (updates.desrelacionarTarefa) {
    const outroId = String(updates.desrelacionarTarefa)
    atualizado.relacionadas = (tarefa.relacionadas || []).filter((x: string) => x !== outroId)
    await redis.set(`tarefa:${id}`, atualizado)
    const outro = await redis.get<Tarefa>(`tarefa:${outroId}`)
    if (outro) await redis.set(`tarefa:${outroId}`, { ...outro, relacionadas: (outro.relacionadas || []).filter((x: string) => x !== id) })
    return NextResponse.json({ ok: true, tarefa: atualizado })
  }

  // Apontamento de horas — remover
  if (updates.removerApontamento) {
    atualizado.apontamentos = (tarefa.apontamentos || []).filter((a: any) => a.id !== updates.removerApontamento)
    await redis.set(`tarefa:${id}`, atualizado)
    return NextResponse.json({ ok: true, tarefa: atualizado })
  }

  // Comentario novo
  if (updates.novoComentario) {
    const comentarios = [...(tarefa.comentarios || [])]
    const com = { id: uuid(), autor: (session.user as any).email, autorNome: autor, texto: updates.novoComentario, criadoEm: agora }
    comentarios.push(com)
    atualizado.comentarios = comentarios
    novasAtividades.push({ id: uuid(), tipo: 'comentario', descricao: `Comentou: "${updates.novoComentario.slice(0, 60)}"`, autor, criadoEm: agora })

    // Notificar mencionados com @
    const mencoes = extrairMencoes(updates.novoComentario)
    for (const nome of mencoes) {
      const email = await resolverEmailPorNome(nome)
      if (email && email !== (session.user as any).email) {
        await notificar(email, 'tarefa_mencao', `Voce foi mencionado`, `${autor} mencionou voce na tarefa "${tarefa.titulo}": "${updates.novoComentario.slice(0, 80)}"`, undefined, id)
      }
    }
  }

  atualizado.atividades = novasAtividades
  for (const c of camposPermitidos) { if (c in updates) atualizado[c] = updates[c] }
  if (updates.status === 'concluido' && tarefa.status !== 'concluido') atualizado.concluidoEm = new Date().toISOString()
  await redis.set(`tarefa:${id}`, atualizado)

  if (updates.status === 'concluido' && tarefa.status !== 'concluido') {
    await dispararEvento('tarefa_concluida', { tarefaId: id, titulo: atualizado.titulo, tipo: atualizado.tipo, prioridade: atualizado.prioridade, clienteId: atualizado.clienteId, clienteNome: atualizado.clienteNome, responsavelEmail: atualizado.responsavelEmail, responsavelNome: atualizado.responsavelNome })

    // Tarefa recorrente: ao concluir, gera a próxima ocorrência (nova, a fazer)
    if (atualizado.recorrencia) {
      const base = atualizado.prazo ? new Date(atualizado.prazo) : new Date()
      const d = new Date(base)
      if (atualizado.recorrencia === 'diaria') d.setDate(d.getDate() + 1)
      else if (atualizado.recorrencia === 'semanal') d.setDate(d.getDate() + 7)
      else if (atualizado.recorrencia === 'quinzenal') d.setDate(d.getDate() + 14)
      else if (atualizado.recorrencia === 'mensal') d.setMonth(d.getMonth() + 1)
      const nova: Tarefa = {
        ...atualizado, id: uuid(), status: 'a_fazer', prazo: d.toISOString(),
        criadoPor: 'Recorrência', criadoEm: agora, atualizadoEm: agora, concluidoEm: undefined,
        atividades: [{ id: uuid(), tipo: 'criacao', descricao: 'Gerada por recorrência', autor: 'Recorrência', criadoEm: agora }],
        comentarios: [], apontamentos: [],
        checklist: (atualizado.checklist || []).map((c: any) => ({ ...c, feito: false })),
      }
      await redis.set(`tarefa:${nova.id}`, nova)
      await redis.sadd('tarefas', nova.id)
      if (nova.responsavelEmail && nova.responsavelEmail !== (session.user as any).email) {
        await notificar(nova.responsavelEmail, 'tarefa_atribuida', 'Tarefa recorrente', `Nova ocorrência de "${nova.titulo}".`, undefined, nova.id).catch(() => {})
      }
    }
  }

  const meuEmail = (session.user as any).email
  // Notificar responsavel quando tarefa e reatribuida
  if (updates.responsavelEmail && updates.responsavelEmail !== tarefa.responsavelEmail && updates.responsavelEmail !== meuEmail) {
    await notificar(updates.responsavelEmail, 'tarefa_atribuida', 'Tarefa atribuida a voce', `${autor} atribuiu a tarefa "${tarefa.titulo}" a voce.`, undefined, id)
  }
  // Notificar criador e responsavel sobre alteracoes (exceto quem fez a mudanca)
  const alterou = (updates.status && updates.status !== tarefa.status) || (updates.prioridade && updates.prioridade !== tarefa.prioridade) || (updates.prazo && updates.prazo !== tarefa.prazo)
  if (alterou && !updates.novoComentario) {
    const mudancas: string[] = []
    if (updates.status && updates.status !== tarefa.status) mudancas.push(`status para ${statusLabels[updates.status] || updates.status}`)
    if (updates.prioridade && updates.prioridade !== tarefa.prioridade) mudancas.push(`prioridade para ${updates.prioridade}`)
    if (updates.prazo && updates.prazo !== tarefa.prazo) mudancas.push(`prazo para ${new Date(updates.prazo).toLocaleDateString('pt-BR')}`)
    const desc = mudancas.join(', ')
    const notifEmails: string[] = []
    if (tarefa.responsavelEmail && tarefa.responsavelEmail !== meuEmail && !notifEmails.includes(tarefa.responsavelEmail)) notifEmails.push(tarefa.responsavelEmail)
    const criadorEmail = await resolverEmailPorNome(tarefa.criadoPor)
    if (criadorEmail && criadorEmail !== meuEmail && !notifEmails.includes(criadorEmail)) notifEmails.push(criadorEmail)
    for (const e of notifEmails) {
      await notificar(e, 'tarefa_alterada', `Tarefa alterada`, `${autor} alterou "${tarefa.titulo}": ${desc}.`, undefined, id)
    }
  }

  return NextResponse.json({ ok: true, tarefa: atualizado })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') {
    return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 })
  const permanente = req.nextUrl.searchParams.get('permanente') === 'true'

  if (permanente) {
    await redis.del(`tarefa:${id}`)
    await redis.srem('tarefas_excluidas', id)
    return NextResponse.json({ ok: true })
  }

  const tarefa = await redis.get<any>(`tarefa:${id}`)
  if (tarefa) {
    tarefa.excluidoEm = new Date().toISOString()
    tarefa.excluidoPor = session.user?.name || ''
    await redis.set(`tarefa:${id}`, tarefa)
  }
  await redis.srem('tarefas', id)
  await redis.sadd('tarefas_excluidas', id)
  return NextResponse.json({ ok: true })
}
