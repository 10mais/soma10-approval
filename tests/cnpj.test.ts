import { describe, it, expect } from 'vitest'
import { formatarCnpj, cnpjValido, soDigitosCnpj, formatarCpf, cpfValido, soDigitosCpf, formatarDoc, docValido, tipoDoc, soDigitosDoc } from '@/lib/cnpj'

// O campo é opcional, mas CNPJ errado é pior que vazio: ninguém confere de novo
// e ele acaba em contrato e nota. A conferência é dos dígitos (módulo 11) — não
// diz que a empresa existe, só que o número é possível.

describe('formatarCnpj', () => {
  it('formata conforme digita, sem pular à frente', () => {
    expect(formatarCnpj('1')).toBe('1')
    expect(formatarCnpj('12')).toBe('12')
    expect(formatarCnpj('123')).toBe('12.3')
    expect(formatarCnpj('12345')).toBe('12.345')
    expect(formatarCnpj('12345678')).toBe('12.345.678')
    expect(formatarCnpj('123456780001')).toBe('12.345.678/0001')
    expect(formatarCnpj('12345678000195')).toBe('12.345.678/0001-95')
  })

  it('ignora o que não é dígito e não passa de 14', () => {
    expect(formatarCnpj('12.345.678/0001-95')).toBe('12.345.678/0001-95')
    expect(formatarCnpj('12345678000195999')).toBe('12.345.678/0001-95')
    expect(formatarCnpj('')).toBe('')
    expect(formatarCnpj(undefined)).toBe('')
  })
})

describe('cnpjValido', () => {
  it('aceita CNPJ real (dígitos batem)', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true)
    expect(cnpjValido('11222333000181')).toBe(true)
  })

  it('recusa dígito verificador errado (o erro de digitação comum)', () => {
    expect(cnpjValido('11.222.333/0001-82')).toBe(false)
    expect(cnpjValido('11.222.334/0001-81')).toBe(false)
  })

  it('recusa incompleto', () => {
    expect(cnpjValido('11.222.333/0001')).toBe(false)
    expect(cnpjValido('')).toBe(false)
    expect(cnpjValido(undefined)).toBe(false)
  })

  it('recusa dígito repetido — passa no módulo 11 e não existe', () => {
    expect(cnpjValido('00000000000000')).toBe(false)
    expect(cnpjValido('11111111111111')).toBe(false)
  })
})

describe('soDigitosCnpj', () => {
  it('deixa só número, no máximo 14', () => {
    expect(soDigitosCnpj('12.345.678/0001-95')).toBe('12345678000195')
    expect(soDigitosCnpj('abc')).toBe('')
  })
})

// ————— CPF —————

describe('formatarCpf', () => {
  it('formata conforme digita, sem pular à frente', () => {
    expect(formatarCpf('1')).toBe('1')
    expect(formatarCpf('123')).toBe('123')
    expect(formatarCpf('1234')).toBe('123.4')
    expect(formatarCpf('1234567')).toBe('123.456.7')
    expect(formatarCpf('123456789')).toBe('123.456.789')
    expect(formatarCpf('11144477735')).toBe('111.444.777-35')
  })

  it('ignora o que não é dígito e não passa de 11', () => {
    expect(formatarCpf('111.444.777-35')).toBe('111.444.777-35')
    expect(formatarCpf('11144477735999')).toBe('111.444.777-35')
    expect(formatarCpf('')).toBe('')
    expect(formatarCpf(undefined)).toBe('')
  })
})

describe('cpfValido', () => {
  it('aceita CPF real (dígitos batem)', () => {
    expect(cpfValido('111.444.777-35')).toBe(true)
    expect(cpfValido('11144477735')).toBe(true)
  })
  it('recusa dígito verificador errado', () => {
    expect(cpfValido('111.444.777-34')).toBe(false)
  })
  it('recusa incompleto', () => {
    expect(cpfValido('111.444.777')).toBe(false)
    expect(cpfValido('')).toBe(false)
    expect(cpfValido(undefined)).toBe(false)
  })
  it('recusa dígito repetido', () => {
    expect(cpfValido('00000000000')).toBe(false)
    expect(cpfValido('11111111111')).toBe(false)
  })
})

describe('soDigitosCpf', () => {
  it('deixa só número, no máximo 11', () => {
    expect(soDigitosCpf('111.444.777-35')).toBe('11144477735')
    expect(soDigitosCpf('11144477735999')).toBe('11144477735')
  })
})

// ————— CPF ou CNPJ (campo único do varejo) —————

describe('formatarDoc', () => {
  it('até 11 dígitos formata CPF; a partir daí, CNPJ', () => {
    expect(formatarDoc('11144477735')).toBe('111.444.777-35')
    expect(formatarDoc('11222333000181')).toBe('11.222.333/0001-81')
    expect(formatarDoc('123')).toBe('123')
  })
})

describe('docValido', () => {
  it('confere como CPF (11) ou CNPJ (14)', () => {
    expect(docValido('111.444.777-35')).toBe(true)
    expect(docValido('11.222.333/0001-81')).toBe(true)
  })
  it('recusa contagem intermediária e DV errado', () => {
    expect(docValido('123')).toBe(false)
    expect(docValido('111.444.777-34')).toBe(false)
    expect(docValido('11.222.333/0001-82')).toBe(false)
  })
})

describe('tipoDoc', () => {
  it('rotula pelo número de dígitos', () => {
    expect(tipoDoc('')).toBe('vazio')
    expect(tipoDoc('111.444.777-35')).toBe('cpf')
    expect(tipoDoc('11222333000181')).toBe('cnpj')
    expect(tipoDoc('123')).toBe('incompleto')
  })
})

describe('soDigitosDoc', () => {
  it('deixa só número, no máximo 14', () => {
    expect(soDigitosDoc('111.444.777-35')).toBe('11144477735')
    expect(soDigitosDoc('12.345.678/0001-95')).toBe('12345678000195')
  })
})
