// PRÓXIMAS TAREFAS da pessoa — a barra do topo (dono, 20/10/2026: "dentro do perfil de cada
// usuário precisa de uma barra flutuante no topo mostrando as suas próximas tarefas").
//
// Regra pura (testada em tests/proximasTarefas.test.ts): o que está ABERTO e é DA pessoa, o mais
// urgente primeiro. Subtarefa conta igual — a pauta do Estúdio vira subtarefa do designer — e
// leva o título da tarefa-mãe como contexto. Em julho a pauta foi subtarefa e sumiu do quadro
// (o kanban escondia subtarefas): "a copy aprovada não chegava na produção". Aqui ela aparece.
//
// O dia é o de Brasília (lib/datas): a rota roda no servidor, em UTC.
import { diaDoInstante, somarDias } from './datas'

export type QuandoPrazo = 'atrasada' | 'hoje' | 'amanha' | 'semana' | 'depois' | 'sem_prazo'

export const STATUS_ABERTOS = ['a_fazer', 'em_andamento', 'em_revisao']

export type TarefaParaBarra = {
  id: string; titulo?: string; status?: string; prioridade?: string; tipo?: string
  prazo?: string; dataInicio?: string; responsavelEmail?: string; clienteNome?: string
  tarefaPaiId?: string; excluidoEm?: string
}

export type ItemProximo = {
  id: string; titulo: string; status: string; tipo?: string
  prazo?: string; dataInicio?: string; clienteNome?: string
  maeTitulo?: string // subtarefa: de qual tarefa ela é (ex.: o plano do mês do cliente)
  quando: QuandoPrazo
}

export type ProximasDaPessoa = { itens: ItemProximo[]; total: number; atrasadas: number }

/** Em que faixa o prazo cai, contando dias de calendário em Brasília. */
export function quandoDoPrazo(prazo: string | undefined, hoje: string): QuandoPrazo {
  const dia = diaDoInstante(prazo)
  if (!dia) return 'sem_prazo'
  if (dia < hoje) return 'atrasada'
  if (dia === hoje) return 'hoje'
  if (dia === somarDias(hoje, 1)) return 'amanha'
  if (dia <= somarDias(hoje, 7)) return 'semana'
  return 'depois'
}

const ORDEM_QUANDO: Record<QuandoPrazo, number> = { atrasada: 0, hoje: 1, amanha: 2, semana: 3, depois: 4, sem_prazo: 5 }
const ORDEM_PRIORIDADE: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 }
const ms = (iso?: string) => { const n = iso ? new Date(iso).getTime() : NaN; return isNaN(n) ? Infinity : n }

/** As próximas tarefas abertas de `email`, a mais urgente primeiro (atrasadas antes de tudo). */
export function proximasDaPessoa(tarefas: TarefaParaBarra[], email: string, agora: number, limite = 5): ProximasDaPessoa {
  const eu = (email || '').trim().toLowerCase()
  if (!eu) return { itens: [], total: 0, atrasadas: 0 }
  const hoje = diaDoInstante(new Date(agora).toISOString())
  const porId = new Map(tarefas.map(t => [t.id, t]))
  const minhas = tarefas.filter(t => !t.excluidoEm
    && STATUS_ABERTOS.includes(t.status || '')
    && (t.responsavelEmail || '').trim().toLowerCase() === eu)

  const ordenadas = minhas
    .map(t => ({ t, quando: quandoDoPrazo(t.prazo, hoje) }))
    .sort((a, b) => (ORDEM_QUANDO[a.quando] - ORDEM_QUANDO[b.quando])
      || (ms(a.t.prazo) - ms(b.t.prazo))
      || ((ORDEM_PRIORIDADE[a.t.prioridade || 'media'] ?? 2) - (ORDEM_PRIORIDADE[b.t.prioridade || 'media'] ?? 2))
      || (a.t.titulo || '').localeCompare(b.t.titulo || '', 'pt-BR'))

  const itens: ItemProximo[] = ordenadas.slice(0, Math.max(0, limite)).map(({ t, quando }) => ({
    id: t.id,
    titulo: (t.titulo || '').trim() || 'Tarefa sem título',
    status: t.status || 'a_fazer',
    ...(t.tipo ? { tipo: t.tipo } : {}),
    ...(t.prazo ? { prazo: t.prazo } : {}),
    ...(t.dataInicio ? { dataInicio: t.dataInicio } : {}),
    ...(t.clienteNome ? { clienteNome: t.clienteNome } : {}),
    ...(t.tarefaPaiId && porId.get(t.tarefaPaiId)?.titulo ? { maeTitulo: porId.get(t.tarefaPaiId)!.titulo } : {}),
    quando,
  }))
  return { itens, total: ordenadas.length, atrasadas: ordenadas.filter(x => x.quando === 'atrasada').length }
}
