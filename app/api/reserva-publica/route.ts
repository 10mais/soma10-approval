import { NextRequest, NextResponse } from 'next/server'
import { redis, Viagem, Veiculo } from '@/lib/redis'
import { Reserva, poltronasOcupadas, poltronasEmConflito } from '@/lib/reservas'
import { poltronaExiste } from '@/lib/layoutVeiculo'
import { reatribuirAssentos } from '@/lib/assentos'

export const runtime = 'nodejs'

// PÚBLICO (sem login): o cliente escolhe a poltrona pelo link `/reserva/{token}`.
// Token resolvido por mapa reverso `reservatoken:{token}` → reservaId.

async function reservaPorToken(token: string): Promise<Reserva | null> {
  const id = await redis.get<string>(`reservatoken:${token}`)
  if (!id) return null
  return await redis.get<Reserva>(`reserva:${id}`)
}
async function carregarReservas(): Promise<Reserva[]> {
  const ids = await redis.smembers('reservas')
  if (!ids.length) return []
  return (await redis.mget<(Reserva | null)[]>(...ids.map(i => `reserva:${i}`))).filter(Boolean) as Reserva[]
}

// GET ?token= — devolve o mapa da viagem, ocupadas e os passageiros da reserva.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || ''
  const reserva = token ? await reservaPorToken(token) : null
  if (!reserva) return NextResponse.json({ error: 'link inválido ou expirado' }, { status: 404 })
  const viagem = await redis.get<Viagem>(`viagem:${reserva.viagemId}`)
  // O mapa vem do SNAPSHOT da viagem — é o croqui que o passageiro comprou.
  const layout = viagem?.layoutSnap || null
  const ocupadas = Array.from(poltronasOcupadas(await carregarReservas(), reserva.viagemId, reserva.id))
  return NextResponse.json({
    contratanteNome: reserva.contratanteNome,
    status: reserva.status,
    viagem: viagem ? { titulo: viagem.titulo, dataIda: viagem.dataIda, dataVolta: viagem.dataVolta } : null,
    layout,
    ocupadas,
    passageiros: reserva.passageiros.map(p => ({ nome: p.nome, poltrona: p.poltrona })),
  })
}

// POST { token, poltronas } — atribui uma poltrona por passageiro (mesma ordem).
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const token = String(b.token || '')
  const reserva = token ? await reservaPorToken(token) : null
  if (!reserva) return NextResponse.json({ error: 'link inválido ou expirado' }, { status: 404 })
  if (reserva.status === 'cancelada') return NextResponse.json({ error: 'esta reserva foi cancelada' }, { status: 400 })

  const poltronas: string[] = Array.isArray(b.poltronas) ? b.poltronas.map((p: any) => String(p || '').trim()) : []
  if (poltronas.length !== reserva.passageiros.length) {
    return NextResponse.json({ error: `escolha ${reserva.passageiros.length} poltrona(s)` }, { status: 400 })
  }
  if (poltronas.some(p => !p)) return NextResponse.json({ error: 'escolha uma poltrona para cada passageiro' }, { status: 400 })

  // Assentos existem no layout?
  const viagem = await redis.get<Viagem>(`viagem:${reserva.viagemId}`)
  const layout = viagem?.layoutSnap || null
  if (layout) {
    const inexistente = poltronas.find(n => !poltronaExiste(layout, n))
    if (inexistente) return NextResponse.json({ error: `poltrona ${inexistente} não existe` }, { status: 400 })
  }
  // Conflito com outras reservas (ignora a própria) ou repetida entre os pax.
  const ocupadas = poltronasOcupadas(await carregarReservas(), reserva.viagemId, reserva.id)
  const conflitos = poltronasEmConflito(poltronas, ocupadas)
  if (conflitos.length) return NextResponse.json({ error: `poltrona(s) já ocupada(s): ${conflitos.join(', ')}`, conflito: true }, { status: 409 })

  // TRAVA ATÔMICA. Aqui é onde a corrida é mais provável de todas: vários clientes
  // com o link aberto ao mesmo tempo, escolhendo a mesma poltrona boa. A conferência
  // acima não segura isso.
  const antes = (reserva.passageiros || []).map(p => p.poltrona).filter(Boolean) as string[]
  const trava = await reatribuirAssentos(reserva.viagemId, antes, poltronas, reserva.id)
  if (trava.ok === false) {
    return NextResponse.json({ error: `a poltrona ${trava.conflitos.join(', ')} acabou de ser escolhida por outra pessoa — escolha outra`, conflito: true }, { status: 409 })
  }

  const atualizado: Reserva = { ...reserva, passageiros: reserva.passageiros.map((p, i) => ({ ...p, poltrona: poltronas[i] })), atualizadoEm: new Date().toISOString() }
  await redis.set(`reserva:${reserva.id}`, atualizado)
  return NextResponse.json({ ok: true })
}
