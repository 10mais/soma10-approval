import { describe, it, expect } from 'vitest'
import {
  ordenarPorNome, tipoDoArquivo, formatoPadrao, novoItem, motivoParaNaoJuntar, juntarEmCarrossel, separarCarrossel,
  moverMidia, moverItem, distribuirDatas, diaDaSemana, dividirLegendas, aplicarLegendas, contarHashtags, instanteDoItem,
  faltasDoItem, corpoDoPost, paraRascunho, deRascunho, type ItemLote, type MidiaLote,
} from '@/lib/subirEmMassa'

// Dono, 29/10/2026: "Preciso de uma opção de subir postagens em massa no programador de
// postagens. Subir criativos, reels, carrosseis, etc, preencher legendas separadas uma a uma,
// escolher dias e horários, marcar como colab em cada publicação".
const img = (id: string, extra: Partial<MidiaLote> = {}): MidiaLote => ({ id, nome: `${id}.jpg`, tipo: 'imagem', url: `https://b/${id}.jpg`, ...extra })
const vid = (id: string, extra: Partial<MidiaLote> = {}): MidiaLote => ({ id, nome: `${id}.mp4`, tipo: 'video', url: `https://b/${id}.mp4`, capa: `https://b/${id}-capa.jpg`, ...extra })
const item = (id: string, midias: MidiaLote[], extra: Partial<ItemLote> = {}): ItemLote => ({ ...novoItem(id, midias), ...extra })

describe('arquivos viram posts', () => {
  it('ordem natural do nome e tipo do arquivo', () => {
    expect(ordenarPorNome([{ name: '10.jpg' }, { name: '2.jpg' }, { name: '1.png' }]).map(a => a.name)).toEqual(['1.png', '2.jpg', '10.jpg'])
    expect(tipoDoArquivo('video/quicktime', 'a.mov')).toBe('video')
    expect(tipoDoArquivo('', 'arte.HEIC')).toBe('imagem')
    expect(tipoDoArquivo('application/pdf', 'a.pdf')).toBeNull()
  })

  it('vídeo sozinho começa como Reels; imagem e carrossel, como Feed', () => {
    expect(formatoPadrao([vid('v')])).toBe('reel')
    expect(formatoPadrao([img('a')])).toBe('feed')
    expect(formatoPadrao([img('a'), vid('v')])).toBe('feed')
  })
})

describe('carrossel', () => {
  const lista = [item('1', [img('a')], { legenda: '' }), item('2', [img('b')], { legenda: 'Legenda do 2', data: '2026-11-03', hora: '18:00', colaboradores: ['x'] }), item('3', [vid('c')], { colaboradores: ['y', 'x'] }), item('4', [img('d')])]

  it('junta os marcados no lugar do primeiro, na ordem da lista', () => {
    const r = juntarEmCarrossel(lista, ['3', '1', '2'])
    expect(r.map(i => i.id)).toEqual(['1', '4'])
    expect(r[0].midias.map(m => m.id)).toEqual(['a', 'b', 'c'])
    expect(r[0]).toMatchObject({ formato: 'feed', legenda: 'Legenda do 2', data: '2026-11-03', hora: '18:00', colaboradores: ['x', 'y'] })
  })

  it('não junta menos de 2 nem mais de 10 mídias', () => {
    expect(motivoParaNaoJuntar(lista, ['1'])).toMatch(/pelo menos 2/)
    const grandes = [item('g1', Array.from({ length: 6 }, (_, k) => img(`g1-${k}`))), item('g2', Array.from({ length: 5 }, (_, k) => img(`g2-${k}`)))]
    expect(motivoParaNaoJuntar(grandes, ['g1', 'g2'])).toMatch(/até 10/)
    expect(juntarEmCarrossel(grandes, ['g1', 'g2'])).toBe(grandes)
  })

  it('separar devolve um post por mídia; o primeiro fica com legenda e data', () => {
    let n = 0
    const junto = juntarEmCarrossel(lista, ['1', '2', '3'])
    const r = separarCarrossel(junto, '1', () => `novo${++n}`)
    expect(r.map(i => i.id)).toEqual(['1', 'novo1', 'novo2', '4'])
    expect(r[0]).toMatchObject({ legenda: 'Legenda do 2', formato: 'feed' })
    expect(r[2]).toMatchObject({ legenda: '', data: '', formato: 'reel' })
  })

  it('reordena mídias e posts', () => {
    const c = item('c', [img('a'), img('b'), img('c')])
    expect(moverMidia(c, 2, 0).midias.map(m => m.id)).toEqual(['c', 'a', 'b'])
    expect(moverItem(lista, 3, 0).map(i => i.id)).toEqual(['4', '1', '2', '3'])
    expect(moverItem(lista, 0, 9)).toBe(lista)
  })
})

describe('datas e legendas em lote', () => {
  const lista = [item('1', [img('a')]), item('2', [img('b')], { hora: '09:00' }), item('3', [img('c')]), item('4', [img('d')])]

  it('um post a cada N dias, a partir do dia escolhido', () => {
    const r = distribuirDatas(lista, [], { modo: 'dias', inicio: '2026-11-02', hora: '18:30', cadaDias: 2 })
    expect(r.map(i => `${i.data} ${i.hora}`)).toEqual(['2026-11-02 18:30', '2026-11-04 18:30', '2026-11-06 18:30', '2026-11-08 18:30'])
  })

  it('só em certos dias da semana (seg, qua, sex), sem mexer na hora se vier vazia', () => {
    expect(diaDaSemana('2026-11-02')).toBe(1) // segunda
    const r = distribuirDatas(lista, ['2', '3', '4'], { modo: 'semana', inicio: '2026-11-03', hora: '', diasDaSemana: [1, 3, 5] })
    expect(r.map(i => i.data)).toEqual(['', '2026-11-04', '2026-11-06', '2026-11-09'])
    expect(r[1].hora).toBe('09:00')
  })

  it('legendas coladas separadas por "---" vão na ordem, pulando Story', () => {
    const texto = 'Primeira legenda\n\ncom parágrafo\n---\nSegunda #tag\n  ---  \nTerceira\n---\n'
    expect(dividirLegendas(texto)).toEqual(['Primeira legenda\n\ncom parágrafo', 'Segunda #tag', 'Terceira'])
    expect(dividirLegendas('---\nSó uma')).toEqual(['Só uma'])
    const comStory = [lista[0], { ...lista[1], formato: 'story' as const }, lista[2]]
    const r = aplicarLegendas(comStory, ['A', 'B', 'C'])
    expect(r.usadas).toBe(2)
    expect(r.itens.map(i => i.legenda)).toEqual(['A', '', 'B'])
  })

  it('conta hashtags', () => {
    expect(contarHashtags('#a texto #b_c e email@x.com #1')).toBe(3)
  })
})

describe('o que falta e o corpo do post', () => {
  const AGORA = new Date(2026, 9, 29, 12, 0).getTime() // 29/10/2026 12h no fuso de quem roda
  const ok = item('1', [img('a')], { legenda: 'Oi', data: '2026-10-30', hora: '10:00' })

  it('agendar exige legenda, data futura e capa do vídeo; rascunho só a mídia pronta', () => {
    expect(faltasDoItem(ok, { acao: 'agendar', temMeta: true, agora: AGORA })).toEqual([])
    const vazio = item('2', [vid('v', { capa: undefined }), img('b', { url: undefined })])
    expect(faltasDoItem(vazio, { acao: 'agendar', temMeta: true, agora: AGORA })).toEqual(['enviando', 'legenda', 'capa', 'data'])
    expect(faltasDoItem(vazio, { acao: 'rascunho', temMeta: true, agora: AGORA })).toEqual(['enviando'])
    expect(faltasDoItem({ ...ok, data: '2026-10-29', hora: '12:03' }, { acao: 'aprovacao', temMeta: true, agora: AGORA })).toEqual(['data-passada'])
  })

  it('formato errado para a mídia é apontado', () => {
    expect(faltasDoItem({ ...ok, formato: 'story', midias: [img('a'), img('b')] }, { acao: 'rascunho', temMeta: true, agora: AGORA })).toEqual(['story-uma-midia'])
    expect(faltasDoItem({ ...ok, formato: 'reel' }, { acao: 'rascunho', temMeta: true, agora: AGORA })).toEqual(['reel-video'])
    expect(faltasDoItem({ ...ok, midias: [img('a', { erro: 'falhou' })] }, { acao: 'rascunho', temMeta: true, agora: AGORA })).toEqual(['erro-envio'])
  })

  it('o corpo é o mesmo do "Novo post": status pela ação, data em ISO, colab limpo, capa por vídeo', () => {
    const lote = { clienteId: 'c1', clienteNome: 'Cliente', marcoId: 'm1', subetapaId: '', redes: ['instagram' as const], contaIds: [] }
    const p = item('1', [vid('v')], { legenda: ' Texto ', data: '2026-11-05', hora: '19:00', colaboradores: ['@Ana', 'ana', 'bia'] })
    const corpo = corpoDoPost(p, lote, 'agendar')
    expect(corpo).toMatchObject({ clienteId: 'c1', marcoId: 'm1', imagens: ['https://b/v.mp4'], legenda: 'Texto', formato: 'reel', colaboradores: ['ana', 'bia'], capasVideo: { 'https://b/v.mp4': 'https://b/v-capa.jpg' }, redes: ['instagram'], statusInicial: 'agendado' })
    expect(corpo.dataAgendada).toBe(new Date('2026-11-05T19:00').toISOString())
    expect(corpo).not.toHaveProperty('contaIds')
    expect(corpoDoPost(p, lote, 'aprovacao')).toMatchObject({ statusInicial: 'aguardando_aprovacao', etapa: 'aprovacao_criativo' })
    expect(corpoDoPost(p, lote, 'rascunho')).toMatchObject({ rascunhoInterno: true })
    expect(corpoDoPost({ ...p, formato: 'story' }, lote, 'agendar')).toMatchObject({ legenda: '', colaboradores: [] })
    expect(instanteDoItem({ data: '2026-11-05', hora: '' })).toBe('')
  })

  it('rascunho no navegador guarda só o que já subiu', () => {
    const lote = { clienteId: 'c1', marcoId: 'm1', subetapaId: '', redes: ['instagram' as const, 'facebook' as const], contaIds: [], itens: [
      item('1', [img('a', { progresso: 100 }), img('b', { url: undefined, progresso: 40 })], { legenda: 'L' }),
      item('2', [img('c', { url: undefined })]),
    ] }
    const volta = deRascunho(paraRascunho(lote))!
    expect(volta.itens.map(i => i.id)).toEqual(['1'])
    expect(volta.itens[0].midias).toEqual([{ id: 'a', nome: 'a.jpg', tipo: 'imagem', url: 'https://b/a.jpg' }])
    expect(deRascunho('{quebrado')).toBeNull()
  })
})
