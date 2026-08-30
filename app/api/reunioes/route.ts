import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Reuniao, ReuniaoDecisao, ReuniaoPauta, Tarefa } from '@/lib/redis'
import { ocorrenciasSemanais } from '@/lib/ritualSemana'
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
  // Pautas do dia (a segunda Comercial tem várias) — texto livre continua
  // aceito para quem só quer escrever um parágrafo.
  const pautas: ReuniaoPauta[] = (Array.isArray(b.pautas) ? b.pautas : [])
    .map((x: any) => String(x?.texto ?? x ?? '').trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((texto: string) => ({ id: uuid(), texto: texto.slice(0, 300), feita: false }))

  const base = {
    titulo: titulo.slice(0, 140),
    area: (b.area || '').toString().trim().slice(0, 60) || undefined,
    participantes: (b.participantes || '').toString().slice(0, 400) || undefined,
    pauta: (b.pauta || '').toString().slice(0, 8000) || undefined,
    ...(pautas.length ? { pautas } : {}),
    status: 'agendada' as const,
    criadoPor: s.user?.name || s.user?.email || undefined,
    criadoEm: new Date().toISOString(),
  }

  // RECORRENTE: gera as ocorrências de verdade, uma por semana, cada uma com sua
  // ata e suas pautas. Ocorrência virtual (calculada na hora) não teria onde
  // guardar o que foi decidido naquele dia — e é justamente isso que a reunião
  // produz. `ocorrenciasSemanais` limita a 53: um "até 2099" digitado sem querer
  // não vira mil registros.
  const ate = String(b?.recorrencia?.ate || '')
  if (b?.recorrencia?.tipo === 'semanal' && /^\d{4}-\d{2}-\d{2}$/.test(ate)) {
    const inicio = new Date(data)
    const [ay, am, ad] = ate.split('-').map(Number)
    const datas = ocorrenciasSemanais(inicio, new Date(ay, am - 1, ad))
    if (!datas.length) return NextResponse.json({ error: 'a data final é anterior à primeira reunião' }, { status: 400 })
    const serieId = uuid()
    const criadas: Reuniao[] = datas.map(d => ({
      ...base,
      id: uuid(),
      data: d.toISOString(),
      serieId,
      // As pautas nascem iguais em todas as ocorrências, mas com ids próprios:
      // marcar "feita" numa semana não pode riscar a mesma linha nas outras.
      ...(pautas.length ? { pautas: pautas.map(pt => ({ ...pt, id: uuid() })) } : {}),
    }))
    await Promise.all(criadas.map(r => redis.set(`reuniao:${r.id}`, r)))
    await Promise.all(criadas.map(r => redis.sadd('reunioes', r.id)))
    return NextResponse.json({ ok: true, reuniao: criadas[0], criadas: criadas.length, serieId })
  }

  const r: Reuniao = { ...base, id: uuid(), data }
  await redis.set(`reuniao:${r.id}`, r)
  await redis.sadd('reunioes', r.id)
  return NextResponse.json({ ok: true, reuniao: r, criadas: 1 })
}

export async function PUT(req: NextRequest) {
  const s = await sessao(true)
  if (!s) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const b = await req.json()
  const r = await redis.get<Reuniao>(`reuniao:${b.id}`)
  if (!r) return NextResponse.json({ error: 'não encontrada' }, { status: 404 })

  const atualizada: Reuniao = { ...r, atualizadoEm: new Date().toISOString() }
  for (const c of ['titulo', 'data', 'participantes', 'pauta', 'ata', 'status', 'decisoes', 'area', 'pautas'] as const) {
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
  const { id, serie } = await req.json()
  const alvo = await redis.get<Reuniao>(`reuniao:${id}`)

  // "Excluir a série" apaga esta e as SEGUINTES, nunca as passadas: reunião que
  // já aconteceu tem ata e decisões — apagá-la seria apagar o registro do que a
  // empresa combinou.
  if (serie && alvo?.serieId) {
    const ids = await redis.smembers('reunioes')
    const todas = ids.length ? ((await redis.mget<(Reuniao | null)[]>(...ids.map(i => `reuniao:${i}`))).filter(Boolean) as Reuniao[]) : []
    const daSerie = todas.filter(r => r.serieId === alvo.serieId && new Date(r.data).getTime() >= new Date(alvo.data).getTime())
    await Promise.all(daSerie.map(r => redis.del(`reuniao:${r.id}`)))
    await Promise.all(daSerie.map(r => redis.srem('reunioes', r.id)))
    return NextResponse.json({ ok: true, excluidas: daSerie.length })
  }

  await redis.del(`reuniao:${id}`)
  await redis.srem('reunioes', id)
  return NextResponse.json({ ok: true, excluidas: 1 })
}
