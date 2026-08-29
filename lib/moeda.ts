// Campo de DINHEIRO em real — o que o usuário digita vira R$ enquanto ele
// digita, com ponto de milhar e vírgula de centavo.
//
// Por que não deixar `<input type="number">`: "1200000" cru na tela não se lê.
// Meta de 1,2 milhão e meta de 120 mil viram o mesmo borrão de dígitos, e o
// erro só aparece depois de salvo, no gráfico.
//
// A máscara NÃO é de centavos-da-direita (aquela em que digitar 1200000 vira
// 12.000,00). Quem lança meta digita valor redondo — "1200000" tem que virar
// 1.200.000, não 12.000. Centavo existe, mas só quando a pessoa escreve a
// vírgula.

// Formata o que está sendo digitado. Mantém o estado como TEXTO (não número):
// número não guarda "o usuário parou no meio da vírgula".
export function formatarEntradaMoeda(bruto: string): string {
  const s = String(bruto ?? '')
  if (!s.trim()) return ''
  // Ponto digitado é milhar (o brasileiro digita 1.200.000) — some. Vírgula é
  // o decimal e vale a PRIMEIRA; as outras são engano de teclado.
  const limpo = s.replace(/[^\d,]/g, '')
  const i = limpo.indexOf(',')
  const temVirgula = i >= 0
  const inteiroBruto = (temVirgula ? limpo.slice(0, i) : limpo).replace(/\D/g, '')
  const decimalBruto = temVirgula ? limpo.slice(i + 1).replace(/\D/g, '').slice(0, 2) : ''

  // "0007" vira "7"; mas "0," precisa continuar sendo "0,".
  const inteiro = inteiroBruto.replace(/^0+(?=\d)/, '')
  if (!inteiro && !temVirgula) return ''
  const comMilhar = (inteiro || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return temVirgula ? `${comMilhar},${decimalBruto}` : comMilhar
}

// Texto da tela → número para salvar. Aceita também o que veio colado de fora
// ("R$ 1.200.000,50").
export function parseMoeda(texto: string | number | null | undefined): number {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : 0
  const s = String(texto ?? '').replace(/[^\d,]/g, '')
  if (!s) return 0
  const i = s.indexOf(',')
  const inteiro = (i >= 0 ? s.slice(0, i) : s).replace(/\D/g, '')
  const dec = i >= 0 ? s.slice(i + 1).replace(/\D/g, '').slice(0, 2) : ''
  const n = Number(`${inteiro || '0'}.${dec || '0'}`)
  return Number.isFinite(n) ? n : 0
}

// Número salvo → texto do campo (ao abrir o formulário). Valor zero volta
// VAZIO, e não "0": campo com zero escrito parece preenchido.
export function moedaParaCampo(v: number | undefined | null): string {
  const n = Number(v) || 0
  if (!n) return ''
  const [inteiro, dec] = n.toFixed(2).split('.')
  const comMilhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return dec === '00' ? comMilhar : `${comMilhar},${dec}`
}
