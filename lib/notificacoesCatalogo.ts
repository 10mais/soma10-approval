// Catálogo dos tipos de notificação (client-safe — sem imports de servidor).
// Usado pela UI (admin liga/desliga tipos; usuário silencia os seus) e pelo motor.
// obrigatorio = o usuário NÃO pode desligar (sempre recebe): atribuídas a você
// e mensagens no privado.

export const NOTIF_TIPOS: { tipo: string; label: string; categoria: string; obrigatorio?: boolean }[] = [
  { tipo: 'mensagem_privada', label: 'Mensagens no privado', categoria: 'Mensagens', obrigatorio: true },
  { tipo: 'tarefa_atribuida', label: 'Tarefa atribuída a você', categoria: 'Tarefas', obrigatorio: true },
  { tipo: 'post_aprovado', label: 'Post aprovado pelo cliente', categoria: 'Conteúdo' },
  { tipo: 'post_corrigir', label: 'Correção de post solicitada', categoria: 'Conteúdo' },
  { tipo: 'post_reprovado', label: 'Post reprovado', categoria: 'Conteúdo' },
  { tipo: 'post_publicado', label: 'Post publicado', categoria: 'Conteúdo' },
  { tipo: 'post_falha_publicacao', label: 'Falha ao publicar', categoria: 'Conteúdo' },
  { tipo: 'tarefa_alterada', label: 'Tarefa alterada', categoria: 'Tarefas' },
  { tipo: 'tarefa_mencao', label: 'Menção em tarefa (@)', categoria: 'Tarefas' },
  { tipo: 'tarefa_prazo_proximo', label: 'Prazo de tarefa próximo', categoria: 'Tarefas' },
  { tipo: 'tarefa_vencida', label: 'Tarefa vencida', categoria: 'Tarefas' },
  { tipo: 'aprovacao_atrasada', label: 'Aprovação atrasada (SLA)', categoria: 'Operação' },
  { tipo: 'contrato_renovacao', label: 'Renovação de contrato próxima', categoria: 'Operação' },
  { tipo: 'briefing_solicitado', label: 'Cliente solicitou briefing', categoria: 'Operação' },
  { tipo: 'candidatura', label: 'Nova candidatura (Trabalhe Conosco)', categoria: 'Operação' },
  { tipo: 'crm_followup', label: 'Follow-up de venda', categoria: 'Vendas' },
  { tipo: 'crm_lead', label: 'Novo lead', categoria: 'Vendas' },
  { tipo: 'crm_reuniao', label: 'Reunião de venda', categoria: 'Vendas' },
  { tipo: 'crm_briefing', label: 'Briefing para o closer', categoria: 'Vendas' },
  { tipo: 'geral', label: 'Avisos gerais', categoria: 'Geral' },
]

// Tipos que o usuário NÃO pode desligar (sempre recebe). O 'mensagem_privada'
// vive na aba Mensagens (não no Inbox), mas aparece aqui como obrigatório na UI.
export const NOTIF_OBRIGATORIOS: string[] = NOTIF_TIPOS.filter(t => t.obrigatorio).map(t => t.tipo)
