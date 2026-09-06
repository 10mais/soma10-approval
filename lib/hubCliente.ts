// HUB DO CLIENTE — "clico no cliente e vejo tudo o que está atribuído a ele"
// (pedido do dono, 06/09). Esta lib só RESUME: recebe posts, tarefas, etapas do
// Playbook e planos do Studio já filtrados pelo cliente e devolve os números e
// as listas curtas que a página inicial do hub mostra. Puro, sem rede.

import { esperandoCliente } from './bolaDaVez'
import { tituloDoPost, type PostRel, type TarefaRel, type MarcoRel, type ItemRel } from './relatorioSemana'

export type PlanoHub = { id: string; mes: number; ano: number; titulo?: string }

export type ResumoCliente = {
  posts: {
    aguardandoCliente: number
    emProducao: number
    prontos: number
    publicadosMes: number
    proximasPublicacoes: ItemRel[] // próximos 7 dias, em ordem
    aguardando: ItemRel[] // os mais antigos primeiro
  }
  tarefas: {
    abertas: number
    atrasadas: number
    lista: ItemRel[] // abertas, atrasadas primeiro, depois por prazo
  }
  playbook: {
    total: number
    concluidas: number
    emAndamento: MarcoRel[]
    atrasadas: number
  }
  studio: {
    planoDoMes?: PlanoHub
    pautasDoMes: number
    porEtapa: Record<string, number>
  }
}

const DIA = 86400000
const EM_PRODUCAO = ['briefing', 'copy', 'criativo']
const TAREFA_ABERTA = ['a_fazer', 'em_andamento', 'em_revisao']
const ETAPA_LABEL: Record<string, string> = { briefing: 'Briefing', copy: 'Copy', aprovacao_copy: 'Copy em aprovação', criativo: 'Criativo', aprovacao_criativo: 'Criativo em aprovação', pronto: 'Pronto' }

const ms = (iso?: string) => { const n = iso ? new Date(iso).getTime() : NaN; return Number.isFinite(n) ? n : undefined }

export function resumoDoCliente(input: {
  posts?: (PostRel & { planoId?: string })[]
  tarefas?: TarefaRel[]
  marcos?: MarcoRel[]
  planos?: PlanoHub[]
  agora?: number
}): ResumoCliente {
  const agora = input.agora ?? Date.now()
  const hoje = new Date(agora)
  const posts = (input.posts || []).filter(p => !p.excluidoEm)
  const tarefas = input.tarefas || []
  const marcos = input.marcos || []
  const planos = input.planos || []

  // ---- posts
  const aguardandoLista = posts.filter(p => esperandoCliente(p))
    .map(p => ({ id: p.id, titulo: tituloDoPost(p), tipo: 'post' as const, quando: p.aguardandoDesde || p.atualizadoEm, detalhe: ETAPA_LABEL[p.etapa || ''] || 'Aguardando aprovação' }))
    .sort((a, b) => (ms(a.quando) || 0) - (ms(b.quando) || 0))
  const publicadosMes = posts.filter(p => {
    if (p.status !== 'publicado') return false
    const d = new Date(p.dataAgendada || p.atualizadoEm || p.criadoEm || 0)
    return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear()
  }).length
  const proximas = posts
    .filter(p => p.status !== 'publicado' && (p.status === 'agendado' || p.etapa === 'pronto'))
    .filter(p => { const n = ms(p.dataAgendada); return n !== undefined && n >= agora - 3600000 && n <= agora + 7 * DIA })
    .map(p => ({ id: p.id, titulo: tituloDoPost(p), tipo: 'post' as const, quando: p.dataAgendada, detalhe: p.status === 'agendado' ? 'Programado' : 'Pronto, sem horário confirmado' }))
    .sort((a, b) => (ms(a.quando) || 0) - (ms(b.quando) || 0))

  // ---- tarefas
  const abertas = tarefas.filter(t => TAREFA_ABERTA.includes(t.status))
  const atrasada = (t: TarefaRel) => { const n = ms(t.prazo); return n !== undefined && n < agora - DIA + 1 }
  const lista = abertas
    .map(t => ({ id: t.id, titulo: t.titulo || 'Tarefa sem título', tipo: 'tarefa' as const, quando: t.prazo, detalhe: [t.responsavelNome, atrasada(t) ? 'atrasada' : ''].filter(Boolean).join(' · ') || undefined }))
    .sort((a, b) => {
      const ta = tarefas.find(t => t.id === a.id)!, tb = tarefas.find(t => t.id === b.id)!
      const aa = atrasada(ta) ? 0 : 1, ab = atrasada(tb) ? 0 : 1
      if (aa !== ab) return aa - ab
      return (ms(a.quando) ?? Infinity) - (ms(b.quando) ?? Infinity)
    })

  // ---- playbook
  const emAndamento = marcos.filter(m => m.status === 'em_andamento')
  const atrasadasPb = marcos.filter(m => m.status !== 'concluido' && m.status !== 'cancelado' && ms(m.dataFim) !== undefined && ms(m.dataFim)! < agora).length

  // ---- studio
  const planoDoMes = planos.find(p => p.mes === hoje.getMonth() + 1 && p.ano === hoje.getFullYear())
  const pautas = planoDoMes ? posts.filter(p => p.planoId === planoDoMes.id) : []
  const porEtapa: Record<string, number> = {}
  for (const p of pautas) { const e = p.etapa || 'sem_etapa'; porEtapa[e] = (porEtapa[e] || 0) + 1 }

  return {
    posts: {
      aguardandoCliente: aguardandoLista.length,
      emProducao: posts.filter(p => p.etapa && EM_PRODUCAO.includes(p.etapa)).length,
      prontos: posts.filter(p => p.etapa === 'pronto' && p.status !== 'publicado').length,
      publicadosMes,
      proximasPublicacoes: proximas,
      aguardando: aguardandoLista,
    },
    tarefas: { abertas: abertas.length, atrasadas: abertas.filter(atrasada).length, lista },
    playbook: { total: marcos.length, concluidas: marcos.filter(m => m.status === 'concluido').length, emAndamento, atrasadas: atrasadasPb },
    studio: { planoDoMes, pautasDoMes: pautas.length, porEtapa },
  }
}
