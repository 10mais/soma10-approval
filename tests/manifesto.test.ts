import { describe, it, expect } from 'vitest'
import {
  cpfValido, soDigitos, pendenciasDoPassageiro, passageiroPronto, passageiroSalvavel,
  linhasManifesto, manifestoCSV, campoCSV, nomeArquivoManifesto,
  type PassageiroLite, type ReservaLite,
} from '@/lib/manifesto'

// A lista vai para o DAER/ANTT (ou a internacional). Dado faltando = lista
// rejeitada na véspera da viagem. E poltrona NÃO é requisito de lista: o
// passageiro é cadastrado na venda, o assento é atribuído depois.

const pax = (o: Partial<PassageiroLite> = {}): PassageiroLite => ({
  nome: 'João da Silva', cpf: '52998224725', nascimento: '1990-05-10', ...o,
})

describe('cpfValido', () => {
  it('aceita CPF válido, com ou sem máscara', () => {
    expect(cpfValido('52998224725')).toBe(true)
    expect(cpfValido('529.982.247-25')).toBe(true)
  })

  it('recusa dígito verificador errado', () => {
    expect(cpfValido('52998224726')).toBe(false)
    expect(cpfValido('12345678901')).toBe(false)
  })

  it('recusa sequência repetida — 11 dígitos não basta', () => {
    expect(cpfValido('11111111111')).toBe(false)
    expect(cpfValido('00000000000')).toBe(false)
  })

  it('recusa tamanho errado e vazio', () => {
    expect(cpfValido('5299822472')).toBe(false)
    expect(cpfValido('')).toBe(false)
    expect(cpfValido(undefined)).toBe(false)
  })

  it('soDigitos limpa a máscara', () => {
    expect(soDigitos('529.982.247-25')).toBe('52998224725')
    expect(soDigitos(undefined)).toBe('')
  })
})

describe('pendenciasDoPassageiro — nacional', () => {
  it('passageiro completo não tem pendência', () => {
    expect(pendenciasDoPassageiro(pax())).toEqual([])
    expect(passageiroPronto(pax())).toBe(true)
  })

  it('exige nome COMPLETO — a lista pede nome civil', () => {
    expect(pendenciasDoPassageiro(pax({ nome: 'João' }))).toContain('sobrenome')
    expect(pendenciasDoPassageiro(pax({ nome: '' }))).toContain('nome')
  })

  it('aceita RG no lugar do CPF', () => {
    expect(pendenciasDoPassageiro(pax({ cpf: '', rg: '1234567', rgOrgao: 'SSP/RS' }))).toEqual([])
  })

  it('cobra documento quando não tem NENHUM', () => {
    expect(pendenciasDoPassageiro(pax({ cpf: '', rg: '' }))).toContain('CPF ou RG')
  })

  it('acusa CPF inválido em vez de deixar passar', () => {
    expect(pendenciasDoPassageiro(pax({ cpf: '11111111111' }))).toContain('CPF inválido')
  })

  it('exige nascimento', () => {
    expect(pendenciasDoPassageiro(pax({ nascimento: '' }))).toContain('nascimento')
    expect(pendenciasDoPassageiro(pax({ nascimento: '10/05/1990' }))).toContain('nascimento')
  })

  it('NÃO exige poltrona — o assento é atribuído depois', () => {
    expect(pendenciasDoPassageiro(pax({ poltrona: undefined }))).toEqual([])
  })

  it('não cobra passaporte em viagem nacional', () => {
    expect(pendenciasDoPassageiro(pax({ passaporte: '' }), false)).toEqual([])
  })
})

describe('pendenciasDoPassageiro — internacional', () => {
  it('exige passaporte, validade e nacionalidade', () => {
    const p = pendenciasDoPassageiro(pax(), true)
    expect(p).toContain('passaporte')
    expect(p).toContain('validade do passaporte')
    expect(p).toContain('nacionalidade')
  })

  it('completo para internacional não tem pendência', () => {
    const p = pax({ passaporte: 'AB123456', passaporteValidade: '2030-01-01', nacionalidade: 'Brasileira' })
    expect(pendenciasDoPassageiro(p, true)).toEqual([])
  })

  it('validade mal formada conta como pendência', () => {
    const p = pax({ passaporte: 'AB123456', passaporteValidade: '01/2030', nacionalidade: 'Brasileira' })
    expect(pendenciasDoPassageiro(p, true)).toContain('validade do passaporte')
  })
})

describe('passageiroSalvavel', () => {
  it('só o nome basta para SALVAR — o resto avisa mas não trava a venda', () => {
    expect(passageiroSalvavel({ nome: 'João' })).toBe(true)
    expect(passageiroSalvavel({ nome: 'João', poltrona: undefined })).toBe(true)
  })

  it('sem nome não salva', () => {
    expect(passageiroSalvavel({ nome: '' })).toBe(false)
    expect(passageiroSalvavel({ nome: '   ' })).toBe(false)
    expect(passageiroSalvavel({})).toBe(false)
  })
})

describe('linhasManifesto', () => {
  const reservas: ReservaLite[] = [
    { contratanteNome: 'Willian', status: 'confirmada', passageiros: [pax({ nome: 'Ana Souza', poltrona: '10' })] },
    { contratanteNome: 'Willian', status: 'confirmada', passageiros: [pax({ nome: 'Bruno Lima', poltrona: '2' })] },
  ]

  it('uma linha por passageiro, ordenada por poltrona (numérica, não alfabética)', () => {
    const r = [
      { contratanteNome: 'X', passageiros: [pax({ nome: 'A A', poltrona: '10' })] },
      { contratanteNome: 'X', passageiros: [pax({ nome: 'B B', poltrona: '9' })] },
    ]
    expect(linhasManifesto({}, r).map(l => l.poltrona)).toEqual(['9', '10'])
  })

  it('sem poltrona vai para o fim, ordenado por nome', () => {
    const r: ReservaLite[] = [
      { contratanteNome: 'X', passageiros: [pax({ nome: 'Zeca Zi' }), pax({ nome: 'Ana Aa' }), pax({ nome: 'Com Poltrona', poltrona: '5' })] },
    ]
    expect(linhasManifesto({}, r).map(l => l.nome)).toEqual(['Com Poltrona', 'Ana Aa', 'Zeca Zi'])
  })

  it('reserva CANCELADA não entra na lista', () => {
    const r: ReservaLite[] = [...reservas, { contratanteNome: 'Y', status: 'cancelada', passageiros: [pax({ nome: 'Fantasma Silva' })] }]
    expect(linhasManifesto({}, r).map(l => l.nome)).not.toContain('Fantasma Silva')
    expect(linhasManifesto({}, r)).toHaveLength(2)
  })

  it('documento nacional mostra CPF formatado e RG', () => {
    const r: ReservaLite[] = [{ contratanteNome: 'X', passageiros: [pax({ rg: '1234567', rgOrgao: 'SSP/RS' })] }]
    expect(linhasManifesto({}, r)[0].documento).toBe('CPF 529.982.247-25 · RG 1234567/SSP/RS')
  })

  it('internacional troca o documento por passaporte + nacionalidade', () => {
    const r: ReservaLite[] = [{ contratanteNome: 'X', passageiros: [pax({ passaporte: 'AB123456', nacionalidade: 'Brasileira' })] }]
    expect(linhasManifesto({ internacional: true }, r)[0].documento).toBe('Passaporte AB123456 · Brasileira')
  })

  it('carrega as pendências para a lista denunciar quem está incompleto', () => {
    const r: ReservaLite[] = [{ contratanteNome: 'X', passageiros: [{ nome: 'Só Nome' }] }]
    expect(linhasManifesto({}, r)[0].pendencias).toContain('CPF ou RG')
  })

  it('nascimento sai em pt-BR', () => {
    expect(linhasManifesto({}, reservas)[0].nascimento).toBe('10/05/1990')
  })

  it('sem reservas devolve lista vazia', () => {
    expect(linhasManifesto({}, [])).toEqual([])
    expect(linhasManifesto({}, [{ contratanteNome: 'X', passageiros: [] }])).toEqual([])
  })
})

describe('campoCSV', () => {
  it('envelopa o que tem vírgula, ponto-e-vírgula ou aspas', () => {
    expect(campoCSV('Silva, João')).toBe('"Silva, João"')
    expect(campoCSV('a;b')).toBe('"a;b"')
    expect(campoCSV('João "Jota"')).toBe('"João ""Jota"""')
  })

  it('deixa em paz o texto simples', () => {
    expect(campoCSV('João da Silva')).toBe('João da Silva')
    expect(campoCSV('')).toBe('')
  })
})

describe('manifestoCSV', () => {
  const reservas: ReservaLite[] = [{ contratanteNome: 'Willian', passageiros: [pax({ nome: 'Ana Souza', poltrona: '3' })] }]

  it('tem BOM (Excel pt-BR abre em colunas), separador ; e CRLF', () => {
    const csv = manifestoCSV({ titulo: 'Rio' }, reservas)
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('Poltrona;Nome completo;Documento;Nascimento;Contratante;Pendências')
    expect(csv).toContain('\r\n')
  })

  it('uma linha por passageiro', () => {
    const csv = manifestoCSV({}, reservas)
    expect(csv.split('\r\n')).toHaveLength(2) // cabeçalho + 1
    expect(csv).toContain('3;Ana Souza;CPF 529.982.247-25;10/05/1990;Willian;')
  })

  it('cabeçalho muda em viagem internacional', () => {
    expect(manifestoCSV({ internacional: true }, reservas)).toContain('Passaporte / Nacionalidade')
  })

  it('nome com vírgula não quebra a planilha', () => {
    const r: ReservaLite[] = [{ contratanteNome: 'X', passageiros: [pax({ nome: 'Silva, João' })] }]
    expect(manifestoCSV({}, r)).toContain('"Silva, João"')
  })
})

describe('nomeArquivoManifesto', () => {
  it('slug sem acento e com a data da ida', () => {
    expect(nomeArquivoManifesto({ titulo: 'RIO DE JANEIRO E PARATY', dataIda: '2026-07-27' }))
      .toBe('manifesto-rio-de-janeiro-e-paraty-27-07-2026.csv')
  })

  it('aguenta título vazio e sem data', () => {
    expect(nomeArquivoManifesto({})).toBe('manifesto-viagem.csv')
  })
})
