import { describe, it, expect } from 'vitest'
import { storeIdDoToken, urlDoBlob, nomeSeguro, normalizarData, validarPostagem, acharCliente, ferramentasEscrita, ehFerramentaEscrita } from '@/lib/mcpEscrita'

const STORE = 'AbC123xyz'
const URL_OK = 'https://abc123xyz.public.blob.vercel-storage.com/midia/mcp-1-Feed_01-k3j2.png'

describe('mcpEscrita — postagens em massa pelo conector', () => {
  it('lê o id do store do token rw', () => {
    expect(storeIdDoToken('vercel_blob_rw_AbC123xyz_segredoLongo')).toBe('AbC123xyz')
    expect(storeIdDoToken('qualquer')).toBe('')
    expect(storeIdDoToken(undefined)).toBe('')
  })

  it('aceita só mídia do Blob deste sistema', () => {
    expect(urlDoBlob(URL_OK, STORE)).toBe(true)
    expect(urlDoBlob('https://outro.public.blob.vercel-storage.com/x.png', STORE)).toBe(false)
    expect(urlDoBlob('https://exemplo.com/x.png', STORE)).toBe(false)
    expect(urlDoBlob('http://abc123xyz.public.blob.vercel-storage.com/x.png', STORE)).toBe(false)
    expect(urlDoBlob('não é url', STORE)).toBe(false)
    // sem store conhecido, vale qualquer Blob público
    expect(urlDoBlob('https://outro.public.blob.vercel-storage.com/x.png', '')).toBe(true)
  })

  it('nome de arquivo vira pathname seguro', () => {
    expect(nomeSeguro('Feed 01 – Adesão.png')).toBe('Feed-01-Adesao.png')
    expect(nomeSeguro('C:\\pasta\\..\\x.png')).toBe('x.png')
    expect(nomeSeguro('')).toBe('arquivo')
  })

  it('data: datetime-local fica, só o dia vira 09:00, data impossível é recusada', () => {
    expect(normalizarData('2026-11-20T18:30')).toBe('2026-11-20T18:30')
    expect(normalizarData('2026-11-20 18:30')).toBe('2026-11-20T18:30')
    expect(normalizarData('2026-11-20')).toBe('2026-11-20T09:00')
    expect(normalizarData('')).toBe('')
    expect(normalizarData(undefined)).toBe('')
    expect(normalizarData('2026-02-30')).toBeNull()
    expect(normalizarData('2026-11-20T25:00')).toBeNull()
    expect(normalizarData('20/11/2026')).toBeNull()
  })

  it('nunca cria post agendado (o cron publicaria sozinho)', () => {
    const r = validarPostagem({ cliente: 'X', imagens: [URL_OK], status: 'agendado' }, STORE)
    expect(r.ok).toBe(false)
    const padrao = validarPostagem({ cliente: 'X', imagens: [URL_OK] }, STORE)
    expect(padrao.ok && padrao.valor.status).toBe('rascunho')
    expect(padrao.ok && padrao.valor.formato).toBe('feed')
    const aprov = validarPostagem({ cliente: 'X', imagens: [URL_OK], status: 'aguardando_aprovacao' }, STORE)
    expect(aprov.ok && aprov.valor.status).toBe('aguardando_aprovacao')
  })

  it('valida imagens, carrossel, formato e legenda', () => {
    expect(validarPostagem({ cliente: 'X', imagens: [] }, STORE).ok).toBe(false)
    expect(validarPostagem({ cliente: 'X', imagens: [URL_OK], formato: 'carrossel' }, STORE).ok).toBe(false)
    expect(validarPostagem({ cliente: 'X', imagens: [URL_OK, URL_OK], formato: 'carrossel' }, STORE).ok).toBe(true)
    expect(validarPostagem({ cliente: 'X', imagens: [URL_OK], formato: 'podcast' }, STORE).ok).toBe(false)
    expect(validarPostagem({ cliente: 'X', imagens: [URL_OK], legenda: 'a'.repeat(2201) }, STORE).ok).toBe(false)
    expect(validarPostagem({ imagens: [URL_OK] }, STORE).ok).toBe(false)
    const colab = validarPostagem({ cliente: 'X', imagens: [URL_OK], colaboradores: ['@Sicredi', 'sicredi', '@a', '@b', '@c'] }, STORE)
    expect(colab.ok && colab.valor.colaboradores).toEqual(['sicredi', 'a', 'b'])
  })

  it('acha o cliente pelo nome, sem acento e sem chute quando é ambíguo', () => {
    const clientes = [{ nome: 'Sindilojas Missões' }, { nome: 'Norah Clínica' }, { nome: 'Norah Estética' }]
    expect(acharCliente(clientes, 'sindilojas missoes')).toEqual({ cliente: clientes[0] })
    expect(acharCliente(clientes, 'Sindilojas')).toEqual({ cliente: clientes[0] })
    expect('erro' in acharCliente(clientes, 'Norah')).toBe(true)
    expect('erro' in acharCliente(clientes, 'Fulano')).toBe(true)
  })

  it('catálogo: duas ferramentas, reconhecidas pelo nome', () => {
    expect(ferramentasEscrita().map(t => t.name)).toEqual(['preparar_upload_midia', 'criar_postagens'])
    expect(ehFerramentaEscrita('criar_postagens')).toBe(true)
    expect(ehFerramentaEscrita('consultar_tarefas')).toBe(false)
  })
})
