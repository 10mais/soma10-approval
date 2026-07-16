// Precificação de viagem: custo, break-even e preço sugerido. Puro, client-safe,
// testável — mesma convenção de lib/pacoteViagem.
//
// A conta que o dono precisa ANTES de abrir a venda: quanto custa a viagem,
// em que preço por passageiro ela EMPATA (break-even) e qual o preço de venda
// mínimo / aceitável / ideal. Errado aqui = viagem vendida no prejuízo.

export type DespesaValor = { valor?: number }

const num = (v: any) => (Number(v) > 0 ? Number(v) : 0)
const arred = (v: number) => Math.round(v * 100) / 100

// Soma só o que é número válido — linha em branco do formulário não vira NaN.
export function custoTotal(despesas?: DespesaValor[]): number {
  return (despesas || []).reduce((s, d) => s + num(d?.valor), 0)
}

// Custo rateado por passageiro = o preço em que a viagem EMPATA.
// Sem custo lançado ou sem passageiros não há conta a fazer — devolve undefined
// em vez de 0, que pareceria "de graça já empata".
export function breakEvenPorPassageiro(despesas: DespesaValor[] | undefined, passageiros?: number): number | undefined {
  const custo = custoTotal(despesas)
  if (custo <= 0 || !passageiros || passageiros < 1) return undefined
  return custo / passageiros
}

// Mínimo = empata (margem zero). Aceitável e ideal aplicam a margem SOBRE O
// CUSTO por passageiro. Margens em %, com o padrão que o formulário exibe.
export function precosSugeridos(
  custoPax: number | undefined,
  margemAceitavel = 20,
  margemIdeal = 35,
): { minimo: number; aceitavel: number; ideal: number } | undefined {
  if (custoPax === undefined || custoPax <= 0) return undefined
  return {
    minimo: arred(custoPax),
    aceitavel: arred(custoPax * (1 + Math.max(0, margemAceitavel) / 100)),
    ideal: arred(custoPax * (1 + Math.max(0, margemIdeal) / 100)),
  }
}

// Fotografia do resultado com um preço dado: receita (passageiros × unitário),
// custo, resultado e margem sobre a receita. Serve para o pacote (valorBase ×
// previstos) e para o fretamento (passageiros=1, unitário=valor fechado).
export function resultadoPrevisto(
  despesas: DespesaValor[] | undefined,
  passageiros: number | undefined,
  valorUnitario: number | undefined,
): { receita: number; custo: number; resultado: number; margem?: number } {
  const receita = (passageiros && passageiros > 0 ? Math.floor(passageiros) : 0) * num(valorUnitario)
  const custo = custoTotal(despesas)
  const resultado = arred(receita - custo)
  return { receita: arred(receita), custo: arred(custo), resultado, ...(receita > 0 ? { margem: arred((resultado / receita) * 100) } : {}) }
}
