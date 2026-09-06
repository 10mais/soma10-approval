'use client'
import { useEffect, useRef, useState } from 'react'
import { confirmar, toast } from '@/lib/toast'
import RichText from './RichText'
import AvatarCliente from './AvatarCliente'
import { fecharFora } from '@/lib/fecharModal'

type ClienteLite = { id: string; nome: string; logo?: string }
type Doc = { id: string; titulo: string; conteudo: string; token?: string; clienteId?: string; clienteNome?: string; acessoCliente?: 'ver' | 'editar'; acessoLink?: 'ver' | 'editar'; fontSize?: number; criadoPorNome?: string; atualizadoPorNome?: string; atualizadoEm: string; criadoEm: string }

const FONTE_MIN = 11, FONTE_MAX = 28, FONTE_PADRAO = 15

function textoDe(html: string) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
}
function quando(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function Documentos({ clientes = [] }: { clientes?: ClienteLite[] }) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aberto, setAberto] = useState<Doc | null>(null)
  const [salvo, setSalvo] = useState<'idle' | 'salvando' | 'ok'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function carregar() {
    setCarregando(true)
    fetch('/api/documentos').then(r => r.json()).then(d => setDocs(Array.isArray(d) ? d : [])).finally(() => setCarregando(false))
  }
  useEffect(() => { carregar() }, [])

  // Autosave do documento aberto (debounce)
  function editar(patch: Partial<Doc>) {
    setAberto(a => a ? { ...a, ...patch } : a)
    setSalvo('salvando')
    if (timer.current) clearTimeout(timer.current)
    const alvo = aberto?.id
    timer.current = setTimeout(async () => {
      const atual = { ...(aberto as Doc), ...patch }
      const r = await fetch('/api/documentos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: alvo, titulo: atual.titulo, conteudo: atual.conteudo, clienteId: atual.clienteId || '', clienteNome: atual.clienteNome || '', fontSize: atual.fontSize || FONTE_PADRAO, acessoCliente: atual.acessoCliente || '', acessoLink: atual.acessoLink || '' }) }).then(x => x.json()).catch(() => null)
      if (r?.ok) { setSalvo('ok'); setTimeout(() => setSalvo('idle'), 1500); setDocs(ds => ds.map(d => d.id === alvo ? { ...d, titulo: atual.titulo, conteudo: atual.conteudo, clienteId: atual.clienteId, clienteNome: atual.clienteNome, acessoCliente: atual.acessoCliente, fontSize: atual.fontSize, atualizadoEm: r.documento?.atualizadoEm || d.atualizadoEm, atualizadoPorNome: r.documento?.atualizadoPorNome } : d)) }
      else setSalvo('idle')
    }, 700)
  }

  async function novo() {
    const r = await fetch('/api/documentos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titulo: '', conteudo: '' }) }).then(x => x.json()).catch(() => null)
    if (r?.ok) { setDocs(ds => [r.documento, ...ds]); setAberto(r.documento) }
    else toast('Falha ao criar documento.', 'erro')
  }
  async function excluir(id: string) {
    if (!(await confirmar('Excluir este documento? Esta ação não pode ser desfeita.', { titulo: 'Excluir documento', okLabel: 'Excluir', perigo: true }))) return
    const r = await fetch(`/api/documentos?id=${id}`, { method: 'DELETE' }).then(x => x.json()).catch(() => null)
    if (r?.ok) { setDocs(ds => ds.filter(d => d.id !== id)); if (aberto?.id === id) setAberto(null); toast('Documento excluído.', 'sucesso') }
    else toast(r?.error || 'Falha ao excluir.', 'erro')
  }
  function fechar() {
    const d = aberto
    setAberto(null)
    // Salve somente se houver conteúdo: documento sem título nem texto (aberto e
    // fechado sem digitar nada) não é guardado — evita lixo de documentos vazios.
    if (d && !(d.titulo || '').trim() && !textoDe(d.conteudo || '').trim()) {
      if (timer.current) clearTimeout(timer.current)
      fetch(`/api/documentos?id=${d.id}`, { method: 'DELETE' }).catch(() => {})
      setDocs(ds => ds.filter(x => x.id !== d.id))
      return
    }
    carregar()
  }

  async function compartilhar() {
    if (!aberto) return
    let token = aberto.token
    if (!token) {
      const r = await fetch('/api/documentos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: aberto.id, gerarLink: true }) }).then(x => x.json()).catch(() => null)
      if (!r?.ok) { toast('Falha ao gerar o link.', 'erro'); return }
      token = r.token
      setAberto(a => a ? { ...a, token } : a)
      setDocs(ds => ds.map(d => d.id === aberto.id ? { ...d, token } : d))
    }
    const url = `${location.origin}/doc/${token}`
    navigator.clipboard.writeText(url).then(() => toast('Link copiado! Qualquer pessoa com o link pode ler.', 'sucesso')).catch(() => toast(url, 'info'))
  }
  async function revogarLink() {
    if (!aberto?.token) return
    if (!(await confirmar('Revogar o link público? Quem tiver o link deixará de acessar.', { titulo: 'Revogar link', okLabel: 'Revogar', perigo: true }))) return
    await fetch('/api/documentos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: aberto.id, revogarLink: true }) }).catch(() => {})
    setAberto(a => a ? { ...a, token: undefined } : a)
    setDocs(ds => ds.map(d => d.id === aberto.id ? { ...d, token: undefined } : d))
    toast('Link revogado.', 'sucesso')
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: 'var(--v2-ink)' }}>Documentos</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--v2-ink3)' }}>Documentos da equipe (processos, wikis, briefings). Por padrão o cliente não vê; num documento atribuído a um cliente você escolhe se ele pode visualizar ou editar (aparece no portal dele).</p>
        </div>
        <button onClick={novo} style={{ padding: '10px 18px', background: 'var(--marca, var(--v2-amber-on))', color: 'var(--marca-texto, var(--v2-ink))', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Novo documento</button>
      </div>

      {carregando ? <p style={{ color: 'var(--v2-ink3)' }}>Carregando...</p> : docs.length === 0 ? (
        <div onClick={novo} style={{ background: 'var(--v2-surface)', borderRadius: 14, padding: '50px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: 'pointer' }}>
          <p style={{ margin: '0 0 4px', fontSize: 14, color: 'var(--v2-ink3)' }}>Nenhum documento ainda.</p>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink3)' }}>Clique para criar o primeiro.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--v2-surface)', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {docs.map((d, idx) => (
            <div key={d.id} onClick={() => setAberto(d)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderTop: idx ? '1px solid var(--v2-surface1)' : 'none', cursor: 'pointer' }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: '#f3e8ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" /></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.titulo.trim() || 'Sem título'}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--v2-ink3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.clienteNome ? <span style={{ color: '#7c3aed', fontWeight: 700 }}>{d.clienteNome} · </span> : ''}{d.acessoCliente ? <span style={{ color: 'var(--v2-ok)', fontWeight: 700 }}>{d.acessoCliente === 'editar' ? 'cliente edita' : 'cliente vê'} · </span> : ''}{textoDe(d.conteudo).slice(0, 90) || 'Documento vazio'}</p>
              </div>
              <span style={{ fontSize: 11, color: 'var(--v2-ink3)', flexShrink: 0, textAlign: 'right' }}>{quando(d.atualizadoEm)}{d.atualizadoPorNome ? <><br />{d.atualizadoPorNome}</> : ''}</span>
              <button onClick={e => { e.stopPropagation(); excluir(d.id) }} title="Excluir" style={{ flexShrink: 0, background: 'none', border: 'none', color: 'var(--v2-ink3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Editor em modal */}
      {aberto && (
        <div onClick={fecharFora(fechar)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: 'var(--v2-surface)', borderRadius: 16, width: '100%', maxWidth: 760, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid var(--v2-rule)' }}>
              <input value={aberto.titulo} onChange={e => editar({ titulo: e.target.value })} placeholder="Título do documento" autoFocus
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: 17, fontWeight: 800, color: 'var(--v2-ink)', fontFamily: 'inherit', background: 'transparent' }} />
              {/* Tamanho da fonte */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                <button onClick={() => editar({ fontSize: Math.max(FONTE_MIN, (aberto.fontSize || FONTE_PADRAO) - 1) })} title="Diminuir a fonte" style={{ width: 28, height: 28, border: '1px solid var(--v2-rule)', borderRadius: 7, background: 'var(--v2-surface)', cursor: 'pointer', fontSize: 11, fontWeight: 800, color: 'var(--v2-ink2)' }}>A−</button>
                <button onClick={() => editar({ fontSize: Math.min(FONTE_MAX, (aberto.fontSize || FONTE_PADRAO) + 1) })} title="Aumentar a fonte" style={{ width: 28, height: 28, border: '1px solid var(--v2-rule)', borderRadius: 7, background: 'var(--v2-surface)', cursor: 'pointer', fontSize: 14, fontWeight: 800, color: 'var(--v2-ink2)' }}>A+</button>
              </div>
              {/* Atribuir a um cliente (fixa a logomarca) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                {aberto.clienteId && (
                  <span title={aberto.clienteNome} style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--v2-surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--v2-ink3)', border: '2px solid var(--marca, var(--v2-amber-on))' }}>
                    <AvatarCliente logo={clientes.find(c => c.id === aberto.clienteId)?.logo} nome={aberto.clienteNome} clienteId={aberto.clienteId} />
                  </span>
                )}
                <select value={aberto.clienteId || ''} onChange={e => { const c = clientes.find(x => x.id === e.target.value); editar({ clienteId: e.target.value, clienteNome: c?.nome || '', ...(e.target.value ? {} : { acessoCliente: undefined }) }) }} title="Atribuir a um cliente" style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--v2-rule)', fontSize: 12, fontFamily: 'inherit', background: 'var(--v2-surface)', color: aberto.clienteId ? 'var(--v2-ink)' : 'var(--v2-ink3)', maxWidth: 130 }}>
                  <option value="">Sem cliente</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                {/* Permissão do CLIENTE (estilo Google Docs) — só com cliente atribuído */}
                {aberto.clienteId && (
                  <select value={aberto.acessoCliente || ''} onChange={e => editar({ acessoCliente: (e.target.value || undefined) as Doc['acessoCliente'] })}
                    title="O que o cliente pode fazer com este documento no portal dele"
                    style={{ padding: '6px 8px', borderRadius: 8, border: aberto.acessoCliente ? '1.5px solid var(--v2-ok)' : '1px solid var(--v2-surface2)', fontSize: 12, fontFamily: 'inherit', background: aberto.acessoCliente ? 'var(--v2-ok-bg)' : 'var(--v2-surface)', color: aberto.acessoCliente ? 'var(--v2-ok)' : 'var(--v2-ink3)', fontWeight: aberto.acessoCliente ? 700 : 400, maxWidth: 150 }}>
                    <option value="">Cliente: sem acesso</option>
                    <option value="ver">Cliente: pode visualizar</option>
                    <option value="editar">Cliente: pode editar</option>
                  </select>
                )}
              </div>
              {salvo === 'salvando' && <span style={{ fontSize: 11, color: 'var(--v2-ink3)', flexShrink: 0 }}>salvando…</span>}
              {salvo === 'ok' && <span style={{ fontSize: 11, color: 'var(--v2-ok)', fontWeight: 600, flexShrink: 0 }}>salvo</span>}
              <button onClick={compartilhar} title="Compartilhar por link" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: aberto.token ? 'var(--v2-info-bg)' : 'var(--v2-ink)', color: aberto.token ? '#3730a3' : 'var(--v2-surface)', border: 'none', borderRadius: 8, padding: '7px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>
                {aberto.token ? 'Copiar link' : 'Compartilhar'}
              </button>
              <button onClick={() => excluir(aberto.id)} title="Excluir" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--v2-hot)', display: 'flex', alignItems: 'center', padding: 4, flexShrink: 0 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" /></svg>
              </button>
              <button onClick={fechar} title="Fechar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--v2-ink3)', fontSize: 22, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
            </div>
            {aberto.token && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'var(--v2-surface1)', borderBottom: '1px solid var(--v2-rule)', fontSize: 11.5 }}>
                <span style={{ color: 'var(--v2-ok)', fontWeight: 700, flexShrink: 0 }}>● Link público ativo</span>
                <span style={{ flex: 1, minWidth: 0, color: 'var(--v2-ink3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{typeof location !== 'undefined' ? `${location.origin}/doc/${aberto.token}` : ''}</span>
                {/* Permissão do link (estilo Google Docs): qualquer pessoa com o link lê ou edita */}
                <select value={aberto.acessoLink === 'editar' ? 'editar' : 'ver'} onChange={e => editar({ acessoLink: e.target.value === 'editar' ? 'editar' : undefined })}
                  title="O que qualquer pessoa com o link pode fazer"
                  style={{ flexShrink: 0, padding: '4px 6px', borderRadius: 7, border: aberto.acessoLink === 'editar' ? '1.5px solid var(--v2-amber)' : '1px solid var(--v2-surface2)', fontSize: 11, fontFamily: 'inherit', background: aberto.acessoLink === 'editar' ? 'var(--v2-amber-bg)' : 'var(--v2-surface)', color: aberto.acessoLink === 'editar' ? 'var(--v2-amber)' : 'var(--v2-ink2)', fontWeight: 700 }}>
                  <option value="ver">Com o link: pode ler</option>
                  <option value="editar">Com o link: pode editar</option>
                </select>
                <button onClick={revogarLink} style={{ flexShrink: 0, background: 'none', border: 'none', color: 'var(--v2-hot)', fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}>Revogar</button>
              </div>
            )}
            <div style={{ padding: 16, overflowY: 'auto' }}>
              <RichText key={aberto.id} value={aberto.conteudo} onChange={html => editar({ conteudo: html })} placeholder="Escreva o documento… títulos, listas, cor e links na barra acima." minHeight={380} completo sticky fontSize={aberto.fontSize || FONTE_PADRAO} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
