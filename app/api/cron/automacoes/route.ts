import { NextRequest, NextResponse } from 'next/server'
import { cronAutorizado } from '@/lib/cronAuth'
import { processarPendentes } from '@/lib/automacoesEngine'
import { capturarErro } from '@/lib/erros'

export const runtime = 'nodejs'
export const maxDuration = 120

// Processa os passos agendados (com atraso) das automações cujo vencimento chegou.
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  try {
    const executados = await processarPendentes()
    return NextResponse.json({ ok: true, executados })
  } catch (e) {
    await capturarErro('cron/automacoes', e)
    return NextResponse.json({ error: 'falha ao processar automações' }, { status: 500 })
  }
}
