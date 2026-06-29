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
}

const fmtR$ = (v?: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const TIPOS_ATIV: [string, string][] = [['nota', 'Nota'], ['ligacao', 'Ligação'], ['whatsapp', 'WhatsApp'], ['email', 'E-mail'], ['reuniao', 'Reunião']]

export default function CRM({ usuarios = [] }: { usuarios?: any[] }) {
  const [estagios, setEstagios] = useState<Estagio[]>([])
  const [negocios, setNegocios] = useState<Negocio[]>([])
  const [contatos, setContatos] = useState<Contato[]>([])
  const [carregando, setCarregando] = useState(true)
  const [novoModal, setNovoModal] = useState(false)
  const [aberto, setAberto] = useState<Negocio | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)

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
          <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>CRM — Funil de vendas</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#999' }}>Arraste os negócios entre as etapas. Clique para ver detalhes e a timeline.</p>
        </div>
        <button onClick={() => setNovoModal(true)} style={{ marginLeft: 'auto', padding: '10px 18px', background: 'var(--marca, #ffc00f)', color: 'var(--marca-texto, #111)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Novo negócio</button>
      </div>

      {carregando ? <p style={{ color: '#aaa' }}>Carregando...</p> : (
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
      {aberto && <NegocioModal negocio={aberto} estagios={estagios} contato={contatoDe(aberto.contatoId)} usuarios={usuarios} onClose={() => setAberto(null)} onMudou={() => carregar()} onFechar={() => { setAberto(null); carregar() }} />}
    </div>
  )
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }

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

function NegocioModal({ negocio, estagios, contato, usuarios, onClose, onMudou, onFechar }: { negocio: Negocio; estagios: Estagio[]; contato?: Contato; usuarios: any[]; onClose: () => void; onMudou: () => void; onFechar: () => void }) {
  const [neg, setNeg] = useState<Negocio>(negocio)
  const [tipoAtiv, setTipoAtiv] = useState('nota')
  const [textoAtiv, setTextoAtiv] = useState('')
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

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Fechar</button>
          <button onClick={excluir} style={{ padding: '11px 16px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Excluir</button>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 11, color: '#bbb', textAlign: 'center' }}>A conversão "Ganho → Cliente" (passagem de bastão + entregas) chega na próxima etapa.</p>
      </div>
    </div>
  )
}
