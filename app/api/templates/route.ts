import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, TemplateProjeto } from '@/lib/redis'
import { v4 as uuid } from 'uuid'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { MODELOS_SUGERIDOS } from '@/lib/modelosSugeridos'

export const runtime = 'nodejs'

function ehEquipe(session: any) {
  const r = session?.user?.role
  return r === 'admin' || r === 'gerente'
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const ids = await redis.smembers('templates')
  const itens = ids.length ? ((await redis.mget<(TemplateProjeto | null)[]>(...ids.map(i => `template:${i}`))).filter(Boolean) as TemplateProjeto[]) : []
  // O modelo de ONBOARDING existe por padrão (decisão do dono, 07/09): a etapa
  // "Playbook criado" do onboarding manda aplicá-lo, então ele não pode depender
  // de alguém adotar a sugestão antes. Semeado uma vez; depois é um modelo
  // comum (editável/excluível — excluído, volta na próxima leitura).
  const sug = MODELOS_SUGERIDOS.find(m => m.chave === 'onboarding')
  if (sug && !itens.some(t => t.sugestaoChave === 'onboarding')) {
    const t: TemplateProjeto = { id: uuid(), nome: sug.nome, descricao: sug.descricao, marcos: sug.marcos as any, tarefas: sug.tarefas as any, criadoPor: 'sistema', criadoEm: new Date().toISOString(), sugestaoChave: 'onboarding' }
    await redis.set(`template:${t.id}`, t)
    await redis.sadd('templates', t.id)
    itens.push(t)
  }
  itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
  return NextResponse.json(itens)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!ehEquipe(session)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session!.user as any).role, 'estrategia', 'editar', (session!.user as any).permissoes)) return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  const b = await req.json()
  if (!b.nome?.trim()) return NextResponse.json({ error: 'Informe o nome do modelo.' }, { status: 400 })
  const t: TemplateProjeto = {
    id: uuid(),
    nome: b.nome.trim(),
    descricao: b.descricao || '',
    marcos: Array.isArray(b.marcos) ? b.marcos : [],
    tarefas: Array.isArray(b.tarefas) ? b.tarefas : [],
    criadoPor: session!.user?.name || '',
    criadoEm: new Date().toISOString(),
  }
  await redis.set(`template:${t.id}`, t)
  await redis.sadd('templates', t.id)
  return NextResponse.json({ ok: true, template: t })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!ehEquipe(session)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session!.user as any).role, 'estrategia', 'editar', (session!.user as any).permissoes)) return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  const { id, ...updates } = await req.json()
  const t = await redis.get<TemplateProjeto>(`template:${id}`)
  if (!t) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  const atual = { ...t } as any
  for (const c of ['nome', 'descricao', 'marcos', 'tarefas']) { if (c in updates) atual[c] = updates[c] }
  await redis.set(`template:${id}`, atual)
  return NextResponse.json({ ok: true, template: atual })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!ehEquipe(session)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session!.user as any).role, 'estrategia', 'excluir', (session!.user as any).permissoes)) return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await redis.del(`template:${id}`)
  await redis.srem('templates', id)
  return NextResponse.json({ ok: true })
}
