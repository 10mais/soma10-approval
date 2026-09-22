import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente } from '@/lib/redis'
import { lerFechamentos, fecharMesesPendentes } from '@/lib/fechamentoMes'

export const runtime = 'nodejs'

// FATURAMENTO MÊS A MÊS (lib/fechamentoMes). Devolve os meses já FECHADOS — o número
// gravado quando o mês terminou, que não muda mais se o contrato mudar depois.
//
// O fechamento é trabalho do cron diário; aqui ele também é tentado na primeira abertura
// da tela, para o histórico já nascer gravado sem esperar a virada do dia. Falhar é
// aceitável: a tela calcula o mês na hora quando não existe fechamento.
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  try {
    const ids = await redis.smembers('clientes')
    const clientes = ids.length ? ((await redis.mget<(Cliente | null)[]>(...ids.map(i => `cliente:${i}`))).filter(Boolean) as Cliente[]) : []
    await fecharMesesPendentes(clientes as any)
  } catch { /* segue com o que já está fechado */ }

  const fechamentos = await lerFechamentos().catch(() => [])
  return NextResponse.json({ fechamentos })
}
