'use client'
import { useEffect, useMemo, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'
import { fecharFora } from '@/lib/fecharModal'
import { abaixoDoMinimo } from '@/lib/estoque'
import { parseProdutosColados } from '@/lib/produtosImport'

type Loja = { id: string; nome: string; codigo?: string; endereco?: string; telefone?: string; cnpj?: string; ativa?: boolean; evolutionInstance?: string }
type Produto = { id: string; nome: string; marca?: string; modelo?: string; codigo?: string; sku?: string; categoria: string; precoVenda: number; precoCusto?: number; estoqueMinimo?: number; ativo?: boolean; descricao?: string }

const CATEGORIAS = [
  { key: 'smartphone', label: 'Smartphone' },
  { key: 'eletronico', label: 'Eletrônico' },
  { key: 'acessorio', label: 'Acessório' },
  { key: 'outro', label: 'Outro' },
]
const catLabel = (k: string) => CATEGORIAS.find(c => c.key === k)?.label || k
const brl = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const inp: React.CSSProperties = { padding: '9px 11px', borderRadius: 9, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }

export default function Produtos({ podeEditar = true, podeExcluir = true, lojaAtiva = '', podeGerirLojas = false }: { podeEditar?: boolean; podeExcluir?: boolean; lojaAtiva?: string; podeGerirLojas?: boolean }) {
  const [sub, setSub] = useState<'catalogo' | 'estoque' | 'lojas'>('catalogo')
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [lojas, setLojas] = useState<Loja[]>([])
  const [carregando, setCarregando] = useState(true)

  function carregar() {
    setCarregando(true)
    Promise.all([
      fetch(`/api/produtos?lojaId=${encodeURIComponent(lojaAtiva)}`).then(r => r.json()).then(d => setProdutos(Array.isArray(d?.produtos) ? d.produtos : [])),
      fetch('/api/lojas').then(r => r.json()).then(d => setLojas(Array.isArray(d) ? d : [])),
    ]).catch(() => {}).finally(() => setCarregando(false))
  }
  useEffect(() => { carregar() /* eslint-disable-next-line */ }, [lojaAtiva])

  return (
    <div style={{ maxWidth: 980 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: 'var(--v2-ink)' }}>Produtos</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--v2-ink3)' }}>Catálogo compartilhado entre as lojas · estoque por loja.</p>
        </div>
        <div style={{ display: 'flex', background: 'var(--v2-surface2)', borderRadius: 10, padding: 3 }}>
          {(['catalogo', 'estoque', ...(podeGerirLojas ? ['lojas'] as const : [])] as const).map(v => (
            <button key={v} onClick={() => setSub(v)} style={{ padding: '7px 16px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, background: sub === v ? 'var(--v2-surface)' : 'transparent', color: sub === v ? 'var(--v2-ink)' : 'var(--v2-ink3)', boxShadow: sub === v ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}>
              {v === 'catalogo' ? 'Catálogo' : v === 'estoque' ? 'Estoque' : 'Lojas'}
            </button>
          ))}
        </div>
      </div>

      {carregando ? <p style={{ color: 'var(--v2-ink3)', padding: 30, textAlign: 'center' }}>Carregando…</p>
        : sub === 'catalogo'
          ? <Catalogo produtos={produtos} lojas={lojas} podeEditar={podeEditar} podeExcluir={podeExcluir} lojaAtiva={lojaAtiva} onMudou={carregar} />
          : sub === 'lojas'
            ? <LojasView lojas={lojas} onMudou={carregar} />
            : <Estoque produtos={produtos} lojas={lojas} podeEditar={podeEditar} onLojasMudaram={carregar} lojaAtiva={lojaAtiva} podeGerirLojas={podeGerirLojas} onGerirLojas={() => setSub('lojas')} />}
    </div>
  )
}

// ─── Catálogo ────────────────────────────────────────────────────────────────
function Catalogo({ produtos, lojas, podeEditar, podeExcluir, lojaAtiva, bloquearCriar = false, onMudou }: { produtos: Produto[]; lojas: Loja[]; podeEditar: boolean; podeExcluir: boolean; lojaAtiva: string; bloquearCriar?: boolean; onMudou: () => void }) {
  const [editor, setEditor] = useState<Partial<Produto> | null>(null)
  const [importar, setImportar] = useState(false)
  const [busca, setBusca] = useState('')
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return produtos.filter(p => !q || `${p.nome} ${p.marca || ''} ${p.modelo || ''} ${p.codigo || ''} ${p.sku || ''} ${catLabel(p.categoria)}`.toLowerCase().includes(q))
  }, [produtos, busca])
  // Agrupa por CATEGORIA e, dentro, por MARCA (pedido do dono pra organizar o catálogo).
  const grupos = useMemo(() => {
    const cats = new Map<string, Map<string, Produto[]>>()
    for (const p of filtrados) {
      const cat = p.categoria || 'outro'
      const marca = (p.marca || '').trim() || '—'
      if (!cats.has(cat)) cats.set(cat, new Map())
      const m = cats.get(cat)!
      if (!m.has(marca)) m.set(marca, [])
      m.get(marca)!.push(p)
    }
    return Array.from(cats.entries())
      .sort((a, b) => catLabel(a[0]).localeCompare(catLabel(b[0]), 'pt'))
      .map(([cat, marcasMap]) => ({
        cat,
        total: Array.from(marcasMap.values()).reduce((s, a) => s + a.length, 0),
        marcas: Array.from(marcasMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0], 'pt'))
          .map(([marca, ps]) => ({ marca: marca === '—' ? '' : marca, produtos: ps.sort((x, y) => x.nome.localeCompare(y.nome, 'pt')) })),
      }))
  }, [filtrados])

  async function salvar() {
    if (!editor) return
    const metodo = editor.id ? 'PUT' : 'POST'
    const corpo = editor.id ? editor : { ...editor, ...(lojaAtiva ? { lojaId: lojaAtiva } : {}) }
    const r = await fetch('/api/produtos', { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }).then(x => x.json()).catch(() => null)
    if (r?.ok) { setEditor(null); onMudou() } else toast(r?.error || 'Não foi possível salvar o produto.', 'erro')
  }
  async function excluir(p: Produto) {
    if (!(await confirmar(`Excluir "${p.nome}" do catálogo? O estoque e as vendas já feitas não são afetados.`, { titulo: 'Excluir produto', okLabel: 'Excluir', perigo: true }))) return
    const r = await fetch(`/api/produtos?id=${p.id}`, { method: 'DELETE' }).then(x => x.json()).catch(() => null)
    if (r?.ok) onMudou(); else toast('Não foi possível excluir.', 'erro')
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, SKU, marca…" style={{ ...inp, flex: 1, minWidth: 200 }} />
        {podeEditar && lojas.length > 0 && <button onClick={() => setImportar(true)} disabled={bloquearCriar} title={bloquearCriar ? 'Escolha uma loja no seletor lateral' : undefined} style={{ padding: '9px 16px', background: 'var(--v2-surface)', color: bloquearCriar ? 'var(--v2-ink3)' : 'var(--v2-ink2)', border: '1.5px solid var(--v2-rule)', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: bloquearCriar ? 'not-allowed' : 'pointer' }}>Importar</button>}
        {podeEditar && <button onClick={() => setEditor({ categoria: 'smartphone', precoVenda: 0, ativo: true })} disabled={bloquearCriar} title={bloquearCriar ? 'Escolha uma loja no seletor lateral' : undefined} style={{ padding: '9px 16px', background: bloquearCriar ? 'var(--v2-surface2)' : 'var(--v2-ink)', color: bloquearCriar ? 'var(--v2-ink3)' : 'var(--v2-surface)', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: bloquearCriar ? 'not-allowed' : 'pointer' }}>+ Produto</button>}
      </div>
      {bloquearCriar && <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--v2-amber)' }}>Você está vendo <strong>todas as lojas</strong>. Escolha uma loja no seletor “Ver loja” para cadastrar/importar produtos nela.</p>}
      {importar && <ImportarProdutosModal lojas={lojas} lojaAtiva={lojaAtiva} onFechar={() => setImportar(false)} onImportado={() => { setImportar(false); onMudou() }} />}

      {filtrados.length === 0 ? <p style={{ color: 'var(--v2-ink3)', fontSize: 13, padding: 20 }}>{produtos.length === 0 ? 'Nenhum produto ainda. Cadastre o primeiro.' : 'Nada encontrado.'}</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {grupos.map(g => (
            <div key={g.cat}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '0 0 8px', padding: '0 2px' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--v2-ink)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{catLabel(g.cat)}</span>
                <span style={{ fontSize: 12, color: 'var(--v2-ink3)' }}>{g.total}</span>
              </div>
              {g.marcas.map(m => (
                <div key={m.marca || 'sem'} style={{ marginBottom: 10 }}>
                  {m.marca && <p style={{ margin: '0 0 5px', fontSize: 11.5, fontWeight: 700, color: 'var(--v2-ink3)', padding: '0 4px' }}>{m.marca}</p>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {m.produtos.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: 'var(--v2-surface)', borderRadius: 11, border: '1px solid var(--v2-rule)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome} {p.ativo === false && <span style={{ fontSize: 10.5, color: 'var(--v2-ink3)', fontWeight: 700 }}>· inativo</span>}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--v2-ink3)' }}>{[p.modelo, p.codigo && `cód ${p.codigo}`, p.sku].filter(Boolean).join(' · ') || catLabel(p.categoria)}</p>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--v2-ok)', whiteSpace: 'nowrap' }}>{brl(p.precoVenda)}</span>
                        {podeEditar && <button onClick={() => setEditor({ ...p })} style={{ padding: '6px 12px', background: 'var(--v2-surface1)', color: 'var(--v2-ink2)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Editar</button>}
                        {podeExcluir && <button onClick={() => excluir(p)} style={{ padding: '6px 10px', background: 'var(--v2-surface)', color: 'var(--v2-hot)', border: '1px solid var(--v2-hot-bg)', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>×</button>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {editor && (
        <div onClick={fecharFora(() => setEditor(null))} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: 20, overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v2-surface)', borderRadius: 16, width: '100%', maxWidth: 520, padding: 22, margin: '24px 0' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, color: 'var(--v2-ink)' }}>{editor.id ? 'Editar produto' : 'Novo produto'}</h3>
            <label style={lbl}>Nome *</label>
            <input value={editor.nome || ''} onChange={e => setEditor({ ...editor, nome: e.target.value })} placeholder="Ex.: iPhone 15 128GB" style={{ ...inp, width: '100%', marginBottom: 10 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div><label style={lbl}>Marca</label><input value={editor.marca || ''} onChange={e => setEditor({ ...editor, marca: e.target.value })} placeholder="Ex.: Apple, Samsung, JBL" style={{ ...inp, width: '100%' }} /></div>
              <div><label style={lbl}>Modelo</label><input value={editor.modelo || ''} onChange={e => setEditor({ ...editor, modelo: e.target.value })} placeholder="Ex.: 15 Pro Max 256GB" style={{ ...inp, width: '100%' }} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div><label style={lbl}>Categoria</label><select value={editor.categoria} onChange={e => setEditor({ ...editor, categoria: e.target.value })} style={{ ...inp, width: '100%', background: 'var(--v2-surface)' }}>{CATEGORIAS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select></div>
              <div><label style={lbl}>Código</label><input value={editor.codigo || ''} onChange={e => setEditor({ ...editor, codigo: e.target.value })} placeholder="interno" style={{ ...inp, width: '100%' }} /></div>
              <div><label style={lbl}>SKU / barras</label><input value={editor.sku || ''} onChange={e => setEditor({ ...editor, sku: e.target.value })} placeholder="opcional" style={{ ...inp, width: '100%' }} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div><label style={lbl}>Preço venda *</label><input type="number" min="0" step="0.01" value={editor.precoVenda ?? ''} onChange={e => setEditor({ ...editor, precoVenda: Number(e.target.value) })} style={{ ...inp, width: '100%' }} /></div>
              <div><label style={lbl}>Custo</label><input type="number" min="0" step="0.01" value={editor.precoCusto ?? ''} onChange={e => setEditor({ ...editor, precoCusto: e.target.value === '' ? undefined : Number(e.target.value) })} style={{ ...inp, width: '100%' }} /></div>
              <div><label style={lbl}>Estoque mín.</label><input type="number" min="0" value={editor.estoqueMinimo ?? ''} onChange={e => setEditor({ ...editor, estoqueMinimo: e.target.value === '' ? undefined : Number(e.target.value) })} style={{ ...inp, width: '100%' }} /></div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--v2-ink2)', margin: '2px 0 16px' }}>
              <input type="checkbox" checked={editor.ativo !== false} onChange={e => setEditor({ ...editor, ativo: e.target.checked })} /> Ativo (aparece nas vendas)
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={salvar} disabled={!(editor.nome || '').trim()} style={{ flex: 1, padding: '11px 0', background: (editor.nome || '').trim() ? 'var(--v2-amber-on)' : 'var(--v2-surface2)', color: (editor.nome || '').trim() ? 'var(--v2-ink)' : 'var(--v2-ink3)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Salvar</button>
              <button onClick={() => setEditor(null)} style={{ padding: '11px 18px', background: 'var(--v2-surface1)', color: 'var(--v2-ink2)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Estoque por loja ────────────────────────────────────────────────────────
function Estoque({ produtos, lojas, podeEditar, onLojasMudaram, lojaAtiva, podeGerirLojas, onGerirLojas }: { produtos: Produto[]; lojas: Loja[]; podeEditar: boolean; onLojasMudaram: () => void; lojaAtiva: string; podeGerirLojas: boolean; onGerirLojas: () => void }) {
  const [saldos, setSaldos] = useState<Record<string, number>>({})
  const [porLoja, setPorLoja] = useState<Record<string, Record<string, number>> | null>(null)
  const [mov, setMov] = useState<{ produto: Produto } | null>(null)

  // lojaAtiva vem do seletor da sidebar: '' = consolidado (rede); id = loja focada.
  // O operador não tem seletor: cai em '' e o servidor devolve só a loja DELE
  // (saldos), não o porLoja — por isso detectamos a forma da resposta.
  function carregar() {
    if (lojaAtiva) {
      setPorLoja(null)
      fetch(`/api/estoque?lojaId=${lojaAtiva}`).then(r => r.json()).then(d => setSaldos(d?.saldos || {})).catch(() => {})
    } else {
      fetch('/api/estoque').then(r => r.json()).then(d => {
        if (d?.porLoja) { setPorLoja(d.porLoja); setSaldos({}) }
        else { setPorLoja(null); setSaldos(d?.saldos || {}) }
      }).catch(() => {})
    }
  }
  useEffect(() => { carregar() }, [lojaAtiva])

  if (lojas.length === 0) {
    return (
      <div style={{ padding: 24, background: 'var(--v2-surface)', borderRadius: 14, border: '1px solid var(--v2-rule)', textAlign: 'center' }}>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--v2-ink2)' }}>Nenhuma loja cadastrada. O estoque é por loja — crie a primeira.</p>
        {podeGerirLojas && <button onClick={onGerirLojas} style={{ padding: '9px 18px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Cadastrar loja</button>}
      </div>
    )
  }

  const consolidado = !lojaAtiva && !!porLoja
  // Loja em foco: pela sidebar (lojaAtiva) ou, pro operador, a única que ele enxerga.
  const lojaFocoId = lojaAtiva || (!porLoja && lojas.length === 1 ? lojas[0].id : '')
  const lojaFocoNome = lojas.find(l => l.id === lojaFocoId)?.nome || ''

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--v2-ink)' }}>{consolidado ? 'Estoque · todas as lojas (rede)' : `Estoque · ${lojaFocoNome || 'loja'}`}</span>
        {podeGerirLojas && <button onClick={onGerirLojas} style={{ marginLeft: 'auto', padding: '9px 14px', background: 'var(--v2-surface)', color: 'var(--v2-ink2)', border: '1.5px solid var(--v2-rule)', borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Gerenciar lojas</button>}
      </div>

      {produtos.length === 0 ? <p style={{ color: 'var(--v2-ink3)', fontSize: 13, padding: 20 }}>Cadastre produtos no Catálogo antes de gerir estoque.</p>
        : consolidado ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--v2-surface)', borderRadius: 11, overflow: 'hidden', border: '1px solid var(--v2-rule)' }}>
              <thead>
                <tr style={{ background: 'var(--v2-surface1)' }}>
                  <th style={thL}>Produto</th>
                  {lojas.map(l => <th key={l.id} style={thR}>{l.nome}</th>)}
                  <th style={thR}>Total</th>
                </tr>
              </thead>
              <tbody>
                {produtos.map(p => {
                  const cols = lojas.map(l => (porLoja?.[l.id]?.[p.id]) || 0)
                  const total = cols.reduce((a, b) => a + b, 0)
                  return (
                    <tr key={p.id} style={{ borderTop: '1px solid var(--v2-surface1)' }}>
                      <td style={tdL}><span style={{ fontWeight: 600, color: 'var(--v2-ink)' }}>{p.nome}</span>{p.sku ? <span style={{ color: 'var(--v2-ink3)', fontSize: 12 }}> · {p.sku}</span> : ''}</td>
                      {cols.map((s, i) => { const baixo = abaixoDoMinimo(s, p.estoqueMinimo); return <td key={i} style={{ ...tdR, color: baixo ? 'var(--v2-hot)' : 'var(--v2-ink)', fontWeight: baixo ? 800 : 600 }}>{s}</td> })}
                      <td style={{ ...tdR, fontWeight: 800 }}>{total}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p style={{ margin: '10px 2px 0', fontSize: 11.5, color: 'var(--v2-ink3)' }}>Para movimentar o estoque, escolha uma loja no seletor lateral.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {produtos.map(p => {
              const s = saldos[p.id] || 0
              const baixo = abaixoDoMinimo(s, p.estoqueMinimo)
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: 'var(--v2-surface)', borderRadius: 11, border: '1px solid var(--v2-rule)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--v2-ink)' }}>{p.nome}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--v2-ink3)' }}>{catLabel(p.categoria)}{p.sku ? ` · ${p.sku}` : ''}</p>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: baixo ? 'var(--v2-hot)' : 'var(--v2-ink)', whiteSpace: 'nowrap' }}>{s} un.</span>
                  {baixo && <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--v2-hot)', background: 'var(--v2-hot-bg)', borderRadius: 999, padding: '3px 9px' }}>abaixo do mín.</span>}
                  {podeEditar && <button onClick={() => setMov({ produto: p })} style={{ padding: '6px 12px', background: 'var(--v2-surface1)', color: 'var(--v2-ink2)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Movimentar</button>}
                </div>
              )
            })}
          </div>
        )}

      {mov && <MovimentarModal produto={mov.produto} lojaId={lojaFocoId} lojas={lojas} saldoAtual={saldos[mov.produto.id] || 0} onFechar={() => setMov(null)} onFeito={() => { setMov(null); carregar() }} />}
    </div>
  )
}

function MovimentarModal({ produto, lojaId, lojas, saldoAtual, onFechar, onFeito }: { produto: Produto; lojaId: string; lojas: Loja[]; saldoAtual: number; onFechar: () => void; onFeito: () => void }) {
  const [tipo, setTipo] = useState<'entrada' | 'ajuste' | 'transferencia'>('entrada')
  const [qtd, setQtd] = useState('')
  const [lojaDestinoId, setLojaDestinoId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const outras = lojas.filter(l => l.id !== lojaId)

  async function aplicar() {
    const n = Number(qtd)
    if (!isFinite(n) || (tipo !== 'ajuste' && n <= 0)) { toast('Informe uma quantidade válida.', 'erro'); return }
    if (tipo === 'transferencia' && !lojaDestinoId) { toast('Escolha a loja de destino.', 'erro'); return }
    setEnviando(true)
    const body: any = { tipo, produtoId: produto.id, lojaId, quantidade: n, motivo: motivo || undefined }
    if (tipo === 'transferencia') body.lojaDestinoId = lojaDestinoId
    const r = await fetch('/api/estoque', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => null)
    setEnviando(false)
    if (r?.ok) { toast('Estoque atualizado.', 'sucesso'); onFeito() } else toast(r?.error || 'Não foi possível movimentar.', 'erro')
  }

  return (
    <div onClick={fecharFora(onFechar)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v2-surface)', borderRadius: 16, width: '100%', maxWidth: 420, padding: 22 }}>
        <h3 style={{ margin: '0 0 2px', fontSize: 16, color: 'var(--v2-ink)' }}>{produto.nome}</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--v2-ink3)' }}>Saldo atual nesta loja: <strong>{saldoAtual} un.</strong></p>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {([['entrada', 'Entrada'], ['ajuste', 'Ajuste'], ['transferencia', 'Transferir']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTipo(k)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: tipo === k ? '1.5px solid var(--v2-ink)' : '1.5px solid var(--v2-rule)', background: tipo === k ? 'var(--v2-ink)' : 'var(--v2-surface)', color: tipo === k ? 'var(--v2-surface)' : 'var(--v2-ink2)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        <label style={lbl}>{tipo === 'ajuste' ? 'Saldo correto (contagem física)' : 'Quantidade'}</label>
        <input type="number" min="0" value={qtd} onChange={e => setQtd(e.target.value)} autoFocus style={{ ...inp, width: '100%', marginBottom: 10 }} />
        {tipo === 'transferencia' && (
          <>
            <label style={lbl}>Loja de destino</label>
            <select value={lojaDestinoId} onChange={e => setLojaDestinoId(e.target.value)} style={{ ...inp, width: '100%', background: 'var(--v2-surface)', marginBottom: 10 }}>
              <option value="">Selecione…</option>
              {outras.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </>
        )}
        <label style={lbl}>Motivo (opcional)</label>
        <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: recebimento NF 123" style={{ ...inp, width: '100%', marginBottom: 18 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={aplicar} disabled={enviando} style={{ flex: 1, padding: '11px 0', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>{enviando ? 'Aplicando…' : 'Aplicar'}</button>
          <button onClick={onFechar} style={{ padding: '11px 18px', background: 'var(--v2-surface1)', color: 'var(--v2-ink2)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Gestão de lojas (robusta) ───────────────────────────────────────────────
function LojasView({ lojas, onMudou }: { lojas: Loja[]; onMudou: () => void }) {
  const [editando, setEditando] = useState<Loja | null | 'novo'>(null)
  const [porLoja, setPorLoja] = useState<Record<string, Record<string, number>>>({})
  useEffect(() => { fetch('/api/estoque').then(r => r.json()).then(d => { if (d?.porLoja) setPorLoja(d.porLoja) }).catch(() => {}) }, [lojas.length])

  async function salvarLista(lista: Loja[]): Promise<boolean> {
    const r = await fetch('/api/lojas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lojas: lista }) }).then(x => x.json()).catch(() => null)
    if (r?.ok) { onMudou(); return true }
    toast(r?.error || 'Não foi possível salvar as lojas.', 'erro'); return false
  }
  async function salvarLoja(loja: Loja) {
    const existe = loja.id && lojas.some(l => l.id === loja.id)
    const nova = existe ? lojas.map(l => l.id === loja.id ? loja : l) : [...lojas, loja]
    if (await salvarLista(nova)) setEditando(null)
  }
  async function excluir(loja: Loja) {
    const unidades = Object.values(porLoja[loja.id] || {}).reduce((s, v) => s + (Number(v) || 0), 0)
    if (unidades > 0) { toast(`"${loja.nome}" tem ${unidades} un. em estoque — zere/transfira antes de excluir.`, 'erro'); return }
    if (!(await confirmar(`Excluir a loja "${loja.nome}"? As vendas e o histórico já feitos permanecem.`, { titulo: 'Excluir loja', okLabel: 'Excluir', perigo: true }))) return
    await salvarLista(lojas.filter(l => l.id !== loja.id))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--v2-ink3)' }}>{lojas.length} loja(s) · cada uma tem estoque, PDV, CRM e WhatsApp próprios.</p>
        <button onClick={() => setEditando('novo')} style={{ padding: '9px 16px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Nova loja</button>
      </div>

      {lojas.length === 0 ? <p style={{ color: 'var(--v2-ink3)', fontSize: 13, padding: 20 }}>Nenhuma loja ainda. Crie a primeira unidade.</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {lojas.map(l => {
            const saldos = porLoja[l.id] || {}
            // Contar da MESMA fonte das unidades (porLoja desta loja), nunca da
            // lista `produtos` — ela vem escopada à loja focada e filtrada por
            // lojaId, o que dava "0 produtos" com estoque > 0 (fontes divergentes).
            const comEstoque = Object.values(saldos).filter(v => (Number(v) || 0) > 0).length
            const unidades = Object.values(saldos).reduce((s, v) => s + (Number(v) || 0), 0)
            const inativa = l.ativa === false
            return (
              <div key={l.id} style={{ background: 'var(--v2-surface)', borderRadius: 14, border: '1px solid var(--v2-rule)', boxShadow: '0 1px 5px rgba(0,0,0,0.05)', padding: 16, opacity: inativa ? 0.65 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--v2-ink)' }}>{l.nome}{l.codigo && <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--v2-ink2)', background: 'var(--v2-surface2)', borderRadius: 6, padding: '2px 7px', marginLeft: 8 }}>{l.codigo}</span>}</p>
                    {l.endereco && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--v2-ink3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.endereco}</p>}
                  </div>
                  {inativa && <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--v2-amber)', background: 'var(--v2-amber-bg)', borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap' }}>inativa</span>}
                </div>
                <div style={{ display: 'flex', gap: 16, margin: '12px 0', fontSize: 12.5, color: 'var(--v2-ink2)' }}>
                  <span><strong style={{ color: 'var(--v2-ink)' }}>{comEstoque}</strong> produtos</span>
                  <span><strong style={{ color: 'var(--v2-ink)' }}>{unidades}</strong> un. em estoque</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--v2-ink3)', marginBottom: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.evolutionInstance ? 'var(--v2-ok)' : 'var(--v2-rule2)', flexShrink: 0 }} />
                  {l.evolutionInstance ? `WhatsApp: ${l.evolutionInstance}` : 'WhatsApp não configurado'}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setEditando(l)} style={{ flex: 1, padding: '7px 0', background: 'var(--v2-surface1)', color: 'var(--v2-ink2)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Editar</button>
                  <button onClick={() => salvarLista(lojas.map(x => x.id === l.id ? { ...x, ativa: inativa } : x))} style={{ padding: '7px 12px', background: 'var(--v2-surface)', color: 'var(--v2-ink2)', border: '1px solid var(--v2-rule)', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>{inativa ? 'Ativar' : 'Desativar'}</button>
                  <button onClick={() => excluir(l)} title="Excluir" style={{ padding: '7px 10px', background: 'var(--v2-surface)', color: 'var(--v2-hot)', border: '1px solid var(--v2-hot-bg)', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>×</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editando && <LojaEditor loja={editando === 'novo' ? null : editando} onSalvar={salvarLoja} onFechar={() => setEditando(null)} />}
    </div>
  )
}

function LojaEditor({ loja, onSalvar, onFechar }: { loja: Loja | null; onSalvar: (l: Loja) => void; onFechar: () => void }) {
  const [f, setF] = useState<Loja>(loja || { id: '', nome: '', ativa: true })
  const [salvando, setSalvando] = useState(false)
  const set = (patch: Partial<Loja>) => setF(prev => ({ ...prev, ...patch }))
  async function salvar() {
    if (!f.nome.trim()) { toast('Informe o nome da loja.', 'erro'); return }
    setSalvando(true)
    await onSalvar({ ...f, nome: f.nome.trim() })
    setSalvando(false)
  }
  return (
    <div onClick={fecharFora(onFechar)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1100, padding: 20, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v2-surface)', borderRadius: 16, width: '100%', maxWidth: 460, padding: 22, margin: '24px 0' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 16, color: 'var(--v2-ink)' }}>{loja ? 'Editar loja' : 'Nova loja'}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
          <div><label style={lbl}>Nome *</label><input value={f.nome} onChange={e => set({ nome: e.target.value })} placeholder="Ex.: Santo Ângelo (Matriz)" style={{ ...inp, width: '100%' }} autoFocus /></div>
          <div><label style={lbl}>Código</label><input value={f.codigo || ''} onChange={e => set({ codigo: e.target.value })} placeholder="01" style={{ ...inp, width: '100%' }} /></div>
        </div>
        <label style={lbl}>Endereço</label>
        <input value={f.endereco || ''} onChange={e => set({ endereco: e.target.value })} placeholder="Rua, nº, bairro, cidade" style={{ ...inp, width: '100%', marginBottom: 10 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div><label style={lbl}>Telefone</label><input value={f.telefone || ''} onChange={e => set({ telefone: e.target.value })} placeholder="(55) 99999-9999" style={{ ...inp, width: '100%' }} /></div>
          <div><label style={lbl}>CNPJ</label><input value={f.cnpj || ''} onChange={e => set({ cnpj: e.target.value })} placeholder="00.000.000/0001-00" style={{ ...inp, width: '100%' }} /></div>
        </div>
        <label style={lbl}>Instância WhatsApp</label>
        <input value={f.evolutionInstance || ''} onChange={e => set({ evolutionInstance: e.target.value })} placeholder="ex.: space-cruzalta" title="Nome único desta loja no host do Evolution (minúsculas, números e hífen)" style={{ ...inp, width: '100%', marginBottom: 6 }} />
        <p style={{ margin: '0 0 14px', fontSize: 11, color: 'var(--v2-ink3)' }}>Cada loja pareia o seu próprio número. Deixe vazio se ainda não usa WhatsApp por loja.</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--v2-ink2)', marginBottom: 16 }}>
          <input type="checkbox" checked={f.ativa !== false} onChange={e => set({ ativa: e.target.checked })} /> Loja ativa (aparece nos seletores e no PDV)
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={salvar} disabled={salvando || !f.nome.trim()} style={{ flex: 1, padding: '11px 0', background: f.nome.trim() ? 'var(--v2-amber-on)' : 'var(--v2-surface2)', color: f.nome.trim() ? 'var(--v2-ink)' : 'var(--v2-ink3)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>{salvando ? 'Salvando…' : 'Salvar loja'}</button>
          <button onClick={onFechar} style={{ padding: '11px 18px', background: 'var(--v2-surface1)', color: 'var(--v2-ink2)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function ImportarProdutosModal({ lojas, lojaAtiva, onFechar, onImportado }: { lojas: Loja[]; lojaAtiva: string; onFechar: () => void; onImportado: () => void }) {
  const lojasAtivas = lojas.filter(l => l.ativa !== false)
  const [lojaId, setLojaId] = useState(lojaAtiva || lojasAtivas[0]?.id || '')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const { linhas, ignoradas } = useMemo(() => parseProdutosColados(texto), [texto])

  async function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    const buf = await f.arrayBuffer()
    let t = new TextDecoder('utf-8', { fatal: false }).decode(buf)
    if (t.includes('�')) t = new TextDecoder('windows-1252').decode(buf) // ERP Windows/Excel (Latin-1)
    setTexto(t)
    e.target.value = ''
  }
  async function importar() {
    if (!lojaId) { toast('Escolha a loja de destino.', 'erro'); return }
    if (!linhas.length) { toast('Cole ao menos uma linha válida.', 'erro'); return }
    setEnviando(true)
    const r = await fetch('/api/produtos/importar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lojaId, linhas }) }).then(x => x.json()).catch(() => null)
    setEnviando(false)
    if (r?.ok) { toast(`${r.criados} criado(s) · ${r.atualizados} atualizado(s) · ${r.unidades} un. no estoque.`, 'sucesso'); onImportado() }
    else toast(r?.error || 'Falha ao importar.', 'erro')
  }

  return (
    <div onClick={fecharFora(onFechar)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1100, padding: 20, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v2-surface)', borderRadius: 16, width: '100%', maxWidth: 580, padding: 22, margin: '24px 0' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, color: 'var(--v2-ink)' }}>Importar produtos em massa</h3>
        <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--v2-ink3)' }}>O catálogo é compartilhado; casa por SKU (ou nome) — existente atualiza, novo é criado. A quantidade entra no estoque da <strong>loja escolhida</strong>.</p>
        <label style={lbl}>Loja de destino do estoque</label>
        <select value={lojaId} onChange={e => setLojaId(e.target.value)} style={{ ...inp, width: '100%', background: 'var(--v2-surface)', marginBottom: 12 }}>
          <option value="">Selecione a loja…</option>
          {lojasAtivas.map(l => <option key={l.id} value={l.id}>{l.nome}{l.codigo ? ` (${l.codigo})` : ''}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <label style={{ ...lbl, margin: 0 }}>Envie o arquivo do seu sistema (.csv) ou cole abaixo</label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            Enviar arquivo
            <input type="file" accept=".csv,.txt,text/csv" onChange={onArquivo} style={{ display: 'none' }} />
          </label>
        </div>
        <div style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--v2-ink3)' }}>Reconhece o export do seu ERP (Descrição, Preço Venda, Estoque, Custo, Est. Mínimo, Código Barras…) OU o formato simples: <code>Nome · SKU · Categoria · Preço · Custo · Estoque mín · Quantidade</code>.</div>
        <textarea lang="pt-BR" value={texto} onChange={e => setTexto(e.target.value)} placeholder={'Cole aqui ou envie o .csv…\niPhone 15 128GB;IP15128;smartphone;5.999,00;4.200,00;2;10'} style={{ ...inp, width: '100%', minHeight: 150, fontFamily: 'ui-monospace, monospace', fontSize: 12, resize: 'vertical' }} />
        <div style={{ margin: '10px 0 16px', fontSize: 12.5, color: 'var(--v2-ink2)' }}>
          {texto.trim() ? <><strong style={{ color: linhas.length ? 'var(--v2-ok)' : 'var(--v2-hot)' }}>{linhas.length}</strong> produto(s) prontos{ignoradas > 0 && <span style={{ color: 'var(--v2-amber)' }}> · {ignoradas} linha(s) ignorada(s) (sem preço)</span>}</> : <span style={{ color: 'var(--v2-ink3)' }}>Cole os dados para ver a prévia.</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={importar} disabled={enviando || !linhas.length || !lojaId} style={{ flex: 1, padding: '11px 0', background: (linhas.length && lojaId) ? 'var(--v2-ok)' : 'var(--v2-surface2)', color: (linhas.length && lojaId) ? 'var(--v2-surface)' : 'var(--v2-ink3)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>{enviando ? 'Importando…' : `Importar ${linhas.length || ''}`}</button>
          <button onClick={onFechar} style={{ padding: '11px 18px', background: 'var(--v2-surface1)', color: 'var(--v2-ink2)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 5 }
const thL: React.CSSProperties = { textAlign: 'left', padding: '10px 14px', fontSize: 11.5, fontWeight: 800, color: 'var(--v2-ink3)', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...thL, textAlign: 'right' }
const tdL: React.CSSProperties = { textAlign: 'left', padding: '10px 14px', fontSize: 13.5 }
const tdR: React.CSSProperties = { textAlign: 'right', padding: '10px 14px', fontSize: 13.5, whiteSpace: 'nowrap' }
