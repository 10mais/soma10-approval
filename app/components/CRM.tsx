'use client'
import { useEffect, useState } from 'react'

type Estagio = { id: string; nome: string; ordem: number; ganho?: boolean; perdido?: boolean }
type Contato = { id: string; nome: string; telefone?: string; email?: string; empresa?: string }
type Atividade = { id: string; tipo: string; texto: string; autor: string; criadoEm: string }
type Negocio = {
  id: string; titulo: string; valor?: number; estagioId: string; status: string
  dono?: string; donoNome?: string; contatoId?: string; origem?: string; previsaoFechamento?: string
  descricao?: string; atividades?: Atividade[]; criadoEm: string; atualizadoEm: string
  empresa?: string; segmento?: string; faturamentoEstimado?: string; instagram?: string; dores?: string; solucoes?: string
  clienteId?: string; handoff?: { escopoVendido?: string; expectativas?: string; detalhes?: string; observacoes?: string }
}

const fmtR$ = (v?: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const TIPOS_ATIV: [string, string][] = [['nota', 'Nota'], ['ligacao', 'Ligação'], ['whatsapp', 'WhatsApp'], ['email', 'E-mail'], ['reuniao', 'Reunião']]

export default function CRM({ usuarios = [], onClienteCriado, podeEditar = false }: { usuarios?: any[]; onClienteCriado?: () => void; podeEditar?: boolean }) {
  const [estagios, setEstagios] = useState<Estagio[]>([])
  const [negocios, setNegocios] = useState<Negocio[]>([])
  const [contatos, setContatos] = useState<Contato[]>([])
  const [carregando, setCarregando] = useState(true)
  const [novoModal, setNovoModal] = useState(false)
  const [aberto, setAberto] = useState<Negocio | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const [vista, setVista] = useState<'funil' | 'contatos' | 'playbook'>('funil')
  const [contatoModal, setContatoModal] = useState<Contato | null | 'novo'>(null)

  function carregar() {
    Promise.all([
      fetch('/api/crm/estagios').then(r => r.json()),
      fetch('/api/crm/negocios').then(r => r.json()),
      fetch('/api/crm/contatos').then(r => r.json()),
    ]).then(([e, n, c]) => {
      setEstagios(Array.isArray(e) ? e : [])
      setNegocios(Array.isArray(n) ? n : [])
      setContatos(Array.isArray(c) ? c : [])
      setCarregando(false)
    }).catch(() => setCarregando(false))
  }
  useEffect(() => { carregar() }, [])

  async function moverEstagio(neg: Negocio, estagioId: string) {
    if (neg.estagioId === estagioId) return
    setNegocios(ns => ns.map(n => n.id === neg.id ? { ...n, estagioId } : n))
    await fetch('/api/crm/negocios', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: neg.id, estagioId }) }).catch(() => {})
    carregar()
  }

  const contatoDe = (id?: string) => contatos.find(c => c.id === id)
  const totalPorEstagio = (eid: string) => negocios.filter(n => n.estagioId === eid).reduce((s, n) => s + (Number(n.valor) || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>CRM</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#999' }}>{vista === 'funil' ? 'Arraste os negócios entre as etapas. Clique para ver detalhes e a timeline.' : vista === 'contatos' ? 'Contatos de prospects e clientes.' : 'Roteiro de qualificação e cadência de mensagens para SDR/closer.'}</p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: '#f0f0f0', borderRadius: 10, padding: 3 }}>
          {([['funil', 'Funil'], ['contatos', 'Contatos'], ['playbook', 'Playbook']] as ['funil' | 'contatos' | 'playbook', string][]).map(([v, l]) => (
            <button key={v} onClick={() => setVista(v)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12.5, background: vista === v ? '#fff' : 'transparent', color: vista === v ? '#111' : '#888', boxShadow: vista === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{l}</button>
          ))}
        </div>
        {vista !== 'playbook' && (
          <button onClick={() => vista === 'funil' ? setNovoModal(true) : setContatoModal('novo')} style={{ marginLeft: 'auto', padding: '10px 18px', background: 'var(--marca, #ffc00f)', color: 'var(--marca-texto, #111)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ {vista === 'funil' ? 'Novo negócio' : 'Novo contato'}</button>
        )}
      </div>

      {carregando ? <p style={{ color: '#aaa' }}>Carregando...</p> : vista === 'contatos' ? (
        <ContatosLista contatos={contatos} negocios={negocios} onAbrir={c => setContatoModal(c)} />
      ) : vista === 'playbook' ? (
        <PlaybookVendas podeEditar={podeEditar} />
      ) : (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12, alignItems: 'flex-start' }}>
          {estagios.map(est => {
            const cards = negocios.filter(n => n.estagioId === est.id)
            const cor = est.ganho ? '#16a34a' : est.perdido ? '#b91c1c' : '#111'
            return (
              <div key={est.id}
                onDragOver={e => { e.preventDefault(); setOverCol(est.id) }}
                onDrop={() => { const n = negocios.find(x => x.id === dragId); if (n) moverEstagio(n, est.id); setDragId(null); setOverCol(null) }}
                style={{ flex: '0 0 270px', width: 270, background: overCol === est.id ? '#fff8e1' : '#f6f6f6', borderRadius: 12, padding: 10, minHeight: 120, border: overCol === est.id ? '1.5px dashed #ffc00f' : '1.5px solid transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 10px' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: cor }}>{est.nome}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#999' }}>{cards.length}</span>
                </div>
                {cards.length > 0 && <p style={{ margin: '0 6px 8px', fontSize: 11, color: '#999' }}>{fmtR$(totalPorEstagio(est.id))}</p>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {cards.map(n => {
                    const ct = contatoDe(n.contatoId)
                    return (
                      <div key={n.id} draggable onDragStart={() => setDragId(n.id)} onDragEnd={() => { setDragId(null); setOverCol(null) }}
                        onClick={() => setAberto(n)}
                        style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer', border: '1px solid #eee' }}>
                        <p style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 700, color: '#111' }}>{n.titulo}</p>
                        {!!n.valor && <p style={{ margin: '0 0 4px', fontSize: 12.5, fontWeight: 700, color: '#16a34a' }}>{fmtR$(n.valor)}</p>}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <span style={{ fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ct?.nome || 'Sem contato'}</span>
                          {n.donoNome && <span style={{ fontSize: 10, color: '#aaa', flexShrink: 0 }}>{n.donoNome.split(' ')[0]}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {novoModal && <NovoNegocioModal estagios={estagios} usuarios={usuarios} onClose={() => setNovoModal(false)} onSalvo={() => { setNovoModal(false); carregar() }} />}
      {aberto && <NegocioModal negocio={aberto} estagios={estagios} contato={contatoDe(aberto.contatoId)} usuarios={usuarios} onClose={() => setAberto(null)} onMudou={() => carregar()} onFechar={() => { setAberto(null); carregar() }} onClienteCriado={onClienteCriado} />}
      {contatoModal && <ContatoModal contato={contatoModal === 'novo' ? null : contatoModal} onClose={() => setContatoModal(null)} onSalvo={() => { setContatoModal(null); carregar() }} />}
    </div>
  )
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }

const CANAL: Record<string, { label: string; cor: string }> = {
  whatsapp: { label: 'WhatsApp', cor: '#16a34a' }, ligacao: { label: 'Ligação', cor: '#1d4ed8' }, email: { label: 'E-mail', cor: '#7c3aed' },
}
type Passo = { id: string; dia: number; canal: string; titulo: string; script: string }

function PlaybookVendas({ podeEditar }: { podeEditar: boolean }) {
  const [roteiro, setRoteiro] = useState('')
  const [cadencia, setCadencia] = useState<Passo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/crm/playbook').then(r => r.json()).then(d => { if (d && !d.error) { setRoteiro(d.roteiro || ''); setCadencia(Array.isArray(d.cadencia) ? d.cadencia : []) } setCarregando(false) }).catch(() => setCarregando(false))
  }, [])

  function copiar(p: Passo) { navigator.clipboard?.writeText(p.script).then(() => { setCopiado(p.id); setTimeout(() => setCopiado(null), 1500) }).catch(() => {}) }
  async function salvar() {
    setSalvando(true)
    const r = await fetch('/api/crm/playbook', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roteiro, cadencia }) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (r?.ok) { setCadencia(r.playbook.cadencia); setEditando(false) }
  }

  if (carregando) return <p style={{ color: '#aaa' }}>Carregando...</p>

  return (
    <div style={{ maxWidth: 820 }}>
      {podeEditar && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
          {editando ? (
            <>
              <button onClick={() => setCadencia(c => [...c, { id: Math.random().toString(36).slice(2), dia: (c[c.length - 1]?.dia || 0) + 2, canal: 'whatsapp', titulo: '', script: '' }])} style={{ padding: '8px 14px', background: '#f5f5f5', color: '#444', border: '1px solid #e0e0e0', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ Passo</button>
              <button onClick={salvar} disabled={salvando} style={{ padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>{salvando ? 'Salvando...' : 'Salvar'}</button>
            </>
          ) : (
            <button onClick={() => setEditando(true)} style={{ padding: '8px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Editar playbook</button>
          )}
        </div>
      )}

      {/* Roteiro de qualificação */}
      <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#111', display: 'block', marginBottom: 10 }}>Roteiro de qualificação</span>
        {editando
          ? <textarea value={roteiro} onChange={e => setRoteiro(e.target.value)} style={{ ...inputStyle, minHeight: 140, resize: 'vertical', lineHeight: 1.6 }} />
          : <p style={{ margin: 0, fontSize: 13.5, color: '#333', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{roteiro || '—'}</p>}
      </div>

      {/* Cadência */}
      <span style={{ fontSize: 13, fontWeight: 800, color: '#111', display: 'block', marginBottom: 10 }}>Cadência de contato</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cadencia.map((p, i) => {
          const c = CANAL[p.canal] || CANAL.whatsapp
          return (
            <div key={p.id} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #eee' }}>
              {editando ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ fontSize: 11, color: '#888' }}>Dia<input type="number" value={p.dia} onChange={e => setCadencia(arr => arr.map((x, j) => j === i ? { ...x, dia: Number(e.target.value) } : x))} style={{ width: 56, marginLeft: 6, padding: '6px 8px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 12 }} /></label>
                    <select value={p.canal} onChange={e => setCadencia(arr => arr.map((x, j) => j === i ? { ...x, canal: e.target.value } : x))} style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 12, background: '#fff' }}>
                      {Object.entries(CANAL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <input value={p.titulo} onChange={e => setCadencia(arr => arr.map((x, j) => j === i ? { ...x, titulo: e.target.value } : x))} placeholder="Título do passo" style={{ flex: 1, minWidth: 140, padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 12.5, fontWeight: 700 }} />
                    <button onClick={() => setCadencia(arr => arr.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 18 }}>×</button>
                  </div>
                  <textarea value={p.script} onChange={e => setCadencia(arr => arr.map((x, j) => j === i ? { ...x, script: e.target.value } : x))} placeholder="Script / mensagem..." style={{ ...inputStyle, minHeight: 64, resize: 'vertical', fontSize: 12.5 }} />
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: '#111', borderRadius: 999, padding: '3px 10px' }}>D{p.dia}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: c.cor, background: `${c.cor}18`, borderRadius: 999, padding: '3px 10px' }}>{c.label}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: '#111' }}>{p.titulo}</span>
                    <button onClick={() => copiar(p)} style={{ marginLeft: 'auto', padding: '6px 12px', background: copiado === p.id ? '#16a34a' : '#f5f5f5', color: copiado === p.id ? '#fff' : '#444', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}>{copiado === p.id ? 'Copiado!' : 'Copiar script'}</button>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: '#444', whiteSpace: 'pre-wrap', lineHeight: 1.6, background: '#fafafa', borderRadius: 8, padding: '10px 12px' }}>{p.script}</p>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ContatosLista({ contatos, negocios, onAbrir }: { contatos: Contato[]; negocios: Negocio[]; onAbrir: (c: Contato) => void }) {
  if (contatos.length === 0) return <div style={{ background: '#fff', borderRadius: 14, padding: '50px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}><p style={{ margin: 0, fontSize: 14, color: '#888' }}>Nenhum contato ainda.</p></div>
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
      {contatos.map(c => {
        const nNeg = negocios.filter(n => n.contatoId === c.id).length
        return (
          <div key={c.id} onClick={() => onAbrir(c)} style={{ background: '#fff', borderRadius: 12, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #eee', cursor: 'pointer' }}>
            <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#111' }}>{c.nome}</p>
            {c.empresa && <p style={{ margin: '0 0 4px', fontSize: 12, color: '#888' }}>{c.empresa}</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {c.telefone && <span style={{ fontSize: 12, color: '#555' }}>{c.telefone}</span>}
              {c.email && <span style={{ fontSize: 12, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</span>}
            </div>
            {nNeg > 0 && <span style={{ display: 'inline-block', marginTop: 8, fontSize: 10.5, fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', borderRadius: 999, padding: '2px 8px' }}>{nNeg} negócio(s)</span>}
          </div>
        )
      })}
    </div>
  )
}

function ContatoModal({ contato, onClose, onSalvo }: { contato: Contato | null; onClose: () => void; onSalvo: () => void }) {
  const [f, setF] = useState<any>({ nome: contato?.nome || '', empresa: (contato as any)?.empresa || '', telefone: contato?.telefone || '', email: contato?.email || '', cargo: (contato as any)?.cargo || '', observacoes: (contato as any)?.observacoes || '' })
  const [salvando, setSalvando] = useState(false)
  async function salvar() {
    if (!f.nome.trim()) return
    setSalvando(true)
    if (contato?.id) await fetch('/api/crm/contatos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: contato.id, ...f }) }).catch(() => {})
    else await fetch('/api/crm/contatos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) }).catch(() => {})
    setSalvando(false); onSalvo()
  }
  async function excluir() {
    if (!contato?.id || !confirm('Excluir este contato?')) return
    await fetch(`/api/crm/contatos?id=${contato.id}`, { method: 'DELETE' }).catch(() => {})
    onSalvo()
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 440, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#111' }}>{contato ? 'Editar contato' : 'Novo contato'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label style={labelStyle}>Nome *</label><input value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} style={inputStyle} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={labelStyle}>Empresa</label><input value={f.empresa} onChange={e => setF({ ...f, empresa: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Cargo</label><input value={f.cargo} onChange={e => setF({ ...f, cargo: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>WhatsApp / telefone</label><input value={f.telefone} onChange={e => setF({ ...f, telefone: e.target.value })} placeholder="+55..." style={inputStyle} /></div>
            <div><label style={labelStyle}>E-mail</label><input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} style={inputStyle} /></div>
          </div>
          <div><label style={labelStyle}>Observações</label><textarea value={f.observacoes} onChange={e => setF({ ...f, observacoes: e.target.value })} style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={salvar} disabled={salvando || !f.nome.trim()} style={{ flex: 1, padding: '11px 0', background: f.nome.trim() ? '#ffc00f' : '#f0f0f0', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: f.nome.trim() ? 'pointer' : 'not-allowed' }}>{salvando ? 'Salvando...' : contato ? 'Salvar' : 'Criar contato'}</button>
          {contato && <button onClick={excluir} style={{ padding: '11px 16px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Excluir</button>}
          <button onClick={onClose} style={{ padding: '11px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function NovoNegocioModal({ estagios, usuarios, onClose, onSalvo }: { estagios: Estagio[]; usuarios: any[]; onClose: () => void; onSalvo: () => void }) {
  const [f, setF] = useState({ titulo: '', valor: '', contatoNome: '', contatoTelefone: '', dono: '', origem: '', previsaoFechamento: '', estagioId: '', empresa: '', segmento: '', faturamentoEstimado: '', instagram: '', dores: '', solucoes: '' })
  const [salvando, setSalvando] = useState(false)
  const equipe = (usuarios || []).filter(u => u.role !== 'cliente')

  async function salvar() {
    if (!f.titulo.trim()) return
    setSalvando(true)
    let contatoId = ''
    if (f.contatoNome.trim()) {
      const c = await fetch('/api/crm/contatos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: f.contatoNome, telefone: f.contatoTelefone, empresa: f.empresa }) }).then(r => r.json()).catch(() => null)
      contatoId = c?.contato?.id || ''
    }
    const dono = equipe.find(u => u.email === f.dono)
    await fetch('/api/crm/negocios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: f.titulo, valor: Number(f.valor) || 0, contatoId, dono: f.dono, donoNome: dono?.nome || '', origem: f.origem, previsaoFechamento: f.previsaoFechamento, estagioId: f.estagioId, empresa: f.empresa, segmento: f.segmento, faturamentoEstimado: f.faturamentoEstimado, instagram: f.instagram, dores: f.dores, solucoes: f.solucoes }),
    }).catch(() => {})
    setSalvando(false); onSalvo()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#111' }}>Novo negócio</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label style={labelStyle}>Título *</label><input value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })} placeholder="Ex: Social Media - Clínica X" style={inputStyle} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={labelStyle}>Valor (R$)</label><input type="number" min="0" value={f.valor} onChange={e => setF({ ...f, valor: e.target.value })} placeholder="0" style={inputStyle} /></div>
            <div><label style={labelStyle}>Etapa</label>
              <select value={f.estagioId} onChange={e => setF({ ...f, estagioId: e.target.value })} style={{ ...inputStyle, background: '#fff' }}>
                <option value="">Primeira (Lead)</option>
                {estagios.filter(e => !e.ganho && !e.perdido).map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={labelStyle}>Contato</label><input value={f.contatoNome} onChange={e => setF({ ...f, contatoNome: e.target.value })} placeholder="Nome" style={inputStyle} /></div>
            <div><label style={labelStyle}>WhatsApp / telefone</label><input value={f.contatoTelefone} onChange={e => setF({ ...f, contatoTelefone: e.target.value })} placeholder="+55..." style={inputStyle} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={labelStyle}>Responsável</label>
              <select value={f.dono} onChange={e => setF({ ...f, dono: e.target.value })} style={{ ...inputStyle, background: '#fff' }}>
                <option value="">Eu</option>
                {equipe.map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Previsão</label><input type="date" value={f.previsaoFechamento} onChange={e => setF({ ...f, previsaoFechamento: e.target.value })} style={inputStyle} /></div>
          </div>
          <div><label style={labelStyle}>Origem</label><input value={f.origem} onChange={e => setF({ ...f, origem: e.target.value })} placeholder="Indicação, Instagram, tráfego..." style={inputStyle} /></div>

          <div style={{ height: 1, background: '#f0f0f0', margin: '2px 0' }} />
          <span style={{ fontSize: 12.5, fontWeight: 800, color: '#111' }}>Qualificação da oportunidade</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={labelStyle}>Empresa</label><input value={f.empresa} onChange={e => setF({ ...f, empresa: e.target.value })} placeholder="Nome da empresa" style={inputStyle} /></div>
            <div><label style={labelStyle}>Segmento / nicho</label><input value={f.segmento} onChange={e => setF({ ...f, segmento: e.target.value })} placeholder="Ex: Odontologia" style={inputStyle} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={labelStyle}>Faturamento estimado</label><input value={f.faturamentoEstimado} onChange={e => setF({ ...f, faturamentoEstimado: e.target.value })} placeholder="Ex: R$ 50-100k/mês" style={inputStyle} /></div>
            <div><label style={labelStyle}>Instagram / site</label><input value={f.instagram} onChange={e => setF({ ...f, instagram: e.target.value })} placeholder="@empresa ou site" style={inputStyle} /></div>
          </div>
          <div><label style={labelStyle}>Principais dores / desafios</label><textarea value={f.dores} onChange={e => setF({ ...f, dores: e.target.value })} placeholder="O que mais incomoda o prospect hoje..." style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} /></div>
          <div><label style={labelStyle}>Possíveis soluções</label><textarea value={f.solucoes} onChange={e => setF({ ...f, solucoes: e.target.value })} placeholder="O que podemos oferecer / proposta de valor..." style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={salvar} disabled={salvando || !f.titulo.trim()} style={{ flex: 1, padding: '11px 0', background: f.titulo.trim() ? '#ffc00f' : '#f0f0f0', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: f.titulo.trim() ? 'pointer' : 'not-allowed' }}>{salvando ? 'Salvando...' : 'Criar negócio'}</button>
          <button onClick={onClose} style={{ padding: '11px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function NegocioModal({ negocio, estagios, contato, usuarios, onClose, onMudou, onFechar, onClienteCriado }: { negocio: Negocio; estagios: Estagio[]; contato?: Contato; usuarios: any[]; onClose: () => void; onMudou: () => void; onFechar: () => void; onClienteCriado?: () => void }) {
  const [neg, setNeg] = useState<Negocio>(negocio)
  const [tipoAtiv, setTipoAtiv] = useState('nota')
  const [textoAtiv, setTextoAtiv] = useState('')
  const [converter, setConverter] = useState(false)
  const estagio = estagios.find(e => e.id === neg.estagioId)

  async function patch(updates: any) {
    const r = await fetch('/api/crm/negocios', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: neg.id, ...updates }) }).then(x => x.json()).catch(() => null)
    if (r?.negocio) setNeg(r.negocio)
    onMudou()
  }
  async function addAtividade() {
    if (!textoAtiv.trim()) return
    await patch({ novaAtividade: { tipo: tipoAtiv, texto: textoAtiv.trim() } })
    setTextoAtiv('')
  }
  async function excluir() {
    if (!confirm('Excluir este negócio?')) return
    await fetch(`/api/crm/negocios?id=${neg.id}`, { method: 'DELETE' }).catch(() => {})
    onFechar()
  }

  const tl = [...(neg.atividades || [])].reverse()

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 560, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <input value={neg.titulo} onChange={e => setNeg({ ...neg, titulo: e.target.value })} onBlur={() => patch({ titulo: neg.titulo })}
            style={{ flex: 1, fontSize: 17, fontWeight: 800, color: '#111', border: 'none', outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', borderRadius: 999, padding: '4px 12px' }}>{fmtR$(neg.valor)}</span>
          <select value={neg.estagioId} onChange={e => patch({ estagioId: e.target.value })} style={{ fontSize: 12, fontWeight: 700, borderRadius: 999, padding: '4px 12px', border: '1.5px solid #e0e0e0', background: '#fff', cursor: 'pointer' }}>
            {estagios.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
          {neg.status === 'ganho' && <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: '#16a34a', borderRadius: 999, padding: '4px 12px' }}>GANHO</span>}
          {neg.status === 'perdido' && <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: '#b91c1c', borderRadius: 999, padding: '4px 12px' }}>PERDIDO</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Valor (R$)</label>
            <input type="number" min="0" value={neg.valor || 0} onChange={e => setNeg({ ...neg, valor: Number(e.target.value) })} onBlur={() => patch({ valor: neg.valor })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Responsável</label>
            <select value={neg.dono || ''} onChange={e => { const u = (usuarios || []).find((x: any) => x.email === e.target.value); patch({ dono: e.target.value, donoNome: u?.nome || '' }) }} style={{ ...inputStyle, background: '#fff' }}>
              <option value="">—</option>
              {(usuarios || []).filter(u => u.role !== 'cliente').map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}
            </select>
          </div>
        </div>

        {contato && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#fafafa', borderRadius: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111' }}>{contato.nome}</p>
              {contato.telefone && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>{contato.telefone}</p>}
            </div>
            {contato.telefone && (
              <a href={`https://wa.me/${(contato.telefone || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: '#25D366', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>WhatsApp</a>
            )}
          </div>
        )}

        {/* Qualificação */}
        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12, marginBottom: 14 }}>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: '#111', display: 'block', marginBottom: 10 }}>Qualificação</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label style={labelStyle}>Empresa</label><input value={neg.empresa || ''} onChange={e => setNeg({ ...neg, empresa: e.target.value })} onBlur={() => patch({ empresa: neg.empresa })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Segmento</label><input value={neg.segmento || ''} onChange={e => setNeg({ ...neg, segmento: e.target.value })} onBlur={() => patch({ segmento: neg.segmento })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Faturamento estimado</label><input value={neg.faturamentoEstimado || ''} onChange={e => setNeg({ ...neg, faturamentoEstimado: e.target.value })} onBlur={() => patch({ faturamentoEstimado: neg.faturamentoEstimado })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Instagram / site</label><input value={neg.instagram || ''} onChange={e => setNeg({ ...neg, instagram: e.target.value })} onBlur={() => patch({ instagram: neg.instagram })} style={inputStyle} /></div>
          </div>
          <div style={{ marginBottom: 10 }}><label style={labelStyle}>Principais dores</label><textarea value={neg.dores || ''} onChange={e => setNeg({ ...neg, dores: e.target.value })} onBlur={() => patch({ dores: neg.dores })} style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} /></div>
          <div><label style={labelStyle}>Possíveis soluções</label><textarea value={neg.solucoes || ''} onChange={e => setNeg({ ...neg, solucoes: e.target.value })} onBlur={() => patch({ solucoes: neg.solucoes })} style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} /></div>
        </div>

        {/* Timeline */}
        <label style={labelStyle}>Atividades</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <select value={tipoAtiv} onChange={e => setTipoAtiv(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 12, fontFamily: 'inherit', background: '#fff' }}>
            {TIPOS_ATIV.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <input value={textoAtiv} onChange={e => setTextoAtiv(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addAtividade() }} placeholder="Registrar interação / nota..." style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 12.5, fontFamily: 'inherit' }} />
          <button onClick={addAtividade} disabled={!textoAtiv.trim()} style={{ padding: '8px 14px', background: textoAtiv.trim() ? '#111' : '#f0f0f0', color: textoAtiv.trim() ? '#fff' : '#aaa', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Add</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto', marginBottom: 16 }}>
          {tl.length === 0 && <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>Nenhuma atividade ainda.</p>}
          {tl.map(a => (
            <div key={a.id} style={{ display: 'flex', gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: a.tipo === 'ganho' ? '#16a34a' : a.tipo === 'perdido' ? '#b91c1c' : a.tipo === 'estagio' ? '#ffc00f' : '#1d4ed8', marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12.5, color: '#333' }}>{a.texto}</p>
                <p style={{ margin: '1px 0 0', fontSize: 10.5, color: '#aaa' }}>{a.autor} · {new Date(a.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Concretizar venda (Ganho -> Cliente) */}
        {neg.clienteId ? (
          <div style={{ padding: '11px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, marginBottom: 12, fontSize: 12.5, color: '#166534', fontWeight: 700 }}>✓ Venda concretizada — cliente criado e entregas aplicadas.</div>
        ) : (
          <button onClick={() => setConverter(true)} style={{ width: '100%', padding: '12px 0', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer', marginBottom: 12 }}>
            Concretizar venda → criar cliente
          </button>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Fechar</button>
          <button onClick={excluir} style={{ padding: '11px 16px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Excluir</button>
        </div>
      </div>
      {converter && <ConversaoModal negocio={neg} contato={contato} onClose={() => setConverter(false)} onConvertido={(clienteId) => { setNeg({ ...neg, clienteId, status: 'ganho' }); setConverter(false); onMudou(); onClienteCriado?.() }} />}
    </div>
  )
}

function ConversaoModal({ negocio, contato, onClose, onConvertido }: { negocio: Negocio; contato?: Contato; onClose: () => void; onConvertido: (clienteId: string) => void }) {
  const [c, setC] = useState({
    nome: negocio.empresa || contato?.nome || negocio.titulo || '',
    instagram: negocio.instagram || '',
    loginEmail: contato?.email || '',
    contratoValor: String(negocio.valor || ''),
  })
  const [h, setH] = useState({ escopoVendido: negocio.solucoes || '', expectativas: '', detalhes: negocio.dores || '', observacoes: '' })
  const [templates, setTemplates] = useState<{ id: string; nome: string }[]>([])
  const [templateId, setTemplateId] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [resultado, setResultado] = useState<{ clienteId: string; marcos: number; tarefas: number; loginSenha?: string } | null>(null)

  useEffect(() => { fetch('/api/templates').then(r => r.json()).then(d => setTemplates(Array.isArray(d) ? d : [])).catch(() => {}) }, [])

  async function concretizar() {
    if (!c.nome.trim()) { setErro('Informe o nome do cliente.'); return }
    setSalvando(true); setErro('')
    const r = await fetch('/api/crm/converter', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ negocioId: negocio.id, cliente: { nome: c.nome, instagram: c.instagram, loginEmail: c.loginEmail || '', contratoValor: Number(c.contratoValor) || 0 }, handoff: h, templateId }),
    }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (!r || r.error) { setErro(r?.error || 'Falha ao converter.'); return }
    setResultado(r)
  }

  if (resultado) {
    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
        <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 440, width: '100%', padding: 24, textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#111' }}>Venda concretizada! 🎉</h3>
          <p style={{ margin: '0 0 6px', fontSize: 13.5, color: '#555' }}>Cliente <b>{c.nome}</b> criado, com <b>{resultado.marcos}</b> etapas e <b>{resultado.tarefas}</b> tarefas no Playbook.</p>
          {resultado.loginSenha && (
            <div style={{ margin: '10px 0', padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, fontSize: 12.5, color: '#92400e' }}>
              Acesso do cliente criado. Senha: <b style={{ userSelect: 'all' }}>{resultado.loginSenha}</b> — anote/envie ao cliente.
            </div>
          )}
          <button onClick={() => onConvertido(resultado.clienteId)} style={{ marginTop: 10, width: '100%', padding: '12px 0', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Concluir</button>
        </div>
      </div>
    )
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 520, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 17, color: '#111' }}>Passagem de bastão → Onboarding</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#999' }}>Quanto mais detalhe o closer passar, melhor o onboarding do cliente pelo Gestor.</p>

        <span style={{ fontSize: 12.5, fontWeight: 800, color: '#111' }}>Cliente</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '8px 0 16px' }}>
          <div><label style={labelStyle}>Nome *</label><input value={c.nome} onChange={e => setC({ ...c, nome: e.target.value })} style={inputStyle} /></div>
          <div><label style={labelStyle}>Instagram</label><input value={c.instagram} onChange={e => setC({ ...c, instagram: e.target.value })} placeholder="@cliente" style={inputStyle} /></div>
          <div><label style={labelStyle}>E-mail de acesso (opcional)</label><input value={c.loginEmail} onChange={e => setC({ ...c, loginEmail: e.target.value })} placeholder="cria login do portal" style={inputStyle} /></div>
          <div><label style={labelStyle}>Valor do contrato (R$)</label><input type="number" min="0" value={c.contratoValor} onChange={e => setC({ ...c, contratoValor: e.target.value })} style={inputStyle} /></div>
        </div>

        <span style={{ fontSize: 12.5, fontWeight: 800, color: '#111' }}>Handoff (Closer → Gestor)</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '8px 0 16px' }}>
          <div><label style={labelStyle}>Escopo vendido / entregáveis</label><textarea value={h.escopoVendido} onChange={e => setH({ ...h, escopoVendido: e.target.value })} style={{ ...inputStyle, minHeight: 54, resize: 'vertical' }} /></div>
          <div><label style={labelStyle}>Expectativas e objetivos do cliente</label><textarea value={h.expectativas} onChange={e => setH({ ...h, expectativas: e.target.value })} style={{ ...inputStyle, minHeight: 54, resize: 'vertical' }} /></div>
          <div><label style={labelStyle}>Detalhes importantes (decisor, prazos prometidos, sensibilidades)</label><textarea value={h.detalhes} onChange={e => setH({ ...h, detalhes: e.target.value })} style={{ ...inputStyle, minHeight: 54, resize: 'vertical' }} /></div>
          <div><label style={labelStyle}>Observações</label><textarea value={h.observacoes} onChange={e => setH({ ...h, observacoes: e.target.value })} style={{ ...inputStyle, minHeight: 44, resize: 'vertical' }} /></div>
        </div>

        <span style={{ fontSize: 12.5, fontWeight: 800, color: '#111' }}>Entregas (onboarding)</span>
        <div style={{ margin: '8px 0 16px' }}>
          <label style={labelStyle}>Modelo de projeto a aplicar (gera marcos + tarefas)</label>
          <select value={templateId} onChange={e => setTemplateId(e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
            <option value="">Não aplicar modelo agora</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
          {templates.length === 0 && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#ea580c' }}>Nenhum modelo cadastrado. Crie em Modelos para montar o escopo automaticamente.</p>}
        </div>

        {erro && <p style={{ margin: '0 0 10px', fontSize: 12.5, color: '#b91c1c', fontWeight: 700 }}>{erro}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={concretizar} disabled={salvando || !c.nome.trim()} style={{ flex: 1, padding: '12px 0', background: c.nome.trim() ? '#16a34a' : '#f0f0f0', color: c.nome.trim() ? '#fff' : '#aaa', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: c.nome.trim() ? 'pointer' : 'not-allowed' }}>{salvando ? 'Concretizando...' : 'Concretizar venda'}</button>
          <button onClick={onClose} style={{ padding: '12px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
