import { describe, it, expect } from 'vitest'
import { alertasDoVeiculo, alertasDaFrota, diasEntre, type VeiculoLite } from '@/lib/frotaAlertas'

// Vencimento de documento tira o carro da estrada. Alertar cedo demais vira ruído;
// tarde demais, prejuízo. A janela e o dedupe são o que separa um do outro.

const HOJE = '2026-07-15'

const veiculo = (over: Partial<VeiculoLite> = {}): VeiculoLite => ({
  id: 'v1', nome: 'DD 01', condicao: 'disponivel', documentos: [], manutencoes: [], ...over,
})

describe('diasEntre', () => {
  it('conta para frente, para trás e o mesmo dia', () => {
    expect(diasEntre(HOJE, '2026-07-20')).toBe(5)
    expect(diasEntre(HOJE, '2026-07-10')).toBe(-5)
    expect(diasEntre(HOJE, HOJE)).toBe(0)
  })

  it('atravessa mês e ano sem escorregar', () => {
    expect(diasEntre('2026-12-31', '2027-01-01')).toBe(1)
    expect(diasEntre('2026-02-28', '2026-03-01')).toBe(1) // 2026 não é bissexto
  })
})

describe('alertasDoVeiculo — documentos', () => {
  const comDoc = (vencimento: string) => veiculo({ documentos: [{ id: 'd1', tipo: 'licenciamento', numero: '123', vencimento }] })

  it('avisa dentro da janela de 30 dias', () => {
    const a = alertasDoVeiculo(comDoc('2026-08-01'), HOJE)
    expect(a).toHaveLength(1)
    expect(a[0].titulo).toContain('Licenciamento de DD 01')
    expect(a[0].titulo).toContain('01/08/2026')
    expect(a[0].descricao).toContain('Faltam 17 dia(s)')
    expect(a[0].quando).toBe('2026-08-01')
  })

  it('fica quieto fora da janela', () => {
    expect(alertasDoVeiculo(comDoc('2026-12-01'), HOJE)).toEqual([])
  })

  it('pega o limite exato da janela (30 dias) e recusa o 31º', () => {
    expect(alertasDoVeiculo(comDoc('2026-08-14'), HOJE)).toHaveLength(1) // 30 dias
    expect(alertasDoVeiculo(comDoc('2026-08-15'), HOJE)).toHaveLength(0) // 31 dias
  })

  it('avisa quando vence HOJE', () => {
    const a = alertasDoVeiculo(comDoc(HOJE), HOJE)
    expect(a).toHaveLength(1)
    expect(a[0].descricao).toContain('Vence hoje')
  })

  it('avisa vencido recente, mas desiste do vencido antigo', () => {
    const recente = alertasDoVeiculo(comDoc('2026-07-01'), HOJE)
    expect(recente).toHaveLength(1)
    expect(recente[0].titulo).toContain('venceu')
    expect(recente[0].descricao).toContain('Vencido há 14 dia(s)')
    expect(alertasDoVeiculo(comDoc('2026-01-01'), HOJE)).toEqual([]) // 195 dias — ruído
  })

  it('ignora data mal formada em vez de quebrar', () => {
    expect(alertasDoVeiculo(veiculo({ documentos: [{ id: 'd1', tipo: 'seguro', vencimento: '' }] }), HOJE)).toEqual([])
    expect(alertasDoVeiculo(veiculo({ documentos: [{ id: 'd1', tipo: 'seguro', vencimento: '15/07/2026' }] }), HOJE)).toEqual([])
  })

  it('rotula cada tipo de documento', () => {
    expect(alertasDoVeiculo(veiculo({ documentos: [{ id: 'd', tipo: 'antt', vencimento: '2026-07-20' }] }), HOJE)[0].titulo).toContain('ANTT')
    expect(alertasDoVeiculo(veiculo({ documentos: [{ id: 'd', tipo: 'xpto', vencimento: '2026-07-20' }] }), HOJE)[0].titulo).toContain('Documento')
  })
})

describe('alertasDoVeiculo — revisão', () => {
  it('avisa a próxima revisão dentro da janela', () => {
    const a = alertasDoVeiculo(veiculo({ manutencoes: [{ id: 'm1', tipo: 'revisao', proximaData: '2026-07-20' }] }), HOJE)
    expect(a).toHaveLength(1)
    expect(a[0].titulo).toContain('Revisão de DD 01')
    expect(a[0].chave).toBe('rev:v1:m1:2026-07-20')
  })

  it('serviço sem próxima revisão não alerta', () => {
    expect(alertasDoVeiculo(veiculo({ manutencoes: [{ id: 'm1', tipo: 'oleo' }] }), HOJE)).toEqual([])
  })

  it('revisão atrasada aparece como atrasada', () => {
    const a = alertasDoVeiculo(veiculo({ manutencoes: [{ id: 'm1', tipo: 'pneu', proximaData: '2026-07-10' }] }), HOJE)
    expect(a[0].descricao).toContain('Atrasada há 5 dia(s)')
  })
})

describe('alertasDoVeiculo — regras gerais', () => {
  it('veículo excluído não alerta — saiu de circulação', () => {
    const v = veiculo({ condicao: 'excluido', documentos: [{ id: 'd1', tipo: 'licenciamento', vencimento: '2026-07-16' }] })
    expect(alertasDoVeiculo(v, HOJE)).toEqual([])
  })

  it('veículo em manutenção AINDA alerta — o documento vence do mesmo jeito', () => {
    const v = veiculo({ condicao: 'manutencao', documentos: [{ id: 'd1', tipo: 'licenciamento', vencimento: '2026-07-16' }] })
    expect(alertasDoVeiculo(v, HOJE)).toHaveLength(1)
  })

  it('chave de dedupe é estável e muda com a data — renovou, alerta de novo', () => {
    const a = alertasDoVeiculo(veiculo({ documentos: [{ id: 'd1', tipo: 'seguro', vencimento: '2026-07-20' }] }), HOJE)
    expect(a[0].chave).toBe('doc:v1:d1:2026-07-20')
    const b = alertasDoVeiculo(veiculo({ documentos: [{ id: 'd1', tipo: 'seguro', vencimento: '2027-07-20' }] }), HOJE)
    expect(b).toEqual([]) // renovado p/ 2027: fora da janela, sem alerta
  })

  it('ordena pelo que vence primeiro', () => {
    const v = veiculo({
      documentos: [{ id: 'd1', tipo: 'seguro', vencimento: '2026-08-10' }],
      manutencoes: [{ id: 'm1', tipo: 'revisao', proximaData: '2026-07-18' }],
    })
    expect(alertasDoVeiculo(v, HOJE).map(a => a.quando)).toEqual(['2026-07-18', '2026-08-10'])
  })

  it('veículo sem documento nem manutenção não quebra', () => {
    expect(alertasDoVeiculo(veiculo(), HOJE)).toEqual([])
    expect(alertasDoVeiculo({ id: 'v', nome: 'X' }, HOJE)).toEqual([])
  })
})

describe('alertasDaFrota', () => {
  it('junta os veículos e ordena pelo mais urgente', () => {
    const frota: VeiculoLite[] = [
      { id: 'v1', nome: 'DD 01', documentos: [{ id: 'd', tipo: 'seguro', vencimento: '2026-08-10' }] },
      { id: 'v2', nome: 'DD 02', documentos: [{ id: 'd', tipo: 'antt', vencimento: '2026-07-16' }] },
    ]
    const a = alertasDaFrota(frota, HOJE)
    expect(a).toHaveLength(2)
    expect(a[0].veiculoId).toBe('v2')
  })

  it('frota vazia = nenhum alerta', () => {
    expect(alertasDaFrota([], HOJE)).toEqual([])
  })
})
