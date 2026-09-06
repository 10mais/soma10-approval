import { describe, it, expect } from 'vitest'
import { calcularBola, esperandoCliente, esperandoAgencia, diasDesde, fraseDaBola } from '@/lib/bolaDaVez'

// Esta conta aparece na tela do CLIENTE. Errar o lado é pior que não mostrar
// nada: acusa o cliente de estar segurando algo que está com a agência, ou
// esconde da agência uma aprovação parada há dias.

const AGORA = new Date('2026-09-04T12:00:00.000Z').getTime()
const dias = (n: number) => new Date(AGORA - n * 86400000).toISOString()

describe('esperandoCliente', () => {
  it('post aguardando aprovação é do cliente', () => {
    expect(esperandoCliente({ status: 'aguardando_aprovacao' })).toBe(true)
  })

  it('as duas etapas de aprovação da esteira contam', () => {
    expect(esperandoCliente({ etapa: 'aprovacao_copy' })).toBe(true)
    expect(esperandoCliente({ etapa: 'aprovacao_criativo' })).toBe(true)
  })

  it('etapa de produção NÃO é do cliente', () => {
    expect(esperandoCliente({ etapa: 'briefing' })).toBe(false)
    expect(esperandoCliente({ etapa: 'copy' })).toBe(false)
    expect(esperandoCliente({ etapa: 'criativo' })).toBe(false)
  })

  it('post que voltou para ajuste sai do lado do cliente, mesmo com a etapa antiga', () => {
    // O cliente já respondeu: a bola voltou. Sem esta regra ele apareceria
    // devendo uma aprovação que ele acabou de dar.
    expect(esperandoCliente({ status: 'corrigir', etapa: 'aprovacao_criativo' })).toBe(false)
    expect(esperandoCliente({ status: 'reprovado', etapa: 'aprovacao_copy' })).toBe(false)
  })

  it('post na lixeira não cobra ninguém', () => {
    expect(esperandoCliente({ status: 'aguardando_aprovacao', excluidoEm: dias(1) })).toBe(false)
    expect(esperandoAgencia({ status: 'corrigir', excluidoEm: dias(1) })).toBe(false)
  })

  it('publicado e agendado não pendem de ninguém', () => {
    expect(esperandoCliente({ status: 'publicado' })).toBe(false)
    expect(esperandoAgencia({ status: 'agendado' })).toBe(false)
  })
})

describe('diasDesde', () => {
  it('conta dias inteiros', () => {
    expect(diasDesde(dias(3), AGORA)).toBe(3)
    expect(diasDesde(dias(0), AGORA)).toBe(0)
  })
  it('data no futuro vira 0, nunca negativo', () => {
    expect(diasDesde(new Date(AGORA + 5 * 86400000).toISOString(), AGORA)).toBe(0)
  })
  it('data ausente ou inválida devolve undefined', () => {
    expect(diasDesde(undefined, AGORA)).toBeUndefined()
    expect(diasDesde('semana passada', AGORA)).toBeUndefined()
  })
})

describe('calcularBola', () => {
  it('sem nada pendente, a bola não é de ninguém', () => {
    const b = calcularBola([{ status: 'publicado' }], [{ status: 'concluido' }], AGORA)
    expect(b.lado).toBe('ninguem')
    expect(b.itens).toEqual([])
  })

  it('só aprovação pendente: bola do cliente', () => {
    const b = calcularBola([{ status: 'aguardando_aprovacao', briefing: 'Post de setembro', aguardandoDesde: dias(2) }], [], AGORA)
    expect(b.lado).toBe('cliente')
    expect(b.totalCliente).toBe(1)
    expect(b.diasParado).toBe(2)
  })

  it('só tarefa aberta: bola da agência', () => {
    const b = calcularBola([], [{ status: 'em_andamento', titulo: 'Produzir carrossel', atualizadoEm: dias(1) }], AGORA)
    expect(b.lado).toBe('agencia')
    expect(b.totalAgencia).toBe(1)
  })

  it('com pendência dos DOIS lados, a bola é do cliente', () => {
    // Regra de desempate: a agência costuma estar bloqueada pela aprovação.
    const b = calcularBola(
      [{ status: 'aguardando_aprovacao', aguardandoDesde: dias(5) }],
      [{ status: 'a_fazer', titulo: 'Escrever copy' }],
      AGORA,
    )
    expect(b.lado).toBe('cliente')
    expect(b.totalCliente).toBe(1)
    expect(b.totalAgencia).toBe(1)
    expect(b.itens).toHaveLength(1) // só os do lado da bola
  })

  it('post em ajuste conta para a agência, junto com as tarefas', () => {
    const b = calcularBola(
      [{ status: 'corrigir', briefing: 'Refazer arte' }],
      [{ status: 'a_fazer', titulo: 'Agendar publicações' }],
      AGORA,
    )
    expect(b.lado).toBe('agencia')
    expect(b.totalAgencia).toBe(2)
  })

  it('tarefa concluída ou descartada não conta', () => {
    const b = calcularBola([], [{ status: 'concluido' }, { status: 'descartado' }], AGORA)
    expect(b.lado).toBe('ninguem')
  })

  it('o mais ANTIGO vem primeiro — é ele que precisa aparecer', () => {
    const b = calcularBola([
      { status: 'aguardando_aprovacao', briefing: 'Recente', aguardandoDesde: dias(1) },
      { status: 'aguardando_aprovacao', briefing: 'Antigo', aguardandoDesde: dias(9) },
    ], [], AGORA)
    expect(b.itens[0].titulo).toBe('Antigo')
    expect(b.diasParado).toBe(9)
  })

  it('item sem data vai para o fim da fila, não para o começo', () => {
    const b = calcularBola([
      { status: 'aguardando_aprovacao', briefing: 'Sem data' },
      { status: 'aguardando_aprovacao', briefing: 'Com data', aguardandoDesde: dias(4) },
    ], [], AGORA)
    expect(b.itens[0].titulo).toBe('Com data')
  })

  it('usa aguardandoDesde e cai em atualizadoEm quando não existe', () => {
    const b = calcularBola([{ status: 'aguardando_aprovacao', atualizadoEm: dias(6) }], [], AGORA)
    expect(b.diasParado).toBe(6)
  })

  it('material sem texto nenhum ainda tem rótulo legível', () => {
    const b = calcularBola([{ status: 'aguardando_aprovacao' }], [], AGORA)
    expect(b.itens[0].titulo).toBe('Material sem título')
  })

  it('título longo é cortado para caber na tela', () => {
    const b = calcularBola([{ status: 'aguardando_aprovacao', briefing: 'x'.repeat(200) }], [], AGORA)
    expect(b.itens[0].titulo.length).toBe(70)
  })

  it('listas vazias não quebram', () => {
    expect(calcularBola([], [], AGORA).lado).toBe('ninguem')
    expect(calcularBola(undefined, undefined, AGORA).lado).toBe('ninguem')
  })
})

describe('fraseDaBola', () => {
  it('troca a pessoa conforme quem lê', () => {
    const b = calcularBola([{ status: 'aguardando_aprovacao', aguardandoDesde: dias(3) }], [], AGORA)
    expect(fraseDaBola(b, true)).toContain('sua aprovação')
    expect(fraseDaBola(b, false)).toContain('o cliente aprovar')
  })

  it('mostra há quantos dias está parado', () => {
    const b = calcularBola([{ status: 'aguardando_aprovacao', aguardandoDesde: dias(3) }], [], AGORA)
    expect(fraseDaBola(b, true)).toContain('há 3 dias')
  })

  it('parado hoje não vira "há 0 dias"', () => {
    const b = calcularBola([{ status: 'aguardando_aprovacao', aguardandoDesde: dias(0) }], [], AGORA)
    expect(fraseDaBola(b, true)).not.toContain('há 0')
  })

  it('singular e plural', () => {
    const um = calcularBola([{ status: 'aguardando_aprovacao' }], [], AGORA)
    const dois = calcularBola([{ status: 'aguardando_aprovacao' }, { status: 'aguardando_aprovacao' }], [], AGORA)
    expect(fraseDaBola(um, true)).toContain('material espera')
    expect(fraseDaBola(dois, true)).toContain('materiais esperam')
  })

  it('nada pendente tem frase própria', () => {
    expect(fraseDaBola(calcularBola([], [], AGORA), true)).toBe('Nada pendente no momento.')
  })
})
