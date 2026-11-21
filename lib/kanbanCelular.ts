// O que o gesto de deslizar faz em cada coluna do Kanban no celular (Mudança 2c, 21/11/2026).
// Na revisão, deslizar é a decisão: para a direita aprova (conclui), para a esquerda pede ajuste.
// Nas outras colunas, para a direita avança uma coluna e para a esquerda volta uma.
// Descartado não entra no gesto (sair do descarte é decisão de abrir a tarefa).

export type Coluna = { key: string; label: string }
export type AcaoGesto = { status: string; rotulo: string; tom: 'ok' | 'ajuste' | 'neutro' }

export function acoesDoGesto(status: string, colunas: Coluna[]): { direita?: AcaoGesto; esquerda?: AcaoGesto } {
  if (status === 'descartado') return {}
  if (status === 'em_revisao') {
    return {
      direita: colunas.some(c => c.key === 'concluido') ? { status: 'concluido', rotulo: 'Aprovar', tom: 'ok' } : undefined,
      esquerda: colunas.some(c => c.key === 'em_ajuste') ? { status: 'em_ajuste', rotulo: 'Pedir ajuste', tom: 'ajuste' } : undefined,
    }
  }
  const fluxo = colunas.filter(c => c.key !== 'descartado')
  const i = fluxo.findIndex(c => c.key === status)
  if (i < 0) return {}
  const prox = fluxo[i + 1], ant = fluxo[i - 1]
  return {
    direita: prox ? { status: prox.key, rotulo: prox.label, tom: prox.key === 'concluido' ? 'ok' : 'neutro' } : undefined,
    esquerda: ant ? { status: ant.key, rotulo: ant.label, tom: 'neutro' } : undefined,
  }
}

/** Coluna vizinha ao deslizar a lista de lado (troca de coluna). */
export function colunaVizinha(atual: string, colunas: Coluna[], lado: 'esquerda' | 'direita'): string {
  const i = colunas.findIndex(c => c.key === atual)
  if (i < 0) return colunas[0]?.key || atual
  const j = lado === 'direita' ? Math.min(colunas.length - 1, i + 1) : Math.max(0, i - 1)
  return colunas[j].key
}
