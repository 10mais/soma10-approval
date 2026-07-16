import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Veiculo, Viagem, CondicaoVeiculo } from '@/lib/redis'
import { Reserva } from '@/lib/reservas'
import { expandirModelo, layoutVazio, capacidadeLayout, normalizarLayout } from '@/lib/layoutVeiculo'
import { semearTravas } from '@/lib/assentos'

export const runtime = 'nodejs'

// Migração de UMA VEZ: Ônibus → Frota.
//   `onibus:{id}` (set `onibus`)  →  `veiculo:{id}` (set `veiculos`)
//   `layoutId: 'carro-2023'`      →  `layout: {...}` (croqui expandido do modelo)
//   `ativo: false`                →  `condicao: 'excluido'`
//   `excursao.onibusId`           →  `excursao.veiculoId`
//
// Idempotente (não sobrescreve veículo já migrado) e NÃO apaga as chaves antigas —
// se algo der errado, o dado velho continua lá para conferência/rollback.
// `?dry=1` só relata o que faria.
//
// Se a instância nunca cadastrou ônibus (o caso esperado da Deny, que ainda não
// rodou /api/setup), isto é um no-op e pode ser ignorada.

type Antigo = { id: string; nome: string; placa?: string; layoutId?: string; amenidades?: string[]; ativo?: boolean; observacoes?: string; criadoPor?: string; criadoEm?: string; atualizadoEm?: string }

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }
  const dry = req.nextUrl.searchParams.get('dry') === '1'
  const log: string[] = []

  // ── Ônibus → Veículo ──────────────────────────────────────────────────────
  const ids = await redis.smembers('onibus')
  const antigos = ids.length
    ? (await redis.mget<(Antigo | null)[]>(...ids.map(i => `onibus:${i}`))).filter(Boolean) as Antigo[]
    : []

  let migrados = 0
  let jaExistiam = 0
  for (const o of antigos) {
    if (await redis.get(`veiculo:${o.id}`)) { jaExistiam++; log.push(`veiculo:${o.id} (${o.nome}) já existe — pulado`); continue }
    // Sem modelo conhecido o croqui nasce vazio: melhor um veículo sem poltrona
    // (visível e corrigível na tela) do que perder o cadastro.
    const layout = expandirModelo(o.layoutId) || layoutVazio()
    if (!expandirModelo(o.layoutId)) log.push(`⚠ ${o.nome}: layoutId "${o.layoutId}" desconhecido — croqui vazio, redesenhar na tela`)
    const condicao: CondicaoVeiculo = o.ativo === false ? 'excluido' : 'disponivel'
    const agora = new Date().toISOString()
    const veiculo: Veiculo = {
      id: o.id,
      nome: o.nome,
      tipo: 'onibus',
      placa: o.placa,
      layout,
      condicao,
      amenidades: o.amenidades,
      manutencoes: [],
      documentos: [],
      observacoes: o.observacoes,
      criadoPor: o.criadoPor,
      criadoEm: o.criadoEm || agora,
      atualizadoEm: agora,
    }
    log.push(`${o.nome} → veiculo:${o.id} (${capacidadeLayout(layout)} poltronas, condição ${condicao})`)
    if (!dry) {
      await redis.set(`veiculo:${veiculo.id}`, veiculo)
      await redis.sadd('veiculos', veiculo.id)
    }
    migrados++
  }

  // ── Excursão → Viagem ────────────────────────────────────────────────────
  //   `excursao:{id}` (set `excursoes`) → `viagem:{id}` (set `viagens`)
  //   `onibusId` → `veiculoId` · toda excursão antiga é do tipo 'pacote'
  //   (fretamento não existia; era tudo × passageiro).
  const exIds = await redis.smembers('excursoes')
  const antigasViagens = exIds.length
    ? (await redis.mget<(any | null)[]>(...exIds.map(i => `excursao:${i}`))).filter(Boolean) as any[]
    : []
  let viagensMigradas = 0
  for (const e of antigasViagens) {
    if (await redis.get(`viagem:${e.id}`)) { log.push(`viagem:${e.id} ("${e.titulo}") já existe — pulada`); continue }
    const { onibusId, ...resto } = e
    const viagem: Viagem = {
      ...resto,
      tipo: 'pacote',
      veiculoId: e.veiculoId || onibusId || undefined,
      valorPacote: Math.max(0, Number(e.valorPacote) || 0),
      atualizadoEm: new Date().toISOString(),
    }
    log.push(`"${e.titulo}" → viagem:${e.id} (tipo pacote${onibusId ? ', onibusId → veiculoId' : ''})`)
    if (!dry) {
      await redis.set(`viagem:${viagem.id}`, viagem)
      await redis.sadd('viagens', viagem.id)
    }
    viagensMigradas++
  }

  // ── reserva.excursaoId → viagemId ────────────────────────────────────────
  // Sem isto a reserva aponta para o vazio e a poltrona vendida some do mapa.
  const rIds = await redis.smembers('reservas')
  const reservas = rIds.length
    ? (await redis.mget<(any | null)[]>(...rIds.map(i => `reserva:${i}`))).filter(Boolean) as any[]
    : []
  let reservasAjustadas = 0
  for (const r of reservas) {
    if (!r.excursaoId || r.viagemId) continue
    const { excursaoId, ...resto } = r
    log.push(`reserva de "${r.contratanteNome}": excursaoId → viagemId (${excursaoId})`)
    if (!dry) {
      await redis.set(`reserva:${r.id}`, { ...resto, viagemId: excursaoId, atualizadoEm: new Date().toISOString() } as Reserva)
      await redis.sadd(`viagem:${excursaoId}:reservas`, r.id)
    }
    reservasAjustadas++
  }

  // ── layoutSnap + travas de assento ───────────────────────────────────────
  // Viagem sem snapshot lia o croqui do veículo AO VIVO: reformar o carro mudaria
  // o mapa de quem já comprou. E reserva criada antes da trava atômica não tem
  // chave `viagem:{id}:assento:{n}` — sem semear, a poltrona dela pareceria livre
  // e seria vendida de novo.
  const todasIds = await redis.smembers('viagens')
  const todasViagens = todasIds.length
    ? (await redis.mget<(Viagem | null)[]>(...todasIds.map(i => `viagem:${i}`))).filter(Boolean) as Viagem[]
    : []
  const todasReservasIds = await redis.smembers('reservas')
  const todasReservas = todasReservasIds.length
    ? (await redis.mget<(any | null)[]>(...todasReservasIds.map(i => `reserva:${i}`))).filter(Boolean) as any[]
    : []

  let snaps = 0
  let travas = 0
  for (const v of todasViagens) {
    if (!v.layoutSnap && v.veiculoId) {
      const veic = await redis.get<Veiculo>(`veiculo:${v.veiculoId}`)
      if (veic) {
        log.push(`viagem "${v.titulo}": snapshot do croqui de ${veic.nome}`)
        if (!dry) await redis.set(`viagem:${v.id}`, { ...v, layoutSnap: normalizarLayout(veic.layout), atualizadoEm: new Date().toISOString() })
        snaps++
      }
    }
    const daViagem = todasReservas.filter(r => (r.viagemId || r.excursaoId) === v.id)
    if (daViagem.length && !dry) travas += await semearTravas(v.id, daViagem)
  }
  if (snaps) log.push(`${snaps} viagem(ns) ganharam layoutSnap`)
  if (travas) log.push(`${travas} trava(s) de assento semeada(s)`)

  const total = `${migrados} veículo(s), ${viagensMigradas} viagem(ns) e ${reservasAjustadas} reserva(s)`
  return NextResponse.json({
    ok: true,
    dry,
    resumo: dry
      ? `Simulação: ${total} seriam migrados. Nada foi gravado.`
      : `${total} migrados. As chaves antigas (onibus:*, excursao:*) continuam intactas para conferência.`,
    onibusEncontrados: antigos.length,
    excursoesEncontradas: antigasViagens.length,
    migrados,
    jaExistiam,
    viagensMigradas,
    reservasAjustadas,
    log,
  })
}
