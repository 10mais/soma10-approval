'use client'
// Marca > Produtos e serviços — NOME + DESCRIÇÃO de cada oferta do cliente (dono, 28/09).
// A equipe edita; o cliente vê. Cada alteração salva na hora (regra do sistema: nada de
// "sair sem salvar"). A limpeza de verdade é no servidor (lib/marcaExtras.limparProdutos).
import { useEffect, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { confirmar, toast } from '@/lib/toast'
import { LIMITE_NOME, LIMITE_DESCRICAO_PRODUTO, LIMITE_PRODUTOS, type ProdutoServico } from '@/lib/marcaExtras'

const campo: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', background: 'var(--v2-surface)', color: 'var(--v2-ink)' }
const btnIcone: React.CSSProperties = { width: 28, height: 28, borderRadius: 7, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-ink3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }

export default function ProdutosServicos({ clienteId, inicial, podeEditar }: { clienteId: string; inicial?: ProdutoServico[]; podeEditar: boolean }) {
  const [lista, setLista] = useState<ProdutoServico[]>(inicial || [])
  const [editandoId, setEditandoId] = useState<string | null>(null) // 'novo' = formulário de inclusão
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // Trocou de cliente: nunca mostrar a lista do anterior.
  useEffect(() => { setLista(inicial || []); setEditandoId(null); setErro('') }, [clienteId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function gravar(nova: ProdutoServico[]): Promise<boolean> {
    setSalvando(true); setErro('')
    const r = await fetch('/api/clientes', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: clienteId, produtosServicos: nova }),
    }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (!r || r.error) { setErro(r?.error ? `Erro ao salvar: ${r.error}` : 'Erro ao salvar. Tente novamente.'); return false }
    // O servidor devolve a lista limpa (ids, duplicatas): ela é a verdade.
    setLista(Array.isArray(r.cliente?.produtosServicos) ? r.cliente.produtosServicos : nova)
    return true
  }

  function abrir(p?: ProdutoServico) {
    setEditandoId(p ? p.id : 'novo'); setNome(p?.nome || ''); setDescricao(p?.descricao || ''); setErro('')
  }

  async function salvarItem() {
    const n = nome.trim()
    if (!n) { setErro('Dê um nome ao produto ou serviço.'); return }
    if (lista.some(p => p.id !== editandoId && p.nome.trim().toLowerCase() === n.toLowerCase())) { setErro('Já existe um item com este nome.'); return }
    const item: ProdutoServico = { id: editandoId === 'novo' || !editandoId ? uuid() : editandoId, nome: n, ...(descricao.trim() ? { descricao: descricao.trim() } : {}) }
    const nova = editandoId === 'novo' ? [...lista, item] : lista.map(p => (p.id === editandoId ? item : p))
    if (await gravar(nova)) { setEditandoId(null); toast('Salvo.', 'sucesso') }
  }

  async function remover(p: ProdutoServico) {
    if (!(await confirmar(`Remover "${p.nome}" dos produtos e serviços?`, { titulo: 'Remover item', okLabel: 'Remover', perigo: true }))) return
    await gravar(lista.filter(x => x.id !== p.id))
  }

  async function mover(i: number, d: -1 | 1) {
    const j = i + d
    if (j < 0 || j >= lista.length) return
    const nova = [...lista];[nova[i], nova[j]] = [nova[j], nova[i]]
    setLista(nova)
    await gravar(nova)
  }

  const formulario = (
    <div style={{ border: '1.5px solid var(--v2-rule)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--v2-surface1)' }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Nome *</label>
        <input value={nome} onChange={e => setNome(e.target.value.slice(0, LIMITE_NOME))} placeholder="Ex.: Consulta de avaliação, Plano mensal, Kit presente..." style={campo} autoFocus
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); salvarItem() } }} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Descrição</label>
        <textarea lang="pt-BR" value={descricao} onChange={e => setDescricao(e.target.value.slice(0, LIMITE_DESCRICAO_PRODUTO))}
          placeholder="O que é, para quem, diferenciais, preço ou condições (se puder citar)..." style={{ ...campo, minHeight: 80, resize: 'vertical' }} />
        {descricao.length > LIMITE_DESCRICAO_PRODUTO * 0.8 && <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--v2-ink3)' }}>{descricao.length}/{LIMITE_DESCRICAO_PRODUTO}</p>}
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

  if (!podeEditar && !lista.length) return null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 15, color: 'var(--v2-ink)' }}>Produtos e serviços</h3>
        {podeEditar && editandoId === null && lista.length < LIMITE_PRODUTOS && (
          <button type="button" onClick={() => abrir()}
            style={{ padding: '7px 13px', background: 'var(--v2-surface1)', color: 'var(--v2-ink)', border: '1px solid var(--v2-rule)', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
            + Adicionar
          </button>
        )}
      </div>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--v2-ink3)' }}>
        {podeEditar ? 'O que o cliente vende. A IA usa os nomes e descrições ao criar plano, copy e legendas.' : 'O que a sua empresa oferece.'}
      </p>

      {erro && <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--v2-hot)', fontWeight: 600 }}>{erro}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lista.map((p, i) => editandoId === p.id ? <div key={p.id}>{formulario}</div> : (
          <div key={p.id} style={{ border: '1px solid var(--v2-rule)', borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--v2-ink)', wordBreak: 'break-word' }}>{p.nome}</p>
              {p.descricao && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--v2-ink2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>{p.descricao}</p>}
            </div>
            {podeEditar && editandoId === null && (
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {lista.length > 1 && (
                  <>
                    <button type="button" onClick={() => mover(i, -1)} disabled={i === 0 || salvando} title="Subir" style={{ ...btnIcone, opacity: i === 0 ? 0.35 : 1 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
                    </button>
                    <button type="button" onClick={() => mover(i, 1)} disabled={i === lista.length - 1 || salvando} title="Descer" style={{ ...btnIcone, opacity: i === lista.length - 1 ? 0.35 : 1 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                    </button>
                  </>
                )}
                <button type="button" onClick={() => abrir(p)} title="Editar" style={btnIcone}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                </button>
                <button type="button" onClick={() => remover(p)} disabled={salvando} title="Remover" style={{ ...btnIcone, color: 'var(--v2-hot)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></svg>
                </button>
              </div>
            )}
          </div>
        ))}
        {editandoId === 'novo' && formulario}
        {podeEditar && !lista.length && editandoId === null && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--v2-ink3)', textAlign: 'center', padding: 14, border: '1px dashed var(--v2-rule)', borderRadius: 12 }}>
            Nenhum produto ou serviço cadastrado ainda.
          </p>
        )}
      </div>
    </div>
  )
}
