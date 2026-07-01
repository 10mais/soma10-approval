// Catálogos declarativos das automações — SEM imports de servidor (redis/nodemailer),
// para poder ser importado tanto pelo motor (server) quanto pela UI (client).

export type CampoDef = { chave: string; label: string; tipo?: 'texto' | 'numero' }
export type GatilhoDef = { chave: string; label: string; categoria: string; campos: CampoDef[] }
export type AcaoParam = { chave: string; label: string; tipo?: 'texto' | 'textarea' | 'numero' | 'select'; opcoes?: { v: string; label: string }[]; dica?: string }
export type AcaoDef = { chave: string; label: string; params: AcaoParam[] }

const CLIENTE_CAMPOS: CampoDef[] = [{ chave: 'clienteNome', label: 'Cliente' }, { chave: 'segmento', label: 'Segmento do cliente' }]

// --- GATILHOS (amplo, extensível — cada um declara os CAMPOS do evento p/ as condições) ---
export const GATILHOS: GatilhoDef[] = [
  { chave: 'cliente_novo', label: 'Cliente cadastrado', categoria: 'Clientes', campos: [...CLIENTE_CAMPOS, { chave: 'contratoValor', label: 'Valor do contrato', tipo: 'numero' }] },
  { chave: 'contrato_renovacao_30d', label: 'Renovação em até 30 dias', categoria: 'Clientes', campos: [...CLIENTE_CAMPOS, { chave: 'dias', label: 'Dias p/ renovar', tipo: 'numero' }] },
  { chave: 'negocio_novo', label: 'Negócio criado (CRM)', categoria: 'Vendas', campos: [{ chave: 'valor', label: 'Valor', tipo: 'numero' }, { chave: 'empresa', label: 'Empresa' }, { chave: 'donoNome', label: 'Vendedor' }] },
  { chave: 'negocio_ganho', label: 'Negócio ganho (CRM)', categoria: 'Vendas', campos: [{ chave: 'valor', label: 'Valor', tipo: 'numero' }, { chave: 'segmento', label: 'Segmento' }, { chave: 'donoNome', label: 'Vendedor' }, ...CLIENTE_CAMPOS] },
  { chave: 'negocio_perdido', label: 'Negócio perdido (CRM)', categoria: 'Vendas', campos: [{ chave: 'valor', label: 'Valor', tipo: 'numero' }, { chave: 'donoNome', label: 'Vendedor' }] },
  { chave: 'reuniao_agendada', label: 'Reunião agendada (CRM)', categoria: 'Vendas', campos: [{ chave: 'empresa', label: 'Empresa' }, { chave: 'valor', label: 'Valor', tipo: 'numero' }, { chave: 'donoNome', label: 'Vendedor' }] },
  { chave: 'post_aprovado', label: 'Post aprovado pelo cliente', categoria: 'Conteúdo', campos: [...CLIENTE_CAMPOS, { chave: 'formato', label: 'Formato' }] },
  { chave: 'post_reprovado', label: 'Post reprovado / correção', categoria: 'Conteúdo', campos: [...CLIENTE_CAMPOS] },
  { chave: 'post_publicado', label: 'Post publicado', categoria: 'Conteúdo', campos: [...CLIENTE_CAMPOS, { chave: 'formato', label: 'Formato' }] },
  { chave: 'etapa_concluida', label: 'Etapa do Playbook concluída', categoria: 'Playbook', campos: [...CLIENTE_CAMPOS, { chave: 'titulo', label: 'Título da etapa' }, { chave: 'categoria', label: 'Categoria' }] },
  { chave: 'marco_atrasado', label: 'Etapa do Playbook atrasada', categoria: 'Playbook', campos: [...CLIENTE_CAMPOS, { chave: 'titulo', label: 'Título da etapa' }] },
  { chave: 'tarefa_criada', label: 'Tarefa criada', categoria: 'Tarefas', campos: [{ chave: 'tipo', label: 'Tipo' }, { chave: 'prioridade', label: 'Prioridade' }, ...CLIENTE_CAMPOS, { chave: 'responsavelNome', label: 'Responsável' }] },
  { chave: 'tarefa_concluida', label: 'Tarefa concluída', categoria: 'Tarefas', campos: [{ chave: 'tipo', label: 'Tipo' }, { chave: 'prioridade', label: 'Prioridade' }, ...CLIENTE_CAMPOS, { chave: 'responsavelNome', label: 'Responsável' }] },
  { chave: 'briefing_solicitado', label: 'Cliente solicitou conteúdo/briefing', categoria: 'Conteúdo', campos: [...CLIENTE_CAMPOS] },
]

// --- AÇÕES (ricas, extensíveis — cada uma declara seus params p/ a UI renderizar) ---
export const ACOES: AcaoDef[] = [
  {
    chave: 'criar_tarefa', label: 'Criar tarefa', params: [
      { chave: 'titulo', label: 'Título', dica: 'Use {cliente}, {titulo}, {valor}…' },
      { chave: 'tipo', label: 'Tipo', tipo: 'texto' },
      { chave: 'prioridade', label: 'Prioridade', tipo: 'select', opcoes: [{ v: 'baixa', label: 'Baixa' }, { v: 'media', label: 'Média' }, { v: 'alta', label: 'Alta' }] },
      { chave: 'responsavel', label: 'Responsável', tipo: 'select', opcoes: [{ v: 'dono', label: 'Responsável do registro' }, { v: 'especifico', label: 'Colaborador específico' }] },
      { chave: 'responsavelEmail', label: 'E-mail (se específico)' },
    ],
  },
  {
    chave: 'criar_marco', label: 'Criar etapa no Playbook', params: [
      { chave: 'titulo', label: 'Título' },
      { chave: 'categoria', label: 'Categoria', tipo: 'texto' },
    ],
  },
  {
    chave: 'notificar', label: 'Notificar (push + inbox)', params: [
      { chave: 'destino', label: 'Para', tipo: 'select', opcoes: [{ v: 'equipe', label: 'Equipe' }, { v: 'responsavel', label: 'Responsável do registro' }, { v: 'admins', label: 'Admins' }, { v: 'cliente', label: 'Cliente (portal)' }] },
      { chave: 'titulo', label: 'Título' },
      { chave: 'mensagem', label: 'Mensagem', tipo: 'textarea', dica: 'Use {cliente}, {titulo}…' },
    ],
  },
  {
    chave: 'enviar_email', label: 'Enviar e-mail', params: [
      { chave: 'para', label: 'Para', tipo: 'select', opcoes: [{ v: 'cliente', label: 'E-mail do cliente' }, { v: 'custom', label: 'E-mail específico' }] },
      { chave: 'email', label: 'E-mail (se específico)' },
      { chave: 'assunto', label: 'Assunto' },
      { chave: 'corpo', label: 'Mensagem', tipo: 'textarea' },
    ],
  },
  {
    chave: 'atribuir_responsavel', label: 'Atribuir responsável à tarefa do gatilho', params: [
      { chave: 'responsavelEmail', label: 'E-mail do responsável' },
    ],
  },
]

export const OPERADORES: { v: string; label: string }[] = [
  { v: 'igual', label: 'é igual a' },
  { v: 'diferente', label: 'é diferente de' },
  { v: 'contem', label: 'contém' },
  { v: 'maior', label: 'maior que' },
  { v: 'menor', label: 'menor que' },
  { v: 'preenchido', label: 'está preenchido' },
  { v: 'vazio', label: 'está vazio' },
]
