'use client'
import { useCallback, useEffect, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'
import { LayoutVeiculo, capacidadeLayout } from '@/lib/layoutVeiculo'
import { copiarPacoteParaViagem, dataVoltaSugerida, type PacoteLite } from '@/lib/pacoteViagem'
import RoteiroViagem, { type Parada } from './RoteiroViagem'
import { v4 as uuid } from 'uuid'

// Viagens (turismo): uma saída com veículo, motoristas, valor e inclusos.
// As reservas (poltronas + passageiros) vivem no módulo Reservas.
//
// Dois negócios convivem aqui:
//  - PACOTE     → vende poltrona a poltrona, valor POR CLIENTE. Pode nascer de um
//                 modelo (aba Pacotes), copiando roteiro/inclusos/valor.
//  - FRETAMENTO → um contratante leva o veículo inteiro por valor FECHADO. Sem
//                 mapa de poltronas e sem multiplicar por passageiro.

type TipoViagem = 'pacote' | 'fretamento'
type Veiculo = { id: string; nome: string; layout: LayoutVeiculo; condicao?: string }
type Motorista = { nome: string; cpf?: string; cnh?: string; email?: string }
type MotoristaCad = { id: string; nome: string; cnh?: string; email: string }
type Viagem = {
  id: string; titulo: string; tipo?: TipoViagem; pacoteId?: string
  roteiro?: string; internacional?: boolean; dataIda: string; dataVolta?: string
  horaSaida?: string; horaRetorno?: string
  veiculoId?: string; motoristas?: Motorista[]; valorPacote: number
  valorFechado?: number; contratante?: string; descontoPadrao?: number
  inclusos?: string[]; paradas?: Parada[]; status: string; observacoes?: string
}
type Form = Omit<Viagem, 'id' | 'valorPacote' | 'descontoPadrao' | 'valorFechado' | 'tipo'> & {
  id?: string; tipo: TipoViagem; valorPacote: string; valorFechado: string; descontoPadrao: string; inclusoNovo: string
}

const TIPOS: { key: TipoViagem; label: string; ajuda: string }[] = [
  { key: 'pacote', label: 'Pacote', ajuda: 'Vende poltrona a poltrona — valor por cliente.' },
  { key: 'fretamento', label: 'Fretamento', ajuda: 'Um contratante leva o veículo inteiro — valor fechado.' },
]

const STATUS: { key: string; label: string; cor: string; bg: string }[] = [
  { key: 'planejada', label: 'Planejada', cor: '#a16207', bg: '#fef9c3' },
  { key: 'aberta', label: 'Aberta (vendas)', cor: '#166534', bg: '#dcfce7' },
  { key: 'realizada', label: 'Realizada', cor: '#374151', bg: '#e5e7eb' },
  { key: 'cancelada', label: 'Cancelada', cor: '#9ca3af', bg: '#f4f4f5' },
]
const stInfo = (s: string) => STATUS.find(x => x.key === s) || STATUS[1]
const fmtBRL = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtData = (s?: string) => s ? new Date(s + 'T00:00').toLocaleDateString('pt-BR') : ''

const vazio = (): Form => ({ titulo: '', tipo: 'pacote', pacoteId: '', roteiro: '', internacional: false, dataIda: '', dataVolta: '', horaSaida: '', horaRetorno: '', veiculoId: '', motoristas: [], valorPacote: '', valorFechado: '', contratante: '', descontoPadrao: '', inclusos: [], status: 'aberta', observacoes: '', inclusoNovo: '' })

export default function Viagens({ podeEditar = true, podeExcluir = false }: { podeEditar?: boolean; podeExcluir?: boolean }) {
  const [lista, setLista] = useState<Viagem[]>([])
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [form, setForm] = useState<Form | null>(null)
  const [formInicial, setFormInicial] = useState('')
  const [motoristasCad, setMotoristasCad] = useState<MotoristaCad[]>([])
  const [roteiroDe, setRoteiroDe] = useState<Viagem | null>(null)
  const [pacotes, setPacotes] = useState<PacoteLite[]>([])
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(() => {
    setCarregando(true)
    Promise.all([
      fetch('/api/viagens').then(r => r.json()),
      fetch('/api/frota').then(r => r.json()),
      fetch('/api/equipe').then(r => r.json()).catch(() => []),
      fetch('/api/pacotes-viagem').then(r => r.json()).catch(() => null),
    ]).then(([e, o, eq, pk]) => {
      if (Array.isArray(e?.viagens)) setLista(e.viagens)
      if (Array.isArray(o?.veiculos)) setVeiculos(o.veiculos)
      setMotoristasCad(Array.isArray(eq) ? eq.filter((u: any) => u.tipoTurismo === 'motorista').map((u: any) => ({ id: u.id, nome: u.nome, cnh: u.cnh, email: u.email })) : [])
      if (Array.isArray(pk?.pacotes)) setPacotes(pk.pacotes.filter((p: any) => p.ativo !== false))
    }).catch(() => {}).finally(() => setCarregando(false))
  }, [])
  useEffect(() => { carregar() }, [carregar])

  // Escolher um pacote PREENCHE a viagem com o modelo (título, destino, valor,
  // inclusos e o roteiro já em datas reais). Daqui em diante é cópia: editar a
  // viagem não mexe no pacote, e mexer no pacote não reescreve esta viagem.
  function aplicarPacote(pacoteId: string) {
    setForm(f => {
      if (!f) return f
      if (!pacoteId) return { ...f, pacoteId: '' }
      const p = pacotes.find(x => x.id === pacoteId)
      if (!p) return { ...f, pacoteId: '' }
      if (!f.dataIda) { toast('Informe a data de ida antes de escolher o pacote — o roteiro nasce a partir dela.', 'erro'); return f }
      const c = copiarPacoteParaViagem(p, f.dataIda, () => uuid())
      return {
        ...f, pacoteId,
        titulo: c.titulo, roteiro: c.roteiro || '',
        dataVolta: c.dataVolta || f.dataVolta,
        valorPacote: String(c.valorPacote || ''),
        inclusos: c.inclusos, paradas: c.paradas as Parada[],
        observacoes: c.observacoes || f.observacoes,
      }
    })
  }

  // Mudou a ida com pacote escolhido: o roteiro precisa andar junto, senão fica
  // apontando para as datas do mês passado.
  function mudarDataIda(dataIda: string) {
    setForm(f => {
      if (!f) return f
      const base = { ...f, dataIda }
      if (f.tipo !== 'pacote' || !f.pacoteId || !dataIda) return base
      const p = pacotes.find(x => x.id === f.pacoteId)
      if (!p) return base
      const c = copiarPacoteParaViagem(p, dataIda, () => uuid())
      return { ...base, dataVolta: c.dataVolta || dataVoltaSugerida(dataIda, p.dias) || f.dataVolta, paradas: c.paradas as Parada[] }
    })
  }

  const vagasDe = (veiculoId?: string) => { const v = veiculos.find(x => x.id === veiculoId); return v?.layout ? capacidadeLayout(v.layout) : 0 }

  // Lista oficial de passageiros (DAER/ANTT ou internacional). Confere as
  // pendências ANTES de baixar: entregar lista incompleta ao órgão é retrabalho na
  // véspera — melhor descobrir aqui e deixar o dono decidir.
  async function exportarLista(v: Viagem) {
    const d = await fetch(`/api/viagens/manifesto?id=${v.id}&check=1`).then(r => r.json()).catch(() => null)
    if (!d) { toast('Falha ao conferir a lista.', 'erro'); return }
    if (!d.total) { toast('Esta viagem ainda não tem passageiros.', 'erro'); return }
    if (d.incompletos) {
      const quem = (d.quem || []).slice(0, 3).map((q: any) => `${q.nome} (falta ${q.falta})`).join('; ')
      const ok = await confirmar(
        `${d.incompletos} de ${d.total} passageiro(s) estão incompletos para a lista${d.internacional ? ' internacional' : ' do DAER/ANTT'}.\n\n${quem}${d.quem?.length > 3 ? '…' : ''}\n\nBaixar assim mesmo? As pendências saem marcadas na última coluna.`,
        { titulo: 'Lista incompleta', okLabel: 'Baixar assim mesmo', cancelLabel: 'Voltar e completar', perigo: true },
      )
      if (!ok) return
    }
    // Same-origin: o download vem pelo Content-Disposition da rota.
    window.location.href = `/api/viagens/manifesto?id=${v.id}`
  }

  const snap = (f: Form | null) => f ? JSON.stringify({ ...f, inclusoNovo: '' }) : ''
  function abrirNovo() { const f = vazio(); setForm(f); setFormInicial(snap(f)) }
  function abrirEditar(e: Viagem) {
    const f: Form = { id: e.id, titulo: e.titulo, tipo: e.tipo || 'pacote', pacoteId: e.pacoteId || '', roteiro: e.roteiro || '', internacional: !!e.internacional, dataIda: e.dataIda, dataVolta: e.dataVolta || '', horaSaida: e.horaSaida || '', horaRetorno: e.horaRetorno || '', veiculoId: e.veiculoId || '', motoristas: e.motoristas || [], valorPacote: String(e.valorPacote || ''), valorFechado: e.valorFechado ? String(e.valorFechado) : '', contratante: e.contratante || '', descontoPadrao: e.descontoPadrao ? String(e.descontoPadrao) : '', inclusos: e.inclusos || [], paradas: e.paradas || [], status: e.status, observacoes: e.observacoes || '', inclusoNovo: '' }
    setForm(f); setFormInicial(snap(f))
  }
  async function fecharForm() {
    if (form && snap(form) !== formInicial) {
      const ok = await confirmar('Você tem alterações não salvas nesta viagem.', { titulo: 'Alterações não salvas', okLabel: 'Sair sem salvar', cancelLabel: 'Continuar editando', perigo: true })
      if (!ok) return
    }
    setForm(null)
  }
  const setMot = (i: number, patch: Partial<Motorista>) => setForm(f => f && ({ ...f, motoristas: (f.motoristas || []).map((m, j) => j === i ? { ...m, ...patch } : m) }))
  const addMot = () => setForm(f => f && ({ ...f, motoristas: [...(f.motoristas || []), { nome: '' }] }))
  const addMotCad = (u: MotoristaCad) => setForm(f => f && ({ ...f, motoristas: [...(f.motoristas || []), { nome: u.nome, cnh: u.cnh || '', email: u.email }] }))
  const rmMot = (i: number) => setForm(f => f && ({ ...f, motoristas: (f.motoristas || []).filter((_, j) => j !== i) }))
  const addIncluso = () => setForm(f => { if (!f || !f.inclusoNovo.trim()) return f; return { ...f, inclusos: [...(f.inclusos || []), f.inclusoNovo.trim()], inclusoNovo: '' } })
  const rmIncluso = (i: number) => setForm(f => f && ({ ...f, inclusos: (f.inclusos || []).filter((_, j) => j !== i) }))

  async function salvar() {
    if (!form || salvando) return
    if (!form.titulo.trim()) { toast('Informe o título da viagem.', 'erro'); return }
    if (!form.dataIda) { toast('Informe a data de ida.', 'erro'); return }
    if (form.tipo === 'fretamento' && !(form.contratante || '').trim()) { toast('No fretamento, informe quem contratou o veículo.', 'erro'); return }
    setSalvando(true)
    const corpo = {
      ...form,
      // O servidor também zera/limpa o campo do outro tipo, mas mandar coerente
      // evita gravar valor de pacote num fretamento por engano.
      valorPacote: form.tipo === 'fretamento' ? 0 : Number(form.valorPacote) || 0,
      valorFechado: form.tipo === 'fretamento' ? Number(form.valorFechado) || 0 : undefined,
      contratante: form.tipo === 'fretamento' ? (form.contratante || '').trim() : undefined,
      pacoteId: form.tipo === 'pacote' ? (form.pacoteId || undefined) : undefined,
      descontoPadrao: Number(form.descontoPadrao) || 0,
      motoristas: (form.motoristas || []).filter(m => m.nome.trim()),
    }
    const r = await fetch('/api/viagens', { method: form.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (r?.ok) { toast(form.id ? 'Viagem atualizada.' : 'Viagem criada.', 'sucesso'); setForm(null); carregar() }
    else toast(r?.error || 'Falha ao salvar.', 'erro')
  }
  async function excluir(e: Viagem) {
    if (!(await confirmar(`Excluir a viagem "${e.titulo}"?`, { titulo: 'Excluir viagem', okLabel: 'Excluir', perigo: true }))) return
    const r = await fetch('/api/viagens', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: e.id }) }).then(x => x.json()).catch(() => null)
    if (r?.ok) { toast('Viagem excluída.', 'sucesso'); carregar() } else toast(r?.error || 'Falha ao excluir.', 'erro')
  }

  const inputStyle: React.CSSProperties = { padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit' }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 5 }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#111' }}>Viagens</h2>
        <span style={{ flex: 1 }} />
        {podeEditar && <button onClick={abrirNovo} style={{ padding: '9px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Viagem</button>}
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#999' }}>Saídas da operadora. Defina veículo, motoristas, valor do pacote e o que está incluso.</p>

      {carregando ? <p style={{ color: '#aaa', fontSize: 13 }}>Carregando...</p>
        : lista.length === 0 ? <p style={{ color: '#aaa', fontSize: 13 }}>Nenhuma viagem cadastrada.</p>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lista.map(e => {
              const st = stInfo(e.status); const vagas = vagasDe(e.veiculoId); const o = veiculos.find(x => x.id === e.veiculoId)
              return (
                <div key={e.id} onClick={() => podeEditar && abrirEditar(e)} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', cursor: podeEditar ? 'pointer' : 'default' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{e.titulo}</span>
                    {e.tipo === 'fretamento' && <span style={{ fontSize: 10, fontWeight: 800, color: '#1d4ed8', background: '#eff6ff', borderRadius: 999, padding: '2px 8px' }}>Fretamento</span>}
                    <span style={{ fontSize: 10, fontWeight: 800, color: st.cor, background: st.bg, borderRadius: 999, padding: '2px 8px' }}>{st.label}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>
                      {e.tipo === 'fretamento' ? `${fmtBRL(e.valorFechado || 0)} fechado` : `${fmtBRL(e.valorPacote)}/pessoa`}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: '#666', marginTop: 5, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span>{fmtData(e.dataIda)}{e.horaSaida ? ` ${e.horaSaida}` : ''}{e.dataVolta ? ` → ${fmtData(e.dataVolta)}` : ''}</span>
                    {o && <span>· {o.nome}{vagas ? ` (${vagas} lug.)` : ''}</span>}
                    {e.tipo === 'fretamento' && e.contratante && <span>· {e.contratante}</span>}
                    {e.motoristas && e.motoristas.length > 0 && <span>· {e.motoristas.length} motorista(s)</span>}
                  </div>
                  {e.inclusos && e.inclusos.length > 0 && <div style={{ fontSize: 11.5, color: '#999', marginTop: 6 }}>Inclusos: {e.inclusos.join(' · ')}</div>}
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(podeEditar || (e.paradas && e.paradas.length > 0)) && (
                      <button type="button" onClick={ev => { ev.stopPropagation(); setRoteiroDe(e) }} style={{ fontSize: 11.5, fontWeight: 700, color: '#2563eb', background: '#eff6ff', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}>Roteiro{e.paradas && e.paradas.length ? ` (${e.paradas.length})` : ''}</button>
                    )}
                    <button type="button" onClick={ev => { ev.stopPropagation(); exportarLista(e) }} style={{ fontSize: 11.5, fontWeight: 700, color: '#166534', background: '#dcfce7', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}>
                      Exportar lista{e.internacional ? ' (internacional)' : ' (DAER/ANTT)'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      {form && (
        <div onClick={fecharForm} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={ev => ev.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 540, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16.5, color: '#111' }}>{form.id ? 'Editar viagem' : 'Nova viagem'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Tipo de viagem — muda o modelo de cobrança e a venda de poltrona */}
              <div>
                <label style={labelStyle}>Tipo de viagem</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {TIPOS.map(t => {
                    const on = form.tipo === t.key
                    return (
                      <button key={t.key} type="button" onClick={() => setForm(f => f && ({ ...f, tipo: t.key, ...(t.key === 'fretamento' ? { pacoteId: '' } : {}) }))}
                        style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: on ? '1.5px solid #111' : '1px solid #e6e6e6', background: on ? '#111' : '#fff', color: on ? '#fff' : '#666', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{t.label}</button>
                    )
                  })}
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 11, color: '#bbb' }}>{TIPOS.find(t => t.key === form.tipo)?.ajuda}</p>
              </div>

              {/* Internacional muda o que a LISTA de passageiros exige */}
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#333', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form.internacional} onChange={e => setForm(f => f && ({ ...f, internacional: e.target.checked }))} style={{ width: 16, height: 16 }} />
                Viagem internacional
                <span style={{ fontSize: 11, color: '#bbb' }}>— a ficha do passageiro passa a pedir passaporte, validade e nacionalidade</span>
              </label>

              {/* Pacote: escolher um modelo pronto OU cadastrar um novo na aba Pacotes */}
              {form.tipo === 'pacote' && (
                <div>
                  <label style={labelStyle}>Pacote</label>
                  <select value={form.pacoteId || ''} onChange={e => aplicarPacote(e.target.value)} style={{ ...inputStyle, width: '100%', background: '#fff' }}>
                    <option value="">Sem pacote (montar do zero)</option>
                    {pacotes.map(p => <option key={p.id} value={p.id}>{p.nome}{p.dias ? ` · ${p.dias} dia(s)` : ''}{p.valorBase ? ` · ${fmtBRL(p.valorBase)}` : ''}</option>)}
                  </select>
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#bbb' }}>
                    {pacotes.length === 0
                      ? 'Nenhum pacote cadastrado ainda — cadastre em Pacotes para reaproveitar roteiro, inclusos e valor.'
                      : 'Escolher um pacote COPIA roteiro, inclusos e valor para esta viagem. Depois disso os dois seguem independentes.'}
                  </p>
                </div>
              )}

              {/* Fretamento: quem contratou o veículo */}
              {form.tipo === 'fretamento' && (
                <div>
                  <label style={labelStyle}>Contratante</label>
                  <input value={form.contratante || ''} onChange={e => setForm(f => f && ({ ...f, contratante: e.target.value }))} placeholder="Ex.: Escola São José / Prefeitura de Santo Ângelo" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                </div>
              )}

              <input value={form.titulo} onChange={e => setForm(f => f && ({ ...f, titulo: e.target.value }))} placeholder="Título (ex.: Foz do Iguaçu — Julho)" style={{ ...inputStyle, fontSize: 14 }} />
              <input value={form.roteiro} onChange={e => setForm(f => f && ({ ...f, roteiro: e.target.value }))} placeholder="Roteiro (cidades/pontos)" style={inputStyle} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 130 }}><label style={labelStyle}>Ida</label><input type="date" value={form.dataIda} onChange={e => mudarDataIda(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} /></div>
                <div style={{ flex: 1, minWidth: 130 }}><label style={labelStyle}>Volta</label><input type="date" value={form.dataVolta} onChange={e => setForm(f => f && ({ ...f, dataVolta: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 130 }}><label style={labelStyle}>Horário de saída</label><input type="time" value={form.horaSaida || ''} onChange={e => setForm(f => f && ({ ...f, horaSaida: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} /></div>
                <div style={{ flex: 1, minWidth: 130 }}><label style={labelStyle}>Horário de retorno</label><input type="time" value={form.horaRetorno || ''} onChange={e => setForm(f => f && ({ ...f, horaRetorno: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} /></div>
              </div>
              <div>
                <label style={labelStyle}>Veículo</label>
                <select value={form.veiculoId} onChange={e => setForm(f => f && ({ ...f, veiculoId: e.target.value }))} style={{ ...inputStyle, width: '100%', background: '#fff' }}>
                  <option value="">Sem veículo definido</option>
                  {veiculos.filter(o => o.condicao === 'disponivel').map(o => <option key={o.id} value={o.id}>{o.nome} ({vagasDe(o.id)} lug.)</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {form.tipo === 'fretamento' ? (
                  <div style={{ flex: 1, minWidth: 130 }}>
                    <label style={labelStyle}>Valor fechado (R$)</label>
                    <input type="number" min={0} step="0.01" value={form.valorFechado} onChange={e => setForm(f => f && ({ ...f, valorFechado: e.target.value }))} placeholder="0,00" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                    <p style={{ margin: '4px 0 0', fontSize: 10.5, color: '#bbb' }}>Valor da viagem inteira — não multiplica por passageiro.</p>
                  </div>
                ) : (
                  <div style={{ flex: 1, minWidth: 130 }}>
                    <label style={labelStyle}>Valor por cliente (R$)</label>
                    <input type="number" min={0} step="0.01" value={form.valorPacote} onChange={e => setForm(f => f && ({ ...f, valorPacote: e.target.value }))} placeholder="0,00" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                    <p style={{ margin: '4px 0 0', fontSize: 10.5, color: '#bbb' }}>Multiplicado pelo nº de passageiros da reserva.</p>
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 130 }}>
                  <label style={labelStyle}>Situação</label>
                  <select value={form.status} onChange={e => setForm(f => f && ({ ...f, status: e.target.value }))} style={{ ...inputStyle, width: '100%', background: '#fff' }}>
                    {STATUS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              {/* Motoristas */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Motoristas</label>
                  {motoristasCad.length > 0 && (
                    <select value="" onChange={e => { const u = motoristasCad.find(m => m.email === e.target.value); if (u) addMotCad(u) }} style={{ ...inputStyle, padding: '6px 10px', fontSize: 12, background: '#fff' }}>
                      <option value="">+ Do cadastro…</option>
                      {motoristasCad.filter(m => !(form.motoristas || []).some(x => x.email === m.email)).map(m => <option key={m.email} value={m.email}>{m.nome}{m.cnh ? ` (CNH ${m.cnh})` : ''}</option>)}
                    </select>
                  )}
                  <button type="button" onClick={addMot} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: 0 }}>+ Manual</button>
                </div>
                {motoristasCad.length === 0 && <p style={{ margin: '0 0 6px', fontSize: 11, color: '#bbb' }}>Cadastre motoristas em Colaboradores (Tipo = Motorista) para escolhê-los aqui.</p>}
                {(form.motoristas || []).map((m, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input value={m.nome} onChange={e => setMot(i, { nome: e.target.value })} placeholder="Nome" style={{ ...inputStyle, flex: 2 }} />
                    <input value={m.cnh || ''} onChange={e => setMot(i, { cnh: e.target.value })} placeholder="CNH" style={{ ...inputStyle, flex: 1, minWidth: 80 }} />
                    <button type="button" onClick={() => rmMot(i)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 18 }}>×</button>
                  </div>
                ))}
              </div>
              {/* Inclusos */}
              <div>
                <label style={labelStyle}>Inclusos no pacote</label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input value={form.inclusoNovo} onChange={e => setForm(f => f && ({ ...f, inclusoNovo: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addIncluso() } }} placeholder="Ex.: Hospedagem 2 diárias" style={{ ...inputStyle, flex: 1 }} />
                  <button type="button" onClick={addIncluso} style={{ padding: '9px 14px', background: '#f4f4f5', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', color: '#333' }}>Add</button>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(form.inclusos || []).map((inc, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: '#333', background: '#f4f4f5', borderRadius: 999, padding: '4px 10px' }}>{inc}<button type="button" onClick={() => rmIncluso(i)} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button></span>
                  ))}
                </div>
              </div>
              <textarea value={form.observacoes} onChange={e => setForm(f => f && ({ ...f, observacoes: e.target.value }))} placeholder="Observações" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
              {form.id && podeExcluir && <button onClick={() => { const e = lista.find(x => x.id === form.id); if (e) excluir(e) }} style={{ padding: '9px 14px', background: '#fff', border: '1px solid #fca5a5', borderRadius: 9, color: '#b91c1c', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', marginRight: 'auto' }}>Excluir</button>}
              <span style={{ flex: form.id ? undefined : 1 }} />
              <button onClick={fecharForm} style={{ padding: '10px 16px', background: '#f0f0f0', border: 'none', borderRadius: 9, color: '#666', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} style={{ padding: '10px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: salvando ? 'wait' : 'pointer' }}>{salvando ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
      {roteiroDe && (
        <RoteiroViagem viagem={roteiroDe} podeEditar={podeEditar} onClose={() => setRoteiroDe(null)} onSaved={carregar} />
      )}
    </div>
  )
}
