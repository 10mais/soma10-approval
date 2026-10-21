import { describe, it, expect, afterEach } from 'vitest'
import { abrirTarefa, registrarAbridorDeTarefa } from '@/lib/abrirTarefa'

describe('abrirTarefa — pelo painel quando ele está na tela, senão pelo link', () => {
  afterEach(() => registrarAbridorDeTarefa(null))

  it('sem painel: vai para /dashboard?tarefa=ID', () => {
    const urls: string[] = []
    abrirTarefa('t 1', u => urls.push(u))
    expect(urls).toEqual(['/dashboard?tarefa=t%201'])
  })

  it('com painel: abre direto, sem trocar de página (o 2º clique na mesma tarefa também abre)', () => {
    const abertas: string[] = []
    const urls: string[] = []
    registrarAbridorDeTarefa(id => abertas.push(id))
    abrirTarefa('t1', u => urls.push(u))
    abrirTarefa('t1', u => urls.push(u))
    expect(abertas).toEqual(['t1', 't1'])
    expect(urls).toEqual([])
  })

  it('id vazio não faz nada', () => {
    const urls: string[] = []
    abrirTarefa('', u => urls.push(u))
    expect(urls).toEqual([])
  })
})
