'use client'
import { useEffect, useState } from 'react'
import { GATILHOS, ACOES, OPERADORES } from '@/lib/automacoesCatalogo'
import { toast, confirmar } from '@/lib/toast'
import { fecharFora } from '@/lib/fecharModal'

type Cond = { campo: string; operador: string; valor?: string }
type Passo = { id: string; atrasoDias: number; acao: string; params: Record<string, any> }
type Regra = { id: string; nome: string; ativo: boolean; gatilho: string; condicoes?: Cond[]; condicaoLogica?: 'todas' | 'qualquer'; alvo: 'todos' | 'selecionados'; clienteIds?: string[]; clienteIdsExcluidos?: string[]; passos: Passo[] }

const uid = () => Math.random().toString(36).slice(2)
const gatilhoDe = (k: string) => GATILHOS.find(g => g.chave === k)
const acaoDe = (k: string) => ACOES.find(a => a.chave === k)
const novaRegra = (): Regra => ({ id: '', nome: '', ativo: true, gatilho: '', condicoes: [], condicaoLogica: 'todas', alvo: 'todos', clienteIds: [], clienteIdsExcluidos: [], passos: [{ id: uid(), atrasoDias: 0, acao: '', params: {} }] })

export default function Automacoes({ clientes = [] }: { clientes?: { id: string; nome: string }[] }) {
  const [regras, setRegras] = useState<Regra[]>([])
  const [edit, setEdit] = useState<Regra | null>(null)
  const [salvando, setSalvando] = useState(false)

  function carregar() { fetch('/api/automacoes').then(r => r.json()).then(d => setRegras(Array.isArray(d) ? d : [])).catch(() => {}) }
  useEffect(() => { carregar() }, [])

  async function toggleAtivo(r: Regra) {
    setRegras(rs => rs.map(x => x.id === r.id ? { ...x, ativo: !x.ativo } : x))
    await fetch('/api/automacoes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, ativo: !r.ativo }) }).catch(() => {})
  }
  async function excluir(r: Regra) {
    if (!(await confirmar(`Excluir a automação "${r.nome}"?`, { titulo: 'Excluir automação', okLabel: 'Excluir', perigo: true }))) return
    setRegras(rs => rs.filter(x => x.id !== r.id))
    await fetch(`/api/automacoes?id=${r.id}`, { method: 'DELETE' }).catch(() => {})
  }
  async function salvar() {
    if (!edit) return
    if (!edit.nome.trim()) { toast('Dê um nome à automação.', 'erro'); return }
    if (!edit.gatilho) { toast('Escolha um gatilho.', 'erro'); return }
    if (!edit.passos.length || edit.passos.some(p => !p.acao)) { toast('Cada passo precisa de uma ação.', 'erro'); return }
    setSalvando(true)
    const metodo = edit.id ? 'PUT' : 'POST'
    const r = await fetch('/api/automacoes', { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(edit) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (!r?.ok) { toast(r?.error || 'Não foi possível salvar.', 'erro'); return }
    setEdit(null); carregar()
  }

  // Categorias de gatilho para o dropdown agrupado
  const categorias = Array.from(new Set(GATILHOS.map(g => g.categoria)))

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: 'var(--v2-ink)' }}>Automações</h2>
        <button onClick={() => setEdit(novaRegra())} style={{ padding: '9px 16px', background: 'var(--v2-amber-on)', color: '#17150E', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Nova automação</button>
      </div>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--v2-ink3)' }}>Quando o <b>gatilho</b> acontecer (e as condições baterem), executa a <b>sequência</b> de passos. Global, com exceção por cliente.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {regras.length === 0 && <p style={{ fontSize: 13, color: 'var(--v2-ink3)' }}>Nenhuma automação ainda. Crie a primeira.</p>}
        {regras.map(r => (
          <div key={r.id} style={{ background: 'var(--v2-surface)', borderRadius: 14, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--v2-ink)' }}>{r.nome}</p>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--v2-ink3)' }}>
                Quando <b>{gatilhoDe(r.gatilho)?.label || r.gatilho}</b>{(r.condicoes?.length || 0) > 0 ? ` · ${r.condicoes!.length} condição(ões)` : ''} · {r.alvo === 'todos' ? `todos os clientes${r.clienteIdsExcluidos?.length ? ` (exceto ${r.clienteIdsExcluidos.length})` : ''}` : `${r.clienteIds?.length || 0} cliente(s)`} · {r.passos.length} passo(s)
              </p>
            </div>
            <button onClick={() => setEdit(JSON.parse(JSON.stringify(r)))} style={{ background: 'none', border: '1px solid var(--v2-rule)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--v2-ink2)', cursor: 'pointer' }}>Editar</button>
            <button onClick={() => excluir(r)} style={{ background: 'none', border: '1px solid var(--v2-hot-bg)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--v2-hot)', cursor: 'pointer' }}>Excluir</button>
            <button onClick={() => toggleAtivo(r)} title={r.ativo ? 'Ativa' : 'Inativa'} style={{ flexShrink: 0, width: 46, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer', background: r.ativo ? 'var(--v2-ok)' : 'var(--v2-rule)', position: 'relative' }}>
              <span style={{ position: 'absolute', top: 3, left: r.ativo ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: 'var(--v2-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left .2s' }} />
            </button>
          </div>
        ))}
      </div>

      {edit && <Editor regra={edit} setRegra={setEdit as any} clientes={clientes} salvar={salvar} salvando={salvando} categorias={categorias} onClose={() => setEdit(null)} />}
    </div>
  )
}

const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }

function Editor({ regra, setRegra, clientes, salvar, salvando, categorias, onClose }: any) {
  const set = (patch: Partial<Regra>) => setRegra({ ...regra, ...patch })
  const gat = gatilhoDe(regra.gatilho)
  const campos = gat?.campos || []

  return (
    <div onClick={fecharFora(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: 'var(--v2-surface)', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, color: 'var(--v2-ink)' }}>{regra.id ? 'Editar automação' : 'Nova automação'}</h3>

        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Nome</label>
          <input value={regra.nome} onChange={e => set({ nome: e.target.value })} placeholder="Ex.: Onboarding do novo cliente" style={{ ...inp, width: '100%' }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Gatilho (quando)</label>
          <select value={regra.gatilho} onChange={e => set({ gatilho: e.target.value, condicoes: [] })} style={{ ...inp, width: '100%', background: 'var(--v2-surface)' }}>
            <option value="">Escolha o evento…</option>
            {categorias.map((cat: string) => (
              <optgroup key={cat} label={cat}>
                {GATILHOS.filter(g => g.categoria === cat).map(g => <option key={g.chave} value={g.chave}>{g.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Condições */}
        {regra.gatilho && (
          <div style={{ marginBottom: 14, background: 'var(--v2-surface1)', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ ...lbl, margin: 0 }}>Condições (opcional)</label>
              {(regra.condicoes?.length || 0) > 1 && (
                <select value={regra.condicaoLogica} onChange={e => set({ condicaoLogica: e.target.value as any })} style={{ ...inp, padding: '4px 8px', fontSize: 12 }}>
                  <option value="todas">Todas verdadeiras</option>
                  <option value="qualquer">Qualquer verdadeira</option>
                </select>
              )}
            </div>
            {(regra.condicoes || []).map((c: Cond, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                <select value={c.campo} onChange={e => { const cs = [...regra.condicoes]; cs[i] = { ...c, campo: e.target.value }; set({ condicoes: cs }) }} style={{ ...inp, flex: 1, background: 'var(--v2-surface)' }}>
                  <option value="">Campo…</option>
                  {campos.map((f: any) => <option key={f.chave} value={f.chave}>{f.label}</option>)}
                </select>
                <select value={c.operador} onChange={e => { const cs = [...regra.condicoes]; cs[i] = { ...c, operador: e.target.value }; set({ condicoes: cs }) }} style={{ ...inp, background: 'var(--v2-surface)' }}>
                  {OPERADORES.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
                {!['preenchido', 'vazio'].includes(c.operador) && (
                  <input value={c.valor || ''} onChange={e => { const cs = [...regra.condicoes]; cs[i] = { ...c, valor: e.target.value }; set({ condicoes: cs }) }} placeholder="valor" style={{ ...inp, width: 110 }} />
                )}
                <button onClick={() => set({ condicoes: regra.condicoes.filter((_: any, j: number) => j !== i) })} style={{ background: 'none', border: 'none', color: 'var(--v2-ink3)', cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            ))}
            <button onClick={() => set({ condicoes: [...(regra.condicoes || []), { campo: '', operador: 'igual', valor: '' }] })} style={{ background: 'none', border: 'none', color: 'var(--v2-info)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>+ Condição</button>
          </div>
        )}

        {/* Escopo */}
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Aplicar a</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {(['todos', 'selecionados'] as const).map(a => (
              <button key={a} onClick={() => set({ alvo: a })} style={{ padding: '7px 14px', borderRadius: 8, border: regra.alvo === a ? '1.5px solid var(--v2-ink)' : '1.5px solid var(--v2-rule)', background: regra.alvo === a ? 'var(--v2-ink)' : 'var(--v2-surface)', color: regra.alvo === a ? 'var(--v2-surface)' : 'var(--v2-ink2)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{a === 'todos' ? 'Todos os clientes' : 'Clientes específicos'}</button>
            ))}
          </div>
          {regra.alvo === 'selecionados' ? (
            <ClienteMulti clientes={clientes} sel={regra.clienteIds || []} onChange={(ids: string[]) => set({ clienteIds: ids })} label="Incluir clientes:" />
          ) : (
            <ClienteMulti clientes={clientes} sel={regra.clienteIdsExcluidos || []} onChange={(ids: string[]) => set({ clienteIdsExcluidos: ids })} label="Exceção — desligar para:" />
          )}
        </div>

        {/* Passos */}
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Sequência de passos</label>
          {regra.passos.map((p: Passo, i: number) => {
            const ac = acaoDe(p.acao)
            return (
              <div key={p.id} style={{ background: 'var(--v2-surface1)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: ac ? 10 : 0, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)' }}>Passo {i + 1}</span>
                  <span style={{ fontSize: 12, color: 'var(--v2-ink3)' }}>após</span>
                  <input type="number" min="0" value={p.atrasoDias} onChange={e => { const ps = [...regra.passos]; ps[i] = { ...p, atrasoDias: Number(e.target.value) || 0 }; set({ passos: ps }) }} style={{ ...inp, width: 64 }} />
                  <span style={{ fontSize: 12, color: 'var(--v2-ink3)' }}>dias</span>
                  <select value={p.acao} onChange={e => { const ps = [...regra.passos]; ps[i] = { ...p, acao: e.target.value, params: {} }; set({ passos: ps }) }} style={{ ...inp, flex: 1, minWidth: 160, background: 'var(--v2-surface)' }}>
                    <option value="">Ação…</option>
                    {ACOES.map(a => <option key={a.chave} value={a.chave}>{a.label}</option>)}
                  </select>
                  {regra.passos.length > 1 && <button onClick={() => set({ passos: regra.passos.filter((_: any, j: number) => j !== i) })} style={{ background: 'none', border: 'none', color: 'var(--v2-ink3)', cursor: 'pointer', fontSize: 16 }}>×</button>}
                </div>
                {ac && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {ac.params.map(par => (
                      <div key={par.chave}>
                        <label style={{ fontSize: 11, color: 'var(--v2-ink3)', display: 'block', marginBottom: 2 }}>{par.label}{par.dica ? ` — ${par.dica}` : ''}</label>
                        {par.tipo === 'select' ? (
                          <select value={p.params[par.chave] || ''} onChange={e => { const ps = [...regra.passos]; ps[i] = { ...p, params: { ...p.params, [par.chave]: e.target.value } }; set({ passos: ps }) }} style={{ ...inp, width: '100%', background: 'var(--v2-surface)' }}>
                            <option value="">—</option>
                            {par.opcoes!.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                          </select>
                        ) : par.tipo === 'textarea' ? (
                          <textarea lang="pt-BR" value={p.params[par.chave] || ''} onChange={e => { const ps = [...regra.passos]; ps[i] = { ...p, params: { ...p.params, [par.chave]: e.target.value } }; set({ passos: ps }) }} style={{ ...inp, width: '100%', minHeight: 52, resize: 'vertical' }} />
                        ) : (
                          <input value={p.params[par.chave] || ''} onChange={e => { const ps = [...regra.passos]; ps[i] = { ...p, params: { ...p.params, [par.chave]: e.target.value } }; set({ passos: ps }) }} style={{ ...inp, width: '100%' }} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          <button onClick={() => set({ passos: [...regra.passos, { id: uid(), atrasoDias: 0, acao: '', params: {} }] })} style={{ background: 'none', border: '1px dashed var(--v2-rule2)', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, color: 'var(--v2-ink2)', cursor: 'pointer', width: '100%' }}>+ Adicionar passo</button>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 18px', background: 'var(--v2-surface2)', color: 'var(--v2-ink2)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={{ padding: '10px 20px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>{salvando ? 'Salvando…' : 'Salvar automação'}</button>
        </div>
      </div>
    </div>
  )
}

function ClienteMulti({ clientes, sel, onChange, label }: { clientes: { id: string; nome: string }[]; sel: string[]; onChange: (ids: string[]) => void; label: string }) {
  return (
    <div>
      <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--v2-ink3)' }}>{label}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 120, overflowY: 'auto' }}>
        {clientes.length === 0 && <span style={{ fontSize: 12, color: 'var(--v2-ink3)' }}>Sem clientes.</span>}
        {clientes.map(c => {
          const on = sel.includes(c.id)
          return (
            <button key={c.id} onClick={() => onChange(on ? sel.filter(x => x !== c.id) : [...sel, c.id])} style={{ padding: '5px 11px', borderRadius: 999, border: on ? '1.5px solid var(--v2-info)' : '1.5px solid var(--v2-rule)', background: on ? 'var(--v2-info-bg)' : 'var(--v2-surface)', color: on ? 'var(--v2-info)' : 'var(--v2-ink3)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{c.nome}</button>
          )
        })}
      </div>
    </div>
  )
}
