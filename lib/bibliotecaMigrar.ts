import { BibliotecaVendas, Cadencia, Roteiro, Sequencia, Fase, vazia } from './bibliotecaVendas'

// Migração do Playbook antigo → Biblioteca de Vendas.
//
// O playbook velho ({ roteiro: texto, cadencia: passos, reaquecimento: passos })
// tem trabalho HUMANO dentro: o dono refinou o texto do MÉTODO DÉCADA na Norah.
// Jogar fora e semear por cima apagaria isso. Então o conteúdo antigo entra na
// estrutura nova ao lado do seed do nicho, nunca no lugar dele.
//
// É pura de propósito: migração que roda uma vez e apaga o que era do dono é o
// tipo de código que PRECISA de teste antes de tocar em dado real.

export type PlaybookAntigo = {
  roteiro?: string
  cadencia?: { id?: string; dia?: number; canal?: string; titulo?: string; script?: string }[]
  reaquecimento?: { id?: string; quando?: string; titulo?: string; script?: string }[]
}

// A cadência antiga é por DIA (D0, D1, D3...), a nova é por FASE. Traduz pelo
// que o dia significa na prática: começo é abordagem, meio é interesse, fim é
// fechamento. Aproximação honesta — a equipe reordena depois se quiser.
export function faseDoDia(dia: number, indice: number): Fase {
  if (indice === 0) return 'abordagem'
  if (dia <= 0) return 'qualificacao'
  if (dia <= 2) return 'interesse'
  if (dia <= 5) return 'agendamento'
  return 'fechamento'
}

const idDe = (prefixo: string, i: number, id?: string) => id || `${prefixo}-${i}`

export function migrarPlaybook(antigo: PlaybookAntigo | null | undefined, nome = 'Playbook anterior'): {
  cadencias: Cadencia[]
  roteiros: Roteiro[]
  leads: Sequencia[]
} {
  const out = { cadencias: [] as Cadencia[], roteiros: [] as Roteiro[], leads: [] as Sequencia[] }
  if (!antigo) return out

  const passos = (antigo.cadencia || []).filter(p => (p.titulo || p.script || '').trim())
  if (passos.length) {
    out.cadencias.push({
      id: 'migrado-cadencia',
      nome,
      descricao: 'Cadência que já existia no Playbook, preservada na migração.',
      mensagens: passos.map((p, i) => ({
        id: idDe('mig-cad', i, p.id),
        titulo: p.titulo || `Passo ${i + 1}`,
        // O dia vira contexto: a informação não se perde, só muda de lugar.
        contexto: typeof p.dia === 'number' ? `Dia ${p.dia} da cadência${p.canal ? ` · ${p.canal}` : ''}` : (p.canal || ''),
        texto: p.script || '',
        fase: faseDoDia(Number(p.dia) || 0, i),
      })),
    })
  }

  const roteiro = (antigo.roteiro || '').trim()
  if (roteiro) {
    // O roteiro antigo é UM TEXTÃO (o DÉCADA inteiro). Não dá para picar em
    // perguntas sem inventar: entra como uma pergunta-âncora com o texto
    // completo no contexto — nada se perde e a equipe recorta com calma.
    out.roteiros.push({
      id: 'migrado-roteiro',
      nome,
      descricao: 'Roteiro que já existia no Playbook, preservado na íntegra.',
      perguntas: [{ id: 'mig-rot-0', pergunta: 'Roteiro anterior (texto completo)', contexto: roteiro }],
    })
  }

  const reaq = (antigo.reaquecimento || []).filter(p => (p.titulo || p.script || '').trim())
  if (reaq.length) {
    out.leads.push({
      id: 'migrado-reaquecimento',
      nome,
      quando: 'Mensagens de reaquecimento que já existiam no Playbook.',
      mensagens: reaq.map((p, i) => ({
        id: idDe('mig-reaq', i, p.id),
        titulo: p.titulo || `Mensagem ${i + 1}`,
        contexto: p.quando || '',
        texto: p.script || '',
      })),
    })
  }
  return out
}

// Junta o seed do nicho com o que veio do playbook antigo. O MIGRADO VEM
// PRIMEIRO: é o que a equipe reconhece e usa hoje; o seed é sugestão nova.
export function juntar(seed: BibliotecaVendas, migrado: ReturnType<typeof migrarPlaybook>): BibliotecaVendas {
  const base = seed || vazia()
  return {
    objecoes: base.objecoes,
    cadencias: [...migrado.cadencias, ...base.cadencias],
    roteiros: [...migrado.roteiros, ...base.roteiros],
    reaquecimento: {
      leads: [...migrado.leads, ...base.reaquecimento.leads],
      clientes: base.reaquecimento.clientes,
    },
  }
}
