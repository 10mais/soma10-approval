'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'
import { LayoutVeiculo, capacidadeLayout, layoutVazio, validarLayout } from '@/lib/layoutVeiculo'
import EditorLayoutVeiculo from './EditorLayoutVeiculo'
import { v4 as uuid } from 'uuid'
import { fecharFora } from '@/lib/fecharModal'

// FROTA (turismo). Cada veículo tem o PRÓPRIO croqui (editável) — a capacidade é
// contada dele, nunca digitada, para não divergir do mapa de poltronas das reservas.

type Condicao = 'disponivel' | 'ocupado' | 'manutencao' | 'excluido'
type TipoVeiculo = 'onibus' | 'micro' | 'van' | 'carro'
type Manutencao = { id: string; data: string; tipo: string; km?: number; oficina?: string; custo?: number; descricao?: string; proximaData?: string; proximoKm?: number; criadoEm?: string }
type Documento = { id: string; tipo: string; numero?: string; vencimento: string; observacoes?: string }
type Veiculo = {
  id: string; nome: string; tipo?: TipoVeiculo; placa?: string; layout: LayoutVeiculo
  condicao: Condicao; amenidades?: string[]; manutencoes?: Manutencao[]; documentos?: Documento[]; observacoes?: string
}
type Form = {
  id?: string; nome: string; tipo: TipoVeiculo; placa: string; layout: LayoutVeiculo
  condicao: Condicao; amenidades: string[]; manutencoes: Manutencao[]; documentos: Documento[]; observacoes: string
}

const CONDICOES: { key: Condicao; label: string; cor: string; bg: string }[] = [
  { key: 'disponivel', label: 'Disponível para viajar', cor: 'var(--v2-ok)', bg: 'var(--v2-ok-bg)' },
  { key: 'ocupado', label: 'Ocupado', cor: 'var(--v2-info)', bg: 'var(--v2-info-bg)' },
  { key: 'manutencao', label: 'Em manutenção', cor: 'var(--v2-amber)', bg: 'var(--v2-amber-bg)' },
  { key: 'excluido', label: 'Excluído', cor: 'var(--v2-ink3)', bg: 'var(--v2-surface1)' },
]
const condInfo = (c: Condicao) => CONDICOES.find(x => x.key === c) || CONDICOES[0]

const TIPOS_VEICULO: { key: TipoVeiculo; label: string }[] = [
  { key: 'onibus', label: 'Ônibus' }, { key: 'micro', label: 'Micro-ônibus' },
  { key: 'van', label: 'Van' }, { key: 'carro', label: 'Carro' },
]
const TIPOS_MANUT = [
  { key: 'preventiva', label: 'Preventiva' }, { key: 'corretiva', label: 'Corretiva' },
  { key: 'revisao', label: 'Revisão' }, { key: 'pneu', label: 'Pneu' },
  { key: 'oleo', label: 'Óleo' }, { key: 'outro', label: 'Outro' },
]
const TIPOS_DOC = [
  { key: 'licenciamento', label: 'Licenciamento' }, { key: 'seguro', label: 'Seguro' },
  { key: 'antt', label: 'ANTT' }, { key: 'outro', label: 'Outro' },
]
const AMENIDADES = ['Starlink', 'Wi-Fi', 'Ar-condicionado', 'Banheiro', 'Frigobar', 'Tomadas', 'TV', 'Café/Água']

const fmtBRL = (v?: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtData = (s?: string) => s ? new Date(s + 'T00:00').toLocaleDateString('pt-BR') : ''
const hoje = () => new Date().toISOString().slice(0, 10)
// Dias até o vencimento (negativo = vencido). Compara só a data, sem fuso.
const diasAte = (ymd: string) => Math.round((new Date(ymd + 'T00:00').getTime() - new Date(hoje() + 'T00:00').getTime()) / 86400000)

const vazio = (): Form => ({
  nome: '', tipo: 'onibus', placa: '', layout: layoutVazio(), condicao: 'disponivel',
  amenidades: ['Starlink'], manutencoes: [], documentos: [], observacoes: '',
})

const inputStyle: React.CSSProperties = { padding: '10px 12px', borderRadius: 10, border: '1px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 5 }

export default function Frota({ podeEditar = true, podeExcluir = false }: { podeEditar?: boolean; podeExcluir?: boolean }) {
  const [lista, setLista] = useState<Veiculo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [form, setForm] = useState<Form | null>(null)
  const [secao, setSecao] = useState<'dados' | 'croqui' | 'manutencao'>('dados')
  const [bloqueadas, setBloqueadas] = useState<Set<string>>(new Set())
  const [salvando, setSalvando] = useState(false)
  const [verExcluidos, setVerExcluidos] = useState(false)

  const carregar = useCallback(() => {
    setCarregando(true)
    fetch('/api/frota').then(r => r.json()).then(d => { if (Array.isArray(d?.veiculos)) setLista(d.veiculos) }).catch(() => {}).finally(() => setCarregando(false))
  }, [])
  useEffect(() => { carregar() }, [carregar])

  const visiveis = useMemo(() => lista.filter(v => verExcluidos || v.condicao !== 'excluido'), [lista, verExcluidos])
  const excluidos = useMemo(() => lista.filter(v => v.condicao === 'excluido').length, [lista])

  function abrirNovo() { setForm(vazio()); setSecao('dados'); setBloqueadas(new Set()) }
  async function abrirEditar(v: Veiculo) {
    setForm({
      id: v.id, nome: v.nome, tipo: v.tipo || 'onibus', placa: v.placa || '',
      layout: v.layout || layoutVazio(), condicao: v.condicao, amenidades: v.amenidades || [],
      manutencoes: v.manutencoes || [], documentos: v.documentos || [], observacoes: v.observacoes || '',
    })
    setSecao('dados')
    // Poltronas vendidas em viagem que não aconteceu ficam travadas no editor.
    setBloqueadas(new Set())
    const d = await fetch(`/api/frota?id=${v.id}`).then(r => r.json()).catch(() => null)
    if (Array.isArray(d?.poltronasVendidas)) setBloqueadas(new Set(d.poltronasVendidas))
  }

  const toggleAmen = (a: string) => setForm(f => f && ({ ...f, amenidades: f.amenidades.includes(a) ? f.amenidades.filter(x => x !== a) : [...f.amenidades, a] }))

  async function salvar() {
    if (!form || salvando) return
    if (!form.nome.trim()) { toast('Informe o nome do veículo.', 'erro'); setSecao('dados'); return }
    const erros = validarLayout(form.layout)
    if (erros.length) { toast(erros[0], 'erro'); setSecao('croqui'); return }
    setSalvando(true)
    const r = await fetch('/api/frota', {
      method: form.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (r?.ok) { toast(form.id ? 'Veículo atualizado.' : 'Veículo cadastrado.', 'sucesso'); setForm(null); carregar() }
    else toast(r?.error || 'Falha ao salvar.', 'erro')
  }

  async function excluir(v: Veiculo) {
    const ok = await confirmar(
      `Excluir "${v.nome}" de vez? Para tirar de circulação preservando o histórico, use a condição "Excluído".`,
      { titulo: 'Excluir veículo', okLabel: 'Excluir', perigo: true },
    )
    if (!ok) return
    const r = await fetch('/api/frota', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: v.id }) }).then(x => x.json()).catch(() => null)
    if (r?.ok) { toast('Veículo excluído.', 'sucesso'); setForm(null); carregar() } else toast(r?.error || 'Falha ao excluir.', 'erro')
  }

  // ── Manutenção / documentos ────────────────────────────────────────────────
  const addManut = () => setForm(f => f && ({ ...f, manutencoes: [{ id: uuid(), data: hoje(), tipo: 'preventiva', criadoEm: new Date().toISOString() }, ...f.manutencoes] }))
  const setManut = (id: string, patch: Partial<Manutencao>) => setForm(f => f && ({ ...f, manutencoes: f.manutencoes.map(m => m.id === id ? { ...m, ...patch } : m) }))
  const rmManut = (id: string) => setForm(f => f && ({ ...f, manutencoes: f.manutencoes.filter(m => m.id !== id) }))
  const addDoc = () => setForm(f => f && ({ ...f, documentos: [...f.documentos, { id: uuid(), tipo: 'licenciamento', vencimento: '' }] }))
  const setDoc = (id: string, patch: Partial<Documento>) => setForm(f => f && ({ ...f, documentos: f.documentos.map(d => d.id === id ? { ...d, ...patch } : d) }))
  const rmDoc = (id: string) => setForm(f => f && ({ ...f, documentos: f.documentos.filter(d => d.id !== id) }))

  const btnSecao = (k: typeof secao, label: string, badge?: number) => (
    <button type="button" onClick={() => setSecao(k)}
      style={{ padding: '7px 13px', borderRadius: 9, border: 'none', background: secao === k ? 'var(--v2-ink)' : 'transparent', color: secao === k ? 'var(--v2-surface)' : 'var(--v2-ink3)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
      {label}{badge ? ` (${badge})` : ''}
    </button>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 20, color: 'var(--v2-ink)' }}>Frota</h2>
        <span style={{ flex: 1 }} />
        {excluidos > 0 && (
          <button onClick={() => setVerExcluidos(v => !v)} style={{ padding: '7px 12px', background: 'transparent', border: '1px solid var(--v2-rule)', borderRadius: 9, color: 'var(--v2-ink3)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {verExcluidos ? 'Ocultar excluídos' : `Ver excluídos (${excluidos})`}
          </button>
        )}
        {podeEditar && <button onClick={abrirNovo} style={{ padding: '9px 16px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Veículo</button>}
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--v2-ink3)' }}>Veículos da operadora. O croqui de cada um define o mapa de poltronas usado nas reservas — e a capacidade sai dele.</p>

      {carregando ? <p style={{ color: 'var(--v2-ink3)', fontSize: 13 }}>Carregando...</p>
        : visiveis.length === 0 ? <p style={{ color: 'var(--v2-ink3)', fontSize: 13 }}>Nenhum veículo cadastrado.</p>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {visiveis.map(v => {
              const cap = capacidadeLayout(v.layout || layoutVazio())
              const ci = condInfo(v.condicao)
              const tipoLabel = TIPOS_VEICULO.find(t => t.key === (v.tipo || 'onibus'))?.label
              // Documento vencido/vencendo — o alerta que o cron também dispara.
              const alerta = (v.documentos || [])
                .filter(d => d.vencimento)
                .map(d => ({ d, dias: diasAte(d.vencimento) }))
                .filter(x => x.dias <= 30)
                .sort((a, b) => a.dias - b.dias)[0]
              return (
                <div key={v.id} onClick={() => podeEditar && abrirEditar(v)}
                  style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 12, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', cursor: podeEditar ? 'pointer' : 'default', opacity: v.condicao === 'excluido' ? 0.6 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--v2-ink)' }}>{v.nome}</span>
                    {v.placa && <span style={{ fontSize: 11.5, color: 'var(--v2-ink3)', fontWeight: 600 }}>{v.placa}</span>}
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 10, fontWeight: 800, color: ci.cor, background: ci.bg, borderRadius: 999, padding: '2px 8px' }}>{ci.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--v2-ink2)', marginTop: 4 }}>
                    {tipoLabel} · {cap} {cap === 1 ? 'poltrona' : 'poltronas'}
                    {(v.layout?.pisos?.length || 1) > 1 ? ' · 2 pisos' : ''}
                  </div>
                  {alerta && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: alerta.dias < 0 ? 'var(--v2-hot)' : 'var(--v2-amber)', marginTop: 6 }}>
                      {TIPOS_DOC.find(t => t.key === alerta.d.tipo)?.label} {alerta.dias < 0 ? `vencido há ${Math.abs(alerta.dias)} dia(s)` : alerta.dias === 0 ? 'vence hoje' : `vence em ${alerta.dias} dia(s)`}
                    </div>
                  )}
                  {v.amenidades && v.amenidades.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                      {v.amenidades.map(a => <span key={a} style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--v2-info)', background: 'var(--v2-info-bg)', borderRadius: 999, padding: '2px 8px' }}>{a}</span>)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      {form && (
        <div onClick={fecharFora(() => setForm(null))} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v2-surface)', borderRadius: 16, maxWidth: 760, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16.5, color: 'var(--v2-ink)' }}>{form.id ? 'Editar veículo' : 'Novo veículo'}</h3>

            <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--v2-surface1)', borderRadius: 10, padding: 3, width: 'fit-content' }}>
              {btnSecao('dados', 'Dados')}
              {btnSecao('croqui', 'Croqui')}
              {btnSecao('manutencao', 'Manutenção', form.manutencoes.length + form.documentos.length)}
            </div>

            {/* ── Dados ── */}
            {secao === 'dados' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ flex: 2, minWidth: 180 }}>
                    <label style={labelStyle}>Veículo</label>
                    <input value={form.nome} onChange={e => setForm(f => f && ({ ...f, nome: e.target.value }))} placeholder="Ex.: DD 01 - Prata" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 110 }}>
                    <label style={labelStyle}>Placa</label>
                    <input value={form.placa} onChange={e => setForm(f => f && ({ ...f, placa: e.target.value.toUpperCase() }))} placeholder="ABC1D23" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label style={labelStyle}>Tipo</label>
                    <select value={form.tipo} onChange={e => setForm(f => f && ({ ...f, tipo: e.target.value as TipoVeiculo }))} style={{ ...inputStyle, width: '100%', background: 'var(--v2-surface)' }}>
                      {TIPOS_VEICULO.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label style={labelStyle}>Capacidade</label>
                    <div style={{ ...inputStyle, background: 'var(--v2-surface1)', color: 'var(--v2-ink2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ color: 'var(--v2-ink)' }}>{capacidadeLayout(form.layout)}</strong>
                      <span style={{ fontSize: 11.5 }}>poltronas</span>
                      <span style={{ flex: 1 }} />
                      <button type="button" onClick={() => setSecao('croqui')} style={{ background: 'none', border: 'none', color: 'var(--v2-info)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: 0 }}>Editar croqui</button>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 170 }}>
                    <label style={labelStyle}>Condição</label>
                    <select value={form.condicao} onChange={e => setForm(f => f && ({ ...f, condicao: e.target.value as Condicao }))} style={{ ...inputStyle, width: '100%', background: 'var(--v2-surface)' }}>
                      {CONDICOES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
                <p style={{ margin: '-4px 0 0', fontSize: 11, color: 'var(--v2-ink3)' }}>A capacidade é contada do croqui — assim ela nunca diverge do mapa de poltronas das reservas. Só &quot;Disponível para viajar&quot; aparece na hora de montar a viagem.</p>
                <div>
                  <label style={{ ...labelStyle, marginBottom: 6 }}>Amenidades</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {AMENIDADES.map(a => {
                      const on = form.amenidades.includes(a)
                      return <button key={a} type="button" onClick={() => toggleAmen(a)} style={{ padding: '6px 11px', borderRadius: 999, border: on ? '1.5px solid var(--v2-info)' : '1px solid var(--v2-surface2)', background: on ? 'var(--v2-info-bg)' : 'var(--v2-surface)', color: on ? 'var(--v2-info)' : 'var(--v2-ink3)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>{a}</button>
                    })}
                  </div>
                </div>
                <textarea lang="pt-BR" value={form.observacoes} onChange={e => setForm(f => f && ({ ...f, observacoes: e.target.value }))} placeholder="Observações" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            )}

            {/* ── Croqui ── */}
            {secao === 'croqui' && (
              <EditorLayoutVeiculo layout={form.layout} onChange={l => setForm(f => f && ({ ...f, layout: l }))} poltronasBloqueadas={bloqueadas} />
            )}

            {/* ── Manutenção ── */}
            {secao === 'manutencao' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--v2-ink)' }}>Documentos com validade</span>
                    <span style={{ flex: 1 }} />
                    <button type="button" onClick={addDoc} style={{ background: 'none', border: 'none', color: 'var(--v2-info)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Documento</button>
                  </div>
                  <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--v2-ink3)' }}>Vencendo em até 30 dias vira tarefa para a equipe automaticamente.</p>
                  {form.documentos.length === 0 && <p style={{ margin: 0, fontSize: 12, color: 'var(--v2-ink3)' }}>Nenhum documento cadastrado.</p>}
                  {form.documentos.map(d => {
                    const dias = d.vencimento ? diasAte(d.vencimento) : null
                    return (
                      <div key={d.id} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <select value={d.tipo} onChange={e => setDoc(d.id, { tipo: e.target.value })} style={{ ...inputStyle, background: 'var(--v2-surface)', flex: 1, minWidth: 130 }}>
                          {TIPOS_DOC.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                        </select>
                        <input value={d.numero || ''} onChange={e => setDoc(d.id, { numero: e.target.value })} placeholder="Número" style={{ ...inputStyle, flex: 1, minWidth: 100 }} />
                        <input type="date" value={d.vencimento} onChange={e => setDoc(d.id, { vencimento: e.target.value })} style={{ ...inputStyle, minWidth: 140 }} />
                        {dias !== null && dias <= 30 && (
                          <span style={{ fontSize: 10.5, fontWeight: 800, color: dias < 0 ? 'var(--v2-hot)' : 'var(--v2-amber)', background: dias < 0 ? 'var(--v2-hot-bg)' : 'var(--v2-amber-bg)', borderRadius: 999, padding: '3px 8px' }}>
                            {dias < 0 ? 'vencido' : dias === 0 ? 'vence hoje' : `${dias}d`}
                          </span>
                        )}
                        <button type="button" onClick={() => rmDoc(d.id)} style={{ background: 'none', border: 'none', color: 'var(--v2-ink3)', cursor: 'pointer', fontSize: 18 }}>×</button>
                      </div>
                    )
                  })}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--v2-ink)' }}>Histórico de serviços</span>
                    {form.manutencoes.length > 0 && <span style={{ fontSize: 11.5, color: 'var(--v2-ink2)' }}>· total {fmtBRL(form.manutencoes.reduce((s, m) => s + (Number(m.custo) || 0), 0))}</span>}
                    <span style={{ flex: 1 }} />
                    <button type="button" onClick={addManut} style={{ background: 'none', border: 'none', color: 'var(--v2-info)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Serviço</button>
                  </div>
                  {form.manutencoes.length === 0 && <p style={{ margin: 0, fontSize: 12, color: 'var(--v2-ink3)' }}>Nenhum serviço registrado.</p>}
                  {form.manutencoes.map(m => (
                    <div key={m.id} style={{ border: '1px solid var(--v2-rule)', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                        <input type="date" value={m.data} onChange={e => setManut(m.id, { data: e.target.value })} style={{ ...inputStyle, minWidth: 140 }} />
                        <select value={m.tipo} onChange={e => setManut(m.id, { tipo: e.target.value })} style={{ ...inputStyle, background: 'var(--v2-surface)', flex: 1, minWidth: 120 }}>
                          {TIPOS_MANUT.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                        </select>
                        <input type="number" min={0} value={m.km ?? ''} onChange={e => setManut(m.id, { km: e.target.value ? Number(e.target.value) : undefined })} placeholder="km" style={{ ...inputStyle, width: 90 }} />
                        <input type="number" min={0} step="0.01" value={m.custo ?? ''} onChange={e => setManut(m.id, { custo: e.target.value ? Number(e.target.value) : undefined })} placeholder="Custo R$" style={{ ...inputStyle, width: 110 }} />
                        <button type="button" onClick={() => rmManut(m.id)} style={{ background: 'none', border: 'none', color: 'var(--v2-ink3)', cursor: 'pointer', fontSize: 18, marginLeft: 'auto' }}>×</button>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <input value={m.oficina || ''} onChange={e => setManut(m.id, { oficina: e.target.value })} placeholder="Oficina / fornecedor" style={{ ...inputStyle, flex: 1, minWidth: 150 }} />
                        <input value={m.descricao || ''} onChange={e => setManut(m.id, { descricao: e.target.value })} placeholder="O que foi feito" style={{ ...inputStyle, flex: 2, minWidth: 180 }} />
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--v2-ink3)' }}>Próxima revisão:</span>
                        <input type="date" value={m.proximaData || ''} onChange={e => setManut(m.id, { proximaData: e.target.value })} style={{ ...inputStyle, minWidth: 140 }} />
                        <input type="number" min={0} value={m.proximoKm ?? ''} onChange={e => setManut(m.id, { proximoKm: e.target.value ? Number(e.target.value) : undefined })} placeholder="ou em km" style={{ ...inputStyle, width: 110 }} />
                        {m.proximaData && diasAte(m.proximaData) <= 30 && (
                          <span style={{ fontSize: 10.5, fontWeight: 800, color: diasAte(m.proximaData) < 0 ? 'var(--v2-hot)' : 'var(--v2-amber)', background: diasAte(m.proximaData) < 0 ? 'var(--v2-hot-bg)' : 'var(--v2-amber-bg)', borderRadius: 999, padding: '3px 8px' }}>
                            {diasAte(m.proximaData) < 0 ? 'atrasada' : 'próxima'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 18, alignItems: 'center' }}>
              {form.id && podeExcluir && (
                <button onClick={() => { const v = lista.find(x => x.id === form.id); if (v) excluir(v) }}
                  style={{ padding: '9px 14px', background: 'var(--v2-surface)', border: '1px solid var(--v2-hot-bg)', borderRadius: 9, color: 'var(--v2-hot)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', marginRight: 'auto' }}>Excluir</button>
              )}
              <span style={{ flex: form.id && podeExcluir ? undefined : 1 }} />
              <button onClick={() => setForm(null)} style={{ padding: '10px 16px', background: 'var(--v2-surface2)', border: 'none', borderRadius: 9, color: 'var(--v2-ink2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} style={{ padding: '10px 18px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: salvando ? 'wait' : 'pointer' }}>{salvando ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
