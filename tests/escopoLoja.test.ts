import { describe, it, expect } from 'vitest'
import { resolverEscopoLoja, podeEscreverNaLoja, podeVerTodasAsLojas } from '@/lib/escopoLoja'

describe('escopoLoja — leitura (resolverEscopoLoja)', () => {
  it('admin sem loja pedida vê todas', () => {
    expect(resolverEscopoLoja({ role: 'admin' })).toEqual({ tipo: 'todas' })
  })
  it('admin com loja pedida foca nela (seletor)', () => {
    expect(resolverEscopoLoja({ role: 'admin' }, 'L2')).toEqual({ tipo: 'loja', lojaId: 'L2' })
  })
  it('admin ignora um lojaId no próprio token (dono nunca fica preso)', () => {
    expect(resolverEscopoLoja({ role: 'admin', lojaId: 'L1' })).toEqual({ tipo: 'todas' })
  })

  it('gerente sem loja fixa é gestor da rede: vê todas', () => {
    expect(resolverEscopoLoja({ role: 'gerente' })).toEqual({ tipo: 'todas' })
  })
  it('gerente sem loja fixa pode focar via seletor', () => {
    expect(resolverEscopoLoja({ role: 'gerente' }, 'L3')).toEqual({ tipo: 'loja', lojaId: 'L3' })
  })
  it('gerente COM loja fixa é gerente de UMA unidade (travado, ignora pedida)', () => {
    expect(resolverEscopoLoja({ role: 'gerente', lojaId: 'L1' }, 'L2')).toEqual({ tipo: 'loja', lojaId: 'L1' })
  })

  it('SEGURANÇA: operador travado ignora o lojaId pedido no request', () => {
    // usuario da Loja 1 tentando ler a Loja 2 pelo ?lojaId= — continua na 1.
    expect(resolverEscopoLoja({ role: 'usuario', lojaId: 'L1' }, 'L2')).toEqual({ tipo: 'loja', lojaId: 'L1' })
    expect(resolverEscopoLoja({ role: 'vendas', lojaId: 'L1' }, 'L2')).toEqual({ tipo: 'loja', lojaId: 'L1' })
  })

  it('fail-closed: usuario/vendas SEM loja = bloqueado (não vê nada)', () => {
    expect(resolverEscopoLoja({ role: 'usuario' }).tipo).toBe('bloqueado')
    expect(resolverEscopoLoja({ role: 'vendas' }).tipo).toBe('bloqueado')
    expect(resolverEscopoLoja({ role: undefined }).tipo).toBe('bloqueado')
  })

  it('espaços em branco no lojaId não contam como loja', () => {
    expect(resolverEscopoLoja({ role: 'usuario', lojaId: '   ' }).tipo).toBe('bloqueado')
    expect(resolverEscopoLoja({ role: 'admin' }, '   ')).toEqual({ tipo: 'todas' })
  })
})

describe('escopoLoja — escrita (podeEscreverNaLoja)', () => {
  it('admin escreve na loja que informar', () => {
    expect(podeEscreverNaLoja({ role: 'admin' }, 'L2')).toEqual({ ok: true, lojaId: 'L2' })
  })
  it('admin sem informar loja = 400 (não dá pra escrever em todas)', () => {
    const r = podeEscreverNaLoja({ role: 'admin' })
    expect(r).toEqual({ ok: false, status: 400, erro: 'Informe a loja.' })
  })
  it('gestor (gerente sem loja) sem informar loja = 400', () => {
    expect(podeEscreverNaLoja({ role: 'gerente' })).toMatchObject({ ok: false, status: 400 })
  })
  it('operador escreve na própria loja (alvo vazio assume a dele)', () => {
    expect(podeEscreverNaLoja({ role: 'usuario', lojaId: 'L1' })).toEqual({ ok: true, lojaId: 'L1' })
    expect(podeEscreverNaLoja({ role: 'usuario', lojaId: 'L1' }, 'L1')).toEqual({ ok: true, lojaId: 'L1' })
  })
  it('SEGURANÇA: operador NÃO escreve em loja alheia = 403', () => {
    expect(podeEscreverNaLoja({ role: 'vendas', lojaId: 'L1' }, 'L2')).toEqual({ ok: false, status: 403, erro: 'Você só pode operar na sua loja.' })
  })
  it('fail-closed: operador sem loja não escreve = 403', () => {
    expect(podeEscreverNaLoja({ role: 'usuario' }, 'L1')).toMatchObject({ ok: false, status: 403 })
  })
  it('gerente de uma unidade só escreve na dela', () => {
    expect(podeEscreverNaLoja({ role: 'gerente', lojaId: 'L1' }, 'L2')).toMatchObject({ ok: false, status: 403 })
    expect(podeEscreverNaLoja({ role: 'gerente', lojaId: 'L1' }, 'L1')).toEqual({ ok: true, lojaId: 'L1' })
  })
})

describe('podeVerTodasAsLojas', () => {
  it('admin e gerente sim; usuario/vendas/cliente não', () => {
    expect(podeVerTodasAsLojas('admin')).toBe(true)
    expect(podeVerTodasAsLojas('gerente')).toBe(true)
    expect(podeVerTodasAsLojas('usuario')).toBe(false)
    expect(podeVerTodasAsLojas('vendas')).toBe(false)
    expect(podeVerTodasAsLojas('cliente')).toBe(false)
  })
})
