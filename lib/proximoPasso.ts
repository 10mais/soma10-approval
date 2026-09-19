// O PRÓXIMO PASSO da operação (§29 da especificação da Deny Turismo).
//
// A queixa que originou isto: "o sistema não ficou usual e prático no dia a dia".
// A causa não é falta de função — é que as funções são TELAS SOLTAS. Quem vendeu
// precisa lembrar sozinho que falta cadastrar passageiro, pedir documento,
// escolher poltrona e registrar pagamento. O documento resume o remédio numa
// frase: "cada ação concluída deve apresentar naturalmente o próximo passo".
//
// Este arquivo é a regra desse "próximo passo", pura e testável, para que a
// MESMA resposta apareça em todo lugar: no painel (o que a operação inteira
// deve), na reserva recém-salva e na viagem que está perto de sair. Regra
// espalhada por tela diverge — foi o que aconteceu com o rótulo de formato do
// post (ver lib/formatoPost) e com o filtro do Planner.
//
// NADA aqui reimplementa validação que já existe: documento do passageiro vem de
// lib/manifesto (a mesma regra que barra a lista do DAER) e dinheiro vem de
// lib/financeiroContrato. Duas cópias divergiriam no pior lugar possível.

import { pendenciasDoPassageiro, PassageiroLite } from './manifesto'
import { parcelasVencidas, quitado, type FinanceiroContrato } from './financeiroContrato'

/** Quão em cima está: atrasado (já passou), agora (é o próximo) ou depois. */
export type Urgencia = 'atrasado' | 'agora' | 'depois'

export type Passo = {
  /** Identificador estável — a tela decide para onde levar; o teste conhece por aqui. */
  chave: string
  /** O que o usuário lê. Frase de ação, não substantivo solto. */
  rotulo: string
  urgencia: Urgencia
  /** Complemento curto: quantos, quem, quando. */
  detalhe?: string
}

export type ReservaPasso = {
  id?: string
  status?: 'pre-reserva' | 'confirmada' | 'cancelada'
  contratanteNome?: string
  passageiros?: (PassageiroLite & { poltrona?: string })[]
  financeiro?: FinanceiroContrato
}

export type ViagemPasso = {
  id?: string
  titulo?: string
  dataIda?: string
  internacional?: boolean
  veiculoId?: string
  /** Presente = a viagem já tem mapa de poltronas (croqui copiado do veículo). */
  temLayout?: boolean
  motoristas?: unknown[]
  status?: 'planejada' | 'aberta' | 'realizada' | 'cancelada'
  capacidade?: number
  /** Mínimo de passageiros para a viagem sair (§7). Ausente = sem exigência. */
  minimoPassageiros?: number
  /** Data limite para confirmar ou cancelar a viagem (YYYY-MM-DD). */
  prazoConfirmacao?: string
}

/**
 * A viagem vai sair? Conta quanto falta para o mínimo e quanto tempo resta
 * para decidir. `null` quando a viagem não exige mínimo — a maioria das antigas.
 *
 * Isto não é enfeite de painel: excursão que não enche precisa ser cancelada ou
 * remarcada COM ANTECEDÊNCIA, senão a operadora devolve dinheiro em cima da hora
 * e ainda paga o ônibus.
 */
export function situacaoConfirmacao(
  v: Pick<ViagemPasso, 'minimoPassageiros' | 'prazoConfirmacao' | 'dataIda'>,
  passageiros: number,
  hojeYmd: string,
): { minimo: number; tem: number; faltam: number; atingiu: boolean; diasParaDecidir: number | null } | null {
  const minimo = Number(v?.minimoPassageiros) || 0
  if (minimo <= 0) return null
  const tem = Math.max(0, passageiros || 0)
  // O prazo manda; sem prazo cadastrado, a própria saída é o limite.
  const limite = v.prazoConfirmacao || v.dataIda
  return {
    minimo,
    tem,
    faltam: Math.max(0, minimo - tem),
    atingiu: tem >= minimo,
    diasParaDecidir: limite ? diasAte(hojeYmd, limite) : null,
  }
}

const ORDEM: Record<Urgencia, number> = { atrasado: 0, agora: 1, depois: 2 }

/** Ordena por urgência preservando a ordem de descoberta dentro de cada nível. */
export function ordenarPassos(passos: Passo[]): Passo[] {
  return passos
    .map((p, i) => ({ p, i }))
    .sort((a, b) => ORDEM[a.p.urgencia] - ORDEM[b.p.urgencia] || a.i - b.i)
    .map(x => x.p)
}

function plural(n: number, um: string, muitos: string): string {
  return n === 1 ? `1 ${um}` : `${n} ${muitos}`
}

/**
 * O que falta nesta reserva, na ordem em que a operação resolve.
 *
 * A sequência é a do documento: passageiro → documento → poltrona → pagamento →
 * confirmação. Reserva cancelada não pede nada: cobrar documento de quem
 * desistiu é o tipo de aviso que faz a equipe parar de ler os avisos.
 */
export function passosDaReserva(r: ReservaPasso, v: ViagemPasso | undefined, hojeYmd: string): Passo[] {
  if (!r || r.status === 'cancelada') return []
  const passos: Passo[] = []
  const pax = r.passageiros || []

  if (pax.length === 0) {
    passos.push({ chave: 'passageiros', rotulo: 'Cadastrar os passageiros', urgencia: 'agora' })
  } else {
    // Documento: MESMA regra da lista oficial. Se falta aqui, a lista do DAER
    // seria rejeitada na véspera — o alerta existe para não descobrir tarde.
    const semDoc = pax.filter(p => pendenciasDoPassageiro(p, !!v?.internacional).length > 0)
    if (semDoc.length) {
      passos.push({
        chave: 'documentos',
        rotulo: 'Completar os dados dos passageiros',
        urgencia: 'agora',
        detalhe: `${plural(semDoc.length, 'passageiro', 'passageiros')} com pendência`,
      })
    }
    // Poltrona só é cobrável quando existe mapa: sem veículo definido, a viagem
    // ainda não tem croqui e pedir poltrona seria pedir o impossível.
    if (v?.temLayout) {
      const semPoltrona = pax.filter(p => !String(p.poltrona || '').trim())
      if (semPoltrona.length) {
        passos.push({
          chave: 'poltronas',
          rotulo: 'Escolher as poltronas',
          urgencia: 'agora',
          detalhe: `${plural(semPoltrona.length, 'passageiro sem poltrona', 'passageiros sem poltrona')}`,
        })
      }
    }
  }

  const fin = r.financeiro
  if (!fin || !(fin.parcelas || []).length) {
    passos.push({ chave: 'pagamento', rotulo: 'Registrar o pagamento', urgencia: 'agora' })
  } else {
    const vencidas = parcelasVencidas(fin, hojeYmd)
    if (vencidas.length) {
      const total = vencidas.reduce((s, p) => s + (p.valor || 0), 0)
      passos.push({
        chave: 'cobranca',
        rotulo: 'Cobrar parcela em atraso',
        urgencia: 'atrasado',
        detalhe: `${plural(vencidas.length, 'parcela vencida', 'parcelas vencidas')} · ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      })
    }
  }

  // Confirmar é o ÚLTIMO passo, e só quando não falta nada antes: confirmar uma
  // reserva sem documento e sem poltrona é fingir que a venda está pronta.
  if (r.status === 'pre-reserva' && passos.length === 0) {
    passos.push({ chave: 'confirmar', rotulo: 'Confirmar a reserva', urgencia: 'agora' })
  }
  return ordenarPassos(passos)
}

/**
 * O que falta nesta viagem para ela poder sair.
 *
 * `diasParaSair` decide a urgência: o que é "depois" a dois meses da saída vira
 * "agora" na semana da viagem. Sem isso, ou o painel grita desde o primeiro dia
 * ou avisa quando já não dá tempo.
 */
export function passosDaViagem(
  v: ViagemPasso,
  reservas: ReservaPasso[],
  hojeYmd: string,
  opts?: { janelaDias?: number },
): Passo[] {
  if (!v || v.status === 'cancelada' || v.status === 'realizada') return []
  const janela = opts?.janelaDias ?? 15
  const dias = v.dataIda ? diasAte(hojeYmd, v.dataIda) : null
  const perto = dias !== null && dias <= janela
  const passou = dias !== null && dias < 0
  const passos: Passo[] = []

  // Veículo primeiro: sem ele não há croqui, não há poltrona e não há placa na
  // lista oficial. É o nó de que tudo o mais depende.
  if (!v.veiculoId) {
    passos.push({ chave: 'veiculo', rotulo: 'Definir o veículo da viagem', urgencia: perto ? 'agora' : 'depois' })
  }
  if (!(v.motoristas || []).length) {
    passos.push({ chave: 'motorista', rotulo: 'Escalar o motorista', urgencia: perto ? 'agora' : 'depois' })
  }

  const vivas = (reservas || []).filter(r => r.status !== 'cancelada')
  const pax = vivas.flatMap(r => r.passageiros || [])
  // Falta gente para a viagem sair? Vem antes de documento e poltrona: não
  // adianta arrumar a lista de uma viagem que vai ser cancelada.
  const conf = situacaoConfirmacao(v, pax.length, hojeYmd)
  if (conf && !conf.atingiu) {
    const d = conf.diasParaDecidir
    passos.push({
      chave: 'minimo',
      rotulo: d !== null && d < 0 ? 'Decidir: prazo vencido sem o mínimo' : 'Vender ou decidir o cancelamento',
      urgencia: d !== null && d < 0 ? 'atrasado' : d !== null && d <= janela ? 'agora' : 'depois',
      detalhe: `precisa de ${conf.minimo}, tem ${conf.tem}${d !== null && d >= 0 ? ` · ${d === 0 ? 'decide hoje' : `${d} dia(s) para decidir`}` : ''}`,
    })
  }

  const comPendencia = pax.filter(p => pendenciasDoPassageiro(p, !!v.internacional).length > 0)
  if (comPendencia.length) {
    passos.push({
      chave: 'documentos',
      rotulo: 'Resolver pendências de documento',
      urgencia: passou ? 'atrasado' : perto ? 'agora' : 'depois',
      detalhe: `${plural(comPendencia.length, 'passageiro', 'passageiros')} — a lista oficial não sai assim`,
    })
  }

  if (v.temLayout) {
    const semPoltrona = pax.filter(p => !String(p.poltrona || '').trim())
    if (semPoltrona.length) {
      passos.push({
        chave: 'poltronas',
        rotulo: 'Distribuir as poltronas',
        urgencia: perto ? 'agora' : 'depois',
        detalhe: plural(semPoltrona.length, 'passageiro sem poltrona', 'passageiros sem poltrona'),
      })
    }
  }

  const devendo = vivas.filter(r => r.financeiro && (r.financeiro.parcelas || []).length && !quitado(r.financeiro))
  const atrasadas = vivas.filter(r => r.financeiro && parcelasVencidas(r.financeiro, hojeYmd).length > 0)
  if (atrasadas.length) {
    passos.push({
      chave: 'cobranca',
      rotulo: 'Cobrar reservas em atraso',
      urgencia: 'atrasado',
      detalhe: plural(atrasadas.length, 'reserva', 'reservas'),
    })
  } else if (perto && devendo.length) {
    passos.push({
      chave: 'receber',
      rotulo: 'Fechar o pagamento antes da saída',
      urgencia: 'agora',
      detalhe: plural(devendo.length, 'reserva com saldo', 'reservas com saldo'),
    })
  }

  if (perto && !passou && v.temLayout) {
    passos.push({ chave: 'lista', rotulo: 'Gerar a lista de viagem', urgencia: 'depois' })
  }
  return ordenarPassos(passos)
}

/** Dias inteiros de `de` até `ate` (negativo = já passou). Datas YYYY-MM-DD. */
export function diasAte(de: string, ate: string): number {
  const a = Date.UTC(+de.slice(0, 4), +de.slice(5, 7) - 1, +de.slice(8, 10))
  const b = Date.UTC(+ate.slice(0, 4), +ate.slice(5, 7) - 1, +ate.slice(8, 10))
  return Math.round((b - a) / 86400000)
}

/** Há algo atrasado? Atalho para a tela pintar o aviso em vermelho. */
export function temAtraso(passos: Passo[]): boolean {
  return passos.some(p => p.urgencia === 'atrasado')
}
