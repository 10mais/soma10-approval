import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { Pacote, PacoteSessao, podeConsumir } from '@/lib/pacotes'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// Pacotes de tratamento (venda de N sessões; cada atendimento consome uma).
// Equipe apenas; escrita exige permissão de CRM/editar (é venda).

async function autorizado() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}

async function carregarTodos(): Promise<Pacote[]> {
  const ids = await redis.smembers('pacotes')
  if (!ids.length) return []
  return (await redis.mget<(Pacote | null)[]>(...ids.map(i => `pacote:${i}`))).filter(Boolean) as Pacote[]
}

// GET ?contatoId= -> pacotes do paciente | sem parâmetro -> todos (mais novos primeiro)
export async function GET(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const contatoId = req.nextUrl.searchParams.get('contatoId')
  let lista = await carregarTodos()
  if (contatoId) lista = lista.filter(p => p.contatoId === contatoId)
  lista.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
  return NextResponse.json({ pacotes: lista })
}

export async function POST(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const b = await req.json()
  const contatoId = String(b.contatoId || '').trim()
  const titulo = String(b.titulo || '').trim()
  const totalSessoes = Math.max(1, Math.min(200, Number(b.totalSessoes) || 0))
  if (!contatoId) return NextResponse.json({ error: 'selecione o paciente' }, { status: 400 })
  if (!titulo) return NextResponse.json({ error: 'informe o título do pacote' }, { status: 400 })
  if (!Number(b.totalSessoes)) return NextResponse.json({ error: 'informe o número de sessões' }, { status: 400 })

  const agora = new Date().toISOString()
  const autor = session.user?.name || session.user?.email || ''
  const pacote: Pacote = {
    id: uuid(),
    contatoId,
    pacienteNome: String(b.pacienteNome || '').slice(0, 120),
    titulo: titulo.slice(0, 120),
    servico: (b.servico || '').toString().slice(0, 80) || undefined,
    totalSessoes,
    valor: Math.max(0, Number(b.valor) || 0),
    sessoes: [],
    vendidoPor: (b.vendidoPor || autor).toString().slice(0, 80) || undefined,
    criadoPor: autor,
    criadoEm: agora,
    atualizadoEm: agora,
  }
  await redis.set(`pacote:${pacote.id}`, pacote)
  await redis.sadd('pacotes', pacote.id)
  return NextResponse.json({ ok: true, pacote })
}

// PUT { id, ...ação } — consumir/desfazer sessão, cancelar, ou editar campos.
export async function PUT(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const b = await req.json()
  const pacote = await redis.get<Pacote>(`pacote:${b.id}`)
  if (!pacote) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  const autor = session.user?.name || session.user?.email || ''

  // Consumir uma sessão (registra um atendimento realizado)
  if (b.consumirSessao) {
    if (!podeConsumir(pacote)) return NextResponse.json({ error: 'pacote sem saldo ou cancelado' }, { status: 400 })
    const d = b.consumirSessao
    const sessao: PacoteSessao = {
      id: uuid(),
      data: d.data && !isNaN(new Date(d.data).getTime()) ? new Date(d.data).toISOString() : new Date().toISOString(),
      agendamentoId: d.agendamentoId || undefined,
      profissionalNome: (d.profissionalNome || '').toString().slice(0, 80) || undefined,
      nota: (d.nota || '').toString().slice(0, 400) || undefined,
      registradoPor: autor,
    }
    pacote.sessoes = [...(pacote.sessoes || []), sessao]
  } else if (b.removerSessao) {
    pacote.sessoes = (pacote.sessoes || []).filter(s => s.id !== b.removerSessao)
  } else if (b.cancelar !== undefined) {
    pacote.cancelado = !!b.cancelar
  } else {
    // Edição de campos do pacote
    if (b.titulo !== undefined) pacote.titulo = String(b.titulo).trim().slice(0, 120)
    if (b.servico !== undefined) pacote.servico = String(b.servico).slice(0, 80) || undefined
    if (b.valor !== undefined) pacote.valor = Math.max(0, Number(b.valor) || 0)
    if (b.totalSessoes !== undefined) pacote.totalSessoes = Math.max((pacote.sessoes || []).length, Math.min(200, Number(b.totalSessoes) || 1))
  }
  pacote.atualizadoEm = new Date().toISOString()
  await redis.set(`pacote:${pacote.id}`, pacote)
  return NextResponse.json({ ok: true, pacote })
}

export async function DELETE(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'excluir', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await redis.del(`pacote:${id}`)
  await redis.srem('pacotes', id)
  return NextResponse.json({ ok: true })
}
