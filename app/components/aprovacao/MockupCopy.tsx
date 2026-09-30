'use client'
// PRÉVIA DA ARTE (mockup) da copy em aprovação — dono, 30/09: "precisa retratar a dimensão
// exata da headline (maior), subheadline (secundária) e demais textos na tela. Como se fosse
// um mockup. Quase que um criativo final, porém com versão de amostra de disposição de
// espaços." A regra do que entra em cada quadro é de lib/mockupCopy (testada); aqui é o desenho.
//
// A arte fica em "papel" branco nos dois temas: é a representação da peça, não um painel da
// tela. Espaço da imagem hachurado (ou a foto, quando o post já tem uma), CTA como botão na
// cor da marca, logo do cliente no canto, carrossel com um quadro por lâmina lado a lado.
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
  const varios = previa.quadros.length > 1

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: varios ? 6 : 0, scrollSnapType: varios ? 'x mandatory' : undefined, alignItems: 'flex-start' }}>
        {previa.quadros.map((q, i) => (
          <QuadroArte key={i} q={q} proporcao={previa.proporcao} largura={w} cor={cor} fotoUrl={fotoUrl}
            imagemUrl={i === 0 ? imagemUrl : undefined} rotulo={varios || q.lamina ? (q.lamina === 1 ? tr('aprov.capa') : tr('aprov.lamina-n', { n: q.lamina || i + 1 })) : ''} />
        ))}
      </div>
      {previa.quadros.length > 2 && <p style={{ margin: '4px 0 0', fontSize: 10.5, color: 'var(--v2-ink3)' }}>{tr('aprov.n-laminas-role', { n: previa.quadros.length })}</p>}
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
