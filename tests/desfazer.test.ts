import { describe, it, expect, beforeEach } from 'vitest'
import { empilhar, retirarUltima, atalhoParaOSistema, registrarDesfazer, desfazerUltima, limparDesfazer, quantasDesfazer, LIMITE, VALIDADE_MS, type AcaoDesfazivel } from '@/lib/desfazer'

const acao = (id: string, em: number): AcaoDesfazivel => ({ id, titulo: id, em, desfazer: () => true })
const AGORA = 1_000_000

describe('desfazer — pilha do Ctrl+Z', () => {
  beforeEach(() => limparDesfazer())

  it('empilha, descarta o que venceu e guarda no máximo o limite', () => {
    const velha = acao('velha', AGORA - VALIDADE_MS - 1)
    const nova = acao('nova', AGORA)
    expect(empilhar([velha], nova, AGORA).map(a => a.id)).toEqual(['nova'])
    const cheia = Array.from({ length: LIMITE }, (_, i) => acao('a' + i, AGORA))
    const r = empilhar(cheia, acao('ultima', AGORA), AGORA)
    expect(r).toHaveLength(LIMITE)
    expect(r[0].id).toBe('a1') // a mais antiga caiu
    expect(r[LIMITE - 1].id).toBe('ultima')
  })

  it('retira a última válida e joga fora as vencidas', () => {
    const p = [acao('vencida', AGORA - VALIDADE_MS - 1), acao('boa', AGORA - 10), acao('recente', AGORA)]
    const r = retirarUltima(p, AGORA)
    expect(r.acao?.id).toBe('recente')
    expect(r.pilha.map(a => a.id)).toEqual(['boa'])
    expect(retirarUltima([acao('so-vencida', AGORA - VALIDADE_MS - 1)], AGORA)).toEqual({ pilha: [] })
    expect(retirarUltima([], AGORA).acao).toBeUndefined()
  })

  it('em campo de texto o Ctrl+Z é do navegador; fora dele é do sistema', () => {
    expect(atalhoParaOSistema({ tag: 'TEXTAREA' })).toBe(false)
    expect(atalhoParaOSistema({ tag: 'INPUT', tipo: 'text' })).toBe(false)
    expect(atalhoParaOSistema({ tag: 'input', tipo: 'number' })).toBe(false)
    expect(atalhoParaOSistema({ tag: 'DIV', editavel: true })).toBe(false)
    expect(atalhoParaOSistema({ tag: 'INPUT', tipo: 'checkbox' })).toBe(true)
    expect(atalhoParaOSistema({ tag: 'BUTTON' })).toBe(true)
    expect(atalhoParaOSistema({ tag: 'DIV' })).toBe(true)
    expect(atalhoParaOSistema(null)).toBe(true)
  })

  it('desfaz na ordem inversa e avisa quando não há mais nada', async () => {
    const feitos: string[] = []
    registrarDesfazer('primeira', () => { feitos.push('primeira'); return true })
    registrarDesfazer('segunda', async () => { feitos.push('segunda'); return true })
    expect(quantasDesfazer()).toBe(2)
    expect(await desfazerUltima()).toEqual({ ok: true, titulo: 'segunda' })
    expect(await desfazerUltima()).toEqual({ ok: true, titulo: 'primeira' })
    expect(feitos).toEqual(['segunda', 'primeira'])
    expect(await desfazerUltima()).toEqual({ ok: false, vazio: true })
  })

  it('inverso que falha (ou explode) não finge que deu certo, e a ação sai da pilha', async () => {
    registrarDesfazer('falha', () => false)
    expect(await desfazerUltima()).toEqual({ ok: false, titulo: 'falha' })
    registrarDesfazer('explode', () => { throw new Error('rede') })
    expect(await desfazerUltima()).toEqual({ ok: false, titulo: 'explode' })
    expect(await desfazerUltima()).toEqual({ ok: false, vazio: true })
  })
})
