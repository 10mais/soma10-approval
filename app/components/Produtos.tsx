'use client'
import { useEffect, useMemo, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'
import { fecharFora } from '@/lib/fecharModal'
import { abaixoDoMinimo } from '@/lib/estoque'
import { parseProdutosColados } from '@/lib/produtosImport'

type Loja = { id: string; nome: string; codigo?: string; endereco?: string; telefone?: string; cnpj?: string; ativa?: boolean; evolutionInstance?: string }
type Produto = { id: string; nome: string; sku?: string; categoria: string; precoVenda: number; precoCusto?: number; estoqueMinimo?: number; ativo?: boolean; descricao?: string }

const CATEGORIAS = [
  { key: 'smartphone', label: 'Smartphone' },
  { key: 'eletronico', label: 'Eletrônico' },
  { key: 'acessorio', label: 'Acessório' },
  { key: 'outro', label: 'Outro' },
]
const catLabel = (k: string) => CATEGORIAS.find(c => c.key === k)?.label || k
const brl = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const inp: React.CSSProperties = { padding: '9px 11px', borderRadius: 9, border: '1.5px solid #e2e2e2', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }

export default function Produtos({ podeEditar = true, podeExcluir = true, lojaAtiva = '', podeGerirLojas = false }: { podeEditar?: boolean; podeExcluir?: boolean; lojaAtiva?: string; podeGerirLojas?: boolean }) {
  const [sub, setSub] = useState<'catalogo' | 'estoque' | 'lojas'>('catalogo')
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [lojas, setLojas] = useState<Loja[]>([])
  const [carregando, setCarregando] = useState(true)

  function carregar() {
    setCarregando(true)
    Promise.all([
      fetch('/api/produtos').then(r => r.json()).then(d => setProdutos(Array.isArray(d?.produtos) ? d.produtos : [])),
      fetch('/api/lojas').then(r => r.json()).then(d => setLojas(Array.isArray(d) ? d : [])),
    ]).catch(() => {}).finally(() => setCarregando(false))
  }
  useEffect(() => { carregar() }, [])

  return (
    <div style={{ maxWidth: 980 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Produtos</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#999' }}>Catálogo compartilhado entre as lojas · estoque por loja.</p>
        </div>
        <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: 10, padding: 3 }}>
          {(['catalogo', 'estoque', ...(podeGerirLojas ? ['lojas'] as const : [])] as const).map(v => (
            <button key={v} onClick={() => setSub(v)} style={{ padding: '7px 16px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, background: sub === v ? '#fff' : 'transparent', color: sub === v ? '#111' : '#888', boxShadow: sub === v ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}>
              {v === 'catalogo' ? 'Catálogo' : v === 'estoque' ? 'Estoque' : 'Lojas'}
            </button>
          ))}
        </div>
      </div>

      {carregando ? <p style={{ color: '#aaa', padding: 30, textAlign: 'center' }}>Carregando…</p>
        : sub === 'catalogo'
          ? <Catalogo produtos={produtos} lojas={lojas} podeEditar={podeEditar} podeExcluir={podeExcluir} lojaAtiva={lojaAtiva} onMudou={carregar} />
          : sub === 'lojas'
            ? <LojasView lojas={lojas} produtos={produtos} onMudou={carregar} />
            : <Estoque produtos={produtos} lojas={lojas} podeEditar={podeEditar} onLojasMudaram={carregar} lojaAtiva={lojaAtiva} podeGerirLojas={podeGerirLojas} onGerirLojas={() => setSub('lojas')} />}
    </div>
  )
}

// ─── Catálogo ────────────────────────────────────────────────────────────────
function Catalogo({ produtos, lojas, podeEditar, podeExcluir, lojaAtiva, onMudou }: { produtos: Produto[]; lojas: Loja[]; podeEditar: boolean; podeExcluir: boolean; lojaAtiva: string; onMudou: () => void }) {
  const [editor, setEditor] = useState<Partial<Produto> | null>(null)
  const [importar, setImportar] = useState(false)
  const [busca, setBusca] = useState('')
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return produtos.filter(p => !q || `${p.nome} ${p.sku || ''} ${catLabel(p.categoria)}`.toLowerCase().includes(q))
  }, [produtos, busca])

  async function salvar() {
    if (!editor) return
    const metodo = editor.id ? 'PUT' : 'POST'
    const r = await fetch('/api/produtos', { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editor) }).then(x => x.json()).catch(() => null)
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
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, SKU ou categoria…" style={{ ...inp, flex: 1, minWidth: 200 }} />
        {podeEditar && lojas.length > 0 && <button onClick={() => setImportar(true)} style={{ padding: '9px 16px', background: '#fff', color: '#444', border: '1.5px solid #e2e2e2', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Importar</button>}
        {podeEditar && <button onClick={() => setEditor({ categoria: 'smartphone', precoVenda: 0, ativo: true })} style={{ padding: '9px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Produto</button>}
      </div>
      {importar && <ImportarProdutosModal lojas={lojas} lojaAtiva={lojaAtiva} onFechar={() => setImportar(false)} onImportado={() => { setImportar(false); onMudou() }} />}

      {filtrados.length === 0 ? <p style={{ color: '#bbb', fontSize: 13, padding: 20 }}>{produtos.length === 0 ? 'Nenhum produto ainda. Cadastre o primeiro.' : 'Nada encontrado.'}</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtrados.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: '#fff', borderRadius: 11, border: '1px solid #f0f0f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111' }}>{p.nome} {p.ativo === false && <span style={{ fontSize: 10.5, color: '#999', fontWeight: 700 }}>· inativo</span>}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#999' }}>{catLabel(p.categoria)}{p.sku ? ` · ${p.sku}` : ''}</p>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#16a34a', whiteSpace: 'nowrap' }}>{brl(p.precoVenda)}</span>
              {podeEditar && <button onClick={() => setEditor({ ...p })} style={{ padding: '6px 12px', background: '#f5f5f5', color: '#444', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Editar</button>}
              {podeExcluir && <button onClick={() => excluir(p)} style={{ padding: '6px 10px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>×</button>}
            </div>
          ))}
        </div>
      )}

      {editor && (
        <div onClick={fecharFora(() => setEditor(null))} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: 20, overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, padding: 22, margin: '24px 0' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, color: '#111' }}>{editor.id ? 'Editar produto' : 'Novo produto'}</h3>
            <label style={lbl}>Nome *</label>
            <input value={editor.nome || ''} onChange={e => setEditor({ ...editor, nome: e.target.value })} placeholder="Ex.: iPhone 15 128GB" style={{ ...inp, width: '100%', marginBottom: 10 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div><label style={lbl}>Categoria</label><select value={editor.categoria} onChange={e => setEditor({ ...editor, categoria: e.target.value })} style={{ ...inp, width: '100%', background: '#fff' }}>{CATEGORIAS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select></div>
              <div><label style={lbl}>SKU</label><input value={editor.sku || ''} onChange={e => setEditor({ ...editor, sku: e.target.value })} placeholder="opcional" style={{ ...inp, width: '100%' }} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div><label style={lbl}>Preço venda *</label><input type="number" min="0" step="0.01" value={editor.precoVenda ?? ''} onChange={e => setEditor({ ...editor, precoVenda: Number(e.target.value) })} style={{ ...inp, width: '100%' }} /></div>
              <div><label style={lbl}>Custo</label><input type="number" min="0" step="0.01" value={editor.precoCusto ?? ''} onChange={e => setEditor({ ...editor, precoCusto: e.target.value === '' ? undefined : Number(e.target.value) })} style={{ ...inp, width: '100%' }} /></div>
              <div><label style={lbl}>Estoque mín.</label><input type="number" min="0" value={editor.estoqueMinimo ?? ''} onChange={e => setEditor({ ...editor, estoqueMinimo: e.target.value === '' ? undefined : Number(e.target.value) })} style={{ ...inp, width: '100%' }} /></div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#444', margin: '2px 0 16px' }}>
              <input type="checkbox" checked={editor.ativo !== false} onChange={e => setEditor({ ...editor, ativo: e.target.checked })} /> Ativo (aparece nas vendas)
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={salvar} disabled={!(editor.nome || '').trim()} style={{ flex: 1, padding: '11px 0', background: (editor.nome || '').trim() ? '#ffc00f' : '#f0f0f0', color: (editor.nome || '').trim() ? '#111' : '#aaa', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Salvar</button>
              <button onClick={() => setEditor(null)} style={{ padding: '11px 18px', background: '#f5f5f5', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
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
      <div style={{ padding: 24, background: '#fff', borderRadius: 14, border: '1px solid #f0f0f0', textAlign: 'center' }}>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: '#666' }}>Nenhuma loja cadastrada. O estoque é por loja — crie a primeira.</p>
        {podeGerirLojas && <button onClick={onGerirLojas} style={{ padding: '9px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Cadastrar loja</button>}
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
        <span style={{ fontSize: 13.5, fontWeight: 800, color: '#111' }}>{consolidado ? 'Estoque · todas as lojas (rede)' : `Estoque · ${lojaFocoNome || 'loja'}`}</span>
        {podeGerirLojas && <button onClick={onGerirLojas} style={{ marginLeft: 'auto', padding: '9px 14px', background: '#fff', color: '#444', border: '1.5px solid #e2e2e2', borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Gerenciar lojas</button>}
      </div>

      {produtos.length === 0 ? <p style={{ color: '#bbb', fontSize: 13, padding: 20 }}>Cadastre produtos no Catálogo antes de gerir estoque.</p>
        : consolidado ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 11, overflow: 'hidden', border: '1px solid #f0f0f0' }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
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
                    <tr key={p.id} style={{ borderTop: '1px solid #f4f4f4' }}>
                      <td style={tdL}><span style={{ fontWeight: 600, color: '#111' }}>{p.nome}</span>{p.sku ? <span style={{ color: '#aaa', fontSize: 12 }}> · {p.sku}</span> : ''}</td>
                      {cols.map((s, i) => { const baixo = abaixoDoMinimo(s, p.estoqueMinimo); return <td key={i} style={{ ...tdR, color: baixo ? '#dc2626' : '#111', fontWeight: baixo ? 800 : 600 }}>{s}</td> })}
                      <td style={{ ...tdR, fontWeight: 800 }}>{total}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p style={{ margin: '10px 2px 0', fontSize: 11.5, color: '#aaa' }}>Para movimentar o estoque, escolha uma loja no seletor lateral.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {produtos.map(p => {
              const s = saldos[p.id] || 0
              const baixo = abaixoDoMinimo(s, p.estoqueMinimo)
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: '#fff', borderRadius: 11, border: '1px solid #f0f0f0' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111' }}>{p.nome}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#999' }}>{catLabel(p.categoria)}{p.sku ? ` · ${p.sku}` : ''}</p>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: baixo ? '#dc2626' : '#111', whiteSpace: 'nowrap' }}>{s} un.</span>
                  {baixo && <span style={{ fontSize: 10.5, fontWeight: 800, color: '#dc2626', background: '#fef2f2', borderRadius: 999, padding: '3px 9px' }}>abaixo do mín.</span>}
                  {podeEditar && <button onClick={() => setMov({ produto: p })} style={{ padding: '6px 12px', background: '#f5f5f5', color: '#444', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Movimentar</button>}
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
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, padding: 22 }}>
        <h3 style={{ margin: '0 0 2px', fontSize: 16, color: '#111' }}>{produto.nome}</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#888' }}>Saldo atual nesta loja: <strong>{saldoAtual} un.</strong></p>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {([['entrada', 'Entrada'], ['ajuste', 'Ajuste'], ['transferencia', 'Transferir']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTipo(k)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: tipo === k ? '1.5px solid #111' : '1.5px solid #e2e2e2', background: tipo === k ? '#111' : '#fff', color: tipo === k ? '#fff' : '#666', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        <label style={lbl}>{tipo === 'ajuste' ? 'Saldo correto (contagem física)' : 'Quantidade'}</label>
        <input type="number" min="0" value={qtd} onChange={e => setQtd(e.target.value)} autoFocus style={{ ...inp, width: '100%', marginBottom: 10 }} />
        {tipo === 'transferencia' && (
          <>
            <label style={lbl}>Loja de destino</label>
            <select value={lojaDestinoId} onChange={e => setLojaDestinoId(e.target.value)} style={{ ...inp, width: '100%', background: '#fff', marginBottom: 10 }}>
              <option value="">Selecione…</option>
              {outras.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </>
        )}
        <label style={lbl}>Motivo (opcional)</label>
        <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: recebimento NF 123" style={{ ...inp, width: '100%', marginBottom: 18 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={aplicar} disabled={enviando} style={{ flex: 1, padding: '11px 0', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>{enviando ? 'Aplicando…' : 'Aplicar'}</button>
          <button onClick={onFechar} style={{ padding: '11px 18px', background: '#f5f5f5', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Gestão de lojas (robusta) ───────────────────────────────────────────────
function LojasView({ lojas, produtos, onMudou }: { lojas: Loja[]; produtos: Produto[]; onMudou: () => void }) {
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
        <p style={{ margin: 0, fontSize: 13, color: '#999' }}>{lojas.length} loja(s) · cada uma tem estoque, PDV, CRM e WhatsApp próprios.</p>
        <button onClick={() => setEditando('novo')} style={{ padding: '9px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Nova loja</button>
      </div>

      {lojas.length === 0 ? <p style={{ color: '#bbb', fontSize: 13, padding: 20 }}>Nenhuma loja ainda. Crie a primeira unidade.</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {lojas.map(l => {
            const saldos = porLoja[l.id] || {}
            const comEstoque = produtos.filter(p => (saldos[p.id] || 0) > 0).length
            const unidades = Object.values(saldos).reduce((s, v) => s + (Number(v) || 0), 0)
            const inativa = l.ativa === false
            return (
              <div key={l.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #f0f0f0', boxShadow: '0 1px 5px rgba(0,0,0,0.05)', padding: 16, opacity: inativa ? 0.65 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#111' }}>{l.nome}{l.codigo && <span style={{ fontSize: 11, fontWeight: 800, color: '#666', background: '#f0f0f0', borderRadius: 6, padding: '2px 7px', marginLeft: 8 }}>{l.codigo}</span>}</p>
                    {l.endereco && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.endereco}</p>}
                  </div>
                  {inativa && <span style={{ fontSize: 10, fontWeight: 800, color: '#b45309', background: '#fef3c7', borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap' }}>inativa</span>}
                </div>
                <div style={{ display: 'flex', gap: 16, margin: '12px 0', fontSize: 12.5, color: '#444' }}>
                  <span><strong style={{ color: '#111' }}>{comEstoque}</strong> produtos</span>
                  <span><strong style={{ color: '#111' }}>{unidades}</strong> un. em estoque</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#888', marginBottom: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.evolutionInstance ? '#16a34a' : '#ccc', flexShrink: 0 }} />
                  {l.evolutionInstance ? `WhatsApp: ${l.evolutionInstance}` : 'WhatsApp não configurado'}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setEditando(l)} style={{ flex: 1, padding: '7px 0', background: '#f5f5f5', color: '#444', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Editar</button>
                  <button onClick={() => salvarLista(lojas.map(x => x.id === l.id ? { ...x, ativa: inativa } : x))} style={{ padding: '7px 12px', background: '#fff', color: '#666', border: '1px solid #e2e2e2', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>{inativa ? 'Ativar' : 'Desativar'}</button>
                  <button onClick={() => excluir(l)} title="Excluir" style={{ padding: '7px 10px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>×</button>
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
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, padding: 22, margin: '24px 0' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 16, color: '#111' }}>{loja ? 'Editar loja' : 'Nova loja'}</h3>
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
        <p style={{ margin: '0 0 14px', fontSize: 11, color: '#aaa' }}>Cada loja pareia o seu próprio número. Deixe vazio se ainda não usa WhatsApp por loja.</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#444', marginBottom: 16 }}>
          <input type="checkbox" checked={f.ativa !== false} onChange={e => set({ ativa: e.target.checked })} /> Loja ativa (aparece nos seletores e no PDV)
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={salvar} disabled={salvando || !f.nome.trim()} style={{ flex: 1, padding: '11px 0', background: f.nome.trim() ? '#ffc00f' : '#f0f0f0', color: f.nome.trim() ? '#111' : '#aaa', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>{salvando ? 'Salvando…' : 'Salvar loja'}</button>
          <button onClick={onFechar} style={{ padding: '11px 18px', background: '#f5f5f5', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
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
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 580, padding: 22, margin: '24px 0' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#111' }}>Importar produtos em massa</h3>
        <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#888' }}>O catálogo é compartilhado; casa por SKU (ou nome) — existente atualiza, novo é criado. A quantidade entra no estoque da <strong>loja escolhida</strong>.</p>
        <label style={lbl}>Loja de destino do estoque</label>
        <select value={lojaId} onChange={e => setLojaId(e.target.value)} style={{ ...inp, width: '100%', background: '#fff', marginBottom: 12 }}>
          <option value="">Selecione a loja…</option>
          {lojasAtivas.map(l => <option key={l.id} value={l.id}>{l.nome}{l.codigo ? ` (${l.codigo})` : ''}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <label style={{ ...lbl, margin: 0 }}>Envie o arquivo do seu sistema (.csv) ou cole abaixo</label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: '#111', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            Enviar arquivo
            <input type="file" accept=".csv,.txt,text/csv" onChange={onArquivo} style={{ display: 'none' }} />
          </label>
        </div>
        <div style={{ margin: '0 0 6px', fontSize: 11, color: '#aaa' }}>Reconhece o export do seu ERP (Descrição, Preço Venda, Estoque, Custo, Est. Mínimo, Código Barras…) OU o formato simples: <code>Nome · SKU · Categoria · Preço · Custo · Estoque mín · Quantidade</code>.</div>
        <textarea value={texto} onChange={e => setTexto(e.target.value)} placeholder={'Cole aqui ou envie o .csv…\niPhone 15 128GB;IP15128;smartphone;5.999,00;4.200,00;2;10'} style={{ ...inp, width: '100%', minHeight: 150, fontFamily: 'ui-monospace, monospace', fontSize: 12, resize: 'vertical' }} />
        <div style={{ margin: '10px 0 16px', fontSize: 12.5, color: '#444' }}>
          {texto.trim() ? <><strong style={{ color: linhas.length ? '#16a34a' : '#b91c1c' }}>{linhas.length}</strong> produto(s) prontos{ignoradas > 0 && <span style={{ color: '#b45309' }}> · {ignoradas} linha(s) ignorada(s) (sem preço)</span>}</> : <span style={{ color: '#aaa' }}>Cole os dados para ver a prévia.</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={importar} disabled={enviando || !linhas.length || !lojaId} style={{ flex: 1, padding: '11px 0', background: (linhas.length && lojaId) ? '#16a34a' : '#eee', color: (linhas.length && lojaId) ? '#fff' : '#aaa', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>{enviando ? 'Importando…' : `Importar ${linhas.length || ''}`}</button>
          <button onClick={onFechar} style={{ padding: '11px 18px', background: '#f5f5f5', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 700, color: '#888', marginBottom: 5 }
const thL: React.CSSProperties = { textAlign: 'left', padding: '10px 14px', fontSize: 11.5, fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...thL, textAlign: 'right' }
const tdL: React.CSSProperties = { textAlign: 'left', padding: '10px 14px', fontSize: 13.5 }
const tdR: React.CSSProperties = { textAlign: 'right', padding: '10px 14px', fontSize: 13.5, whiteSpace: 'nowrap' }
