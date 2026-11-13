import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Tarefa, Usuario } from '@/lib/redis'
import { getPerfilInstancia } from '@/lib/perfisInstancia'
import { chaveMsgsWa, chaveConversaWa, chaveConversasSetWa, type WaConversa } from '@/lib/whatsapp'
import { normalizaMeta, type MetaAno } from '@/lib/metas'
import { normalizaMetasSemana, TIPOS_TAREFA_FOLLOWUP, type MensagemEnviada, type TarefaP, type MetasSemana } from '@/lib/painelClinica'

export const runtime = 'nodejs'

// PAINEL DA CLÍNICA (CRM › Painel) — plano aprovado pelo dono em 13/11/2026.
//
// Esta rota entrega SÓ o que a tela do CRM ainda não tem: quem mandou mensagem
// no período, quando foi a última conversa de cada pessoa, as tarefas de
// follow-up, a equipe e as metas. As contas (lib/painelClinica) rodam na TELA,
// no fuso de quem olha, como o resto do CRM: o servidor da Vercel roda em UTC
// e a semana de Brasília começa 3 horas depois — calcular aqui erraria a ponta.
//
// O período chega pronto da tela (`de` e `ate` em ISO). Nada de texto de
// mensagem sai daqui: só telefone, hora e autor.

async function porSet<T>(set: string, prefixo: string): Promise<T[]> {
  const ids = await redis.smembers(set)
  const saida: T[] = []
  for (let i = 0; i < ids.length; i += 500) {
    const lote = ids.slice(i, i + 500)
    const regs = await redis.mget<(T | null)[]>(...lote.map(id => `${prefixo}${id}`))
    for (const r of regs) if (r) saida.push(r)
  }
  return saida
}

const instante = (s: string | null) => { const t = s ? new Date(s).getTime() : NaN; return Number.isFinite(t) ? t : NaN }
const lerMsg = (m: unknown): { de?: string; em?: string; autor?: string } | null => {
  try { const o = typeof m === 'string' ? JSON.parse(m) : m; return o && typeof o === 'object' ? (o as any) : null } catch { return null }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if ((await getPerfilInstancia()) !== 'clinica') return NextResponse.json({ error: 'o painel da semana é do perfil clínica' }, { status: 404 })

  const de = instante(req.nextUrl.searchParams.get('de'))
  const ate = instante(req.nextUrl.searchParams.get('ate'))
  // Até 62 dias: semana ou mês. Período maior vira varredura de histórico inteiro.
  if (!Number.isFinite(de) || !Number.isFinite(ate) || ate < de || ate - de > 62 * 86400000) {
    return NextResponse.json({ error: 'período inválido' }, { status: 400 })
  }

  // ── WhatsApp: última conversa de cada telefone/contato + mensagens enviadas no período
  const tels = await redis.smembers(chaveConversasSetWa())
  const conversas: (WaConversa | null)[] = []
  for (let i = 0; i < tels.length; i += 500) {
    const lote = tels.slice(i, i + 500)
    conversas.push(...(await redis.mget<(WaConversa | null)[]>(...lote.map(t => chaveConversaWa(t)))))
  }
  const ultimaMsgPorTel: Record<string, string> = {}
  const ultimaMsgPorContato: Record<string, string> = {}
  const ativas: string[] = []
  tels.forEach((tel, i) => {
    const c = conversas[i]
    const ultima = c?.ultimaEm || ''
    if (ultima) {
      ultimaMsgPorTel[tel] = ultima
      if (c?.contatoId && (!ultimaMsgPorContato[c.contatoId] || ultima > ultimaMsgPorContato[c.contatoId])) ultimaMsgPorContato[c.contatoId] = ultima
    }
    // Conversa sem mensagem desde o início do período não tem o que contar.
    if (!c?.grupo && (!ultima || instante(ultima) >= de)) ativas.push(tel)
  })
  const mensagens: MensagemEnviada[] = []
  await Promise.all(ativas.map(async tel => {
    // A lista cresce no fim (rpush): lê de trás para a frente, em blocos, até
    // passar do início do período.
    for (let fim = -1, bloco = 0; bloco < 6; bloco++, fim -= 400) {
      const raw = await redis.lrange(chaveMsgsWa(tel), fim - 399, fim).catch(() => [] as unknown[])
      if (!raw.length) break
      let passou = false
      for (const r of raw) {
        const m = lerMsg(r)
        const t = instante(m?.em || null)
        if (!Number.isFinite(t)) continue
        if (t < de) { passou = true; continue }
        if (t <= ate && m?.de === 'agente') mensagens.push({ tel, em: m.em!, ...(m.autor ? { autor: String(m.autor) } : {}) })
      }
      if (passou || raw.length < 400) break
    }
  }))

  // ── Tarefas de follow-up: abertas (para os atrasados) e concluídas no período
  const tarefas: TarefaP[] = (await porSet<Tarefa>('tarefas', 'tarefa:'))
    .filter(t => TIPOS_TAREFA_FOLLOWUP.includes(String(t.tipo || '')))
    .filter(t => (t.status !== 'concluido' && t.status !== 'descartado') || (t.status === 'concluido' && instante(t.concluidoEm || null) >= de))
    .map(t => ({ id: t.id, tipo: t.tipo, status: t.status, responsavelEmail: t.responsavelEmail, responsavelNome: t.responsavelNome, prazo: t.prazo, concluidoEm: t.concluidoEm }))

  // ── Equipe (nome, e-mail e papel — nada de senha) e metas
  const equipe = (await porSet<Usuario>('usuarios', 'usuario:'))
    .filter(u => u?.email && u.role !== 'cliente')
    .map(u => ({ email: u.email, nome: u.nome, role: u.role }))
  const anos = Array.from(new Set([new Date(de).getFullYear(), new Date(ate).getFullYear()]))
  const metasAno: MetaAno[] = await Promise.all(anos.map(async ano => normalizaMeta(await redis.get<MetaAno>(`meta:${ano}`).catch(() => null), ano)))
  const metasSemana = normalizaMetasSemana(await redis.get<MetasSemana>('meta:semana-clinica').catch(() => null))

  return NextResponse.json({ mensagens, ultimaMsgPorTel, ultimaMsgPorContato, tarefas, equipe, metasAno, metasSemana })
}
