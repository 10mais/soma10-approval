import { describe, it, expect } from 'vitest'
import {
  MODELOS_LAYOUT, expandirModelo, clonarLayout, layoutVazio,
  capacidadeLayout, totalPoltronas, numerosPoltronas, poltronaExiste, rotuloPoltrona,
  validarLayout, proximoNumeroLivre, celulaOcupada, pisoPorId, totalLinhas,
  assentoEm, elementoEm, elementoInfo, ESTRUTURA_PALETA,
  adicionarPoltrona, removerPoltrona, moverPoltrona, renumerarPoltrona, alterarTipoPoltrona,
  adicionarElemento, limparCelula, alternarCorredor, definirColunas, adicionarPiso, removerPiso,
  normalizarLayout, ehLayoutAntigo,
  deslocarPoltrona, zerarDesloc, deslocPoltrona, DESLOC_MAX,
  type LayoutVeiculo,
} from '@/lib/layoutVeiculo'

// O croqui é a base das reservas (assento nominal). Número duplicado ou poltrona
// inexistente quebra a unicidade de poltrona. E o croqui é DOCUMENTO: a numeração
// não é derivável de fórmula — vem do croqui de fábrica.

describe('frota da Deny — croquis dos PDFs', () => {
  it('capacidade sai do layout: 2023 = 40, 2021 = 43, 2+2 = 48', () => {
    expect(capacidadeLayout(expandirModelo('carro-2023')!)).toBe(40)
    expect(capacidadeLayout(expandirModelo('carro-2021')!)).toBe(43)
    expect(capacidadeLayout(expandirModelo('convencional-2x2')!)).toBe(48)
    expect(capacidadeLayout(expandirModelo('em-branco')!)).toBe(0)
  })

  it('vans: Sprinter 15+1 = 15, Sprinter 19+1 = 19, Master 16 lugares = 15 passageiros', () => {
    // Capacidade = PASSAGEIROS (o motorista não vende poltrona).
    expect(capacidadeLayout(expandirModelo('van-sprinter-15')!)).toBe(15)
    expect(capacidadeLayout(expandirModelo('van-sprinter-19')!)).toBe(19)
    expect(capacidadeLayout(expandirModelo('van-master-16')!)).toBe(15)
  })

  it('vans seguem a configuração real: dupla na cabine da Master e última fileira inteiriça', () => {
    // Master 16L: banco duplo AO LADO do motorista (01/02 na fileira do volante).
    const master = pisoPorId(expandirModelo('van-master-16')!, 'unico')!
    expect(assentoEm(master, 0, 2)![2]).toBe('01')
    expect(assentoEm(master, 0, 3)![2]).toBe('02')
    expect(elementoEm(master, 0, 0)?.tipo).toBe('volante')
    // Última fileira atravessa o corredor: os assentos à direita do vão vêm com
    // desloc (mover livre) para encostar no vizinho, como no carro real.
    const s15 = pisoPorId(expandirModelo('van-sprinter-15')!, 'unico')!
    expect(assentoEm(s15, 5, 2)![4]?.[0]).toBeLessThan(0)
    const s19 = pisoPorId(expandirModelo('van-sprinter-19')!, 'unico')!
    expect(assentoEm(s19, 6, 2)![4]?.[0]).toBeLessThan(0)
    expect(assentoEm(s19, 6, 3)![4]?.[0]).toBeLessThan(0)
  })

  it("'em-branco' é o ÚLTIMO modelo — layoutVazio() lê o final da lista", () => {
    expect(MODELOS_LAYOUT[MODELOS_LAYOUT.length - 1].id).toBe('em-branco')
    expect(capacidadeLayout(layoutVazio())).toBe(0)
  })

  it('todo modelo tem números ÚNICOS cobrindo 01..total', () => {
    for (const m of MODELOS_LAYOUT) {
      const nums = numerosPoltronas(m.layout)
      expect(new Set(nums).size, `modelo ${m.id}: números duplicados`).toBe(nums.length)
      expect(new Set(nums.map(Number))).toEqual(new Set(Array.from({ length: nums.length }, (_, i) => i + 1)))
    }
  })

  it('todo modelo passa na própria validação', () => {
    for (const m of MODELOS_LAYOUT) expect(validarLayout(m.layout), `modelo ${m.id}`).toEqual([])
  })

  it('número é STRING com zero à esquerda — "01", não 1', () => {
    const l = expandirModelo('carro-2023')!
    expect(numerosPoltronas(l)[0]).toBe('01')
    expect(poltronaExiste(l, '01')).toBe(true)
    expect(poltronaExiste(l, '1')).toBe(false)
  })

  it('Carro 2021: a coluna da direita segue a numeração de FÁBRICA (09, 12, 15…)', () => {
    // O módulo de bar ocupa as fileiras 2 e 3, então a direita "pula" — é assim no
    // PDF. Renumerar mandaria o passageiro procurar assento que não existe.
    const sup = pisoPorId(expandirModelo('carro-2021')!, 'sup')!
    expect(assentoEm(sup, 4, 2)![2]).toBe('09')
    expect(assentoEm(sup, 5, 2)![2]).toBe('12')
    expect(assentoEm(sup, 6, 2)![2]).toBe('15')
    expect(assentoEm(sup, 10, 2)![2]).toBe('27')
    // Fileiras do módulo de bar não têm assento na direita.
    expect(assentoEm(sup, 2, 2)).toBeUndefined()
    expect(assentoEm(sup, 3, 2)).toBeUndefined()
  })

  it('Carro 2021 tem 2 pisos, 2+1, com corredor declarado depois da 2ª coluna', () => {
    const l = expandirModelo('carro-2021')!
    expect(l.pisos.map(p => p.id)).toEqual(['sup', 'inf'])
    expect(l.pisos.every(p => p.colunas === 3)).toBe(true)
    expect(l.pisos.every(p => p.corredorApos.includes(1))).toBe(true)
  })

  it('2+2: numeração ziguezagueia — esquerda sobe, direita desce', () => {
    const p = pisoPorId(expandirModelo('convencional-2x2')!, 'unico')!
    expect([assentoEm(p, 0, 0)![2], assentoEm(p, 0, 1)![2], assentoEm(p, 0, 2)![2], assentoEm(p, 0, 3)![2]])
      .toEqual(['01', '02', '04', '03'])
    expect([assentoEm(p, 2, 0)![2], assentoEm(p, 2, 3)![2]]).toEqual(['09', '07'])
  })

  it('expandirModelo devolve CÓPIA — editar um veículo não contamina o modelo', () => {
    const a = expandirModelo('carro-2023')!
    a.pisos[0].assentos.pop()
    a.pisos[0].assentos[0][2] = '99'
    const b = expandirModelo('carro-2023')!
    expect(capacidadeLayout(b)).toBe(40)
    expect(b.pisos[0].assentos[0][2]).toBe('01')
  })

  it('expandirModelo recusa id desconhecido/nulo', () => {
    expect(expandirModelo('inexistente')).toBeNull()
    expect(expandirModelo(null)).toBeNull()
    expect(expandirModelo('')).toBeNull()
  })

  it('layoutVazio nasce com 1 piso vazio e válido', () => {
    const l = layoutVazio()
    expect(capacidadeLayout(l)).toBe(0)
    expect(l.pisos).toHaveLength(1)
    expect(validarLayout(l)).toEqual([])
  })

  it('clonarLayout isola a cópia (é o que layoutSnap usa)', () => {
    const orig = expandirModelo('carro-2023')!
    const copia = clonarLayout(orig)
    copia.pisos[0].assentos[0][2] = '77'
    expect(orig.pisos[0].assentos[0][2]).toBe('01')
  })

  it('totalPoltronas segue valendo (usado por Reservas e DashboardHome)', () => {
    expect(totalPoltronas(expandirModelo('carro-2021')!)).toBe(43)
  })
})

describe('elementoEm — o span é o que protege o croqui', () => {
  it('módulo de bar cobre AS DUAS fileiras (rowSpan 2), não só a primeira', () => {
    const sup = pisoPorId(expandirModelo('carro-2023')!, 'sup')!
    expect(elementoEm(sup, 2, 2)?.rotulo).toContain('Chopeira')
    expect(elementoEm(sup, 3, 2)?.rotulo).toContain('Chopeira') // sem rowSpan, esta escapava
    expect(elementoEm(sup, 4, 2)).toBeUndefined()
  })

  it('elemento com largura total atravessa o piso inteiro', () => {
    const sup = pisoPorId(expandirModelo('carro-2023')!, 'sup')!
    expect(elementoEm(sup, 11, 0)?.rotulo).toBe('Frigobar')
    expect(elementoEm(sup, 11, 2)?.rotulo).toBe('Frigobar')
  })

  it('banheiro com span 2 cobre duas colunas', () => {
    const inf = pisoPorId(expandirModelo('carro-2023')!, 'inf')!
    expect(elementoEm(inf, 0, 0)?.rotulo).toBe('Banheiro')
    expect(elementoEm(inf, 0, 1)?.rotulo).toBe('Banheiro')
    expect(elementoEm(inf, 0, 2)).toBeUndefined()
  })

  it('totalLinhas conta o elemento que passa do último assento', () => {
    const sup = pisoPorId(expandirModelo('carro-2023')!, 'sup')!
    expect(totalLinhas(sup)).toBe(12) // frigobar de fundo na linha 11
  })
})

describe('validarLayout', () => {
  const base = (): LayoutVeiculo => ({
    pisos: [{ id: 'unico', nome: 'Poltronas', colunas: 3, corredorApos: [1], assentos: [[0, 0, '01', 'leito'], [0, 1, '02', 'leito']], elementos: [] }],
  })

  it('croqui íntegro não acusa nada', () => {
    expect(validarLayout(base())).toEqual([])
  })

  it('pega número repetido', () => {
    const l = base()
    l.pisos[0].assentos[1][2] = '01'
    expect(validarLayout(l).some(e => e.includes('repetido'))).toBe(true)
  })

  it('pega número repetido ENTRE pisos', () => {
    const l = expandirModelo('carro-2021')!
    l.pisos[1].assentos[0][2] = '01' // já existe no superior
    expect(validarLayout(l).some(e => e.includes('repetido'))).toBe(true)
  })

  it('pega duas poltronas na mesma posição', () => {
    const l = base()
    l.pisos[0].assentos[1][1] = 0
    expect(validarLayout(l).some(e => e.includes('mesma posição'))).toBe(true)
  })

  it('pega poltrona SOBRE elemento (o bar cobre 2 fileiras)', () => {
    const l = base()
    l.pisos[0].elementos = [{ linha: 0, col: 0, rowSpan: 2, rotulo: 'Bar', tipo: 'bar' }]
    expect(validarLayout(l).some(e => e.includes('está sobre'))).toBe(true)
  })

  it('pega poltrona fora das colunas do piso', () => {
    const l = base()
    l.pisos[0].assentos[1][1] = 9
    expect(validarLayout(l).some(e => e.includes('fora das'))).toBe(true)
  })

  it('pega poltrona sem número e croqui sem piso', () => {
    const l = base()
    l.pisos[0].assentos[0][2] = '  '
    expect(validarLayout(l).some(e => e.includes('sem número'))).toBe(true)
    expect(validarLayout({ pisos: [] })).toEqual(['Croqui sem piso.'])
  })
})

describe('operações do editor', () => {
  const base = (): LayoutVeiculo => ({
    pisos: [{
      id: 'unico', nome: 'Poltronas', colunas: 3, corredorApos: [1],
      assentos: [[0, 0, '01', 'leito'], [0, 1, '02', 'leito']],
      elementos: [{ linha: 1, col: 0, rotulo: 'Banheiro', tipo: 'banheiro' }],
    }],
  })
  const cel = (linha: number, col: number) => ({ pisoId: 'unico', linha, col })

  it('celulaOcupada distingue poltrona, elemento e vazio', () => {
    const l = base()
    expect(celulaOcupada(l, cel(0, 0))).toBe('poltrona')
    expect(celulaOcupada(l, cel(1, 0))).toBe('elemento')
    expect(celulaOcupada(l, cel(2, 2))).toBeNull()
    expect(celulaOcupada(l, { pisoId: 'nao-existe', linha: 0, col: 0 })).toBeNull()
  })

  it('proximoNumeroLivre acha o buraco e vem com zero à esquerda', () => {
    expect(proximoNumeroLivre(base())).toBe('03')
    expect(proximoNumeroLivre(removerPoltrona(base(), '01'))).toBe('01')
  })

  it('adicionarPoltrona numera sozinha e a capacidade acompanha', () => {
    const l = adicionarPoltrona(base(), cel(2, 0))!
    expect(capacidadeLayout(l)).toBe(3)
    expect(poltronaExiste(l, '03')).toBe(true)
    expect(validarLayout(l)).toEqual([])
  })

  it('adicionarPoltrona recusa célula ocupada, fora das colunas e nº repetido', () => {
    expect(adicionarPoltrona(base(), cel(0, 0))).toBeNull()   // poltrona
    expect(adicionarPoltrona(base(), cel(1, 0))).toBeNull()   // elemento
    expect(adicionarPoltrona(base(), cel(0, 9))).toBeNull()   // fora das colunas
    expect(adicionarPoltrona(base(), cel(5, 0), 'leito', '01')).toBeNull() // repetido
  })

  it('moverPoltrona leva para célula vazia, inclusive de piso', () => {
    const l2 = adicionarPiso(base())!
    const movida = moverPoltrona(l2, '01', { pisoId: 'inf', linha: 0, col: 0 })!
    expect(pisoPorId(movida, 'sup' as any)).toBeUndefined()
    expect(assentoEm(pisoPorId(movida, 'inf')!, 0, 0)![2]).toBe('01')
    expect(assentoEm(pisoPorId(movida, 'unico')!, 0, 0)).toBeUndefined()
    expect(capacidadeLayout(movida)).toBe(2) // não duplicou ao trocar de piso
  })

  it('moverPoltrona preserva o TIPO da poltrona', () => {
    const l = moverPoltrona(base(), '01', cel(3, 2))!
    expect(assentoEm(pisoPorId(l, 'unico')!, 3, 2)![3]).toBe('leito')
  })

  it('moverPoltrona RECUSA destino ocupado — nunca duas na mesma célula', () => {
    expect(moverPoltrona(base(), '01', cel(0, 1))).toBeNull() // outra poltrona
    expect(moverPoltrona(base(), '01', cel(1, 0))).toBeNull() // elemento
    expect(moverPoltrona(base(), '01', cel(0, 9))).toBeNull() // fora das colunas
    expect(moverPoltrona(base(), '99', cel(3, 0))).toBeNull() // não existe
  })

  it('moverPoltrona para a própria célula é no-op, não erro', () => {
    const l = moverPoltrona(base(), '01', cel(0, 0))
    expect(l).not.toBeNull()
    expect(capacidadeLayout(l!)).toBe(2)
  })

  it('renumerarPoltrona troca e recusa colisão/vazio', () => {
    expect(poltronaExiste(renumerarPoltrona(base(), '01', '10')!, '10')).toBe(true)
    expect(renumerarPoltrona(base(), '01', '02')).toBeNull()
    expect(renumerarPoltrona(base(), '01', '  ')).toBeNull()
    expect(renumerarPoltrona(base(), '99', '05')).toBeNull()
    expect(renumerarPoltrona(base(), '01', '01')).not.toBeNull()
  })

  it('alterarTipoPoltrona muda só a poltrona alvo', () => {
    const l = alterarTipoPoltrona(base(), '01', 'executivo')
    const p = pisoPorId(l, 'unico')!
    expect(assentoEm(p, 0, 0)![3]).toBe('executivo')
    expect(assentoEm(p, 0, 1)![3]).toBe('leito')
  })

  // Mover livre: o carro real não é 100% em grade — o desloc é só DESENHO; a
  // poltrona segue dona da célula (reserva e validação não mudam).
  it('deslocarPoltrona acumula, respeita o teto e some quando volta a zero', () => {
    let l = deslocarPoltrona(base(), '01', 0.25, 0)
    l = deslocarPoltrona(l, '01', 0.25, -0.5)
    expect(deslocPoltrona(assentoEm(pisoPorId(l, 'unico')!, 0, 0)!)).toEqual([0.5, -0.5])
    // teto: não sai voando pra fora do casco
    for (let i = 0; i < 30; i++) l = deslocarPoltrona(l, '01', 1, 0)
    expect(deslocPoltrona(assentoEm(pisoPorId(l, 'unico')!, 0, 0)!)[0]).toBe(DESLOC_MAX)
    // volta exata a zero: o 5º item some (croqui igual ao de antes do recurso)
    const zerado = deslocarPoltrona(deslocarPoltrona(base(), '01', 0.5, 0), '01', -0.5, 0)
    expect(assentoEm(pisoPorId(zerado, 'unico')!, 0, 0)!.length).toBe(4)
  })

  it('desloc NÃO muda a célula lógica nem quebra a validação, e sobrevive a renumerar/tipo', () => {
    let l = deslocarPoltrona(base(), '01', 0.75, 0.25)
    expect(celulaOcupada(l, cel(0, 0))).toBe('poltrona') // segue dona da célula
    expect(validarLayout(l)).toEqual([])
    l = renumerarPoltrona(l, '01', '07')!
    l = alterarTipoPoltrona(l, '07', 'executivo')
    expect(deslocPoltrona(assentoEm(pisoPorId(l, 'unico')!, 0, 0)!)).toEqual([0.75, 0.25])
    expect(deslocPoltrona(assentoEm(pisoPorId(zerarDesloc(l, '07'), 'unico')!, 0, 0)!)).toEqual([0, 0])
  })

  it('mudar de CÉLULA zera o ajuste fino (o desloc era da posição antiga)', () => {
    const l = moverPoltrona(deslocarPoltrona(base(), '01', 0.5, 0), '01', cel(3, 2))!
    expect(deslocPoltrona(assentoEm(pisoPorId(l, 'unico')!, 3, 2)!)).toEqual([0, 0])
  })

  it('adicionarElemento aceita span, rowSpan e largura total', () => {
    const bar = adicionarElemento(base(), cel(2, 2), 'Chopeira', 'bar', { rowSpan: 2 })!
    const p = pisoPorId(bar, 'unico')!
    expect(elementoEm(p, 3, 2)?.rotulo).toBe('Chopeira') // pega a 2ª fileira do span

    const faixa = adicionarElemento(base(), cel(4, 0), 'Frigobar', 'bar', { largura: 'total' })!
    expect(elementoEm(pisoPorId(faixa, 'unico')!, 4, 2)?.rotulo).toBe('Frigobar')
  })

  it('adicionarElemento recusa célula ocupada e rótulo vazio', () => {
    expect(adicionarElemento(base(), cel(0, 0), 'Chopeira')).toBeNull()
    expect(adicionarElemento(base(), cel(5, 0), '   ')).toBeNull()
  })

  it('limparCelula apaga poltrona OU elemento, e ignora célula vazia', () => {
    expect(capacidadeLayout(limparCelula(base(), cel(0, 0)))).toBe(1)
    expect(pisoPorId(limparCelula(base(), cel(1, 0)), 'unico')!.elementos).toHaveLength(0)
    expect(capacidadeLayout(limparCelula(base(), cel(9, 9)))).toBe(2)
  })

  it('limparCelula apaga o elemento pelo SPAN, não só pela célula de origem', () => {
    const l = adicionarElemento(base(), cel(2, 2), 'Chopeira', 'bar', { rowSpan: 2 })!
    const limpo = limparCelula(l, cel(3, 2)) // clicou na 2ª fileira do módulo
    expect(pisoPorId(limpo, 'unico')!.elementos.some(e => e.rotulo === 'Chopeira')).toBe(false)
  })

  it('alternarCorredor liga/desliga sem mexer em poltrona (corredor é vão)', () => {
    const sem = alternarCorredor(base(), 'unico', 1)
    expect(pisoPorId(sem, 'unico')!.corredorApos).toEqual([])
    expect(capacidadeLayout(sem)).toBe(2)
    expect(pisoPorId(alternarCorredor(sem, 'unico', 1), 'unico')!.corredorApos).toEqual([1])
  })

  it('definirColunas recusa encolher com poltrona na coluna que sumiria', () => {
    expect(definirColunas(base(), 'unico', 1)).toBeNull() // a poltrona 02 está na coluna 1
    expect(definirColunas(base(), 'unico', 4)!.pisos[0].colunas).toBe(4)
  })

  it('adicionarPiso vai até 2; removerPiso recusa se tiver poltrona ou for o último', () => {
    const dois = adicionarPiso(base())!
    expect(dois.pisos).toHaveLength(2)
    expect(adicionarPiso(dois)).toBeNull()
    expect(removerPiso(dois, 'inf')!.pisos).toHaveLength(1)
    expect(removerPiso(base(), 'unico')).toBeNull() // último piso
    const comPoltrona = adicionarPoltrona(dois, { pisoId: 'inf', linha: 0, col: 0 })!
    expect(removerPiso(comPoltrona, 'inf')).toBeNull()
  })
})

describe('normalizarLayout — croqui do formato anterior não pode quebrar a tela', () => {
  // Formato antigo: coluna 3 GASTA como corredor, 1-based, poltronas soltas.
  const antigo = {
    andares: 2,
    poltronas: [
      { numero: '1', tipo: 'leito', andar: 2, fileira: 1, coluna: 1 },
      { numero: '2', tipo: 'leito', andar: 2, fileira: 1, coluna: 2 },
      { numero: '3', tipo: 'leito', andar: 2, fileira: 1, coluna: 4 },
      { numero: '32', tipo: 'leito-cama', andar: 1, fileira: 2, coluna: 1 },
    ],
    elementos: [
      { label: 'Corredor', tipo: 'corredor', andar: 2, fileira: 1, coluna: 3 },
      { label: 'Frigobar', tipo: 'amenidade', andar: 2, fileira: 5, coluna: 5 },
    ],
  }

  it('converte para pisos, mantendo número, tipo e capacidade', () => {
    const l = normalizarLayout(antigo)
    expect(l.pisos.map(p => p.id)).toEqual(['sup', 'inf'])
    expect(capacidadeLayout(l)).toBe(4)
    expect(assentoEm(pisoPorId(l, 'sup')!, 0, 0)![2]).toBe('01') // 1-based → 0-based, "1" → "01"
    expect(assentoEm(pisoPorId(l, 'inf')!, 1, 0)![3]).toBe('leito-cama')
  })

  it('a coluna 3 (corredor gasto) vira corredorApos — não ocupa mais coluna', () => {
    const l = normalizarLayout(antigo)
    const sup = pisoPorId(l, 'sup')!
    expect(sup.corredorApos).toEqual([1])
    expect(sup.elementos.some(e => e.rotulo === 'Corredor')).toBe(false)
    expect(assentoEm(sup, 0, 2)![2]).toBe('03') // a antiga coluna 4 encosta na 2
  })

  it('o croqui convertido é válido', () => {
    expect(validarLayout(normalizarLayout(antigo))).toEqual([])
  })

  it('croqui NOVO passa direto, e ausente vira vazio', () => {
    const novo = expandirModelo('carro-2023')!
    expect(normalizarLayout(novo)).toBe(novo)
    expect(capacidadeLayout(normalizarLayout(null))).toBe(0)
    expect(capacidadeLayout(normalizarLayout(undefined))).toBe(0)
    expect(capacidadeLayout(normalizarLayout({}))).toBe(0)
  })

  it('ehLayoutAntigo distingue os dois', () => {
    expect(ehLayoutAntigo(antigo)).toBe(true)
    expect(ehLayoutAntigo(expandirModelo('carro-2023'))).toBe(false)
    expect(ehLayoutAntigo(null)).toBe(false)
  })
})

describe('rotuloPoltrona e elementoInfo', () => {
  it('o croqui já guarda "01"; o rótulo cobre o dado antigo ("1")', () => {
    expect(rotuloPoltrona('01')).toBe('01')
    expect(rotuloPoltrona('1')).toBe('01')
    expect(rotuloPoltrona('43')).toBe('43')
    expect(rotuloPoltrona('1A')).toBe('1A')
    expect(rotuloPoltrona('')).toBe('')
  })

  it('elemento sem tipo vale como amenidade; a paleta cobre bar e banheiro', () => {
    expect(elementoInfo({ tipo: undefined }).tipo).toBe('amenidade')
    expect(ESTRUTURA_PALETA.map(e => e.tipo)).toContain('bar')
    expect(ESTRUTURA_PALETA.map(e => e.tipo)).toContain('banheiro')
  })
})
