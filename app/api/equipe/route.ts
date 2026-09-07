import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUsuariosRaw } from '@/lib/cache'
import { getPerfilInstancia } from '@/lib/perfisInstancia'
import { resolverEscopoLoja } from '@/lib/escopoLoja'
import { redis, Usuario } from '@/lib/redis'
import { revalidateTag } from 'next/cache'

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

  // Campos do CARD do colaborador (lib/hubPessoa): atribuições, responsabilidades e
  // clientes sob responsabilidade. Continua sem salário, custo, senha e permissões.
  const equipe = usuarios.map(u => ({
    id: u.id, nome: u.nome, email: u.email, role: u.role, cargo: u.cargo || '', funcaoVendas: u.funcaoVendas, lojaId: u.lojaId, foto: u.foto || '',
    telefone: u.telefone || '', bio: u.bio || '',
    atribuicoes: Array.isArray(u.atribuicoes) ? u.atribuicoes : [],
    responsabilidades: Array.isArray(u.responsabilidades) ? u.responsabilidades : [],
    clientesResponsavel: Array.isArray(u.clientesResponsavel) ? u.clientesResponsavel : [],
  }))
  // ?email= devolve UM perfil (card de uma pessoa); 404 se não estiver no roster visível.
  const email = (req.nextUrl.searchParams.get('email') || '').trim().toLowerCase()
  if (email) {
    const um = equipe.find(u => u.email.toLowerCase() === email)
    return um ? NextResponse.json(um) : NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  }
  return NextResponse.json(equipe)
}

// PUT (só admin): atribuições, responsabilidades, clientes sob responsabilidade e
// cargo do colaborador — editados no card da pessoa (/equipe/[email]).
const limpaLista = (v: any, max = 40) => Array.isArray(v) ? v.map(x => String(x || '').trim()).filter(Boolean).slice(0, max) : undefined

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'só admin' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()
  const u = await redis.get<Usuario>(`usuario:${email}`)
  if (!u || u.role === 'cliente') return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  const atribuicoes = limpaLista(body.atribuicoes, 20)
  const responsabilidades = limpaLista(body.responsabilidades, 40)
  const clientesResponsavel = limpaLista(body.clientesResponsavel, 200)
  if (atribuicoes !== undefined) u.atribuicoes = atribuicoes
  if (responsabilidades !== undefined) u.responsabilidades = responsabilidades
  if (clientesResponsavel !== undefined) u.clientesResponsavel = clientesResponsavel
  if (body.cargo !== undefined) u.cargo = String(body.cargo || '').trim()
  await redis.set(`usuario:${email}`, u)
  revalidateTag('usuarios')
  return NextResponse.json({ ok: true })
}
