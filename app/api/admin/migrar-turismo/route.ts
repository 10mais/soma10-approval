import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Veiculo, Excursao, CondicaoVeiculo } from '@/lib/redis'
import { expandirModelo, layoutVazio } from '@/lib/layoutVeiculo'

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
    const layout = expandirModelo(o.layoutId) || layoutVazio(1)
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
    log.push(`${o.nome} → veiculo:${o.id} (${layout.poltronas.length} poltronas, condição ${condicao})`)
    if (!dry) {
      await redis.set(`veiculo:${veiculo.id}`, veiculo)
      await redis.sadd('veiculos', veiculo.id)
    }
    migrados++
  }

  // ── excursao.onibusId → veiculoId ────────────────────────────────────────
  const exIds = await redis.smembers('excursoes')
  const excursoes = exIds.length
    ? (await redis.mget<(Excursao | null)[]>(...exIds.map(i => `excursao:${i}`))).filter(Boolean) as (Excursao & { onibusId?: string })[]
    : []
  let excursoesAjustadas = 0
  for (const e of excursoes) {
    if (!e.onibusId || e.veiculoId) continue
    log.push(`excursão "${e.titulo}": onibusId → veiculoId (${e.onibusId})`)
    if (!dry) {
      const { onibusId, ...resto } = e
      await redis.set(`excursao:${e.id}`, { ...resto, veiculoId: onibusId, atualizadoEm: new Date().toISOString() })
    }
    excursoesAjustadas++
  }

  return NextResponse.json({
    ok: true,
    dry,
    resumo: dry
      ? `Simulação: ${migrados} veículo(s) e ${excursoesAjustadas} excursão(ões) seriam migrados. Nada foi gravado.`
      : `${migrados} veículo(s) e ${excursoesAjustadas} excursão(ões) migrados. As chaves antigas (onibus:*) continuam intactas.`,
    onibusEncontrados: antigos.length,
    migrados,
    jaExistiam,
    excursoesAjustadas,
    log,
  })
}
