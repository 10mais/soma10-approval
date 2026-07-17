// Quando a pauta gerada pela IA vai ao ar.
//
// Regra do dono (2026-07-17): "crie conteúdos a partir da data atual, NUNCA para
// trás". Gerar o plano no dia 17 espalhava pautas desde o dia 1 — e elas já
// nasciam atrasadas, poluindo o Painel de entregas com atraso que nunca existiu.
//
// Vive aqui, e não na rota, porque é data: vira do mês, hora que já passou e
// último dia do mês são exatamente o tipo de coisa que quebra em produção no
// dia 31 e ninguém percebe até lá.

export type PedidoData = { ano: number; mes: number; dia: number; hora: number; minuto: number }

const HORA_MIN = 6
const HORA_MAX = 23
const ultimoDiaDoMes = (ano: number, mes: number) => new Date(ano, mes, 0).getDate()

// Primeiro dia que pode receber pauta: hoje, se o plano é do mês corrente;
// senão, o dia 1 (plano de mês futuro começa no começo dele).
export function diaMinimo(ano: number, mes: number, agora: Date): number {
  const ehMesCorrente = agora.getFullYear() === ano && agora.getMonth() + 1 === mes
  if (ehMesCorrente) return agora.getDate()
  // Mês futuro começa no dia 1. Mês PASSADO não é empurrado para hoje: o plano é
  // daquele mês, e mudar isso jogaria a pauta para fora do próprio plano.
  return 1
}

// Monta a data da pauta respeitando o mês do plano e o "nunca para trás".
// Devolve ISO. Se o horário pedido já passou HOJE, empurra para o próximo dia
// útil do calendário (não para daqui a 2h: o horário foi escolhido pela IA por
// ser bom para o público, e 2h depois pode ser meia-noite).
export function dataDaPauta(p: PedidoData, agora: Date = new Date()): string {
  const ultimo = ultimoDiaDoMes(p.ano, p.mes)
  const min = diaMinimo(p.ano, p.mes, agora)
  const hora = Math.min(Math.max(Number(p.hora) || 17, HORA_MIN), HORA_MAX)
  const minuto = [0, 30].includes(Number(p.minuto)) ? Number(p.minuto) : 0

  let dia = Math.min(Math.max(Number(p.dia) || min, min), ultimo)
  let d = new Date(p.ano, p.mes - 1, dia, hora, minuto, 0)

  // Hoje, mas em hora que já passou → amanhã, mesmo horário.
  if (d.getTime() <= agora.getTime()) {
    dia = dia + 1
    d = new Date(p.ano, p.mes - 1, dia, hora, minuto, 0)
    // Passou do fim do mês (era o último dia, à noite): fica hoje mesmo, na
    // próxima meia hora cheia. Melhor publicar tarde do que fora do plano.
    if (dia > ultimo) {
      d = new Date(agora.getTime() + 30 * 60 * 1000)
      d.setSeconds(0, 0)
      d.setMinutes(d.getMinutes() >= 30 ? 30 : 0)
      if (d.getTime() <= agora.getTime()) d = new Date(agora.getTime() + 30 * 60 * 1000)
    }
  }
  return d.toISOString()
}
