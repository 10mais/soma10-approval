import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUsuariosRaw } from '@/lib/cache'
import { getPerfilInstancia } from '@/lib/perfisInstancia'
import { resolverEscopoLoja } from '@/lib/escopoLoja'

export const runtime = 'nodejs'

// Roster ENXUTO e seguro da equipe (sem salarios/custos/senha), liberado a
// qualquer logado nao-cliente. Usado pelo CRM (dropdown de "dono") para papeis
// que nao podem ler /api/usuarios (ex.: vendas), evitando vazar a folha.
// VAREJO (telefonia): escopado por LOJA — cada loja vê só a SUA equipe; admin/
// gestor sem loja focada vê todas (compilado). Isolamento entre unidades.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  let usuarios = (await getUsuariosRaw()).filter(u => u.role !== 'cliente')

  const perfil = await getPerfilInstancia()
  if (perfil === 'telefonia') {
    const esc = resolverEscopoLoja({ role, lojaId: (session.user as any).lojaId }, req.nextUrl.searchParams.get('lojaId'))
    if (esc.tipo === 'bloqueado') usuarios = []
    else if (esc.tipo === 'loja') usuarios = usuarios.filter(u => u.lojaId === esc.lojaId)
  }

  const equipe = usuarios.map(u => ({ id: u.id, nome: u.nome, email: u.email, role: u.role, cargo: u.cargo || '', funcaoVendas: u.funcaoVendas, lojaId: u.lojaId, foto: u.foto || '', tipoTurismo: (u as any).tipoTurismo, cnh: (u as any).cnh, telefone: u.telefone || '' }))
  return NextResponse.json(equipe)
}
