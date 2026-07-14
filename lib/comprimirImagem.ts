// Compressão de imagem no NAVEGADOR (canvas → JPEG) para anexos leves.
// Usada pelos prints do Assistente IA: reduz screenshots de conversa antes do
// upload ao Blob, mantendo o texto legível para a visão do modelo.
// (O PostComposer tem a própria versão, com alvos das redes sociais.)

export async function comprimirImagemChat(file: File): Promise<File> {
  if (typeof document === 'undefined') return file
  if (!file.type.startsWith('image/') || /gif/i.test(file.type)) return file
  if (file.size < 600 * 1024) return file // já é leve
  try {
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file)
    })
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = dataUrl
    })
    const LIMITE = 2.5 * 1024 * 1024 // prints não precisam de mais que isso
    let maxLado = 1600 // preserva legibilidade do texto do print
    let qualidade = 0.85
    let melhor: Blob | null = null
    for (let tentativa = 0; tentativa < 5; tentativa++) {
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
      qualidade = Math.max(0.55, qualidade - 0.12)
      maxLado = Math.round(maxLado * 0.85)
    }
    if (!melhor || melhor.size >= file.size) return file
    return new File([melhor], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
  } catch { return file }
}
