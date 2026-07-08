import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente, Usuario } from '@/lib/redis'
import { getClientesRaw } from '@/lib/cache'
import { revalidateTag } from 'next/cache'
import { registrarAuditoria } from '@/lib/auditoria'
import { v4 as uuid } from 'uuid'
import bcrypt from 'bcryptjs'

function gerarSenha() {
  // Senha fácil de digitar: 8 caracteres alfanuméricos
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const role = (session.user as any).role

  // Busca por ID unico — retorna apenas 1 cliente (rapido)
  const idParam = req.nextUrl.searchParams.get('id')
  if (idParam) {
    const c = await redis.get<Cliente>(`cliente:${idParam}`)
    if (!c) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
    if (role === 'cliente' && c.id !== (session.user as any).clienteId) return NextResponse.json({ error: 'não autorizado' }, { status: 403 })
    const { facebookPageToken, instagramToken, loginSenha, ...seguro } = c as any
    return NextResponse.json({ ...seguro, temInstagram: !!instagramToken, temFacebook: !!facebookPageToken })
  }

  let clientes = await getClientesRaw()

  if (role === 'cliente') {
    const clienteId = (session.user as any).clienteId
    clientes = clientes.filter(c => c.id === clienteId)
  }

  // Nunca expor tokens nem a senha em texto plano ao frontend — só o status importa
  const seguros = clientes
    .map(({ facebookPageToken, instagramToken, loginSenha, ...resto }) => resto)
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt', { sensitivity: 'base' }))
  return NextResponse.json(seguros)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { nome, instagram, logo, corPrimaria, corSecundaria, loginEmail, tipo, entregaveis, postsMensais, contratoValor, contratoInicio, contratoRenovacao, contratoCiclo, receitasAvulsas } = await req.json()
  const cliente: Cliente = { id: uuid(), nome, instagram, logo, corPrimaria, corSecundaria, tipo: tipo || 'cliente', entregaveis: entregaveis || [], postsMensais: Number(postsMensais) || 0,
    ...(Array.isArray(receitasAvulsas) ? { receitasAvulsas } : {}),
    ...(contratoValor !== undefined ? { contratoValor: Number(contratoValor) || 0 } : {}),
    ...(contratoInicio ? { contratoInicio } : {}),
    ...(contratoRenovacao ? { contratoRenovacao } : {}),
    ...(contratoCiclo ? { contratoCiclo } : {}),
    criadoEm: new Date().toISOString() }

  // Criar acesso de login para o cliente, se um e-mail foi informado
  let senhaGerada = ''
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
    // NÃO persistimos a senha em texto plano. Ela é devolvida só nesta resposta
    // (exibição única ao admin); depois, só dá pra RESETAR (gera uma nova).
    senhaGerada = senhaPlana
  }

  await redis.set(`cliente:${cliente.id}`, cliente)
  await redis.sadd('clientes', cliente.id)

  revalidateTag('clientes')
  if (cliente.loginEmail) revalidateTag('usuarios')

  // Automação legada (toggle antigo): cliente novo -> notifica a equipe
  try {
    const { getAutomacoes } = await import('@/lib/automacoes')
    const aut = await getAutomacoes()
    if (aut.clienteNovoNotifica) {
      const { notificarEquipe } = await import('@/lib/notificacoes')
      await notificarEquipe('geral', 'Novo cliente cadastrado', `O cliente "${cliente.nome}" foi adicionado.`)
    }
  } catch { /* automação não bloqueia o cadastro */ }

  // Motor de automações flexível
  const { dispararEvento } = await import('@/lib/automacoesEngine')
  await dispararEvento('cliente_novo', { clienteId: cliente.id, clienteNome: cliente.nome, segmento: (cliente as any).segmento || '', contratoValor: (cliente as any).contratoValor || 0 })

  return NextResponse.json({ ok: true, cliente, senhaGerada: senhaGerada || undefined })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  // Equipe (admin e gerente) pode editar dados do cliente (inclui Brand Board).
  // Criar/excluir cliente continua restrito ao admin (POST/DELETE).
  if (!session || (role !== 'admin' && role !== 'gerente')) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { id, ...updates } = await req.json()
  const cliente = await redis.get<Cliente>(`cliente:${id}`)
  if (!cliente) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

  const camposPermitidos = ['nome', 'instagram', 'logo', 'corPrimaria', 'corSecundaria', 'tipo', 'entregaveis', 'postsMensais',
    'contratoValor', 'contratoInicio', 'contratoRenovacao', 'contratoCiclo', 'diaVencimento', 'receitasAvulsas',
    'segmento', 'palavrasChave', 'descricao', 'publicoAlvo', 'tomDeVoz', 'preferencias', 'documentos',
    'documentoMarca', 'documentoMarcaGeradoEm', 'permissoes', 'handoffVendas', 'referenciasVisuais', 'assetsMarca', 'squad', 'modulos', 'inadimplente', 'suspensoDesde']
  const atualizado = { ...cliente }
  for (const campo of camposPermitidos) {
    if (campo in updates) (atualizado as any)[campo] = updates[campo]
  }
  // Higieniza: nunca manter senha em texto plano (migração de dados antigos).
  delete (atualizado as any).loginSenha

  await redis.set(`cliente:${id}`, atualizado)
  revalidateTag('clientes')
  const { facebookPageToken, instagramToken, loginSenha, ...seguro } = atualizado as any
  return NextResponse.json({ ok: true, cliente: seguro })
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
  revalidateTag('clientes')
  if (cliente?.loginEmail) revalidateTag('usuarios')
  await registrarAuditoria({ ator: session.user?.name || session.user?.email || 'admin', acao: 'cliente_excluido', alvo: cliente?.nome || id, detalhe: cliente?.loginEmail ? `Login removido: ${cliente.loginEmail}` : undefined })
  return NextResponse.json({ ok: true })
}
