import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

// Reset de instância para reaproveitamento (ex.: Space Technology → Missões Refrigeração).
// Só funciona quando a env RESET_INSTANCIA_TOKEN está definida NA INSTÂNCIA — sem ela, 404.
// GET  = exporta TODAS as chaves do Redis como JSON (baixar e guardar antes de apagar).
// POST = { confirmar: "APAGAR TUDO DESTA INSTANCIA" } → FLUSHDB. Depois disso o /api/setup
//        volta a aceitar o bootstrap (banco vazio) para o novo cliente.

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function autorizado(req: Request) {
  const esperado = process.env.RESET_INSTANCIA_TOKEN
  if (!esperado) return false
  return (req.headers.get('x-reset-token') || '') === esperado
}

async function todasChaves(): Promise<string[]> {
  const chaves: string[] = []
  let cursor: string | number = 0
  do {
    const [prox, lote] = await redis.scan(cursor, { count: 1000 })
    cursor = prox
    chaves.push(...(lote as string[]))
  } while (String(cursor) !== '0')
  return chaves
}

export async function GET(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ erro: 'nao encontrado' }, { status: 404 })

  const chaves = await todasChaves()
  const dados: Record<string, { tipo: string; valor: unknown }> = {}
  const erros: { chave: string; erro: string }[] = []

  for (const chave of chaves) {
    try {
      const tipo = await redis.type(chave)
      let valor: unknown
      if (tipo === 'string') valor = await redis.get(chave)
      else if (tipo === 'set') valor = await redis.smembers(chave)
      else if (tipo === 'list') valor = await redis.lrange(chave, 0, -1)
      else if (tipo === 'zset') valor = await redis.zrange(chave, 0, -1, { withScores: true })
      else if (tipo === 'hash') valor = await redis.hgetall(chave)
      else valor = `<tipo nao exportado: ${tipo}>`
      dados[chave] = { tipo, valor }
    } catch (e) {
      erros.push({ chave, erro: e instanceof Error ? e.message : String(e) })
    }
  }

  return NextResponse.json({
    exportadoEm: new Date().toISOString(),
    totalChaves: chaves.length,
    erros,
    dados,
  })
}

export async function POST(req: Request) {
  if (!autorizado(req)) return NextResponse.json({ erro: 'nao encontrado' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  if (body?.confirmar !== 'APAGAR TUDO DESTA INSTANCIA') {
    return NextResponse.json(
      { erro: 'confirmacao invalida: envie { "confirmar": "APAGAR TUDO DESTA INSTANCIA" }' },
      { status: 400 }
    )
  }

  const antes = (await todasChaves()).length
  await redis.flushdb()
  return NextResponse.json({ ok: true, chavesApagadas: antes })
}
