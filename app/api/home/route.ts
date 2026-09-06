import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Post, Tarefa, Cliente, Reuniao, Usuario } from '@/lib/redis'
import { clientesAtivosIds } from '@/lib/cache'
import { listarLogsCliente } from '@/lib/logCliente'
import { montarContexto, reguaDoDia, type PostLite } from '@/lib/contextoPessoa'
import { montarManchete } from '@/lib/manchete'
import { calcularBola, fraseDaBola } from '@/lib/bolaDaVez'
import { eventosDeHoje, agendaConfigurada } from '@/lib/googleCalendar'
import { normalizarConfig, regraDoDia } from '@/lib/regrasDoMes'

export const runtime = 'nodejs'

// A Home nova em UMA chamada. Tudo SÓ LEITURA; nada aqui grava.
//
// A resposta é PESSOAL: a manchete e a fila são de quem está logado. "Ver como"
// (?como=email) existe só para ADMIN — gestor e demais papéis veem o próprio
// perfil, sempre (decisão do dono, 04/09).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const su = session?.user as any
  if (!session || !su || su.role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const agora = Date.now()
  const ehAdmin = su.role === 'admin'
  const fresh = req.nextUrl.searchParams.get('fresh') === '1'

  // Quem é a pessoa da Home: o logado, ou (admin) quem ele escolheu ver.
  let pessoa = { nome: String(su.name || ''), email: String(su.email || '') }
  let vendoComo: { nome: string; email: string } | null = null
  const como = (req.nextUrl.searchParams.get('como') || '').trim().toLowerCase()
  if (como && ehAdmin && como !== pessoa.email.toLowerCase()) {
    const u = await redis.get<Usuario>(`usuario:${como}`).catch(() => null)
    if (u && u.role !== 'cliente') { pessoa = { nome: u.nome || como, email: como }; vendoComo = pessoa }
  }

  // CACHE por pessoa (60s). A Home remonta a cada volta ao Painel e refazia a
  // varredura inteira de posts/tarefas/reuniões — 8 chamadas em 55s nos logs
  // de 06/09. Um minuto de cache elimina isso; quem aprovar/mover algo vê o
  // reflexo no próximo minuto, ou na hora com ?fresh=1.
  const chaveCache = `home:cache:${pessoa.email.toLowerCase()}:${vendoComo ? vendoComo.email : ''}`
  if (!fresh) {
    const emCache = await redis.get<any>(chaveCache).catch(() => null)
    if (emCache && emCache.geradoEm && agora - emCache.geradoEm < 60000) {
      return NextResponse.json(emCache, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=120', 'X-Home-Cache': 'hit' } })
    }
  }

  // Coleções — carregadas uma vez e fatiadas em memória (mesma estratégia das
  // telas de Tarefas/Planner; a Home é lida no início do dia, não a cada tecla).
  const [idsPosts, idsTarefas, idsReunioes, ativos] = await Promise.all([
    redis.smembers('posts').catch(() => [] as string[]),
    redis.smembers('tarefas').catch(() => [] as string[]),
    redis.smembers('reunioes').catch(() => [] as string[]),
    clientesAtivosIds().catch(() => null as Set<string> | null),
  ])
  const [posts, tarefas, reunioes] = await Promise.all([
    idsPosts.length ? redis.mget<(Post | null)[]>(...idsPosts.map(i => `post:${i}`)) : Promise.resolve([] as (Post | null)[]),
    idsTarefas.length ? redis.mget<(Tarefa | null)[]>(...idsTarefas.map(i => `tarefa:${i}`)) : Promise.resolve([] as (Tarefa | null)[]),
    idsReunioes.length ? redis.mget<(Reuniao | null)[]>(...idsReunioes.map(i => `reuniao:${i}`)) : Promise.resolve([] as (Reuniao | null)[]),
  ])
  // Cliente arquivado some da Home inteira (regra do arquivamento: raiz escondida).
  const vivo = (cid?: string) => !ativos || !cid || ativos.has(cid)
  const P = (posts.filter(Boolean) as Post[]).filter(p => vivo(p.clienteId)) as unknown as PostLite[]
  const T = (tarefas.filter(Boolean) as Tarefa[]).filter(t => vivo(t.clienteId))
  const R = (reunioes.filter(Boolean) as Reuniao[]).map(r => ({ id: r.id, titulo: r.titulo, data: r.data, participantes: r.participantes, area: r.area }))

  // 1) Manchete pessoal
  const contexto = montarContexto(pessoa, P, T as any, R, agora)
  const manchete = montarManchete(contexto, agora)

  // 2) Régua do dia: posts + reuniões + Google Agenda (quando configurada)
  const agenda = await eventosDeHoje(agora)
  const regua = reguaDoDia(P, R, agenda.eventos, agora)

  // 3) Clientes com a bola — ordenados por quem espera há mais tempo
  const idsCli = ativos ? Array.from(ativos) : await redis.smembers('clientes').catch(() => [] as string[])
  const clientes = idsCli.length ? ((await redis.mget<(Cliente | null)[]>(...idsCli.map(i => `cliente:${i}`))).filter(Boolean) as Cliente[]) : []
  const cartoes = clientes
    .filter(c => !c.arquivado && (c as any).tipo !== 'interno')
    .map(c => {
      const b = calcularBola(P.filter(p => p.clienteId === c.id) as any, T.filter(t => t.clienteId === c.id) as any, agora)
      return {
        id: c.id, nome: c.nome, logo: c.logo, cor: (c as any).corPrimaria,
        lado: b.lado, frase: fraseDaBola(b, false), diasParado: b.diasParado,
        totalCliente: b.totalCliente, totalAgencia: b.totalAgencia,
        primeiro: b.itens[0]?.titulo,
      }
    })
    .sort((a, b) => {
      const peso = (x: typeof a) => x.lado === 'cliente' ? 2 : x.lado === 'agencia' ? 1 : 0
      return (peso(b) - peso(a)) || ((b.diasParado || 0) - (a.diasParado || 0)) || a.nome.localeCompare(b.nome, 'pt')
    })

  // 4) Fila da pessoa (abertas, mais urgente primeiro)
  const abertas = ['a_fazer', 'em_andamento', 'em_revisao']
  const fila = T
    .filter(t => (t.responsavelEmail || '').toLowerCase() === pessoa.email.toLowerCase() && abertas.includes(t.status))
    .map(t => ({ id: t.id, titulo: t.titulo, tipo: t.tipo, status: t.status, prazo: t.prazo, clienteNome: t.clienteNome, anexos: (t.anexos || []).length }))
    .sort((a, b) => (a.prazo ? new Date(a.prazo).getTime() : Infinity) - (b.prazo ? new Date(b.prazo).getTime() : Infinity))
    .slice(0, 8)

  // 5) Chegou do cliente — últimas 24h
  const logs = (await listarLogsCliente({ limite: 40 }).catch(() => []))
    .filter(l => agora - l.ts < 24 * 3600000 && vivo(l.clienteId))
    .slice(0, 6)
    .map(l => ({ id: l.id, ts: l.ts, clienteId: l.clienteId, clienteNome: l.clienteNome, tipo: l.tipo, acao: l.acao, resumo: l.resumo, postId: l.postId }))

  // 6) Regra do mês (config editável; sem cadastro = null)
  const cfgRegras = normalizarConfig(await redis.get('config:regrasDoMes').catch(() => null))
  const regra = regraDoDia(cfgRegras, agora)

  // Lista de pessoas para o "Ver como" — só o admin recebe.
  let equipe: { nome: string; email: string }[] = []
  if (ehAdmin) {
    const idsU = await redis.smembers('usuarios').catch(() => [] as string[])
    const us = idsU.length ? ((await redis.mget<(Usuario | null)[]>(...idsU.map(e => `usuario:${e}`))).filter(Boolean) as Usuario[]) : []
    equipe = us.filter(u => u.role !== 'cliente' && u.email).map(u => ({ nome: u.nome || u.email, email: u.email })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
  }

  const payload = {
    pessoa, vendoComo, ehAdmin, equipe,
    manchete, regra,
    regua, agenda: { configurada: agendaConfigurada(), erro: agenda.erro },
    clientes: cartoes, fila, chegou: logs,
    geradoEm: agora,
  }
  // Grava o cache sem bloquear a resposta; TTL 90s (a checagem de 60s acima é a autoridade).
  redis.set(chaveCache, payload, { ex: 90 }).catch(() => {})
  return NextResponse.json(payload, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=120', 'X-Home-Cache': 'miss' } })
}
