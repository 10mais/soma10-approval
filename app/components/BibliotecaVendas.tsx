'use client'
import { useEffect, useMemo, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'
import {
  BibliotecaVendas as Biblioteca, CategoriaObjecao, Cadencia, Roteiro, Sequencia,
  Item, MsgCadencia, Pergunta, FASES, Fase, vazia, bibliotecaVazia,
} from '@/lib/bibliotecaVendas'

// BIBLIOTECA DE VENDAS — substitui o antigo Playbook do CRM.
// Quatro seções, iguais em toda instância; o que muda por nicho é o CONTEÚDO
// (semeado por perfil e editável aqui). Ver lib/bibliotecaVendas.ts.

type Aba = 'objecoes' | 'cadencias' | 'roteiros' | 'reaquecimento'
const ABAS: { key: Aba; label: string }[] = [
  { key: 'objecoes', label: 'Objeções' },
  { key: 'cadencias', label: 'Cadência de Mensagens' },
  { key: 'roteiros', label: 'Roteiro de Qualificação' },
  { key: 'reaquecimento', label: 'Reaquecimento de Base' },
]

const novoId = () => Math.random().toString(36).slice(2)
const card: React.CSSProperties = { background: 'var(--v2-surface)', borderRadius: 12, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--v2-rule)' }
const campo: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--v2-rule)', fontSize: 12.5, fontFamily: 'inherit' }
const rotulo: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--v2-ink3)', margin: '0 0 4px' }

// Copiar é o botão mais usado da tela: quem atende vive colando no WhatsApp.
function BotaoCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <button
      onClick={() => navigator.clipboard?.writeText(texto).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1500) }).catch(() => toast('Não consegui copiar. Selecione o texto e copie à mão.', 'erro'))}
      style={{ marginLeft: 'auto', flexShrink: 0, padding: '5px 11px', background: copiado ? 'var(--v2-ok)' : 'var(--v2-surface1)', color: copiado ? 'var(--v2-surface)' : 'var(--v2-ink2)', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
      {copiado ? 'Copiado!' : 'Copiar'}
    </button>
  )
}

// Bloco de mensagem: título + contexto (a linha do "quando usar") + texto.
function ItemMsg({ item, editando, aoMudar, aoExcluir, faixa }: {
  item: Item; editando: boolean; aoMudar: (i: Item) => void; aoExcluir: () => void; faixa?: React.ReactNode
}) {
  if (editando) return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input value={item.titulo} onChange={e => aoMudar({ ...item, titulo: e.target.value })} placeholder="Título" style={{ ...campo, fontWeight: 700 }} />
        {faixa}
        <button onClick={aoExcluir} title="Excluir" style={{ background: 'none', border: 'none', color: 'var(--v2-ink3)', cursor: 'pointer', fontSize: 17 }}>×</button>
      </div>
      <input value={item.contexto} onChange={e => aoMudar({ ...item, contexto: e.target.value })} placeholder="Quando usar (uma linha)" style={campo} />
      <textarea lang="pt-BR" value={item.texto} onChange={e => aoMudar({ ...item, texto: e.target.value })} placeholder="Mensagem pronta..." style={{ ...campo, minHeight: 64, resize: 'vertical' }} />
    </div>
  )
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        {faixa}
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--v2-ink)' }}>{item.titulo}</span>
        <BotaoCopiar texto={item.texto} />
      </div>
      {item.contexto && <p style={{ margin: '0 0 6px', fontSize: 11.5, color: 'var(--v2-ink3)', lineHeight: 1.5 }}>{item.contexto}</p>}
      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink2)', whiteSpace: 'pre-wrap', lineHeight: 1.6, background: 'var(--v2-surface1)', borderRadius: 8, padding: '9px 11px' }}>{item.texto}</p>
    </div>
  )
}

export default function BibliotecaVendasTela({ podeEditar }: { podeEditar: boolean }) {
  const [b, setB] = useState<Biblioteca>(vazia())
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [aba, setAba] = useState<Aba>(() => (typeof window !== 'undefined' && (sessionStorage.getItem('crm_biblio_aba') as Aba)) || 'objecoes')
  useEffect(() => { try { sessionStorage.setItem('crm_biblio_aba', aba) } catch {} }, [aba])

  // Seleção dentro de cada aba (categoria/playbook/roteiro/sequência aberta)
  const [selObj, setSelObj] = useState('')
  const [selCad, setSelCad] = useState('')
  const [selRot, setSelRot] = useState('')
  const [trilha, setTrilha] = useState<'leads' | 'clientes'>('leads')
  const [selSeq, setSelSeq] = useState('')
  const [busca, setBusca] = useState('')

  function carregar() {
    return fetch('/api/crm/biblioteca').then(r => r.json()).then(d => {
      if (d && !d.error) setB({ ...vazia(), ...d, reaquecimento: { leads: d.reaquecimento?.leads || [], clientes: d.reaquecimento?.clientes || [] } })
      setCarregando(false)
    }).catch(() => setCarregando(false))
  }
  useEffect(() => { carregar() }, [])

  // Primeira seleção de cada aba assim que os dados chegam.
  useEffect(() => { if (!selObj && b.objecoes[0]) setSelObj(b.objecoes[0].id) }, [b.objecoes, selObj])
  useEffect(() => { if (!selCad && b.cadencias[0]) setSelCad(b.cadencias[0].id) }, [b.cadencias, selCad])
  useEffect(() => { if (!selRot && b.roteiros[0]) setSelRot(b.roteiros[0].id) }, [b.roteiros, selRot])
  useEffect(() => { const l = b.reaquecimento[trilha]; if (l[0] && !l.some(s => s.id === selSeq)) setSelSeq(l[0].id) }, [b.reaquecimento, trilha, selSeq])

  async function salvar() {
    setSalvando(true)
    const r = await fetch('/api/crm/biblioteca', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (r?.ok) { setB(r.biblioteca); setEditando(false); toast('Biblioteca salva.', 'sucesso') }
    else toast(r?.error || 'Não consegui salvar.', 'erro')
  }

  const objAtual = b.objecoes.find(c => c.id === selObj)
  const cadAtual = b.cadencias.find(c => c.id === selCad)
  const rotAtual = b.roteiros.find(r => r.id === selRot)
  const seqAtual = b.reaquecimento[trilha].find(s => s.id === selSeq)

  // Busca dentro da aba aberta: a biblioteca cresce e caçar no olho não escala.
  const filtra = (itens: Item[]) => {
    const q = busca.trim().toLowerCase()
    if (!q) return itens
    return itens.filter(i => `${i.titulo} ${i.contexto} ${i.texto}`.toLowerCase().includes(q))
  }

  if (carregando) return <p style={{ color: 'var(--v2-ink3)' }}>Carregando...</p>

  const seletor = (itens: { id: string; nome: string }[], sel: string, aoSelecionar: (id: string) => void) => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
      {itens.map(i => (
        <button key={i.id} onClick={() => aoSelecionar(i.id)} style={{
          padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          background: sel === i.id ? 'var(--v2-ink)' : 'var(--v2-surface)', color: sel === i.id ? 'var(--v2-surface)' : 'var(--v2-ink2)',
          border: sel === i.id ? '1px solid var(--v2-ink)' : '1px solid var(--v2-surface2)',
        }}>{i.nome || 'Sem nome'}</button>
      ))}
    </div>
  )

  return (
    <div style={{ maxWidth: 880 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, color: 'var(--v2-ink)' }}>Biblioteca de Vendas</h3>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--v2-ink3)' }}>O que dizer, quando dizer e o que responder — pronto para copiar.</p>
        </div>
        <span style={{ flex: 1 }} />
        {podeEditar && (editando ? (
          <>
            <button onClick={salvar} disabled={salvando} style={{ padding: '8px 16px', background: 'var(--v2-ok)', color: 'var(--v2-surface)', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>{salvando ? 'Salvando...' : 'Salvar'}</button>
            <button onClick={() => { carregar(); setEditando(false) }} style={{ padding: '8px 16px', background: 'var(--v2-surface)', color: 'var(--v2-ink2)', border: '1px solid var(--v2-rule)', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
          </>
        ) : (
          <button onClick={() => setEditando(true)} style={{ padding: '8px 16px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Editar</button>
        ))}
      </div>

      {bibliotecaVazia(b) && !editando && (
        <div style={{ ...card, textAlign: 'center', padding: 34 }}>
          <p style={{ margin: '0 0 6px', fontSize: 13.5, fontWeight: 700, color: 'var(--v2-ink2)' }}>A biblioteca deste nicho ainda está vazia.</p>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink3)' }}>A estrutura está pronta: clique em <b>Editar</b> e monte as objeções, cadências e roteiros da sua operação.</p>
        </div>
      )}

      {/* Abas */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--v2-surface1)', borderRadius: 10, padding: 3, marginBottom: 14, flexWrap: 'wrap' }}>
        {ABAS.map(a => (
          <button key={a.key} onClick={() => setAba(a.key)} style={{
            flex: 1, minWidth: 130, padding: '8px 10px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
            background: aba === a.key ? 'var(--v2-surface)' : 'transparent', color: aba === a.key ? 'var(--v2-ink)' : 'var(--v2-ink3)',
            boxShadow: aba === a.key ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
          }}>{a.label}</button>
        ))}
      </div>

      {!bibliotecaVazia(b) && (
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar nesta aba..." style={{ ...campo, marginBottom: 12 }} />
      )}

      {/* OBJEÇÕES — categoria → 10 respostas */}
      {aba === 'objecoes' && (<>
        {seletor(b.objecoes, selObj, setSelObj)}
        {editando && (
          <button onClick={() => { const c: CategoriaObjecao = { id: novoId(), nome: 'Nova categoria', respostas: [] }; setB(x => ({ ...x, objecoes: [...x.objecoes, c] })); setSelObj(c.id) }}
            style={{ padding: '6px 12px', background: 'var(--v2-surface1)', border: '1px dashed var(--v2-rule2)', borderRadius: 999, fontSize: 12, fontWeight: 700, color: 'var(--v2-ink2)', cursor: 'pointer', marginBottom: 12 }}>+ Categoria</button>
        )}
        {objAtual && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {editando && (
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={objAtual.nome} onChange={e => setB(x => ({ ...x, objecoes: x.objecoes.map(c => c.id === objAtual.id ? { ...c, nome: e.target.value } : c) }))} style={{ ...campo, fontWeight: 700 }} />
                <button onClick={async () => { if (await confirmar(`Excluir a categoria "${objAtual.nome}" e as respostas dela?`, { titulo: 'Excluir categoria', okLabel: 'Excluir', perigo: true })) { setB(x => ({ ...x, objecoes: x.objecoes.filter(c => c.id !== objAtual.id) })); setSelObj('') } }}
                  style={{ padding: '8px 12px', background: 'var(--v2-surface)', color: 'var(--v2-hot)', border: '1px solid var(--v2-hot-bg)', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>Excluir categoria</button>
              </div>
            )}
            {filtra(objAtual.respostas).map(r => (
              <ItemMsg key={r.id} item={r} editando={editando}
                aoMudar={i => setB(x => ({ ...x, objecoes: x.objecoes.map(c => c.id === objAtual.id ? { ...c, respostas: c.respostas.map(y => y.id === i.id ? i : y) } : c) }))}
                aoExcluir={() => setB(x => ({ ...x, objecoes: x.objecoes.map(c => c.id === objAtual.id ? { ...c, respostas: c.respostas.filter(y => y.id !== r.id) } : c) }))} />
            ))}
            {!filtra(objAtual.respostas).length && <p style={{ fontSize: 12.5, color: 'var(--v2-ink3)' }}>Nenhuma resposta {busca ? 'para esta busca' : 'nesta categoria'}.</p>}
            {editando && (
              <button onClick={() => setB(x => ({ ...x, objecoes: x.objecoes.map(c => c.id === objAtual.id ? { ...c, respostas: [...c.respostas, { id: novoId(), titulo: '', contexto: '', texto: '' }] } : c) }))}
                style={{ padding: '8px 14px', background: 'var(--v2-surface1)', border: '1px dashed var(--v2-rule2)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'var(--v2-ink2)', cursor: 'pointer' }}>+ Resposta</button>
            )}
          </div>
        )}
      </>)}

      {/* CADÊNCIA — playbook por serviço, mensagens em ordem, com fase */}
      {aba === 'cadencias' && (<>
        {seletor(b.cadencias, selCad, setSelCad)}
        {editando && (
          <button onClick={() => { const c: Cadencia = { id: novoId(), nome: 'Novo playbook', mensagens: [] }; setB(x => ({ ...x, cadencias: [...x.cadencias, c] })); setSelCad(c.id) }}
            style={{ padding: '6px 12px', background: 'var(--v2-surface1)', border: '1px dashed var(--v2-rule2)', borderRadius: 999, fontSize: 12, fontWeight: 700, color: 'var(--v2-ink2)', cursor: 'pointer', marginBottom: 12 }}>+ Playbook</button>
        )}
        {cadAtual && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {editando ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={cadAtual.nome} onChange={e => setB(x => ({ ...x, cadencias: x.cadencias.map(c => c.id === cadAtual.id ? { ...c, nome: e.target.value } : c) }))} placeholder="Tipo de serviço" style={{ ...campo, fontWeight: 700 }} />
                <button onClick={async () => { if (await confirmar(`Excluir o playbook "${cadAtual.nome}"?`, { titulo: 'Excluir playbook', okLabel: 'Excluir', perigo: true })) { setB(x => ({ ...x, cadencias: x.cadencias.filter(c => c.id !== cadAtual.id) })); setSelCad('') } }}
                  style={{ padding: '8px 12px', background: 'var(--v2-surface)', color: 'var(--v2-hot)', border: '1px solid var(--v2-hot-bg)', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>Excluir</button>
              </div>
            ) : cadAtual.descricao && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink3)' }}>{cadAtual.descricao}</p>}

            {filtra(cadAtual.mensagens).map((m, i) => {
              const f = FASES.find(x => x.key === (m as MsgCadencia).fase) || FASES[0]
              return (
                <ItemMsg key={m.id} item={m} editando={editando}
                  faixa={editando
                    ? <select value={(m as MsgCadencia).fase} onChange={e => setB(x => ({ ...x, cadencias: x.cadencias.map(c => c.id === cadAtual.id ? { ...c, mensagens: c.mensagens.map(y => y.id === m.id ? { ...y, fase: e.target.value as Fase } : y) } : c) }))}
                        style={{ ...campo, width: 'auto', flexShrink: 0, background: 'var(--v2-surface)' }}>
                        {FASES.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
                      </select>
                    : <>
                        <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--v2-surface)', background: 'var(--v2-ink)', borderRadius: 999, padding: '2px 8px' }}>{i + 1}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 800, color: f.cor, background: `${f.cor}18`, borderRadius: 999, padding: '2px 9px' }}>{f.label}</span>
                      </>}
                  aoMudar={it => setB(x => ({ ...x, cadencias: x.cadencias.map(c => c.id === cadAtual.id ? { ...c, mensagens: c.mensagens.map(y => y.id === it.id ? { ...y, ...it } : y) } : c) }))}
                  aoExcluir={() => setB(x => ({ ...x, cadencias: x.cadencias.map(c => c.id === cadAtual.id ? { ...c, mensagens: c.mensagens.filter(y => y.id !== m.id) } : c) }))} />
              )
            })}
            {editando && (
              <button onClick={() => setB(x => ({ ...x, cadencias: x.cadencias.map(c => c.id === cadAtual.id ? { ...c, mensagens: [...c.mensagens, { id: novoId(), titulo: '', contexto: '', texto: '', fase: 'abordagem' as Fase }] } : c) }))}
                style={{ padding: '8px 14px', background: 'var(--v2-surface1)', border: '1px dashed var(--v2-rule2)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'var(--v2-ink2)', cursor: 'pointer' }}>+ Mensagem</button>
            )}
          </div>
        )}
      </>)}

      {/* ROTEIRO — perguntas com fluxo de decisão e ponto de parada */}
      {aba === 'roteiros' && (<>
        {seletor(b.roteiros, selRot, setSelRot)}
        {editando && (
          <button onClick={() => { const r: Roteiro = { id: novoId(), nome: 'Novo roteiro', perguntas: [] }; setB(x => ({ ...x, roteiros: [...x.roteiros, r] })); setSelRot(r.id) }}
            style={{ padding: '6px 12px', background: 'var(--v2-surface1)', border: '1px dashed var(--v2-rule2)', borderRadius: 999, fontSize: 12, fontWeight: 700, color: 'var(--v2-ink2)', cursor: 'pointer', marginBottom: 12 }}>+ Roteiro</button>
        )}
        {rotAtual && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {editando ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={rotAtual.nome} onChange={e => setB(x => ({ ...x, roteiros: x.roteiros.map(r => r.id === rotAtual.id ? { ...r, nome: e.target.value } : r) }))} placeholder="Nicho" style={{ ...campo, fontWeight: 700 }} />
                <button onClick={async () => { if (await confirmar(`Excluir o roteiro "${rotAtual.nome}"?`, { titulo: 'Excluir roteiro', okLabel: 'Excluir', perigo: true })) { setB(x => ({ ...x, roteiros: x.roteiros.filter(r => r.id !== rotAtual.id) })); setSelRot('') } }}
                  style={{ padding: '8px 12px', background: 'var(--v2-surface)', color: 'var(--v2-hot)', border: '1px solid var(--v2-hot-bg)', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>Excluir</button>
              </div>
            ) : rotAtual.descricao && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink3)' }}>{rotAtual.descricao}</p>}

            {rotAtual.perguntas
              .filter(p => { const q = busca.trim().toLowerCase(); return !q || `${p.pergunta} ${p.contexto}`.toLowerCase().includes(q) })
              .map((p, i) => (
                <div key={p.id} style={card}>
                  {editando ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input value={p.pergunta} onChange={e => setB(x => ({ ...x, roteiros: x.roteiros.map(r => r.id === rotAtual.id ? { ...r, perguntas: r.perguntas.map(y => y.id === p.id ? { ...y, pergunta: e.target.value } : y) } : r) }))} placeholder="Pergunta" style={{ ...campo, fontWeight: 700 }} />
                        <button onClick={() => setB(x => ({ ...x, roteiros: x.roteiros.map(r => r.id === rotAtual.id ? { ...r, perguntas: r.perguntas.filter(y => y.id !== p.id) } : r) }))} style={{ background: 'none', border: 'none', color: 'var(--v2-ink3)', cursor: 'pointer', fontSize: 17 }}>×</button>
                      </div>
                      <input value={p.contexto} onChange={e => setB(x => ({ ...x, roteiros: x.roteiros.map(r => r.id === rotAtual.id ? { ...r, perguntas: r.perguntas.map(y => y.id === p.id ? { ...y, contexto: e.target.value } : y) } : r) }))} placeholder="Por que perguntar isso" style={campo} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <div><label style={rotulo}>Se sim</label><input value={p.seSim || ''} onChange={e => setB(x => ({ ...x, roteiros: x.roteiros.map(r => r.id === rotAtual.id ? { ...r, perguntas: r.perguntas.map(y => y.id === p.id ? { ...y, seSim: e.target.value } : y) } : r) }))} style={campo} /></div>
                        <div><label style={rotulo}>Se não</label><input value={p.seNao || ''} onChange={e => setB(x => ({ ...x, roteiros: x.roteiros.map(r => r.id === rotAtual.id ? { ...r, perguntas: r.perguntas.map(y => y.id === p.id ? { ...y, seNao: e.target.value } : y) } : r) }))} style={campo} /></div>
                      </div>
                      <div><label style={rotulo}>Ponto de parada</label><input value={p.parada || ''} onChange={e => setB(x => ({ ...x, roteiros: x.roteiros.map(r => r.id === rotAtual.id ? { ...r, perguntas: r.perguntas.map(y => y.id === p.id ? { ...y, parada: e.target.value } : y) } : r) }))} placeholder="Quando NÃO seguir" style={campo} /></div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--v2-surface)', background: '#7c3aed', borderRadius: 999, padding: '2px 8px' }}>{i + 1}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--v2-ink)' }}>{p.pergunta}</span>
                        <BotaoCopiar texto={p.pergunta} />
                      </div>
                      {p.contexto && <p style={{ margin: '0 0 8px', fontSize: 11.5, color: 'var(--v2-ink3)', lineHeight: 1.5 }}>{p.contexto}</p>}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {p.seSim && <span style={{ fontSize: 11.5, color: 'var(--v2-ok)', background: 'var(--v2-ok-bg)', borderRadius: 8, padding: '5px 9px' }}><b>Se sim:</b> {p.seSim}</span>}
                        {p.seNao && <span style={{ fontSize: 11.5, color: 'var(--v2-amber)', background: 'var(--v2-amber-bg)', borderRadius: 8, padding: '5px 9px' }}><b>Se não:</b> {p.seNao}</span>}
                        {p.parada && <span style={{ fontSize: 11.5, color: 'var(--v2-hot)', background: 'var(--v2-hot-bg)', borderRadius: 8, padding: '5px 9px' }}><b>Pare:</b> {p.parada}</span>}
                      </div>
                    </>
                  )}
                </div>
              ))}
            {editando && (
              <button onClick={() => setB(x => ({ ...x, roteiros: x.roteiros.map(r => r.id === rotAtual.id ? { ...r, perguntas: [...r.perguntas, { id: novoId(), pergunta: '', contexto: '' }] } : r) }))}
                style={{ padding: '8px 14px', background: 'var(--v2-surface1)', border: '1px dashed var(--v2-rule2)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'var(--v2-ink2)', cursor: 'pointer' }}>+ Pergunta</button>
            )}
          </div>
        )}
      </>)}

      {/* REAQUECIMENTO — duas trilhas: leads que nunca fecharam × clientes antigos */}
      {aba === 'reaquecimento' && (<>
        <div style={{ display: 'flex', gap: 4, background: 'var(--v2-surface1)', borderRadius: 9, padding: 3, marginBottom: 12, maxWidth: 380 }}>
          {([['leads', 'Reaquecimento de Leads'], ['clientes', 'Resgate de Clientes']] as const).map(([k, label]) => (
            <button key={k} onClick={() => { setTrilha(k); setSelSeq('') }} style={{
              flex: 1, padding: '7px 10px', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700,
              background: trilha === k ? 'var(--v2-surface)' : 'transparent', color: trilha === k ? 'var(--v2-ink)' : 'var(--v2-ink3)',
              boxShadow: trilha === k ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            }}>{label}</button>
          ))}
        </div>
        <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--v2-ink3)' }}>
          {trilha === 'leads' ? 'Quem levantou a mão e nunca fechou.' : 'Quem já foi cliente e parou — nova oferta ou pesquisa para reabrir a conversa.'}
        </p>
        {seletor(b.reaquecimento[trilha], selSeq, setSelSeq)}
        {editando && (
          <button onClick={() => { const s: Sequencia = { id: novoId(), nome: 'Nova sequência', quando: '', mensagens: [] }; setB(x => ({ ...x, reaquecimento: { ...x.reaquecimento, [trilha]: [...x.reaquecimento[trilha], s] } })); setSelSeq(s.id) }}
            style={{ padding: '6px 12px', background: 'var(--v2-surface1)', border: '1px dashed var(--v2-rule2)', borderRadius: 999, fontSize: 12, fontWeight: 700, color: 'var(--v2-ink2)', cursor: 'pointer', marginBottom: 12 }}>+ Sequência</button>
        )}
        {seqAtual && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {editando ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={seqAtual.nome} onChange={e => setB(x => ({ ...x, reaquecimento: { ...x.reaquecimento, [trilha]: x.reaquecimento[trilha].map(s => s.id === seqAtual.id ? { ...s, nome: e.target.value } : s) } }))} placeholder="Nome da sequência" style={{ ...campo, fontWeight: 700 }} />
                  <button onClick={async () => { if (await confirmar(`Excluir a sequência "${seqAtual.nome}"?`, { titulo: 'Excluir sequência', okLabel: 'Excluir', perigo: true })) { setB(x => ({ ...x, reaquecimento: { ...x.reaquecimento, [trilha]: x.reaquecimento[trilha].filter(s => s.id !== seqAtual.id) } })); setSelSeq('') } }}
                    style={{ padding: '8px 12px', background: 'var(--v2-surface)', color: 'var(--v2-hot)', border: '1px solid var(--v2-hot-bg)', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>Excluir</button>
                </div>
                <input value={seqAtual.quando} onChange={e => setB(x => ({ ...x, reaquecimento: { ...x.reaquecimento, [trilha]: x.reaquecimento[trilha].map(s => s.id === seqAtual.id ? { ...s, quando: e.target.value } : s) } }))} placeholder="Gatilho: quando usar esta sequência" style={campo} />
              </div>
            ) : seqAtual.quando && (
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#7c3aed', background: '#7c3aed18', borderRadius: 999, padding: '4px 11px', alignSelf: 'flex-start' }}>{seqAtual.quando}</span>
            )}
            {filtra(seqAtual.mensagens).map((m, i) => (
              <ItemMsg key={m.id} item={m} editando={editando}
                faixa={!editando ? <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--v2-surface)', background: 'var(--v2-ink)', borderRadius: 999, padding: '2px 8px' }}>{i + 1}</span> : undefined}
                aoMudar={it => setB(x => ({ ...x, reaquecimento: { ...x.reaquecimento, [trilha]: x.reaquecimento[trilha].map(s => s.id === seqAtual.id ? { ...s, mensagens: s.mensagens.map(y => y.id === it.id ? it : y) } : s) } }))}
                aoExcluir={() => setB(x => ({ ...x, reaquecimento: { ...x.reaquecimento, [trilha]: x.reaquecimento[trilha].map(s => s.id === seqAtual.id ? { ...s, mensagens: s.mensagens.filter(y => y.id !== m.id) } : s) } }))} />
            ))}
            {editando && (
              <button onClick={() => setB(x => ({ ...x, reaquecimento: { ...x.reaquecimento, [trilha]: x.reaquecimento[trilha].map(s => s.id === seqAtual.id ? { ...s, mensagens: [...s.mensagens, { id: novoId(), titulo: '', contexto: '', texto: '' }] } : s) } }))}
                style={{ padding: '8px 14px', background: 'var(--v2-surface1)', border: '1px dashed var(--v2-rule2)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'var(--v2-ink2)', cursor: 'pointer' }}>+ Mensagem</button>
            )}
          </div>
        )}
      </>)}
    </div>
  )
}
