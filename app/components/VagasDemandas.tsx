'use client'
// VAGAS do limitador de demandas (dono, 15/11/2026) — peças compartilhadas pelas telas: a barra do
// topo, Tarefas, a Fila de produção e o Estúdio. Os números vêm de /api/limite-demandas (regra em
// lib/limiteDemandas, aplicada no servidor); aqui só se mostra e se pede para pescar.
import React, { useCallback, useEffect, useState } from 'react'
import { toast, pedirTexto } from '@/lib/toast'
import { pulouPrioridade, MIN_MOTIVO_EXCECAO, type TarefaLimite } from '@/lib/limiteDemandas'

const EVENTO_MUDOU = 'soma-tarefas-mudaram' // o mesmo da BarraProximasTarefas

export type ItemVaga = { id: string; titulo?: string; clienteNome?: string; status: string; prazo?: string; prioridade?: string; ajuste?: boolean }
export type VagasPessoa = { email: string; nome: string; ocupadas: number; limite: number; livres: number; acima: boolean; naFila: number; ajustesEsperando: number; emRisco: number; emAndamento: ItemVaga[]; entregasSemana?: number; tempoMedioMs?: number | null; amostraTempo?: number }
export type DadosVagas = {
  ligado: boolean; limitePadrao: number
  minhas: { ocupadas: number; limite: number; livres: number; acima: boolean; emAndamento: ItemVaga[]; fila: ItemVaga[] }
  porPessoa: VagasPessoa[]
}

/** As vagas (minhas e do time). Recarrega quando alguma tarefa muda, ao voltar à aba e a cada 2 min. */
export function useVagas(ativo = true): { dados: DadosVagas | null; recarregar: () => void } {
  const [dados, setDados] = useState<DadosVagas | null>(null)
  const recarregar = useCallback(() => {
    fetch('/api/limite-demandas').then(r => (r.ok ? r.json() : null)).then(d => { if (d && d.minhas) setDados(d) }).catch(() => {})
  }, [])
  useEffect(() => {
    if (!ativo) return
    recarregar()
    const intervalo = setInterval(recarregar, 120000)
    const aoVoltar = () => { if (document.visibilityState === 'visible') recarregar() }
    window.addEventListener(EVENTO_MUDOU, recarregar)
    document.addEventListener('visibilitychange', aoVoltar)
    return () => { clearInterval(intervalo); window.removeEventListener(EVENTO_MUDOU, recarregar); document.removeEventListener('visibilitychange', aoVoltar) }
  }, [ativo, recarregar])
  return { dados, recarregar }
}

const avisarMudou = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_MUDOU)) }

/** Leu a resposta de uma rota que pode recusar pelo limite (409): mostra o motivo. true = recusou. */
export async function recusouPeloLimite(r: Response): Promise<boolean> {
  if (r.status !== 409) return false
  const d = await r.clone().json().catch(() => null)
  if (!d?.limite) return false
  const abertas = (d.vagas?.tarefas || []).map((t: any) => t.titulo).filter(Boolean).slice(0, 3)
  toast(`${d.error}${abertas.length ? ` Em andamento: ${abertas.join('; ')}.` : ''}`, 'erro')
  return true
}

/**
 * Recusa pelo limite com a EXCEÇÃO DO GESTOR (F4). Se a resposta não é recusa do limite, devolve-a
 * como veio. Se é, e quem pede pode passar do limite (gestor de projetos do squad, gerente, admin),
 * pergunta o motivo e refaz o mesmo pedido com `forcarLimite`. Sem permissão, ou se desistiu,
 * mostra o motivo da recusa e devolve null.
 */
export async function tratarRecusaDoLimite(r: Response, refazer: (forcarLimite: { motivo: string }) => Promise<Response | null>): Promise<Response | null> {
  if (r.status !== 409) return r
  const d = await r.clone().json().catch(() => null)
  if (!d?.limite) return r
  if (!d.podeForcar) { await recusouPeloLimite(r); return null }
  const abertas = (d.vagas?.tarefas || []).map((t: any) => t.titulo).filter(Boolean).slice(0, 3)
  const motivo = await pedirTexto(
    `${d.error}${abertas.length ? ` Em andamento: ${abertas.join('; ')}.` : ''} Você pode passar do limite numa urgência; o motivo fica no histórico da tarefa e a pessoa é avisada.`,
    { titulo: 'Passar do limite?', okLabel: 'Passar do limite', placeholder: 'Motivo (ex.: cliente antecipou a campanha)', minimo: MIN_MOTIVO_EXCECAO },
  )
  if (!motivo) { toast('Nada mudou: a peça ficou como estava.', 'info'); return null }
  const r2 = await refazer({ motivo }).catch(() => null)
  if (!r2) { toast('Sem conexão. Tente de novo.', 'erro'); return null }
  if (!r2.ok) { const e = await r2.clone().json().catch(() => null); toast(e?.error || 'Não foi possível passar do limite.', 'erro'); return null }
  toast('Limite passado. O motivo ficou no histórico da tarefa.', 'sucesso')
  return r2
}

/**
 * PESCAR: a pessoa assume uma peça da própria fila (Em andamento; ajuste esperando vaga vira Em
 * ajuste). O servidor confere a vaga. `fila` (opcional) liga o aviso de Prioridade pulada.
 */
export async function pescarTarefa(t: ItemVaga, fila: ItemVaga[] = []): Promise<boolean> {
  const corpo = { id: t.id, status: t.ajuste ? 'em_ajuste' : 'em_andamento' }
  const enviar = (extra: object = {}) => fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...corpo, ...extra }) })
  const r0 = await enviar().catch(() => null)
  if (!r0) { toast('Sem conexão. Tente de novo.', 'erro'); return false }
  const r = await tratarRecusaDoLimite(r0, forcarLimite => enviar({ forcarLimite }))
  if (!r) return false
  if (r !== r0) { avisarMudou(); return true } // passou do limite: o aviso já saiu
  if (!r.ok) { const d = await r.json().catch(() => null); toast(d?.error || 'Não foi possível pescar esta peça.', 'erro'); return false }
  const pulada = pulouPrioridade(t as TarefaLimite, fila as TarefaLimite[])
  toast(pulada ? `Pescada. Atenção: "${pulada.titulo}" está marcada como Prioridade na sua fila.` : `Pescada: "${t.titulo || 'peça'}" está em andamento com você.`, pulada ? 'info' : 'sucesso')
  avisarMudou()
  return true
}

/** ●●○ — as vagas desenhadas. Acima do limite, as que passam ficam em vermelho. */
export function PontosVagas({ ocupadas, limite, tamanho = 8 }: { ocupadas: number; limite: number; tamanho?: number }) {
  const total = Math.max(limite, ocupadas)
  return (
    <span aria-hidden style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {Array.from({ length: Math.min(total, 10) }).map((_, i) => {
        const cheia = i < ocupadas
        const passou = i >= limite
        return <span key={i} style={{
          width: tamanho, height: tamanho, borderRadius: '50%', boxSizing: 'border-box',
          background: cheia ? (passou ? 'var(--v2-hot)' : 'var(--v2-amber-on, var(--v2-amber))') : 'transparent',
          border: `1.5px solid ${cheia ? (passou ? 'var(--v2-hot)' : 'var(--v2-amber-on, var(--v2-amber))') : 'var(--v2-ink3)'}`,
          transition: 'background 220ms ease, border-color 220ms ease',
        }} />
      })}
    </span>
  )
}

/** "●●○ 2 de 3" — chip das vagas de uma pessoa. */
export function ChipVagas({ ocupadas, limite, rotulo, titulo }: { ocupadas: number; limite: number; rotulo?: string; titulo?: string }) {
  const cheio = ocupadas >= limite
  return (
    <span title={titulo || `${ocupadas} de ${limite} demandas em andamento`} style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap',
      border: '1px solid var(--v2-rule)', background: cheio ? 'var(--v2-hot-bg)' : 'var(--v2-surface)', color: cheio ? 'var(--v2-hot)' : 'var(--v2-ink2)',
      fontSize: 12, fontWeight: 700,
    }}>
      {rotulo && <span>{rotulo}</span>}
      <PontosVagas ocupadas={ocupadas} limite={limite} />
      <span>{ocupadas} de {limite}</span>
    </span>
  )
}

/**
 * SUAS VAGAS na tela Hoje (F4): as peças em andamento e a próxima sugerida da fila, com Pescar.
 * Some quando o limitador está desligado ou a pessoa não tem produção criativa (nem em andamento,
 * nem na fila).
 */
export function BlocoSuasVagas({ onAbrir, onMudou }: { onAbrir: () => void; onMudou?: () => void }) {
  const { dados, recarregar } = useVagas()
  const [pescando, setPescando] = useState('')
  if (!dados?.ligado) return null
  const m = dados.minhas
  if (!m.emAndamento.length && !m.fila.length) return null
  const proxima = m.fila[0]
  const pescar = async () => {
    if (!proxima || pescando) return
    setPescando(proxima.id)
    const ok = await pescarTarefa(proxima, m.fila)
    setPescando('')
    if (ok) { recarregar(); onMudou?.() }
  }
  const linha: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--v2-rule)' }
  return (
    <section id="v2-vagas" className="v2-card" style={{ margin: 0 }} aria-label="Suas vagas">
      <h3 style={{ alignItems: 'center' }}>
        Suas vagas
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><PontosVagas ocupadas={m.ocupadas} limite={m.limite} />{m.ocupadas} de {m.limite} em andamento</span>
      </h3>
      {m.emAndamento.map(t => (
        <div key={t.id} style={linha} role="button" tabIndex={0} onClick={onAbrir} onKeyDown={e => { if (e.key === 'Enter') onAbrir() }}>
          <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titulo || 'Peça'}</p>
            <small style={{ fontSize: 11.5, color: 'var(--v2-ink3)' }}>{[t.clienteNome, t.status === 'em_ajuste' ? 'Em ajuste' : 'Em andamento'].filter(Boolean).join(' · ')}</small>
          </div>
        </div>
      ))}
      {proxima ? (
        <div style={{ ...linha, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <small style={{ fontSize: 11, fontWeight: 700, color: 'var(--v2-ink3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{proxima.ajuste ? 'Ajuste esperando vaga' : 'Próxima da fila'}{m.fila.length > 1 ? ` · mais ${m.fila.length - 1} na fila` : ''}</small>
            <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--v2-ink)' }}>{proxima.titulo || 'Peça'}{proxima.clienteNome ? <span style={{ fontWeight: 400, color: 'var(--v2-ink3)' }}> · {proxima.clienteNome}</span> : null}</p>
          </div>
          {m.livres > 0
            ? <button type="button" onClick={pescar} disabled={!!pescando} style={{ padding: '7px 14px', borderRadius: 9, border: 'none', background: 'var(--v2-amber-on, var(--v2-amber))', color: '#17150E', fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>{pescando ? 'Pescando...' : 'Pescar'}</button>
            : <span style={{ fontSize: 12, color: 'var(--v2-hot)', fontWeight: 600 }}>Sem vaga: entregue uma para pescar</span>}
        </div>
      ) : <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--v2-ink3)' }}>Sua fila está vazia.</p>}
    </section>
  )
}
