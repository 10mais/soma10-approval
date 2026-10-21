// PERMISSÕES FORA DO PAINEL (hub do cliente, Equipe) — a MESMA regra do painel.
//
// Dono, 21/10/2026: "O Perfil da Ana ainda tem alguns erros de permissões. Ela não consegue
// excluir pautas e outras coisas também". O hub tratava como equipe só admin e gerente: quem
// tem o papel `usuario` (colaborador) recebia o menu e as telas do CLIENTE, voltava ao início
// ao abrir uma tela da equipe (Studio, Tarefas...) e só o admin podia excluir pauta e tarefa —
// fosse qual fosse a matriz marcada para a pessoa. Aqui a regra é a do painel (ABA_GRUPO +
// permissões detalhadas): tela que o painel esconde, o hub esconde; o que ele libera, o hub libera.
import { podeNivel, type GrupoPermissao, type PermissoesPapel } from './permissoesCatalogo'
import { podeAbaGranular, type PermGranular, type PermGranularPapel } from './permissoesGranular'

/** Quem é EQUIPE no hub: a operação. `vendas` segue fora (memória gotcha-vendas-fora-da-operacao). */
export const ehEquipeDoHub = (role?: string | null): boolean => role === 'admin' || role === 'gerente' || role === 'usuario'

/** Tela do hub → aba das permissões detalhadas e grupo da matriz por módulo (o ABA_GRUPO do painel). */
export const TELAS_DO_HUB: Record<string, { aba?: string; grupo?: GrupoPermissao }> = {
  '/playbook': { aba: 'playbook', grupo: 'estrategia' },
  '/tarefas': { aba: 'tarefas', grupo: 'producao' },
  '/studio': { aba: 'studio', grupo: 'producao' },
  '/planner': { aba: 'planner', grupo: 'producao' },
  '/aprovacoes': { aba: 'aprovacoes' },
  '/marca': { aba: 'marca' },
  '/documentos': { aba: 'documentos' },
  '/listening': { aba: 'listening' },
  '/analytics': { aba: 'analytics' },
}

export type PermissoesDaPessoa = {
  role?: string | null
  permissoes?: any                       // Usuario.permissoes (override individual da matriz)
  permissoesGranular?: PermGranular       // Usuario.permissoesGranular (override individual)
  permPapel?: PermissoesPapel | null      // config:permissoesPapel
  permGranularPapel?: PermGranularPapel | null // config:permissoesGranular
}

/** A pessoa pode abrir esta tela do hub? `subpath` = o que vem depois de /cliente/{id} ('' = início). */
export function podeTelaDoHub(subpath: string, p: PermissoesDaPessoa): boolean {
  const role = p.role || ''
  if (role === 'admin') return true
  if (!ehEquipeDoHub(role)) return false
  const regra = TELAS_DO_HUB['/' + ((subpath || '').split('/')[1] || '')]
  if (!regra) return true
  if (regra.grupo && !podeNivel(role, regra.grupo, 'ver', p.permissoes, p.permPapel || undefined)) return false
  if (regra.aba && !podeAbaGranular(role, regra.aba, p.permissoesGranular, p.permGranularPapel || undefined)) return false
  return true
}
