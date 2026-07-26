'use client'
import { useEffect, useMemo, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'
import { totalVenda } from '@/lib/estoque'

type Produto = { id: string; nome: string; sku?: string; categoria: string; precoVenda: number; ativo?: boolean }
type ItemCarrinho = { produtoId: string; nome: string; quantidade: number; precoUnit: number }
type Contato = { id: string; nome: string; telefone?: string }
type Venda = { id: string; itens: ItemCarrinho[]; total: number; desconto?: number; formaPagamento: string; contatoId?: string; vendedor?: string; data: string; cancelada?: boolean }

const FORMAS: [string, string][] = [['dinheiro', 'Dinheiro'], ['pix', 'Pix'], ['debito', 'Débito'], ['credito', 'Crédito'], ['boleto', 'Boleto'], ['outro', 'Outro']]
const formaLabel = (k: string) => FORMAS.find(f => f[0] === k)?.[1] || k
const brl = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const inp: React.CSSProperties = { padding: '9px 11px', borderRadius: 9, border: '1.5px solid #e2e2e2', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }

export default function Vendas({ lojaAtiva = '', bloqueado = false, podeEditar = true }: { lojaAtiva?: string; bloqueado?: boolean; podeEditar?: boolean }) {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [saldos, setSaldos] = useState<Record<string, number>>({})
  const [contatos, setContatos] = useState<Contato[]>([])
  const [vendas, setVendas] = useState<Venda[]>([])
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
  const [busca, setBusca] = useState('')
  const [desconto, setDesconto] = useState('')
  const [forma, setForma] = useState('dinheiro')
  const [contatoId, setContatoId] = useState('')
  const [buscaContato, setBuscaContato] = useState('')
  const [finalizando, setFinalizando] = useState(false)

  function carregar() {
    fetch('/api/produtos').then(r => r.json()).then(d => setProdutos((Array.isArray(d?.produtos) ? d.produtos : []).filter((p: Produto) => p.ativo !== false))).catch(() => {})
    fetch(`/api/crm/contatos?lojaId=${encodeURIComponent(lojaAtiva)}`).then(r => r.json()).then(d => setContatos(Array.isArray(d) ? d : [])).catch(() => {})
    fetch(`/api/vendas?lojaId=${encodeURIComponent(lojaAtiva)}`).then(r => r.json()).then(d => setVendas(Array.isArray(d?.vendas) ? d.vendas : [])).catch(() => {})
    fetch(`/api/estoque?lojaId=${encodeURIComponent(lojaAtiva)}`).then(r => r.json()).then(d => setSaldos(d?.saldos || {})).catch(() => {})
  }
  useEffect(() => { carregar() /* eslint-disable-next-line */ }, [lojaAtiva])

  const total = useMemo(() => totalVenda(carrinho, Number(desconto) || 0), [carrinho, desconto])
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return produtos.filter(p => !q || `${p.nome} ${p.sku || ''}`.toLowerCase().includes(q)).slice(0, 40)
  }, [produtos, busca])
  const contatoSel = contatos.find(c => c.id === contatoId)

  function addProduto(p: Produto) {
    setCarrinho(c => {
      const ex = c.find(x => x.produtoId === p.id)
      if (ex) return c.map(x => x.produtoId === p.id ? { ...x, quantidade: x.quantidade + 1 } : x)
      return [...c, { produtoId: p.id, nome: p.nome, quantidade: 1, precoUnit: p.precoVenda }]
    })
  }
  const setItem = (pid: string, patch: Partial<ItemCarrinho>) => setCarrinho(c => c.map(x => x.produtoId === pid ? { ...x, ...patch } : x))
  const remover = (pid: string) => setCarrinho(c => c.filter(x => x.produtoId !== pid))

  async function finalizar() {
    if (!carrinho.length || finalizando) return
    setFinalizando(true)
    const r = await fetch('/api/vendas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lojaId: lojaAtiva, itens: carrinho, desconto: Number(desconto) || 0, formaPagamento: forma, contatoId: contatoId || undefined }),
    }).then(x => x.json()).catch(() => null)
    setFinalizando(false)
    if (r?.ok) { toast('Venda registrada e estoque baixado.', 'sucesso'); setCarrinho([]); setDesconto(''); setContatoId(''); setBuscaContato(''); carregar() }
    else toast(r?.error || 'Não foi possível registrar a venda.', 'erro')
  }

  async function cancelar(v: Venda) {
    if (!(await confirmar(`Cancelar esta venda de ${brl(v.total)}? O estoque volta e a entrada sai do caixa.`, { titulo: 'Cancelar venda', okLabel: 'Cancelar venda', perigo: true }))) return
    const r = await fetch(`/api/vendas?id=${v.id}`, { method: 'DELETE' }).then(x => x.json()).catch(() => null)
    if (r?.ok) { toast('Venda cancelada e estoque estornado.', 'sucesso'); carregar() }
    else toast(r?.error || 'Não foi possível cancelar.', 'erro')
  }

  if (bloqueado) {
    return (
      <div style={{ padding: 26, background: '#fff', borderRadius: 14, border: '1px solid #f0f0f0', textAlign: 'center', maxWidth: 520 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 17, color: '#111' }}>PDV</h2>
        <p style={{ margin: 0, fontSize: 13.5, color: '#777' }}>Escolha uma <strong>loja</strong> no seletor lateral (“Ver loja”) para registrar vendas — a venda baixa o estoque daquela unidade.</p>
      </div>
    )
  }

  const buscaLc = buscaContato.trim().toLowerCase()
  const contatosFiltrados = buscaLc ? contatos.filter(c => c.nome.toLowerCase().includes(buscaLc) || (c.telefone || '').includes(buscaLc)).slice(0, 8) : []

  return (
    <div>
      <h2 style={{ margin: '0 0 14px', fontSize: 18, color: '#111' }}>PDV — nova venda</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
        {/* Catálogo */}
        <div>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto por nome ou SKU…" style={{ ...inp, width: '100%', marginBottom: 10 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 460, overflowY: 'auto' }}>
            {filtrados.length === 0 ? <p style={{ color: '#bbb', fontSize: 13, padding: 14 }}>{produtos.length === 0 ? 'Nenhum produto no catálogo.' : 'Nada encontrado.'}</p>
              : filtrados.map(p => {
                const s = saldos[p.id] || 0
                return (
                  <button key={p.id} onClick={() => addProduto(p)} disabled={!podeEditar} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#fff', borderRadius: 10, border: '1px solid #f0f0f0', cursor: podeEditar ? 'pointer' : 'default', textAlign: 'left', fontFamily: 'inherit' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11.5, color: s > 0 ? '#999' : '#dc2626' }}>{p.sku ? `${p.sku} · ` : ''}{s} em estoque</p>
                    </div>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: '#16a34a', whiteSpace: 'nowrap' }}>{brl(p.precoVenda)}</span>
                    <span style={{ fontSize: 18, color: '#111', fontWeight: 700, lineHeight: 1 }}>+</span>
                  </button>
                )
              })}
          </div>
        </div>

        {/* Carrinho */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f0f0f0', padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>Carrinho</span>
          {carrinho.length === 0 ? <p style={{ color: '#bbb', fontSize: 13, margin: '14px 0' }}>Toque num produto para adicionar.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0' }}>
              {carrinho.map(it => (
                <div key={it.produtoId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.nome}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                      <span style={{ fontSize: 11, color: '#aaa' }}>R$</span>
                      <input type="number" min="0" step="0.01" value={it.precoUnit} onChange={e => setItem(it.produtoId, { precoUnit: Number(e.target.value) })} title="Preço unitário (ajustável)" style={{ ...inp, width: 82, padding: '5px 8px', fontSize: 12 }} />
                      <span style={{ fontSize: 11, color: '#aaa' }}>×</span>
                      <input type="number" min="1" value={it.quantidade} onChange={e => setItem(it.produtoId, { quantidade: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} style={{ ...inp, width: 56, padding: '5px 8px', fontSize: 12 }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#111', whiteSpace: 'nowrap' }}>{brl(it.precoUnit * it.quantidade)}</span>
                  <button onClick={() => remover(it.produtoId)} style={{ background: 'none', border: 'none', color: '#ccc', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* Cliente (opcional) */}
          <div style={{ borderTop: '1px solid #f4f4f4', paddingTop: 12, marginTop: 4 }}>
            {contatoSel ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#444' }}>
                Cliente: <strong>{contatoSel.nome}</strong>
                <button onClick={() => { setContatoId(''); setBuscaContato('') }} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>trocar</button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input value={buscaContato} onChange={e => setBuscaContato(e.target.value)} placeholder="Cliente (opcional) — buscar por nome/telefone" style={{ ...inp, width: '100%', fontSize: 12.5 }} />
                {contatosFiltrados.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #eee', borderRadius: 10, marginTop: 4, zIndex: 5, boxShadow: '0 4px 14px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    {contatosFiltrados.map(c => (
                      <button key={c.id} onClick={() => { setContatoId(c.id); setBuscaContato('') }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: '#111', fontFamily: 'inherit' }}>{c.nome}{c.telefone ? ` · ${c.telefone}` : ''}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desconto + pagamento + total */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <div><label style={lbl}>Desconto (R$)</label><input type="number" min="0" step="0.01" value={desconto} onChange={e => setDesconto(e.target.value)} style={{ ...inp, width: '100%' }} /></div>
            <div><label style={lbl}>Pagamento</label><select value={forma} onChange={e => setForma(e.target.value)} style={{ ...inp, width: '100%', background: '#fff' }}>{FORMAS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '14px 0 12px' }}>
            <span style={{ fontSize: 13, color: '#888', fontWeight: 700 }}>Total</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#111' }}>{brl(total)}</span>
          </div>
          <button onClick={finalizar} disabled={!carrinho.length || finalizando || !podeEditar} style={{ width: '100%', padding: '13px 0', background: (!carrinho.length || finalizando) ? '#eee' : '#16a34a', color: (!carrinho.length || finalizando) ? '#aaa' : '#fff', border: 'none', borderRadius: 11, fontWeight: 800, fontSize: 15, cursor: (!carrinho.length || finalizando) ? 'default' : 'pointer' }}>
            {finalizando ? 'Registrando…' : 'Finalizar venda'}
          </button>
        </div>
      </div>

      {/* Vendas recentes */}
      {vendas.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 14, color: '#111' }}>Vendas recentes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {vendas.slice(0, 20).map(v => (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: v.cancelada ? '#fafafa' : '#fff', borderRadius: 10, border: '1px solid #f0f0f0', opacity: v.cancelada ? 0.7 : 1 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#111' }}>{v.itens.reduce((n, i) => n + i.quantidade, 0)} item(ns) · {formaLabel(v.formaPagamento)} {v.cancelada && <span style={{ fontSize: 10.5, fontWeight: 800, color: '#dc2626', background: '#fef2f2', borderRadius: 999, padding: '2px 8px', marginLeft: 4 }}>cancelada</span>}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#999' }}>{new Date(v.data).toLocaleString('pt-BR')}{v.vendedor ? ` · ${v.vendedor}` : ''}</p>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: v.cancelada ? '#bbb' : '#16a34a', textDecoration: v.cancelada ? 'line-through' : 'none' }}>{brl(v.total)}</span>
                {podeEditar && !v.cancelada && <button onClick={() => cancelar(v)} title="Cancelar venda" style={{ background: 'none', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 8, fontWeight: 700, fontSize: 11.5, cursor: 'pointer', padding: '5px 10px' }}>Cancelar</button>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 700, color: '#888', marginBottom: 5 }
