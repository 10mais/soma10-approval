// Um veículo não pode estar em duas viagens ao mesmo tempo. Puro, client-safe,
// testável — a tela usa para desligar a opção no seletor de veículo e a rota
// /api/viagens usa para RECUSAR o salvamento (a trava de verdade é no servidor).
//
// Bordas INCLUSIVAS, igual ao calendário (lib/calendarioViagens): a viagem que
// volta dia 27 e a que sai dia 27 disputam o MESMO ônibus no mesmo dia — é
// conflito, não encaixe.

import { ehData } from './datas'

export type ViagemVeiculo = {
  id: string
  titulo: string
  dataIda: string
  dataVolta?: string
  veiculoId?: string
  status?: string
}

// Cancelada libera o veículo. Realizada segue ocupando as datas dela — só
// colide se o dono realmente marcar duas viagens no mesmo período.
const ocupaVeiculo = (v: ViagemVeiculo) => v.status !== 'cancelada'

// Sem volta é bate-volta (ocupa só o dia da ida). Volta antes da ida seria
// período negativo: trata como bate-volta em vez de comparar lixo.
const fimDe = (ida: string, volta?: string) => (ehData(volta) && volta! >= ida ? volta! : ida)

// Viagens que já ocupam este veículo no período dado. `ignorarViagemId` é a
// própria viagem sendo editada — ela não conflita consigo mesma.
// YYYY-MM-DD compara certo como string; não precisa virar Date.
export function conflitosDeVeiculo(
  viagens: ViagemVeiculo[],
  veiculoId: string | undefined,
  dataIda: string | undefined,
  dataVolta?: string,
  ignorarViagemId?: string,
): ViagemVeiculo[] {
  if (!veiculoId || !ehData(dataIda)) return []
  const ini = dataIda!
  const fim = fimDe(ini, dataVolta)
  return (viagens || []).filter(v =>
    v.id !== ignorarViagemId &&
    v.veiculoId === veiculoId &&
    ocupaVeiculo(v) &&
    ehData(v.dataIda) &&
    v.dataIda <= fim && ini <= fimDe(v.dataIda, v.dataVolta),
  )
}
