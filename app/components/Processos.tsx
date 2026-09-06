'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'
import { fecharFora } from '@/lib/fecharModal'
import {
  ETAPAS_PROCESSO, ETAPAS_FLUXO, progressoProcesso, ehFinal, type EtapaProcesso,
} from '@/lib/processoCidadania'
import { resumoLinhagem, type PessoaLinhagem } from '@/lib/linhagem'
import { useAutoScrollKanban } from '@/lib/autoScrollKanban'
import {
  gerarParcelas, totalPago, saldoDevedor, totalVencido, METODOS,
  type FinanceiroContrato, type MetodoPagamento,
} from '@/lib/financeiroContrato'
import EditorLinhagem from './EditorLinhagem'

// PROCESSOS (perfil cidadania) — a esteira pós-venda de cada caso/família rumo à
// cidadania estrangeira. Kanban por etapa (avançar/voltar rápido) + cadastro.
// Requerentes (linhagem) e o checklist de documentos entram nas próximas fases.

type StatusProcesso = 'ativo' | 'pausado' | 'concluido' | 'arquivado'
type Processo = {
  id: string; titulo: string; clienteId?: string; paisAlvo: string
  ascendente?: string; requerentes?: string[]; linhagem?: PessoaLinhagem[]
  financeiro?: FinanceiroContrato
  etapa: EtapaProcesso; status: StatusProcesso
  responsavelEmail?: string; numeroProcesso?: string; valorContrato?: number
  prazoEstimado?: string; observacoes?: string; criadoEm?: string; atualizadoEm?: string
}
// No formulário o valor fica como TEXTO (deixa digitar "1200,5" pela metade).
type Form = Omit<Processo, 'id' | 'valorContrato'> & { id?: string; valorContrato: string }

type Contato = { id: string; nome: string }
type Usuario = { nome?: string; email: string; role?: string }

const STATUS: { key: StatusProcesso; label: string; cor: string; bg: string }[] = [
  { key: 'ativo', label: 'Ativo', cor: 'var(--v2-ok)', bg: 'var(--v2-ok-bg)' },
  { key: 'pausado', label: 'Pausado', cor: 'var(--v2-amber)', bg: 'var(--v2-amber-bg)' },
  { key: 'concluido', label: 'Concluído', cor: '#1e3a8a', bg: 'var(--v2-info-bg)' },
  { key: 'arquivado', label: 'Arquivado', cor: 'var(--v2-ink3)', bg: 'var(--v2-surface1)' },
]
const stInfo = (s?: string) => STATUS.find(x => x.key === s) || STATUS[0]
const fmtBRL = (v?: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtData = (s?: string) => (s ? new Date(s + 'T00:00').toLocaleDateString('pt-BR') : '')

const vazio = (): Form => ({
  titulo: '', clienteId: '', paisAlvo: 'Luxemburgo', ascendente: '', requerentes: [], linhagem: [],
  etapa: 'viabilidade', status: 'ativo', responsavelEmail: '', numeroProcesso: '',
  valorContrato: '', prazoEstimado: '', observacoes: '',
})

const paraForm = (p: Processo): Form => ({
  ...p, clienteId: p.clienteId || '', ascendente: p.ascendente || '', responsavelEmail: p.responsavelEmail || '',
  requerentes: p.requerentes || [], linhagem: p.linhagem || [], financeiro: p.financeiro,
  numeroProcesso: p.numeroProcesso || '', prazoEstimado: p.prazoEstimado || '', observacoes: p.observacoes || '',
  valorContrato: p.valorContrato ? String(p.valorContrato) : '',
})

export default function Processos({ podeEditar = true, podeExcluir = false }: { podeEditar?: boolean; podeExcluir?: boolean }) {
  const [lista, setLista] = useState<Processo[]>([])
  const [contatos, setContatos] = useState<Contato[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [form, setForm] = useState<Form | null>(null)
  const [formInicial, setFormInicial] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [verFinais, setVerFinais] = useState(false)
  const [novoReqNome, setNovoReqNome] = useState('')
  const [criandoReq, setCriandoReq] = useState(false)
  // Gerador de parcelas do contrato (só controles de tela — o cálculo é da lib)
  const [parcVezes, setParcVezes] = useState('12')
  const [parcPrimeiro, setParcPrimeiro] = useState('')
  const [parcMetodo, setParcMetodo] = useState<MetodoPagamento>('pix')
  // Arrastar entre etapas (mesmo gesto do funil do CRM — as setas do card eram
  // um jeito pior de fazer a mesma coisa e não pareciam com o resto do sistema).
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  // Encostar o card na borda puxa o quadro para o lado (mesmo hook do funil do CRM)
  const { ref: kanbanRef, aoArrastar, parar: pararScroll } = useAutoScrollKanban<HTMLDivElement>()

  const carregar = useCallback(() => {
    setCarregando(true)
    Promise.all([
      fetch('/api/processos').then(r => r.json()).catch(() => ({ processos: [] })),
      fetch('/api/crm/contatos').then(r => r.json()).catch(() => []),
      fetch('/api/usuarios').then(r => r.json()).catch(() => []),
    ]).then(([pr, ct, us]) => {
      setLista(Array.isArray(pr?.processos) ? pr.processos : [])
      setContatos(Array.isArray(ct) ? ct.map((c: any) => ({ id: c.id, nome: c.nome })) : [])
      setUsuarios(Array.isArray(us) ? us.filter((u: any) => u.role !== 'cliente') : [])
    }).finally(() => setCarregando(false))
  }, [])
  useEffect(() => { carregar() }, [carregar])

  const nomeContato = useMemo(() => {
    const m: Record<string, string> = {}
    for (const c of contatos) m[c.id] = c.nome
    return m
  }, [contatos])
  const nomeUsuario = useMemo(() => {
    const m: Record<string, string> = {}
    for (const u of usuarios) m[u.email] = u.nome || u.email
    return m
  }, [usuarios])

  function abrirNovo() { const f = vazio(); setForm(f); setFormInicial(JSON.stringify(f)) }
  function abrirEdicao(p: Processo) { const f = paraForm(p); setForm(f); setFormInicial(JSON.stringify(f)) }
  function fecharForm() {
    if (form && JSON.stringify(form) !== formInicial) {
      confirmar('Descartar as alterações deste processo?').then(ok => { if (ok) setForm(null) })
      return
    }
    setForm(null)
  }

  async function salvar() {
    if (!form) return
    const titulo = (form.titulo || '').trim()
    if (!titulo) { toast('Informe o nome do caso/família.', 'erro'); return }
    setSalvando(true)
    const corpo = {
      id: form.id,
      titulo,
      clienteId: form.clienteId || '',
      paisAlvo: (form.paisAlvo || 'Luxemburgo').trim(),
      ascendente: (form.ascendente || '').trim(),
      requerentes: form.requerentes || [],
      linhagem: form.linhagem || [],
      financeiro: form.financeiro || undefined,
      etapa: form.etapa,
      status: form.status,
      responsavelEmail: form.responsavelEmail || '',
      numeroProcesso: (form.numeroProcesso || '').trim(),
      valorContrato: form.valorContrato ? Number(String(form.valorContrato).replace(',', '.')) : undefined,
      prazoEstimado: form.prazoEstimado || '',
      observacoes: (form.observacoes || '').trim(),
    }
    const r = await fetch('/api/processos', {
      method: form.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (!r?.ok) { toast(r?.error || 'Não foi possível salvar.', 'erro'); return }
    toast(form.id ? 'Processo atualizado.' : 'Processo criado.', 'sucesso')
    setForm(null)
    carregar()
  }

  async function excluir(p: Processo) {
    if (!(await confirmar(`Excluir o processo "${p.titulo}"? Esta ação não pode ser desfeita.`))) return
    const r = await fetch('/api/processos', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id }) }).then(x => x.json()).catch(() => null)
    if (!r?.ok) { toast(r?.error || 'Não foi possível excluir.', 'erro'); return }
    toast('Processo excluído.', 'sucesso')
    carregar()
  }

  // Move de etapa via PUT — otimista: atualiza a lista na hora e reverte se falhar.
  async function moverEtapa(p: Processo, destino: EtapaProcesso | null) {
    if (!destino || destino === p.etapa) return
    setLista(prev => prev.map(x => x.id === p.id ? { ...x, etapa: destino } : x))
    const r = await fetch('/api/processos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, etapa: destino }) }).then(x => x.json()).catch(() => null)
    if (!r?.ok) { toast(r?.error || 'Não foi possível mover.', 'erro'); carregar() }
  }

  function toggleRequerente(id: string) {
    if (!form) return
    const atuais = form.requerentes || []
    setForm({ ...form, requerentes: atuais.includes(id) ? atuais.filter(x => x !== id) : [...atuais, id] })
  }
  // Cria um contato JÁ com o selo requerente e o vincula ao processo aberto.
  async function criarRequerente() {
    if (!form) return
    const nome = novoReqNome.trim()
    if (!nome) return
    setCriandoReq(true)
    const r = await fetch('/api/crm/contatos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, tipo: 'requerente' }) }).then(x => x.json()).catch(() => null)
    setCriandoReq(false)
    if (!r?.ok || !r?.contato?.id) { toast(r?.error || 'Não foi possível criar o requerente.', 'erro'); return }
    setContatos(prev => [...prev, { id: r.contato.id, nome: r.contato.nome }])
    setForm(f => f ? { ...f, requerentes: [...(f.requerentes || []), r.contato.id] } : f)
    setNovoReqNome('')
    toast('Requerente criado e vinculado.', 'sucesso')
  }

  // Colunas do kanban: o fluxo sempre; os desfechos (deferido/arquivado) só quando pedidos.
  const colunas = useMemo(() => {
    const chaves: EtapaProcesso[] = verFinais ? ETAPAS_PROCESSO.map(e => e.chave) : [...ETAPAS_FLUXO]
    return chaves.map(chave => ({ chave, itens: lista.filter(p => p.etapa === chave) }))
  }, [lista, verFinais])

  const totalFinais = lista.filter(p => ehFinal(p.etapa)).length

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--v2-ink2)', margin: '0 0 4px' }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 10px', border: '1px solid var(--v2-rule2)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: 'var(--v2-ink)' }}>Processos</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--v2-ink3)' }}>Cada caso/família da viabilidade ao deferimento.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setVerFinais(v => !v)} style={{ padding: '8px 12px', background: verFinais ? 'var(--v2-info-bg)' : 'var(--v2-surface)', border: '1px solid var(--v2-rule2)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'var(--v2-ink2)', cursor: 'pointer' }}>
            {verFinais ? 'Ocultar encerrados' : `Ver encerrados${totalFinais ? ` (${totalFinais})` : ''}`}
          </button>
          {podeEditar && (
            <button onClick={abrirNovo} style={{ padding: '9px 16px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Novo processo</button>
          )}
        </div>
      </div>

      {carregando ? (
        <p style={{ color: 'var(--v2-ink3)', fontSize: 13 }}>Carregando…</p>
      ) : lista.length === 0 ? (
        <div style={{ border: '1px dashed var(--v2-rule2)', borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--v2-ink3)' }}>
          <p style={{ margin: 0, fontSize: 14 }}>Nenhum processo ainda.</p>
          {podeEditar && <p style={{ margin: '6px 0 0', fontSize: 12.5 }}>Clique em <strong>+ Novo processo</strong> para começar o primeiro caso.</p>}
        </div>
      ) : (
        <div ref={kanbanRef} onDragOver={aoArrastar} onDrop={pararScroll} onDragEnd={pararScroll}
          style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12, alignItems: 'stretch', minHeight: 'calc(100vh - 260px)' }}>
          {colunas.map(({ chave, itens }) => {
            const def = ETAPAS_PROCESSO.find(e => e.chave === chave)!
            const finalCol = ehFinal(chave)
            const ativa = overCol === chave
            return (
              <div key={chave}
                onDragOver={e => { if (podeEditar) { e.preventDefault(); setOverCol(chave) } }}
                onDrop={() => {
                  const p = lista.find(x => x.id === dragId)
                  if (p) moverEtapa(p, chave)
                  setDragId(null); setOverCol(null); pararScroll()
                }}
                style={{ flex: '0 0 250px', width: 250, background: ativa ? '#fff8e1' : 'var(--v2-surface1)', border: ativa ? '1.5px dashed var(--v2-amber-on)' : '1.5px solid var(--v2-surface2)', borderRadius: 12, padding: 10, minHeight: 120 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: def.ganho ? 'var(--v2-ok)' : def.perdido ? 'var(--v2-ink3)' : 'var(--v2-ink2)' }}>{def.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--v2-ink3)', background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 999, padding: '1px 7px' }}>{itens.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {itens.map(p => {
                    const prog = progressoProcesso(p.etapa)
                    const st = stInfo(p.status)
                    return (
                      <div key={p.id}
                        draggable={podeEditar}
                        onDragStart={() => setDragId(p.id)}
                        onDragEnd={() => { setDragId(null); setOverCol(null); pararScroll() }}
                        onClick={() => abrirEdicao(p)}
                        style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 10, padding: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.03)', cursor: 'pointer', opacity: dragId === p.id ? 0.5 : 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <strong style={{ fontSize: 13, color: 'var(--v2-ink)' }}>{p.titulo}</strong>
                          <span style={{ fontSize: 10, fontWeight: 600, color: st.cor, background: st.bg, borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap' }}>{st.label}</span>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--v2-ink3)' }}>
                          {p.paisAlvo}{p.ascendente ? ` · ${p.ascendente}` : ''}
                        </p>
                        {p.clienteId && nomeContato[p.clienteId] && (
                          <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--v2-ink3)' }}>Cliente: {nomeContato[p.clienteId]}</p>
                        )}
                        {p.responsavelEmail && (
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--v2-ink3)' }}>Resp.: {nomeUsuario[p.responsavelEmail] || p.responsavelEmail}</p>
                        )}
                        {!finalCol && (
                          <div style={{ marginTop: 7, height: 4, background: 'var(--v2-surface2)', borderRadius: 999, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.round(prog * 100)}%`, height: '100%', background: 'var(--v2-ink)' }} />
                          </div>
                        )}
                        {typeof p.valorContrato === 'number' && p.valorContrato > 0 && (
                          <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--v2-ink2)', fontWeight: 600 }}>{fmtBRL(p.valorContrato)}</p>
                        )}
                      </div>
                    )
                  })}
                  {itens.length === 0 && <p style={{ margin: 0, fontSize: 11.5, color: '#c4c8cc', textAlign: 'center', padding: '8px 0' }}>—</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {form && (
        <div onMouseDown={fecharFora(fecharForm)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
          <div style={{ background: 'var(--v2-surface)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 560, margin: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: 'var(--v2-ink)' }}>{form.id ? 'Editar processo' : 'Novo processo'}</h3>
              <button onClick={fecharForm} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--v2-ink3)', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Caso / família *</label>
                <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ex.: Família Muller" style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>País de destino</label>
                  <input value={form.paisAlvo} onChange={e => setForm({ ...form, paisAlvo: e.target.value })} placeholder="Luxemburgo" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Ascendente estrangeiro</label>
                  <input value={form.ascendente} onChange={e => setForm({ ...form, ascendente: e.target.value })} placeholder="Nome da raiz da linhagem" style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Cliente (responsável)</label>
                  <select value={form.clienteId} onChange={e => setForm({ ...form, clienteId: e.target.value })} style={inputStyle}>
                    <option value="">— nenhum —</option>
                    {contatos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Responsável (equipe)</label>
                  <select value={form.responsavelEmail} onChange={e => setForm({ ...form, responsavelEmail: e.target.value })} style={inputStyle}>
                    <option value="">— ninguém —</option>
                    {usuarios.map(u => <option key={u.email} value={u.email}>{u.nome || u.email}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Etapa</label>
                  <select value={form.etapa} onChange={e => setForm({ ...form, etapa: e.target.value as EtapaProcesso })} style={inputStyle}>
                    {ETAPAS_PROCESSO.map(e => <option key={e.chave} value={e.chave}>{e.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Situação</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as StatusProcesso })} style={inputStyle}>
                    {STATUS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Valor do contrato</label>
                  <input value={form.valorContrato} onChange={e => setForm({ ...form, valorContrato: e.target.value })} placeholder="0,00" inputMode="decimal" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Previsão de conclusão</label>
                  <input type="date" value={form.prazoEstimado} onChange={e => setForm({ ...form, prazoEstimado: e.target.value })} style={inputStyle} />
                </div>
              </div>

              {/* COBRANÇA — parcelas do contrato. O motor (gerarParcelas/saldo) é
                  o mesmo do turismo; aqui é só a tela. Marcar "pago" espelha no
                  Financeiro sozinho, com id determinístico (sem duplicar). */}
              <div style={{ borderTop: '1px solid var(--v2-rule)', paddingTop: 14 }}>
                <label style={labelStyle}>Cobrança do contrato</label>
                {(() => {
                  const fin: FinanceiroContrato = form.financeiro || { valorTotal: 0, parcelas: [], pagamentos: [] }
                  const total = Number(String(form.valorContrato).replace(',', '.')) || fin.valorTotal || 0
                  const hoje = new Date().toISOString().slice(0, 10)
                  const pago = totalPago(fin)
                  const saldo = saldoDevedor({ ...fin, valorTotal: total })
                  const vencido = totalVencido(fin, hoje)
                  const setFin = (novo: FinanceiroContrato) => setForm({ ...form, financeiro: novo })
                  return (<>
                    {fin.parcelas.length === 0 ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ width: 70 }}>
                          <span style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: 'var(--v2-ink3)', marginBottom: 3 }}>Vezes</span>
                          <input type="number" min={1} max={120} value={parcVezes} onChange={e => setParcVezes(e.target.value)} style={inputStyle} />
                        </div>
                        <div style={{ flex: 1, minWidth: 130 }}>
                          <span style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: 'var(--v2-ink3)', marginBottom: 3 }}>1º vencimento</span>
                          <input type="date" value={parcPrimeiro} onChange={e => setParcPrimeiro(e.target.value)} style={inputStyle} />
                        </div>
                        <div style={{ width: 120 }}>
                          <span style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: 'var(--v2-ink3)', marginBottom: 3 }}>Método</span>
                          <select value={parcMetodo} onChange={e => setParcMetodo(e.target.value as MetodoPagamento)} style={inputStyle}>
                            {METODOS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                          </select>
                        </div>
                        <button type="button" disabled={!(total > 0) || !parcPrimeiro}
                          onClick={() => setFin({ valorTotal: total, parcelas: gerarParcelas(total, Number(parcVezes) || 1, parcPrimeiro, parcMetodo), pagamentos: fin.pagamentos || [] })}
                          style={{ padding: '9px 14px', background: total > 0 && parcPrimeiro ? 'var(--v2-ink)' : '#f3f4f6', color: total > 0 && parcPrimeiro ? 'var(--v2-surface)' : '#c4c8cc', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: total > 0 && parcPrimeiro ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>Gerar parcelas</button>
                      </div>
                    ) : (<>
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 8, fontSize: 11.5 }}>
                        <span style={{ color: 'var(--v2-ink3)' }}>Total <strong style={{ color: 'var(--v2-ink)' }}>{fmtBRL(total)}</strong></span>
                        <span style={{ color: 'var(--v2-ink3)' }}>Recebido <strong style={{ color: 'var(--v2-ok)' }}>{fmtBRL(pago)}</strong></span>
                        <span style={{ color: 'var(--v2-ink3)' }}>Saldo <strong style={{ color: 'var(--v2-ink)' }}>{fmtBRL(saldo)}</strong></span>
                        {vencido > 0 && <span style={{ color: 'var(--v2-hot)', fontWeight: 700 }}>Vencido {fmtBRL(vencido)}</span>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
                        {fin.parcelas.map(p => {
                          const atrasada = p.status !== 'pago' && p.vencimento < hoje
                          return (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: p.status === 'pago' ? 'var(--v2-ok-bg)' : atrasada ? 'var(--v2-hot-bg)' : 'var(--v2-surface1)', border: '1px solid ' + (p.status === 'pago' ? 'var(--v2-ok-bg)' : atrasada ? 'var(--v2-hot-bg)' : 'var(--v2-surface2)'), borderRadius: 8, fontSize: 12 }}>
                              <span style={{ width: 26, color: 'var(--v2-ink3)', fontWeight: 700 }}>{p.numero}</span>
                              <span style={{ flex: 1, color: 'var(--v2-ink)', fontWeight: 600 }}>{fmtBRL(p.valor)}</span>
                              <span style={{ color: atrasada ? 'var(--v2-hot)' : 'var(--v2-ink3)', whiteSpace: 'nowrap' }}>{fmtData(p.vencimento)}</span>
                              <button type="button" disabled={!podeEditar}
                                onClick={() => setFin({
                                  ...fin, valorTotal: total,
                                  parcelas: fin.parcelas.map(x => x.id === p.id
                                    ? (x.status === 'pago' ? { ...x, status: 'pendente' as const, pagoEm: undefined } : { ...x, status: 'pago' as const, pagoEm: hoje })
                                    : x),
                                })}
                                style={{ padding: '3px 10px', background: p.status === 'pago' ? 'var(--v2-ok)' : 'var(--v2-surface)', color: p.status === 'pago' ? 'var(--v2-surface)' : 'var(--v2-ink2)', border: '1px solid ' + (p.status === 'pago' ? 'var(--v2-ok)' : 'var(--v2-rule2)'), borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: podeEditar ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
                                {p.status === 'pago' ? 'Pago' : 'Marcar pago'}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                      {podeEditar && (
                        <button type="button" onClick={() => { if (confirm('Refazer o parcelamento? As baixas de pagamento serão perdidas.')) setFin({ valorTotal: total, parcelas: [], pagamentos: fin.pagamentos || [] }) }}
                          style={{ marginTop: 8, padding: '5px 10px', background: 'var(--v2-surface)', border: '1px solid var(--v2-rule2)', borderRadius: 7, fontSize: 11.5, color: 'var(--v2-ink3)', cursor: 'pointer' }}>Refazer parcelamento</button>
                      )}
                    </>)}
                    <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--v2-ink3)' }}>As parcelas viram lançamentos no Financeiro automaticamente.</p>
                  </>)
                })()}
              </div>

              <div>
                <label style={labelStyle}>Nº do processo (protocolo)</label>
                <input value={form.numeroProcesso} onChange={e => setForm({ ...form, numeroProcesso: e.target.value })} placeholder="Quando protocolado no órgão" style={inputStyle} />
              </div>

              {/* Requerentes — quem vai obter a cidadania (contatos com selo requerente) */}
              <div style={{ borderTop: '1px solid var(--v2-rule)', paddingTop: 14 }}>
                <label style={labelStyle}>Requerentes ({(form.requerentes || []).length})</label>
                <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--v2-ink3)' }}>As pessoas da família que vão obter a cidadania.</p>
                {(form.requerentes || []).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {(form.requerentes || []).map(id => (
                      <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--v2-info-bg)', border: '1px solid #c7d2fe', borderRadius: 999, padding: '3px 8px 3px 10px', fontSize: 12, color: '#3730a3' }}>
                        {nomeContato[id] || 'Requerente'}
                        <button type="button" onClick={() => toggleRequerente(id)} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                  <select value="" onChange={e => { if (e.target.value) toggleRequerente(e.target.value) }} style={inputStyle}>
                    <option value="">+ Vincular contato existente…</option>
                    {contatos.filter(c => !(form.requerentes || []).includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={novoReqNome} onChange={e => setNovoReqNome(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); criarRequerente() } }} placeholder="Ou criar novo requerente pelo nome" style={{ ...inputStyle, flex: 1 }} />
                    <button type="button" onClick={criarRequerente} disabled={criandoReq || !novoReqNome.trim()} style={{ padding: '0 14px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: criandoReq || !novoReqNome.trim() ? 'default' : 'pointer', opacity: criandoReq || !novoReqNome.trim() ? 0.5 : 1, whiteSpace: 'nowrap' }}>{criandoReq ? '…' : 'Criar'}</button>
                  </div>
                </div>
              </div>

              {/* Linhagem — a prova de descendência (cadeia até o ascendente) */}
              <div style={{ borderTop: '1px solid var(--v2-rule)', paddingTop: 14 }}>
                <label style={labelStyle}>Linhagem (prova de descendência)</label>
                {(() => { const r = resumoLinhagem(form.linhagem || []); return (
                  <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--v2-ink3)' }}>
                    {r.total === 0 ? 'Monte a cadeia do requerente até o ascendente estrangeiro.' : `${r.total} pessoa(s) · ${r.geracoes} geração(ões)${r.temAscendente ? ` · ascendente: ${r.ascendenteNome}` : ' · falta marcar o ascendente'}`}
                  </p>
                ) })()}
                <EditorLinhagem value={form.linhagem || []} onChange={l => setForm({ ...form, linhagem: l })} />
              </div>

              <div style={{ borderTop: '1px solid var(--v2-rule)', paddingTop: 14 }}>
                <label style={labelStyle}>Observações</label>
                <textarea lang="pt-BR" value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
              <div>
                {form.id && podeExcluir && (
                  <button onClick={() => { const p = lista.find(x => x.id === form.id); if (p) { setForm(null); excluir(p) } }} style={{ padding: '9px 14px', background: 'var(--v2-hot-bg)', border: '1px solid var(--v2-hot-bg)', borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--v2-hot)', cursor: 'pointer' }}>Excluir</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={fecharForm} style={{ padding: '9px 16px', background: 'var(--v2-surface)', border: '1px solid var(--v2-rule2)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--v2-ink2)', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={salvar} disabled={salvando} style={{ padding: '9px 18px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.6 : 1 }}>{salvando ? 'Salvando…' : 'Salvar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
