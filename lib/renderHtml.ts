// Motor de rasterização de HTML -> PNG via Chrome headless.
// É a base do novo motor de criativos: o Claude desenha um HTML/CSS autocontido
// (fonte + cores + elementos da marca) e este módulo transforma em imagem.
//
// Abstração com 2 backends intercambiáveis por env (isola o maior risco — Chromium
// no serverless):
//   (A) @sparticuz/chromium + puppeteer-core  — self-contained, sem custo por render (padrão)
//   (B) API hospedada de HTML->imagem          — se RENDER_HTML_ENDPOINT estiver setado
// Em dev local (Windows/Mac), aponte LOCAL_CHROME_PATH para um Chrome instalado.
//
// O HTML JÁ vem com fontes/imagens embutidas em base64 (o Blob é privado; o Chrome
// não alcança por URL) — este módulo não toca no Blob.

export type TamanhoRender = { largura: number; altura: number }

// Backend (B): serviço externo (Browserless/ScreenshotOne/etc.). Contrato mínimo:
// POST { html, width, height } -> PNG binário. Ajustável quando/se for adotado.
async function renderViaHospedado(html: string, tam: TamanhoRender, endpoint: string): Promise<Buffer> {
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.RENDER_HTML_TOKEN ? { Authorization: `Bearer ${process.env.RENDER_HTML_TOKEN}` } : {}),
    },
    body: JSON.stringify({ html, width: tam.largura, height: tam.altura }),
  })
  if (!r.ok) throw new Error(`render hospedado ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`)
  return Buffer.from(await r.arrayBuffer())
}

// Backend (A): Chromium headless. Em prod usa @sparticuz/chromium (Linux/Vercel);
// em dev local usa o Chrome do sistema via LOCAL_CHROME_PATH.
async function renderViaChromium(html: string, tam: TamanhoRender): Promise<Buffer> {
  const puppeteer = await import('puppeteer-core')
  const viewport = { width: tam.largura, height: tam.altura, deviceScaleFactor: 1 }

  const local = process.env.LOCAL_CHROME_PATH?.trim()
  let launchOpts: any
  if (local) {
    launchOpts = {
      executablePath: local,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: viewport,
    }
  } else {
    const chromium = (await import('@sparticuz/chromium')).default
    launchOpts = {
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
      defaultViewport: viewport,
    }
  }

  const browser = await puppeteer.launch(launchOpts)
  try {
    const page = await browser.newPage()
    await page.setViewport(viewport)
    // Fontes/imagens já são data-URIs; 'load' espera os recursos, e fonts.ready
    // garante que as @font-face embutidas assentaram antes do screenshot.
    await page.setContent(html, { waitUntil: 'load' })
    await page.evaluate(() => (document as any).fonts?.ready).catch(() => {})
    const buf = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: tam.largura, height: tam.altura },
    })
    return Buffer.from(buf)
  } finally {
    await browser.close().catch(() => {})
  }
}

// Rasteriza um HTML autocontido em PNG no tamanho pedido.
export async function renderHtmlToPng(html: string, tam: TamanhoRender): Promise<Buffer> {
  const endpoint = process.env.RENDER_HTML_ENDPOINT?.trim()
  if (endpoint) return renderViaHospedado(html, tam, endpoint)
  return renderViaChromium(html, tam)
}

// Qual backend está ativo (para diagnóstico na tela Saúde do sistema).
export function motorRenderAtivo(): 'hospedado' | 'chromium-local' | 'chromium' {
  if (process.env.RENDER_HTML_ENDPOINT?.trim()) return 'hospedado'
  if (process.env.LOCAL_CHROME_PATH?.trim()) return 'chromium-local'
  return 'chromium'
}
