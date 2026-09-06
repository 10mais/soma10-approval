'use client'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast, confirmar } from '@/lib/toast'
import { totalVenda } from '@/lib/estoque'

type Produto = { id: string; nome: string; sku?: string; categoria: string; precoVenda: number; ativo?: boolean }
type ItemCarrinho = { produtoId: string; nome: string; quantidade: number; precoUnit: number }
type Contato = { id: string; nome: string; telefone?: string }
type Vendedor = { id: string; nome: string; email: string; role: string }
type Venda = { id: string; itens: ItemCarrinho[]; total: number; desconto?: number; formaPagamento: string; contatoId?: string; vendedor?: string; data: string; cancelada?: boolean }

const FORMAS: [string, string][] = [['dinheiro', 'Dinheiro'], ['pix', 'Pix'], ['debito', 'Débito'], ['credito', 'Crédito'], ['boleto', 'Boleto'], ['outro', 'Outro']]
const formaLabel = (k: string) => FORMAS.find(f => f[0] === k)?.[1] || k
const brl = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const inp: React.CSSProperties = { padding: '9px 11px', borderRadius: 9, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }
const PAPEL_LOJA: Record<string, string> = { usuario: 'Estoquista', vendas: 'Vendedor', gerente: 'Gerente', admin: 'Admin' }

export default function Vendas({ lojaAtiva = '', bloqueado = false, podeEditar = true }: { lojaAtiva?: string; bloqueado?: boolean; podeEditar?: boolean }) {
  const { data: session } = useSession()
  const meuNome = (session?.user?.name || '').trim()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [saldos, setSaldos] = useState<Record<string, number>>({})
  const [contatos, setContatos] = useState<Contato[]>([])
  const [vendas, setVendas] = useState<Venda[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [vendedor, setVendedor] = useState('')
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
  const [busca, setBusca] = useState('')
  const [desconto, setDesconto] = useState('')
  const [forma, setForma] = useState('dinheiro')
  const [contatoId, setContatoId] = useState('')
  const [buscaContato, setBuscaContato] = useState('')
  const [cadastrando, setCadastrando] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoTel, setNovoTel] = useState('')
  const [salvandoCli, setSalvandoCli] = useState(false)
  const [finalizando, setFinalizando] = useState(false)
  const [recibo, setRecibo] = useState<Venda | null>(null)
  const [lojasNome, setLojasNome] = useState<Record<string, string>>({})

  function carregar() {
    fetch(`/api/produtos?lojaId=${encodeURIComponent(lojaAtiva)}`).then(r => r.json()).then(d => setProdutos((Array.isArray(d?.produtos) ? d.produtos : []).filter((p: Produto) => p.ativo !== false))).catch(() => {})
    fetch(`/api/crm/contatos?lojaId=${encodeURIComponent(lojaAtiva)}`).then(r => r.json()).then(d => setContatos(Array.isArray(d) ? d : [])).catch(() => {})
    fetch(`/api/vendas?lojaId=${encodeURIComponent(lojaAtiva)}`).then(r => r.json()).then(d => setVendas(Array.isArray(d?.vendas) ? d.vendas : [])).catch(() => {})
    fetch(`/api/estoque?lojaId=${encodeURIComponent(lojaAtiva)}`).then(r => r.json()).then(d => setSaldos(d?.saldos || {})).catch(() => {})
    fetch('/api/lojas').then(r => r.json()).then(d => setLojasNome(Object.fromEntries((Array.isArray(d) ? d : []).map((l: any) => [l.id, l.nome])))).catch(() => {})
    fetch(`/api/vendas/vendedores?lojaId=${encodeURIComponent(lojaAtiva)}`).then(r => r.json()).then(d => setVendedores(Array.isArray(d?.vendedores) ? d.vendedores : [])).catch(() => {})
  }
  useEffect(() => { carregar() /* eslint-disable-next-line */ }, [lojaAtiva])
  // Padrão do vendedor: eu mesmo (se estou na lista da loja), senão o único vendedor.
  useEffect(() => {
    if (vendedor) return
    const eu = vendedores.find(v => v.nome === meuNome)
    if (eu) setVendedor(eu.nome)
    else if (vendedores.length === 1) setVendedor(vendedores[0].nome)
  }, [vendedores, meuNome, vendedor])

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

  async function novoCliente() {
    const nome = novoNome.trim()
    if (!nome || salvandoCli) return
    setSalvandoCli(true)
    // A rota carimba o lojaId pelo escopo (podeEscreverNaLoja): operador cai na
    // sua loja; passar lojaAtiva só resolve o caso admin/gestor com loja focada.
    const r = await fetch('/api/crm/contatos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, telefone: novoTel.trim() || undefined, lojaId: lojaAtiva || undefined }),
    }).then(x => x.json()).catch(() => null)
    setSalvandoCli(false)
    if (r?.ok && r.contato) {
      setContatos(cs => [...cs, r.contato as Contato].sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' })))
      setContatoId(r.contato.id)
      setCadastrando(false); setNovoNome(''); setNovoTel(''); setBuscaContato('')
      toast('Cliente cadastrado e vinculado à venda.', 'sucesso')
    } else toast(r?.error || 'Não foi possível cadastrar o cliente.', 'erro')
  }

  async function finalizar() {
    if (!carrinho.length || finalizando) return
    setFinalizando(true)
    const r = await fetch('/api/vendas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lojaId: lojaAtiva, itens: carrinho, desconto: Number(desconto) || 0, formaPagamento: forma, contatoId: contatoId || undefined, vendedor: vendedor || undefined }),
    }).then(x => x.json()).catch(() => null)
    setFinalizando(false)
    if (r?.ok) { toast('Venda registrada e estoque baixado.', 'sucesso'); setRecibo(r.venda); setCarrinho([]); setDesconto(''); setContatoId(''); setBuscaContato(''); carregar() }
    else toast(r?.error || 'Não foi possível registrar a venda.', 'erro')
  }

  function imprimirRecibo(v: Venda) {
    const esc = (s: string) => String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] || c))
    const nomeLoja = lojasNome[(v as any).lojaId] || 'Space Technology'
    const linhas = v.itens.map(i => `<tr><td>${esc(i.nome)}</td><td style="text-align:center">${i.quantidade}</td><td style="text-align:right">${brl(i.precoUnit)}</td><td style="text-align:right">${brl(i.precoUnit * i.quantidade)}</td></tr>`).join('')
    const cliente = v.contatoId ? (contatos.find(c => c.id === v.contatoId)?.nome || '') : ''
    const html = `<html><head><meta charset="utf-8"><title>Comprovante de venda</title><style>body{font-family:system-ui,Arial,sans-serif;max-width:360px;margin:20px auto;color:#111;font-size:13px}h2{margin:0 0 2px;font-size:16px}table{width:100%;border-collapse:collapse;margin:12px 0}td,th{padding:4px 0;border-bottom:1px solid #eee}th{text-align:left;font-size:11px;color:#888}.tot{font-size:18px;font-weight:800;text-align:right;margin-top:6px}.muted{color:#777;font-size:12px}</style></head><body>
<h2>${esc(nomeLoja)}</h2><div class="muted">Comprovante de venda</div>
<div class="muted">${new Date(v.data).toLocaleString('pt-BR')}${v.vendedor ? ' · ' + esc(v.vendedor) : ''}</div>
${cliente ? `<div class="muted">Cliente: ${esc(cliente)}</div>` : ''}
<table><thead><tr><th>Item</th><th style="text-align:center">Qtd</th><th style="text-align:right">Unit</th><th style="text-align:right">Subtotal</th></tr></thead><tbody>${linhas}</tbody></table>
${v.desconto ? `<div class="muted" style="text-align:right">Desconto: ${brl(v.desconto)}</div>` : ''}
<div class="tot">Total: ${brl(v.total)}</div>
<div class="muted" style="text-align:right">Pagamento: ${esc(formaLabel(v.formaPagamento))}</div>
<script>window.onload=function(){window.print()}</script></body></html>`
    const w = window.open('', '_blank', 'width=420,height=640')
    if (!w) { toast('Permita pop-ups para imprimir o comprovante.', 'info'); return }
    w.document.write(html); w.document.close()
  }

  async function cancelar(v: Venda) {
    if (!(await confirmar(`Cancelar esta venda de ${brl(v.total)}? O estoque volta e a entrada sai do caixa.`, { titulo: 'Cancelar venda', okLabel: 'Cancelar venda', perigo: true }))) return
    const r = await fetch(`/api/vendas?id=${v.id}`, { method: 'DELETE' }).then(x => x.json()).catch(() => null)
    if (r?.ok) { toast('Venda cancelada e estoque estornado.', 'sucesso'); carregar() }
    else toast(r?.error || 'Não foi possível cancelar.', 'erro')
  }

  if (bloqueado) {
    return (
      <div style={{ padding: 26, background: 'var(--v2-surface)', borderRadius: 14, border: '1px solid var(--v2-rule)', textAlign: 'center', maxWidth: 520 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 17, color: 'var(--v2-ink)' }}>PDV</h2>
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--v2-ink3)' }}>Escolha uma <strong>loja</strong> no seletor lateral (“Ver loja”) para registrar vendas — a venda baixa o estoque daquela unidade.</p>
      </div>
    )
  }

  const buscaLc = buscaContato.trim().toLowerCase()
  const contatosFiltrados = buscaLc ? contatos.filter(c => c.nome.toLowerCase().includes(buscaLc) || (c.telefone || '').includes(buscaLc)).slice(0, 8) : []

  return (
    <div>
      <h2 style={{ margin: '0 0 14px', fontSize: 18, color: 'var(--v2-ink)' }}>PDV — nova venda</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
        {/* Catálogo */}
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto por nome ou SKU…" style={{ ...inp, flex: 1 }} />
            <button onClick={carregar} title="Atualizar produtos e estoque" style={{ ...inp, padding: '9px 14px', background: 'var(--v2-surface1)', color: 'var(--v2-ink2)', fontWeight: 700, cursor: 'pointer', border: 'none' }}>Atualizar</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 460, overflowY: 'auto' }}>
            {filtrados.length === 0 ? <p style={{ color: 'var(--v2-ink3)', fontSize: 13, padding: 14 }}>{produtos.length === 0 ? 'Nenhum produto no catálogo.' : 'Nada encontrado.'}</p>
              : filtrados.map(p => {
                const s = saldos[p.id] || 0
                return (
                  <button key={p.id} onClick={() => addProduto(p)} disabled={!podeEditar} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--v2-surface)', borderRadius: 10, border: '1px solid var(--v2-rule)', cursor: podeEditar ? 'pointer' : 'default', textAlign: 'left', fontFamily: 'inherit' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11.5, color: s > 0 ? 'var(--v2-ink3)' : 'var(--v2-hot)' }}>{p.sku ? `${p.sku} · ` : ''}{s} em estoque</p>
                    </div>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--v2-ok)', whiteSpace: 'nowrap' }}>{brl(p.precoVenda)}</span>
                    <span style={{ fontSize: 18, color: 'var(--v2-ink)', fontWeight: 700, lineHeight: 1 }}>+</span>
                  </button>
                )
              })}
          </div>
        </div>

        {/* Carrinho */}
        <div style={{ background: 'var(--v2-surface)', borderRadius: 14, border: '1px solid var(--v2-rule)', padding: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--v2-ink)' }}>Carrinho</span>
          {carrinho.length === 0 ? <p style={{ color: 'var(--v2-ink3)', fontSize: 13, margin: '14px 0' }}>Toque num produto para adicionar.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0' }}>
              {carrinho.map(it => (
                <div key={it.produtoId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.nome}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                      <span style={{ fontSize: 11, color: 'var(--v2-ink3)' }}>R$</span>
                      <input type="number" min="0" step="0.01" value={it.precoUnit} onChange={e => setItem(it.produtoId, { precoUnit: Number(e.target.value) })} title="Preço unitário (ajustável)" style={{ ...inp, width: 82, padding: '5px 8px', fontSize: 12 }} />
                      <span style={{ fontSize: 11, color: 'var(--v2-ink3)' }}>×</span>
                      <input type="number" min="1" value={it.quantidade} onChange={e => setItem(it.produtoId, { quantidade: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} style={{ ...inp, width: 56, padding: '5px 8px', fontSize: 12 }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--v2-ink)', whiteSpace: 'nowrap' }}>{brl(it.precoUnit * it.quantidade)}</span>
                  <button onClick={() => remover(it.produtoId)} style={{ background: 'none', border: 'none', color: 'var(--v2-ink3)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* Cliente (opcional) */}
          <div style={{ borderTop: '1px solid var(--v2-surface1)', paddingTop: 12, marginTop: 4 }}>
            {contatoSel ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--v2-ink2)' }}>
                Cliente: <strong>{contatoSel.nome}</strong>
                <button onClick={() => { setContatoId(''); setBuscaContato('') }} style={{ background: 'none', border: 'none', color: 'var(--v2-info)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>trocar</button>
              </div>
            ) : cadastrando ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--v2-ink)' }}>Novo cliente</span>
                <input value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Nome*" autoFocus style={{ ...inp, width: '100%', fontSize: 12.5 }} />
                <input value={novoTel} onChange={e => setNovoTel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') novoCliente() }} placeholder="Telefone (opcional)" inputMode="tel" style={{ ...inp, width: '100%', fontSize: 12.5 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={novoCliente} disabled={!novoNome.trim() || salvandoCli} style={{ flex: 1, padding: '8px 12px', borderRadius: 9, border: 'none', background: 'var(--v2-ink)', color: 'var(--v2-surface)', fontWeight: 700, fontSize: 12.5, cursor: novoNome.trim() && !salvandoCli ? 'pointer' : 'default', opacity: novoNome.trim() && !salvandoCli ? 1 : 0.5, fontFamily: 'inherit' }}>{salvandoCli ? 'Salvando…' : 'Salvar cliente'}</button>
                  <button onClick={() => { setCadastrando(false); setNovoNome(''); setNovoTel('') }} style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-ink2)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input value={buscaContato} onChange={e => setBuscaContato(e.target.value)} placeholder="Cliente (opcional) — buscar por nome/telefone" style={{ ...inp, width: '100%', fontSize: 12.5 }} />
                {contatosFiltrados.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 10, marginTop: 4, zIndex: 5, boxShadow: '0 4px 14px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    {contatosFiltrados.map(c => (
                      <button key={c.id} onClick={() => { setContatoId(c.id); setBuscaContato('') }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--v2-ink)', fontFamily: 'inherit' }}>{c.nome}{c.telefone ? ` · ${c.telefone}` : ''}</button>
                    ))}
                  </div>
                )}
                <button onClick={() => { setNovoNome(buscaContato.trim()); setNovoTel(''); setCadastrando(true) }} style={{ marginTop: 6, background: 'none', border: 'none', color: 'var(--v2-info)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>+ Cadastrar {buscaContato.trim() ? `"${buscaContato.trim()}"` : 'cliente novo'}</button>
              </div>
            )}
          </div>

          {/* Vendedor da loja */}
          <div style={{ marginTop: 12 }}>
            <label style={lbl}>Vendedor</label>
            {vendedores.length > 0 ? (
              <select value={vendedor} onChange={e => setVendedor(e.target.value)} style={{ ...inp, width: '100%', background: 'var(--v2-surface)' }}>
                <option value="">Balcão (sem vendedor)</option>
                {vendedores.map(v => <option key={v.id} value={v.nome}>{v.nome} · {PAPEL_LOJA[v.role] || v.role}</option>)}
              </select>
            ) : (
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--v2-amber)' }}>Nenhum vendedor nesta loja. Crie colaboradores (papel <strong>Vendas</strong>) vinculados à loja em Colaboradores.</p>
            )}
          </div>

          {/* Desconto + pagamento + total */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <div><label style={lbl}>Desconto (R$)</label><input type="number" min="0" step="0.01" value={desconto} onChange={e => setDesconto(e.target.value)} style={{ ...inp, width: '100%' }} /></div>
            <div><label style={lbl}>Pagamento</label><select value={forma} onChange={e => setForma(e.target.value)} style={{ ...inp, width: '100%', background: 'var(--v2-surface)' }}>{FORMAS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '14px 0 12px' }}>
            <span style={{ fontSize: 13, color: 'var(--v2-ink3)', fontWeight: 700 }}>Total</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--v2-ink)' }}>{brl(total)}</span>
          </div>
          <button onClick={finalizar} disabled={!carrinho.length || finalizando || !podeEditar} style={{ width: '100%', padding: '13px 0', background: (!carrinho.length || finalizando) ? 'var(--v2-surface2)' : 'var(--v2-ok)', color: (!carrinho.length || finalizando) ? 'var(--v2-ink3)' : 'var(--v2-surface)', border: 'none', borderRadius: 11, fontWeight: 800, fontSize: 15, cursor: (!carrinho.length || finalizando) ? 'default' : 'pointer' }}>
            {finalizando ? 'Registrando…' : 'Finalizar venda'}
          </button>
        </div>
      </div>

      {/* Vendas recentes */}
      {vendas.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--v2-ink)' }}>Vendas recentes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {vendas.slice(0, 20).map(v => (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: v.cancelada ? 'var(--v2-surface1)' : 'var(--v2-surface)', borderRadius: 10, border: '1px solid var(--v2-rule)', opacity: v.cancelada ? 0.7 : 1 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--v2-ink)' }}>{v.itens.reduce((n, i) => n + i.quantidade, 0)} item(ns) · {formaLabel(v.formaPagamento)} {v.cancelada && <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--v2-hot)', background: 'var(--v2-hot-bg)', borderRadius: 999, padding: '2px 8px', marginLeft: 4 }}>cancelada</span>}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--v2-ink3)' }}>{new Date(v.data).toLocaleString('pt-BR')}{v.vendedor ? ` · ${v.vendedor}` : ''}</p>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: v.cancelada ? 'var(--v2-ink3)' : 'var(--v2-ok)', textDecoration: v.cancelada ? 'line-through' : 'none' }}>{brl(v.total)}</span>
                {podeEditar && !v.cancelada && <button onClick={() => cancelar(v)} title="Cancelar venda" style={{ background: 'none', border: '1px solid var(--v2-hot-bg)', color: 'var(--v2-hot)', borderRadius: 8, fontWeight: 700, fontSize: 11.5, cursor: 'pointer', padding: '5px 10px' }}>Cancelar</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comprovante da venda recém-registrada */}
      {recibo && (
        <div onClick={() => setRecibo(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v2-surface)', borderRadius: 16, width: '100%', maxWidth: 380, padding: 22 }}>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--v2-ok-bg)', color: 'var(--v2-ok)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, marginBottom: 6 }}>✓</div>
              <h3 style={{ margin: 0, fontSize: 17, color: 'var(--v2-ink)' }}>Venda registrada</h3>
              <p style={{ margin: '2px 0 0', fontSize: 22, fontWeight: 800, color: 'var(--v2-ok)' }}>{brl(recibo.total)}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--v2-ink3)' }}>{recibo.itens.reduce((n, i) => n + i.quantidade, 0)} item(ns) · {formaLabel(recibo.formaPagamento)}</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => imprimirRecibo(recibo)} style={{ flex: 1, padding: '11px 0', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13.5, cursor: 'pointer' }}>Imprimir comprovante</button>
              <button onClick={() => setRecibo(null)} style={{ padding: '11px 18px', background: 'var(--v2-surface1)', color: 'var(--v2-ink2)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>Nova venda</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 5 }
