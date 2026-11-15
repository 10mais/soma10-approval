'use client'
// VAGAS do limitador de demandas (dono, 15/11/2026) — peças compartilhadas pelas telas: a barra do
// topo, Tarefas, a Fila de produção e o Estúdio. Os números vêm de /api/limite-demandas (regra em
// lib/limiteDemandas, aplicada no servidor); aqui só se mostra e se pede para pescar.
import React, { useCallback, useEffect, useState } from 'react'
import { toast } from '@/lib/toast'
import { pulouPrioridade, type TarefaLimite } from '@/lib/limiteDemandas'

const EVENTO_MUDOU = 'soma-tarefas-mudaram' // o mesmo da BarraProximasTarefas

export type ItemVaga = { id: string; titulo?: string; clienteNome?: string; status: string; prazo?: string; prioridade?: string; ajuste?: boolean }
export type VagasPessoa = { email: string; nome: string; ocupadas: number; limite: number; livres: number; acima: boolean; naFila: number; ajustesEsperando: number; emRisco: number; emAndamento: ItemVaga[] }
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
 * PESCAR: a pessoa assume uma peça da própria fila (Em andamento; ajuste esperando vaga vira Em
 * ajuste). O servidor confere a vaga. `fila` (opcional) liga o aviso de Prioridade pulada.
 */
export async function pescarTarefa(t: ItemVaga, fila: ItemVaga[] = []): Promise<boolean> {
  const r = await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, status: t.ajuste ? 'em_ajuste' : 'em_andamento' }) }).catch(() => null)
  if (!r) { toast('Sem conexão. Tente de novo.', 'erro'); return false }
  if (await recusouPeloLimite(r)) return false
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
