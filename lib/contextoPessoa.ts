// Monta o CONTEXTO DE UMA PESSOA para a Home nova (manchete, fila, régua do dia).
//
// Recebe as coleções já carregadas (posts, tarefas, reuniões) e devolve só o
// que é DAQUELA pessoa. Puro: quem lê o Redis é a rota /api/home; aqui é
// filtragem e normalização, testável sem banco.
//
// Identidade cruza dois mundos: a tarefa guarda `responsavelEmail`; o post
// guarda `criadoPor` = NOME (session.user.name, app/api/posts/route.ts:139);
// a reunião guarda `participantes` como texto livre digitado. Por isso a pessoa
// aqui é { nome, email } e cada fonte casa pelo campo que tem.

import type { ContextoPessoa } from './manchete'

export type Pessoa = { nome: string; email: string }

export type PostLite = {
  id: string; clienteId?: string; clienteNome?: string
  briefing?: string; headline?: string; legenda?: string
  status?: string; etapa?: string; dataAgendada?: string
  aguardandoDesde?: string; atualizadoEm?: string; criadoPor?: string; excluidoEm?: string
}
export type TarefaLite = {
  id: string; titulo?: string; status?: string; prazo?: string; tipo?: string
  responsavelEmail?: string; clienteNome?: string; atualizadoEm?: string
}
export type ReuniaoLite = { id: string; titulo: string; data: string; participantes?: string; area?: string }

const ABERTA = ['a_fazer', 'em_andamento', 'em_revisao']
const ESPERANDO_CLIENTE_ETAPA = ['aprovacao_copy', 'aprovacao_criativo']
const VOLTOU = ['corrigir', 'reprovado']
const SAI_HOJE = ['agendado', 'publicando', 'publicado']

export function mesmoDia(iso: string | undefined, agora: number): boolean {
  if (!iso) return false
  const a = new Date(iso), b = new Date(agora)
  return !isNaN(a.getTime()) && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Nome dentro do texto livre de participantes ("Willian, Marco" / "Willian Pires e Marco").
// Compara sem acento e sem caixa; o PRIMEIRO nome basta quando o texto só tem ele.
function norm(s: string): string { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim() }
export function participa(participantes: string | undefined, nome: string): boolean {
  if (!participantes || !nome) return false
  const alvo = norm(nome), texto = norm(participantes)
  if (texto.includes(alvo)) return true
  const primeiro = alvo.split(/\s+/)[0]
  return primeiro.length >= 3 && new RegExp(`(^|[^a-z])${primeiro}([^a-z]|$)`).test(texto)
}

export function hora(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const titulo = (p: PostLite) => (p.briefing || p.headline || p.legenda || '').replace(/\s+/g, ' ').trim().slice(0, 70)

export function montarContexto(
  pessoa: Pessoa,
  posts: PostLite[],
  tarefas: TarefaLite[],
  reunioes: ReuniaoLite[],
  agora: number = Date.now(),
): ContextoPessoa {
  const email = norm(pessoa.email), nome = norm(pessoa.nome)
  const minhasTarefas = tarefas.filter(t => norm(t.responsavelEmail || '') === email && ABERTA.includes(t.status || ''))
  const meusPosts = posts.filter(p => !p.excluidoEm && norm(p.criadoPor || '') === nome)

  return {
    nome: pessoa.nome,
    tarefas: minhasTarefas.map(t => ({ titulo: t.titulo, prazo: t.prazo, status: t.status })),
    aprovacoes: meusPosts
      .filter(p => !VOLTOU.includes(p.status || '') && (p.status === 'aguardando_aprovacao' || ESPERANDO_CLIENTE_ETAPA.includes(p.etapa || '')))
      .map(p => ({ titulo: titulo(p), clienteNome: p.clienteNome, desde: p.aguardandoDesde || p.atualizadoEm })),
    ajustes: meusPosts.filter(p => VOLTOU.includes(p.status || '')).map(p => ({ titulo: titulo(p), clienteNome: p.clienteNome })),
    publicaHoje: meusPosts.filter(p => SAI_HOJE.includes(p.status || '') && mesmoDia(p.dataAgendada, agora)).length,
    reunioes: reunioes
      .filter(r => mesmoDia(r.data, agora) && participa(r.participantes, pessoa.nome))
      .map(r => ({ hora: hora(r.data), titulo: r.titulo })),
  }
}

// ---- Régua do dia: tudo que acontece HOJE, de todo mundo, numa linha só ----
export type EventoDia = {
  id: string
  hora: string            // "HH:MM"
  minuto: number          // minutos desde 00:00 (posição na régua)
  tipo: 'post' | 'reuniao' | 'agenda'
  titulo: string
  detalhe?: string
  feito?: boolean         // já saiu / já passou
  clienteNome?: string
}

export function reguaDoDia(
  posts: PostLite[],
  reunioes: ReuniaoLite[],
  eventosAgenda: { id: string; titulo: string; inicio: string; fim?: string; calendario?: string }[],
  agora: number = Date.now(),
): EventoDia[] {
  const min = (iso: string) => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes() }
  const saida: EventoDia[] = []

  for (const p of posts) {
    if (p.excluidoEm || !SAI_HOJE.includes(p.status || '') || !mesmoDia(p.dataAgendada, agora)) continue
    saida.push({
      id: `post:${p.id}`, hora: hora(p.dataAgendada!), minuto: min(p.dataAgendada!), tipo: 'post',
      titulo: p.clienteNome || 'Publicação', detalhe: titulo(p) || undefined,
      feito: p.status === 'publicado', clienteNome: p.clienteNome,
    })
  }
  for (const r of reunioes) {
    if (!mesmoDia(r.data, agora)) continue
    saida.push({ id: `reuniao:${r.id}`, hora: hora(r.data), minuto: min(r.data), tipo: 'reuniao', titulo: r.titulo, detalhe: r.participantes || r.area, feito: new Date(r.data).getTime() < agora - 60 * 60000 })
  }
  for (const e of eventosAgenda) {
    if (!mesmoDia(e.inicio, agora)) continue
    saida.push({ id: `agenda:${e.id}`, hora: hora(e.inicio), minuto: min(e.inicio), tipo: 'agenda', titulo: e.titulo, detalhe: e.calendario, feito: !!e.fim && new Date(e.fim).getTime() < agora })
  }
  return saida.sort((a, b) => a.minuto - b.minuto)
}
