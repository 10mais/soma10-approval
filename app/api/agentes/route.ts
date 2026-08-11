import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { type Agente } from '@/lib/redis'
import { dbDaRequest, OrgDesconhecidaError } from '@/lib/orgs'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// ROTA PILOTO do multi-tenant (F0): primeiro arquivo migrado do Redis cru para o
// wrapper org-scoped. O padrão que as demais rotas seguem (MULTITENANT-PLANO.md §3):
//   1. `import { redis }` sai; entra `dbDaRequest(req)` (tipos de lib/redis ficam);
//   2. toda operação usa o `db` devolvido (chaves ganham o prefixo da org);
//   3. host desconhecido = 403 (nunca cai no banco sem prefixo);
//   4. o arquivo entra em MIGRADOS no tests/isolamentoOrg.test.ts (trava estática).
// Em instância single-tenant (nenhuma org registrada) o comportamento é IDÊNTICO
// ao de antes: modo legado, chaves sem prefixo.

async function sessaoEquipe() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}
function ehAdmin(session: any) { return (session.user as any)?.role === 'admin' }

function orgRecusada(e: unknown): NextResponse | null {
  if (e instanceof OrgDesconhecidaError) return NextResponse.json({ error: 'organização não reconhecida para este endereço' }, { status: 403 })
  return null
}

export async function GET(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  try {
    const db = await dbDaRequest(req)
    const ids = await db.smembers('agentes')
    const agentes = ids.length ? ((await db.mget<Agente | null>(...ids.map(i => `agente:${i}`))).filter(Boolean) as Agente[]) : []
    agentes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }))
    return NextResponse.json(agentes)
  } catch (e) { const r = orgRecusada(e); if (r) return r; throw e }
}

export async function POST(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session || !ehAdmin(session)) return NextResponse.json({ error: 'apenas admin' }, { status: 403 })
  const b = await req.json()
  if (!String(b.nome || '').trim()) return NextResponse.json({ error: 'informe o nome do agente' }, { status: 400 })
  const agora = new Date().toISOString()
  const agente: Agente = {
    id: uuid(),
    nome: String(b.nome).trim(),
    funcao: b.funcao || '',
    descricao: b.descricao || '',
    instrucoes: b.instrucoes || '',
    ferramentas: Array.isArray(b.ferramentas) ? b.ferramentas : [],
    conhecimento: Array.isArray(b.conhecimento) ? b.conhecimento : [],
    cor: b.cor || '#7c3aed',
    ativo: b.ativo !== false,
    criadoPor: session.user?.name || '',
    criadoEm: agora,
    atualizadoEm: agora,
  }
  try {
    const db = await dbDaRequest(req)
    await db.set(`agente:${agente.id}`, agente)
    await db.sadd('agentes', agente.id)
    return NextResponse.json({ ok: true, agente })
  } catch (e) { const r = orgRecusada(e); if (r) return r; throw e }
}

export async function PUT(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session || !ehAdmin(session)) return NextResponse.json({ error: 'apenas admin' }, { status: 403 })
  const { id, ...updates } = await req.json()
  try {
    const db = await dbDaRequest(req)
    const agente = await db.get<Agente>(`agente:${id}`)
    if (!agente) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
    const campos = ['nome', 'funcao', 'descricao', 'instrucoes', 'ferramentas', 'conhecimento', 'cor', 'ativo']
    const atualizado: any = { ...agente, atualizadoEm: new Date().toISOString() }
    for (const c of campos) if (c in updates) atualizado[c] = updates[c]
    await db.set(`agente:${id}`, atualizado)
    return NextResponse.json({ ok: true, agente: atualizado })
  } catch (e) { const r = orgRecusada(e); if (r) return r; throw e }
}

export async function DELETE(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session || !ehAdmin(session)) return NextResponse.json({ error: 'apenas admin' }, { status: 403 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  try {
    const db = await dbDaRequest(req)
    await db.del(`agente:${id}`)
    await db.srem('agentes', id)
    return NextResponse.json({ ok: true })
  } catch (e) { const r = orgRecusada(e); if (r) return r; throw e }
}
