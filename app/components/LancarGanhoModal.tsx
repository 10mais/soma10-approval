'use client'
import { useEffect, useMemo, useState } from 'react'
import { fecharFora } from '@/lib/fecharModal'
import { formatarEntradaMoeda, parseMoeda, moedaParaCampo } from '@/lib/moeda'
import { FORMAS_PAGAMENTO, rotuloFormaPagamento } from '@/lib/ganhosFinanceiro'
import { PartePagamento, validarPartes, gerarParcelas, somaPartes, resumoPagamento } from '@/lib/pagamentoGanho'

// LANÇAR UM GANHO NO CAIXA — como a venda foi paga, de verdade.
//
// Uma venda de clínica raramente é "uma forma, um valor": é entrada no pix +
// resto no crédito em 6x. Este modal monta essa composição, mostra ANTES de
// confirmar cada parcela que vai nascer (data e valor) e só libera quando a soma
// fecha com o valor da venda.
//
// O que a tela deixa explícito, porque é a confusão clássica: o FATURAMENTO
// inteiro conta na meta do mês da venda; o CAIXA recebe parcela por parcela.
// Ver lib/pagamentoGanho.

export type GanhoPendente = {
  negocioId: string
  titulo: string
  contatoNome: string
  valor: number
  dataSugerida: string
  descricao: string
  procedimentos?: string[]
}

type ParteForm = { forma: string; valorTxt: string; parcelas: string }

const brl = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBr = (ymd: string) => ymd.split('-').reverse().join('/')

const campo: React.CSSProperties = { padding: '8px 10px', borderRadius: 9, border: '1.5px solid #e0e0e0', fontSize: 12.5, fontFamily: 'inherit', boxSizing: 'border-box' }
const rotulo: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 700, color: '#888', marginBottom: 6 }

export default function LancarGanhoModal({ ganho, catalogo, onClose, onLancado }: {
  ganho: GanhoPendente
  catalogo: string[]
  onClose: () => void
  onLancado: () => void
}) {
  // Começa com UMA forma cobrindo o valor inteiro: o caso mais comum é à vista,
  // e quem paga dividido só precisa dividir a linha.
  const [partes, setPartes] = useState<ParteForm[]>([{ forma: '', valorTxt: moedaParaCampo(ganho.valor), parcelas: '1' }])
  const [data, setData] = useState(ganho.dataSugerida)
  const [procedimentos, setProcedimentos] = useState<string[]>(ganho.procedimentos || [])
  const [outro, setOutro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erroServidor, setErroServidor] = useState('')

  const partesLimpas: PartePagamento[] = useMemo(() => partes.map(p => ({
    forma: p.forma,
    valor: parseMoeda(p.valorTxt),
    ...(p.forma === 'credito' ? { parcelas: p.parcelas === '' ? undefined : Number(p.parcelas) } : {}),
  })), [partes])

  const erro = useMemo(() => validarPartes(partesLimpas, ganho.valor, FORMAS_PAGAMENTO.map(f => f.chave)), [partesLimpas, ganho.valor])
  const previa = useMemo(() => (erro ? [] : gerarParcelas(partesLimpas, data)), [partesLimpas, data, erro])
  const soma = somaPartes(partesLimpas)

  // Ao dividir em duas formas, a segunda já nasce com o que falta — poupa a
  // conta de cabeça que é onde o centavo se perde.
  function adicionarForma() {
    const falta = Math.max(0, Math.round((ganho.valor - soma) * 100) / 100)
    setPartes(ps => [...ps, { forma: '', valorTxt: falta > 0 ? moedaParaCampo(falta) : '', parcelas: '1' }])
  }
  function mudarParte(i: number, campos: Partial<ParteForm>) {
    setPartes(ps => ps.map((p, idx) => (idx === i ? { ...p, ...campos } : p)))
  }

  async function confirmar() {
    if (erro || salvando) return
    setSalvando(true); setErroServidor('')
    const r = await fetch('/api/financeiro/ganhos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        negocioId: ganho.negocioId,
        data,
        procedimentos,
        partes: partesLimpas.map(p => ({ forma: p.forma, valor: p.valor, ...(p.parcelas ? { parcelas: p.parcelas } : {}) })),
      }),
    }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (!r?.ok) { setErroServidor(r?.error || 'Não foi possível lançar a entrada.'); return }
    onLancado()
  }

  const naoUsados = catalogo.filter(c => !procedimentos.includes(c))

  return (
    <div onClick={fecharFora(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 600, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: '#111' }}>Lançar no caixa</h3>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#888' }}>{ganho.descricao}</p>
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#16a34a', flexShrink: 0 }}>{brl(ganho.valor)}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999', lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {/* O QUE FOI VENDIDO — vem do CRM e pode ser corrigido aqui */}
        <div style={{ marginTop: 18 }}>
          <label style={rotulo}>Procedimento / método</label>
          {procedimentos.length === 0 && <p style={{ margin: '0 0 6px', fontSize: 11.5, color: '#bbb' }}>Nada marcado na oportunidade — escolha abaixo (vale também para o CRM).</p>}
          {procedimentos.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 7 }}>
              {procedimentos.map(p => (
                <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: '#3730a3', background: '#eef2ff', padding: '4px 8px', borderRadius: 999 }}>
                  {p}
                  <button onClick={() => setProcedimentos(ps => ps.filter(x => x !== p))} title="Remover" style={{ background: 'none', border: 'none', color: '#8b8bd0', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
                </span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {naoUsados.length > 0 && (
              <select value="" onChange={e => { if (e.target.value) setProcedimentos(ps => [...ps, e.target.value]) }} style={{ ...campo, flex: 1, minWidth: 180, background: '#fff' }}>
                <option value="">Adicionar do catálogo…</option>
                {naoUsados.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <input value={outro} onChange={e => setOutro(e.target.value)} placeholder="ou digite outro"
              onKeyDown={e => { if (e.key === 'Enter' && outro.trim()) { e.preventDefault(); setProcedimentos(ps => [...ps, outro.trim()]); setOutro('') } }}
              style={{ ...campo, flex: 1, minWidth: 150 }} />
            {outro.trim() && (
              <button onClick={() => { setProcedimentos(ps => [...ps, outro.trim()]); setOutro('') }}
                style={{ padding: '8px 12px', background: '#111', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+</button>
            )}
          </div>
        </div>

        {/* COMO FOI PAGO */}
        <div style={{ marginTop: 18 }}>
          <label style={rotulo}>Como foi pago</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {partes.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <select value={p.forma} onChange={e => mudarParte(i, { forma: e.target.value, ...(e.target.value !== 'credito' ? { parcelas: '1' } : {}) })}
                  style={{ ...campo, flex: 1, minWidth: 150, background: '#fff' }}>
                  <option value="">Forma de pagamento…</option>
                  {FORMAS_PAGAMENTO.map(f => <option key={f.chave} value={f.chave}>{f.label}</option>)}
                </select>
                <div style={{ position: 'relative', width: 130 }}>
                  <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 11.5, fontWeight: 700, color: '#bbb', pointerEvents: 'none' }}>R$</span>
                  <input value={p.valorTxt} onChange={e => mudarParte(i, { valorTxt: formatarEntradaMoeda(e.target.value) })} inputMode="decimal"
                    style={{ ...campo, width: '100%', paddingLeft: 28, textAlign: 'right' }} />
                </div>
                {p.forma === 'credito' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input value={p.parcelas} onChange={e => mudarParte(i, { parcelas: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                      inputMode="numeric" title="Em quantas vezes" style={{ ...campo, width: 52, textAlign: 'center' }} />
                    <span style={{ fontSize: 12, color: '#888', fontWeight: 700 }}>x</span>
                  </div>
                )}
                {partes.length > 1 && (
                  <button onClick={() => setPartes(ps => ps.filter((_, idx) => idx !== i))} title="Remover esta forma"
                    style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 16, padding: '0 2px' }}>×</button>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            <button onClick={adicionarForma} style={{ padding: '7px 12px', background: '#f4f4f5', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 12, cursor: 'pointer', color: '#333' }}>
              + Outra forma
            </button>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: '#888' }}>Somado: <b style={{ color: Math.abs(soma - ganho.valor) < 0.02 ? '#16a34a' : '#b91c1c' }}>{brl(soma)}</b> de {brl(ganho.valor)}</span>
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={rotulo}>Data do pagamento</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)} style={{ ...campo, width: 160 }} />
          </div>
          <p style={{ flex: 1, minWidth: 220, margin: 0, fontSize: 11, color: '#aaa', lineHeight: 1.5 }}>
            A venda inteira conta na <b>meta do mês em que foi fechada</b>; o caixa recebe cada parcela no mês dela.
          </p>
        </div>

        {/* PRÉVIA — o que vai nascer no caixa */}
        <div style={{ marginTop: 16, background: '#fafafa', borderRadius: 12, padding: 12 }}>
          {erro ? (
            <p style={{ margin: 0, fontSize: 12.5, color: '#b91c1c', fontWeight: 600 }}>{erro}</p>
          ) : (<>
            <p style={{ margin: '0 0 8px', fontSize: 11.5, fontWeight: 800, color: '#666' }}>
              {previa.length === 1 ? '1 entrada no caixa' : `${previa.length} entradas no caixa`} · {resumoPagamento(partesLimpas, rotuloFormaPagamento)}
            </p>
            <div style={{ maxHeight: 170, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {previa.map((pc, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#444' }}>
                  <span style={{ width: 74, flexShrink: 0, fontWeight: 700, color: '#888' }}>{dataBr(pc.data)}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>{rotuloFormaPagamento(pc.forma)}{pc.totalParcelas ? ` · ${pc.parcela}/${pc.totalParcelas}` : ''}</span>
                  <span style={{ fontWeight: 800, color: '#16a34a' }}>{brl(pc.valor)}</span>
                </div>
              ))}
            </div>
          </>)}
        </div>

        {erroServidor && <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#b91c1c', fontWeight: 600 }}>{erroServidor}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '10px 16px', background: '#fff', border: '1.5px solid #e0e0e0', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', color: '#666' }}>Cancelar</button>
          <button onClick={confirmar} disabled={!!erro || salvando}
            style={{ padding: '10px 18px', background: erro || salvando ? '#f0f0f0' : '#16a34a', color: erro || salvando ? '#aaa' : '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: erro || salvando ? 'not-allowed' : 'pointer' }}>
            {salvando ? 'Lançando…' : previa.length > 1 ? `Lançar ${previa.length} entradas` : 'Lançar entrada'}
          </button>
        </div>
      </div>
    </div>
  )
}

// EDITAR O LANÇAMENTO já feito — o "campo de edição no financeiro". Mexe só no
// que é descrição do fato (o que foi vendido, como está escrito, se já caiu).
// Valor, data e vínculo ficam de fora: alterar o valor de uma parcela faria o
// caixa deixar de bater com a venda que a originou.
export function EditarLancamentoModal({ lancamento, catalogo, onClose, onSalvo }: {
  lancamento: { id: string; descricao: string; procedimentos?: string[]; recebido?: boolean; parcela?: number; totalParcelas?: number }
  catalogo: string[]
  onClose: () => void
  onSalvo: () => void
}) {
  const [descricao, setDescricao] = useState(lancamento.descricao || '')
  const [procedimentos, setProcedimentos] = useState<string[]>(lancamento.procedimentos || [])
  const [recebido, setRecebido] = useState(!!lancamento.recebido)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const naoUsados = catalogo.filter(c => !procedimentos.includes(c))

  async function salvar() {
    if (salvando) return
    setSalvando(true); setErro('')
    const r = await fetch('/api/financeiro/lancamentos', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lancamento.id, descricao, procedimentos, recebido }),
    }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (!r?.ok) { setErro(r?.error || 'Não foi possível salvar.'); return }
    onSalvo()
  }

  return (
    <div onClick={fecharFora(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 460, width: '100%', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#111' }}>Editar lançamento</h3>
          {!!lancamento.totalParcelas && <span style={{ fontSize: 11, fontWeight: 800, color: '#7c3aed', background: '#f5f3ff', padding: '2px 8px', borderRadius: 999 }}>parcela {lancamento.parcela}/{lancamento.totalParcelas}</span>}
          <span style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999', lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <label style={rotulo}>Descrição</label>
        <input value={descricao} onChange={e => setDescricao(e.target.value)} style={{ ...campo, width: '100%', marginBottom: 16 }} />

        <label style={rotulo}>Procedimento / método</label>
        {procedimentos.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 7 }}>
            {procedimentos.map(p => (
              <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: '#3730a3', background: '#eef2ff', padding: '4px 8px', borderRadius: 999 }}>
                {p}
                <button onClick={() => setProcedimentos(ps => ps.filter(x => x !== p))} title="Remover" style={{ background: 'none', border: 'none', color: '#8b8bd0', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
              </span>
            ))}
          </div>
        )}
        {naoUsados.length > 0 && (
          <select value="" onChange={e => { if (e.target.value) setProcedimentos(ps => [...ps, e.target.value]) }} style={{ ...campo, width: '100%', background: '#fff' }}>
            <option value="">Adicionar do catálogo…</option>
            {naoUsados.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, cursor: 'pointer' }}>
          <input type="checkbox" checked={recebido} onChange={e => setRecebido(e.target.checked)} style={{ width: 15, height: 15, cursor: 'pointer' }} />
          <span style={{ fontSize: 12.5, color: '#333', fontWeight: 600 }}>Já caiu no caixa</span>
        </label>

        {erro && <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#b91c1c', fontWeight: 600 }}>{erro}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '10px 16px', background: '#fff', border: '1.5px solid #e0e0e0', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', color: '#666' }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando || !descricao.trim()}
            style={{ padding: '10px 18px', background: descricao.trim() ? 'var(--marca, #ffc00f)' : '#f0f0f0', color: descricao.trim() ? 'var(--marca-texto, #111)' : '#aaa', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: descricao.trim() ? 'pointer' : 'not-allowed' }}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
