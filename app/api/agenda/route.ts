import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Agendamento, CrmContato } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { acharConflito, acharContatoPorNome } from '@/lib/agenda'
import { getPerfilInstancia } from '@/lib/perfisInstancia'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// Módulo Agenda (clínicas/serviços): CRUD de agendamentos com detecção de
// conflito de horário por profissional. Equipe apenas (cliente não acessa).
// Perfil clínica: todo paciente agendado vira/liga a um contato (cadastro).

async function carregarTodos(): Promise<Agendamento[]> {
  const ids = await redis.smembers('agendamentos')
  if (!ids.length) return []
  const regs = await redis.mget<(Agendamento | null)[]>(...ids.map(id => `agendamento:${id}`))
  return regs.filter(Boolean) as Agendamento[]
}

async function carregarContatos(): Promise<CrmContato[]> {
  const ids = await redis.smembers('crm:contatos')
  if (!ids.length) return []
  return (await redis.mget<(CrmContato | null)[]>(...ids.map(i => `contato:${i}`))).filter(Boolean) as CrmContato[]
}

// Toque na base: agendar/atender conta como "último contato" (nutrição/reabordagem).
async function carimbarUltimoContato(contatoId?: string): Promise<void> {
  if (!contatoId) return
  const c = await redis.get<CrmContato>(`contato:${contatoId}`)
  if (c) await redis.set(`contato:${contatoId}`, { ...c, ultimoContato: new Date().toISOString() })
}

// No perfil clínica, amarra o agendamento a um contato: casa pelo nome (normalizado)
// ou cria um paciente novo com nome/telefone. Fora do perfil, só respeita contatoId explícito.
async function vincularContato(ag: Agendamento, contatoIdExplicito: string | undefined, autor: string): Promise<void> {
  if (contatoIdExplicito) { ag.contatoId = String(contatoIdExplicito); return }
  if ((await getPerfilInstancia()) !== 'clinica') return
  const contatos = await carregarContatos()
  const match = acharContatoPorNome(contatos, ag.pacienteNome)
  if (match) {
    ag.contatoId = match.id
    if (!ag.pacienteTelefone && match.telefone) ag.pacienteTelefone = match.telefone
    return
  }
  const agora = new Date().toISOString()
  const contato: CrmContato = { id: uuid(), nome: ag.pacienteNome, telefone: ag.pacienteTelefone || '', tipo: 'paciente', criadoPor: autor, criadoEm: agora, atualizadoEm: agora }
  await redis.set(`contato:${contato.id}`, contato)
  await redis.sadd('crm:contatos', contato.id)
  ag.contatoId = contato.id
}

// GET ?de=ISO&ate=ISO — lista agendamentos do período (padrão: semana atual).
// GET ?contatoId=x — histórico completo do paciente (mais recentes primeiro).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const url = new URL(req.url)
  const contatoId = url.searchParams.get('contatoId')
  if (contatoId) {
    const doContato = (await carregarTodos())
      .filter(a => a.contatoId === contatoId)
      .sort((a, b) => new Date(b.dataInicio).getTime() - new Date(a.dataInicio).getTime())
    return NextResponse.json({ agendamentos: doContato })
  }

  const de = url.searchParams.get('de')
  const ate = url.searchParams.get('ate')
  const todos = await carregarTodos()
  const tDe = de ? new Date(de).getTime() : -Infinity
  const tAte = ate ? new Date(ate).getTime() : Infinity
  const lista = todos
    .filter(a => { const t = new Date(a.dataInicio).getTime(); return !isNaN(t) && t >= tDe && t <= tAte })
    .sort((a, b) => new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime())
  // Serviços já usados (datalist do form — sem cadastro burocrático de catálogo).
  const servicos = Array.from(new Set(todos.map(a => (a.servico || '').trim()).filter(Boolean))).sort()
  return NextResponse.json({ agendamentos: lista, servicos })
}

// POST — cria. Recusa conflito de horário do profissional (409) a menos que
// venha { forcar: true } (encaixe consciente).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel(role, 'producao', 'editar', (session!.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }

  const b = await req.json()
  const pacienteNome = (b.pacienteNome || '').toString().trim()
  const dataInicio = (b.dataInicio || '').toString()
  const profissionalEmail = (b.profissionalEmail || '').toString().trim()
  if (!pacienteNome || !dataInicio || !profissionalEmail || isNaN(new Date(dataInicio).getTime())) {
    return NextResponse.json({ error: 'nome do paciente, profissional e data/hora são obrigatórios' }, { status: 400 })
  }

  const novo: Agendamento = {
    id: uuid(),
    pacienteNome: pacienteNome.slice(0, 120),
    pacienteTelefone: (b.pacienteTelefone || '').toString().slice(0, 30) || undefined,
    profissionalEmail,
    profissionalNome: (b.profissionalNome || profissionalEmail).toString().slice(0, 80),
    servico: (b.servico || '').toString().slice(0, 80) || undefined,
    dataInicio,
    duracaoMin: Math.min(600, Math.max(5, Number(b.duracaoMin) || 30)),
    status: 'agendado',
    observacoes: (b.observacoes || '').toString().slice(0, 800) || undefined,
    queixaPrincipal: (b.queixaPrincipal || '').toString().slice(0, 400) || undefined,
    criadoEm: new Date().toISOString(),
    criadoPor: session.user?.name || session.user?.email || undefined,
  }

  if (!b.forcar) {
    const conflito = acharConflito(novo, await carregarTodos())
    if (conflito) {
      return NextResponse.json({
        error: `Conflito: ${conflito.profissionalNome} já tem "${conflito.pacienteNome}" às ${new Date(conflito.dataInicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`,
        conflito: true,
      }, { status: 409 })
    }
  }

  await vincularContato(novo, b.contatoId, session.user?.name || session.user?.email || '')
  await carimbarUltimoContato(novo.contatoId)
  await redis.set(`agendamento:${novo.id}`, novo)
  await redis.sadd('agendamentos', novo.id)
  return NextResponse.json({ ok: true, agendamento: novo })
}

// PUT { id, ...campos } — edita/muda status. Mesma checagem de conflito ao mover.
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel(role, 'producao', 'editar', (session!.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }

  const b = await req.json()
  const atual = await redis.get<Agendamento>(`agendamento:${b.id}`)
  if (!atual) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

  const campos = ['pacienteNome', 'pacienteTelefone', 'contatoId', 'profissionalEmail', 'profissionalNome', 'servico', 'dataInicio', 'duracaoMin', 'status', 'observacoes', 'queixaPrincipal', 'registroAtendimento']
  const atualizado: Agendamento = { ...atual }
  for (const c of campos) { if (c in b) (atualizado as any)[c] = b[c] }
  atualizado.duracaoMin = Math.min(600, Math.max(5, Number(atualizado.duracaoMin) || 30))
  if (isNaN(new Date(atualizado.dataInicio).getTime())) return NextResponse.json({ error: 'data inválida' }, { status: 400 })
  // Renomeou o paciente sem apontar contato? Refaz o vínculo (casa ou cria cadastro).
  if (!atualizado.contatoId || (b.pacienteNome && b.pacienteNome !== atual.pacienteNome && !('contatoId' in b))) {
    atualizado.contatoId = undefined
    await vincularContato(atualizado, undefined, session.user?.name || session.user?.email || '')
  }

  const mudouHorario = atualizado.dataInicio !== atual.dataInicio || atualizado.duracaoMin !== atual.duracaoMin || atualizado.profissionalEmail !== atual.profissionalEmail
  if (mudouHorario && !b.forcar) {
    const conflito = acharConflito(atualizado, await carregarTodos())
    if (conflito) {
      return NextResponse.json({
        error: `Conflito: ${conflito.profissionalNome} já tem "${conflito.pacienteNome}" nesse horário.`,
        conflito: true,
      }, { status: 409 })
    }
  }

  // Atendeu = virou PACIENTE: promove o contato (lead) automaticamente — regra do
  // dono: "pacientes são quem já fizeram procedimentos conosco".
  if (atualizado.status === 'atendido' && atual.status !== 'atendido' && atualizado.contatoId) {
    const contato = await redis.get<CrmContato>(`contato:${atualizado.contatoId}`)
    if (contato) {
      await redis.set(`contato:${contato.id}`, { ...contato, ...(contato.tipo !== 'paciente' ? { tipo: 'paciente' } : {}), ultimoContato: new Date().toISOString(), atualizadoEm: new Date().toISOString() })
    }
  }

  await redis.set(`agendamento:${atualizado.id}`, atualizado)
  return NextResponse.json({ ok: true, agendamento: atualizado })
}

// DELETE { id } — remove de vez (para engano de digitação; o fluxo normal é status 'cancelado').
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel(role, 'producao', 'excluir', (session!.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const { id } = await req.json()
  await redis.del(`agendamento:${id}`)
  await redis.srem('agendamentos', id)
  return NextResponse.json({ ok: true })
}
