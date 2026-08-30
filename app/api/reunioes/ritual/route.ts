import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import { normalizaRitual, DiaRitual } from '@/lib/ritualSemana'

export const runtime = 'nodejs'

// RITUAL DA SEMANA — qual área da empresa é o tema de cada dia útil
// (segunda Comercial, terça Posicionamento…). Ver lib/ritualSemana.
//
// Lê a equipe (todo mundo precisa saber o tema do dia); escreve admin/gerente,
// a mesma régua das reuniões — é decisão de gestão, não de rotina.

const CHAVE = 'config:reunioesRitual'

async function sessao(escrita = false) {
  const s = await getServerSession(authOptions)
  if (!s) return null
  const role = (s.user as any).role
  if (role === 'cliente') return null
  if (escrita && role !== 'admin' && role !== 'gerente') return null
  return s
}

export async function GET() {
  if (!(await sessao())) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const bruto = await redis.get<{ dias: DiaRitual[] }>(CHAVE).catch(() => null)
  // Instância que nunca configurou recebe a semente — a tela não nasce vazia.
  return NextResponse.json({ ritual: normalizaRitual(bruto), configurado: !!bruto })
}

export async function PUT(req: NextRequest) {
  const s = await sessao(true)
  if (!s) return NextResponse.json({ error: 'só admin ou gerente muda o ritual da semana' }, { status: 403 })
  const b = await req.json().catch(() => null)
  // A normalização é a mesma da leitura: dia fora de 1..7, área vazia e dia
  // repetido não entram — nem aqui, nem vindos de um banco antigo.
  const ritual = normalizaRitual(b)
  await redis.set(CHAVE, { dias: ritual, atualizadoEm: new Date().toISOString(), atualizadoPorNome: s.user?.name || '' })
  return NextResponse.json({ ok: true, ritual })
}
