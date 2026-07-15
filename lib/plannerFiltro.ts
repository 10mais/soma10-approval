// Quem aparece no Planner (Lista/Calendário), na aba Posts e no planner do cliente.
//
// REGRA: o Planner é onde a equipe REENCONTRA o material. Se some daqui, não há
// outra tela onde procurar — então a régua é generosa de propósito. Quem diz em
// que pé a peça está é o STATUS dela, não a ausência da peça na lista.
//
// Fica de fora só a pauta da esteira que ainda NÃO tem arte (etapa
// 'aprovacao_copy'): essa vive no Studio. As etapas anteriores (briefing, copy,
// criativo) nem chegam até aqui — a API já as remove antes (app/api/posts/route.ts).
//
// Esta função mora fora da tela porque o filtro já regrediu DUAS vezes em dois
// dias (2026-07-14 rascunho sumindo; 2026-07-15 criativo em aprovação sumindo).
// Inline num page.tsx de 4 mil linhas nenhum teste alcança — aqui alcança.

export type PostFiltravel = {
  status?: string
  etapa?: string
  planoId?: string
  rascunhoInterno?: boolean
}

// Já saiu da produção: permanece como histórico mesmo com etapa presa.
const JA_PUBLICADO = ['publicando', 'publicado', 'falha_publicacao']

export function apareceNoPlanner(p: PostFiltravel): boolean {
  if (JA_PUBLICADO.includes(p.status || '')) return true
  const et = p.etapa
  // 'aprovacao_criativo' = arte pronta esperando o cliente. É material real e TEM
  // que aparecer: o filtro "Aguardando" da Lista depende disso.
  return !et || et === 'pronto' || et === 'aprovacao_criativo'
}
