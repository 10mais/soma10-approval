import { describe, it, expect } from 'vitest'
import {
  MODELOS_LAYOUT, expandirModelo, clonarLayout, layoutVazio,
  capacidadeLayout, totalPoltronas, numerosPoltronas, poltronaExiste,
  validarLayout, proximoNumeroLivre, celulaOcupada, dimensoesLayout,
  adicionarPoltrona, removerPoltrona, moverPoltrona, renumerarPoltrona, alterarTipoPoltrona,
  adicionarElemento, moverElemento, removerElemento, limparCelula, definirAndares,
  type LayoutVeiculo,
} from '@/lib/layoutVeiculo'

// O croqui é a base das reservas (assento nominal). Número duplicado ou poltrona
// inexistente quebraria a unicidade de poltrona (lib/reservas.ts). Agora o croqui é
// EDITÁVEL, então cada operação do editor precisa recusar o que corromperia o mapa.

describe('modelos de croqui', () => {
  it('todo modelo tem números ÚNICOS cobrindo 1..total (ordem do croqui é irregular)', () => {
    for (const m of MODELOS_LAYOUT) {
      const nums = m.layout.poltronas.map(p => p.numero)
      expect(new Set(nums).size, `modelo ${m.id}: números duplicados`).toBe(nums.length)
      // conjunto = {1..total} (posições seguem o croqui, não são sequenciais por fileira)
      expect(new Set(nums)).toEqual(new Set(Array.from({ length: nums.length }, (_, i) => String(i + 1))))
    }
  })

  it('carros da Deny têm os totais dos croquis (2023=40, 2021=43)', () => {
    expect(capacidadeLayout(expandirModelo('carro-2023')!)).toBe(40)
    expect(capacidadeLayout(expandirModelo('carro-2021')!)).toBe(43)
    expect(capacidadeLayout(expandirModelo('em-branco')!)).toBe(0)
  })

  it('cada poltrona tem andar/fileira/coluna válidos e o andar bate com o modelo', () => {
    for (const m of MODELOS_LAYOUT) {
      for (const p of m.layout.poltronas) {
        expect(p.andar).toBeGreaterThanOrEqual(1)
        expect(p.andar).toBeLessThanOrEqual(m.layout.andares)
        expect(p.fileira).toBeGreaterThanOrEqual(1)
        expect(p.coluna).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('todo modelo passa na própria validação', () => {
    for (const m of MODELOS_LAYOUT) expect(validarLayout(m.layout), `modelo ${m.id}`).toEqual([])
  })

  it('expandirModelo devolve CÓPIA — editar um veículo não contamina o modelo', () => {
    const a = expandirModelo('carro-2023')!
    a.poltronas.pop()
    a.poltronas[0].numero = '999'
    const b = expandirModelo('carro-2023')!
    expect(capacidadeLayout(b)).toBe(40)
    expect(b.poltronas[0].numero).toBe('1')
  })

  it('expandirModelo recusa id desconhecido/nulo', () => {
    expect(expandirModelo('inexistente')).toBeNull()
    expect(expandirModelo(null)).toBeNull()
    expect(expandirModelo('')).toBeNull()
  })

  it('helpers de leitura preservados (usados por Reservas e DashboardHome)', () => {
    const l = expandirModelo('carro-2023')!
    expect(totalPoltronas(l)).toBe(l.poltronas.length)
    expect(numerosPoltronas(l)).toContain('1')
    expect(poltronaExiste(l, '1')).toBe(true)
    expect(poltronaExiste(l, '999')).toBe(false)
  })
})

describe('validarLayout', () => {
  const base = (): LayoutVeiculo => ({
    andares: 1,
    poltronas: [
      { numero: '1', tipo: 'leito', andar: 1, fileira: 1, coluna: 1 },
      { numero: '2', tipo: 'leito', andar: 1, fileira: 1, coluna: 2 },
    ],
    elementos: [],
  })

  it('croqui íntegro não acusa nada', () => {
    expect(validarLayout(base())).toEqual([])
    expect(validarLayout(layoutVazio())).toEqual([])
  })

  it('pega número de poltrona repetido', () => {
    const l = base()
    l.poltronas[1].numero = '1'
    const erros = validarLayout(l)
    expect(erros.some(e => e.includes('repetido'))).toBe(true)
  })

  it('pega dois itens na mesma célula', () => {
    const l = base()
    l.poltronas[1].coluna = 1 // encosta na poltrona 1
    expect(validarLayout(l).some(e => e.includes('sobrepostos'))).toBe(true)
  })

  it('pega poltrona sobreposta a elemento', () => {
    const l = base()
    l.elementos = [{ label: 'Frigobar', andar: 1, fileira: 1, coluna: 1 }]
    expect(validarLayout(l).some(e => e.includes('sobrepostos'))).toBe(true)
  })

  it('pega item em andar fora da faixa do croqui', () => {
    const l = base()
    l.poltronas[0].andar = 2 // croqui só tem 1 andar
    expect(validarLayout(l).some(e => e.includes('fora dos'))).toBe(true)
  })

  it('pega poltrona sem número', () => {
    const l = base()
    l.poltronas[0].numero = '  '
    expect(validarLayout(l).some(e => e.includes('sem número'))).toBe(true)
  })
})

describe('operações do editor', () => {
  const base = (): LayoutVeiculo => ({
    andares: 2,
    poltronas: [
      { numero: '1', tipo: 'leito', andar: 1, fileira: 1, coluna: 1 },
      { numero: '2', tipo: 'leito', andar: 1, fileira: 1, coluna: 2 },
    ],
    elementos: [{ label: 'Banheiro', andar: 1, fileira: 2, coluna: 1 }],
  })

  it('celulaOcupada distingue poltrona, elemento e vazio', () => {
    const l = base()
    expect(celulaOcupada(l, { andar: 1, fileira: 1, coluna: 1 })).toBe('poltrona')
    expect(celulaOcupada(l, { andar: 1, fileira: 2, coluna: 1 })).toBe('elemento')
    expect(celulaOcupada(l, { andar: 1, fileira: 9, coluna: 9 })).toBeNull()
    expect(celulaOcupada(l, { andar: 2, fileira: 1, coluna: 1 })).toBeNull() // outro andar
  })

  it('proximoNumeroLivre acha o buraco, não o total+1', () => {
    expect(proximoNumeroLivre(base())).toBe('3')
    const comBuraco = removerPoltrona(base(), '1')
    expect(proximoNumeroLivre(comBuraco)).toBe('1')
  })

  it('adicionarPoltrona numera sozinha e a capacidade acompanha', () => {
    const l = adicionarPoltrona(base(), { andar: 1, fileira: 3, coluna: 1 })!
    expect(capacidadeLayout(l)).toBe(3)
    expect(poltronaExiste(l, '3')).toBe(true)
    expect(validarLayout(l)).toEqual([])
  })

  it('adicionarPoltrona recusa célula ocupada, andar inválido e número repetido', () => {
    expect(adicionarPoltrona(base(), { andar: 1, fileira: 1, coluna: 1 })).toBeNull() // poltrona
    expect(adicionarPoltrona(base(), { andar: 1, fileira: 2, coluna: 1 })).toBeNull() // elemento
    expect(adicionarPoltrona(base(), { andar: 3, fileira: 5, coluna: 1 })).toBeNull() // fora dos andares
    expect(adicionarPoltrona(base(), { andar: 1, fileira: 5, coluna: 1 }, 'leito', '1')).toBeNull() // nº repetido
  })

  it('removerPoltrona derruba a capacidade', () => {
    const l = removerPoltrona(base(), '1')
    expect(capacidadeLayout(l)).toBe(1)
    expect(poltronaExiste(l, '1')).toBe(false)
  })

  it('moverPoltrona leva para célula vazia, inclusive de andar', () => {
    const l = moverPoltrona(base(), '1', { andar: 2, fileira: 4, coluna: 4 })!
    const p = l.poltronas.find(x => x.numero === '1')!
    expect([p.andar, p.fileira, p.coluna]).toEqual([2, 4, 4])
    expect(validarLayout(l)).toEqual([])
  })

  it('moverPoltrona RECUSA destino ocupado — nunca duas poltronas na mesma célula', () => {
    expect(moverPoltrona(base(), '1', { andar: 1, fileira: 1, coluna: 2 })).toBeNull() // outra poltrona
    expect(moverPoltrona(base(), '1', { andar: 1, fileira: 2, coluna: 1 })).toBeNull() // elemento
    expect(moverPoltrona(base(), '1', { andar: 3, fileira: 1, coluna: 5 })).toBeNull() // andar inexistente
    expect(moverPoltrona(base(), '99', { andar: 1, fileira: 5, coluna: 5 })).toBeNull() // poltrona inexistente
  })

  it('moverPoltrona para a própria célula é no-op, não erro', () => {
    const l = moverPoltrona(base(), '1', { andar: 1, fileira: 1, coluna: 1 })
    expect(l).not.toBeNull()
    expect(capacidadeLayout(l!)).toBe(2)
  })

  it('renumerarPoltrona troca o número e recusa colisão/vazio', () => {
    const l = renumerarPoltrona(base(), '1', '10')!
    expect(poltronaExiste(l, '10')).toBe(true)
    expect(poltronaExiste(l, '1')).toBe(false)
    expect(renumerarPoltrona(base(), '1', '2')).toBeNull()   // já existe
    expect(renumerarPoltrona(base(), '1', '  ')).toBeNull()  // vazio
    expect(renumerarPoltrona(base(), '99', '5')).toBeNull()  // não existe
    expect(renumerarPoltrona(base(), '1', '1')).not.toBeNull() // mesmo número = no-op
  })

  it('alterarTipoPoltrona muda só a poltrona alvo', () => {
    const l = alterarTipoPoltrona(base(), '1', 'executivo')
    expect(l.poltronas.find(p => p.numero === '1')!.tipo).toBe('executivo')
    expect(l.poltronas.find(p => p.numero === '2')!.tipo).toBe('leito')
  })

  it('elementos: adicionar, mover, remover e recusar sobreposição', () => {
    const l = adicionarElemento(base(), { andar: 2, fileira: 1, coluna: 5 }, 'Chopeira')!
    expect(l.elementos).toHaveLength(2)
    expect(adicionarElemento(base(), { andar: 1, fileira: 1, coluna: 1 }, 'Chopeira')).toBeNull() // em cima de poltrona
    expect(adicionarElemento(base(), { andar: 1, fileira: 5, coluna: 5 }, '   ')).toBeNull()      // sem rótulo

    const movido = moverElemento(base(), { andar: 1, fileira: 2, coluna: 1 }, { andar: 1, fileira: 8, coluna: 1 })!
    expect(movido.elementos![0].fileira).toBe(8)
    expect(moverElemento(base(), { andar: 1, fileira: 2, coluna: 1 }, { andar: 1, fileira: 1, coluna: 1 })).toBeNull() // destino com poltrona

    const semEl = removerElemento(base(), { andar: 1, fileira: 2, coluna: 1 })
    expect(semEl.elementos).toHaveLength(0)
  })

  it('limparCelula apaga o que estiver ali, poltrona ou elemento', () => {
    expect(capacidadeLayout(limparCelula(base(), { andar: 1, fileira: 1, coluna: 1 }))).toBe(1)
    expect(limparCelula(base(), { andar: 1, fileira: 2, coluna: 1 }).elementos).toHaveLength(0)
    expect(capacidadeLayout(limparCelula(base(), { andar: 1, fileira: 9, coluna: 9 }))).toBe(2) // vazia = no-op
  })

  it('definirAndares recusa encolher com item preso no andar de cima', () => {
    const doisAndares = adicionarPoltrona(base(), { andar: 2, fileira: 1, coluna: 1 })!
    expect(definirAndares(doisAndares, 1)).toBeNull()
    expect(definirAndares(base(), 1)).not.toBeNull() // base() não usa o andar 2
    expect(definirAndares(base(), 2)!.andares).toBe(2)
  })

  it('dimensoesLayout mede o andar pedido', () => {
    const { maxFileira, maxColuna } = dimensoesLayout(base(), 1)
    expect(maxFileira).toBe(2)
    expect(maxColuna).toBe(2)
    expect(dimensoesLayout(base(), 2)).toEqual({ maxFileira: 0, maxColuna: 0 })
  })

  it('clonarLayout isola a cópia', () => {
    const orig = base()
    const copia = clonarLayout(orig)
    copia.poltronas[0].numero = '77'
    expect(orig.poltronas[0].numero).toBe('1')
  })
})
