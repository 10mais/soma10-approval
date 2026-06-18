import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente, Usuario } from '@/lib/redis'
import { v4 as uuid } from 'uuid'
import bcrypt from 'bcryptjs'

function gerarSenha() {
  // Senha fácil de digitar: 8 caracteres alfanuméricos
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const role = (session.user as any).role
  const ids = await redis.smembers('clientes')
  let clientes = (await Promise.all(ids.map(id => redis.get<Cliente>(`cliente:${id}`)))).filter(Boolean) as Cliente[]

  // Cliente só vê a si mesmo
  if (role === 'cliente') {
    const clienteId = (session.user as any).clienteId
    clientes = clientes.filter(c => c.id === clienteId)
  }

  // Nunca expor tokens ao frontend — só o status de conexão importa
  const seguros = clientes.map(({ facebookPageToken, instagramToken, ...resto }) => resto)
  return NextResponse.json(seguros)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { nome, instagram, logo, corPrimaria, corSecundaria, loginEmail } = await req.json()
  const cliente: Cliente = { id: uuid(), nome, instagram, logo, corPrimaria, corSecundaria, criadoEm: new Date().toISOString() }

  // Criar acesso de login para o cliente, se um e-mail foi informado
  if (loginEmail) {
    const jaExiste = await redis.get(`usuario:${loginEmail}`)
    if (jaExiste) {
      return NextResponse.json({ error: 'Já existe um usuário com este e-mail' }, { status: 400 })
    }

    const senhaPlana = gerarSenha()
    const senhaHash = await bcrypt.hash(senhaPlana, 10)

    const usuarioCliente: Usuario = {
      id: uuid(),
      nome,
      email: loginEmail,
      senha: senhaHash,
      role: 'cliente',
      clienteId: cliente.id,
      criadoEm: new Date().toISOString(),
    }

    await redis.set(`usuario:${loginEmail}`, usuarioCliente)
    await redis.sadd('usuarios', loginEmail)

    cliente.loginEmail = loginEmail
    cliente.loginSenha = senhaPlana
  }

  await redis.set(`cliente:${cliente.id}`, cliente)
  await redis.sadd('clientes', cliente.id)

  return NextResponse.json({ ok: true, cliente })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { id, ...updates } = await req.json()
  const cliente = await redis.get<Cliente>(`cliente:${id}`)
  if (!cliente) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

  const camposPermitidos = ['nome', 'instagram', 'logo', 'corPrimaria', 'corSecundaria',
    'segmento', 'palavrasChave', 'descricao', 'publicoAlvo', 'tomDeVoz', 'preferencias', 'documentos']
  const atualizado = { ...cliente }
  for (const campo of camposPermitidos) {
    if (campo in updates) (atualizado as any)[campo] = updates[campo]
  }

  await redis.set(`cliente:${id}`, atualizado)
  return NextResponse.json({ ok: true, cliente: atualizado })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { id } = await req.json()
  const cliente = await redis.get<Cliente>(`cliente:${id}`)

  if (cliente?.loginEmail) {
    await redis.del(`usuario:${cliente.loginEmail}`)
    await redis.srem('usuarios', cliente.loginEmail)
  }

  await redis.del(`cliente:${id}`)
  await redis.srem('clientes', id)
  return NextResponse.json({ ok: true })
}
