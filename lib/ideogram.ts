// Integração com Ideogram (Track 2 do motor de criativos): foto/arte realista
// gerada por IA. No-op sem credenciais (igual ao scaffold do WhatsApp): a feature
// só liga quando o dono provê IDEOGRAM_API_KEY na Vercel.
// Docs: https://developer.ideogram.ai — endpoint /generate (modelo V_2).

export function ideogramConfigurado(): boolean {
  return !!process.env.IDEOGRAM_API_KEY?.trim()
}

type ResultadoIdeogram = { url: string } | { erro: string }

// Gera uma imagem a partir de um prompt textual. Retorna a URL temporária do
// Ideogram (o chamador deve baixar e re-hospedar no Blob). `resolution` tem
// prioridade sobre `aspectRatio` quando ambos são passados.
export async function gerarFotoIdeogram(
  prompt: string,
  opts?: { aspectRatio?: string; resolution?: string; model?: string; magic?: 'AUTO' | 'ON' | 'OFF' }
): Promise<ResultadoIdeogram> {
  const key = process.env.IDEOGRAM_API_KEY?.trim()
  if (!key) return { erro: 'Ideogram não configurado (IDEOGRAM_API_KEY).' }
  const p = (prompt || '').trim()
  if (!p) return { erro: 'Prompt vazio.' }
  try {
    const image_request: any = {
      prompt: p.slice(0, 1000),
      model: opts?.model || 'V_2',
      magic_prompt_option: opts?.magic || 'AUTO',
    }
    // O Ideogram (V_2) NÃO aceita ASPECT_4_5. O portrait válido mais próximo do
    // feed (4:5) é ASPECT_3_4 — o editor visual normaliza pra 1080x1350 depois.
    if (opts?.resolution) image_request.resolution = opts.resolution
    else image_request.aspect_ratio = opts?.aspectRatio || 'ASPECT_3_4'

    const r = await fetch('https://api.ideogram.ai/generate', {
      method: 'POST',
      headers: { 'Api-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_request }),
    })
    if (!r.ok) {
      const t = await r.text().catch(() => '')
      return { erro: `Ideogram ${r.status}: ${t.slice(0, 240) || 'erro'}` }
    }
    const j: any = await r.json().catch(() => null)
    const url = j?.data?.[0]?.url
    if (!url) return { erro: 'Ideogram não retornou imagem.' }
    return { url }
  } catch (e: any) {
    return { erro: `Falha Ideogram: ${e?.message || 'desconhecido'}` }
  }
}
