'use client'
import { useEffect, useState } from 'react'

type Cliente = { id: string; nome: string; logo?: string; corPrimaria?: string; segmento?: string; palavrasChave?: string }
type Briefing = {
  id: string; clienteId: string; clienteNome: string; titulo: string; marcoId?: string; objetivo: string
  plataformas: string[]; verba?: string; periodo?: string; publico?: string; oferta?: string
  observacoes?: string; conteudo: string; criadoPor: string; criadoEm: string; atualizadoEm: string
}

const OBJETIVOS = ['Vendas / conversão', 'Geração de leads', 'Alcance / reconhecimento', 'Engajamento', 'Tráfego', 'Mensagens / WhatsApp']
const PLATAFORMAS = ['Meta (Instagram/Facebook)', 'Google', 'TikTok', 'LinkedIn', 'YouTube']

const vazio = { titulo: '', marcoId: '', objetivo: OBJETIVOS[0], plataformas: ['Meta (Instagram/Facebook)'] as string[], verba: '', periodo: '', publico: '', oferta: '', observacoes: '', conteudo: '' }

type Marco = { id: string; titulo: string; clienteId: string; status: string }

export default function Briefings({ clientes }: { clientes: Cliente[] }) {
  const [briefings, setBriefings] = useState<Briefing[]>([])
  const [marcos, setMarcos] = useState<Marco[]>([])
  const [modo, setModo] = useState<'lista' | 'editor'>('lista')
  const [editId, setEditId] = useState<string | null>(null)
  const [clienteId, setClienteId] = useState('')
  const [form, setForm] = useState<typeof vazio>({ ...vazio })
  const [gerando, setGerando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [refino, setRefino] = useState('')
  const [erro, setErro] = useState('')
  const [relacionando, setRelacionando] = useState(false)
  const [relMsg, setRelMsg] = useState('')

  function carregar() {
    fetch('/api/briefings').then(r => r.json()).then(d => setBriefings(Array.isArray(d) ? d : [])).catch(() => {})
  }
  useEffect(() => { carregar() }, [])

  // Marcos (etapas do Playbook) do cliente selecionado — vinculo obrigatorio
  useEffect(() => {
    if (!clienteId) { setMarcos([]); return }
    fetch(`/api/playbook?clienteId=${clienteId}`).then(r => r.json()).then(d => setMarcos(Array.isArray(d) ? d : [])).catch(() => {})
  }, [clienteId])

  function novo() {
    setEditId(null); setClienteId(''); setForm({ ...vazio }); setRefino(''); setErro(''); setModo('editor')
  }
  function abrir(b: Briefing) {
    setEditId(b.id); setClienteId(b.clienteId)
    setForm({ titulo: b.titulo, marcoId: b.marcoId || '', objetivo: b.objetivo, plataformas: b.plataformas || [], verba: b.verba || '', periodo: b.periodo || '', publico: b.publico || '', oferta: b.oferta || '', observacoes: b.observacoes || '', conteudo: b.conteudo || '' })
    setRefino(''); setErro(''); setModo('editor')
  }

  async function gerar(comRefino = false) {
    if (!clienteId) { setErro('Selecione um cliente.'); return }
    setErro(''); setGerando(true)
    const r = await fetch('/api/briefings/gerar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clienteId, objetivo: form.objetivo, plataformas: form.plataformas, verba: form.verba,
        periodo: form.periodo, publico: form.publico, oferta: form.oferta, observacoes: form.observacoes,
        ...(comRefino ? { refino, conteudoAtual: form.conteudo } : {}),
      }),
    }).then(x => x.json()).catch(() => ({ error: 'falha de conexão' }))
    setGerando(false)
    if (r?.error) { setErro(r.error); return }
    setForm(f => ({ ...f, conteudo: r.conteudo }))
    setRefino('')
  }

  async function salvar() {
    if (!clienteId) { setErro('Selecione um cliente.'); return }
    if (!form.marcoId) { setErro('Vincule a campanha a uma etapa do Playbook.'); return }
    if (!form.conteudo.trim()) { setErro('Gere ou escreva o conteúdo do briefing antes de salvar.'); return }
    setSalvando(true)
    const cli = clientes.find(c => c.id === clienteId)
    const body = { ...form, clienteId, clienteNome: cli?.nome || '' }
    if (editId) await fetch('/api/briefings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId, ...body }) })
    else await fetch('/api/briefings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSalvando(false)
    setModo('lista')
    carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este briefing?')) return
    await fetch(`/api/briefings?id=${id}`, { method: 'DELETE' })
    carregar()
  }

  async function relacionarTarefa() {
    if (!editId) return
    setRelacionando(true); setRelMsg('')
    const r = await fetch('/api/briefings/relacionar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ briefingId: editId }),
    }).then(x => x.json()).catch(() => null)
    setRelacionando(false)
    if (!r || r.error) { setRelMsg(r?.error || 'Não foi possível relacionar.'); return }
    setRelMsg(r.jaVinculada ? 'Já havia uma tarefa de campanha vinculada.' : 'Tarefa de campanha criada e vinculada.')
    setTimeout(() => setRelMsg(''), 8000)
  }

  function togglePlataforma(p: string) {
    setForm(f => ({ ...f, plataformas: f.plataformas.includes(p) ? f.plataformas.filter(x => x !== p) : [...f.plataformas, p] }))
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }
  const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }

  if (modo === 'lista') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Briefings de campanha</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#999' }}>Crie briefings de campanha com a IA, a partir do Brand Board do cliente.</p>
          </div>
          <button onClick={novo} className="soma10-no-invert" style={{ padding: '10px 18px', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Novo briefing</button>
        </div>

        {briefings.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, padding: '50px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <p style={{ margin: 0, fontSize: 14, color: '#888' }}>Nenhum briefing ainda.</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#bbb' }}>Clique em "Novo briefing" para gerar o primeiro com a IA.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {briefings.map(b => {
              const cli = clientes.find(c => c.id === b.clienteId)
              return (
                <div key={b.id} onClick={() => abrir(b)} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer', border: '1px solid #eee' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', background: cli?.corPrimaria || '#eee', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#111' }}>
                      {cli?.logo ? <img src={cli.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (b.clienteNome[0]?.toUpperCase() || '?')}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#888' }}>{b.clienteNome}</span>
                  </div>
                  <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: '#111' }}>{b.titulo}</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {b.objetivo && <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', background: '#f3e8ff', borderRadius: 999, padding: '2px 8px' }}>{b.objetivo}</span>}
                    {(b.plataformas || []).slice(0, 2).map(p => <span key={p} style={{ fontSize: 10, color: '#666', background: '#f0f0f0', borderRadius: 999, padding: '2px 8px' }}>{p.split(' ')[0]}</span>)}
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: '#aaa' }}>{new Date(b.atualizadoEm || b.criadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // EDITOR
  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <button onClick={() => setModo('lista')} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#666', cursor: 'pointer' }}>Voltar</button>
        <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>{editId ? 'Editar briefing' : 'Novo briefing'}</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 18, alignItems: 'start' }}>
        {/* Coluna de parametros */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={label}>Cliente *</label>
            <select value={clienteId} onChange={e => setClienteId(e.target.value)} style={{ ...inputStyle, background: '#fff' }} disabled={!!editId}>
              <option value="">Selecione...</option>
              {[...clientes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt')).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            {clienteId && !clientes.find(c => c.id === clienteId)?.segmento && (
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#ea580c' }}>Este cliente não tem Brand Board preenchido — o briefing fica mais rico se você preencher a Marca antes.</p>
            )}
          </div>
          <div>
            <label style={label}>Título da campanha</label>
            <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Black Friday 2026" style={inputStyle} />
          </div>
          <div>
            <label style={label}>Etapa do Playbook *</label>
            <select value={form.marcoId} onChange={e => setForm(f => ({ ...f, marcoId: e.target.value }))} style={{ ...inputStyle, background: '#fff' }} disabled={!clienteId}>
              <option value="">{!clienteId ? 'Selecione um cliente primeiro' : marcos.length === 0 ? 'Nenhuma etapa — crie no Playbook' : 'Selecione a etapa...'}</option>
              {marcos.map(m => <option key={m.id} value={m.id}>{m.titulo}</option>)}
            </select>
            {clienteId && marcos.length === 0 && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#ea580c' }}>Este cliente não tem etapas no Playbook. Crie uma etapa antes de salvar a campanha.</p>}
          </div>
          <div>
            <label style={label}>Objetivo</label>
            <select value={form.objetivo} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))} style={{ ...inputStyle, background: '#fff' }}>
              {OBJETIVOS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Plataformas</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PLATAFORMAS.map(p => {
                const on = form.plataformas.includes(p)
                return <button key={p} type="button" onClick={() => togglePlataforma(p)} style={{ padding: '6px 10px', borderRadius: 8, border: on ? '1.5px solid #7c3aed' : '1px solid #e0e0e0', background: on ? '#f3e8ff' : '#fff', color: on ? '#7c3aed' : '#666', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{p.split(' ')[0]}</button>
              })}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={label}>Verba</label><input value={form.verba} onChange={e => setForm(f => ({ ...f, verba: e.target.value }))} placeholder="R$ 3.000" style={inputStyle} /></div>
            <div><label style={label}>Período</label><input value={form.periodo} onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))} placeholder="2 semanas" style={inputStyle} /></div>
          </div>
          <div><label style={label}>Público desta campanha</label><textarea value={form.publico} onChange={e => setForm(f => ({ ...f, publico: e.target.value }))} placeholder="Quem queremos atingir nesta campanha..." style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} /></div>
          <div><label style={label}>Oferta / promoção</label><input value={form.oferta} onChange={e => setForm(f => ({ ...f, oferta: e.target.value }))} placeholder="Ex: 30% off, brinde, frete grátis" style={inputStyle} /></div>
          <div><label style={label}>Observações</label><textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Qualquer direcionamento extra..." style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} /></div>

          <button onClick={() => gerar(false)} disabled={gerando || !clienteId} className="soma10-no-invert" style={{ padding: '11px 0', background: (gerando || !clienteId) ? '#f0f0f0' : '#ffc00f', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: (gerando || !clienteId) ? 'not-allowed' : 'pointer' }}>
            {gerando ? 'Gerando com IA...' : form.conteudo ? 'Gerar novamente' : 'Gerar com IA'}
          </button>
          {erro && <p style={{ margin: 0, fontSize: 12, color: '#b91c1c' }}>{erro}</p>}
        </div>

        {/* Coluna do conteudo */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 400 }}>
          <label style={label}>Briefing {gerando && <span style={{ color: '#7c3aed' }}>· gerando...</span>}</label>
          <textarea value={form.conteudo} onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))} placeholder="O briefing gerado pela IA aparece aqui. Você também pode escrever/editar manualmente."
            style={{ width: '100%', flex: 1, minHeight: 360, padding: '14px 16px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, lineHeight: 1.6, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />

          {form.conteudo && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={refino} onChange={e => setRefino(e.target.value)} placeholder='Peça um ajuste à IA (ex: "mais agressivo", "foco em remarketing")'
                style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, fontFamily: 'inherit' }}
                onKeyDown={e => { if (e.key === 'Enter' && refino.trim() && !gerando) gerar(true) }} />
              <button onClick={() => gerar(true)} disabled={gerando || !refino.trim()} style={{ padding: '9px 16px', background: refino.trim() && !gerando ? '#111' : '#f0f0f0', color: refino.trim() && !gerando ? '#fff' : '#aaa', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: refino.trim() && !gerando ? 'pointer' : 'not-allowed' }}>Refinar</button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={salvar} disabled={salvando || !form.conteudo.trim()} className="soma10-no-invert" style={{ flex: 1, padding: '11px 0', background: form.conteudo.trim() ? '#ffc00f' : '#f0f0f0', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: form.conteudo.trim() ? 'pointer' : 'not-allowed' }}>
              {salvando ? 'Salvando...' : editId ? 'Salvar alterações' : 'Salvar briefing'}
            </button>
            {editId && (
              <button onClick={relacionarTarefa} disabled={relacionando} title="Cria uma tarefa do tipo Campanha vinculada a este briefing" style={{ padding: '11px 16px', background: '#fff', color: '#111', border: '1.5px solid #111', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: relacionando ? 'not-allowed' : 'pointer', opacity: relacionando ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                {relacionando ? 'Relacionando...' : 'Relacionar a tarefa'}
              </button>
            )}
            {editId && (
              <button onClick={() => excluir(editId)} style={{ padding: '11px 16px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Excluir</button>
            )}
          </div>
          {relMsg && <p style={{ margin: '2px 0 0', fontSize: 12.5, fontWeight: 700, color: relMsg.startsWith('Não') ? '#b91c1c' : '#16a34a' }}>{relMsg}</p>}
        </div>
      </div>
    </div>
  )
}
