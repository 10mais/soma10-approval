'use client'
import { useEffect, useMemo, useState } from 'react'
import { toast } from '@/lib/toast'
import {
  LayoutVeiculo, Assento, ElementoLayout, Celula, TipoPoltrona, TipoElemento,
  TIPOS_POLTRONA, ELEMENTOS_COMUNS, ESTRUTURA_PALETA, elementoInfo, rotuloPoltrona,
  capacidadeLayout, validarLayout, pisoPorId, assentoEm,
  adicionarPoltrona, moverPoltrona, renumerarPoltrona, alterarTipoPoltrona,
  adicionarElemento, limparCelula, alternarCorredor, definirColunas,
  adicionarPiso, removerPiso, MODELOS_LAYOUT, expandirModelo,
  deslocarPoltrona, zerarDesloc, deslocPoltrona, DESLOC_PASSO,
} from '@/lib/layoutVeiculo'
import { CorpoVeiculo, CroquiPiso, ElementoBox, poltronaBase, vazioBase, colunaVisual, CELULA, CORREDOR_W, GAP } from './CroquiVeiculo'

// Editor do croqui. O croqui é a fonte da verdade do mapa das reservas — por isso
// toda operação passa pelos helpers puros de lib/layoutVeiculo, que recusam o que
// corromperia o mapa (nº repetido, poltrona sobre o módulo de bar, etc).
//
// `poltronasBloqueadas` = já vendidas em viagem que não aconteceu. PODEM ser
// movidas de lugar (a reserva aponta para o número, não para a posição), mas não
// podem ser apagadas nem renumeradas — o servidor devolve 409 se tentar.

type Ferramenta = 'selecionar' | 'poltrona' | 'elemento' | 'apagar'

export default function EditorLayoutVeiculo({ layout, onChange, poltronasBloqueadas, readOnly = false }: {
  layout: LayoutVeiculo
  onChange: (l: LayoutVeiculo) => void
  poltronasBloqueadas?: Set<string>
  readOnly?: boolean
}) {
  const [ferramenta, setFerramenta] = useState<Ferramenta>('selecionar')
  const [tipoNovo, setTipoNovo] = useState<TipoPoltrona>('leito')
  const [rotuloEl, setRotuloEl] = useState('Chopeira')
  const [tipoEl, setTipoEl] = useState<TipoElemento>('bar')
  const [elLargura, setElLargura] = useState<'celula' | 'total'>('celula')
  const [elRowSpan, setElRowSpan] = useState(1)
  const [sel, setSel] = useState<string | null>(null)
  const [rascunhoNum, setRascunhoNum] = useState('')
  const [arrastando, setArrastando] = useState<string | null>(null)

  const bloqueadas = poltronasBloqueadas || new Set<string>()
  const erros = useMemo(() => validarLayout(layout), [layout])
  const capacidade = capacidadeLayout(layout)
  const selecionada = useMemo(() => {
    for (const p of layout.pisos) { const a = p.assentos.find(x => x[2] === sel); if (a) return a }
    return null
  }, [layout, sel])

  useEffect(() => { setRascunhoNum(sel || '') }, [sel])

  const aplicar = (novo: LayoutVeiculo | null, erro: string) => {
    if (!novo) { toast(erro, 'erro'); return }
    onChange(novo)
  }

  // Commit da renumeração no blur/Enter — a cada tecla, "40"→"07" passaria por "0"
  // e por "4", colidindo com poltronas existentes e travando a digitação.
  function confirmarNumero() {
    if (!selecionada) return
    const novo = rascunhoNum.trim()
    if (!novo || novo === selecionada[2]) { setRascunhoNum(selecionada[2]); return }
    const l = renumerarPoltrona(layout, selecionada[2], novo)
    if (!l) { toast(`Já existe a poltrona ${novo}.`, 'erro'); setRascunhoNum(selecionada[2]); return }
    onChange(l); setSel(novo)
  }

  function clicarCelula(celula: Celula, a?: Assento, el?: ElementoLayout) {
    if (readOnly) return
    if (a && ferramenta !== 'apagar') { setSel(a[2]); return }

    if (ferramenta === 'apagar') {
      if (a && bloqueadas.has(a[2])) { toast(`Poltrona ${rotuloPoltrona(a[2])} está vendida — cancele a reserva antes de apagar.`, 'erro'); return }
      if (!a && !el) return
      if (a && sel === a[2]) setSel(null)
      onChange(limparCelula(layout, celula))
      return
    }
    if (el) return // elemento só sai pela ferramenta Apagar

    if (ferramenta === 'selecionar') {
      // Fallback de toque: HTML5 drag não funciona em tela sensível ao toque.
      if (sel) aplicar(moverPoltrona(layout, sel, celula), 'Não dá para mover para uma célula ocupada.')
      return
    }
    if (ferramenta === 'poltrona') {
      aplicar(adicionarPoltrona(layout, celula, tipoNovo), 'Não dá para colocar poltrona aqui.')
      return
    }
    if (ferramenta === 'elemento') {
      aplicar(
        adicionarElemento(layout, celula, rotuloEl, tipoEl, { rowSpan: elRowSpan, largura: elLargura === 'total' ? 'total' : undefined }),
        'Informe o rótulo do elemento (ou a célula está ocupada).',
      )
    }
  }

  const btnFerr = (f: Ferramenta, label: string) => (
    <button type="button" onClick={() => { setFerramenta(f); if (f !== 'selecionar') setSel(null) }}
      style={{ padding: '6px 12px', borderRadius: 8, border: ferramenta === f ? '1.5px solid #111' : '1px solid #e6e6e6', background: ferramenta === f ? '#111' : '#fff', color: ferramenta === f ? '#fff' : '#666', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
  )
  const inputS: React.CSSProperties = { padding: '5px 9px', borderRadius: 8, border: '1px solid #e6e6e6', fontSize: 11.5, fontFamily: 'inherit' }

  return (
    <div>
      {!readOnly && (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            {btnFerr('selecionar', 'Selecionar')}
            {btnFerr('poltrona', '+ Poltrona')}
            {btnFerr('elemento', '+ Elemento')}
            {btnFerr('apagar', 'Apagar')}
            <span style={{ width: 1, height: 20, background: '#eee', margin: '0 4px' }} />
            <select value="" onChange={e => { const l = expandirModelo(e.target.value); if (l) { setSel(null); onChange(l) } }}
              style={{ ...inputS, background: '#fff' }}>
              <option value="">Começar de um modelo…</option>
              <optgroup label="Ônibus">
                {MODELOS_LAYOUT.filter(m => m.grupo === 'onibus').map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </optgroup>
              <optgroup label="Vans">
                {MODELOS_LAYOUT.filter(m => m.grupo === 'van').map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </optgroup>
              {MODELOS_LAYOUT.filter(m => !m.grupo).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
            {layout.pisos.length < 2
              ? <button type="button" onClick={() => aplicar(adicionarPiso(layout), 'Já são 2 pisos.')} style={{ ...inputS, background: '#fff', fontWeight: 700, color: '#2563eb', cursor: 'pointer', border: 'none' }}>+ Piso inferior</button>
              : <button type="button" onClick={() => aplicar(removerPiso(layout, 'inf'), 'O piso inferior tem poltrona — apague antes de remover o piso.')} style={{ ...inputS, background: '#fff', fontWeight: 700, color: '#b91c1c', cursor: 'pointer', border: 'none' }}>− Piso inferior</button>}
          </div>

          {ferramenta === 'poltrona' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#888' }}>Tipo:</span>
              {TIPOS_POLTRONA.map(t => (
                <button key={t.key} type="button" onClick={() => setTipoNovo(t.key)}
                  style={{ padding: '5px 10px', borderRadius: 999, border: tipoNovo === t.key ? '1.5px solid #1d4ed8' : '1px solid #e6e6e6', background: tipoNovo === t.key ? '#eff6ff' : '#fff', color: tipoNovo === t.key ? '#1d4ed8' : '#777', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{t.label}</button>
              ))}
            </div>
          )}

          {ferramenta === 'elemento' && (
            <div style={{ marginBottom: 10, padding: 10, background: '#fafafa', border: '1px solid #eee', borderRadius: 10 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#888', width: 70 }}>Estrutura</span>
                {ESTRUTURA_PALETA.map(e => {
                  const on = tipoEl === e.tipo
                  return <button key={e.tipo} type="button" onClick={() => { setTipoEl(e.tipo); setRotuloEl(e.label) }}
                    style={{ padding: '5px 10px', borderRadius: 999, border: on ? `1.5px solid ${e.cor}` : '1px solid #e6e6e6', background: on ? e.bg : '#fff', color: on ? e.cor : '#777', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{e.label}</button>
                })}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#888', width: 70 }}>Amenidade</span>
                {ELEMENTOS_COMUNS.map(e => {
                  const on = tipoEl === 'amenidade' && rotuloEl === e
                  return <button key={e} type="button" onClick={() => { setTipoEl('amenidade'); setRotuloEl(e) }}
                    style={{ padding: '5px 10px', borderRadius: 999, border: on ? '1.5px solid #1d4ed8' : '1px solid #e6e6e6', background: on ? '#eff6ff' : '#fff', color: on ? '#1d4ed8' : '#777', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{e}</button>
                })}
              </div>
              {/* Span: é o que faz o módulo de bar e o frigobar de fundo existirem */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px dashed #e6e6e6' }}>
                <input value={rotuloEl} onChange={e => setRotuloEl(e.target.value)} placeholder="Rótulo" maxLength={40} style={{ ...inputS, width: 170 }} />
                <select value={elLargura} onChange={e => setElLargura(e.target.value as any)} style={{ ...inputS, background: '#fff' }}>
                  <option value="celula">Numa célula</option>
                  <option value="total">Atravessa o piso</option>
                </select>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#888' }}>Fileiras</label>
                <input type="number" min={1} max={4} value={elRowSpan} onChange={e => setElRowSpan(Math.max(1, Math.min(4, Number(e.target.value) || 1)))} style={{ ...inputS, width: 54 }} />
                <span style={{ fontSize: 10.5, color: '#bbb' }}>(o módulo de bar do Carro 2021 ocupa 2 fileiras)</span>
              </div>
            </div>
          )}

          <p style={{ margin: '0 0 10px', fontSize: 11.5, color: '#bbb' }}>
            {ferramenta === 'selecionar' && 'Arraste uma poltrona para mudar de lugar, ou clique nela e depois numa célula vazia. Clique para editar número e tipo.'}
            {ferramenta === 'poltrona' && 'Clique numa célula vazia para criar a poltrona (o número sai automático).'}
            {ferramenta === 'elemento' && 'Clique numa célula vazia para colocar o elemento no croqui.'}
            {ferramenta === 'apagar' && 'Clique numa poltrona ou elemento para remover.'}
          </p>
        </>
      )}

      {/* Croqui — um casco por piso */}
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {layout.pisos.map((piso, iPiso) => (
          <div key={piso.id}>
            <CorpoVeiculo titulo={piso.nome} comVolante={iPiso === layout.pisos.length - 1}>
              {/* Corredor e colunas: o corredor é VÃO entre colunas, não célula */}
              {!readOnly && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#bbb' }}>Corredor após:</span>
                  {Array.from({ length: Math.max(0, piso.colunas - 1) }, (_, c) => c).map(c => {
                    const on = piso.corredorApos.includes(c)
                    return (
                      <button key={c} type="button" onClick={() => onChange(alternarCorredor(layout, piso.id, c))}
                        style={{ padding: '3px 8px', borderRadius: 999, border: on ? '1.5px solid #64748b' : '1px solid #e6e6e6', background: on ? '#f1f5f9' : '#fff', color: on ? '#475569' : '#aaa', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                        col {c + 1}
                      </button>
                    )
                  })}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#bbb' }}>Colunas</span>
                  <input type="number" min={1} max={6} value={piso.colunas}
                    onChange={e => aplicar(definirColunas(layout, piso.id, Number(e.target.value)), 'Há poltrona na coluna que sumiria — mova ou apague antes.')}
                    style={{ ...inputS, width: 50, padding: '3px 6px' }} />
                </div>
              )}

              <CroquiPiso
                piso={piso}
                extraLinhas={readOnly ? 0 : 1}
                renderElemento={(el, i) => (
                  <ElementoBox key={`el-${i}`} el={el} corredorApos={piso.corredorApos}
                    onClick={() => clicarCelula({ pisoId: piso.id, linha: el.linha, col: el.col ?? 0 }, undefined, el)}
                    style={{ cursor: readOnly ? 'default' : 'pointer' }} />
                )}
                renderAssento={a => {
                  const travada = bloqueadas.has(a[2])
                  const ativa = sel === a[2]
                  return (
                    <button type="button"
                      title={`Poltrona ${rotuloPoltrona(a[2])} · ${a[3] || 'leito'}${travada ? ' · vendida (não pode apagar nem renumerar)' : ''}`}
                      draggable={!readOnly}
                      onDragStart={() => setArrastando(a[2])}
                      onDragEnd={() => setArrastando(null)}
                      onClick={() => clicarCelula({ pisoId: piso.id, linha: a[0], col: a[1] }, a)}
                      style={{
                        ...poltronaBase,
                        border: `1.5px solid ${ativa ? '#111' : travada ? '#fbbf24' : '#e2e8f0'}`,
                        background: ativa ? '#111' : travada ? '#fffbeb' : '#f1f5f9',
                        color: ativa ? '#fff' : travada ? '#b45309' : '#475569',
                        cursor: readOnly ? 'default' : 'pointer',
                      }}>{rotuloPoltrona(a[2])}</button>
                  )
                }}
                renderVazio={(linha, col) => (
                  <button type="button" aria-label={`Fileira ${linha + 1}, coluna ${col + 1} — vazia`}
                    disabled={readOnly}
                    onDragOver={ev => { if (arrastando) ev.preventDefault() }}
                    onDrop={ev => {
                      ev.preventDefault()
                      if (!arrastando) return
                      aplicar(moverPoltrona(layout, arrastando, { pisoId: piso.id, linha, col }), 'Célula ocupada — solte num espaço livre.')
                      setArrastando(null)
                    }}
                    onClick={() => clicarCelula({ pisoId: piso.id, linha, col })}
                    style={{
                      ...vazioBase, borderRadius: 8, padding: 0,
                      border: readOnly ? 'none' : '1px dashed #e8ecf0',
                      background: 'transparent', cursor: readOnly ? 'default' : 'pointer',
                    }} />
                )}
              />
            </CorpoVeiculo>
          </div>
        ))}
      </div>

      {/* Poltrona selecionada */}
      {!readOnly && selecionada && (
        <div style={{ marginTop: 12, padding: 10, background: '#f8fafc', border: '1px solid #e6e6e6', borderRadius: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#888' }}>Poltrona</span>
          <input value={rascunhoNum} maxLength={4}
            disabled={bloqueadas.has(selecionada[2])}
            onChange={e => setRascunhoNum(e.target.value)}
            onBlur={confirmarNumero}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmarNumero() } if (e.key === 'Escape') setRascunhoNum(selecionada[2]) }}
            style={{ width: 56, padding: '6px 8px', borderRadius: 8, border: '1px solid #e6e6e6', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', textAlign: 'center' }} />
          <select value={selecionada[3] || 'leito'} onChange={e => onChange(alterarTipoPoltrona(layout, selecionada[2], e.target.value as TipoPoltrona))}
            style={{ ...inputS, background: '#fff', fontSize: 12 }}>
            {TIPOS_POLTRONA.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          {bloqueadas.has(selecionada[2])
            ? <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309', background: '#fffbeb', borderRadius: 999, padding: '3px 9px' }}>Vendida — só dá para mudar de lugar</span>
            : <button type="button" onClick={() => { onChange(removerPoltronaSel()); setSel(null) }}
                style={{ padding: '6px 11px', background: '#fff', border: '1px solid #fca5a5', borderRadius: 8, color: '#b91c1c', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>Excluir poltrona</button>}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={() => setSel(null)} style={{ background: 'none', border: 'none', color: '#999', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>Fechar</button>

          {/* Mover livre: o carro real não é 100% em grade (fileira do fundo com 5,
              poltrona no corredor). As setas empurram só o DESENHO, ¼ de célula por
              clique — a poltrona segue na célula dela para reserva e validação. */}
          <div style={{ width: '100%', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px dashed #e6e6e6', paddingTop: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#888' }}>Mover livre</span>
            {([['◀', -DESLOC_PASSO, 0], ['▶', DESLOC_PASSO, 0], ['▲', 0, -DESLOC_PASSO], ['▼', 0, DESLOC_PASSO]] as const).map(([rotulo, ddx, ddy]) => (
              <button key={rotulo} type="button" title={`Deslocar ${rotulo} (¼ de célula)`}
                onClick={() => onChange(deslocarPoltrona(layout, selecionada[2], ddx, ddy))}
                style={{ width: 30, height: 26, padding: 0, background: '#fff', border: '1px solid #e6e6e6', borderRadius: 7, color: '#475569', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{rotulo}</button>
            ))}
            {(() => { const [dx, dy] = deslocPoltrona(selecionada); return (dx || dy) ? (
              <button type="button" onClick={() => onChange(zerarDesloc(layout, selecionada[2]))}
                style={{ padding: '5px 10px', background: '#fff', border: '1px solid #e6e6e6', borderRadius: 7, color: '#2563eb', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Voltar à grade</button>
            ) : <span style={{ fontSize: 10.5, color: '#bbb' }}>para poltrona fora do alinhamento (ex.: fundo com 5, poltrona no corredor)</span> })()}
          </div>
        </div>
      )}

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

  function removerPoltronaSel(): LayoutVeiculo {
    if (!selecionada) return layout
    const piso = layout.pisos.find(p => p.assentos.some(a => a[2] === selecionada[2]))!
    return limparCelula(layout, { pisoId: piso.id, linha: selecionada[0], col: selecionada[1] })
  }
}
