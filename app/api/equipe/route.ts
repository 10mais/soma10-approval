import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUsuariosRaw } from '@/lib/cache'

export const runtime = 'nodejs'

// Roster ENXUTO e seguro da equipe (sem salarios/custos/senha), liberado a
// qualquer logado nao-cliente. Usado pelo CRM (dropdown de "dono") para papeis
// que nao podem ler /api/usuarios (ex.: vendas), evitando vazar a folha.
export async function GET() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const usuarios = await getUsuariosRaw()
  const equipe = usuarios
    .filter(u => u.role !== 'cliente')
    .map(u => ({ id: u.id, nome: u.nome, email: u.email, role: u.role, cargo: u.cargo || '', funcaoVendas: u.funcaoVendas, foto: u.foto || '', tipoTurismo: (u as any).tipoTurismo, cnh: (u as any).cnh, telefone: u.telefone || '' }))

  return NextResponse.json(equipe)
}
