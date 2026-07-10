// Regras de PRAZO DE ENTREGA das pautas (client-safe, puro, testável).
// A dataAgendada é o compromisso com o cliente; estes helpers dizem se a pauta
// está ATRASADA (data passou e não foi entregue) ou EM RISCO (data chegando e a
// produção ainda não avançou). Alimentam o selo no Studio, o Painel de Produção,
// o widget da home e o alerta do cron.

// Estados em que a entrega está encaminhada/cumprida — não conta como atraso.
const STATUS_ENCAMINHADO = ['aprovado', 'agendado', 'publicando', 'publicado']

type PostPrazo = {
  status: string
  dataAgendada?: string
  imagens?: string[]
}

// Data passou e o post não foi entregue nem encaminhado.
// 'falha_publicacao' fica FORA (já tem alerta próprio de falha — evita eco).
export function atrasada(p: PostPrazo, agora: number = Date.now()): boolean {
  if (!p.dataAgendada) return false
  const t = new Date(p.dataAgendada).getTime()
  if (isNaN(t) || t >= agora) return false
  return !STATUS_ENCAMINHADO.includes(p.status) && p.status !== 'falha_publicacao'
}

// Data a ≤N dias (padrão 2) e a produção ainda não saiu do lugar:
// rascunho (com ou sem criativo), ajuste pedido ou reprovado.
export function emRisco(p: PostPrazo, agora: number = Date.now(), dias = 2): boolean {
  if (!p.dataAgendada) return false
  const t = new Date(p.dataAgendada).getTime()
  if (isNaN(t)) return false
  const diff = t - agora
  if (diff < 0 || diff > dias * 24 * 60 * 60 * 1000) return false
  return ['rascunho', 'corrigir', 'reprovado'].includes(p.status)
}

// Dias de atraso (inteiro, ≥0) — para as mensagens ("atrasado há N dia(s)").
export function diasDeAtraso(p: PostPrazo, agora: number = Date.now()): number {
  if (!p.dataAgendada) return 0
  const t = new Date(p.dataAgendada).getTime()
  if (isNaN(t) || t >= agora) return 0
  return Math.floor((agora - t) / (24 * 60 * 60 * 1000))
}
