import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, CrmContato, CrmEmpresa, ContatoInteracao, ProximoPasso, Usuario } from '@/lib/redis'
import { notificar } from '@/lib/notificacoes'
import { v4 as uuid } from 'uuid'
import { bloqueiaPapel } from '@/lib/permissoesPapel'

export const runtime = 'nodejs'

async function autorizado() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}

// #4 — vincula Contato (PF) a Empresa (PJ): acha a empresa pelo nome ou cria uma
// nova, devolvendo o id. Usa um cache para nao reler a lista a cada contato.
async function carregarEmpresas(): Promise<CrmEmpresa[]> {
  const ids = await redis.smembers('crm:empresas')
  return ids.length ? ((await redis.mget<(CrmEmpresa | null)[]>(...ids.map(i => `empresa:${i}`))).filter(Boolean) as CrmEmpresa[]) : []
}
async function acharOuCriarEmpresa(nome: string, autor: string, cache: CrmEmpresa[]): Promise<string> {
  const alvo = nome.trim().toLowerCase()
  if (!alvo) return ''
  const existente = cache.find(e => (e.nome || '').trim().toLowerCase() === alvo)
  if (existente) return existente.id
  const agora = new Date().toISOString()
  const nova: CrmEmpresa = { id: uuid(), nome: nome.trim(), criadoPor: autor, criadoEm: agora, atualizadoEm: agora }
  await redis.set(`empresa:${nova.id}`, nova)
  await redis.sadd('crm:empresas', nova.id)
  cache.push(nova)
  return nova.id
}

export async function GET(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const c = await redis.get<CrmContato>(`contato:${id}`)
    return c ? NextResponse.json(c) : NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  }
  const ids = await redis.smembers('crm:contatos')
  const contatos = ids.length ? ((await redis.mget<(CrmContato | null)[]>(...ids.map(i => `contato:${i}`))).filter(Boolean) as CrmContato[]) : []
  contatos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }))
  return NextResponse.json(contatos)
}

export async function POST(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  const b = await req.json()
  const autor = session.user?.name || ''
  const novo = (d: any): CrmContato => {
    const agora = new Date().toISOString()
    return {
      id: uuid(), nome: String(d.nome).trim(), email: d.email || '', telefone: d.telefone || '', empresa: d.empresa || '', empresaId: d.empresaId || '', profissionalAutonomo: !!d.profissionalAutonomo, areaAtuacao: d.areaAtuacao || '', cargo: d.cargo || '', observacoes: d.observacoes || '', ultimoProcedimento: d.ultimoProcedimento || '', nuncaVeio: !!d.nuncaVeio, criadoPor: autor, criadoEm: agora, atualizadoEm: agora,
      ...(d.tipo ? { tipo: d.tipo } : {}),
      ...(d.nascimento ? { nascimento: String(d.nascimento).slice(0, 10) } : {}),
      ...(d.preferenciasViagem ? { preferenciasViagem: String(d.preferenciasViagem).slice(0, 600) } : {}),
      ...(d.sobrenomeLinhagem ? { sobrenomeLinhagem: String(d.sobrenomeLinhagem).trim().slice(0, 60) } : {}),
      ...(Array.isArray(d.etiquetas) ? { etiquetas: d.etiquetas.map((e: any) => String(e).trim()).filter(Boolean).slice(0, 20) } : {}),
      ...(d.ativo === false ? { ativo: false } : {}),
    }
  }

  // Criação em LOTE (adicionar vários / importar)
  if (Array.isArray(b.lote)) {
    const validos = b.lote.filter((d: any) => String(d?.nome || '').trim())
    const contatos = validos.map(novo)
    const cacheEmpresas = await carregarEmpresas()
    for (const c of contatos) {
      if (c.empresa && !c.empresaId) c.empresaId = await acharOuCriarEmpresa(c.empresa, autor, cacheEmpresas)
      await redis.set(`contato:${c.id}`, c)
    }
    if (contatos.length) await redis.sadd('crm:contatos', ...(contatos.map(c => c.id) as [string, ...string[]]))
    return NextResponse.json({ ok: true, criados: contatos.length })
  }

  // Criação individual
  if (!String(b.nome || '').trim()) return NextResponse.json({ error: 'informe o nome' }, { status: 400 })
  const contato = novo(b)
  // #4 — se veio nome de empresa sem vinculo, acha/cria a empresa e amarra
  if (contato.empresa && !contato.empresaId) {
    contato.empresaId = await acharOuCriarEmpresa(contato.empresa, autor, await carregarEmpresas())
  }
  await redis.set(`contato:${contato.id}`, contato)
  await redis.sadd('crm:contatos', contato.id)
  return NextResponse.json({ ok: true, contato })
}

export async function PUT(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  const { id, ...updates } = await req.json()
  const contato = await redis.get<CrmContato>(`contato:${id}`)
  if (!contato) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

  // Ação: registrar um toque de nutrição (nota/ligação/whatsapp/reabordagem...)
  if (updates.novaInteracao) {
    const d = updates.novaInteracao
    const texto = String(d.texto || '').trim()
    if (!texto) return NextResponse.json({ error: 'texto da interação obrigatório' }, { status: 400 })
    const dataToque = d.data && !isNaN(new Date(d.data).getTime()) ? new Date(d.data).toISOString() : new Date().toISOString()
    const inter: ContatoInteracao = { id: uuid(), tipo: d.tipo || 'nota', texto: texto.slice(0, 1000), autor: session.user?.name || '', data: dataToque, criadoEm: new Date().toISOString() }
    const historico = [...(contato.historico || []), inter]
    const atualizado: CrmContato = { ...contato, historico, ultimoContato: [contato.ultimoContato, dataToque].filter(Boolean).sort().pop(), atualizadoEm: new Date().toISOString() }
    await redis.set(`contato:${id}`, atualizado)
    return NextResponse.json({ ok: true, contato: atualizado })
  }
  // Ação: remover um toque
  if (updates.removerInteracao) {
    const historico = (contato.historico || []).filter(h => h.id !== updates.removerInteracao)
    const atualizado: CrmContato = { ...contato, historico, atualizadoEm: new Date().toISOString() }
    await redis.set(`contato:${id}`, atualizado)
    return NextResponse.json({ ok: true, contato: atualizado })
  }

  // Ação: PRÓXIMO PASSO da jornada — a futura abordagem/retorno/procedimento.
  // Vira Tarefa com prazo E lembrete para o COMERCIAL (papel vendas), que é quem
  // faz a abordagem; sem comercial cadastrado, fica com quem registrou.
  if (updates.novoPasso) {
    const d = updates.novoPasso
    const titulo = String(d.titulo || '').trim().slice(0, 200)
    const quando = String(d.quando || '').slice(0, 10)
    if (!titulo || !/^\d{4}-\d{2}-\d{2}$/.test(quando)) return NextResponse.json({ error: 'informe o que fazer e a data' }, { status: 400 })
    const agora = new Date().toISOString()
    const autorEmail = (session.user as any)?.email || ''
    const autorNome = session.user?.name || ''
    // Quem faz a abordagem: o comercial (role 'vendas'). Vários = o 1º é o dono
    // da tarefa, mas todos recebem o lembrete.
    const emails = await redis.smembers('usuarios')
    const equipe = (await Promise.all(emails.map(e => redis.get<Usuario>(`usuario:${e}`)))).filter(Boolean) as Usuario[]
    const comerciais = equipe.filter(u => u.role === 'vendas')
    const dono = comerciais[0]
    const tarefa: any = {
      id: uuid(), titulo: `${titulo} — ${contato.nome}`,
      descricao: [d.nota, `Abordagem programada do contato ${contato.nome}${contato.telefone ? ` (${contato.telefone})` : ''}.`].filter(Boolean).join('\n'),
      status: 'a_fazer', prioridade: 'media', tipo: 'retorno_paciente',
      responsavelEmail: dono?.email || autorEmail, responsavelNome: dono?.nome || autorNome,
      prazo: `${quando}T09:00:00`, criadoPor: autorNome, criadoEm: agora, atualizadoEm: agora,
    }
    await redis.set(`tarefa:${tarefa.id}`, tarefa)
    await redis.sadd('tarefas', tarefa.id)
    const passo: ProximoPasso = { id: uuid(), titulo, quando, ...(d.nota ? { nota: String(d.nota).slice(0, 500) } : {}), feito: false, tarefaId: tarefa.id, criadoEm: agora }
    const atualizado: CrmContato = { ...contato, proximosPassos: [...(contato.proximosPassos || []), passo], atualizadoEm: agora }
    await redis.set(`contato:${id}`, atualizado)
    // Lembrete: avisa o comercial na hora. O cron reforça na semana e no dia.
    const quandoBR = quando.split('-').reverse().join('/')
    const alvos = comerciais.length ? comerciais : equipe.filter(u => u.email === autorEmail)
    await Promise.all(alvos.map(u => notificar(u.email, 'tarefa_atribuida', `Abordagem: ${contato.nome}`, `${titulo} — marcada para ${quandoBR}. Você será lembrado na semana e no dia.`, undefined, tarefa.id)))
      .catch(() => { /* lembrete é best-effort, não derruba o registro */ })
    return NextResponse.json({ ok: true, contato: atualizado })
  }
  // Concluir/reabrir um passo (sincroniza a tarefa vinculada)
  if (updates.togglePasso) {
    const passos = [...(contato.proximosPassos || [])]
    const p = passos.find(x => x.id === updates.togglePasso)
    if (!p) return NextResponse.json({ error: 'passo não encontrado' }, { status: 404 })
    p.feito = !p.feito
    if (p.tarefaId) {
      const t = await redis.get<any>(`tarefa:${p.tarefaId}`)
      if (t) await redis.set(`tarefa:${p.tarefaId}`, { ...t, status: p.feito ? 'concluido' : 'a_fazer', ...(p.feito ? { concluidoEm: new Date().toISOString() } : { concluidoEm: undefined }), atualizadoEm: new Date().toISOString() })
    }
    const atualizado: CrmContato = { ...contato, proximosPassos: passos, atualizadoEm: new Date().toISOString() }
    await redis.set(`contato:${id}`, atualizado)
    return NextResponse.json({ ok: true, contato: atualizado })
  }
  // Remover um passo (apaga também a tarefa gerada, se ainda existir)
  if (updates.removerPasso) {
    const alvo = (contato.proximosPassos || []).find(x => x.id === updates.removerPasso)
    if (alvo?.tarefaId) { await redis.del(`tarefa:${alvo.tarefaId}`); await redis.srem('tarefas', alvo.tarefaId) }
    const atualizado: CrmContato = { ...contato, proximosPassos: (contato.proximosPassos || []).filter(x => x.id !== updates.removerPasso), atualizadoEm: new Date().toISOString() }
    await redis.set(`contato:${id}`, atualizado)
    return NextResponse.json({ ok: true, contato: atualizado })
  }

  const campos = ['nome', 'email', 'telefone', 'empresa', 'empresaId', 'profissionalAutonomo', 'areaAtuacao', 'cargo', 'observacoes', 'tipo', 'nascimento', 'preferenciasViagem', 'etiquetas', 'ativo', 'ultimoProcedimento', 'nuncaVeio', 'sobrenomeLinhagem']
  const atualizado: any = { ...contato, atualizadoEm: new Date().toISOString() }
  for (const c of campos) if (c in updates) atualizado[c] = updates[c]
  // #4 — empresa preenchida (ou alterada) sem vinculo explicito: acha/cria e amarra
  if (atualizado.empresa && (!atualizado.empresaId || ('empresa' in updates && !('empresaId' in updates)))) {
    atualizado.empresaId = await acharOuCriarEmpresa(atualizado.empresa, session.user?.name || '', await carregarEmpresas())
  }
  await redis.set(`contato:${id}`, atualizado)
  return NextResponse.json({ ok: true, contato: atualizado })
}

export async function DELETE(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'excluir', (session.user as any).permissoes)) return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  // Exclusão em massa: ?ids=a,b,c  (alem do ?id= individual)
  const idsParam = req.nextUrl.searchParams.get('ids')
  if (idsParam) {
    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean)
    if (!ids.length) return NextResponse.json({ error: 'ids obrigatório' }, { status: 400 })
    for (const cid of ids) await redis.del(`contato:${cid}`)
    await redis.srem('crm:contatos', ...(ids as [string, ...string[]]))
    return NextResponse.json({ ok: true, excluidos: ids.length })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await redis.del(`contato:${id}`)
  await redis.srem('crm:contatos', id)
  return NextResponse.json({ ok: true })
}
