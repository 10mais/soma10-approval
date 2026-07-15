'use client'
import { useEffect, useMemo, useState } from 'react'
import { toast } from '@/lib/toast'
import {
  LayoutVeiculo, Poltrona, Celula, TipoPoltrona, TIPOS_POLTRONA, ELEMENTOS_COMUNS,
  capacidadeLayout, validarLayout, dimensoesLayout, celulaOcupada,
  adicionarPoltrona, moverPoltrona, renumerarPoltrona, alterarTipoPoltrona,
  adicionarElemento, moverElemento, limparCelula, definirAndares,
  MODELOS_LAYOUT, expandirModelo,
} from '@/lib/layoutVeiculo'

// Editor do croqui de um veículo. O croqui é a fonte da verdade do mapa de poltronas
// das reservas — por isso toda operação passa pelos helpers puros de lib/layoutVeiculo,
// que recusam o que corromperia o mapa (nº repetido, duas coisas na mesma célula).
//
// Convenção de colunas (a mesma do render em Reservas.tsx): 1,2 = par esquerdo ·
// 3 = corredor · 4 = individual direito · 5 = faixa de amenidades.
//
// `poltronasBloqueadas` = já vendidas em viagem que não aconteceu. Elas PODEM ser
// movidas de lugar (a reserva aponta para o número, não para a posição), mas não
// podem ser apagadas nem renumeradas — o servidor devolve 409 se tentar.

type Ferramenta = 'selecionar' | 'poltrona' | 'elemento' | 'apagar'

const CELULA = 30
const ALTURA = 26

const chave = (c: Celula) => `${c.andar}-${c.fileira}-${c.coluna}`

export default function EditorLayoutVeiculo({ layout, onChange, poltronasBloqueadas, readOnly = false }: {
  layout: LayoutVeiculo
  onChange: (l: LayoutVeiculo) => void
  poltronasBloqueadas?: Set<string>
  readOnly?: boolean
}) {
  const [ferramenta, setFerramenta] = useState<Ferramenta>('selecionar')
  const [tipoNovo, setTipoNovo] = useState<TipoPoltrona>('leito')
  const [rotuloEl, setRotuloEl] = useState('Frigobar')
  const [sel, setSel] = useState<string | null>(null) // número da poltrona selecionada
  const [arrastando, setArrastando] = useState<{ tipo: 'poltrona'; numero: string } | { tipo: 'elemento'; origem: Celula } | null>(null)
  // Rascunho do número: renumerar a cada tecla faria "40"→"7" passar por "4", que
  // pode colidir com uma poltrona existente e travar a digitação no meio.
  const [rascunhoNum, setRascunhoNum] = useState('')

  const bloqueadas = poltronasBloqueadas || new Set<string>()
  const erros = useMemo(() => validarLayout(layout), [layout])
  const capacidade = capacidadeLayout(layout)
  const selecionada = useMemo(() => layout.poltronas.find(p => p.numero === sel) || null, [layout.poltronas, sel])

  useEffect(() => { setRascunhoNum(sel || '') }, [sel])

  // Commit da renumeração — no blur ou no Enter, nunca a cada tecla.
  function confirmarNumero() {
    if (!selecionada) return
    const novo = rascunhoNum.trim()
    if (!novo || novo === selecionada.numero) { setRascunhoNum(selecionada.numero); return }
    const l = renumerarPoltrona(layout, selecionada.numero, novo)
    if (!l) { toast(`Já existe a poltrona ${novo}.`, 'erro'); setRascunhoNum(selecionada.numero); return }
    onChange(l)
    setSel(novo)
  }

  const aplicar = (novo: LayoutVeiculo | null, erro: string) => {
    if (!novo) { toast(erro, 'erro'); return false }
    onChange(novo)
    return true
  }

  function clicarCelula(celula: Celula, p?: Poltrona, elLabel?: string) {
    if (readOnly) return
    // Poltrona: sempre selecionável (menos na ferramenta Apagar).
    if (p && ferramenta !== 'apagar') { setSel(p.numero); return }

    if (ferramenta === 'apagar') {
      if (p && bloqueadas.has(p.numero)) { toast(`Poltrona ${p.numero} está vendida — cancele a reserva antes de apagar.`, 'erro'); return }
      if (!p && !elLabel) return
      if (sel && p?.numero === sel) setSel(null)
      onChange(limparCelula(layout, celula))
      return
    }
    if (elLabel) return // elemento só sai pela ferramenta Apagar (ou arrastando)

    // Célula vazia:
    if (ferramenta === 'selecionar') {
      // Fallback de toque — HTML5 drag não funciona em tela sensível ao toque.
      if (sel) aplicar(moverPoltrona(layout, sel, celula), 'Não dá para mover para uma célula ocupada.')
      return
    }
    if (ferramenta === 'poltrona') {
      aplicar(adicionarPoltrona(layout, celula, tipoNovo), 'Não dá para colocar poltrona aqui.')
      return
    }
    if (ferramenta === 'elemento') {
      aplicar(adicionarElemento(layout, celula, rotuloEl), 'Informe o rótulo do elemento (ou a célula está ocupada).')
    }
  }

  function soltarEm(celula: Celula) {
    if (readOnly || !arrastando) return
    if (arrastando.tipo === 'poltrona') aplicar(moverPoltrona(layout, arrastando.numero, celula), 'Célula ocupada — solte num espaço livre.')
    else aplicar(moverElemento(layout, arrastando.origem, celula), 'Célula ocupada — solte num espaço livre.')
    setArrastando(null)
  }

  function trocarAndares(n: number) {
    const novo = definirAndares(layout, n)
    if (!novo) { toast('Há poltrona ou elemento no andar de cima. Mova ou apague antes de deixar o croqui com 1 andar.', 'erro'); return }
    onChange(novo)
  }

  function usarModelo(id: string) {
    const l = expandirModelo(id)
    if (!l) return
    setSel(null)
    onChange(l)
  }

  const btnFerr = (f: Ferramenta, label: string) => (
    <button type="button" onClick={() => { setFerramenta(f); if (f !== 'selecionar') setSel(null) }}
      style={{ padding: '6px 12px', borderRadius: 8, border: ferramenta === f ? '1.5px solid #111' : '1px solid #e6e6e6', background: ferramenta === f ? '#111' : '#fff', color: ferramenta === f ? '#fff' : '#666', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
  )

  const andares = Array.from({ length: layout.andares }, (_, i) => i + 1)

  return (
    <div>
      {/* Barra de ferramentas */}
      {!readOnly && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          {btnFerr('selecionar', 'Selecionar')}
          {btnFerr('poltrona', '+ Poltrona')}
          {btnFerr('elemento', '+ Elemento')}
          {btnFerr('apagar', 'Apagar')}
          <span style={{ width: 1, height: 20, background: '#eee', margin: '0 4px' }} />
          <select value={layout.andares} onChange={e => trocarAndares(Number(e.target.value))}
            style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #e6e6e6', fontSize: 12, fontFamily: 'inherit', background: '#fff' }}>
            <option value={1}>1 andar</option>
            <option value={2}>2 andares</option>
          </select>
          <select value="" onChange={e => { if (e.target.value) usarModelo(e.target.value) }}
            style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #e6e6e6', fontSize: 12, fontFamily: 'inherit', background: '#fff' }}>
            <option value="">Começar de um modelo…</option>
            {MODELOS_LAYOUT.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </div>
      )}

      {/* Opções da ferramenta ativa */}
      {!readOnly && ferramenta === 'poltrona' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#888' }}>Tipo:</span>
          {TIPOS_POLTRONA.map(t => (
            <button key={t.key} type="button" onClick={() => setTipoNovo(t.key)}
              style={{ padding: '5px 10px', borderRadius: 999, border: tipoNovo === t.key ? '1.5px solid #1d4ed8' : '1px solid #e6e6e6', background: tipoNovo === t.key ? '#eff6ff' : '#fff', color: tipoNovo === t.key ? '#1d4ed8' : '#777', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{t.label}</button>
          ))}
        </div>
      )}
      {!readOnly && ferramenta === 'elemento' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          {ELEMENTOS_COMUNS.map(e => (
            <button key={e} type="button" onClick={() => setRotuloEl(e)}
              style={{ padding: '5px 10px', borderRadius: 999, border: rotuloEl === e ? '1.5px solid #1d4ed8' : '1px solid #e6e6e6', background: rotuloEl === e ? '#eff6ff' : '#fff', color: rotuloEl === e ? '#1d4ed8' : '#777', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{e}</button>
          ))}
          <input value={rotuloEl} onChange={e => setRotuloEl(e.target.value)} placeholder="ou digite…" maxLength={24}
            style={{ padding: '5px 9px', borderRadius: 8, border: '1px solid #e6e6e6', fontSize: 11.5, fontFamily: 'inherit', width: 110 }} />
        </div>
      )}

      {!readOnly && (
        <p style={{ margin: '0 0 10px', fontSize: 11.5, color: '#bbb' }}>
          {ferramenta === 'selecionar' && 'Arraste uma poltrona para mudar de lugar, ou clique nela e depois numa célula vazia. Clique para editar número e tipo.'}
          {ferramenta === 'poltrona' && 'Clique numa célula vazia para criar a poltrona (o número sai automático).'}
          {ferramenta === 'elemento' && 'Clique numa célula vazia para colocar o elemento no croqui.'}
          {ferramenta === 'apagar' && 'Clique numa poltrona ou elemento para remover.'}
        </p>
      )}

      {/* Croqui */}
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        {andares.map(andar => {
          const { maxFileira, maxColuna } = dimensoesLayout(layout, andar)
          // Sempre uma fileira sobrando embaixo (e o mínimo do croqui 2+1) para dar
          // onde crescer sem precisar de botão "adicionar fileira".
          const linhas = Math.max(maxFileira + 1, 6)
          const colunas = Math.max(maxColuna, 5)
          const poltronasAndar = new Map<string, Poltrona>()
          layout.poltronas.filter(p => p.andar === andar).forEach(p => poltronasAndar.set(`${p.fileira}-${p.coluna}`, p))
          const elementosAndar = new Map<string, string>()
          ;(layout.elementos || []).filter(e => e.andar === andar).forEach(e => elementosAndar.set(`${e.fileira}-${e.coluna}`, e.label))

          return (
            <div key={andar}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                {layout.andares > 1 ? (andar === 1 ? 'Inferior' : 'Superior') : 'Poltronas'}
              </div>
              <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, background: '#fafafa', border: '1px solid #eee', borderRadius: 10, padding: 8 }}>
                {Array.from({ length: linhas }, (_, f) => f + 1).map(fileira => (
                  <div key={fileira} style={{ display: 'flex', gap: 4 }}>
                    {Array.from({ length: colunas }, (_, c) => c + 1).map(coluna => {
                      const celula: Celula = { andar, fileira, coluna }
                      const p = poltronasAndar.get(`${fileira}-${coluna}`)
                      const el = elementosAndar.get(`${fileira}-${coluna}`)
                      const dropProps = readOnly ? {} : {
                        onDragOver: (ev: React.DragEvent) => { if (arrastando) ev.preventDefault() },
                        onDrop: (ev: React.DragEvent) => { ev.preventDefault(); soltarEm(celula) },
                      }

                      if (p) {
                        const travada = bloqueadas.has(p.numero)
                        const ativa = sel === p.numero
                        return (
                          <button key={coluna} type="button"
                            title={`Poltrona ${p.numero} · ${p.tipo}${travada ? ' · vendida (não pode apagar nem renumerar)' : ''}`}
                            draggable={!readOnly}
                            onDragStart={() => setArrastando({ tipo: 'poltrona', numero: p.numero })}
                            onDragEnd={() => setArrastando(null)}
                            {...dropProps}
                            onClick={() => clicarCelula(celula, p)}
                            style={{
                              width: CELULA, height: ALTURA, borderRadius: 6, padding: 0,
                              border: `1.5px solid ${ativa ? '#111' : travada ? '#fbbf24' : '#cbd5e1'}`,
                              background: ativa ? '#111' : travada ? '#fffbeb' : '#fff',
                              color: ativa ? '#fff' : travada ? '#b45309' : '#334155',
                              fontSize: 10, fontWeight: 800, cursor: readOnly ? 'default' : 'pointer',
                            }}>{p.numero}</button>
                        )
                      }
                      if (el) {
                        return (
                          <span key={coluna} title={el}
                            draggable={!readOnly}
                            onDragStart={() => setArrastando({ tipo: 'elemento', origem: celula })}
                            onDragEnd={() => setArrastando(null)}
                            {...dropProps}
                            onClick={() => clicarCelula(celula, undefined, el)}
                            style={{ minWidth: CELULA, height: ALTURA, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#94a3b8', background: '#f1f5f9', borderRadius: 5, padding: '0 4px', whiteSpace: 'nowrap', cursor: readOnly ? 'default' : 'pointer' }}>{el}</span>
                        )
                      }
                      return (
                        <button key={coluna} type="button" aria-label={`Fileira ${fileira}, coluna ${coluna} — vazia`}
                          {...dropProps}
                          onClick={() => clicarCelula(celula)}
                          disabled={readOnly}
                          style={{
                            width: CELULA, height: ALTURA, borderRadius: 6, padding: 0,
                            border: readOnly ? 'none' : '1px dashed #e2e8f0',
                            background: 'transparent', cursor: readOnly ? 'default' : 'pointer',
                          }} />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Poltrona selecionada */}
      {!readOnly && selecionada && (
        <div style={{ marginTop: 12, padding: 10, background: '#f8fafc', border: '1px solid #e6e6e6', borderRadius: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#888' }}>Poltrona</span>
          <input value={rascunhoNum} maxLength={4}
            disabled={bloqueadas.has(selecionada.numero)}
            onChange={e => setRascunhoNum(e.target.value)}
            onBlur={confirmarNumero}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmarNumero() } if (e.key === 'Escape') setRascunhoNum(selecionada.numero) }}
            style={{ width: 54, padding: '6px 8px', borderRadius: 8, border: '1px solid #e6e6e6', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', textAlign: 'center' }} />
          <select value={selecionada.tipo} onChange={e => onChange(alterarTipoPoltrona(layout, selecionada.numero, e.target.value as TipoPoltrona))}
            style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #e6e6e6', fontSize: 12, fontFamily: 'inherit', background: '#fff' }}>
            {TIPOS_POLTRONA.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          {bloqueadas.has(selecionada.numero)
            ? <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309', background: '#fffbeb', borderRadius: 999, padding: '3px 9px' }}>Vendida — só dá para mudar de lugar</span>
            : <button type="button" onClick={() => { onChange(limparCelula(layout, selecionada)); setSel(null) }}
                style={{ padding: '6px 11px', background: '#fff', border: '1px solid #fca5a5', borderRadius: 8, color: '#b91c1c', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>Excluir poltrona</button>}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={() => setSel(null)} style={{ background: 'none', border: 'none', color: '#999', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>Fechar</button>
        </div>
      )}

      {/* Capacidade + erros */}
      <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>Capacidade: {capacidade} {capacidade === 1 ? 'poltrona' : 'poltronas'}</span>
        {bloqueadas.size > 0 && <span style={{ fontSize: 11.5, color: '#b45309' }}>· {bloqueadas.size} vendida(s) em viagem que ainda não aconteceu</span>}
      </div>
      {erros.length > 0 && (
        <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
          {erros.map((e, i) => <li key={i} style={{ fontSize: 11.5, color: '#b91c1c', fontWeight: 600 }}>{e}</li>)}
        </ul>
      )}
    </div>
  )
}
