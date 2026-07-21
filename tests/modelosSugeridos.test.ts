import { describe, it, expect } from 'vitest'
import { MODELOS_SUGERIDOS, sugestoesParaPerfil } from '@/lib/modelosSugeridos'
import { planejarModelo } from '@/lib/aplicarModelo'

// Conteúdo escrito à mão vira dado gravado no Redis: uma categoria com typo
// nasce como marco 'outro' silencioso, e um marcoIndice fora da faixa solta a
// tarefa da etapa sem avisar ninguém. Estes testes são o revisor desse texto.
const CATEGORIAS = ['social_media', 'trafego', 'branding', 'landing_page', 'estrategia', 'reuniao', 'entrega', 'outro']
const TIPOS = ['tarefa', 'carrossel', 'criativo', 'video', 'reel', 'story', 'post', 'estrategia', 'planejamento']
const PRIORIDADES = ['baixa', 'media', 'alta', 'urgente']

describe('MODELOS_SUGERIDOS — integridade do conteúdo', () => {
  it('tem chave única', () => {
    const chaves = MODELOS_SUGERIDOS.map(m => m.chave)
    expect(new Set(chaves).size).toBe(chaves.length)
  })

  for (const m of MODELOS_SUGERIDOS) {
    describe(m.nome, () => {
      it('tem nome, descrição e ao menos uma etapa', () => {
        expect(m.nome.trim()).not.toBe('')
        expect(m.descricao.trim()).not.toBe('')
        expect(m.marcos.length).toBeGreaterThan(0)
      })

      it('toda etapa tem título e categoria válida', () => {
        for (const e of m.marcos) {
          expect(e.titulo.trim()).not.toBe('')
          expect(CATEGORIAS).toContain(e.categoria)
        }
      })

      it('toda tarefa tem título, tipo e prioridade válidos', () => {
        for (const t of m.tarefas) {
          expect(t.titulo.trim()).not.toBe('')
          expect(TIPOS).toContain(t.tipo)
          expect(PRIORIDADES).toContain(t.prioridade)
        }
      })

      it('nenhuma tarefa aponta para etapa inexistente', () => {
        for (const t of m.tarefas) {
          if (typeof t.marcoIndice !== 'number') continue
          expect(t.marcoIndice).toBeGreaterThanOrEqual(0)
          expect(t.marcoIndice).toBeLessThan(m.marcos.length)
        }
      })

      it('aplicado, todas as tarefas caem numa etapa de verdade', () => {
        const plano = planejarModelo(m, new Date('2026-08-03T00:00:00.000Z'))
        // Nenhuma tarefa do seed pode virar tarefa solta: no seed, solta = erro de digitação.
        for (const t of plano.tarefas) expect(typeof t.etapaIndice).toBe('number')
      })
    })
  }
})

describe('sugestoesParaPerfil', () => {
  it('agência (perfil nulo) vê o ciclo mensal de social media', () => {
    const chaves = sugestoesParaPerfil(null).map(m => m.chave)
    expect(chaves).toContain('social-mensal')
  })

  it('perfil desconhecido cai na agência, como abasOcultasDoPerfil', () => {
    expect(sugestoesParaPerfil('inexistente')).toEqual(sugestoesParaPerfil(null))
  })

  it('gestão não recebe os modelos de social media', () => {
    const chaves = sugestoesParaPerfil('gestao').map(m => m.chave)
    expect(chaves).not.toContain('social-mensal')
    expect(chaves).not.toContain('onboarding')
    expect(chaves).toContain('projeto-padrao')
  })

  it('todo perfil que enxerga a tela recebe ao menos uma sugestão', () => {
    for (const p of [null, 'gestao']) expect(sugestoesParaPerfil(p).length).toBeGreaterThan(0)
  })
})
