import { describe, it, expect } from 'vitest'
import {
  tituloDoPost, descricaoDoPost, tagsDoPost, formatoDaMidia, privacidadeDoPost,
  pendenciasYouTube, corpoDoUpload, linkDoVideo, LIMITE_TITULO, LIMITE_DESCRICAO,
} from '@/lib/youtubePost'

const AGORA = new Date('2026-09-27T10:00:00.000-03:00')

describe('YouTube — título, descrição e tags', () => {
  it('usa o que a equipe escreveu; sem isso, a headline; sem ela, a primeira linha da legenda', () => {
    expect(tituloDoPost({ youtubeTitulo: 'Escrito à mão', headline: 'Headline', legenda: 'Legenda' })).toBe('Escrito à mão')
    expect(tituloDoPost({ headline: 'A dor que ninguém conta', legenda: 'Legenda' })).toBe('A dor que ninguém conta')
    expect(tituloDoPost({ legenda: '  \n Primeira linha\nsegunda linha' })).toBe('Primeira linha')
    expect(tituloDoPost({ clienteNome: 'Clínica Norah' })).toBe('Clínica Norah')
  })

  it('título nunca volta vazio — vídeo sem título é recusado pela API', () => {
    expect(tituloDoPost({})).toBe('Vídeo')
    expect(tituloDoPost({ legenda: '   ' })).toBe('Vídeo')
  })

  it('corta no limite do YouTube e tira os sinais que ele recusa', () => {
    const longo = 'a'.repeat(140)
    const t = tituloDoPost({ youtubeTitulo: longo })
    expect(t.length).toBe(LIMITE_TITULO)
    expect(t.endsWith('…')).toBe(true)
    expect(tituloDoPost({ youtubeTitulo: 'Antes <b>depois</b>' })).toBe('Antes bdepois/b')
    expect(descricaoDoPost({ legenda: 'x'.repeat(LIMITE_DESCRICAO + 500) }).length).toBe(LIMITE_DESCRICAO)
  })

  it('hashtags da legenda viram tags, sem repetir e sem estourar 500 caracteres', () => {
    expect(tagsDoPost({ legenda: 'Antes e depois #harmonizacao #estetica #Harmonizacao' })).toEqual(['harmonizacao', 'estetica'])
    expect(tagsDoPost({ youtubeTags: ['clinica'], legenda: '#clinica #botox' })).toEqual(['clinica', 'botox'])
    const muitas = Array.from({ length: 40 }, (_, i) => `#tagmuitogrande${i}`).join(' ')
    const tags = tagsDoPost({ legenda: muitas })
    expect(tags.join(',').length).toBeLessThanOrEqual(500)
  })
})

describe('YouTube — Short é o mesmo upload, o arquivo é que decide', () => {
  it('vertical e até 3 minutos = Short', () => {
    expect(formatoDaMidia({ url: 'a.mp4', largura: 1080, altura: 1920, duracaoS: 45 })).toBe('short')
    expect(formatoDaMidia({ url: 'a.mp4', largura: 1080, altura: 1920, duracaoS: 200 })).toBe('video')
    expect(formatoDaMidia({ url: 'a.mp4', largura: 1920, altura: 1080, duracaoS: 30 })).toBe('video')
    expect(formatoDaMidia(null)).toBe('video')
  })

  it('sem saber a duração, trata como vídeo comum (não promete Short que não é)', () => {
    expect(formatoDaMidia({ url: 'a.mp4', largura: 1080, altura: 1920 })).toBe('video')
  })

  it('o link do Short é diferente do link do vídeo', () => {
    expect(linkDoVideo('abc123', 'short')).toBe('https://www.youtube.com/shorts/abc123')
    expect(linkDoVideo('abc123')).toBe('https://www.youtube.com/watch?v=abc123')
  })
})

describe('YouTube — agendamento é do próprio YouTube', () => {
  it('data no futuro sobe privado com publishAt', () => {
    const r = privacidadeDoPost({ dataAgendada: '2026-10-01T09:00:00.000-03:00' }, AGORA)
    expect(r.privacyStatus).toBe('private')
    expect(r.publishAt).toBe(new Date('2026-10-01T09:00:00.000-03:00').toISOString())
  })

  it('sem data, ou data já passada, publica na hora', () => {
    expect(privacidadeDoPost({}, AGORA)).toEqual({ privacyStatus: 'public' })
    expect(privacidadeDoPost({ dataAgendada: '2026-09-01T09:00:00.000-03:00' }, AGORA)).toEqual({ privacyStatus: 'public' })
    expect(privacidadeDoPost({ dataAgendada: 'data torta' }, AGORA)).toEqual({ privacyStatus: 'public' })
  })
})

describe('YouTube — o que falta para poder subir', () => {
  const video = { url: 'v.mp4', duracaoS: 60, largura: 1080, altura: 1920 }

  it('post sem vídeo não sobe', () => {
    expect(pendenciasYouTube({ legenda: 'oi' }, [])).toContain('sem-video')
  })

  it('dois vídeos no mesmo post: o YouTube publica UM por vez', () => {
    expect(pendenciasYouTube({ legenda: 'oi' }, [video, { url: 'w.mp4' }])).toContain('varios-videos')
  })

  it('vídeo acima de 12 horas é recusado pelo YouTube', () => {
    expect(pendenciasYouTube({ legenda: 'oi' }, [{ url: 'v.mp4', duracaoS: 13 * 3600 }])).toContain('video-muito-longo')
  })

  it('post pronto não tem pendência', () => {
    expect(pendenciasYouTube({ legenda: 'Antes e depois', headline: 'Resultado real' }, [video])).toEqual([])
  })
})

describe('YouTube — corpo do upload', () => {
  it('monta snippet e status prontos para o videos.insert', () => {
    const c = corpoDoUpload({ headline: 'Resultado real', legenda: 'Veja o antes e depois #estetica', dataAgendada: '2026-10-01T09:00:00.000-03:00' }, AGORA)
    expect(c.snippet.title).toBe('Resultado real')
    expect(c.snippet.description).toBe('Veja o antes e depois #estetica')
    expect(c.snippet.tags).toEqual(['estetica'])
    expect(c.status.privacyStatus).toBe('private')
    expect(c.status.publishAt).toBeTruthy()
    expect(c.status.selfDeclaredMadeForKids).toBe(false)
  })
})
