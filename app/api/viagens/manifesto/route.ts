import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Viagem } from '@/lib/redis'
import { Reserva } from '@/lib/reservas'
import { manifestoCSV, nomeArquivoManifesto, linhasManifesto } from '@/lib/manifesto'

export const runtime = 'nodejs'

// LISTA DE PASSAGEIROS (manifesto) de uma viagem — DAER/ANTT ou internacional.
// GET ?id={viagemId}          → baixa o CSV (Excel pt-BR abre em colunas).
// GET ?id={viagemId}&check=1  → só o diagnóstico: quantos e quem está incompleto,
//                               para a tela avisar ANTES de o dono baixar.
//
// Dado de passageiro é pessoal: exige login e bloqueia o papel `cliente`.

async function sessaoEquipe() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}

export async function GET(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'informe a viagem' }, { status: 400 })
  const viagem = await redis.get<Viagem>(`viagem:${id}`)
  if (!viagem) return NextResponse.json({ error: 'viagem não encontrada' }, { status: 404 })

  const ids = await redis.smembers('reservas')
  const todas = ids.length
    ? (await redis.mget<(Reserva | null)[]>(...ids.map(i => `reserva:${i}`))).filter(Boolean) as Reserva[]
    : []
  const reservas = todas.filter(r => r.viagemId === id)

  const linhas = linhasManifesto(viagem, reservas as any)
  const incompletos = linhas.filter(l => l.pendencias)

  if (req.nextUrl.searchParams.get('check') === '1') {
    return NextResponse.json({
      total: linhas.length,
      incompletos: incompletos.length,
      internacional: !!viagem.internacional,
      quem: incompletos.slice(0, 20).map(l => ({ nome: l.nome, falta: l.pendencias })),
    })
  }

  const csv = manifestoCSV(viagem, reservas as any)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nomeArquivoManifesto(viagem)}"`,
      'Cache-Control': 'no-store',
    },
  })
}
