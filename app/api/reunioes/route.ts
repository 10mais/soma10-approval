import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Reuniao, ReuniaoDecisao, Tarefa } from '@/lib/redis'
import { getPerfilInstancia } from '@/lib/perfisInstancia'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// Reuniões internas: pauta → ata → decisões → tarefas.
// Leitura: equipe. Escrita: admin e gerente (é gestão, não operação de rotina).

async function sessao(escrita = false) {
  const s = await getServerSession(authOptions)
  if (!s) return null
  const role = (s.user as any).role
  if (role === 'cliente') return null
  if (escrita && role !== 'admin' && role !== 'gerente') return null
  return s
}

export async function GET() {
  const s = await sessao()
  if (!s) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const ids = await redis.smembers('reunioes')
  const lista = ids.length ? ((await redis.mget<(Reuniao | null)[]>(...ids.map(i => `reuniao:${i}`))).filter(Boolean) as Reuniao[]) : []
  lista.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
  return NextResponse.json({ reunioes: lista })
}

export async function POST(req: NextRequest) {
  const s = await sessao(true)
  if (!s) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const b = await req.json()
  const titulo = (b.titulo || '').toString().trim()
  const data = (b.data || '').toString()
  if (!titulo || isNaN(new Date(data).getTime())) return NextResponse.json({ error: 'título e data são obrigatórios' }, { status: 400 })
  const r: Reuniao = {
    id: uuid(),
    titulo: titulo.slice(0, 140),
    data,
    participantes: (b.participantes || '').toString().slice(0, 400) || undefined,
    pauta: (b.pauta || '').toString().slice(0, 8000) || undefined,
    status: 'agendada',
    criadoPor: s.user?.name || s.user?.email || undefined,
    criadoEm: new Date().toISOString(),
  }
  await redis.set(`reuniao:${r.id}`, r)
  await redis.sadd('reunioes', r.id)
  return NextResponse.json({ ok: true, reuniao: r })
}

export async function PUT(req: NextRequest) {
  const s = await sessao(true)
  if (!s) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const b = await req.json()
  const r = await redis.get<Reuniao>(`reuniao:${b.id}`)
  if (!r) return NextResponse.json({ error: 'não encontrada' }, { status: 404 })

  const atualizada: Reuniao = { ...r, atualizadoEm: new Date().toISOString() }
  for (const c of ['titulo', 'data', 'participantes', 'pauta', 'ata', 'status', 'decisoes'] as const) {
    if (c in b) (atualizada as any)[c] = b[c]
  }

  // Ação: decisão vira TAREFA (uma vez só — regrava a decisão com o tarefaId)
  if (b.criarTarefaDaDecisao) {
    const dec = (atualizada.decisoes || []).find(d => d.id === b.criarTarefaDaDecisao)
    if (!dec) return NextResponse.json({ error: 'decisão não encontrada' }, { status: 400 })
    if (dec.tarefaId) return NextResponse.json({ error: 'esta decisão já virou tarefa' }, { status: 400 })
    const clinica = (await getPerfilInstancia()) === 'clinica'
    const agora = new Date().toISOString()
    const tarefa: Tarefa = {
      id: uuid(),
      titulo: dec.texto.slice(0, 140),
      descricao: `Decisão da reunião "${atualizada.titulo}" (${new Date(atualizada.data).toLocaleDateString('pt-BR')}).`,
      tipo: clinica ? 'reuniao_interna' : 'tarefa',
      status: 'a_fazer',
      prioridade: 'media',
      responsavelEmail: dec.responsavelEmail || undefined,
      responsavelNome: dec.responsavelNome || undefined,
      prazo: dec.prazo || undefined,
      atividades: [{ id: uuid(), tipo: 'criacao', descricao: `Criada a partir da reunião "${atualizada.titulo}"`, autor: s.user?.name || '', criadoEm: agora }],
      criadoPor: s.user?.name || s.user?.email || '',
      criadoEm: agora,
      atualizadoEm: agora,
    }
    await redis.set(`tarefa:${tarefa.id}`, tarefa)
    await redis.sadd('tarefas', tarefa.id)
    dec.tarefaId = tarefa.id
  }

  await redis.set(`reuniao:${atualizada.id}`, atualizada)
  return NextResponse.json({ ok: true, reuniao: atualizada })
}

export async function DELETE(req: NextRequest) {
  const s = await sessao(true)
  if (!s || (s.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const { id } = await req.json()
  await redis.del(`reuniao:${id}`)
  await redis.srem('reunioes', id)
  return NextResponse.json({ ok: true })
}
