import { describe, it, expect } from 'vitest'
import { novoTokenCurto, tokenNoFormatoAntigo, tokenAbreODoc, tokenParaCompartilhar } from '@/lib/tokenLink'

// Dono, 21/10/2026: o link de documento (UUID com traços) quebrava no WhatsApp do iPhone; o de
// aprovação (20 caracteres, sem traço) não. O documento passa a usar o formato curto.
const UUID = '5573af9f-d15a-4caf-a94b-ed7a6dcc9301'

describe('tokenLink — link de documento curto, sem traço', () => {
  it('formato do link de aprovação: 20 caracteres, sem traço', () => {
    const t = novoTokenCurto(() => UUID)
    expect(t).toBe('5573af9fd15a4cafa94b')
    expect(t).toHaveLength(20)
    expect(tokenNoFormatoAntigo(t)).toBe(false)
    expect(tokenNoFormatoAntigo(UUID)).toBe(true)
  })

  it('compartilhar documento sem link: ganha o curto', () => {
    expect(tokenParaCompartilhar({}, () => UUID)).toEqual({ token: '5573af9fd15a4cafa94b', mudou: true })
  })

  it('link antigo (UUID) vira "antigo" e continua abrindo; o compartilhamento passa a ser o curto', () => {
    const r = tokenParaCompartilhar({ token: UUID }, () => '11111111-2222-4333-8444-555555555555')
    expect(r.token).toBe('11111111222243338444')
    expect(r.tokensAntigos).toEqual([UUID])
    const doc = { token: r.token, tokensAntigos: r.tokensAntigos }
    expect(tokenAbreODoc(doc, UUID)).toBe(true)       // o link que já foi mandado no WhatsApp
    expect(tokenAbreODoc(doc, r.token)).toBe(true)    // o novo
    expect(tokenAbreODoc(doc, 'outro')).toBe(false)
    expect(tokenAbreODoc(doc, '')).toBe(false)
  })

  it('link já curto não muda', () => {
    expect(tokenParaCompartilhar({ token: 'abc123', tokensAntigos: [UUID] }, () => UUID)).toEqual({ token: 'abc123', tokensAntigos: [UUID], mudou: false })
  })
})
