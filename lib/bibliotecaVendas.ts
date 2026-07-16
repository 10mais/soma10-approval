// BIBLIOTECA DE VENDAS — substitui o antigo "Playbook" do CRM.
//
// Quatro seções, iguais em TODA instância: Objeções, Cadência de Mensagens,
// Roteiro de Qualificação e Reaquecimento de Base. O que muda de um nicho para
// outro é SÓ O CONTEÚDO (lib/bibliotecaSeeds/*): navegação, componentes e
// lógica são os mesmos — é isso que permite abrir a quinta instância sem
// reescrever tela nenhuma.
//
// Semeada por perfil e EDITÁVEL: cada equipe refina o script com o que funciona
// na boca dela. O seed é ponto de partida, não lei.

export type Fase = 'abordagem' | 'qualificacao' | 'interesse' | 'agendamento' | 'fechamento'

export const FASES: { key: Fase; label: string; cor: string }[] = [
  { key: 'abordagem', label: 'Abordagem', cor: '#0891b2' },
  { key: 'qualificacao', label: 'Qualificação', cor: '#7c3aed' },
  { key: 'interesse', label: 'Despertar interesse', cor: '#ea580c' },
  { key: 'agendamento', label: 'Agendamento', cor: '#ca8a04' },
  { key: 'fechamento', label: 'Fechamento', cor: '#16a34a' },
]

// `contexto` é a linha que diz QUANDO usar. Sem ela a biblioteca vira um monte
// de texto pronto e cada um escolhe no chute.
export type Item = { id: string; titulo: string; contexto: string; texto: string }

export type CategoriaObjecao = { id: string; nome: string; respostas: Item[] }
export type MsgCadencia = Item & { fase: Fase }
export type Cadencia = { id: string; nome: string; descricao?: string; mensagens: MsgCadencia[] }

// Fluxo de decisão: o que fazer conforme a resposta, e onde PARAR. Ponto de
// parada é o que separa roteiro de interrogatório — nem todo lead segue.
export type Pergunta = {
  id: string
  pergunta: string
  contexto: string
  seSim?: string
  seNao?: string
  parada?: string
}
export type Roteiro = { id: string; nome: string; descricao?: string; perguntas: Pergunta[] }

export type Sequencia = { id: string; nome: string; quando: string; mensagens: Item[] }

export type BibliotecaVendas = {
  objecoes: CategoriaObjecao[]
  cadencias: Cadencia[]
  roteiros: Roteiro[]
  reaquecimento: { leads: Sequencia[]; clientes: Sequencia[] }
}

// Seed sem id (o id nasce na instalação) — os arquivos de nicho escrevem assim.
// ATENÇÃO: `SemId` é raso. `SemId<Sequencia>` tirava o id da sequência mas
// mantinha `mensagens: Item[]`, que EXIGE id em cada mensagem — o oposto do
// combinado, e o arquivo de nicho não compilava. Por isso a sequência tem tipo
// de seed próprio, com as mensagens também sem id.
export type SemId<T> = Omit<T, 'id'>
export type SequenciaSeed = { nome: string; quando: string; mensagens: SemId<Item>[] }
export type BibliotecaSeed = {
  objecoes: { nome: string; respostas: SemId<Item>[] }[]
  cadencias: { nome: string; descricao?: string; mensagens: SemId<MsgCadencia>[] }[]
  roteiros: { nome: string; descricao?: string; perguntas: SemId<Pergunta>[] }[]
  reaquecimento: { leads: SequenciaSeed[]; clientes: SequenciaSeed[] }
}

export const CHAVE_BIBLIOTECA = 'crm:bibliotecaVendas'

export function vazia(): BibliotecaVendas {
  return { objecoes: [], cadencias: [], roteiros: [], reaquecimento: { leads: [], clientes: [] } }
}

// Está tudo vazio? Instância sem nicho semeado mostra o convite de "monte a sua"
// em vez de quatro abas em branco.
export function bibliotecaVazia(b: BibliotecaVendas): boolean {
  return !b.objecoes.length && !b.cadencias.length && !b.roteiros.length
    && !b.reaquecimento.leads.length && !b.reaquecimento.clientes.length
}

// A Biblioteca vira TEXTO para o prompt do "Sugerir perguntas" do inbox. Sem
// isto, a IA seguiria lendo o Playbook antigo — que ninguém mais edita depois da
// migração — e sugeriria perguntas fora do método vigente.
// Só roteiro + objeções: é o que orienta a PRÓXIMA pergunta. Cadência e
// reaquecimento são disparo, não conversa em andamento.
export function bibliotecaParaPrompt(b: BibliotecaVendas): string {
  const partes: string[] = []
  for (const r of b.roteiros) {
    const linhas = r.perguntas.map(p => {
      const extra = [p.seSim ? `se sim: ${p.seSim}` : '', p.seNao ? `se não: ${p.seNao}` : '', p.parada ? `PARE se: ${p.parada}` : '']
        .filter(Boolean).join(' · ')
      return `- ${p.pergunta}${p.contexto ? ` (${p.contexto})` : ''}${extra ? ` [${extra}]` : ''}`
    })
    if (linhas.length) partes.push(`ROTEIRO — ${r.nome}:\n${linhas.join('\n')}`)
  }
  for (const c of b.objecoes) {
    const linhas = c.respostas.slice(0, 4).map(r => `- ${r.titulo}: ${r.texto}`)
    if (linhas.length) partes.push(`OBJEÇÃO "${c.nome}" — respostas que funcionam:\n${linhas.join('\n')}`)
  }
  return partes.join('\n\n')
}
