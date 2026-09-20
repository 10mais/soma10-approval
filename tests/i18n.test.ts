import { describe, it, expect } from 'vitest'
import { t, nomeDaArea, normalizarIdioma, idiomasDisponiveis, localeDe, TEXTOS, IDIOMAS } from '@/lib/i18n'
import { ABAS_PERM } from '@/lib/permissoesGranular'

describe('i18n — o português vira um só', () => {
  it('os nomes em inglês do sistema viram os nomes escolhidos pelo dono (20/09)', () => {
    expect(nomeDaArea('planner')).toBe('Programador de postagens')
    expect(nomeDaArea('studio')).toBe('Estúdio')
    expect(nomeDaArea('lista-pessoal')).toBe('Anotações')
    expect(nomeDaArea('inbox')).toBe('Caixa de entrada')
    expect(nomeDaArea('playbook')).toBe('Plano de entregas')
    expect(nomeDaArea('analytics')).toBe('Desempenho')
    expect(nomeDaArea('listening')).toBe('Escuta social')
    expect(nomeDaArea('home')).toBe('Painel')
  })

  it('CRM continua CRM (decisão do dono) e nenhum nome de área fica em inglês', () => {
    expect(nomeDaArea('crm')).toBe('CRM')
    const emIngles = /\b(planner|studio|playbook|inbox|analytics|listening|board|dashboard|personal list)\b/i
    const errados = Object.entries(TEXTOS)
      .filter(([k]) => k.startsWith('nav.') && k !== 'nav.crm')
      .filter(([, v]) => emIngles.test(v.pt))
    expect(errados).toEqual([])
  })
})

describe('i18n — os outros idiomas', () => {
  it('a mesma chave responde em inglês', () => {
    expect(nomeDaArea('planner', 'en')).toBe('Post scheduler')
    expect(nomeDaArea('playbook', 'en')).toBe('Delivery plan')
    expect(nomeDaArea('lista-pessoal', 'en')).toBe('Notes')
    expect(t('termo.idioma', 'en')).toBe('Language')
  })

  it('toda chave tem português e inglês; espanhol pode faltar e cai no português', () => {
    const semIngles = Object.entries(TEXTOS).filter(([, v]) => !v.pt?.trim() || v.en === undefined)
    expect(semIngles).toEqual([])
    // texto vazio de propósito (o "há" de "há 5 min" não existe em inglês) não vira português
    expect(t('tempo.ha', 'en')).toBe('')
    expect(t('nav.planner', 'es')).toBe('Programador de publicaciones')
    expect(t('termo.quadro', 'es')).toBe('Tablero')
  })

  it('espanhol ainda não é escolhível: idioma pela metade é pior que idioma nenhum', () => {
    expect(idiomasDisponiveis().map(i => i.chave)).toEqual(['pt', 'en'])
    expect(IDIOMAS.find(i => i.chave === 'es')?.pronto).toBe(false)
  })

  it('chave que não existe volta ela mesma, para aparecer torto e ser corrigida', () => {
    expect(t('nav.inventada')).toBe('nav.inventada')
  })

  it('o que vem do banco ou do navegador vira idioma válido', () => {
    expect(normalizarIdioma('en')).toBe('en')
    expect(normalizarIdioma('en-US')).toBe('en')
    expect(normalizarIdioma('pt-BR')).toBe('pt')
    expect(normalizarIdioma('es')).toBe('pt') // ainda não está pronto
    expect(normalizarIdioma(undefined)).toBe('pt')
    expect(normalizarIdioma('klingon')).toBe('pt')
  })
})

describe('i18n — nenhuma aba fica sem nome', () => {
  it('toda aba do catálogo de permissões tem texto no dicionário', () => {
    const semTexto = ABAS_PERM.filter(a => !TEXTOS[`nav.${a.key}`]).map(a => a.key)
    expect(semTexto).toEqual([])
  })

  it('o rótulo do catálogo é o mesmo nome do dicionário (uma fonte só)', () => {
    const divergentes = ABAS_PERM.filter(a => a.label !== nomeDaArea(a.key)).map(a => `${a.key}: ${a.label}`)
    expect(divergentes).toEqual([])
  })
})

describe('i18n — data e número seguem o idioma de quem lê', () => {
  it('cada idioma tem o seu locale (nunca o da máquina que roda o build)', () => {
    expect(localeDe('pt')).toBe('pt-BR')
    expect(localeDe('en')).toBe('en-US')
    expect(localeDe('es')).toBe('es-ES')
    expect(localeDe()).toBe('pt-BR')
  })

  it('o mês sai no idioma pedido', () => {
    const d = new Date(Date.UTC(2026, 8, 20))
    expect(d.toLocaleDateString(localeDe('pt'), { month: 'long', timeZone: 'UTC' })).toBe('setembro')
    expect(d.toLocaleDateString(localeDe('en'), { month: 'long', timeZone: 'UTC' })).toBe('September')
  })
})
