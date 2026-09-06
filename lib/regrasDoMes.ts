// Regra inegociável do mês + frase de inspiração do dia (Home nova).
//
// São 10 regras, uma por mês de janeiro a outubro; novembro e dezembro usam
// outro conjunto de frases (decisão do dono, 04/09/2026). O conteúdo NÃO vive
// no código: fica em `config:regrasDoMes` (Redis), editável em Configurações,
// porque texto de cultura muda sem deploy.
//
// A frase do dia é escolhida pelo DIA DO MÊS: muda todo dia, é a mesma para a
// equipe inteira (é sobre a regra, não sobre a pessoa) e não pula a cada reload.
// Sem conteúdo cadastrado, devolve null e a Home simplesmente não mostra o bloco.

export type RegraMes = { nome: string; frases: string[] }
// Índice 0 = janeiro … 11 = dezembro. Slots vazios = ainda não cadastrado.
export type ConfigRegras = { meses: (RegraMes | null)[] }

export const MESES_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export function configVazia(): ConfigRegras { return { meses: Array.from({ length: 12 }, () => null) } }

// Aceita o que vier do banco (pode estar incompleto/antigo) e devolve 12 slots.
export function normalizarConfig(bruto: unknown): ConfigRegras {
  const meses = configVazia().meses
  const lista = (bruto as any)?.meses
  if (Array.isArray(lista)) {
    for (let i = 0; i < 12; i++) {
      const m = lista[i]
      const nome = typeof m?.nome === 'string' ? m.nome.trim() : ''
      const frases = Array.isArray(m?.frases) ? m.frases.filter((f: any) => typeof f === 'string' && f.trim()).map((f: string) => f.trim()) : []
      meses[i] = nome ? { nome, frases } : null
    }
  }
  return { meses }
}

export type RegraDoDia = { mes: string; nome: string; frase?: string }

export function regraDoDia(cfg: ConfigRegras, agora: number = Date.now()): RegraDoDia | null {
  const d = new Date(agora)
  const r = cfg.meses[d.getMonth()]
  if (!r || !r.nome) return null
  const frase = r.frases.length ? r.frases[(d.getDate() - 1) % r.frases.length] : undefined
  return { mes: MESES_PT[d.getMonth()], nome: r.nome, frase }
}
