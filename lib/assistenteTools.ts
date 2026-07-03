import { redis, Cliente, Usuario, Tarefa, Despesa, CrmNegocio } from './redis'

// Ferramentas de LEITURA do banco para o assistente de IA (tool-use).
// Gating por papel: financeiro so admin; tarefas/clientes/crm para admin e gerente.

type Ctx = { role: string }

const fmtR$ = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const mesAtual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

export function ferramentasPara(role: string): any[] {
  const base: any[] = [
    {
      name: 'consultar_tarefas',
      description: 'Consulta as tarefas da equipe no sistema. Use para responder quantas tarefas existem, tarefas atrasadas, por responsavel ou por cliente, status, prazos.',
      input_schema: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['a_fazer', 'em_andamento', 'em_revisao', 'concluido'], description: 'filtra por status (opcional)' },
          responsavel: { type: 'string', description: 'nome ou e-mail do responsavel (opcional)' },
          cliente: { type: 'string', description: 'nome do cliente (opcional)' },
          atrasadas: { type: 'boolean', description: 'apenas tarefas com prazo vencido e nao concluidas' },
        },
      },
    },
    {
      name: 'consultar_clientes',
      description: 'Lista os clientes da agencia com contrato, entregaveis e data de renovacao. Use para perguntas sobre carteira de clientes, renovacoes proximas, etc.',
      input_schema: { type: 'object', properties: { incluir_internos: { type: 'boolean', description: 'incluir projetos internos' } } },
    },
    {
      name: 'consultar_crm',
      description: 'Consulta o funil de vendas (CRM): negocios por etapa, valores, donos e follow-ups. Use para perguntas sobre pipeline, oportunidades, vendas em aberto/ganhas/perdidas.',
      input_schema: { type: 'object', properties: { status: { type: 'string', enum: ['aberto', 'ganho', 'perdido', 'todos'], description: 'filtra por status (default aberto)' } } },
    },
    {
      name: 'consultar_brandboard',
      description: "Busca o Brand Board e o Playbook da marca de um cliente: posicionamento, tom de voz, publico-alvo, palavras-chave, o que funciona (criativos/copy), do's & don'ts, restricoes e o documento de marca. Use SEMPRE que for criar copy, criativo, pauta ou estrategia para um cliente especifico — para seguir as diretrizes da marca antes de produzir.",
      input_schema: { type: 'object', properties: { cliente: { type: 'string', description: 'nome do cliente (obrigatorio)' } }, required: ['cliente'] },
    },
  ]
  const financeiro = {
    name: 'consultar_financeiro',
    description: 'Consulta o resultado financeiro do mes (receita de contratos, folha, despesas e lucro). Dados sensiveis — somente para admin.',
    input_schema: { type: 'object', properties: { mes: { type: 'string', description: 'competencia YYYY-MM (vazio = mes atual)' } } },
  }
  if (role === 'admin') return [...base, financeiro]
  if (role === 'gerente') return base
  return base
}

// ---- Fase 2: ferramentas de AÇÃO (escrita). Nunca executam direto — geram uma
// PROPOSTA que o usuário confirma. `grupo` = permissão exigida ao confirmar. ----
export const FERRAMENTAS_ACAO: { name: string; label: string; grupo: string }[] = [
  { name: 'criar_tarefa', label: 'Criar tarefa', grupo: 'producao' },
  { name: 'criar_marco', label: 'Criar etapa no Playbook', grupo: 'estrategia' },
]
export const ehAcao = (name: string) => FERRAMENTAS_ACAO.some(a => a.name === name)

export function ferramentasAcaoSchemas(): any[] {
  return [
    {
      name: 'criar_tarefa',
      description: 'PREPARA a criação de uma tarefa (o usuário confirma antes de criar). Use quando o usuário pedir para criar/abrir uma tarefa ou lembrete de trabalho.',
      input_schema: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'título da tarefa (obrigatório)' },
          descricao: { type: 'string', description: 'detalhes/descrição (opcional)' },
          cliente: { type: 'string', description: 'nome do cliente relacionado (opcional)' },
          prazo: { type: 'string', description: 'prazo no formato AAAA-MM-DD (opcional)' },
          prioridade: { type: 'string', enum: ['baixa', 'media', 'alta', 'urgente'], description: 'prioridade (opcional, default media)' },
        },
        required: ['titulo'],
      },
    },
    {
      name: 'criar_marco',
      description: 'PREPARA a criação de uma etapa (marco) no Playbook de um cliente (o usuário confirma antes). Use quando pedirem para planejar uma entrega/etapa no Playbook.',
      input_schema: {
        type: 'object',
        properties: {
          cliente: { type: 'string', description: 'nome do cliente (obrigatório)' },
          titulo: { type: 'string', description: 'título da etapa (obrigatório)' },
          categoria: { type: 'string', enum: ['social_media', 'trafego', 'branding', 'landing_page', 'estrategia', 'reuniao', 'entrega', 'outro'], description: 'categoria (opcional)' },
          descricao: { type: 'string', description: 'descrição (opcional)' },
        },
        required: ['cliente', 'titulo'],
      },
    },
  ]
}

// Resumo legível de uma ação proposta (mostrado no cartão de confirmação).
export function resumoAcao(name: string, input: any): string {
  const i = input || {}
  if (name === 'criar_tarefa') return `Criar tarefa: "${i.titulo || '(sem título)'}"${i.cliente ? ` — cliente ${i.cliente}` : ''}${i.prazo ? ` (prazo ${i.prazo})` : ''}`
  if (name === 'criar_marco') return `Criar etapa no Playbook: "${i.titulo || '(sem título)'}" — cliente ${i.cliente || '(?)'}`
  return `Ação: ${name}`
}

export async function executarFerramenta(name: string, input: any, ctx: Ctx): Promise<string> {
  try {
    if (name === 'consultar_tarefas') return await consultarTarefas(input || {})
    if (name === 'consultar_clientes') return await consultarClientes(input || {})
    if (name === 'consultar_crm') return await consultarCrm(input || {})
    if (name === 'consultar_brandboard') return await consultarBrandboard(input || {})
    if (name === 'consultar_financeiro') {
      if (ctx.role !== 'admin') return JSON.stringify({ erro: 'Sem permissao: dados financeiros sao restritos a administradores.' })
      return await consultarFinanceiro(input || {})
    }
    return JSON.stringify({ erro: `ferramenta desconhecida: ${name}` })
  } catch (e: any) {
    return JSON.stringify({ erro: e?.message || 'falha ao consultar' })
  }
}

async function consultarTarefas(input: any): Promise<string> {
  const ids = await redis.smembers('tarefas')
  let tarefas = ids.length ? ((await redis.mget<(Tarefa | null)[]>(...ids.map(i => `tarefa:${i}`))).filter(Boolean) as Tarefa[]) : []
  const alvo = (s: string) => (s || '').toLowerCase()
  if (input.status) tarefas = tarefas.filter(t => t.status === input.status)
  if (input.responsavel) tarefas = tarefas.filter(t => alvo(t.responsavelNome).includes(alvo(input.responsavel)) || alvo(t.responsavelEmail).includes(alvo(input.responsavel)))
  if (input.cliente) tarefas = tarefas.filter(t => alvo(t.clienteNome).includes(alvo(input.cliente)))
  const hoje = Date.now()
  if (input.atrasadas) tarefas = tarefas.filter(t => t.status !== 'concluido' && t.prazo && new Date(t.prazo).getTime() < hoje)

  const porStatus: Record<string, number> = {}
  for (const t of tarefas) porStatus[t.status] = (porStatus[t.status] || 0) + 1
  const lista = tarefas
    .sort((a, b) => (a.prazo || '').localeCompare(b.prazo || ''))
    .slice(0, 60)
    .map(t => ({ titulo: t.titulo, status: t.status, responsavel: t.responsavelNome || '—', cliente: t.clienteNome || '—', prazo: t.prazo ? t.prazo.slice(0, 10) : null, prioridade: t.prioridade, subtarefa: !!(t as any).tarefaPaiId }))
  return JSON.stringify({ total: tarefas.length, porStatus, mostrando: lista.length, tarefas: lista })
}

async function consultarClientes(input: any): Promise<string> {
  const ids = await redis.smembers('clientes')
  let clientes = ids.length ? ((await redis.mget<(Cliente | null)[]>(...ids.map(i => `cliente:${i}`))).filter(Boolean) as Cliente[]) : []
  if (!input.incluir_internos) clientes = clientes.filter(c => c.tipo !== 'interno')
  const lista = clientes.map(c => ({
    nome: c.nome,
    tipo: c.tipo || 'cliente',
    instagram: c.instagram ? `@${(c.instagram || '').replace(/^@/, '')}` : null,
    contratoValor: Number(c.contratoValor) || 0,
    renovacao: (c as any).contratoRenovacao || null,
    entregaveis: c.entregaveis || [],
    segmento: c.segmento || null,
  }))
  return JSON.stringify({ total: lista.length, receitaRecorrente: fmtR$(lista.reduce((s, c) => s + c.contratoValor, 0)), clientes: lista })
}

async function consultarCrm(input: any): Promise<string> {
  const estagios = (await redis.get<any[]>('crm:estagios')) || []
  const ids = await redis.smembers('crm:negocios')
  let negocios = ids.length ? ((await redis.mget<(CrmNegocio | null)[]>(...ids.map(i => `negocio:${i}`))).filter(Boolean) as CrmNegocio[]) : []
  const status = input.status || 'aberto'
  if (status !== 'todos') negocios = negocios.filter(n => n.status === status)
  const nomeEstagio = (eid: string) => (Array.isArray(estagios) ? estagios.find((e: any) => e.id === eid)?.nome : '') || '—'
  const funil: Record<string, { qtd: number; valor: number }> = {}
  for (const n of negocios) { const k = nomeEstagio(n.estagioId); funil[k] = funil[k] || { qtd: 0, valor: 0 }; funil[k].qtd++; funil[k].valor += Number(n.valor) || 0 }
  const lista = negocios
    .sort((a, b) => (Number(b.valor) || 0) - (Number(a.valor) || 0))
    .slice(0, 40)
    .map(n => ({ titulo: n.titulo, empresa: n.empresa || null, valor: Number(n.valor) || 0, etapa: nomeEstagio(n.estagioId), status: n.status, dono: n.donoNome || null, proximoFollowUp: n.proximoFollowUp || null }))
  const totalValor = negocios.reduce((s, n) => s + (Number(n.valor) || 0), 0)
  return JSON.stringify({ status, total: negocios.length, valorTotal: fmtR$(totalValor), funil: Object.entries(funil).map(([etapa, v]) => ({ etapa, qtd: v.qtd, valor: fmtR$(v.valor) })), negocios: lista })
}

async function consultarBrandboard(input: any): Promise<string> {
  const alvo = (input.cliente || '').toLowerCase().trim()
  if (!alvo) return JSON.stringify({ erro: 'informe o nome do cliente' })
  const ids = await redis.smembers('clientes')
  const clientes = ids.length ? ((await redis.mget<(Cliente | null)[]>(...ids.map(i => `cliente:${i}`))).filter(Boolean) as Cliente[]) : []
  const norm = (s: string) => (s || '').toLowerCase()
  const c = clientes.find(x => norm(x.nome) === alvo) || clientes.find(x => norm(x.nome).includes(alvo)) || clientes.find(x => alvo.includes(norm(x.nome)))
  if (!c) return JSON.stringify({ erro: `cliente nao encontrado: ${input.cliente}`, clientesDisponiveis: clientes.filter(x => x.tipo !== 'interno').map(x => x.nome).slice(0, 40) })

  const pb = c.playbook || {}
  const doc = (c.documentoMarca || '')
  return JSON.stringify({
    cliente: c.nome,
    instagram: c.instagram ? `@${(c.instagram || '').replace(/^@/, '')}` : null,
    identidade: {
      segmento: c.segmento || null,
      palavrasChave: c.palavrasChave || null,
      descricao: c.descricao || null,
      publicoAlvo: c.publicoAlvo || null,
      tomDeVoz: c.tomDeVoz || null,
      preferencias: c.preferencias || null,
    },
    playbook: {
      posicionamento: pb.posicionamento || null,
      padraoCopy: pb.padraoCopy || null,
      criativosQueFuncionam: pb.criativosQueFuncionam || null,
      fazer: pb.fazer || null,
      naoFazer: pb.naoFazer || null,
      restricoes: pb.restricoes || null,
      observacoes: pb.observacoes || null,
      aprovado: pb.aprovado === true,
    },
    documentoMarca: doc ? doc.slice(0, 4000) : null,
    documentoMarcaTruncado: doc.length > 4000,
  })
}

async function consultarFinanceiro(input: any): Promise<string> {
  const mes = /^\d{4}-\d{2}$/.test(input.mes || '') ? input.mes : mesAtual()

  const cids = await redis.smembers('clientes')
  const clientes = cids.length ? ((await redis.mget<(Cliente | null)[]>(...cids.map(i => `cliente:${i}`))).filter(Boolean) as Cliente[]) : []
  const uids = await redis.smembers('usuarios')
  const usuarios = uids.length ? ((await Promise.all(uids.map(e => redis.get<Usuario>(`usuario:${e}`)))).filter(Boolean) as Usuario[]) : []
  const dids = await redis.smembers('despesas')
  const despesas = dids.length ? ((await redis.mget<(Despesa | null)[]>(...dids.map(i => `despesa:${i}`))).filter(Boolean) as Despesa[]) : []

  // Receita = contrato recorrente + avulsas do mes (clientes, exclui internos)
  const receita = clientes.filter(c => c.tipo !== 'interno').reduce((s, c) => {
    const avulsas = (c.receitasAvulsas || []).filter(r => r.mes === mes).reduce((a, r) => a + (Number(r.valor) || 0), 0)
    return s + (Number(c.contratoValor) || 0) + avulsas
  }, 0)
  // Folha = fixo + variavel (equipe, exclui clientes)
  const equipe = usuarios.filter(u => u.role !== 'cliente')
  const folha = equipe.reduce((s, u) => s + (Number(u.salarioFixo) || 0) + (Number(u.salarioVariavel) || 0), 0)
  // Despesas do mes
  const despesasMes = despesas.filter(d => d.mes === mes)
  const despesasTotal = despesasMes.reduce((s, d) => s + (Number(d.valor) || 0), 0)
  const lucro = receita - folha - despesasTotal
  const margem = receita > 0 ? Math.round((lucro / receita) * 100) : null

  return JSON.stringify({
    mes,
    receita: fmtR$(receita),
    folha: fmtR$(folha),
    despesas: fmtR$(despesasTotal),
    lucro: fmtR$(lucro),
    margemPercentual: margem,
    despesasDetalhe: despesasMes.slice(0, 30).map(d => ({ descricao: d.descricao, valor: fmtR$(Number(d.valor) || 0), tipo: d.tipo })),
  })
}
