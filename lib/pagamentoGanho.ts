// COMO A VENDA FOI PAGA — e o que isso vira no caixa.
//
// Uma venda de clínica raramente é "uma forma, um valor": é entrada no pix +
// resto no crédito em 6x, ou metade dinheiro e metade débito. Guardar só uma
// forma de pagamento perde justamente o que o financeiro precisa saber.
//
// Duas grandezas que NÃO se confundem (e é por isso que elas moram em lugares
// diferentes do sistema):
//
//   FATURAMENTO = o valor cheio da venda, no mês em que foi FECHADA. É o que a
//   META conta (lib/metas, a partir do negócio ganho).
//
//   RECEITA = o dinheiro entrando, parcela a parcela, cada uma no SEU mês. É o
//   que o caixa recebe (lançamentos gerados aqui).
//
// Vender 6.000 em 6x no dia 10 significa 6.000 na meta de agosto e 1.000 por mês
// no caixa até janeiro. Somar as parcelas na meta seria contar a mesma venda seis
// vezes; contar tudo no caixa em agosto seria dinheiro que não está lá.

export type PartePagamento = {
  forma: string
  valor: number
  parcelas?: number // só faz sentido no crédito; ausente/1 = à vista
}

export type ParcelaGerada = {
  data: string          // YYYY-MM-DD
  valor: number
  forma: string
  parcela?: number      // 1..totalParcelas (só quando parcelado)
  totalParcelas?: number
}

const cent = (v: number) => Math.round((Number(v) || 0) * 100)
const real = (c: number) => Math.round(c) / 100

export function somaPartes(partes: PartePagamento[]): number {
  return real(partes.reduce((s, p) => s + cent(p.valor), 0))
}

// Diz o que está errado, em português, ou null quando está tudo certo. A tela
// mostra a mensagem — bloquear sem dizer o motivo é pior do que não bloquear.
export function validarPartes(partes: PartePagamento[], total: number, formasValidas: string[]): string | null {
  if (!partes.length) return 'Informe ao menos uma forma de pagamento.'
  for (const p of partes) {
    if (!formasValidas.includes(p.forma)) return 'Escolha a forma de pagamento de cada parte.'
    if (!(Number(p.valor) > 0)) return 'Cada forma de pagamento precisa de um valor maior que zero.'
    // Campo VAZIO é "à vista" (o usuário limpou o input); um 0 digitado é erro —
    // `p.parcelas || 1` trataria os dois como 1 e engoliria o engano.
    const n = p.parcelas === undefined || p.parcelas === null || (p.parcelas as any) === '' ? 1 : Number(p.parcelas)
    if (p.forma === 'credito' && (!Number.isInteger(n) || n < 1 || n > 36)) return 'O número de parcelas do crédito deve ser de 1 a 36.'
    if (p.forma !== 'credito' && n > 1) return 'Só o cartão de crédito é parcelado aqui — para as outras formas, lance uma parte por pagamento.'
  }
  // A soma tem que fechar com a venda: caixa que não bate com o contrato é o
  // começo de toda conciliação impossível. Tolerância de 1 centavo (arredondamento).
  const dif = cent(somaPartes(partes)) - cent(total)
  if (Math.abs(dif) > 1) {
    const falta = real(Math.abs(dif))
    return dif < 0
      ? `Faltam R$ ${falta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para fechar o valor da venda.`
      : `As formas somam R$ ${falta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} a mais que o valor da venda.`
  }
  return null
}

// Soma meses respeitando o fim do mês: 31/01 + 1 mês é 28/02 (ou 29), não 03/03.
export function somarMeses(ymd: string, meses: number): string {
  const [a, m, d] = ymd.split('-').map(Number)
  if (!a || !m || !d) return ymd
  const alvoMes = m - 1 + meses
  const ultimoDia = new Date(a, alvoMes + 1, 0).getDate()
  const base = new Date(a, alvoMes, Math.min(d, ultimoDia))
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
}

// Vira a lista de entradas do caixa. Crédito em N vezes = N entradas mensais;
// as demais formas = uma entrada na data base.
//
// Os centavos que não dividem certo vão na PRIMEIRA parcela, não na última: é o
// que a maquininha faz, e é o que o extrato vai mostrar quando o dinheiro cair.
export function gerarParcelas(partes: PartePagamento[], dataBase: string): ParcelaGerada[] {
  const saida: ParcelaGerada[] = []
  for (const p of partes) {
    const n = p.forma === 'credito' ? Math.max(1, Math.trunc(Number(p.parcelas || 1))) : 1
    if (n === 1) {
      saida.push({ data: dataBase, valor: real(cent(p.valor)), forma: p.forma })
      continue
    }
    const totalCent = cent(p.valor)
    const base = Math.floor(totalCent / n)
    const sobra = totalCent - base * n
    for (let i = 0; i < n; i++) {
      saida.push({
        data: somarMeses(dataBase, i),
        valor: real(base + (i === 0 ? sobra : 0)),
        forma: p.forma,
        parcela: i + 1,
        totalParcelas: n,
      })
    }
  }
  return saida
}

// Resumo em uma linha para a tela e para a descrição do lançamento.
export function resumoPagamento(partes: PartePagamento[], rotulo: (f: string) => string): string {
  return partes.map(p => {
    const n = Number(p.parcelas || 1)
    const v = (Number(p.valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    return p.forma === 'credito' && n > 1 ? `${rotulo(p.forma)} ${n}x (${v})` : `${rotulo(p.forma)} (${v})`
  }).join(' + ')
}
