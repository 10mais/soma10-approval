'use client'
// Marca > Benchmarks — links de referência do cliente (Instagram, site, YouTube...), com o
// que observar em cada um (dono, 28/09). SÓ EQUIPE: costuma ter concorrente na lista, e o
// /api/clientes nem entrega este campo ao papel cliente. Cada alteração salva na hora.
import { useEffect, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { confirmar } from '@/lib/toast'
import { normalizarLink, tipoDoLink, rotuloDoLink, NOME_TIPO_BENCHMARK, LIMITE_BENCHMARKS, LIMITE_NOME, LIMITE_OBSERVAR, type Benchmark, type TipoBenchmark } from '@/lib/marcaExtras'

const campo: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', background: 'var(--v2-surface)', color: 'var(--v2-ink)' }
const btnIcone: React.CSSProperties = { width: 28, height: 28, borderRadius: 7, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-ink3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }

const COR: Record<TipoBenchmark, string> = { instagram: '#dc2743', youtube: '#ff0000', tiktok: '#111111', facebook: '#1877f2', linkedin: '#0a66c2', site: '#5b6472', outro: '#5b6472' }

function IconeTipo({ tipo }: { tipo: TipoBenchmark }) {
  const path = tipo === 'instagram'
    ? <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="#fff" /></>
    : tipo === 'youtube'
      ? <><rect x="2" y="5" width="20" height="14" rx="4" /><path d="M10 9l5 3-5 3z" fill="#fff" /></>
      : tipo === 'site' || tipo === 'outro'
        ? <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>
        : <><circle cx="12" cy="12" r="9" /></>
  return (
    <span style={{ width: 28, height: 28, borderRadius: 8, background: COR[tipo], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontSize: 10, fontWeight: 800 }}>
      {tipo === 'tiktok' || tipo === 'facebook' || tipo === 'linkedin'
        ? (tipo === 'tiktok' ? 'TT' : tipo === 'facebook' ? 'f' : 'in')
        : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{path}</svg>}
    </span>
  )
}

export default function BenchmarksMarca({ clienteId, inicial }: { clienteId: string; inicial?: Benchmark[] }) {
  const [lista, setLista] = useState<Benchmark[]>(inicial || [])
  const [editandoId, setEditandoId] = useState<string | null>(null) // 'novo' = inclusão
  const [url, setUrl] = useState('')
  const [nome, setNome] = useState('')
  const [observar, setObservar] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => { setLista(inicial || []); setEditandoId(null); setErro('') }, [clienteId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function gravar(nova: Benchmark[]): Promise<boolean> {
    setSalvando(true); setErro('')
    const r = await fetch('/api/clientes', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: clienteId, benchmarks: nova }),
    }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (!r || r.error) { setErro(r?.error ? `Erro ao salvar: ${r.error}` : 'Erro ao salvar. Tente novamente.'); return false }
    setLista(Array.isArray(r.cliente?.benchmarks) ? r.cliente.benchmarks : nova)
    return true
  }

  function abrir(b?: Benchmark) {
    setEditandoId(b ? b.id : 'novo'); setUrl(b?.url || ''); setNome(b?.nome || ''); setObservar(b?.observar || ''); setErro('')
  }

  // Prévia do que o link vai virar, enquanto a pessoa digita.
  const linkPrevia = url.trim() ? normalizarLink(url) : null

  async function salvarItem() {
    const u = normalizarLink(url)
    if (!u) { setErro('Link inválido. Cole o endereço completo (ex.: instagram.com/perfil ou site.com.br) ou um @perfil do Instagram.'); return }
    const chave = (x: string) => x.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '')
    if (lista.some(b => b.id !== editandoId && chave(b.url) === chave(u))) { setErro('Este link já está na lista.'); return }
    const item: Benchmark = {
      id: editandoId === 'novo' || !editandoId ? uuid() : editandoId, url: u, tipo: tipoDoLink(u),
      ...(nome.trim() ? { nome: nome.trim() } : {}), ...(observar.trim() ? { observar: observar.trim() } : {}),
    }
    const nova = editandoId === 'novo' ? [...lista, item] : lista.map(b => (b.id === editandoId ? item : b))
    if (await gravar(nova)) setEditandoId(null)
  }

  async function remover(b: Benchmark) {
    if (!(await confirmar(`Remover ${b.nome || rotuloDoLink(b.url)} dos benchmarks?`, { titulo: 'Remover benchmark', okLabel: 'Remover', perigo: true }))) return
    await gravar(lista.filter(x => x.id !== b.id))
  }

  const formulario = (
    <div style={{ border: '1.5px solid var(--v2-rule)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--v2-surface1)' }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Link *</label>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="instagram.com/perfil, @perfil, site.com.br, youtube.com/@canal..." style={campo} autoFocus
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); salvarItem() } }} />
        {url.trim() && (
          <p style={{ margin: '4px 0 0', fontSize: 11.5, color: linkPrevia ? 'var(--v2-ink3)' : 'var(--v2-hot)' }}>
            {linkPrevia ? `${NOME_TIPO_BENCHMARK[tipoDoLink(linkPrevia)]} · ${linkPrevia}` : 'Ainda não é um link válido.'}
          </p>
        )}
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Nome <span style={{ fontWeight: 400 }}>(opcional)</span></label>
        <input value={nome} onChange={e => setNome(e.target.value.slice(0, LIMITE_NOME))} placeholder="Ex.: Concorrente do centro, Referência nacional..." style={campo} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>O que observar <span style={{ fontWeight: 400 }}>(opcional)</span></label>
        <input value={observar} onChange={e => setObservar(e.target.value.slice(0, LIMITE_OBSERVAR))} placeholder="Ex.: stories de bastidores, tom das legendas, página de preços..." style={campo} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={salvarItem} disabled={salvando}
          style={{ flex: 1, padding: '10px 0', background: 'var(--marca, var(--v2-amber-on))', color: 'var(--marca-texto, var(--v2-ink))', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: salvando ? 'not-allowed' : 'pointer' }}>
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
        <button type="button" onClick={() => { setEditandoId(null); setErro('') }}
          style={{ padding: '10px 16px', background: 'var(--v2-surface2)', color: 'var(--v2-ink2)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          Cancelar
        </button>
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 15, color: 'var(--v2-ink)' }}>Benchmarks</h3>
        {editandoId === null && lista.length < LIMITE_BENCHMARKS && (
          <button type="button" onClick={() => abrir()}
            style={{ padding: '7px 13px', background: 'var(--v2-surface1)', color: 'var(--v2-ink)', border: '1px solid var(--v2-rule)', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
            + Adicionar link
          </button>
        )}
      </div>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--v2-ink3)' }}>
        Perfis e sites de referência (concorrentes, inspirações). Só a equipe vê. A IA usa como referência, sem copiar.
      </p>

      {erro && <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--v2-hot)', fontWeight: 600 }}>{erro}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lista.map(b => editandoId === b.id ? <div key={b.id}>{formulario}</div> : (
          <div key={b.id} style={{ border: '1px solid var(--v2-rule)', borderRadius: 12, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center' }}>
            <IconeTipo tipo={b.tipo} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <a href={b.url} target="_blank" rel="noreferrer noopener"
                style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--v2-info)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {b.nome || rotuloDoLink(b.url)}
              </a>
              <p style={{ margin: '1px 0 0', fontSize: 11.5, color: 'var(--v2-ink3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {NOME_TIPO_BENCHMARK[b.tipo]}{b.nome ? ` · ${rotuloDoLink(b.url)}` : ''}
              </p>
              {b.observar && <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--v2-ink2)' }}>Observar: {b.observar}</p>}
            </div>
            {editandoId === null && (
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button type="button" onClick={() => abrir(b)} title="Editar" style={btnIcone}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                </button>
                <button type="button" onClick={() => remover(b)} disabled={salvando} title="Remover" style={{ ...btnIcone, color: 'var(--v2-hot)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></svg>
                </button>
              </div>
            )}
          </div>
        ))}
        {editandoId === 'novo' && formulario}
        {!lista.length && editandoId === null && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--v2-ink3)', textAlign: 'center', padding: 14, border: '1px dashed var(--v2-rule)', borderRadius: 12 }}>
            Nenhum benchmark cadastrado ainda.
          </p>
        )}
      </div>
    </div>
  )
}
