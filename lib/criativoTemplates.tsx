import type { ReactElement } from 'react'

// ===== Motor de criativos do Studio (Track 1 — template de marca) =====
// Templates branded renderizados com @vercel/og (Satori). Formato feed 4:5 (1080x1350).
// A IA (art direction) escolhe o template e preenche os textos; as CORES e o LOGO
// vêm do cadastro do cliente. Satori exige display:flex em todo container com filhos.

export const LARGURA = 1080
export const ALTURA = 1350

export type DadosCriativo = {
  template: 'capa' | 'dica' | 'citacao' | 'dado' | 'foto'
  headline?: string
  subheadline?: string
  bullets?: string[]
  rodape?: string
  corFundo: string
  corTexto: string
  corAccent: string
  logo?: string
  handle?: string
  fundo?: string // URL de uma FOTO da marca usada como fundo (template "foto")
}

// Luminância relativa -> escolhe texto claro/escuro sobre a cor de fundo.
export function contraste(hex?: string): string {
  const h = (hex || '').replace('#', '')
  if (h.length !== 6) return '#ffffff'
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#111111' : '#ffffff'
}

// Carrega as fontes uma vez (cache de módulo). Busca do próprio /public (sempre servido).
let cacheFontes: any[] | null = null
export async function carregarFontes(baseUrl: string) {
  if (cacheFontes) return cacheFontes
  const base = baseUrl.replace(/\/$/, '')
  const arquivos: [string, number][] = [['Poppins-Regular', 400], ['Poppins-SemiBold', 600], ['Poppins-Bold', 700]]
  const fontes = await Promise.all(arquivos.map(async ([arq, weight]) => {
    const data = await fetch(`${base}/fonts/${arq}.ttf`).then(r => r.arrayBuffer())
    return { name: 'Poppins', data, weight, style: 'normal' as const }
  }))
  cacheFontes = fontes
  return fontes
}

function Cabecalho({ d }: { d: DadosCriativo }) {
  if (!d.logo) return <div style={{ display: 'flex', height: 8 }} />
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <img src={d.logo} width={110} height={110} style={{ objectFit: 'contain', borderRadius: 16 }} />
    </div>
  )
}

function Rodape({ d }: { d: DadosCriativo }) {
  const texto = d.rodape || d.handle || ''
  if (!texto) return <div style={{ display: 'flex', height: 8 }} />
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <div style={{ display: 'flex', width: 40, height: 6, borderRadius: 3, background: d.corAccent, marginRight: 18 }} />
      <span style={{ fontSize: 30, fontWeight: 600, opacity: 0.85 }}>{texto}</span>
    </div>
  )
}

// Monta o elemento do criativo conforme o template escolhido pela IA.
export function montarCriativo(d: DadosCriativo): ReactElement {
  // Template FOTO — usa uma foto da marca como fundo, com texto por cima e scrim.
  if (d.template === 'foto' && d.fundo) {
    return (
      <div style={{ width: LARGURA, height: ALTURA, display: 'flex', position: 'relative', fontFamily: 'Poppins' }}>
        <img src={d.fundo} width={LARGURA} height={ALTURA} style={{ position: 'absolute', top: 0, left: 0, width: LARGURA, height: ALTURA, objectFit: 'cover' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: LARGURA, height: ALTURA, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 88, background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.18) 48%, rgba(0,0,0,0.32) 100%)', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {d.logo ? <img src={d.logo} width={104} height={104} style={{ objectFit: 'contain' }} /> : <div style={{ display: 'flex', height: 8 }} />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 80, fontWeight: 700, lineHeight: 1.06 }}>{d.headline || ''}</span>
            {d.subheadline ? <span style={{ fontSize: 38, fontWeight: 400, opacity: 0.92, marginTop: 26 }}>{d.subheadline}</span> : null}
            {(d.rodape || d.handle) ? (
              <div style={{ display: 'flex', alignItems: 'center', marginTop: 34 }}>
                <div style={{ display: 'flex', width: 40, height: 6, borderRadius: 3, background: d.corAccent, marginRight: 18 }} />
                <span style={{ fontSize: 30, fontWeight: 600 }}>{d.rodape || d.handle}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  const base: any = {
    width: LARGURA, height: ALTURA, display: 'flex', flexDirection: 'column',
    justifyContent: 'space-between', padding: 88, background: d.corFundo, color: d.corTexto,
    fontFamily: 'Poppins',
  }

  let miolo: ReactElement

  if (d.template === 'dica') {
    miolo = (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignSelf: 'flex-start', background: d.corAccent, color: contraste(d.corAccent), fontSize: 26, fontWeight: 700, letterSpacing: 2, padding: '10px 22px', borderRadius: 999, marginBottom: 34 }}>
          {(d.subheadline || 'DICA').toUpperCase()}
        </div>
        <span style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1, marginBottom: 40 }}>{d.headline || ''}</span>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {(d.bullets || []).slice(0, 4).map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 22 }}>
              <div style={{ display: 'flex', width: 16, height: 16, borderRadius: 8, background: d.corAccent, marginTop: 12, marginRight: 20 }} />
              <span style={{ fontSize: 38, fontWeight: 400, lineHeight: 1.25, flex: 1 }}>{b}</span>
            </div>
          ))}
        </div>
      </div>
    )
  } else if (d.template === 'citacao') {
    miolo = (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
        <span style={{ display: 'flex', fontSize: 160, fontWeight: 700, lineHeight: 0.8, color: d.corAccent, marginBottom: 10 }}>“</span>
        <span style={{ fontSize: 66, fontWeight: 600, lineHeight: 1.15 }}>{d.headline || ''}</span>
        {d.subheadline ? <span style={{ fontSize: 34, fontWeight: 400, opacity: 0.8, marginTop: 30 }}>{d.subheadline}</span> : null}
      </div>
    )
  } else if (d.template === 'dado') {
    miolo = (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
        <span style={{ fontSize: 200, fontWeight: 700, lineHeight: 0.95, color: d.corAccent }}>{d.headline || ''}</span>
        <span style={{ fontSize: 48, fontWeight: 600, lineHeight: 1.2, marginTop: 24 }}>{d.subheadline || ''}</span>
      </div>
    )
  } else {
    // capa (padrão)
    miolo = (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
        <span style={{ fontSize: 82, fontWeight: 700, lineHeight: 1.08 }}>{d.headline || ''}</span>
        {d.subheadline ? <span style={{ fontSize: 40, fontWeight: 400, opacity: 0.85, marginTop: 32 }}>{d.subheadline}</span> : null}
      </div>
    )
  }

  return (
    <div style={base}>
      <Cabecalho d={d} />
      {miolo}
      <Rodape d={d} />
    </div>
  )
}
