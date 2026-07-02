import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, CrmContato, CrmEmpresa } from '@/lib/redis'
import { v4 as uuid } from 'uuid'
import { bloqueiaPapel } from '@/lib/permissoesPapel'

export const runtime = 'nodejs'

async function autorizado() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}

// #4 — vincula Contato (PF) a Empresa (PJ): acha a empresa pelo nome ou cria uma
// nova, devolvendo o id. Usa um cache para nao reler a lista a cada contato.
async function carregarEmpresas(): Promise<CrmEmpresa[]> {
  const ids = await redis.smembers('crm:empresas')
  return ids.length ? ((await redis.mget<(CrmEmpresa | null)[]>(...ids.map(i => `empresa:${i}`))).filter(Boolean) as CrmEmpresa[]) : []
}
async function acharOuCriarEmpresa(nome: string, autor: string, cache: CrmEmpresa[]): Promise<string> {
  const alvo = nome.trim().toLowerCase()
  if (!alvo) return ''
  const existente = cache.find(e => (e.nome || '').trim().toLowerCase() === alvo)
  if (existente) return existente.id
  const agora = new Date().toISOString()
  const nova: CrmEmpresa = { id: uuid(), nome: nome.trim(), criadoPor: autor, criadoEm: agora, atualizadoEm: agora }
  await redis.set(`empresa:${nova.id}`, nova)
  await redis.sadd('crm:empresas', nova.id)
  cache.push(nova)
  return nova.id
}

export async function GET(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const c = await redis.get<CrmContato>(`contato:${id}`)
    return c ? NextResponse.json(c) : NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  }
  const ids = await redis.smembers('crm:contatos')
  const contatos = ids.length ? ((await redis.mget<(CrmContato | null)[]>(...ids.map(i => `contato:${i}`))).filter(Boolean) as CrmContato[]) : []
  contatos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }))
  return NextResponse.json(contatos)
}

export async function POST(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  const b = await req.json()
  const autor = session.user?.name || ''
  const novo = (d: any): CrmContato => {
    const agora = new Date().toISOString()
    return { id: uuid(), nome: String(d.nome).trim(), email: d.email || '', telefone: d.telefone || '', empresa: d.empresa || '', empresaId: d.empresaId || '', profissionalAutonomo: !!d.profissionalAutonomo, areaAtuacao: d.areaAtuacao || '', cargo: d.cargo || '', observacoes: d.observacoes || '', criadoPor: autor, criadoEm: agora, atualizadoEm: agora }
  }

  // Criação em LOTE (adicionar vários / importar)
  if (Array.isArray(b.lote)) {
    const validos = b.lote.filter((d: any) => String(d?.nome || '').trim())
    const contatos = validos.map(novo)
    const cacheEmpresas = await carregarEmpresas()
    for (const c of contatos) {
      if (c.empresa && !c.empresaId) c.empresaId = await acharOuCriarEmpresa(c.empresa, autor, cacheEmpresas)
      await redis.set(`contato:${c.id}`, c)
    }
    if (contatos.length) await redis.sadd('crm:contatos', ...(contatos.map(c => c.id) as [string, ...string[]]))
    return NextResponse.json({ ok: true, criados: contatos.length })
  }

  // Criação individual
  if (!String(b.nome || '').trim()) return NextResponse.json({ error: 'informe o nome' }, { status: 400 })
  const contato = novo(b)
  // #4 — se veio nome de empresa sem vinculo, acha/cria a empresa e amarra
  if (contato.empresa && !contato.empresaId) {
    contato.empresaId = await acharOuCriarEmpresa(contato.empresa, autor, await carregarEmpresas())
  }
  await redis.set(`contato:${contato.id}`, contato)
  await redis.sadd('crm:contatos', contato.id)
  return NextResponse.json({ ok: true, contato })
}

export async function PUT(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  const { id, ...updates } = await req.json()
  const contato = await redis.get<CrmContato>(`contato:${id}`)
  if (!contato) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  const campos = ['nome', 'email', 'telefone', 'empresa', 'empresaId', 'profissionalAutonomo', 'areaAtuacao', 'cargo', 'observacoes']
  const atualizado: any = { ...contato, atualizadoEm: new Date().toISOString() }
  for (const c of campos) if (c in updates) atualizado[c] = updates[c]
  // #4 — empresa preenchida (ou alterada) sem vinculo explicito: acha/cria e amarra
  if (atualizado.empresa && (!atualizado.empresaId || ('empresa' in updates && !('empresaId' in updates)))) {
    atualizado.empresaId = await acharOuCriarEmpresa(atualizado.empresa, session.user?.name || '', await carregarEmpresas())
  }
  await redis.set(`contato:${id}`, atualizado)
  return NextResponse.json({ ok: true, contato: atualizado })
}

export async function DELETE(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'excluir', (session.user as any).permissoes)) return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  // Exclusão em massa: ?ids=a,b,c  (alem do ?id= individual)
  const idsParam = req.nextUrl.searchParams.get('ids')
  if (idsParam) {
    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean)
    if (!ids.length) return NextResponse.json({ error: 'ids obrigatório' }, { status: 400 })
    for (const cid of ids) await redis.del(`contato:${cid}`)
    await redis.srem('crm:contatos', ...(ids as [string, ...string[]]))
    return NextResponse.json({ ok: true, excluidos: ids.length })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await redis.del(`contato:${id}`)
  await redis.srem('crm:contatos', id)
  return NextResponse.json({ ok: true })
}
