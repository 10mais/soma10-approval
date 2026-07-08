import { describe, it, expect } from 'vitest'
import { generate } from 'otplib'
import { gerarSegredo, otpauthUrl, verificarCodigo } from '@/lib/twoFactor'

// Segurança de acesso: um erro aqui deixaria o 2FA aceitar código errado (falha
// grave) ou rejeitar o certo (tranca o dono para fora).

describe('2FA (TOTP)', () => {
  it('gera segredo base32 e URL otpauth com o emissor', () => {
    const s = gerarSegredo()
    expect(typeof s).toBe('string')
    expect(s.length).toBeGreaterThan(10)
    const url = otpauthUrl('joao@empresa.com', s)
    expect(url.startsWith('otpauth://totp/')).toBe(true)
    expect(url).toContain('Soma10')
    expect(url).toContain('secret=')
  })

  it('aceita o código válido do momento e rejeita entradas inválidas', async () => {
    const s = gerarSegredo()
    const token = await generate({ secret: s })
    expect(await verificarCodigo(token, s)).toBe(true) // código certo
    expect(await verificarCodigo('', s)).toBe(false) // vazio
    expect(await verificarCodigo('abcxyz', s)).toBe(false) // formato inválido
    expect(await verificarCodigo(token, undefined)).toBe(false) // sem segredo = nunca passa
  })
})
