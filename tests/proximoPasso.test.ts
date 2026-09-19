import { describe, it, expect } from 'vitest'
import { passosDaReserva, passosDaViagem, ordenarPassos, diasAte, temAtraso, situacaoConfirmacao } from '@/lib/proximoPasso'

const HOJE = '2026-09-19'

// Passageiro que passa em tudo o que a lista oficial exige (lib/manifesto).
const PAX_OK = { nome: 'Maria Silva', cpf: '529.982.247-25', nascimento: '1990-05-10', poltrona: '01' }

const VIAGEM = { id: 'v1', titulo: 'Gramado', dataIda: '2026-12-01', veiculoId: 've1', temLayout: true, motoristas: [{}], status: 'aberta' as const }

function financeiro(vencimento: string, status: 'pendente' | 'pago' = 'pendente') {
  return { valorTotal: 1790, parcelas: [{ id: 'p1', numero: 1, valor: 1790, vencimento, status }], pagamentos: [] }
}

describe('passos da reserva', () => {
  it('reserva cancelada não pede nada — cobrar quem desistiu é ruído', () => {
    expect(passosDaReserva({ status: 'cancelada', passageiros: [] }, VIAGEM, HOJE)).toEqual([])
  })

  it('sem passageiro, o passo é cadastrar o passageiro', () => {
    const p = passosDaReserva({ status: 'pre-reserva', passageiros: [] }, VIAGEM, HOJE)
    expect(p.map(x => x.chave)).toContain('passageiros')
  })

  it('passageiro sem CPF nem RG vira pendência de documento', () => {
    const p = passosDaReserva({ status: 'pre-reserva', passageiros: [{ nome: 'Maria Silva', nascimento: '1990-05-10', poltrona: '01' }], financeiro: financeiro('2026-12-01') }, VIAGEM, HOJE)
    expect(p.map(x => x.chave)).toContain('documentos')
  })

  it('viagem internacional cobra passaporte; a mesma reserva nacional passa', () => {
    const reserva = { status: 'pre-reserva' as const, passageiros: [PAX_OK], financeiro: financeiro('2026-12-01') }
    expect(passosDaReserva(reserva, { ...VIAGEM, internacional: true }, HOJE).map(x => x.chave)).toContain('documentos')
    expect(passosDaReserva(reserva, VIAGEM, HOJE).map(x => x.chave)).not.toContain('documentos')
  })

  it('poltrona só é cobrada quando a viagem TEM mapa', () => {
    const semPoltrona = { status: 'pre-reserva' as const, passageiros: [{ ...PAX_OK, poltrona: '' }], financeiro: financeiro('2026-12-01') }
    expect(passosDaReserva(semPoltrona, VIAGEM, HOJE).map(x => x.chave)).toContain('poltronas')
    // Sem veículo definido ainda não existe croqui: pedir poltrona seria pedir o impossível.
    expect(passosDaReserva(semPoltrona, { ...VIAGEM, temLayout: false }, HOJE).map(x => x.chave)).not.toContain('poltronas')
  })

  it('sem parcela nenhuma, o passo é registrar o pagamento', () => {
    const p = passosDaReserva({ status: 'pre-reserva', passageiros: [PAX_OK] }, VIAGEM, HOJE)
    expect(p.map(x => x.chave)).toContain('pagamento')
  })

  it('parcela vencida é ATRASO e vem antes de tudo', () => {
    const p = passosDaReserva({ status: 'confirmada', passageiros: [PAX_OK], financeiro: financeiro('2026-09-10') }, VIAGEM, HOJE)
    expect(p[0].chave).toBe('cobranca')
    expect(p[0].urgencia).toBe('atrasado')
    expect(temAtraso(p)).toBe(true)
  })

  it('parcela paga não cobra nada', () => {
    const p = passosDaReserva({ status: 'confirmada', passageiros: [PAX_OK], financeiro: financeiro('2026-09-10', 'pago') }, VIAGEM, HOJE)
    expect(p).toEqual([])
  })

  it('confirmar só aparece quando NADA mais falta', () => {
    const completa = { status: 'pre-reserva' as const, passageiros: [PAX_OK], financeiro: financeiro('2026-12-01') }
    expect(passosDaReserva(completa, VIAGEM, HOJE).map(x => x.chave)).toEqual(['confirmar'])
    // Faltando documento, "confirmar" NÃO pode aparecer — seria fingir venda pronta.
    const incompleta = { ...completa, passageiros: [{ nome: 'Maria', nascimento: '1990-05-10', poltrona: '01' }] }
    expect(passosDaReserva(incompleta, VIAGEM, HOJE).map(x => x.chave)).not.toContain('confirmar')
  })
})

describe('passos da viagem', () => {
  const RESERVAS = [{ status: 'confirmada' as const, passageiros: [PAX_OK], financeiro: financeiro('2026-12-01') }]

  it('viagem realizada ou cancelada não pede nada', () => {
    expect(passosDaViagem({ ...VIAGEM, status: 'realizada' }, RESERVAS, HOJE)).toEqual([])
    expect(passosDaViagem({ ...VIAGEM, status: 'cancelada' }, RESERVAS, HOJE)).toEqual([])
  })

  it('sem veículo e sem motorista, os dois passos aparecem', () => {
    const p = passosDaViagem({ ...VIAGEM, veiculoId: '', motoristas: [], temLayout: false }, RESERVAS, HOJE)
    expect(p.map(x => x.chave)).toEqual(expect.arrayContaining(['veiculo', 'motorista']))
  })

  it('longe da saída é "depois"; perto vira "agora"', () => {
    const sem = { ...VIAGEM, veiculoId: '', motoristas: [] }
    const longe = passosDaViagem(sem, RESERVAS, HOJE).find(x => x.chave === 'veiculo')
    expect(longe?.urgencia).toBe('depois')
    const perto = passosDaViagem({ ...sem, dataIda: '2026-09-25' }, RESERVAS, HOJE).find(x => x.chave === 'veiculo')
    expect(perto?.urgencia).toBe('agora')
  })

  it('reserva cancelada não conta os passageiros dela', () => {
    const comCancelada = [...RESERVAS, { status: 'cancelada' as const, passageiros: [{ nome: 'X' }] }]
    expect(passosDaViagem(VIAGEM, comCancelada, HOJE).map(x => x.chave)).not.toContain('documentos')
  })

  it('saída já passada com documento pendente é ATRASO', () => {
    const p = passosDaViagem({ ...VIAGEM, dataIda: '2026-09-15' }, [{ status: 'confirmada', passageiros: [{ nome: 'Sem Documento' }] }], HOJE)
    expect(p.find(x => x.chave === 'documentos')?.urgencia).toBe('atrasado')
  })

  it('perto da saída com saldo em aberto pede fechar o pagamento', () => {
    const p = passosDaViagem({ ...VIAGEM, dataIda: '2026-09-25' }, [{ status: 'confirmada', passageiros: [PAX_OK], financeiro: financeiro('2026-10-30') }], HOJE)
    expect(p.map(x => x.chave)).toContain('receber')
  })

  it('atraso manda no lugar de "fechar pagamento" — não se pede as duas coisas', () => {
    const p = passosDaViagem({ ...VIAGEM, dataIda: '2026-09-25' }, [{ status: 'confirmada', passageiros: [PAX_OK], financeiro: financeiro('2026-09-01') }], HOJE)
    expect(p.map(x => x.chave)).toContain('cobranca')
    expect(p.map(x => x.chave)).not.toContain('receber')
  })
})

describe('ordem e datas', () => {
  it('atrasado vem antes de agora, que vem antes de depois — empate mantém a ordem', () => {
    const ord = ordenarPassos([
      { chave: 'c', rotulo: 'c', urgencia: 'depois' },
      { chave: 'a', rotulo: 'a', urgencia: 'agora' },
      { chave: 'z', rotulo: 'z', urgencia: 'atrasado' },
      { chave: 'b', rotulo: 'b', urgencia: 'agora' },
    ])
    expect(ord.map(p => p.chave)).toEqual(['z', 'a', 'b', 'c'])
  })

  it('diasAte conta dias de calendário, sem fuso', () => {
    expect(diasAte('2026-09-19', '2026-09-25')).toBe(6)
    expect(diasAte('2026-09-19', '2026-09-19')).toBe(0)
    expect(diasAte('2026-09-19', '2026-09-15')).toBe(-4)
    // Virada de mês e de ano não podem escorregar um dia.
    expect(diasAte('2026-12-31', '2027-01-01')).toBe(1)
  })
})

describe('mínimo de passageiros e prazo de confirmação (§7)', () => {
  const PAX3 = [{ status: 'confirmada' as const, passageiros: [PAX_OK, PAX_OK, PAX_OK], financeiro: financeiro('2026-12-01') }]

  it('viagem sem mínimo cadastrado não é cobrada — é o caso de toda viagem antiga', () => {
    expect(situacaoConfirmacao({ dataIda: '2026-12-01' }, 3, HOJE)).toBeNull()
    expect(passosDaViagem(VIAGEM, PAX3, HOJE).map(x => x.chave)).not.toContain('minimo')
  })

  it('conta quanto falta e quantos dias restam para decidir', () => {
    const s = situacaoConfirmacao({ minimoPassageiros: 30, prazoConfirmacao: '2026-10-01', dataIda: '2026-12-01' }, 18, HOJE)
    expect(s).toMatchObject({ minimo: 30, tem: 18, faltam: 12, atingiu: false, diasParaDecidir: 12 })
  })

  it('sem prazo cadastrado, a própria saída é o limite', () => {
    const s = situacaoConfirmacao({ minimoPassageiros: 30, dataIda: '2026-09-25' }, 10, HOJE)
    expect(s?.diasParaDecidir).toBe(6)
  })

  it('mínimo atingido não gera passo', () => {
    const p = passosDaViagem({ ...VIAGEM, minimoPassageiros: 3, prazoConfirmacao: '2026-11-01' }, PAX3, HOJE)
    expect(p.map(x => x.chave)).not.toContain('minimo')
  })

  it('perto do prazo e sem o mínimo, o passo é AGORA e diz os números', () => {
    const p = passosDaViagem({ ...VIAGEM, minimoPassageiros: 30, prazoConfirmacao: '2026-09-25' }, PAX3, HOJE)
    const minimo = p.find(x => x.chave === 'minimo')
    expect(minimo?.urgencia).toBe('agora')
    expect(minimo?.detalhe).toContain('precisa de 30, tem 3')
  })

  it('prazo vencido sem o mínimo é ATRASO e manda decidir', () => {
    const p = passosDaViagem({ ...VIAGEM, minimoPassageiros: 30, prazoConfirmacao: '2026-09-01' }, PAX3, HOJE)
    const minimo = p.find(x => x.chave === 'minimo')
    expect(minimo?.urgencia).toBe('atrasado')
    expect(minimo?.rotulo).toContain('prazo vencido')
  })

  it('vem antes de documento e poltrona — não se arruma lista de viagem que vai ser cancelada', () => {
    const p = passosDaViagem({ ...VIAGEM, minimoPassageiros: 30, prazoConfirmacao: '2026-09-25' },
      [{ status: 'confirmada', passageiros: [{ nome: 'Sem Documento' }] }], HOJE)
    expect(p[0].chave).toBe('minimo')
  })
})
