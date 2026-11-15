import { describe, it, expect } from 'vitest'
import { abasDoComercial, comercialVoltaAoCrm, ABAS_COMERCIAL_BASE } from '@/lib/abasComercial'

describe('telas do Comercial', () => {
  it('na clínica a Agenda entra; nos outros perfis a lista segue a de sempre', () => {
    expect(abasDoComercial('clinica')).toContain('agenda')
    for (const perfil of [null, undefined, 'turismo', 'cidadania', 'telefonia', 'gestao']) {
      expect(abasDoComercial(perfil)).toEqual(ABAS_COMERCIAL_BASE)
      expect(abasDoComercial(perfil)).not.toContain('agenda')
    }
  })

  it('aba fora da lista volta para o CRM; as da lista ficam', () => {
    expect(comercialVoltaAoCrm('tarefas', 'clinica', true)).toBe(true)
    expect(comercialVoltaAoCrm('crm', 'clinica', true)).toBe(false)
    expect(comercialVoltaAoCrm('agenda', 'clinica', true)).toBe(false)
    expect(comercialVoltaAoCrm('agenda', 'turismo', true)).toBe(true)
  })

  it('com o perfil ainda a caminho, a Agenda espera e o resto volta na hora', () => {
    expect(comercialVoltaAoCrm('agenda', null, false)).toBe(false)
    expect(comercialVoltaAoCrm('agenda', null, true)).toBe(true) // perfil chegou: agência
    expect(comercialVoltaAoCrm('tarefas', null, false)).toBe(true)
  })
})
