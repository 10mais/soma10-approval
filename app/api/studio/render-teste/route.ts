import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { capturarErro } from '@/lib/erros'
import { renderHtmlToPng, motorRenderAtivo } from '@/lib/renderHtml'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Fase 0 — PROVA do motor de render (Chrome headless) em produção.
// Rasteriza um HTML branded fixo 1080x1350 e devolve base64. Serve só para o admin
// validar que o pipeline HTML->PNG funciona no ambiente (memória/cold start/fontes)
// ANTES de investir no motor de criativos de verdade.

const LARGURA = 1080
const ALTURA = 1350

// HTML de demonstração: exercita gradiente, flexbox, clamp() (auto-encaixe de texto),
// logo (SVG inline), scrim e área segura — tudo o que o Satori NÃO consegue hoje.
function htmlDemo(): string {
  const headline = 'Este texto é longo de propósito para provar que o layout NÃO estoura e a fonte encolhe sozinha'
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${LARGURA}px;height:${ALTURA}px}
  .canvas{position:relative;width:${LARGURA}px;height:${ALTURA}px;overflow:hidden;
    font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;
    background:linear-gradient(135deg,#101418 0%,#1d2733 55%,#0b0e12 100%)}
  .scrim{position:absolute;inset:0;background:radial-gradient(120% 80% at 80% 10%,rgba(255,192,15,.18),transparent 60%)}
  .safe{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;
    padding:96px;color:#fff}
  .logo{width:120px;height:120px;border-radius:24px;background:#ffc00f;color:#101418;
    display:flex;align-items:center;justify-content:center;font-weight:800;font-size:56px}
  .headline{font-size:clamp(48px,7vw,92px);font-weight:800;line-height:1.06;letter-spacing:-.5px;
    max-width:100%;overflow-wrap:break-word}
  .sub{margin-top:28px;font-size:36px;font-weight:400;opacity:.9;max-width:88%;line-height:1.35}
  .foot{display:flex;align-items:center;gap:18px}
  .bar{width:44px;height:6px;border-radius:3px;background:#ffc00f}
  .handle{font-size:32px;font-weight:600;opacity:.9}
  </style></head><body>
  <div class="canvas">
    <div class="scrim"></div>
    <div class="safe">
      <div class="logo">S10</div>
      <div>
        <div class="headline">${headline}</div>
        <div class="sub">Se você está lendo isto nítido, com margem e sem cortes — o motor novo funciona.</div>
      </div>
      <div class="foot"><div class="bar"></div><div class="handle">@soma10 · motor de render OK</div></div>
    </div>
  </div>
  </body></html>`
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }
  const t0 = Date.now()
  try {
    const png = await renderHtmlToPng(htmlDemo(), { largura: LARGURA, altura: ALTURA })
    return NextResponse.json({
      ok: true,
      motor: motorRenderAtivo(),
      ms: Date.now() - t0,
      bytes: png.length,
      imagemBase64: png.toString('base64'),
    })
  } catch (err: any) {
    await capturarErro('studio/render', err)
    return NextResponse.json(
      { error: `Falha ao renderizar: ${err?.message || 'erro'}`, motor: motorRenderAtivo() },
      { status: 500 },
    )
  }
}
