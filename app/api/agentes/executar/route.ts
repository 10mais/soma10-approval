import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente, Tarefa, Marco } from '@/lib/redis'
import { v4 as uuid } from 'uuid'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { ehAcao, resumoAcao } from '@/lib/assistenteTools'

export const runtime = 'nodejs'

// Executa uma AÇÃO proposta por um agente, APÓS o usuário confirmar. Respeita a
// permissão do usuário que confirma e registra tudo na auditoria (agente:acoes).

async function acharCliente(nome: string): Promise<Cliente | null> {
  if (!nome?.trim()) return null
  const ids = await redis.smembers('clientes')
  const cls = ids.length ? ((await redis.mget<(Cliente | null)[]>(...ids.map(i => `cliente:${i}`))).filter(Boolean) as Cliente[]) : []
  const alvo = nome.trim().toLowerCase()
  return cls.find(c => (c.nome || '').toLowerCase() === alvo) || cls.find(c => (c.nome || '').toLowerCase().includes(alvo)) || null
}

async function auditar(entry: any) {
  try { await redis.lpush('agente:acoes', JSON.stringify({ ...entry, quando: new Date().toISOString() })); await redis.ltrim('agente:acoes', 0, 199) } catch {}
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { acao, params, agenteId, agenteNome } = await req.json()
  if (!ehAcao(acao)) return NextResponse.json({ error: 'ação inválida' }, { status: 400 })
  const i = params || {}
  const autor = session.user?.name || ''
  const usuario = session.user?.email || ''
  const resumo = resumoAcao(acao, i)
  const nega = (grupo: string) => bloqueiaPapel(role, grupo as any, 'editar', (session.user as any).permissoes)

  if (acao === 'criar_tarefa') {
    if (await nega('producao')) return NextResponse.json({ error: 'sem permissão para criar tarefas' }, { status: 403 })
    if (!String(i.titulo || '').trim()) return NextResponse.json({ error: 'título obrigatório' }, { status: 400 })
    const cli = i.cliente ? await acharCliente(i.cliente) : null
    const agora = new Date().toISOString()
    const prazo = /^\d{4}-\d{2}-\d{2}$/.test(i.prazo || '') ? new Date(i.prazo + 'T23:59:59').toISOString() : ''
    const prioridade = ['baixa', 'media', 'alta', 'urgente'].includes(i.prioridade) ? i.prioridade : 'media'
    const tarefa: Tarefa = {
      id: uuid(), titulo: String(i.titulo).trim(), descricao: i.descricao || '', tipo: 'tarefa', status: 'a_fazer',
      prioridade, responsavelEmail: '', responsavelNome: '', clienteId: cli?.id || '', clienteNome: cli?.nome || '',
      marcoId: '', prazo, criadoPor: autor, criadoEm: agora, atualizadoEm: agora,
      atividades: [{ id: uuid(), tipo: 'criacao', descricao: `Criada pelo agente ${agenteNome || 'IA'} (confirmada por ${autor})`, autor, criadoEm: agora }],
      comentarios: [],
    }
    await redis.set(`tarefa:${tarefa.id}`, tarefa)
    await redis.sadd('tarefas', tarefa.id)
    await auditar({ usuario, agenteId, agenteNome, acao, resumo, ok: true, alvoId: tarefa.id })
    return NextResponse.json({ ok: true, resumo: `Tarefa "${tarefa.titulo}" criada${cli ? ` para ${cli.nome}` : ''}.`, id: tarefa.id })
  }

  if (acao === 'criar_marco') {
    if (await nega('estrategia')) return NextResponse.json({ error: 'sem permissão para criar etapas no Playbook' }, { status: 403 })
    if (!String(i.titulo || '').trim()) return NextResponse.json({ error: 'título obrigatório' }, { status: 400 })
    const cli = await acharCliente(i.cliente || '')
    if (!cli) return NextResponse.json({ error: `cliente "${i.cliente || ''}" não encontrado` }, { status: 400 })
    const agora = new Date().toISOString()
    const cats = ['social_media', 'trafego', 'branding', 'landing_page', 'estrategia', 'reuniao', 'entrega', 'outro']
    const marco: Marco = {
      id: uuid(), clienteId: cli.id, clienteNome: cli.nome, titulo: String(i.titulo).trim(), descricao: i.descricao || '',
      categoria: (cats.includes(i.categoria) ? i.categoria : 'outro') as any, status: 'planejado', dataInicio: agora,
      criadoPor: autor, criadoEm: agora, atualizadoEm: agora,
    }
    await redis.set(`marco:${marco.id}`, marco)
    await redis.sadd('marcos', marco.id)
    await auditar({ usuario, agenteId, agenteNome, acao, resumo, ok: true, alvoId: marco.id })
    return NextResponse.json({ ok: true, resumo: `Etapa "${marco.titulo}" criada no Playbook de ${cli.nome}.`, id: marco.id })
  }

  return NextResponse.json({ error: 'ação não suportada' }, { status: 400 })
}
