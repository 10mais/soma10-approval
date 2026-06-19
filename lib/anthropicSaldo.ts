import { redis, Usuario } from './redis'
import { notificar } from './notificacoes'

// Controle de saldo ESTIMADO da API da Anthropic.
// A API não expõe o saldo real, então o admin cadastra o valor atual e o
// sistema vai descontando o custo estimado de cada geração de documento.
export type AnthropicSaldo = {
  saldo: number   // saldo estimado em USD
  limite: number  // limite de alerta em USD
  alertado: boolean
  atualizadoEm?: string
}

const KEY = 'config:anthropicSaldo'
const PADRAO: AnthropicSaldo = { saldo: 0, limite: 1, alertado: false }

export async function getSaldo(): Promise<AnthropicSaldo> {
  return (await redis.get<AnthropicSaldo>(KEY)) || PADRAO
}

// Atualização manual pelo admin (cadastrar saldo / mudar limite)
export async function setSaldo(updates: Partial<AnthropicSaldo>): Promise<AnthropicSaldo> {
  const atual = await getSaldo()
  const novo: AnthropicSaldo = { ...atual, ...updates, atualizadoEm: new Date().toISOString() }
  // Se recarregou e voltou acima do limite, re-arma o alerta
  if (novo.saldo > novo.limite) novo.alertado = false
  await redis.set(KEY, novo)
  return novo
}

// Desconta o custo estimado de uma geração e, ao cruzar o limite, avisa só os ADMINS
export async function registrarGasto(custoUSD: number): Promise<number> {
  const atual = await getSaldo()
  const saldo = Math.max(0, Number((atual.saldo - custoUSD).toFixed(4)))
  let alertado = atual.alertado

  if (saldo <= atual.limite && !atual.alertado) {
    alertado = true
    const emails = await redis.smembers('usuarios')
    const usuarios = (await Promise.all(emails.map(e => redis.get<Usuario>(`usuario:${e}`)))).filter(Boolean) as Usuario[]
    const admins = usuarios.filter(u => u.role === 'admin')
    await Promise.all(admins.map(u => notificar(
      u.email, 'geral',
      '⚠️ Créditos da IA acabando',
      `O saldo estimado da API da Anthropic está em US$ ${saldo.toFixed(2)} (alerta abaixo de US$ ${atual.limite.toFixed(2)}). Adicione créditos em console.anthropic.com e atualize o valor em Configurações.`,
    )))
  }

  await redis.set(KEY, { ...atual, saldo, alertado, atualizadoEm: new Date().toISOString() })
  return saldo
}

// Custo estimado de uma resposta do Claude (Opus 4.8) a partir do usage.
// Opus 4.8: input US$5/MTok, output US$25/MTok. Cache read ~0,1x; cache write ~1,25x.
// Soma um buffer fixo para a busca na web (~US$0,01 por requisição).
export function custoEstimado(usage: any): number {
  if (!usage) return 0.01
  const inTok = Number(usage.input_tokens || 0)
  const outTok = Number(usage.output_tokens || 0)
  const cacheRead = Number(usage.cache_read_input_tokens || 0)
  const cacheWrite = Number(usage.cache_creation_input_tokens || 0)
  const custo =
    (inTok * 5 + cacheWrite * 6.25 + cacheRead * 0.5 + outTok * 25) / 1_000_000
  return Number((custo + 0.01).toFixed(4))
}
