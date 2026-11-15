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
  criativo: 'designer', carrossel: 'designer', story: 'designer', post: 'designer', landing_page: 'designer',
  // vídeo: editor de vídeo (papel novo, 15/11/2026); vago cai no designer
  reel: 'editor_video', video: 'editor_video',
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
  const cadeia: PapelSquad[] = [principal, ...(principal === 'editor_video' ? ['designer' as PapelSquad] : []), 'gestor_projetos', 'gestor_operacao']
  for (const p of cadeia) {
    const e = (papeis[p] || '').trim()
    if (e) return e
  }
  return ''
}

// QUEM PRODUZ A PEÇA DA PAUTA quando a copy é aprovada (lib/tarefasDaPauta): Reels vão para o
// editor de vídeo; sem editor no squad (ou outro formato), para o designer. Sem nenhum dos dois,
// vazio (a pauta fica sem responsável e o Estúdio avisa), como sempre foi com o designer.
export function produtorDaPauta(papeis: SquadPapeis | undefined | null, formato?: string): { email: string; papel: PapelSquad } {
  const editor = (papeis?.editor_video || '').trim()
  if (formato === 'reel' && editor) return { email: editor, papel: 'editor_video' }
  return { email: (papeis?.designer || '').trim(), papel: 'designer' }
}
