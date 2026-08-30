import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, CrmNegocio, CrmEstagio, CrmAtividade, CrmAgendamento, Usuario } from '@/lib/redis'
import { notificar, notificarAdmins } from '@/lib/notificacoes'
import { v4 as uuid } from 'uuid'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { garantirSetupCrm } from '@/lib/crmPipelines'
import { getPerfilInstancia } from '@/lib/perfisInstancia'
import { perfilVendeParaPessoa } from '@/lib/perfisInstanciaCatalogo'
import { resolverEscopoLoja, podeEscreverNaLoja } from '@/lib/escopoLoja'
import { sanitizarLinhagem } from '@/lib/linhagem'

export const runtime = 'nodejs'

async function autorizado() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}

async function estagios(): Promise<CrmEstagio[]> {
  const t = await redis.get<CrmEstagio[]>('crm:estagios')
  return Array.isArray(t) ? t : []
}

function atividade(tipo: CrmAtividade['tipo'], texto: string, autor: string): CrmAtividade {
  return { id: uuid(), tipo, texto, autor, criadoEm: new Date().toISOString() }
}

// #6 — ao agendar reuniao (negocio entra numa etapa de "Reuniao"), passa o
// briefing de qualificacao para TODOS os closers do time.
async function passarBriefingAosClosers(n: CrmNegocio, contatoNome: string) {
  const emails = await redis.smembers('usuarios')
  const usuarios = (await Promise.all(emails.map(e => redis.get<Usuario>(`usuario:${e}`)))).filter(Boolean) as Usuario[]
  const closers = usuarios.filter(u => u.role === 'vendas' && u.funcaoVendas === 'closer')
  if (!closers.length) return
  const fmt = (v?: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const linhas = [
    contatoNome ? `Contato: ${contatoNome}` : '',
    n.empresa ? `Empresa: ${n.empresa}` : '',
    n.valor ? `Valor: ${fmt(n.valor)}` : '',
    n.segmento ? `Segmento: ${n.segmento}` : '',
    n.faturamentoEstimado ? `Faturamento: ${n.faturamentoEstimado}` : '',
    n.dores ? `Dores: ${n.dores}` : '',
    n.solucoes ? `Soluções: ${n.solucoes}` : '',
  ].filter(Boolean).join(' · ')
  const titulo = `Reunião agendada: ${n.titulo}`
  const msg = `Briefing para a reunião — ${linhas || 'sem detalhes de qualificação preenchidos.'}`
  await Promise.all(closers.map(c => notificar(c.email, 'crm_briefing', titulo, msg).catch(() => {})))
}

export async function GET(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  // Varejo multi-loja: escopo por loja (SÓ telefonia; outros perfis não têm loja).
  const perfil = await getPerfilInstancia()
  const esc = perfil === 'telefonia'
    ? resolverEscopoLoja({ role: (session.user as any).role, lojaId: (session.user as any).lojaId }, req.nextUrl.searchParams.get('lojaId'))
    : null
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const n = await redis.get<CrmNegocio>(`negocio:${id}`)
    if (!n) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
    // Operador não acessa negócio de outra loja nem por id direto.
    if (esc && (esc.tipo === 'bloqueado' || (esc.tipo === 'loja' && n.lojaId !== esc.lojaId))) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
    return NextResponse.json(n)
  }
  const ids = await redis.smembers('crm:negocios')
  let negocios = ids.length ? ((await redis.mget<(CrmNegocio | null)[]>(...ids.map(i => `negocio:${i}`))).filter(Boolean) as CrmNegocio[]) : []
  if (esc) {
    if (esc.tipo === 'bloqueado') negocios = []
    else if (esc.tipo === 'loja') negocios = negocios.filter(n => n.lojaId === esc.lojaId)
    // 'todas' (admin/gestor) = sem filtro: compila a rede inteira
  }
  negocios.sort((a, b) => new Date(b.atualizadoEm || b.criadoEm).getTime() - new Date(a.atualizadoEm || a.criadoEm).getTime())
  return NextResponse.json(negocios)
}

export async function POST(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  }
  const b = await req.json()
  if (!String(b.titulo || '').trim()) return NextResponse.json({ error: 'informe o título' }, { status: 400 })
  // #5 — toda oportunidade precisa estar atribuida a um contato
  if (!String(b.contatoId || '').trim()) return NextResponse.json({ error: 'selecione ou crie um contato para a oportunidade' }, { status: 400 })
  // #2 — empresa obrigatoria (exceto profissional autonomo). Regra de AGÊNCIA
  // apenas: quem vende para pessoa física não tem "empresa da oportunidade".
  // A lista de perfis vive em perfilVendeParaPessoa (catálogo) — enumerar os
  // perfis aqui é o que fez a cidadania ser recusada pelo servidor mesmo com o
  // campo já removido da tela.
  const perfil = await getPerfilInstancia()
  if (!perfilVendeParaPessoa(perfil) && !b.profissionalAutonomo && !String(b.empresa || '').trim()) {
    return NextResponse.json({ error: 'informe a empresa da oportunidade' }, { status: 400 })
  }
  // Varejo multi-loja: carimba a loja do ESCOPO (operador na sua; admin/gestor
  // precisam ter escolhido uma no seletor). SÓ telefonia.
  let lojaIdNeg: string | undefined
  if (perfil === 'telefonia') {
    const escr = podeEscreverNaLoja({ role: (session.user as any).role, lojaId: (session.user as any).lojaId }, b.lojaId)
    if ('erro' in escr) return NextResponse.json({ error: escr.erro }, { status: escr.status })
    lojaIdNeg = escr.lojaId
  }

  const { estagios: ests } = await garantirSetupCrm()
  const estagioId = b.estagioId || (ests.find(e => (b.pipelineId ? (e.pipelineId === b.pipelineId) : true) && !e.ganho && !e.perdido)?.id) || ests[0]?.id || ''
  const estSel = ests.find(e => e.id === estagioId)
  const agora = new Date().toISOString()
  const autor = session.user?.name || ''
  const negocio: CrmNegocio = {
    id: uuid(),
    titulo: String(b.titulo).trim(),
    ...(lojaIdNeg ? { lojaId: lojaIdNeg } : {}),
    valor: Number(b.valor) || 0,
    estagioId,
    pipelineId: b.pipelineId || estSel?.pipelineId || '',
    status: 'aberto',
    dono: b.dono || (session.user as any)?.email || '',
    donoNome: b.donoNome || autor,
    contatoId: b.contatoId || '',
    empresaId: b.empresaId || '',
    origem: b.origem || '',
    previsaoFechamento: b.previsaoFechamento || '',
    descricao: b.descricao || '',
    empresa: b.empresa || '', segmento: b.segmento || '', faturamentoEstimado: b.faturamentoEstimado || '',
    instagram: b.instagram || '', dores: b.dores || '', solucoes: b.solucoes || '',
    ...(b.queixaPrincipal ? { queixaPrincipal: String(b.queixaPrincipal).slice(0, 300) } : {}),
    // Turismo: qualificação da VIAGEM (destino, pessoas, época, desejos)
    ...(b.viagemId ? { viagemId: String(b.viagemId).slice(0, 60) } : {}),
    ...(b.destinoDesejado ? { destinoDesejado: String(b.destinoDesejado).slice(0, 140) } : {}),
    ...(Number(b.qtdPassageiros) >= 1 ? { qtdPassageiros: Math.floor(Number(b.qtdPassageiros)) } : {}),
    ...(b.epocaDesejada ? { epocaDesejada: String(b.epocaDesejada).slice(0, 80) } : {}),
    ...(b.preferencias ? { preferencias: String(b.preferencias).slice(0, 600) } : {}),
    // Cidadania: qualificação da elegibilidade (país, ascendente, grau)
    ...(b.paisInteresse ? { paisInteresse: String(b.paisInteresse).slice(0, 60) } : {}),
    ...(b.ascendenteOrigem ? { ascendenteOrigem: String(b.ascendenteOrigem).slice(0, 140) } : {}),
    ...(b.grauParentesco ? { grauParentesco: String(b.grauParentesco).slice(0, 40) } : {}),
    ...(Array.isArray(b.linhagem) ? { linhagem: sanitizarLinhagem(b.linhagem, uuid) } : {}),
    handoff: b.handoff || {},
    atividades: [atividade('criacao', 'Negócio criado', autor)],
    criadoPor: autor, criadoEm: agora, atualizadoEm: agora,
  }
  await redis.set(`negocio:${negocio.id}`, negocio)
  await redis.sadd('crm:negocios', negocio.id)
  const { dispararEvento } = await import('@/lib/automacoesEngine')
  await dispararEvento('negocio_novo', { negocioId: negocio.id, valor: Number(negocio.valor) || 0, empresa: negocio.empresa || '', donoNome: negocio.donoNome || '', donoEmail: negocio.dono || '' })
  return NextResponse.json({ ok: true, negocio })
}

export async function PUT(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  }
  const { id, ...updates } = await req.json()
  const negocio = await redis.get<CrmNegocio>(`negocio:${id}`)
  if (!negocio) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

  const autor = session.user?.name || ''
  const atividades = [...(negocio.atividades || [])]
  const atualizado: any = { ...negocio, atualizadoEm: new Date().toISOString() }

  // Adicionar atividade à timeline (nota/ligacao/email/reuniao/whatsapp)
  if (updates.novaAtividade?.texto) {
    atividades.push(atividade(updates.novaAtividade.tipo || 'nota', String(updates.novaAtividade.texto), autor))
  }

  // Cadência / agendamentos (Fase 2)
  let agendamentos: CrmAgendamento[] = [...(negocio.agendamentos || [])]
  if (updates.novoAgendamento?.quando && updates.novoAgendamento?.titulo) {
    const a = updates.novoAgendamento
    agendamentos.push({ id: uuid(), quando: String(a.quando).slice(0, 10), canal: a.canal || 'whatsapp', titulo: String(a.titulo), nota: a.nota || '', feito: false, criadoEm: new Date().toISOString() })
  }
  if (updates.toggleAgendamento) {
    agendamentos = agendamentos.map(a => a.id === updates.toggleAgendamento ? { ...a, feito: !a.feito } : a)
  }
  if (updates.removerAgendamento) {
    agendamentos = agendamentos.filter(a => a.id !== updates.removerAgendamento)
  }
  // Aplicar a cadência do playbook de qualificação (gera toques a partir de hoje + dia)
  if (updates.aplicarCadencia) {
    const pb = await redis.get<any>('crm:playbookQualificacao')
    const cad: any[] = Array.isArray(pb?.cadencia) ? pb.cadencia : []
    const base = new Date(); base.setHours(0, 0, 0, 0)
    for (const c of cad) {
      const d = new Date(base); d.setDate(d.getDate() + (Number(c.dia) || 0))
      agendamentos.push({ id: uuid(), quando: d.toISOString().slice(0, 10), canal: (c.canal || 'whatsapp'), titulo: c.titulo || 'Contato', nota: c.script || '', feito: false, criadoEm: new Date().toISOString() })
    }
  }
  atualizado.agendamentos = agendamentos

  // Mudança de estágio (kanban) — registra na timeline e ajusta status terminal
  let entrouEmReuniao = false
  if (updates.estagioId && updates.estagioId !== negocio.estagioId) {
    const ests = await estagios()
    const novo = ests.find(e => e.id === updates.estagioId)
    atualizado.estagioId = updates.estagioId
    atividades.push(atividade('estagio', `Movido para "${novo?.nome || 'estágio'}"`, autor))
    if (novo?.ganho) { atualizado.status = 'ganho'; atividades.push(atividade('ganho', 'Negócio ganho', autor)) }
    else if (novo?.perdido) { atualizado.status = 'perdido'; atividades.push(atividade('perdido', 'Negócio perdido', autor)) }
    else atualizado.status = 'aberto'
    // #6 — entrou numa etapa de "Reunião": passa o briefing aos closers
    if (/reuni/i.test(novo?.nome || '')) entrouEmReuniao = true
  }

  const campos = ['titulo', 'valor', 'dono', 'donoNome', 'contatoId', 'empresaId', 'pipelineId', 'origem', 'probabilidade', 'previsaoFechamento', 'proximoFollowUp', 'motivoPerdido', 'descricao', 'handoff', 'status', 'clienteId', 'templateId', 'empresa', 'segmento', 'faturamentoEstimado', 'instagram', 'dores', 'solucoes', 'queixaPrincipal', 'viagemId', 'destinoDesejado', 'qtdPassageiros', 'epocaDesejada', 'preferencias', 'paisInteresse', 'ascendenteOrigem', 'grauParentesco', 'processoId']
  for (const c of campos) if (c in updates) atualizado[c] = updates[c]
  // Linhagem fica FORA da whitelist genérica: ela é estrutura, não texto — entra
  // sanitizada (mesma regra da rota de processos) em vez de crua do corpo.
  if ('linhagem' in updates) atualizado.linhagem = sanitizarLinhagem(updates.linhagem, uuid)
  atualizado.atividades = atividades

  // DATA DO FECHAMENTO — é ela que ancora a venda no mês certo da meta. Sem
  // isso, `atualizadoEm` faria uma venda de agosto migrar para outubro na
  // primeira edição, e a meta do mês passaria a mentir para sempre.
  const virouGanho = atualizado.status === 'ganho' && negocio.status !== 'ganho'
  if (virouGanho) atualizado.fechadoEm = new Date().toISOString()
  if (atualizado.status !== 'ganho' && negocio.status === 'ganho') delete atualizado.fechadoEm

  await redis.set(`negocio:${id}`, atualizado)

  // Venda ganha AVISA o financeiro. O lancamento nao e automatico (falta a forma
  // de pagamento, e nem todo ganho vira dinheiro no dia) — o aviso e o que
  // impede a venda de ficar so no funil, esquecida do caixa.
  // Ver lib/ganhosFinanceiro e /api/financeiro/ganhos.
  if (virouGanho && (Number(atualizado.valor) || 0) > 0) {
    const brl = (Number(atualizado.valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    await notificarAdmins('financeiro_ganho', 'Lançar ganho como entrada?',
      `${atualizado.titulo || 'Oportunidade'} foi ganha (${brl}). Abra Financeiro → Ganhos do CRM para lançar a entrada e informar a forma de pagamento.`)
      .catch(() => { /* aviso e best-effort: nao derruba o registro da venda */ })
  }

  // #6 — dispara o briefing aos closers (best-effort, nao bloqueia a resposta)
  if (entrouEmReuniao) {
    let contatoNome = ''
    if (atualizado.contatoId) {
      const ct = await redis.get<{ nome?: string }>(`contato:${atualizado.contatoId}`).catch(() => null)
      contatoNome = ct?.nome || ''
    }
    await passarBriefingAosClosers(atualizado, contatoNome).catch(() => {})
    const { dispararEvento } = await import('@/lib/automacoesEngine')
    await dispararEvento('reuniao_agendada', { negocioId: id, empresa: atualizado.empresa || '', valor: Number(atualizado.valor) || 0, donoNome: atualizado.donoNome || '', donoEmail: atualizado.dono || '' })
  }
  // Negócio perdido (via mudança de etapa)
  if (atualizado.status === 'perdido' && negocio.status !== 'perdido') {
    const { dispararEvento } = await import('@/lib/automacoesEngine')
    await dispararEvento('negocio_perdido', { negocioId: id, valor: Number(atualizado.valor) || 0, donoNome: atualizado.donoNome || '', donoEmail: atualizado.dono || '' })
  }

  return NextResponse.json({ ok: true, negocio: atualizado })
}

export async function DELETE(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'excluir', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await redis.del(`negocio:${id}`)
  await redis.srem('crm:negocios', id)
  return NextResponse.json({ ok: true })
}
