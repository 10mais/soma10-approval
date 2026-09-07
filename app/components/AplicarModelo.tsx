'use client'
import { useEffect, useState } from 'react'
import { toast } from '@/lib/toast'
import { fecharFora } from '@/lib/fecharModal'
import type { EtapaPlanejada, UnidadeDuracao } from '@/lib/aplicarModelo'

// APLICAR MODELO a um ou vários clientes, com prévia obrigatória antes de gravar.
// Extraído de Modelos.tsx (07/09) para o Playbook do cliente também oferecer
// "Aplicar modelo" — antes só existia em Estratégia → Modelos, e quem estava no
// Playbook vazio não descobria que havia um modelo pronto. `preSelecionados`
// já marca o cliente da tela de origem.

type Cliente = { id: string; nome: string; tipo?: string }
type Usuario = { email: string; nome?: string; role?: string }
type TMarco = { titulo: string; categoria: string; descricao?: string; diasDuracao?: number; duracao?: number; unidade?: UnidadeDuracao; responsavelEmail?: string }
type TTarefa = { titulo: string; tipo?: string; prioridade?: string; marcoIndice?: number; responsavelEmail?: string }
export type Template = { id: string; nome: string; descricao?: string; marcos: TMarco[]; tarefas: TTarefa[] }

type Alvo = { id: string; nome: string; etapasAtuais: number }
type Previa = { modelo: string; etapas: EtapaPlanejada[]; tarefas: { titulo: string; responsavelEmail?: string }[]; alvos: Alvo[] }

const dataBR = (iso: string) => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : ''

// MUTIRÃO: aplica o modelo a VÁRIOS clientes, com prévia obrigatória antes de gravar.
// A prévia não é enfeite — aplicar num cliente que já tem etapas DUPLICA o Playbook
// dele, e etapa duplicada só aparece depois, no Gantt. Por isso o alerta é na cara.
export default function AplicarModal({ template, clientes, equipe = [], preSelecionados, onClose, onOk }: { template: Template; clientes: Cliente[]; equipe?: Usuario[]; preSelecionados?: string[]; onClose: () => void; onOk: (r: { marcos: number; tarefas: number; aplicados?: { nome: string }[] }) => void }) {
  const nomeDe = (email?: string) => (email ? (equipe.find(u => u.email === email)?.nome || email) : '')
  const [sel, setSel] = useState<Set<string>>(new Set((preSelecionados || []).filter(id => clientes.some(c => c.id === id))))
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10))
  const [etapasPorCliente, setEtapasPorCliente] = useState<Record<string, number>>({})
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const elegiveis = [...clientes].filter(c => c.tipo !== 'interno').sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))

  // Quem já tem Playbook. Um GET traz os marcos da base inteira (não há índice
  // por cliente) — é a mesma chamada que a home do dashboard já faz.
  useEffect(() => {
    fetch('/api/playbook').then(r => r.json()).then((ms: any[]) => {
      if (!Array.isArray(ms)) return
      const cont: Record<string, number> = {}
      for (const m of ms) if (m?.clienteId) cont[m.clienteId] = (cont[m.clienteId] || 0) + 1
      setEtapasPorCliente(cont)
    }).catch(() => {})
  }, [])

  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const semEtapas = elegiveis.filter(c => !etapasPorCliente[c.id])
  const selecionarSemEtapas = () => setSel(new Set(semEtapas.map(c => c.id)))
  const comEtapasSelecionados = Array.from(sel).filter(id => etapasPorCliente[id]).length

  async function pedir(preview: boolean) {
    if (!sel.size || ocupado) return
    setOcupado(true)
    const r = await fetch('/api/templates/aplicar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: template.id, clienteIds: Array.from(sel), dataInicio, preview }),
    }).then(x => x.json()).catch(() => null)
    setOcupado(false)
    if (!r?.ok) { toast('Não foi possível ' + (preview ? 'gerar a prévia' : 'aplicar') + ': ' + (r?.error || 'erro'), 'erro'); return }
    if (preview) setPrevia(r); else onOk(r)
  }

  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', background: 'var(--v2-surface)' }
  const linkBt: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--v2-info)', fontWeight: 700, fontSize: 12, cursor: 'pointer', padding: 0 }

  return (
    <div onClick={fecharFora(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1100, padding: 20, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v2-surface)', borderRadius: 16, width: '100%', maxWidth: 520, padding: 22, margin: '20px 0' }}>

        {!previa ? (<>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, color: 'var(--v2-ink)' }}>Aplicar modelo</h3>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--v2-ink3)' }}>"{template.nome}" — {(template.marcos || []).length} etapa(s) e {(template.tarefas || []).length} tarefa(s) por cliente.</p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)' }}>Clientes {sel.size > 0 && <span style={{ color: 'var(--v2-ink)' }}>· {sel.size} selecionado(s)</span>}</label>
            <div style={{ display: 'flex', gap: 12 }}>
              {semEtapas.length > 0 && <button onClick={selecionarSemEtapas} style={linkBt}>Todos sem etapas ({semEtapas.length})</button>}
              {sel.size > 0 && <button onClick={() => setSel(new Set())} style={{ ...linkBt, color: 'var(--v2-ink3)' }}>Limpar</button>}
            </div>
          </div>

          <div style={{ maxHeight: 260, overflowY: 'auto', border: '1.5px solid var(--v2-rule)', borderRadius: 10, marginBottom: 12 }}>
            {elegiveis.map(c => {
              const n = etapasPorCliente[c.id] || 0
              return (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid var(--v2-surface1)', cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} style={{ cursor: 'pointer' }} />
                  <span style={{ flex: 1, color: 'var(--v2-ink)' }}>{c.nome}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap', color: n ? 'var(--v2-ok)' : 'var(--v2-amber)', background: n ? 'var(--v2-ok-bg)' : 'var(--v2-amber-bg)' }}>
                    {n ? `${n} etapa${n > 1 ? 's' : ''}` : 'Sem etapas'}
                  </span>
                </label>
              )
            })}
            {elegiveis.length === 0 && <p style={{ margin: 0, padding: 16, fontSize: 13, color: 'var(--v2-ink3)' }}>Nenhum cliente.</p>}
          </div>

          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Data de início</label>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={{ ...inp, marginBottom: 18 }} />

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => pedir(true)} disabled={!sel.size || ocupado} style={{ flex: 1, padding: '11px 0', background: sel.size ? 'var(--v2-ink)' : 'var(--v2-surface2)', color: sel.size ? 'var(--v2-surface)' : 'var(--v2-ink3)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: sel.size ? 'pointer' : 'default' }}>{ocupado ? 'Gerando prévia...' : 'Ver prévia'}</button>
            <button onClick={onClose} style={{ padding: '11px 18px', background: 'var(--v2-surface1)', color: 'var(--v2-ink2)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </>) : (<>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, color: 'var(--v2-ink)' }}>Confira antes de aplicar</h3>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--v2-ink3)' }}>Nada foi criado ainda. Isto é o que vai ser gravado em cada um dos {previa.alvos.length} cliente(s).</p>

          {comEtapasSelecionados > 0 && (
            <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: 'var(--v2-amber-bg)', border: '1px solid var(--v2-amber-bg)', color: 'var(--v2-amber)', fontSize: 12.5 }}>
              <strong>{comEtapasSelecionados} cliente(s) já têm etapas no Playbook.</strong> Aplicar de novo SOMA as etapas do modelo às que já existem — não substitui. Desmarque quem não deve receber.
            </div>
          )}

          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)' }}>Etapas que serão criadas</p>
          <div style={{ border: '1.5px solid var(--v2-rule)', borderRadius: 10, marginBottom: 14 }}>
            {previa.etapas.map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: i < previa.etapas.length - 1 ? '1px solid var(--v2-surface1)' : 'none', fontSize: 13 }}>
                <span style={{ color: 'var(--v2-ink3)', fontSize: 11, fontWeight: 800, width: 16 }}>{i + 1}</span>
                <span style={{ flex: 1, color: 'var(--v2-ink)' }}>{e.titulo || <em style={{ color: '#c00' }}>sem título</em>}</span>
                {e.responsavelEmail && <span style={{ fontSize: 11, color: 'var(--v2-info)', background: 'var(--v2-info-bg)', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>{nomeDe(e.responsavelEmail)}</span>}
                <span style={{ fontSize: 11.5, color: 'var(--v2-ink3)', whiteSpace: 'nowrap' }}>
                  {dataBR(e.dataInicio)}{e.dataFim ? ` — ${dataBR(e.dataFim)}` : ' · marco pontual'}
                </span>
              </div>
            ))}
            {previa.etapas.length === 0 && <p style={{ margin: 0, padding: 14, fontSize: 12.5, color: '#c00' }}>Este modelo não tem nenhuma etapa. Termine o rascunho antes de aplicar.</p>}
          </div>

          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)' }}>Vai para</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
            {previa.alvos.map(a => (
              <span key={a.id} style={{ fontSize: 12, borderRadius: 999, padding: '4px 11px', background: a.etapasAtuais ? 'var(--v2-amber-bg)' : 'var(--v2-surface1)', border: a.etapasAtuais ? '1px solid var(--v2-amber-bg)' : '1px solid var(--v2-surface2)', color: 'var(--v2-ink)' }}>
                {a.nome}{a.etapasAtuais ? ` · já tem ${a.etapasAtuais}` : ''}
              </span>
            ))}
          </div>

          <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--v2-ink2)' }}>
            Total: <strong>{previa.etapas.length * previa.alvos.length} etapa(s)</strong> e <strong>{previa.tarefas.length * previa.alvos.length} tarefa(s)</strong>.
          </p>

          {/* Tarefa sem dono não é erro — mas some no quadro de todo mundo, e
              ninguém vai atrás do que não é seu. Melhor avisar aqui. */}
          {previa.tarefas.some(t => !t.responsavelEmail) && (
            <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: 'var(--v2-surface1)', border: '1px solid var(--v2-rule)', color: 'var(--v2-ink2)', fontSize: 12.5 }}>
              <strong>{previa.tarefas.filter(t => !t.responsavelEmail).length} tarefa(s) vão nascer sem responsável.</strong> Dá para atribuir depois, uma a uma — ou voltar ao modelo e definir o responsável da etapa, que carimba todas de uma vez.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => pedir(false)} disabled={ocupado || previa.etapas.length === 0} style={{ flex: 1, padding: '11px 0', background: previa.etapas.length ? 'var(--v2-ink)' : 'var(--v2-surface2)', color: previa.etapas.length ? 'var(--v2-surface)' : 'var(--v2-ink3)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: previa.etapas.length ? 'pointer' : 'default' }}>{ocupado ? 'Aplicando...' : `Aplicar a ${previa.alvos.length} cliente(s)`}</button>
            <button onClick={() => setPrevia(null)} style={{ padding: '11px 18px', background: 'var(--v2-surface1)', color: 'var(--v2-ink2)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Voltar</button>
          </div>
        </>)}
      </div>
    </div>
  )
}
