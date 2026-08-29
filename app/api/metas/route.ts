import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import { MetaAno, normalizaMeta, distribuirAnual, metaVazia } from '@/lib/metas'

export const runtime = 'nodejs'

// META DE VENDAS por ano (`meta:{ano}`, 12 valores mensais — ver lib/metas).
//
// Quem VÊ: a equipe (a meta só funciona como régua se o time souber onde está).
// Quem DEFINE: só admin — decisão do dono. Gerente não muda o número que ele
// próprio precisa bater.
//
// Não existe "realizado" guardado aqui: ele é somado das oportunidades ganhas no
// CRM na hora de mostrar. Número derivado que vira registro é número que
// dessincroniza.

const CHAVE = (ano: number) => `meta:${ano}`

function anoValido(bruto: any): number | null {
  const n = Number(bruto)
  // Faixa larga o bastante para planejar o ano que vem e olhar o histórico —
  // e estreita o bastante para não virar chave lixo no Redis.
  if (!Number.isInteger(n) || n < 2020 || n > 2100) return null
  return n
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const ano = anoValido(req.nextUrl.searchParams.get('ano')) ?? new Date().getFullYear()
  const bruta = await redis.get<MetaAno>(CHAVE(ano)).catch(() => null)
  // Ano sem meta devolve 12 zeros (a tela sabe mostrar "sem meta definida") —
  // não é erro, é o estado inicial de toda instância.
  return NextResponse.json({ meta: bruta ? normalizaMeta(bruta, ano) : metaVazia(ano) })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role !== 'admin') return NextResponse.json({ error: 'só o admin define a meta' }, { status: 403 })

  const b = await req.json().catch(() => null)
  const ano = anoValido(b?.ano)
  if (!ano) return NextResponse.json({ error: 'ano inválido' }, { status: 400 })

  // Dois jeitos de definir: um número anual (distribuído igual entre os 12
  // meses) ou os 12 meses na mão. `meses` ganha quando os dois vêm.
  let meses: number[]
  if (Array.isArray(b?.meses)) meses = normalizaMeta({ meses: b.meses }, ano).meses
  else if (b?.anual !== undefined) meses = distribuirAnual(Number(b.anual) || 0)
  else return NextResponse.json({ error: 'informe "meses" (12 valores) ou "anual"' }, { status: 400 })

  const meta: MetaAno = {
    ano, meses,
    atualizadoEm: new Date().toISOString(),
    atualizadoPorNome: String((session.user as any)?.name || '').slice(0, 80),
  }
  await redis.set(CHAVE(ano), meta)
  // Índice dos anos com meta — deixa a tela oferecer os anos já planejados sem
  // varrer o banco.
  await redis.sadd('metas', String(ano)).catch(() => {})
  return NextResponse.json({ ok: true, meta })
}
