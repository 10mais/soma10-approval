// Papéis do squad de um cliente. Client-safe (sem Redis).
//
// Antes o squad era uma lista solta de e-mails: dizia QUEM atende o cliente,
// nunca EM QUE função. Sem isso não dá para responder "quem é o designer da
// Universal?" sem perguntar para alguém.
//
// Os quatro papéis NÃO substituem a lista: convivem com ela. A lista continua
// sendo quem recebe notificação do cliente (aprovação, esteira, alertas do
// cron, ProducaoBoard leem `cliente.squad`), e quem ocupa um papel entra nela
// automaticamente ao salvar — estar no papel É estar no squad. Quem não ocupa
// papel nenhum pode continuar na lista à mão.

export type PapelSquad = 'designer' | 'gestor_projetos' | 'gestor_operacao' | 'gestor_trafego'

export const PAPEIS_SQUAD: { chave: PapelSquad; label: string; descricao: string }[] = [
  { chave: 'gestor_projetos', label: 'Gestor de projetos', descricao: 'Conduz o projeto e responde pelos prazos.' },
  { chave: 'gestor_operacao', label: 'Gestor da operação', descricao: 'Toca a operação do dia a dia do cliente.' },
  { chave: 'designer', label: 'Designer', descricao: 'Produz criativos e peças da marca.' },
  { chave: 'gestor_trafego', label: 'Gestor de tráfego', descricao: 'Cuida das campanhas pagas.' },
]

// papel -> e-mail do colaborador. Papel vago simplesmente não aparece aqui.
export type SquadPapeis = Partial<Record<PapelSquad, string>>

export function labelDoPapel(chave: string): string {
  return PAPEIS_SQUAD.find(p => p.chave === chave)?.label || chave
}

// Quem é do squad: os dos papéis primeiro (na ordem do catálogo), depois quem
// foi adicionado à mão. Sem repetidos e sem vazios — a mesma pessoa pode ocupar
// dois papéis, e aí aparece uma vez só.
export function squadCompleto(papeis?: SquadPapeis, manuais?: string[]): string[] {
  const emails = [
    ...PAPEIS_SQUAD.map(p => papeis?.[p.chave]),
    ...(manuais || []),
  ].filter((e): e is string => !!e && !!e.trim()).map(e => e.trim())
  return Array.from(new Set(emails))
}

// Sanitiza o que veio do cliente HTTP: só as 4 chaves conhecidas, só string.
export function limparSquadPapeis(bruto: any): SquadPapeis {
  const limpo: SquadPapeis = {}
  for (const p of PAPEIS_SQUAD) {
    const v = bruto?.[p.chave]
    if (typeof v === 'string' && v.trim()) limpo[p.chave] = v.trim()
  }
  return limpo
}
