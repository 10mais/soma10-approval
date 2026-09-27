import { describe, it, expect } from 'vitest'
import {
  suspender, reativar, suspenderRede, reativarRede, motivoNaoSuspende, youtubeEsperandoNoYouTube,
  redePublicada, TEXTO_MOTIVO,
} from '@/lib/suspenderPost'
import { podeGerenciarYouTube, ESCOPO_GERENCIAR } from '@/lib/youtube'

const AGORA = new Date('2026-09-27T10:00:00.000-03:00')
const FUTURO = '2026-10-01T09:00:00.000-03:00'
const PASSADO = '2026-09-20T09:00:00.000-03:00'

describe('suspender o post inteiro', () => {
  it('agendado vira rascunho e guarda o que era (a data fica)', () => {
    const r = suspender({ status: 'agendado', dataAgendada: FUTURO }, 'Ana', AGORA)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.patch.status).toBe('rascunho')
    expect(r.patch.suspenso).toEqual({ em: AGORA.toISOString(), por: 'Ana', statusAnterior: 'agendado' })
    expect(r.patch.dataAgendada).toBeUndefined() // não mexe na data
    expect(r.cancelarYouTube).toBe(false)
  })

  it('aprovado, em aprovação, ajuste, reprovado e falha também podem ser suspensos', () => {
    for (const status of ['aprovado', 'aguardando_aprovacao', 'corrigir', 'reprovado', 'falha_publicacao']) {
      expect(motivoNaoSuspende({ status })).toBeNull()
    }
  })

  it('recusa o que não está na fila ou já saiu', () => {
    expect(motivoNaoSuspende({ status: 'publicado' })).toBe('publicado')
    expect(motivoNaoSuspende({ status: 'publicando' })).toBe('publicando')
    expect(motivoNaoSuspende({ status: 'rascunho' })).toBe('rascunho')
    expect(motivoNaoSuspende({ status: 'agendado', suspenso: { em: '', por: '', statusAnterior: 'agendado' } })).toBe('ja-suspenso')
    for (const m of ['publicado', 'publicando', 'rascunho', 'ja-suspenso'] as const) expect(TEXTO_MOTIVO[m]).toBeTruthy()
  })

  it('falha parcial com vídeo já esperando no YouTube: segurar o post segura o vídeo também', () => {
    const r = suspender({ status: 'falha_publicacao', redes: ['instagram', 'youtube'], redesPublicadas: ['principal:youtube'], youtubePublicarEm: FUTURO, youtubeVideoIds: { principal: 'v1' } }, 'Ana', AGORA)
    expect(r.ok && r.cancelarYouTube).toBe(true)
    expect(r.ok && r.patch.youtubeAgendaSuspensa).toBe(true)
  })
})

describe('reativar', () => {
  const suspensoAgendado = { status: 'rascunho', dataAgendada: FUTURO, suspenso: { em: AGORA.toISOString(), por: 'Ana', statusAnterior: 'agendado' } }

  it('volta exatamente ao status de antes', () => {
    const r = reativar(suspensoAgendado, AGORA)
    expect(r.ok && r.patch.status).toBe('agendado')
    expect(r.ok && 'suspenso' in r.patch && r.patch.suspenso).toBeUndefined()
    const r2 = reativar({ status: 'rascunho', suspenso: { em: '', por: '', statusAnterior: 'aguardando_aprovacao' } }, AGORA)
    expect(r2.ok && r2.patch.status).toBe('aguardando_aprovacao')
  })

  it('agendado com a data vencida pede data nova (não publica no mesmo minuto)', () => {
    expect(reativar({ ...suspensoAgendado, dataAgendada: PASSADO }, AGORA)).toEqual({ ok: false, motivo: 'precisa-data' })
    const r = reativar({ ...suspensoAgendado, dataAgendada: PASSADO }, AGORA, FUTURO)
    expect(r.ok && r.patch.dataAgendada).toBe(new Date(FUTURO).toISOString())
  })

  it('post que não está suspenso não "reativa"', () => {
    expect(reativar({ status: 'agendado' }, AGORA)).toEqual({ ok: false, motivo: 'nao-suspenso' })
  })
})

describe('suspender uma rede só', () => {
  it('tira a rede e guarda para devolver', () => {
    const r = suspenderRede({ status: 'agendado', redes: ['instagram', 'facebook', 'youtube'] }, 'facebook', AGORA)
    expect(r.ok && r.patch.redes).toEqual(['instagram', 'youtube'])
    expect(r.ok && r.patch.redesSuspensas).toEqual(['facebook'])
  })

  it('post antigo sem `redes` é Instagram + Facebook', () => {
    const r = suspenderRede({ status: 'agendado' }, 'instagram', AGORA)
    expect(r.ok && r.patch.redes).toEqual(['facebook'])
  })

  it('não tira a última rede nem a que já publicou', () => {
    expect(suspenderRede({ status: 'agendado', redes: ['youtube'] }, 'youtube', AGORA)).toEqual({ ok: false, motivo: 'ultima-rede' })
    expect(suspenderRede({ status: 'falha_publicacao', redes: ['instagram', 'facebook'], redesPublicadas: ['principal:instagram'] }, 'instagram', AGORA)).toEqual({ ok: false, motivo: 'ja-publicada' })
    expect(suspenderRede({ status: 'agendado', redes: ['instagram'] }, 'facebook', AGORA)).toEqual({ ok: false, motivo: 'nao-marcada' })
  })

  it('falhou só na rede que foi suspensa: o post passa a publicado', () => {
    const r = suspenderRede({ status: 'falha_publicacao', redes: ['instagram', 'youtube'], redesPublicadas: ['principal:youtube'] }, 'instagram', AGORA)
    expect(r.ok && r.patch.status).toBe('publicado')
  })

  it('vídeo já no YouTube esperando a data própria: cancela lá (remoto)', () => {
    const post = { status: 'publicado', redes: ['instagram', 'youtube'] as any, redesPublicadas: ['principal:instagram', 'principal:youtube'], youtubePublicarEm: FUTURO, youtubeVideoIds: { principal: 'v1' } }
    expect(youtubeEsperandoNoYouTube(post, AGORA)).toBe(true)
    const r = suspenderRede(post, 'youtube', AGORA)
    expect(r).toEqual({ ok: true, remoto: true, patch: { youtubeAgendaSuspensa: true, atualizadoEm: AGORA.toISOString() } })
  })

  it('vídeo não listado, privado ou com a data já passada não está "esperando"', () => {
    const base = { status: 'publicado', redesPublicadas: ['principal:youtube'], youtubePublicarEm: FUTURO }
    expect(youtubeEsperandoNoYouTube({ ...base, youtubeVisibilidade: 'unlisted' }, AGORA)).toBe(false)
    expect(youtubeEsperandoNoYouTube({ ...base, youtubePublicarEm: PASSADO }, AGORA)).toBe(false)
    expect(youtubeEsperandoNoYouTube({ ...base, youtubeAgendaSuspensa: true }, AGORA)).toBe(false)
  })
})

describe('devolver uma rede', () => {
  it('volta para `redes` e sai de `redesSuspensas`', () => {
    const r = reativarRede({ status: 'agendado', redes: ['instagram'], redesSuspensas: ['facebook'] }, 'facebook', AGORA)
    expect(r.ok && r.patch.redes).toEqual(['instagram', 'facebook'])
    expect(r.ok && r.patch.redesSuspensas).toEqual([])
  })

  it('post já publicado não recebe rede de volta (a mídia foi liberada)', () => {
    expect(reativarRede({ status: 'publicado', redes: ['instagram'], redesSuspensas: ['facebook'] }, 'facebook', AGORA)).toEqual({ ok: false, motivo: 'post-publicado' })
  })

  it('liberar o vídeo segurado no YouTube exige data futura', () => {
    const post = { status: 'publicado', redesPublicadas: ['principal:youtube'], youtubeAgendaSuspensa: true, youtubePublicarEm: PASSADO }
    expect(reativarRede(post, 'youtube', AGORA)).toEqual({ ok: false, motivo: 'precisa-data-youtube' })
    const r = reativarRede(post, 'youtube', AGORA, FUTURO)
    expect(r.ok && r.remoto).toBe(true)
    expect(r.ok && r.patch.youtubePublicarEm).toBe(new Date(FUTURO).toISOString())
  })

  it('marca antiga (só "rede", sem conta) conta como publicada', () => {
    expect(redePublicada({ status: 'publicado', redesPublicadas: ['instagram'] }, 'instagram')).toBe(true)
  })
})

describe('YouTube — permissão de gerenciar', () => {
  it('canal conectado antes da permissão nova precisa reconectar', () => {
    expect(podeGerenciarYouTube(undefined)).toBe(false)
    expect(podeGerenciarYouTube(['https://www.googleapis.com/auth/youtube.upload'])).toBe(false)
    expect(podeGerenciarYouTube([ESCOPO_GERENCIAR])).toBe(true)
    expect(podeGerenciarYouTube(`https://www.googleapis.com/auth/youtube.upload ${ESCOPO_GERENCIAR}`)).toBe(true)
  })
})
