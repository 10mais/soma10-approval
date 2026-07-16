import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, CrmEmpresa } from '@/lib/redis'
import { v4 as uuid } from 'uuid'
import { soDigitosCnpj } from '@/lib/cnpj'
import { bloqueiaPapel } from '@/lib/permissoesPapel'

export const runtime = 'nodejs'

async function autorizado() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}

export async function GET(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const e = await redis.get<CrmEmpresa>(`empresa:${id}`)
    return e ? NextResponse.json(e) : NextResponse.json({ error: 'não encontrada' }, { status: 404 })
  }
  const ids = await redis.smembers('crm:empresas')
  const empresas = ids.length ? ((await redis.mget<(CrmEmpresa | null)[]>(...ids.map(i => `empresa:${i}`))).filter(Boolean) as CrmEmpresa[]) : []
  empresas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }))
  return NextResponse.json(empresas)
}

export async function POST(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  const b = await req.json()
  if (!String(b.nome || '').trim()) return NextResponse.json({ error: 'informe o nome' }, { status: 400 })
  const agora = new Date().toISOString()
  const empresa: CrmEmpresa = {
    id: uuid(), nome: String(b.nome).trim(), cnpj: soDigitosCnpj(b.cnpj), segmento: b.segmento || '', site: b.site || '', instagram: b.instagram || '', telefone: b.telefone || '', observacoes: b.observacoes || '',
    criadoPor: session.user?.name || '', criadoEm: agora, atualizadoEm: agora,
  }
  await redis.set(`empresa:${empresa.id}`, empresa)
  await redis.sadd('crm:empresas', empresa.id)
  return NextResponse.json({ ok: true, empresa })
}

export async function PUT(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  const { id, ...updates } = await req.json()
  const empresa = await redis.get<CrmEmpresa>(`empresa:${id}`)
  if (!empresa) return NextResponse.json({ error: 'não encontrada' }, { status: 404 })
  const campos = ['nome', 'cnpj', 'segmento', 'site', 'instagram', 'telefone', 'observacoes']
  const atualizado: any = { ...empresa, atualizadoEm: new Date().toISOString() }
  for (const c of campos) if (c in updates) atualizado[c] = updates[c]
  // Guardado só com dígitos: a máscara é da tela; no banco, dado limpo.
  if ('cnpj' in updates) atualizado.cnpj = soDigitosCnpj(updates.cnpj)
  await redis.set(`empresa:${id}`, atualizado)
  return NextResponse.json({ ok: true, empresa: atualizado })
}

export async function DELETE(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'excluir', (session.user as any).permissoes)) return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await redis.del(`empresa:${id}`)
  await redis.srem('crm:empresas', id)
  return NextResponse.json({ ok: true })
}
