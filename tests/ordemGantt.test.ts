import { describe, it, expect } from 'vitest'
import { reordenar, novaPosicao, ordenarMarcos } from '@/lib/ordemGantt'

describe('ordemGantt — mover linha de cima para baixo à mão', () => {
  it('reordenar tira e recoloca; posição fora da lista trava nas pontas', () => {
    const l = ['out', 'set', 'nov']
    expect(reordenar(l, 1, 0)).toEqual(['set', 'out', 'nov'])
    expect(reordenar(l, 0, 2)).toEqual(['set', 'nov', 'out'])
    expect(reordenar(l, 1, 9)).toEqual(['out', 'nov', 'set'])
    expect(reordenar(l, 1, -3)).toEqual(['set', 'out', 'nov'])
    expect(reordenar(l, 1, 1)).toBe(l) // nada muda: mesma referência
    expect(reordenar(l, 5, 0)).toBe(l)
  })

  it('novaPosicao usa o centro da linha arrastada e respeita alturas diferentes', () => {
    const iguais = [24, 24, 24, 24]
    expect(novaPosicao(iguais, 3, -24)).toBe(2)
    expect(novaPosicao(iguais, 3, -72)).toBe(0)
    expect(novaPosicao(iguais, 0, 30)).toBe(1)
    expect(novaPosicao(iguais, 0, 500)).toBe(3)
    expect(novaPosicao(iguais, 1, 0)).toBe(1)
    // linhas altas: descer 40px a partir da primeira (34px) ainda cai na segunda (100px)
    expect(novaPosicao([34, 100, 34], 0, 40)).toBe(1)
    expect(novaPosicao([34, 100, 34], 0, 130)).toBe(2)
    expect(novaPosicao([], 0, 10)).toBe(0)
  })

  it('marcos: a ordem gravada manda; sem nenhuma, vale a automática', () => {
    const auto = <T,>(l: T[]) => [...l].reverse()
    const semOrdem: { id: string; ordem?: number }[] = [{ id: 'a' }, { id: 'b' }]
    expect(ordenarMarcos(semOrdem, auto).map(m => m.id)).toEqual(['b', 'a'])
    const comOrdem = [{ id: 'a', ordem: 2 }, { id: 'b', ordem: 0 }, { id: 'c', ordem: 1 }]
    expect(ordenarMarcos(comOrdem, auto).map(m => m.id)).toEqual(['b', 'c', 'a'])
    // marco novo (sem ordem) entra no fim, sem embaralhar quem já tem
    const misto = [{ id: 'novo' }, { id: 'a', ordem: 1 }, { id: 'b', ordem: 0 }]
    expect(ordenarMarcos(misto, auto).map(m => m.id)).toEqual(['b', 'a', 'novo'])
  })
})
