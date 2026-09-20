import { nomeDaArea } from './i18n'
// Permissões DETALHADAS (client-safe) — duas camadas: por ABA (tela) e por AÇÃO.
// Aditivo ao modelo por módulo (permissoesCatalogo): aqui o admin refina tela a
// tela e ação a ação. Default = liberado; só bloqueia o que for marcado como off.
// Só gerente/usuario são afetados; admin sempre pode; vendas/cliente têm regras próprias.

export type AbaPerm = string
export type AcaoPerm = 'publicar' | 'enviar_cliente' | 'gerar_ia' | 'aprovar' | 'excluir'

// Abas operacionais que podem ser ligadas/desligadas por papel/usuário.
// `perfil` (opcional) = tela que só existe naquele perfil de instância; a UI de
// permissões esconde as que não se aplicam (a Norah não precisa ver "Viagens").
// Telas admin-only (Colaboradores, Configurações, Reuniões, Trabalhe Conosco)
// ficam FORA: o granular só afeta gerente/usuario, e admin atravessa tudo.
// O RÓTULO vem do dicionário (lib/i18n): o nome de cada área vive num lugar só, em
// português e nos outros idiomas. Aqui ficam a chave (que nunca muda), a categoria e o
// perfil de instância a que a aba pertence.
const ABAS: { key: string; categoria: string; perfil?: 'clinica' | 'turismo' | 'cidadania' | 'telefonia' }[] = [
  { key: 'meu-card', categoria: 'Pessoal' },
  { key: 'lista-pessoal', categoria: 'Pessoal' },
  { key: 'studio', categoria: 'Produção' },
  { key: 'tarefas', categoria: 'Produção' },
  { key: 'planner', categoria: 'Produção' },
  { key: 'aprovacoes', categoria: 'Produção' },
  { key: 'carga', categoria: 'Produção' },
  { key: 'agentes', categoria: 'Produção' },
  { key: 'documentos', categoria: 'Produção' },
  { key: 'mapas', categoria: 'Produção' },
  { key: 'playbook', categoria: 'Estratégia' },
  { key: 'campanhas', categoria: 'Estratégia' },
  { key: 'modelos', categoria: 'Estratégia' },
  { key: 'automacoes', categoria: 'Estratégia' },
  { key: 'marca', categoria: 'Estratégia' },
  { key: 'listening', categoria: 'Estratégia' },
  { key: 'analytics', categoria: 'Estratégia' },
  { key: 'crm', categoria: 'Vendas' },
  { key: 'metas', categoria: 'Vendas', perfil: 'clinica' },
  { key: 'conversao', categoria: 'Vendas' },
  { key: 'inbox', categoria: 'Comunicação' },
  { key: 'mensagens', categoria: 'Comunicação' },
  { key: 'solicitacoes', categoria: 'Comunicação' },
  { key: 'agenda', categoria: 'Clínica', perfil: 'clinica' },
  { key: 'procedimentos', categoria: 'Clínica', perfil: 'clinica' },
  { key: 'viagens', categoria: 'Operação', perfil: 'turismo' },
  { key: 'calendario-viagens', categoria: 'Operação', perfil: 'turismo' },
  { key: 'reservas', categoria: 'Operação', perfil: 'turismo' },
  { key: 'frota', categoria: 'Operação', perfil: 'turismo' },
  { key: 'processos', categoria: 'Assessoria', perfil: 'cidadania' },
  { key: 'produtos', categoria: 'Varejo', perfil: 'telefonia' },
  { key: 'rentabilidade', categoria: 'Gestão' },
  { key: 'clientes', categoria: 'Gestão' },
]

export const ABAS_PERM: { key: string; label: string; categoria: string; perfil?: 'clinica' | 'turismo' | 'cidadania' | 'telefonia' }[] =
  ABAS.map(a => ({ ...a, label: nomeDaArea(a.key) }))

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
