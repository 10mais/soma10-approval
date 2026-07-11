// Integração com o Nano Banana 2 (Google Gemini 3.1 Flash Image) — gerador de
// CENÁRIO/foto do motor de criativos. Diferenciais sobre o Ideogram: aceita
// FOTOS REAIS da marca como referência (a cena sai com a cara do cliente),
// aspect 4:5 nativo do feed e edição por instrução. No-op sem credencial
// (mesmo padrão do WhatsApp/Ideogram/Stripe): liga quando o dono provê
// GEMINI_API_KEY na Vercel. Docs: ai.google.dev/gemini-api/docs/image-generation

export function nanoBananaConfigurado(): boolean {
  return !!process.env.GEMINI_API_KEY?.trim()
}

export type RefImagem = { mime: string; base64: string }
type ResultadoNano = { base64: string; mime: string } | { erro: string }

const MODELO_PADRAO = 'gemini-3.1-flash-image' // Nano Banana 2 (override: GEMINI_IMAGE_MODEL)

// Gera uma imagem a partir de um prompt + (opcional) imagens de referência da
// marca. Devolve os bytes em base64 direto (sem URL temporária).
export async function gerarFotoNanoBanana(
  prompt: string,
  opts?: { referencias?: RefImagem[]; aspectRatio?: string; model?: string }
): Promise<ResultadoNano> {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) return { erro: 'Nano Banana não configurado (GEMINI_API_KEY).' }
  const p = (prompt || '').trim()
  if (!p) return { erro: 'Prompt vazio.' }

  const model = opts?.model || process.env.GEMINI_IMAGE_MODEL?.trim() || MODELO_PADRAO
  // Referências primeiro, texto por último (padrão recomendado p/ multi-imagem).
  const parts: any[] = (opts?.referencias || []).slice(0, 6).map(r => ({
    inline_data: { mime_type: r.mime, data: r.base64 },
  }))
  parts.push({ text: p })

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio: opts?.aspectRatio || '4:5' }, // feed nativo
        },
      }),
    })
    if (!r.ok) {
      const t = await r.text().catch(() => '')
      return { erro: `Nano Banana ${r.status}: ${t.slice(0, 240) || 'erro'}` }
    }
    const j: any = await r.json().catch(() => null)
    if (j?.promptFeedback?.blockReason) {
      return { erro: `Nano Banana bloqueou o prompt (${j.promptFeedback.blockReason}).` }
    }
    const partsResp: any[] = j?.candidates?.[0]?.content?.parts || []
    const img = partsResp.find(pt => pt?.inlineData?.data || pt?.inline_data?.data)
    const data = img?.inlineData?.data || img?.inline_data?.data
    const mime = img?.inlineData?.mimeType || img?.inline_data?.mime_type || 'image/png'
    if (!data) return { erro: 'Nano Banana não retornou imagem.' }
    return { base64: data, mime }
  } catch (e: any) {
    return { erro: `Falha Nano Banana: ${e?.message || 'desconhecido'}` }
  }
}
