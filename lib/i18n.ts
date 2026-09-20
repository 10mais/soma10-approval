// IDIOMA DO SISTEMA — dono, 20/09/2026: "construa/adapte o Soma10 para alteração de idioma:
// PORTUGUÊS-BR, INGLÊS, ESPANHOL. Todos os nomes que estão em inglês na versão atual altere
// para português e consolide o idioma."
//
// Duas coisas ao mesmo tempo, e esta lib resolve as duas:
//
// 1. O PORTUGUÊS VIRA UM SÓ. O sistema nasceu com nome de tela em inglês (Planner, Studio,
//    Personal list, Inbox, Brand Board, Analytics) misturado com português. Aqui está o nome
//    OFICIAL de cada área em pt-BR, num lugar só — a lição de lib/formatoPost: rótulo repetido
//    em cada tela diverge.
// 2. A MESMA CHAVE serve os outros idiomas. `t('nav.planner', 'en')` devolve "Post scheduler".
//
// A CHAVE NUNCA MUDA. `planner`, `studio`, `playbook` continuam sendo o que está gravado no
// Redis, na URL e no `sessionStorage` — trocar isso quebraria o que já existe. O que muda é
// só o que a pessoa lê.
//
// Decisões do dono (20/09): Playbook → "Plano de entregas"; CRM continua CRM; Briefing vira
// "Pauta"; Analytics vira "Desempenho"; Feed/Story/Reel/Carrossel ficam (são os nomes do
// próprio Instagram, ver lib/formatoPost).

export type Idioma = 'pt' | 'en' | 'es'
export const IDIOMA_PADRAO: Idioma = 'pt'

export const IDIOMAS: { chave: Idioma; label: string; pronto: boolean }[] = [
  { chave: 'pt', label: 'Português (Brasil)', pronto: true },
  { chave: 'en', label: 'English', pronto: true },
  // Espanhol entra quando o dicionário estiver completo; até lá não aparece na escolha
  // (idioma pela metade é pior do que idioma nenhum).
  { chave: 'es', label: 'Español', pronto: false },
]
export const idiomasDisponiveis = () => IDIOMAS.filter(i => i.pronto)

type Entrada = { pt: string; en: string; es?: string }

// NOMES DAS ÁREAS (menu, título da tela, seletor de permissões). A chave é a mesma do `aba`/
// `ABAS_PERM`.
export const TEXTOS: Record<string, Entrada> = {
  // ---- pessoal
  'nav.home': { pt: 'Painel', en: 'Dashboard', es: 'Panel' },
  'nav.meu-card': { pt: 'Meu perfil', en: 'My profile', es: 'Mi perfil' },
  'nav.equipe': { pt: 'Equipe', en: 'Team', es: 'Equipo' },
  'nav.lista-pessoal': { pt: 'Anotações', en: 'Notes', es: 'Notas' },
  'nav.minha-conta': { pt: 'Minha conta', en: 'My account', es: 'Mi cuenta' },
  // ---- produção
  'nav.tarefas': { pt: 'Tarefas', en: 'Tasks', es: 'Tareas' },
  'nav.studio': { pt: 'Estúdio', en: 'Content studio', es: 'Estudio' },
  'nav.esteira': { pt: 'Esteira de produção', en: 'Production line', es: 'Línea de producción' },
  'nav.agenda': { pt: 'Agenda', en: 'Calendar', es: 'Agenda' },
  'nav.planner': { pt: 'Programador de postagens', en: 'Post scheduler', es: 'Programador de publicaciones' },
  'nav.calendario': { pt: 'Calendário', en: 'Calendar', es: 'Calendario' },
  'nav.aprovacoes': { pt: 'Aprovações', en: 'Approvals', es: 'Aprobaciones' },
  'nav.carga': { pt: 'Carga da equipe', en: 'Team workload', es: 'Carga del equipo' },
  'nav.agentes': { pt: 'Agentes de IA', en: 'AI agents', es: 'Agentes de IA' },
  'nav.documentos': { pt: 'Documentos', en: 'Documents', es: 'Documentos' },
  'nav.mapas': { pt: 'Mapas mentais', en: 'Mind maps', es: 'Mapas mentales' },
  'nav.novo-post': { pt: 'Nova postagem', en: 'New post', es: 'Nueva publicación' },
  // ---- estratégia
  'nav.playbook': { pt: 'Plano de entregas', en: 'Delivery plan', es: 'Plan de entregas' },
  'nav.campanhas': { pt: 'Campanhas', en: 'Campaigns', es: 'Campañas' },
  'nav.modelos': { pt: 'Modelos', en: 'Templates', es: 'Plantillas' },
  'nav.automacoes': { pt: 'Automações', en: 'Automations', es: 'Automatizaciones' },
  'nav.marca': { pt: 'Marca', en: 'Brand', es: 'Marca' },
  'nav.listening': { pt: 'Escuta social', en: 'Social listening', es: 'Escucha social' },
  'nav.analytics': { pt: 'Desempenho', en: 'Performance', es: 'Rendimiento' },
  'nav.metricas': { pt: 'Métricas', en: 'Campaign metrics', es: 'Métricas' },
  'nav.relatorio': { pt: 'Relatório da semana', en: 'Weekly report', es: 'Informe semanal' },
  'nav.entregas': { pt: 'Entregas', en: 'Deliverables', es: 'Entregas' },
  'nav.onboarding': { pt: 'Entrada do cliente', en: 'Client onboarding', es: 'Ingreso del cliente' },
  // ---- vendas
  'nav.crm': { pt: 'CRM', en: 'CRM', es: 'CRM' },
  'nav.metas': { pt: 'Metas', en: 'Goals', es: 'Metas' },
  'nav.conversao': { pt: 'Conversão e retenção', en: 'Conversion & retention', es: 'Conversión y retención' },
  'nav.vendas': { pt: 'Vendas', en: 'Sales', es: 'Ventas' },
  'nav.produtos': { pt: 'Produtos e estoque', en: 'Products & stock', es: 'Productos e inventario' },
  // ---- comunicação
  'nav.inbox': { pt: 'Caixa de entrada', en: 'Inbox', es: 'Bandeja de entrada' },
  'nav.mensagens': { pt: 'Chat interno', en: 'Team chat', es: 'Chat interno' },
  'nav.solicitacoes': { pt: 'Solicitações do cliente', en: 'Client requests', es: 'Solicitudes del cliente' },
  // ---- gestão
  'nav.clientes': { pt: 'Clientes', en: 'Clients', es: 'Clientes' },
  'nav.clientes-todos': { pt: 'Todos os clientes', en: 'All clients', es: 'Todos los clientes' },
  'nav.usuarios': { pt: 'Usuários', en: 'Users', es: 'Usuarios' },
  'nav.rentabilidade': { pt: 'Financeiro', en: 'Finance', es: 'Finanzas' },
  'nav.config': { pt: 'Configurações', en: 'Settings', es: 'Configuración' },
  'nav.biblioteca': { pt: 'Biblioteca', en: 'Library', es: 'Biblioteca' },
  'nav.recrutamento': { pt: 'Recrutamento', en: 'Recruiting', es: 'Reclutamiento' },
  'nav.candidaturas': { pt: 'Candidaturas', en: 'Applications', es: 'Candidaturas' },
  'nav.reunioes': { pt: 'Reuniões', en: 'Meetings', es: 'Reuniones' },
  // ---- operação (turismo / clínica / assessoria / varejo)
  'nav.viagens': { pt: 'Viagens', en: 'Trips', es: 'Viajes' },
  'nav.calendario-viagens': { pt: 'Calendário de viagens', en: 'Trip calendar', es: 'Calendario de viajes' },
  'nav.reservas': { pt: 'Reservas', en: 'Bookings', es: 'Reservas' },
  'nav.frota': { pt: 'Frota', en: 'Fleet', es: 'Flota' },
  'nav.procedimentos': { pt: 'Procedimentos e métodos', en: 'Procedures & methods', es: 'Procedimientos y métodos' },
  'nav.processos': { pt: 'Processos', en: 'Cases', es: 'Procesos' },
  'nav.recebiveis': { pt: 'Recebíveis', en: 'Receivables', es: 'Cuentas por cobrar' },

  // ---- termos do domínio que aparecem soltos no texto das telas
  'termo.pauta': { pt: 'Pauta', en: 'Brief', es: 'Pauta' },
  'termo.pautas': { pt: 'Pautas', en: 'Briefs', es: 'Pautas' },
  'termo.marco': { pt: 'Marco', en: 'Milestone', es: 'Hito' },
  'termo.etapa': { pt: 'Etapa', en: 'Stage', es: 'Etapa' },
  'termo.quadro': { pt: 'Quadro', en: 'Board', es: 'Tablero' },
  'termo.funil': { pt: 'Funil', en: 'Pipeline', es: 'Embudo' },
  'termo.pagina-captura': { pt: 'Página de captura', en: 'Landing page', es: 'Página de captura' },
  'termo.notepads': { pt: 'Blocos de notas', en: 'Notepads', es: 'Blocs de notas' },
  'termo.microtarefas': { pt: 'Microtarefas', en: 'Quick tasks', es: 'Microtareas' },
  'termo.idioma': { pt: 'Idioma', en: 'Language', es: 'Idioma' },
  'termo.idioma.ajuda': {
    pt: 'Vale só para você. A equipe pode usar o sistema em outro idioma.',
    en: 'Applies to you only. Your teammates can use the system in another language.',
    es: 'Solo para ti. El equipo puede usar el sistema en otro idioma.',
  },
}

/** O texto da chave no idioma pedido. Sem tradução no idioma, cai no português; chave que não
 *  existe volta ela mesma (aparece torto na tela, e é assim que a gente descobre que faltou). */
export function t(chave: string, idioma: Idioma = IDIOMA_PADRAO): string {
  const e = TEXTOS[chave]
  if (!e) return chave
  return (idioma === 'pt' ? e.pt : e[idioma]) || e.pt
}

/** Nome da área pela chave da aba (`planner`, `studio`, `playbook`…). */
export const nomeDaArea = (chave: string, idioma: Idioma = IDIOMA_PADRAO): string => t(`nav.${chave}`, idioma)

/** O que veio do banco/localStorage/navegador vira um idioma válido e PRONTO. */
export function normalizarIdioma(v: unknown): Idioma {
  const s = String(v || '').toLowerCase().slice(0, 2)
  const achado = idiomasDisponiveis().find(i => i.chave === s)
  return achado ? achado.chave : IDIOMA_PADRAO
}
