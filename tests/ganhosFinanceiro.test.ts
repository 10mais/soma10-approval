import { describe, it, expect } from 'vitest'
import { ganhosPendentes, dataSugerida, descricaoDoGanho, rotuloFormaPagamento, formaValida, FORMAS_PAGAMENTO } from '@/lib/ganhosFinanceiro'

// Esta é a ponte entre o funil e o caixa. Os dois erros que ela não pode
// cometer: deixar a mesma venda ser lançada duas vezes (caixa inflado) e
// esconder um ganho que ninguém lançou (caixa a menos).

const HOJE = new Date(2026, 7, 29)

const g = (id: string, valor: number, fechadoEm?: string, status = 'ganho') =>
  ({ id, titulo: 'Protocolo', valor, status, fechadoEm })

describe('ganhos pendentes', () => {
  it('lista só o que foi GANHO e ainda não virou entrada', () => {
    const negocios = [
      g('1', 3000, '2026-08-10T10:00:00.000Z'),
      g('2', 2000, '2026-08-12T10:00:00.000Z'),
      g('3', 5000, '2026-08-13T10:00:00.000Z', 'aberto'),
      g('4', 900, '2026-08-14T10:00:00.000Z', 'perdido'),
    ]
    const pend = ganhosPendentes(negocios, [{ negocioId: '1' }])
    expect(pend.map(n => n.id)).toEqual(['2'])
  })

  it('o que já foi lançado NÃO volta a aparecer (nada de lançar duas vezes)', () => {
    const negocios = [g('1', 3000, '2026-08-10T10:00:00.000Z')]
    expect(ganhosPendentes(negocios, [{ negocioId: '1' }])).toEqual([])
    // lançamento avulso (sem vínculo) não conta como se fosse o desta venda
    expect(ganhosPendentes(negocios, [{ id: 'x' }]).map(n => n.id)).toEqual(['1'])
  })

  it('dispensado pelo admin some da lista', () => {
    const negocios = [g('1', 3000), g('2', 1000)]
    expect(ganhosPendentes(negocios, [], ['1']).map(n => n.id)).toEqual(['2'])
  })

  it('ganho sem valor não vira lançamento de R$ 0', () => {
    expect(ganhosPendentes([g('1', 0), g('2', undefined as any)], [])).toEqual([])
  })

  it('mais recente primeiro — é o que o caixa quer conferir', () => {
    const negocios = [
      g('antigo', 100, '2026-08-01T10:00:00.000Z'),
      g('novo', 100, '2026-08-20T10:00:00.000Z'),
      g('meio', 100, '2026-08-10T10:00:00.000Z'),
    ]
    expect(ganhosPendentes(negocios, []).map(n => n.id)).toEqual(['novo', 'meio', 'antigo'])
  })
})

describe('dados sugeridos do lançamento', () => {
  it('a data é a do GANHO, não a de hoje', () => {
    expect(dataSugerida(g('1', 100, '2026-08-10T13:00:00.000Z'), HOJE)).toBe('2026-08-10')
  })

  it('sem data reconhecível cai em hoje — nunca em vazio', () => {
    expect(dataSugerida({ id: '1', valor: 100, status: 'ganho' }, HOJE)).toBe('2026-08-29')
    expect(dataSugerida({ id: '1', valor: 100, status: 'ganho', fechadoEm: 'data ruim' }, HOJE)).toBe('2026-08-29')
  })

  it('a descrição leva o nome de quem pagou', () => {
    expect(descricaoDoGanho({ id: '1', titulo: 'Protocolo facial' }, 'Maria Silva')).toBe('Protocolo facial — Maria Silva')
  })

  it('não repete o nome quando o título já o tem', () => {
    expect(descricaoDoGanho({ id: '1', titulo: 'Protocolo — Maria Silva' }, 'Maria Silva')).toBe('Protocolo — Maria Silva')
  })

  it('sem título vira "Venda", não vazio no extrato', () => {
    expect(descricaoDoGanho({ id: '1' }, 'Maria')).toBe('Venda — Maria')
    expect(descricaoDoGanho({ id: '1' })).toBe('Venda')
  })
})

describe('formas de pagamento', () => {
  it('as chaves são as mesmas do PDV do varejo', () => {
    expect(FORMAS_PAGAMENTO.map(f => f.chave).sort()).toEqual(['boleto', 'credito', 'debito', 'dinheiro', 'outro', 'pix'])
  })

  it('rótulo legível e validação', () => {
    expect(rotuloFormaPagamento('pix')).toBe('Pix')
    expect(rotuloFormaPagamento('inventada')).toBe('Não informada')
    expect(rotuloFormaPagamento(undefined)).toBe('Não informada')
    expect(formaValida('credito')).toBe(true)
    expect(formaValida('cheque')).toBe(false)
  })
})
