// Modelos de projeto PRONTOS — ponto de partida para a tela vazia.
//
// Toda instância nasce sem nenhum modelo ("Nenhum modelo ainda. Crie o
// primeiro."), e montar etapa por etapa na mão é justamente o trabalho que o
// modelo existe para evitar. Aqui ficam os pontos de partida; a tela os carrega
// NO EDITOR, sem gravar nada — o dono ajusta e só então salva.
//
// Mesma filosofia dos seeds da Biblioteca de Vendas: a estrutura é do sistema,
// o conteúdo é do nicho, e o seed é ponto de partida, não lei.
//
// ALCANCE: só as instâncias que enxergam a tela Modelos — agência e `gestao`.
// Clínica, turismo e cidadania escondem 'modelos' (perfisInstanciaCatalogo).

import { EtapaModelo, TarefaModelo } from './aplicarModelo'

export type ModeloSugerido = {
  chave: string
  nome: string
  descricao: string
  // Perfis que veem esta sugestão. `agencia` = instância sem perfil definido.
  perfis: ('agencia' | 'gestao')[]
  marcos: EtapaModelo[]
  tarefas: TarefaModelo[]
}

export const MODELOS_SUGERIDOS: ModeloSugerido[] = [
  {
    chave: 'social-mensal',
    nome: 'Ciclo mensal de social media',
    descricao: 'O mês inteiro de um cliente de conteúdo: pauta, copy, arte, as duas aprovações e a publicação.',
    perfis: ['agencia'],
    // Espelha a esteira do próprio sistema (briefing -> copy -> aprovação da
    // copy -> criativo -> aprovação do criativo -> pronto). As durações somam
    // 30 dias: o ciclo fecha dentro do mês.
    marcos: [
      { titulo: 'Planejamento do mês (pautas)', categoria: 'estrategia', diasDuracao: 3, descricao: 'Definir os temas do mês a partir do Brand Board e do Playbook da marca.' },
      { titulo: 'Produção das copies', categoria: 'social_media', diasDuracao: 4 },
      { titulo: 'Aprovação das copies com o cliente', categoria: 'entrega', diasDuracao: 3 },
      { titulo: 'Produção dos criativos', categoria: 'social_media', diasDuracao: 6 },
      { titulo: 'Aprovação dos criativos', categoria: 'entrega', diasDuracao: 3 },
      { titulo: 'Publicação e acompanhamento', categoria: 'social_media', diasDuracao: 11 },
    ],
    tarefas: [
      { titulo: 'Gerar o plano do mês no Studio', tipo: 'planejamento', prioridade: 'alta', marcoIndice: 0 },
      { titulo: 'Revisar e ajustar as pautas', tipo: 'estrategia', prioridade: 'media', marcoIndice: 0 },
      { titulo: 'Escrever as legendas', tipo: 'post', prioridade: 'media', marcoIndice: 1 },
      { titulo: 'Enviar as copies para aprovação do cliente', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 2 },
      { titulo: 'Produzir as artes e os vídeos', tipo: 'criativo', prioridade: 'alta', marcoIndice: 3 },
      { titulo: 'Enviar os criativos para aprovação', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 4 },
      { titulo: 'Agendar as publicações no Planner', tipo: 'post', prioridade: 'media', marcoIndice: 5 },
      { titulo: 'Relatório do mês para o cliente', tipo: 'tarefa', prioridade: 'media', marcoIndice: 5 },
    ],
  },
  {
    chave: 'onboarding',
    nome: 'Onboarding de cliente novo',
    descricao: 'Do kickoff à primeira publicação: acessos, marca, planejamento e a primeira leva de conteúdo.',
    perfis: ['agencia'],
    marcos: [
      // Duração 0 = marco pontual: acontece num dia e não consome prazo.
      { titulo: 'Kickoff e coleta de acessos', categoria: 'reuniao', diasDuracao: 0 },
      { titulo: 'Brand Board e documento de marca', categoria: 'branding', diasDuracao: 5 },
      { titulo: 'Planejamento inicial', categoria: 'estrategia', diasDuracao: 4 },
      { titulo: 'Primeira leva de conteúdo', categoria: 'social_media', diasDuracao: 7 },
      { titulo: 'Primeira publicação', categoria: 'entrega', diasDuracao: 0 },
    ],
    tarefas: [
      { titulo: 'Reunião de kickoff com o cliente', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 0 },
      { titulo: 'Coletar acessos das redes e materiais da marca', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 0 },
      { titulo: 'Preencher o Brand Board', tipo: 'estrategia', prioridade: 'alta', marcoIndice: 1 },
      { titulo: 'Gerar o documento de marca com IA', tipo: 'estrategia', prioridade: 'media', marcoIndice: 1 },
      { titulo: 'Destilar o Playbook da marca', tipo: 'estrategia', prioridade: 'media', marcoIndice: 1 },
      { titulo: 'Montar o plano do primeiro mês', tipo: 'planejamento', prioridade: 'alta', marcoIndice: 2 },
      { titulo: 'Produzir os primeiros criativos', tipo: 'criativo', prioridade: 'alta', marcoIndice: 3 },
    ],
  },
  {
    chave: 'projeto-padrao',
    nome: 'Projeto padrão',
    descricao: 'Esqueleto genérico de projeto: kickoff, diagnóstico, execução e entrega final.',
    perfis: ['agencia', 'gestao'],
    marcos: [
      { titulo: 'Kickoff', categoria: 'reuniao', diasDuracao: 0 },
      { titulo: 'Diagnóstico e escopo', categoria: 'estrategia', diasDuracao: 7 },
      { titulo: 'Execução', categoria: 'entrega', diasDuracao: 21 },
      { titulo: 'Revisão e entrega final', categoria: 'entrega', diasDuracao: 3 },
    ],
    tarefas: [
      { titulo: 'Reunião de kickoff', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 0 },
      { titulo: 'Levantar requisitos e alinhar escopo', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 1 },
      { titulo: 'Apresentar a entrega ao cliente', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 3 },
    ],
  },
]

// `null`/desconhecido = agência, mesma régua de abasOcultasDoPerfil.
export function sugestoesParaPerfil(perfil?: string | null): ModeloSugerido[] {
  const alvo = perfil === 'gestao' ? 'gestao' : 'agencia'
  return MODELOS_SUGERIDOS.filter(m => m.perfis.includes(alvo))
}
