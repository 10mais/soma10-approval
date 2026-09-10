import { describe, it, expect } from 'vitest'
import { ehImagem, ehVideo, ehMidia, rotuloArquivo } from '@/lib/anexoMidia'

describe('anexoMidia — a pergunta "isto é imagem?" nunca pode explodir', () => {
  it('anexo SEM tipo não lança e ainda é reconhecido pela extensão (o bug de 10/09)', () => {
    expect(() => ehImagem({ nome: 'antigo.png', url: 'https://x/antigo.png' })).not.toThrow()
    expect(ehImagem({ url: 'https://x/antigo.png' })).toBe(true)
    expect(ehVideo({ url: 'https://x/filme.MP4?v=2' })).toBe(true)
    expect(ehImagem(undefined)).toBe(false)
    expect(ehVideo(null)).toBe(false)
    expect(ehImagem({})).toBe(false)
    expect(ehImagem({ tipo: undefined as any, url: undefined as any })).toBe(false)
  })

  it('quando o tipo existe, é ele que manda', () => {
    expect(ehImagem({ tipo: 'image/png', url: 'https://x/sem-extensao' })).toBe(true)
    expect(ehVideo({ tipo: 'video/quicktime', url: 'https://x/sem-extensao' })).toBe(true)
    expect(ehImagem({ tipo: 'application/pdf', url: 'https://x/relatorio.png' })).toBe(false)
    expect(ehMidia({ tipo: 'application/pdf' })).toBe(false)
    expect(ehMidia({ tipo: 'video/mp4' })).toBe(true)
  })

  it('rótulo do que não é mídia: pelo tipo, senão pela extensão do nome', () => {
    expect(rotuloArquivo({ tipo: 'application/pdf' })).toBe('PDF')
    expect(rotuloArquivo({ tipo: 'audio/mpeg' })).toBe('Áudio')
    expect(rotuloArquivo({ tipo: 'application/vnd.ms-excel' })).toBe('Planilha')
    expect(rotuloArquivo({ nome: 'contrato.docx' })).toBe('DOCX')
    expect(rotuloArquivo({ nome: 'sem-ponto' })).toBe('Arquivo')
    expect(rotuloArquivo(undefined)).toBe('Arquivo')
  })
})
