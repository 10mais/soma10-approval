// Permissões DETALHADAS (client-safe) — duas camadas: por ABA (tela) e por AÇÃO.
// Aditivo ao modelo por módulo (permissoesCatalogo): aqui o admin refina tela a
// tela e ação a ação. Default = liberado; só bloqueia o que for marcado como off.
// Só gerente/usuario são afetados; admin sempre pode; vendas/cliente têm regras próprias.

export type AbaPerm = string
export type AcaoPerm = 'publicar' | 'enviar_cliente' | 'gerar_ia' | 'aprovar' | 'excluir'

// Abas operacionais que podem ser ligadas/desligadas por papel/usuário.
// `perfil` (opcional) = tela que só existe naquele perfil de instância; a UI de
// permissões esconde as que não se aplicam (a Norah não precisa ver "Excursões").
// Telas admin-only (Colaboradores, Configurações, Reuniões, Trabalhe Conosco)
// ficam FORA: o granular só afeta gerente/usuario, e admin atravessa tudo.
export const ABAS_PERM: { key: string; label: string; categoria: string; perfil?: 'clinica' | 'turismo' }[] = [
  { key: 'meu-dia', label: 'Meu dia', categoria: 'Pessoal' },
  { key: 'lista-pessoal', label: 'Personal list', categoria: 'Pessoal' },
  { key: 'studio', label: 'Studio', categoria: 'Produção' },
  { key: 'tarefas', label: 'Tarefas', categoria: 'Produção' },
  { key: 'agenda', label: 'Agenda', categoria: 'Produção' },
  { key: 'planner', label: 'Planner', categoria: 'Produção' },
  { key: 'aprovacoes', label: 'Aprovações', categoria: 'Produção' },
  { key: 'carga', label: 'Carga da equipe', categoria: 'Produção' },
  { key: 'agentes', label: 'Agentes de IA', categoria: 'Produção' },
  { key: 'documentos', label: 'Documentos', categoria: 'Produção' },
  { key: 'mapas', label: 'Mapas mentais', categoria: 'Produção' },
  { key: 'playbook', label: 'Playbook', categoria: 'Estratégia' },
  { key: 'campanhas', label: 'Campanhas', categoria: 'Estratégia' },
  { key: 'modelos', label: 'Modelos', categoria: 'Estratégia' },
  { key: 'automacoes', label: 'Automações', categoria: 'Estratégia' },
  { key: 'marca', label: 'Marca (Brand Board)', categoria: 'Estratégia' },
  { key: 'listening', label: 'Social Listening', categoria: 'Estratégia' },
  { key: 'analytics', label: 'Analytics', categoria: 'Estratégia' },
  { key: 'crm', label: 'CRM', categoria: 'Vendas' },
  { key: 'conversao', label: 'Conversão & Retenção', categoria: 'Vendas' },
  { key: 'inbox', label: 'Inbox', categoria: 'Comunicação' },
  { key: 'mensagens', label: 'Mensagens', categoria: 'Comunicação' },
  { key: 'solicitacoes', label: 'Solicitações do cliente', categoria: 'Comunicação' },
  { key: 'procedimentos', label: 'Procedimentos e Métodos', categoria: 'Clínica', perfil: 'clinica' },
  { key: 'excursoes', label: 'Excursões', categoria: 'Operação', perfil: 'turismo' },
  { key: 'reservas', label: 'Reservas', categoria: 'Operação', perfil: 'turismo' },
  { key: 'frota', label: 'Frota', categoria: 'Operação', perfil: 'turismo' },
  { key: 'rentabilidade', label: 'Financeiro', categoria: 'Gestão' },
  { key: 'clientes', label: 'Clientes', categoria: 'Gestão' },
]

// Ações críticas que podem ser bloqueadas mesmo para quem vê a tela.
export const ACOES_PERM: { key: AcaoPerm; label: string; dica: string }[] = [
  { key: 'gerar_ia', label: 'Gerar com IA', dica: 'Gerar plano, criativo e legenda pela IA' },
  { key: 'enviar_cliente', label: 'Enviar ao cliente', dica: 'Mandar material para aprovação do cliente' },
  { key: 'publicar', label: 'Publicar nas redes', dica: 'Disparar a publicação em Instagram/Facebook' },
  { key: 'aprovar', label: 'Aprovar / reprovar', dica: 'Aprovar ou reprovar conteúdo' },
  { key: 'excluir', label: 'Excluir', dica: 'Excluir posts, pautas e registros' },
]

// Estrutura salva por papel (config:permissoesGranular) e por usuário (Usuario.permissoesGranular)
export type PermGranular = { abas?: Record<string, boolean>; acoes?: Partial<Record<AcaoPerm, boolean>> }
export type PermGranularPapel = Partial<Record<'gerente' | 'usuario', PermGranular>>

const AFETA = (role: string) => role === 'gerente' || role === 'usuario'

// Resolve on/off: override do usuário > config do papel > default (true).
function resolve(mapUser: Record<string, boolean> | undefined, mapPapel: Record<string, boolean> | undefined, key: string): boolean {
  if (mapUser && key in mapUser) return mapUser[key] !== false
  if (mapPapel && key in mapPapel) return mapPapel[key] !== false
  return true
}

export function podeAbaGranular(role: string, aba: string, permUser?: PermGranular, configPapel?: PermGranularPapel): boolean {
  if (role === 'admin') return true
  if (!AFETA(role)) return true
  return resolve(permUser?.abas, (configPapel?.[role as 'gerente' | 'usuario'])?.abas, aba)
}

export function podeAcaoGranular(role: string, acao: AcaoPerm, permUser?: PermGranular, configPapel?: PermGranularPapel): boolean {
  if (role === 'admin') return true
  if (!AFETA(role)) return true
  return resolve(permUser?.acoes as any, (configPapel?.[role as 'gerente' | 'usuario'])?.acoes as any, acao)
}
