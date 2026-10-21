// RESPONSÁVEL AUTOMÁTICO por tipo de tarefa, a partir dos papéis do squad do
// cliente (lib/squadPapeis). Pedido do dono (07/09/2026): criar tarefas direto
// do Playbook "automaticamente atribuídas ao cliente e ao responsável/squad
// responsável por cada tipo de tarefa".
//
// Regra: cada tipo aponta para um papel principal; papel vago cai para o
// gestor de projetos, depois para o gestor da operação. Sem squad = vazio (a
// tela deixa escolher). Puro, sem rede.

import type { PapelSquad, SquadPapeis } from './squadPapeis'

export const PAPEL_POR_TIPO: Record<string, PapelSquad> = {
  // produção de arte / conteúdo
  criativo: 'designer', carrossel: 'designer', reel: 'designer', story: 'designer', post: 'designer', video: 'designer', landing_page: 'designer',
  // mídia paga
  campanha: 'gestor_trafego', ecommerce: 'gestor_trafego',
  // texto: quem escreve as copies (papel novo, 20/10/2026); vago cai no gestor de projetos
  copy: 'social_media', briefing: 'social_media',
  // planejamento e o resto
  planejamento: 'gestor_projetos', estrategia: 'gestor_projetos', tarefa: 'gestor_projetos',
}

export function papelDoTipo(tipo?: string): PapelSquad {
  return PAPEL_POR_TIPO[tipo || 'tarefa'] || 'gestor_projetos'
}

export function responsavelPorTipo(papeis: SquadPapeis | undefined | null, tipo?: string): string {
  if (!papeis) return ''
  const principal = papelDoTipo(tipo)
  const cadeia: PapelSquad[] = [principal, 'gestor_projetos', 'gestor_operacao']
  for (const p of cadeia) {
    const e = (papeis[p] || '').trim()
    if (e) return e
  }
  return ''
}
