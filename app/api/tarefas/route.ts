import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Tarefa, Usuario, Post } from '@/lib/redis'
import { v4 as uuid } from 'uuid'
import { notificar } from '@/lib/notificacoes'
import { aoConcluirTarefa } from '@/lib/esteiraFluxo'
import { camposDoCorpo } from '@/lib/tarefaCampos'
import { dispararEvento } from '@/lib/automacoesEngine'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { bloqueiaAcao } from '@/lib/permissoesGranularServer'

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
  if (await bloqueiaPapel((session.user as any).role, 'producao', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  }
  const body = await req.json()
  const agora = new Date().toISOString()
  const { getOperacional } = await import('@/lib/operacional')
  const prioridadePadrao = (await getOperacional()).prioridadePadrao
  // Os campos do formulário entram primeiro (é o que traz anexos/checklist/
  // documentoId/mapaId — antes eles se perdiam ao CRIAR); os defaults abaixo
  // reescrevem o que veio vazio. Ordem importa: default só vale se não veio.
  const tarefa: Tarefa = {
    ...camposDoCorpo(body),
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
  // Pauta vinculada (origemPostId): fecha o vínculo bidirecional — a pauta passa
  // a apontar para esta tarefa, para os fluxos concluir->Planner e ajuste->reabrir.
  if ((tarefa as any).origemPostId) {
    try {
      const post = await redis.get<any>(`post:${(tarefa as any).origemPostId}`)
      if (post && !post.tarefaId) await redis.set(`post:${post.id}`, { ...post, tarefaId: tarefa.id, atualizadoEm: agora })
    } catch { /* vínculo é bônus, nunca bloqueia a criação */ }
  }
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
  if (await bloqueiaPapel((session.user as any).role, 'producao', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
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

  const atualizado = { ...tarefa, atualizadoEm: new Date().toISOString() } as any
  const autor = session.user?.name || ''
  const agora = new Date().toISOString()
  const novasAtividades = [...(tarefa.atividades || [])]

  // Registra mudancas no activity log
  const statusLabels: Record<string, string> = { a_fazer: 'A fazer', em_andamento: 'Em andamento', em_revisao: 'Em revisao', concluido: 'Concluido', descartado: 'Descartado' }
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
  Object.assign(atualizado, camposDoCorpo(updates))
  if (updates.status === 'concluido' && tarefa.status !== 'concluido') atualizado.concluidoEm = new Date().toISOString()

  // Linha de montagem: concluir a tarefa do DESIGNER manda a pauta pro Planner
  // como RASCUNHO, com a copy aprovada (regra pura em lib/esteiraFluxo, testada:
  // só age em etapa 'criativo' — reabrir nunca regride, aprovações não são
  // puladas). Falha no gancho nunca bloqueia a conclusão da tarefa.
  if (updates.status === 'concluido' && tarefa.status !== 'concluido' && tarefa.origemPostId) {
    try {
      const post = await redis.get<Post>(`post:${tarefa.origemPostId}`)
      const av = post ? aoConcluirTarefa(post.etapa) : null
      if (post && av) {
        await redis.set(`post:${post.id}`, { ...post, etapa: av.etapa, status: av.status, etapaDesde: agora, aguardandoDesde: undefined, atualizadoEm: agora })
        atualizado.atividades = [...(atualizado.atividades || []), { id: uuid(), tipo: 'status' as const, descricao: 'Criativo concluído — pauta enviada ao Planner como rascunho', autor, criadoEm: agora }]
        const emailCriador = await resolverEmailPorNome(post.criadoPor).catch(() => null)
        if (emailCriador && emailCriador !== (session.user as any).email) {
          await notificar(emailCriador, 'geral', `Criativo pronto — ${post.clienteNome || 'Cliente'}`, `${autor} concluiu a tarefa "${atualizado.titulo}". A pauta está no Planner como rascunho, pronta para revisão e envio ao cliente.`, post.id).catch(() => {})
        }
      }
    } catch { /* sync nunca bloqueia a conclusão */ }
  }

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
  if (await bloqueiaPapel((session.user as any).role, 'producao', 'excluir', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  }
  if (await bloqueiaAcao((session.user as any).role, 'excluir', (session.user as any).permissoesGranular)) {
    return NextResponse.json({ error: 'sem permissão para excluir' }, { status: 403 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 })
  const permanente = req.nextUrl.searchParams.get('permanente') === 'true'

  const tarefa = await redis.get<any>(`tarefa:${id}`)
  // Linha de montagem: excluir a tarefa não deixa vínculo morto na pauta — a
  // pauta volta a poder ganhar tarefa nova (automática ou manual).
  if (tarefa?.origemPostId) {
    try {
      const post = await redis.get<Post>(`post:${tarefa.origemPostId}`)
      if (post?.tarefaId === id) await redis.set(`post:${post.id}`, { ...post, tarefaId: undefined, atualizadoEm: new Date().toISOString() })
    } catch { /* limpeza de vínculo nunca bloqueia a exclusão */ }
  }

  if (permanente) {
    await redis.del(`tarefa:${id}`)
    await redis.srem('tarefas_excluidas', id)
    return NextResponse.json({ ok: true })
  }

  if (tarefa) {
    tarefa.excluidoEm = new Date().toISOString()
    tarefa.excluidoPor = session.user?.name || ''
    await redis.set(`tarefa:${id}`, tarefa)
  }
  await redis.srem('tarefas', id)
  await redis.sadd('tarefas_excluidas', id)
  return NextResponse.json({ ok: true })
}
