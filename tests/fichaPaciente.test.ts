import { describe, it, expect } from 'vitest'
import { sanitizarFicha, camposPreenchidos, alertaAlergia, fundirFichas, novaAnotacao, juntarAnotacao, fundirAnotacoes, categoriaAnotacao, MAX_ANOTACOES, type AnotacaoPaciente } from '@/lib/fichaPaciente'

// Instantes montados com o construtor local (sem 'Z'), comparados só entre si.
const em = (dia: number, hora = 10) => new Date(2026, 10, dia, hora, 0).toISOString()
const ctx = (id: string, dia = 4) => ({ id, autor: 'Recepção', agora: em(dia, 15) })

describe('ficha clínica', () => {
  it('guarda só campos conhecidos, aparados; campo vazio sai e ficha vazia vira undefined', () => {
    expect(sanitizarFicha({ alergias: '  Dipirona ', medicamentos: '', hackeado: 'x' })).toEqual({ alergias: 'Dipirona' })
    expect(sanitizarFicha({ alergias: '   ' })).toBeUndefined()
    expect(sanitizarFicha(null)).toBeUndefined()
    expect(sanitizarFicha('texto')).toBeUndefined()
  })

  it('corta o texto no teto do campo', () => {
    expect(sanitizarFicha({ profissao: 'x'.repeat(500) })!.profissao).toHaveLength(80)
  })

  it('conta os campos preenchidos', () => {
    expect(camposPreenchidos({ alergias: 'Látex', cidade: 'Santo Ângelo' })).toBe(2)
    expect(camposPreenchidos(undefined)).toBe(0)
  })

  it('alergia de verdade acende o alerta; resposta negativa não', () => {
    expect(alertaAlergia({ alergias: 'Dipirona e lidocaína' })).toBe('Dipirona e lidocaína')
    for (const negativa of ['Nenhuma', 'não tem', 'Nega alergias', 'Sem alergias conhecidas', 'nada', 'N/A', '-']) {
      expect(alertaAlergia({ alergias: negativa })).toBeNull()
    }
    expect(alertaAlergia({})).toBeNull()
  })

  it('mesclar cadastros: a principal manda, a outra preenche o que falta', () => {
    expect(fundirFichas({ alergias: 'Dipirona' }, { alergias: 'Látex', cidade: 'Ijuí' })).toEqual({ alergias: 'Dipirona', cidade: 'Ijuí' })
    expect(fundirFichas(undefined, undefined)).toBeUndefined()
  })
})

describe('o que sabemos (anotações)', () => {
  it('monta a nota: texto obrigatório, categoria e origem desconhecidas caem no padrão', () => {
    expect(novaAnotacao({ texto: '  ' }, ctx('n1'))).toEqual({ erro: 'escreva o que anotar' })
    const n = novaAnotacao({ texto: 'Prefere manhã', categoria: 'inventada', origem: 'pombo' }, ctx('n1')) as AnotacaoPaciente
    expect(n).toMatchObject({ id: 'n1', texto: 'Prefere manhã', categoria: 'outro', origem: 'ficha', autor: 'Recepção', em: em(4, 15) })
    expect(n.msgId).toBeUndefined()
  })

  it('do WhatsApp guarda a mensagem de origem e a HORA DA MENSAGEM', () => {
    const n = novaAnotacao({ texto: 'Tenho alergia a dipirona', categoria: 'saude', origem: 'whatsapp', em: em(2, 9), msgId: 'wamid.1' }, ctx('n2')) as AnotacaoPaciente
    expect(n).toMatchObject({ categoria: 'saude', origem: 'whatsapp', msgId: 'wamid.1', em: em(2, 9) })
  })

  it('data inválida vira agora', () => {
    const n = novaAnotacao({ texto: 'x', em: 'ontem' }, ctx('n3')) as AnotacaoPaciente
    expect(n.em).toBe(em(4, 15))
  })

  it('junta em ordem (mais recente primeiro) e a mesma mensagem salva de novo SUBSTITUI', () => {
    const a = novaAnotacao({ texto: 'Casa em dezembro', categoria: 'pessoal', em: em(1) }, ctx('a')) as AnotacaoPaciente
    const b = novaAnotacao({ texto: 'Alergia a dipirona', origem: 'whatsapp', msgId: 'm1', em: em(3) }, ctx('b')) as AnotacaoPaciente
    let lista = juntarAnotacao(juntarAnotacao(undefined, a), b)
    expect(lista.map(n => n.id)).toEqual(['b', 'a'])
    const bDeNovo = novaAnotacao({ texto: 'Alergia a dipirona (confirmado)', categoria: 'saude', origem: 'whatsapp', msgId: 'm1', em: em(3) }, ctx('b2')) as AnotacaoPaciente
    lista = juntarAnotacao(lista, bDeNovo)
    expect(lista.map(n => n.id)).toEqual(['b2', 'a'])
    expect(lista[0].categoria).toBe('saude')
  })

  it('tem teto: passando do limite, sai a mais antiga', () => {
    let lista: AnotacaoPaciente[] = []
    for (let i = 0; i < MAX_ANOTACOES + 3; i++) {
      lista = juntarAnotacao(lista, novaAnotacao({ texto: 'n' + i, em: new Date(2026, 0, 1, 0, i).toISOString() }, ctx('id' + i)) as AnotacaoPaciente)
    }
    expect(lista).toHaveLength(MAX_ANOTACOES)
    expect(lista.some(n => n.id === 'id0')).toBe(false)
    expect(lista[0].id).toBe('id' + (MAX_ANOTACOES + 2))
  })

  it('mesclar cadastros junta as notas sem repetir a mesma mensagem', () => {
    const x = novaAnotacao({ texto: 'A', origem: 'whatsapp', msgId: 'm9', em: em(5) }, ctx('x')) as AnotacaoPaciente
    const y = novaAnotacao({ texto: 'A de novo', origem: 'whatsapp', msgId: 'm9', em: em(5) }, ctx('y')) as AnotacaoPaciente
    const z = novaAnotacao({ texto: 'B', em: em(6) }, ctx('z')) as AnotacaoPaciente
    expect(fundirAnotacoes([x], [y, z])!.map(n => n.id)).toEqual(['z', 'y'])
    expect(fundirAnotacoes(undefined, undefined)).toBeUndefined()
  })

  it('categoria desconhecida mostra como "outro"', () => {
    expect(categoriaAnotacao('xyz').chave).toBe('outro')
    expect(categoriaAnotacao('saude').chave).toBe('saude')
  })
})
