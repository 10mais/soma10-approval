'use client'
// PRÉVIA DA ARTE (mockup) da copy em aprovação — dono, 30/09: "precisa retratar a dimensão
// exata da headline (maior), subheadline (secundária) e demais textos na tela. Como se fosse
// um mockup. Quase que um criativo final, porém com versão de amostra de disposição de
// espaços." A regra do que entra em cada quadro é de lib/mockupCopy (testada); aqui é o desenho.
//
// A arte fica em "papel" branco nos dois temas: é a representação da peça, não um painel da
// tela. Espaço da imagem hachurado (ou a foto, quando o post já tem uma), CTA como botão na
// cor da marca, logo do cliente no canto, carrossel com um quadro por lâmina lado a lado.
import { useEffect, useRef, useState } from 'react'
import { useT } from '@/app/components/Idioma'
import { previaDaCopy, escalaDoQuadro, type CopyDoPost, type Quadro } from '@/lib/mockupCopy'

const TINTA = '#17150E'

// Cor de texto legível sobre a cor da marca (luminância simples).
function textoSobre(cor: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(cor.trim())
  if (!m) return '#ffffff'
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? TINTA : '#ffffff'
}
const corValida = (c?: string) => (c && /^#?[0-9a-f]{6}$/i.test(c.trim()) ? (c.trim().startsWith('#') ? c.trim() : `#${c.trim()}`) : '')

export default function MockupCopy({ copy, corMarca, fotoUrl, imagemUrl, largura = 210 }: {
  copy: CopyDoPost
  corMarca?: string   // cor primária do cliente (CTA e detalhes)
  fotoUrl?: string    // logo/foto do perfil do cliente
  imagemUrl?: string  // foto já escolhida para a peça (se houver)
  largura?: number
}) {
  const tr = useT()
  const previa = previaDaCopy(copy)
  const vertical = previa.proporcao === '9 / 16'
  const w = vertical ? Math.round(largura * 0.8) : largura
  const cor = corValida(corMarca) || '#ffc00f'
  const total = previa.quadros.length
  const varios = total > 1

  // CARROSSEL NO MOUSE (dono, 30/09: "está passando somente com touch, e não com o clique do
  // mouse"). A fileira rola sozinha no toque; no computador, sem trackpad, não havia como
  // passar. Agora: setas nas laterais, bolinhas clicáveis e arrastar com o mouse.
  const trilho = useRef<HTMLDivElement>(null)
  const passo = w + 10 // um quadro + o espaço entre eles
  const [nav, setNav] = useState({ atual: 0, voltar: false, avancar: false, rola: false })
  const arraste = useRef<{ x: number; scroll: number } | null>(null)

  // Lâmina atual lida da POSIÇÃO REAL da fileira (encostada no fim = a última).
  function indiceAtual(el: HTMLDivElement): number {
    const noFim = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
    return el.scrollWidth > el.clientWidth + 4 && noFim ? total - 1 : Math.round(el.scrollLeft / passo)
  }
  function medir() {
    const el = trilho.current
    if (!el) return
    const rola = el.scrollWidth > el.clientWidth + 4
    const noFim = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
    setNav({ rola, voltar: el.scrollLeft > 4, avancar: !noFim, atual: indiceAtual(el) })
  }
  // Setas: andam a partir de onde a fileira ESTÁ agora (não do último valor guardado).
  function andar(delta: number) {
    const el = trilho.current
    if (el) irPara(indiceAtual(el) + delta)
  }
  useEffect(() => {
    medir()
    const el = trilho.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => medir())
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, passo])

  function irPara(i: number) {
    const el = trilho.current
    if (!el) return
    const alvo = Math.max(0, Math.min(total - 1, i)) * passo
    const inicio = el.scrollLeft
    el.scrollTo({ left: alvo, behavior: 'smooth' })
    // Garantia: há navegador (e janela sem desenhar) em que a rolagem suave num carrossel com
    // encaixe nem começa. Se nada se mexeu, vai direto — nunca "clicou e não aconteceu nada".
    setTimeout(() => {
      if (trilho.current && trilho.current.scrollLeft === inicio && inicio !== alvo) trilho.current.scrollTo({ left: alvo })
      medir() // setas e bolinhas em dia mesmo se o evento de rolagem não vier
    }, 400)
  }

  // Arrastar com o MOUSE (no toque o navegador já rola sozinho). O encaixe da lâmina sai
  // durante o arraste (senão briga com a mão) e volta ao soltar, na lâmina mais próxima.
  function aoApertar(e: React.PointerEvent<HTMLDivElement>) {
    const el = trilho.current
    if (e.pointerType !== 'mouse' || e.button !== 0 || !el || !nav.rola) return
    arraste.current = { x: e.clientX, scroll: el.scrollLeft }
    el.style.scrollSnapType = 'none'
    el.style.cursor = 'grabbing'
    try { el.setPointerCapture(e.pointerId) } catch { /* sem captura, o arraste segue pelo trilho */ }
  }
  function aoMover(e: React.PointerEvent<HTMLDivElement>) {
    const a = arraste.current
    if (!a || !trilho.current) return
    trilho.current.scrollLeft = a.scroll - (e.clientX - a.x)
  }
  function aoSoltar(e: React.PointerEvent<HTMLDivElement>) {
    const el = trilho.current
    if (!arraste.current || !el) return
    arraste.current = null
    try { el.releasePointerCapture(e.pointerId) } catch { /* já solto */ }
    el.style.scrollSnapType = 'x mandatory'
    el.style.cursor = 'grab'
    irPara(Math.round(el.scrollLeft / passo))
  }

  const seta = (lado: 'voltar' | 'avancar'): React.CSSProperties => ({
    position: 'absolute', top: '50%', transform: 'translateY(-50%)', ...(lado === 'voltar' ? { left: 4 } : { right: 4 }), zIndex: 2,
    width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.95)', color: TINTA,
    boxShadow: '0 2px 8px rgba(0,0,0,0.18)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  })

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ position: 'relative' }}>
        <div ref={trilho} onScroll={medir} onPointerDown={aoApertar} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={aoSoltar}
          style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: varios ? 6 : 0, scrollSnapType: varios ? 'x mandatory' : undefined, alignItems: 'flex-start', cursor: nav.rola ? 'grab' : undefined, userSelect: nav.rola ? 'none' : undefined }}>
          {previa.quadros.map((q, i) => (
            <QuadroArte key={i} q={q} proporcao={previa.proporcao} largura={w} cor={cor} fotoUrl={fotoUrl}
              imagemUrl={i === 0 ? imagemUrl : undefined} rotulo={varios || q.lamina ? (q.lamina === 1 ? tr('aprov.capa') : tr('aprov.lamina-n', { n: q.lamina || i + 1 })) : ''} />
          ))}
        </div>
        {nav.rola && nav.voltar && (
          <button type="button" onClick={() => andar(-1)} aria-label={tr('aprov.lamina-anterior')} title={tr('aprov.lamina-anterior')} style={seta('voltar')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
        )}
        {nav.rola && nav.avancar && (
          <button type="button" onClick={() => andar(1)} aria-label={tr('aprov.proxima-lamina')} title={tr('aprov.proxima-lamina')} style={seta('avancar')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        )}
      </div>
      {nav.rola && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {previa.quadros.map((_, i) => (
              <button key={i} type="button" onClick={() => irPara(i)} aria-label={i === 0 ? tr('aprov.capa') : tr('aprov.lamina-n', { n: i + 1 })}
                style={{ width: i === nav.atual ? 18 : 7, height: 7, borderRadius: 999, border: 'none', padding: 0, cursor: 'pointer', background: i === nav.atual ? 'var(--v2-ink)' : 'var(--v2-rule2, #cfc8b8)', transition: 'width .15s' }} />
            ))}
          </div>
          <span style={{ fontSize: 10.5, color: 'var(--v2-ink3)' }}>{tr('aprov.n-laminas-role', { n: total })}</span>
        </div>
      )}
      {previa.roteiro && (
        <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--v2-surface1)', border: '1px solid var(--v2-rule)' }}>
          <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 800, color: 'var(--v2-ink3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{tr('aprov.roteiro-video')}</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--v2-ink)', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{previa.roteiro}</p>
        </div>
      )}
    </div>
  )
}

function QuadroArte({ q, proporcao, largura, cor, fotoUrl, imagemUrl, rotulo }: {
  q: Quadro; proporcao: string; largura: number; cor: string; fotoUrl?: string; imagemUrl?: string; rotulo: string
}) {
  const tr = useT()
  const s = escalaDoQuadro(q) * (largura / 210) // letra acompanha o tamanho do quadro
  const px = (n: number) => `${Math.round(n * s * 10) / 10}px`
  const temTexto = !!(q.titulo || q.subtitulo || q.linhas.length || q.cta)

  return (
    <div style={{ flex: '0 0 auto', width: largura, scrollSnapAlign: 'start' }}>
      {/* A peça: proporção do formato como MÍNIMO — texto demais estica o quadro em vez de cortar */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: proporcao, background: '#ffffff', color: TINTA, borderRadius: 10, border: '1px solid #e7e2d6', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', padding: `${Math.round(largura * 0.075)}px`, boxSizing: 'border-box', gap: px(6), fontFamily: 'var(--v2-font, inherit)' }}>
        {/* faixa da marca + logo */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: cor, borderRadius: '10px 10px 0 0' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, minHeight: 16 }}>
          {fotoUrl
            ? <img src={fotoUrl} alt="" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover', border: '1px solid #eee', flexShrink: 0 }} />
            : <span style={{ width: 18, height: 18, borderRadius: '50%', background: cor, flexShrink: 0 }} />}
          {rotulo && <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#9a9384' }}>{rotulo}</span>}
        </div>

        {q.titulo && <p style={{ margin: 0, fontSize: px(19), fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.01em', wordBreak: 'break-word' }}>{q.titulo}</p>}
        {q.subtitulo && <p style={{ margin: 0, fontSize: px(12), fontWeight: 600, lineHeight: 1.3, color: '#4b463c', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{q.subtitulo}</p>}
        {q.linhas.map((l, i) => l.tipo === 'nota' ? (
          <p key={i} title={tr('aprov.nota-producao')} style={{ margin: 0, fontSize: px(9), fontStyle: 'italic', lineHeight: 1.3, color: '#8a6d1f', border: '1px dashed #d8c38a', borderRadius: 5, padding: `${px(3)} ${px(5)}`, background: '#fffaf0' }}>
            {tr('aprov.nota-producao')}: {l.texto}
          </p>
        ) : (
          <p key={i} style={{ margin: 0, fontSize: l.tipo === 'destaque' ? px(14) : px(10.5), fontWeight: l.tipo === 'destaque' ? 800 : 400, lineHeight: l.tipo === 'destaque' ? 1.18 : 1.35, color: l.tipo === 'destaque' ? TINTA : '#3a362e', wordBreak: 'break-word' }}>{l.texto}</p>
        ))}
        {!temTexto && <p style={{ margin: 0, fontSize: px(10), color: '#b3ac9c', fontStyle: 'italic' }}>{tr('aprov.sem-texto-arte-veja-legenda-ao')}</p>}

        {/* Espaço da imagem: ocupa o que sobra do quadro */}
        <div style={{ flex: '1 1 auto', minHeight: '22%', marginTop: px(2), borderRadius: 7, overflow: 'hidden', position: 'relative',
          background: imagemUrl ? '#f2efe8' : 'repeating-linear-gradient(135deg, #f4f1ea 0 7px, #ece8de 7px 14px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {imagemUrl
            ? <img src={imagemUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 8.5, fontWeight: 700, color: '#a39c8b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.5-3.5L11 18" /></svg>
                {tr('aprov.imagem-arte')}
              </span>}
        </div>

        {q.cta && (
          <span style={{ alignSelf: 'flex-start', background: cor, color: textoSobre(cor), fontSize: px(10.5), fontWeight: 800, borderRadius: 999, padding: `${px(5)} ${px(11)}`, lineHeight: 1.2, wordBreak: 'break-word' }}>{q.cta}</span>
        )}
      </div>
    </div>
  )
}
