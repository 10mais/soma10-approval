'use client'
import { useEffect, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'

type Agente = { id: string; nome: string; funcao?: string; descricao?: string; instrucoes: string; ferramentas: string[]; cor?: string; ativo: boolean }

const FERRAMENTAS = [
  { name: 'consultar_tarefas', label: 'Consultar tarefas', desc: 'Ler tarefas da equipe (status, prazos, responsáveis)', acao: false },
  { name: 'consultar_clientes', label: 'Consultar clientes', desc: 'Ler carteira de clientes, contratos e renovações', acao: false },
  { name: 'consultar_crm', label: 'Consultar CRM', desc: 'Ler o funil de vendas (negócios, valores, follow-ups)', acao: false },
  { name: 'consultar_financeiro', label: 'Consultar financeiro', desc: 'Ler o resultado do mês — só funciona para admin', acao: false },
  { name: 'web_search', label: 'Buscar na web', desc: 'Pesquisar informações atuais na internet', acao: false },
  { name: 'criar_tarefa', label: 'Criar tarefa', desc: 'Preparar a criação de uma tarefa — o usuário confirma antes', acao: true },
  { name: 'criar_marco', label: 'Criar etapa no Playbook', desc: 'Preparar uma etapa no Playbook de um cliente — o usuário confirma antes', acao: true },
]
const CORES = ['#7c3aed', '#1d4ed8', '#0891b2', '#16a34a', '#dc2626', '#ea580c', '#111827']

export default function Agentes() {
  const [agentes, setAgentes] = useState<Agente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [editar, setEditar] = useState<Agente | null | 'novo'>(null)

  function carregar() {
    setCarregando(true)
    fetch('/api/agentes').then(r => r.json()).then(d => setAgentes(Array.isArray(d) ? d : [])).finally(() => setCarregando(false))
  }
  useEffect(() => { carregar() }, [])

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Agentes de IA</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#999' }}>Agentes treinados com persona e ferramentas próprias. A equipe conversa com eles no assistente flutuante (ícone amarelo no canto).</p>
        </div>
        <button onClick={() => setEditar('novo')} style={{ padding: '10px 18px', background: 'var(--marca, #ffc00f)', color: 'var(--marca-texto, #111)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Novo agente</button>
      </div>

      {carregando ? <p style={{ color: '#aaa' }}>Carregando...</p> : agentes.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: '50px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <p style={{ margin: '0 0 4px', fontSize: 14, color: '#888' }}>Nenhum agente ainda.</p>
          <p style={{ margin: 0, fontSize: 12.5, color: '#aaa' }}>Crie um agente (ex.: Copywriter, Gestor de Projetos, SDR) e a equipe já pode conversar com ele.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {agentes.map(a => (
            <div key={a.id} onClick={() => setEditar(a)} style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #eee', cursor: 'pointer', opacity: a.ativo ? 1 : 0.55 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ width: 38, height: 38, borderRadius: '50%', background: a.cor || '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>{(a.nome || '?')[0]?.toUpperCase()}</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome}</p>
                  <p style={{ margin: '1px 0 0', fontSize: 12, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.funcao || 'Agente'}</p>
                </div>
              </div>
              {a.descricao && <p style={{ margin: '0 0 8px', fontSize: 12, color: '#666', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.descricao}</p>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(a.ferramentas || []).length === 0 ? <span style={{ fontSize: 10.5, color: '#bbb' }}>Sem ferramentas (só conversa)</span> : (a.ferramentas || []).map(f => (
                  <span key={f} style={{ fontSize: 10, fontWeight: 700, color: '#555', background: '#f0f0f0', borderRadius: 999, padding: '2px 8px' }}>{FERRAMENTAS.find(x => x.name === f)?.label || f}</span>
                ))}
              </div>
              {!a.ativo && <span style={{ display: 'inline-block', marginTop: 8, fontSize: 10.5, fontWeight: 700, color: '#b91c1c', background: '#fee2e2', borderRadius: 999, padding: '2px 8px' }}>Inativo</span>}
            </div>
          ))}
        </div>
      )}

      {editar && <AgenteModal agente={editar === 'novo' ? null : editar} onClose={() => setEditar(null)} onSalvo={() => { setEditar(null); carregar() }} />}
    </div>
  )
}

function AgenteModal({ agente, onClose, onSalvo }: { agente: Agente | null; onClose: () => void; onSalvo: () => void }) {
  const [f, setF] = useState<any>({
    nome: agente?.nome || '', funcao: agente?.funcao || '', descricao: agente?.descricao || '',
    instrucoes: agente?.instrucoes || '', ferramentas: agente?.ferramentas || [], cor: agente?.cor || '#7c3aed', ativo: agente?.ativo !== false,
  })
  const [salvando, setSalvando] = useState(false)
  const toggleFerr = (name: string) => setF((p: any) => ({ ...p, ferramentas: p.ferramentas.includes(name) ? p.ferramentas.filter((x: string) => x !== name) : [...p.ferramentas, name] }))

  async function salvar() {
    if (!f.nome.trim()) { toast('Dê um nome ao agente.', 'erro'); return }
    setSalvando(true)
    const metodo = agente ? 'PUT' : 'POST'
    const body = agente ? { id: agente.id, ...f } : f
    const r = await fetch('/api/agentes', { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (r?.ok) { toast('Agente salvo.', 'sucesso'); onSalvo() } else toast(r?.error || 'Falha ao salvar.', 'erro')
  }
  async function excluir() {
    if (!agente || !(await confirmar(`Excluir o agente "${agente.nome}"?`, { titulo: 'Excluir agente', okLabel: 'Excluir', perigo: true }))) return
    await fetch(`/api/agentes?id=${agente.id}`, { method: 'DELETE' }).catch(() => {})
    onSalvo()
  }

  const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }
  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 520, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#111' }}>{agente ? 'Editar agente' : 'Novo agente'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={label}>Nome *</label><input value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Léo Copywriter" style={input} /></div>
            <div><label style={label}>Função</label><input value={f.funcao} onChange={e => setF({ ...f, funcao: e.target.value })} placeholder="Ex.: Copywriter" style={input} /></div>
          </div>
          <div><label style={label}>Descrição curta</label><input value={f.descricao} onChange={e => setF({ ...f, descricao: e.target.value })} placeholder="Uma linha exibida no card e na saudação" style={input} /></div>
          <div>
            <label style={label}>Instruções / treino (persona)</label>
            <textarea value={f.instrucoes} onChange={e => setF({ ...f, instrucoes: e.target.value })} placeholder={'Descreva como o agente pensa e age. Ex.:\n"Você é um copywriter sênior especialista em social media para clínicas. Escreve legendas curtas, com gancho forte na 1a linha e CTA claro. Tom leve e profissional. Sempre pergunta o objetivo do post se não estiver claro."'}
              style={{ ...input, minHeight: 130, resize: 'vertical', lineHeight: 1.5 }} />
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#bbb' }}>Este texto é o que "treina" o agente — quanto mais específico, melhor ele responde.</p>
          </div>
          <div>
            <label style={label}>Ferramentas (leitura de dados)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {FERRAMENTAS.map(ff => (
                <label key={ff.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', background: ff.acao ? '#faf5ff' : '#fafafa', border: `1px solid ${ff.acao ? '#e9d5ff' : '#eee'}`, borderRadius: 8, padding: '8px 10px' }}>
                  <input type="checkbox" checked={f.ferramentas.includes(ff.name)} onChange={() => toggleFerr(ff.name)} style={{ marginTop: 2, cursor: 'pointer' }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#333' }}>{ff.label}{ff.acao && <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 800, color: '#7c3aed', background: '#f3e8ff', borderRadius: 999, padding: '1px 7px', verticalAlign: 'middle' }}>AÇÃO</span>}</span>
                    <span style={{ display: 'block', fontSize: 11, color: '#999' }}>{ff.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <label style={label}>Cor</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {CORES.map(c => <button key={c} type="button" onClick={() => setF({ ...f, cor: c })} style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: f.cor === c ? '3px solid #111' : '2px solid #fff', boxShadow: '0 0 0 1px #e0e0e0', cursor: 'pointer' }} />)}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 22, fontSize: 13, fontWeight: 600, color: '#333' }}>
              <input type="checkbox" checked={f.ativo} onChange={e => setF({ ...f, ativo: e.target.checked })} style={{ cursor: 'pointer' }} /> Ativo (disponível no assistente)
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={salvar} disabled={salvando || !f.nome.trim()} style={{ flex: 1, padding: '11px 0', background: f.nome.trim() ? 'var(--marca, #ffc00f)' : '#f0f0f0', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: f.nome.trim() ? 'pointer' : 'not-allowed' }}>{salvando ? 'Salvando...' : agente ? 'Salvar' : 'Criar agente'}</button>
          {agente && <button onClick={excluir} style={{ padding: '11px 16px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Excluir</button>}
          <button onClick={onClose} style={{ padding: '11px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}
