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

// ---------------------------------------------------------------- FILA DE PROGRAMAÇÃO
// Dono, 13/11/2026: "quando a tarefa for concluída (anexado o criativo pronto) ele já se vira
// uma postagem em rascunho como Fila de programação. Aí o colaborador abre, revisa e finaliza a
// programação." A Fila é um RECORTE do Programador (a peça continua aparecendo na Lista e no
// Calendário — apareceNoPlanner): o que a produção entregou e ainda depende da equipe.
//   'nova'        entregue pelo designer, esperando revisão e envio ao cliente
//   'nova_versao' o cliente pediu ajuste e o designer já entregou a nova versão
//   'em_ajuste'   o cliente pediu ajuste e a peça está com o designer
// O que já foi para o cliente (aguardando aprovação) ou foi aprovado sai da Fila.
export type PostDaFila = PostFiltravel & { filaProgramacaoDesde?: string; versaoNova?: unknown; excluidoEm?: string }
export type EstadoNaFila = 'nova' | 'nova_versao' | 'em_ajuste'

export function estadoNaFila(p: PostDaFila): EstadoNaFila | null {
  if (p.excluidoEm) return null
  if (p.etapa === 'pronto' && p.status === 'rascunho' && p.filaProgramacaoDesde) return 'nova'
  if (p.etapa === 'aprovacao_criativo' && (p.status === 'corrigir' || p.status === 'reprovado')) return p.versaoNova ? 'nova_versao' : 'em_ajuste'
  return null
}

// ---------------------------------------------------------------- ORDEM DO PLANNER
// Dono, 09/09/2026: "organize o Planner por DATA DE POSTAGEM (independente se está
// programado ou em aprovação)". A lista ordenava por `atualizadoEm` — qualquer toque numa
// peça a jogava para o topo, e a grade do mês virava a ordem de quem foi mexido por último.
//
// A data que manda é a da POSTAGEM: `dataAgendada`. Quem ainda não tem data (pauta em
// aprovação que ninguém agendou) entra pela data de criação, para não sumir do fim da lista
// nem fingir uma data que não existe. `atualizadoEm` NUNCA entra: é ruído de edição.

export type PostComData = { dataAgendada?: string; criadoEm?: string; atualizadoEm?: string }

export function dataDePostagem(p: PostComData): string {
  return p.dataAgendada || p.criadoEm || p.atualizadoEm || ''
}

/** Mais recente primeiro (o futuro programado no topo, o histórico embaixo). */
export function ordenarPorPostagem<T extends PostComData>(posts: T[]): T[] {
  return [...posts].sort((a, b) => {
    const da = dataDePostagem(a), db = dataDePostagem(b)
    if (!da && !db) return 0
    if (!da) return 1 // sem data nenhuma vai para o fim
    if (!db) return -1
    return new Date(db).getTime() - new Date(da).getTime()
  })
}
