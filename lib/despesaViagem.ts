// DESPESA DA VIAGEM: o que foi ORÇADO e o que foi GASTO de verdade.
//
// Até aqui a viagem tinha só `despesas` com descrição e valor, lançadas no
// cadastro para calcular o break-even (lib/precificacaoViagem). Isso é
// PREVISÃO: o dono senta antes de abrir a venda e estima combustível, pedágio,
// hotel e guia.
//
// O que faltava é o outro lado — a viagem rodou, o motorista abasteceu, apareceu
// pedágio que ninguém contou, o guia pagou ingresso do próprio bolso. Essa
// despesa nasce NA ESTRADA, tem dia, tem dono e tem nota. Sem isso o dono só
// descobre o resultado real da viagem quando o extrato chega no fim do mês.
//
// O desenho mantém `descricao` e `valor` como o ORÇADO (nada do que já está
// cadastrado muda de significado) e põe o realizado ao lado, tudo opcional:
// despesa antiga continua valendo como previsão e a conta antiga continua
// batendo. A regra nova não trava item antigo.
//
// Puro e client-safe, como lib/precificacaoViagem e lib/pacoteViagem.

// Categoria da despesa. Existe para somar por tipo ("quanto a frota gastou de
// combustível no semestre?") e para a tela oferecer uma lista em vez de texto
// livre, que viraria "Pedagio", "pedágio" e "Pedágios" na mesma viagem.
export type TipoDespesaViagem =
  | 'combustivel'
  | 'pedagio'
  | 'hospedagem'
  | 'alimentacao'
  | 'guia'
  | 'motorista'
  | 'ingresso'
  | 'estacionamento'
  | 'manutencao'
  | 'taxa'
  | 'outro'

export const TIPOS_DESPESA: { tipo: TipoDespesaViagem; rotulo: string }[] = [
  { tipo: 'combustivel', rotulo: 'Combustível' },
  { tipo: 'pedagio', rotulo: 'Pedágio' },
  { tipo: 'hospedagem', rotulo: 'Hospedagem' },
  { tipo: 'alimentacao', rotulo: 'Alimentação' },
  { tipo: 'guia', rotulo: 'Guia' },
  { tipo: 'motorista', rotulo: 'Motorista' },
  { tipo: 'ingresso', rotulo: 'Ingresso e atrativo' },
  { tipo: 'estacionamento', rotulo: 'Estacionamento' },
  { tipo: 'manutencao', rotulo: 'Manutenção e borracharia' },
  { tipo: 'taxa', rotulo: 'Taxa e documento' },
  { tipo: 'outro', rotulo: 'Outro' },
]

// O rótulo de domínio vive AQUI, uma vez. Cada tela que escrevesse a própria
// lista acabaria divergindo da outra (lição do rótulo de formato do post).
export function rotuloTipo(tipo?: string): string {
  return TIPOS_DESPESA.find(t => t.tipo === tipo)?.rotulo || 'Outro'
}

export function tipoValido(tipo?: string): tipo is TipoDespesaViagem {
  return TIPOS_DESPESA.some(t => t.tipo === tipo)
}

// A forma que esta lib consome. Espelha `DespesaViagem` (lib/redis) sem importar
// o módulo do servidor, igual ao `DespesaValor` de lib/precificacaoViagem.
export type DespesaLancada = {
  id?: string
  descricao?: string
  valor?: number          // ORÇADO
  tipo?: string
  valorReal?: number      // GASTO de verdade
  data?: string           // YYYY-MM-DD — o dia do gasto
  responsavel?: string    // quem gastou (e-mail ou nome do colaborador)
  comprovante?: string    // URL da nota no Blob
  extra?: boolean         // não estava no orçamento, apareceu na estrada
}

const num = (v: any) => (Number(v) > 0 ? Number(v) : 0)
const arred = (v: number) => Math.round(v * 100) / 100
const temReal = (d?: DespesaLancada) => num(d?.valorReal) > 0

// Quanto essa linha vale HOJE para a conta da viagem: o realizado manda, porque
// quando o gasto já aconteceu a estimativa deixou de ser notícia. Sem realizado,
// vale o orçado — é o que ainda se espera gastar.
export function valorEfetivo(d?: DespesaLancada): number {
  return temReal(d) ? num(d?.valorReal) : num(d?.valor)
}

export type Fechamento = {
  previsto: number      // soma do orçado
  realizado: number     // soma do que já foi gasto
  efetivo: number       // realizado onde existe + orçado onde ainda não gastou
  aPagar: number        // orçado das linhas que ainda não têm gasto lançado
  extras: number        // realizado das linhas que não estavam no orçamento
  diferenca: number     // efetivo − previsto (positivo = estourou)
  lancadas: number      // quantas linhas já têm gasto
  pendentes: number     // quantas ainda não têm
}

// A fotografia que a tela da viagem mostra: orçado × gasto, o que falta pagar e
// quanto estourou. `diferenca` usa o EFETIVO, não só o realizado — senão uma
// viagem com metade das notas lançadas pareceria estar economizando.
export function fechamento(despesas?: DespesaLancada[]): Fechamento {
  const lista = despesas || []
  let previsto = 0, realizado = 0, efetivo = 0, aPagar = 0, extras = 0, lancadas = 0
  for (const d of lista) {
    const orc = num(d?.valor)
    const real = num(d?.valorReal)
    previsto += orc
    realizado += real
    efetivo += valorEfetivo(d)
    if (real > 0) {
      lancadas++
      if (d?.extra) extras += real
    } else {
      aPagar += orc
    }
  }
  return {
    previsto: arred(previsto),
    realizado: arred(realizado),
    efetivo: arred(efetivo),
    aPagar: arred(aPagar),
    extras: arred(extras),
    diferenca: arred(efetivo - previsto),
    lancadas,
    pendentes: lista.length - lancadas,
  }
}

// Gasto sem nota: a cobrança que o dono precisa fazer ANTES de fechar o mês,
// porque depois ninguém lembra de qual pedágio era aquele dinheiro. Só olha
// quem já gastou — linha ainda não paga não tem nota a cobrar.
export function semComprovante(despesas?: DespesaLancada[]): DespesaLancada[] {
  return (despesas || []).filter(d => temReal(d) && !String(d?.comprovante || '').trim())
}

// Gasto sem dono: aparece no caixa e ninguém reconhece. Mesma ideia.
export function semResponsavel(despesas?: DespesaLancada[]): DespesaLancada[] {
  return (despesas || []).filter(d => temReal(d) && !String(d?.responsavel || '').trim())
}

// Soma por categoria, só o que tem valor, da maior para a menor. Serve para
// "onde o dinheiro dessa viagem foi" e para o acumulado da frota.
export function porTipo(despesas?: DespesaLancada[]): { tipo: TipoDespesaViagem; rotulo: string; previsto: number; realizado: number; efetivo: number }[] {
  const mapa = new Map<TipoDespesaViagem, { previsto: number; realizado: number; efetivo: number }>()
  for (const d of despesas || []) {
    const t: TipoDespesaViagem = tipoValido(d?.tipo) ? d.tipo : 'outro'
    const atual = mapa.get(t) || { previsto: 0, realizado: 0, efetivo: 0 }
    atual.previsto += num(d?.valor)
    atual.realizado += num(d?.valorReal)
    atual.efetivo += valorEfetivo(d)
    mapa.set(t, atual)
  }
  // Array.from em vez de spread do iterador: o target do tsconfig é anterior a
  // es2015 e `[...mapa.entries()]` não compila (TS2802).
  return Array.from(mapa.entries())
    .map(([tipo, v]) => ({ tipo, rotulo: rotuloTipo(tipo), previsto: arred(v.previsto), realizado: arred(v.realizado), efetivo: arred(v.efetivo) }))
    .filter(l => l.previsto > 0 || l.realizado > 0)
    .sort((a, b) => b.efetivo - a.efetivo || a.rotulo.localeCompare(b.rotulo, 'pt'))
}

// Resultado da viagem com o custo EFETIVO, no mesmo formato de
// `resultadoPrevisto` (lib/precificacaoViagem) para a tela trocar um pelo outro
// sem reescrever nada. `receita` entra pronta porque o dinheiro que entrou vem
// das reservas (lib/financeiroReserva), não daqui.
export function resultadoReal(
  despesas: DespesaLancada[] | undefined,
  receita: number | undefined,
): { receita: number; custo: number; resultado: number; margem?: number } {
  const rec = num(receita)
  const custo = (despesas || []).reduce((s, d) => s + valorEfetivo(d), 0)
  const resultado = arred(rec - custo)
  return { receita: arred(rec), custo: arred(custo), resultado, ...(rec > 0 ? { margem: arred((resultado / rec) * 100) } : {}) }
}

// O que o SERVIDOR grava. A rota reconstrói cada despesa campo a campo (nada do
// corpo cru entra no Redis), então esta função é a lista do que sobrevive ao
// salvar: campo que não estiver aqui some calado. Por isso ela mora na lib, com
// teste — a versão anterior vivia dentro da rota e copiava só id/descricao/valor.
//
// `novoId` entra por parâmetro para a lib continuar pura (uuid é do servidor).
export type DespesaGravada = DespesaLancada & { id: string; descricao: string; valor: number }

export function sanitizarDespesas(arr: any, novoId: () => string, limite = 60): DespesaGravada[] {
  if (!Array.isArray(arr)) return []
  const texto = (v: any, max: number) => String(v ?? '').trim().slice(0, max)
  return arr.map((d: any) => {
    const tipo = tipoValido(d?.tipo) ? d.tipo : ''
    const valorReal = num(d?.valorReal)
    const data = texto(d?.data, 10)
    const responsavel = texto(d?.responsavel, 120)
    const comprovante = texto(d?.comprovante, 600)
    return {
      id: String(d?.id || novoId()),
      descricao: texto(d?.descricao, 120),
      valor: num(d?.valor),
      ...(tipo ? { tipo } : {}),
      ...(valorReal > 0 ? { valorReal } : {}),
      ...(/^\d{4}-\d{2}-\d{2}$/.test(data) ? { data } : {}),
      ...(responsavel ? { responsavel } : {}),
      ...(comprovante ? { comprovante } : {}),
      ...(d?.extra ? { extra: true } : {}),
    }
  // Gasto extra da estrada pode não ter orçado nenhum: filtrar só por descrição
  // e valor previsto APAGARIA a linha na gravação.
  }).filter(d => d.descricao || d.valor > 0 || (d.valorReal || 0) > 0).slice(0, limite)
}

// Ordem de leitura da lista: pelo dia do gasto, mais recente primeiro, e quem
// ainda não tem dia (só orçamento) fica no fim — é o que falta acontecer.
export function ordenarPorData(despesas?: DespesaLancada[]): DespesaLancada[] {
  return [...(despesas || [])].sort((a, b) => {
    const da = String(a?.data || ''), db = String(b?.data || '')
    if (!da && !db) return String(a?.descricao || '').localeCompare(String(b?.descricao || ''), 'pt')
    if (!da) return 1
    if (!db) return -1
    return db.localeCompare(da)
  })
}
