'use client'
// PLANO DE AÇÃO — visão da equipe (F2, 17/11/2026). Uma pergunta só: "o que sai esta semana
// e quem está atrasado?". Abre na semana atual; destaca três coisas (atrasadas, sem
// responsável, esperando o cliente) e deixa o resto quieto. A conta mora em
// lib/planoAcao.visaoDaSemana; aqui é só a tela.
//
// Entrega ligada a tarefa conclui junto com a tarefa (o botão abre a tarefa). Entrega sem
// tarefa (reunião, entrega do cliente) se marca aqui mesmo, com Ctrl+Z.
import { useMemo, useState } from 'react'
import { visaoDaSemana, visaoDoCliente, textoResumoSemana, textoRelogio, type EntregaNaTela, type MarcoSemana } from '@/lib/planoAcao'
import { toast } from '@/lib/toast'
import { hojeYmd, fmtDiaMes } from '@/lib/datas'

type Props = {
  marcos: (MarcoSemana & { clienteId?: string })[]
  editavel: boolean
  onAbrirTarefa: (id: string) => void
  onMarcar: (marcoId: string, entregaId: string, concluir: boolean) => void
  onEditarSemana: (marcoId: string) => void
  clienteNome?: string
}

const COR_RELOGIO: Record<string, string> = { atrasada: 'var(--v2-hot)', vence_hoje: 'var(--v2-amber)', no_prazo: 'var(--v2-ink3)', concluida: 'var(--v2-ok)', recesso: 'var(--v2-ink3)', sem_prazo: 'var(--v2-ink3)' }
const primeiroNome = (s?: string) => (s || '').trim().split(/\s+/)[0] || ''

function Linha({ e, mostrarSemana = false, editavel, onAbrirTarefa, onMarcar, onEditarSemana }: { e: EntregaNaTela; mostrarSemana?: boolean } & Omit<Props, 'marcos' | 'clienteNome'>) {
  const feita = e.status === 'concluido'
  const ligada = e.vinculo?.tipo === 'tarefa'
  const podeMarcar = editavel && !ligada
  const dono = e.doCliente ? 'Cliente' : primeiroNome(e.responsavelNome)
  return (
    <div className="anim-item" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: '1px solid var(--v2-rule)' }}>
      <button type="button" disabled={!podeMarcar} onClick={() => onMarcar(e.marcoId, e.id, !feita)}
        title={ligada ? 'Conclui junto com a tarefa' : feita ? 'Reabrir' : 'Marcar como entregue'} aria-label={feita ? `Reabrir ${e.titulo}` : `Marcar ${e.titulo} como entregue`}
        style={{ width: 20, height: 20, flexShrink: 0, borderRadius: '50%', border: `2px solid ${feita ? 'var(--v2-ok)' : 'var(--v2-rule2)'}`, background: feita ? 'var(--v2-ok)' : 'transparent', cursor: podeMarcar ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, opacity: ligada && !feita ? 0.55 : 1 }}>
        {feita && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--v2-surface)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12" /></svg>}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, color: feita ? 'var(--v2-ink3)' : 'var(--v2-ink)', textDecoration: feita ? 'line-through' : 'none', lineHeight: 1.35, overflowWrap: 'anywhere' }}>{e.titulo}</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--v2-ink3)' }}>
          {mostrarSemana && <>W{e.semana} · </>}
          {e.semDono
            ? <button type="button" onClick={() => editavel && onEditarSemana(e.marcoId)} style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'var(--v2-hot)', fontWeight: 700, cursor: editavel ? 'pointer' : 'default' }}>Sem responsável</button>
            : <span style={{ color: e.doCliente ? 'var(--v2-amber)' : undefined, fontWeight: e.doCliente ? 700 : 400 }}>{dono}</span>}
          {e.dataFim && <> · {fmtDiaMes(e.dataFim)}</>}
        </p>
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: COR_RELOGIO[e.relogio.estado], whiteSpace: 'nowrap' }}>{textoRelogio(e.relogio)}</span>
      {ligada && <button type="button" onClick={() => onAbrirTarefa(e.vinculo!.id)} style={{ padding: '6px 12px', border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--v2-ink)', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Abrir tarefa</button>}
    </div>
  )
}


export default function SemanasPlano({ marcos, editavel, onAbrirTarefa, onMarcar, onEditarSemana, clienteNome }: Props) {
  const hoje = hojeYmd()
  const [numero, setNumero] = useState<number | undefined>(undefined)
  const v = useMemo(() => visaoDaSemana(marcos, hoje, numero), [marcos, hoje, numero])
  const atual = useMemo(() => visaoDaSemana(marcos, hoje)?.numero, [marcos, hoje])
  if (!v) return null
  const acoes = { editavel, onAbrirTarefa, onMarcar, onEditarSemana }
  // F3: o mesmo recorte que o cliente vê, em texto para colar no WhatsApp.
  async function copiarResumo() {
    const vc = visaoDoCliente(marcos, hoje, v!.numero)
    if (!vc) return
    try { await navigator.clipboard.writeText(textoResumoSemana(vc, clienteNome)); toast('Resumo copiado. Cole no WhatsApp do cliente.', 'sucesso') }
    catch { toast('Não foi possível copiar.', 'erro') }
  }

  const btnNav: React.CSSProperties = { width: 32, height: 32, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', borderRadius: 8, cursor: 'pointer', color: 'var(--v2-ink2)', fontSize: 16, fontFamily: 'inherit' }
  const destaques = [
    v.destaques.atrasadas ? { n: v.destaques.atrasadas, t: v.destaques.atrasadas === 1 ? 'atrasada' : 'atrasadas', cor: 'var(--v2-hot)' } : null,
    v.destaques.semDono ? { n: v.destaques.semDono, t: 'sem responsável', cor: 'var(--v2-hot)' } : null,
    v.destaques.doCliente ? { n: v.destaques.doCliente, t: 'esperando o cliente', cor: 'var(--v2-amber)' } : null,
  ].filter(Boolean) as { n: number; t: string; cor: string }[]

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink3)', fontWeight: 600 }}>Semana {v.numero} de {v.total} · {fmtDiaMes(v.segunda)} a {fmtDiaMes(v.domingo)}{v.recesso ? ' · recesso' : ''}</p>
          <h3 style={{ margin: '4px 0 0', fontSize: 22, lineHeight: 1.25, color: 'var(--v2-ink)', fontWeight: 800 }}>{v.foco}</h3>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button type="button" onClick={copiarResumo} title="Texto pronto com o que saiu, o que sai e o que depende do cliente" style={{ ...btnNav, width: 'auto', padding: '0 12px', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink)' }}>Copiar resumo</button>
          <button type="button" style={btnNav} aria-label="Semana anterior" disabled={v.numero <= 1} onClick={() => setNumero(Math.max(1, v.numero - 1))}>&#8249;</button>
          {v.numero !== atual && <button type="button" onClick={() => setNumero(undefined)} style={{ ...btnNav, width: 'auto', padding: '0 12px', fontSize: 12, fontWeight: 700 }}>Semana atual</button>}
          <button type="button" style={btnNav} aria-label="Próxima semana" disabled={v.numero >= v.total} onClick={() => setNumero(v.numero + 1)}>&#8250;</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'baseline', margin: '14px 0 6px' }}>
        {destaques.map(d => <span key={d.t} style={{ fontSize: 14, color: d.cor, fontWeight: 700 }}><span style={{ fontSize: 20, fontWeight: 800 }}>{d.n}</span> {d.t}</span>)}
        <span style={{ fontSize: 12.5, color: 'var(--v2-ink3)', marginLeft: destaques.length ? 'auto' : 0 }}>
          Plano {v.progresso.pct}% feito{v.progresso.pctNoPrazo !== null ? ` · ${v.progresso.pctNoPrazo}% no prazo` : ''}
        </span>
      </div>

      {v.atrasadasAntes.length > 0 && (
        <section style={{ marginTop: 18 }}>
          <h4 style={{ margin: '0 0 2px', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--v2-hot)' }}>Ficou para trás</h4>
          {v.atrasadasAntes.map(e => <Linha key={`${e.marcoId}-${e.id}`} e={e} mostrarSemana {...acoes} />)}
        </section>
      )}

      {v.grupos.map(g => (
        <section key={g.frente || 'outras'} style={{ marginTop: 18 }}>
          <h4 style={{ margin: '0 0 2px', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>{g.rotulo}</h4>
          {g.entregas.map(e => <Linha key={e.id} e={e} {...acoes} />)}
        </section>
      ))}
      {!v.grupos.length && <p style={{ marginTop: 18, fontSize: 13, color: 'var(--v2-ink3)' }}>Nenhuma entrega nesta semana.</p>}

      {v.proximas.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 26 }}>
          {v.proximas.map(p => (
            <button key={p.numero} type="button" onClick={() => setNumero(p.numero)} style={{ flex: '1 1 240px', textAlign: 'left', padding: '12px 14px', border: '1px solid var(--v2-rule)', borderRadius: 12, background: 'var(--v2-surface)', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--v2-ink3)', fontWeight: 600 }}>W{p.numero} · {fmtDiaMes(p.segunda)} · {p.entregas} {p.entregas === 1 ? 'entrega' : 'entregas'}</span>
              <span style={{ display: 'block', marginTop: 3, fontSize: 13.5, color: 'var(--v2-ink)', fontWeight: 600 }}>{p.foco}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
