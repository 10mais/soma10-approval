// Mídia de POST no navegador, antes de subir ao Blob. Só roda no navegador.
//
// comprimirImagem: imagens grandes ficam com no máx. 1920px no lado maior, em JPEG e abaixo de
// 8 MB (limite de 10 MB do Instagram/Facebook). Imagem pequena e GIF passam como estão. É a
// mesma regra do "Novo post" (PostComposer) — a subida em massa comprime igual.
// (lib/comprimirImagem é outra coisa: prints do Assistente IA, com alvo menor.)
//
// capaDoVideoLocal: a capa do vídeo tirada do próprio arquivo, sem esbarrar em CORS.

export async function comprimirImagem(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || /gif/i.test(file.type)) return file
  if (file.size < 1.2 * 1024 * 1024) return file
  try {
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file)
    })
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = dataUrl
    })
    const LIMITE = 8 * 1024 * 1024
    let maxLado = 1920
    let qualidade = 0.9
    let melhor: Blob | null = null
    for (let tentativa = 0; tentativa < 6; tentativa++) {
      let { width, height } = img
      if (Math.max(width, height) > maxLado) {
        const esc = maxLado / Math.max(width, height)
        width = Math.round(width * esc); height = Math.round(height * esc)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext('2d'); if (!ctx) return file
      ctx.drawImage(img, 0, 0, width, height)
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(b => r(b), 'image/jpeg', qualidade))
      if (!blob) break
      melhor = blob
      if (blob.size <= LIMITE) break
      qualidade = Math.max(0.5, qualidade - 0.15)
      maxLado = Math.round(maxLado * 0.85)
    }
    if (!melhor || melhor.size >= file.size) return file
    return new File([melhor], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
  } catch { return file }
}

/** Um quadro perto de 1 s do vídeo, em JPEG. null quando o navegador não consegue ler o vídeo
 *  (ex.: .mov HEVC no Chrome do Windows) — aí a capa é escolhida à mão. */
export async function capaDoVideoLocal(file: File): Promise<Blob | null> {
  if (typeof document === 'undefined') return null
  const url = URL.createObjectURL(file)
  const v = document.createElement('video')
  try {
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url
    await new Promise<void>((res, rej) => {
      const t = setTimeout(() => rej(new Error('tempo')), 15000)
      v.onloadeddata = () => { clearTimeout(t); res() }
      v.onerror = () => { clearTimeout(t); rej(new Error('video')) }
    })
    const alvo = Math.min(1, (isFinite(v.duration) && v.duration > 0 ? v.duration : 3) / 3)
    await new Promise<void>(res => {
      const t = setTimeout(res, 4000)
      v.onseeked = () => { clearTimeout(t); res() }
      v.currentTime = alvo
    })
    if (!v.videoWidth || !v.videoHeight) return null
    const c = document.createElement('canvas')
    c.width = v.videoWidth; c.height = v.videoHeight
    const ctx = c.getContext('2d'); if (!ctx) return null
    ctx.drawImage(v, 0, 0, c.width, c.height)
    return await new Promise<Blob | null>(r => c.toBlob(b => r(b), 'image/jpeg', 0.9))
  } catch {
    return null
  } finally {
    v.removeAttribute('src'); v.load()
    URL.revokeObjectURL(url)
  }
}
