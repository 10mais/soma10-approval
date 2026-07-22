// Exportar mapa mental — só no navegador (usa Image/canvas/download).
//
// Três formatos, todos abríveis por um cliente sem conta no sistema:
// - SVG: vetor, abre em qualquer navegador, nunca perde nitidez.
// - PNG: imagem, cola em qualquer lugar (WhatsApp, e-mail, slide).
// - PDF: uma página, com a imagem encaixada — o formato que cliente espera.
//
// O SVG vem de lib/mapaSvg (puro/testado); aqui é só a parte de I/O do browser,
// que teste de unidade não alcança.

import { mapaParaSvg, type MapaParaSvg } from './mapaSvg'

function baixar(url: string, nome: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function nomeArquivo(mapa: MapaParaSvg, ext: string): string {
  const base = (mapa.titulo || 'mapa-mental').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // tira acentos
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'mapa-mental'
  return `${base}.${ext}`
}

export function exportarSvg(mapa: MapaParaSvg) {
  const svg = mapaParaSvg(mapa)
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  baixar(url, nomeArquivo(mapa, 'svg'))
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

// SVG -> PNG via Image + canvas. escala>1 aumenta a resolução (impressão/retina).
// Rejeita se a imagem não carregar, para o chamador poder avisar em vez de
// baixar um arquivo vazio.
async function rasterizar(mapa: MapaParaSvg, escala = 2): Promise<{ dataUrl: string; w: number; h: number }> {
  const svg = mapaParaSvg(mapa)
  const m = svg.match(/width="(\d+)" height="(\d+)"/)
  const w = m ? Number(m[1]) : 800
  const h = m ? Number(m[2]) : 600
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Falha ao renderizar o mapa.'))
      img.src = svgUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(w * escala)
    canvas.height = Math.round(h * escala)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas indisponível neste navegador.')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return { dataUrl: canvas.toDataURL('image/png'), w, h }
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

export async function exportarPng(mapa: MapaParaSvg) {
  const { dataUrl } = await rasterizar(mapa, 2)
  baixar(dataUrl, nomeArquivo(mapa, 'png'))
}

export async function exportarPdf(mapa: MapaParaSvg) {
  const { dataUrl, w, h } = await rasterizar(mapa, 2)
  const { default: jsPDF } = await import('jspdf')
  // Orientação segue o formato do mapa: mapa largo = paisagem.
  const paisagem = w >= h
  const doc = new jsPDF({ orientation: paisagem ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margem = 28
  // Encaixa mantendo proporção, sem esticar.
  const escala = Math.min((pageW - margem * 2) / w, (pageH - margem * 2) / h)
  const iw = w * escala, ih = h * escala
  doc.addImage(dataUrl, 'PNG', (pageW - iw) / 2, (pageH - ih) / 2, iw, ih)
  doc.save(nomeArquivo(mapa, 'pdf'))
}
