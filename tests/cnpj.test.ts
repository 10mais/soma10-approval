import { describe, it, expect } from 'vitest'
import { formatarCnpj, cnpjValido, soDigitosCnpj } from '@/lib/cnpj'

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
