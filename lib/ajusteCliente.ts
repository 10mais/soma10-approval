// Quando o cliente pede ajuste, decide se aquilo exige RETRABALHO da equipe ou se
// o sistema pode aplicar e reprogramar sozinho.
//
// A distinção é o coração da automação: um pedido que só troca a LEGENDA e/ou a
// DATA não muda a arte — não há o que refazer, e mandar o material para
// 'corrigir' só cria fila. Já um ponto marcado no layout ou uma observação
// escrita significam que o CRIATIVO mudou: aí volta para a produção.
//
// Puro de propósito: é a regra que libera publicação sem olho humano, então ela
// vive fora da rota e é testada. Na dúvida, o retorno é `false` (retrabalho).

export type PedidoDeAjuste = {
  tipo: string                       // 'approved' | 'corrected' | 'rejected' | 'caption'
  anotacoes?: unknown                // pontos marcados no layout
  observacao?: unknown               // texto livre do cliente sobre o layout
  novaLegenda?: unknown
  novaData?: unknown
}

export function dataValida(v: unknown): boolean {
  if (typeof v !== 'string' || !v.trim()) return false
  return !isNaN(new Date(v).getTime())
}

export function ajusteSemRetrabalho(p: PedidoDeAjuste): boolean {
  // Só se aplica ao pedido de ajuste. Aprovação e reprovação têm caminho próprio.
  if (p.tipo !== 'corrected') return false
  // UM ponto marcado = a arte mudou.
  if (Array.isArray(p.anotacoes) && p.anotacoes.length > 0) return false
  // Anotação em formato inesperado: não arrisca, trata como retrabalho.
  if (p.anotacoes != null && !Array.isArray(p.anotacoes)) return false
  // UMA palavra escrita = a equipe precisa ler e agir.
  if (typeof p.observacao === 'string' && p.observacao.trim() !== '') return false
  if (p.observacao != null && typeof p.observacao !== 'string') return false
  // Precisa haver alguma mudança aplicável, senão não há o que automatizar.
  const temLegenda = typeof p.novaLegenda === 'string' && p.novaLegenda.trim() !== ''
  return temLegenda || dataValida(p.novaData)
}
