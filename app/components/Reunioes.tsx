'use client'
import { useEffect, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'
import { fecharFora } from '@/lib/fecharModal'

// Reuniões internas (Pessoas e Cultura): pauta antes, ata depois, e decisões
// que viram tarefas com responsável e prazo — pra reunião não morrer na sala.

type Decisao = { id: string; texto: string; responsavelEmail?: string; responsavelNome?: string; prazo?: string; tarefaId?: string }
type Reuniao = { id: string; titulo: string; data: string; participantes?: string; pauta?: string; ata?: string; decisoes?: Decisao[]; status: 'agendada' | 'realizada'; criadoEm: string }
type Usuario = { nome: string; email: string }

const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit' }
const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 5 }

function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function Reunioes({ usuarios = [], podeEditar = true }: { usuarios?: Usuario[]; podeEditar?: boolean }) {
  const [reunioes, setReunioes] = useState<Reuniao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aberta, setAberta] = useState<Reuniao | null>(null)
  const [nova, setNova] = useState(false)
  const [salvando, setSalvando] = useState(false)

  function carregar() {
    fetch('/api/reunioes').then(r => r.json())
      .then(d => { if (Array.isArray(d?.reunioes)) setReunioes(d.reunioes) })
      .catch(() => {}).finally(() => setCarregando(false))
  }
  useEffect(() => { carregar() }, [])

  const proximas = reunioes.filter(r => r.status === 'agendada')
  const realizadas = reunioes.filter(r => r.status === 'realizada')

  async function criar(form: { titulo: string; data: string; participantes: string; pauta: string }) {
    setSalvando(true)
    const r = await fetch('/api/reunioes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, data: new Date(form.data).toISOString() }) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (r?.ok) { toast('Reunião criada.', 'sucesso'); setNova(false); carregar(); setAberta(r.reuniao) }
    else toast(r?.error || 'Falha ao criar.', 'erro')
  }

  async function salvar(r: Reuniao, extra: any = {}) {
    setSalvando(true)
    const resp = await fetch('/api/reunioes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...r, ...extra }) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (resp?.ok) { setAberta(resp.reuniao); carregar(); return resp.reuniao }
    toast(resp?.error || 'Falha ao salvar.', 'erro')
    return null
  }

  async function excluir(id: string) {
    if (!(await confirmar('Excluir esta reunião (pauta, ata e decisões)? Tarefas já criadas continuam existindo.', { titulo: 'Excluir reunião', okLabel: 'Excluir', perigo: true }))) return
    await fetch('/api/reunioes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {})
    setAberta(null); carregar()
  }

  function Linha({ r }: { r: Reuniao }) {
    const dec = r.decisoes || []
    return (
      <div onClick={() => setAberta(r)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#fff', borderRadius: 12, border: '1px solid #f0f0f0', cursor: 'pointer' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.titulo}</p>
          <p style={{ margin: '3px 0 0', fontSize: 11.5, color: '#999' }}>
            {new Date(r.data).toLocaleDateString('pt-BR')} {new Date(r.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            {r.participantes ? ` · ${r.participantes}` : ''}
          </p>
        </div>
        {dec.length > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5', background: '#eef2ff', borderRadius: 999, padding: '3px 10px', flexShrink: 0 }}>{dec.length} decisão(ões)</span>}
        <span style={{ fontSize: 11, fontWeight: 800, color: r.status === 'realizada' ? '#166534' : '#a16207', background: r.status === 'realizada' ? '#dcfce7' : '#fef3c7', borderRadius: 999, padding: '3px 10px', flexShrink: 0 }}>
          {r.status === 'realizada' ? 'Realizada' : 'Agendada'}
        </span>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: '#111' }}>Reuniões internas</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#999' }}>Pauta antes, ata depois — e cada decisão pode virar uma tarefa com dono e prazo.</p>
        </div>
        <span style={{ flex: 1 }} />
        {podeEditar && <button onClick={() => setNova(true)} style={{ padding: '10px 18px', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Nova reunião</button>}
      </div>

      {carregando ? <p style={{ color: '#aaa', fontSize: 13 }}>Carregando...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 760 }}>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Próximas</p>
            {proximas.length === 0 && <p style={{ margin: 0, fontSize: 12.5, color: '#bbb' }}>Nenhuma reunião agendada.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{proximas.map(r => <Linha key={r.id} r={r} />)}</div>
          </div>
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Realizadas (atas)</p>
            {realizadas.length === 0 && <p style={{ margin: 0, fontSize: 12.5, color: '#bbb' }}>Nenhuma ata registrada ainda.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{realizadas.map(r => <Linha key={r.id} r={r} />)}</div>
          </div>
        </div>
      )}

      {nova && <NovaReuniaoModal salvando={salvando} onCriar={criar} onClose={() => setNova(false)} />}
      {aberta && (
        <ReuniaoModal
          reuniao={aberta} usuarios={usuarios} salvando={salvando} podeEditar={podeEditar}
          onSalvar={salvar} onExcluir={() => excluir(aberta.id)} onClose={() => { setAberta(null); carregar() }}
        />
      )}
    </div>
  )
}

function NovaReuniaoModal({ onCriar, onClose, salvando }: { onCriar: (f: any) => void; onClose: () => void; salvando: boolean }) {
  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1); amanha.setHours(9, 0, 0, 0)
  const [f, setF] = useState({ titulo: '', data: toLocalInput(amanha), participantes: '', pauta: '' })
  return (
    <div onClick={fecharFora(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 16.5, color: '#111' }}>Nova reunião</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label style={label}>Título *</label><input value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })} placeholder="Ex: Alinhamento semanal da equipe" style={input} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={label}>Data e hora *</label><input type="datetime-local" value={f.data} onChange={e => setF({ ...f, data: e.target.value })} style={input} /></div>
            <div><label style={label}>Participantes</label><input value={f.participantes} onChange={e => setF({ ...f, participantes: e.target.value })} placeholder="Ex: Dra. Ana, recepção" style={input} /></div>
          </div>
          <div><label style={label}>Pauta (o que será discutido)</label><textarea lang="pt-BR" spellCheck value={f.pauta} onChange={e => setF({ ...f, pauta: e.target.value })} rows={5} placeholder={'1. Agenda da semana\n2. Pendências de orçamentos\n3. ...'} style={{ ...input, resize: 'vertical' }} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 16px', background: '#f0f0f0', border: 'none', borderRadius: 9, color: '#666', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => onCriar(f)} disabled={salvando || !f.titulo.trim()} style={{ padding: '10px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: f.titulo.trim() ? 1 : 0.5 }}>{salvando ? 'Criando…' : 'Criar'}</button>
        </div>
      </div>
    </div>
  )
}

function ReuniaoModal({ reuniao, usuarios, salvando, podeEditar, onSalvar, onExcluir, onClose }: {
  reuniao: Reuniao; usuarios: Usuario[]; salvando: boolean; podeEditar: boolean
  onSalvar: (r: Reuniao, extra?: any) => Promise<Reuniao | null>; onExcluir: () => void; onClose: () => void
}) {
  const [r, setR] = useState<Reuniao>(reuniao)
  const [novaDecisao, setNovaDecisao] = useState('')
  useEffect(() => { setR(reuniao) }, [reuniao.id])

  function addDecisao() {
    const texto = novaDecisao.trim()
    if (!texto) return
    setR(x => ({ ...x, decisoes: [...(x.decisoes || []), { id: Math.random().toString(36).slice(2), texto }] }))
    setNovaDecisao('')
  }
  function mudaDecisao(id: string, patch: Partial<Decisao>) {
    setR(x => ({ ...x, decisoes: (x.decisoes || []).map(d => d.id === id ? { ...d, ...patch } : d) }))
  }

  async function virarTarefa(d: Decisao) {
    // Salva o estado atual e pede a criação da tarefa numa tacada
    await onSalvar(r, { criarTarefaDaDecisao: d.id })
  }

  return (
    <div onClick={fecharFora(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 620, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <input value={r.titulo} onChange={e => setR({ ...r, titulo: e.target.value })} disabled={!podeEditar}
            style={{ flex: 1, fontSize: 16.5, fontWeight: 800, color: '#111', border: 'none', outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <input type="datetime-local" value={toLocalInput(new Date(r.data))} onChange={e => setR({ ...r, data: new Date(e.target.value).toISOString() })} disabled={!podeEditar}
            style={{ padding: '7px 10px', borderRadius: 9, border: '1px solid #e6e6e6', fontSize: 12.5, fontFamily: 'inherit' }} />
          <input value={r.participantes || ''} onChange={e => setR({ ...r, participantes: e.target.value })} placeholder="Participantes" disabled={!podeEditar}
            style={{ flex: 1, minWidth: 140, padding: '7px 10px', borderRadius: 9, border: '1px solid #e6e6e6', fontSize: 12.5, fontFamily: 'inherit' }} />
          {(['agendada', 'realizada'] as const).map(st => (
            <button key={st} onClick={() => podeEditar && setR({ ...r, status: st })}
              style={{ padding: '7px 14px', borderRadius: 999, border: r.status === st ? '1.5px solid #111' : '1px solid #e6e6e6', background: r.status === st ? '#111' : '#fff', color: r.status === st ? '#fff' : '#777', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
              {st === 'agendada' ? 'Agendada' : 'Realizada'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={label}>Pauta (antes da reunião)</label>
            <textarea lang="pt-BR" spellCheck value={r.pauta || ''} onChange={e => setR({ ...r, pauta: e.target.value })} rows={4} disabled={!podeEditar} style={{ ...input, resize: 'vertical' }} />
          </div>
          <div>
            <label style={label}>Ata (o que foi discutido e decidido)</label>
            <textarea lang="pt-BR" spellCheck value={r.ata || ''} onChange={e => setR({ ...r, ata: e.target.value })} rows={5} disabled={!podeEditar} placeholder="Registro da reunião — fica guardado como histórico." style={{ ...input, resize: 'vertical' }} />
          </div>

          <div>
            <label style={label}>Decisões</label>
            {(r.decisoes || []).length === 0 && <p style={{ margin: '0 0 8px', fontSize: 12, color: '#bbb' }}>Nenhuma decisão registrada.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(r.decisoes || []).map(d => (
                <div key={d.id} style={{ border: '1px solid #f0f0f0', borderRadius: 10, padding: 10 }}>
                  <input value={d.texto} onChange={e => mudaDecisao(d.id, { texto: e.target.value })} disabled={!podeEditar || !!d.tarefaId}
                    style={{ ...input, border: 'none', padding: '2px 0', fontWeight: 600, borderRadius: 0 }} />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
                    <select value={d.responsavelEmail || ''} disabled={!podeEditar || !!d.tarefaId}
                      onChange={e => { const u = usuarios.find(x => x.email === e.target.value); mudaDecisao(d.id, { responsavelEmail: e.target.value || undefined, responsavelNome: u?.nome }) }}
                      style={{ padding: '6px 9px', borderRadius: 8, border: '1px solid #e6e6e6', fontSize: 12, fontFamily: 'inherit', background: '#fff' }}>
                      <option value="">Responsável…</option>
                      {usuarios.map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}
                    </select>
                    <input type="date" value={(d.prazo || '').slice(0, 10)} disabled={!podeEditar || !!d.tarefaId}
                      onChange={e => mudaDecisao(d.id, { prazo: e.target.value || undefined })}
                      style={{ padding: '6px 9px', borderRadius: 8, border: '1px solid #e6e6e6', fontSize: 12, fontFamily: 'inherit' }} />
                    <span style={{ flex: 1 }} />
                    {d.tarefaId
                      ? <span style={{ fontSize: 11, fontWeight: 800, color: '#166534', background: '#dcfce7', borderRadius: 999, padding: '4px 10px' }}>Virou tarefa</span>
                      : podeEditar && (
                        <button onClick={() => virarTarefa(d)} disabled={salvando}
                          style={{ padding: '6px 12px', background: '#ffc00f', border: 'none', borderRadius: 999, fontWeight: 800, fontSize: 11.5, cursor: 'pointer', color: '#111' }}>
                          Virar tarefa
                        </button>
                      )}
                  </div>
                </div>
              ))}
            </div>
            {podeEditar && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <input value={novaDecisao} onChange={e => setNovaDecisao(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addDecisao() }}
                  placeholder="Nova decisão… (Enter adiciona)" style={{ ...input, flex: 1 }} />
                <button onClick={addDecisao} style={{ padding: '10px 14px', background: '#f4f4f5', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', color: '#333' }}>+ Adicionar</button>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18, alignItems: 'center' }}>
          {podeEditar && <button onClick={onExcluir} style={{ padding: '9px 14px', background: '#fff', border: '1px solid #fca5a5', borderRadius: 9, color: '#b91c1c', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Excluir</button>}
          <span style={{ flex: 1 }} />
          <button onClick={onClose} style={{ padding: '10px 16px', background: '#f0f0f0', border: 'none', borderRadius: 9, color: '#666', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Fechar</button>
          {podeEditar && (
            <button onClick={() => onSalvar(r)} disabled={salvando} style={{ padding: '10px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: salvando ? 'wait' : 'pointer' }}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
