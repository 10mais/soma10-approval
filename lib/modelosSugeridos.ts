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
    nome: 'Ciclo mensal — Social Media',
    descricao: 'Ciclo padrão de 30 dias: briefing, pautas, copy, criativos, aprovação, veiculação e relatório.',
    perfis: ['agencia'],
    // Conteúdo herdado de scripts/criar-modelo-ciclo-mensal.mjs (ae247a3), que
    // criava este mesmo modelo direto no Redis quando ainda não havia jeito de
    // fazê-lo pela tela. É a versão já escrita para a 10+ — não vale reinventar
    // o ciclo do zero tendo esta aqui. As durações somam 30 dias.
    marcos: [
      { titulo: 'Briefing e alinhamento do mês', categoria: 'reuniao', duracao: 2, unidade: 'dias', descricao: 'Entender o que o cliente tem de novo no mês: datas, promoções, prioridades.' },
      { titulo: 'Planejamento de pautas', categoria: 'estrategia', duracao: 3, unidade: 'dias', descricao: 'Montar o plano do mês e fechar as pautas com a equipe.' },
      { titulo: 'Copy', categoria: 'social_media', duracao: 4, unidade: 'dias', descricao: 'Escrever as legendas de todas as pautas do mês.' },
      { titulo: 'Criativos', categoria: 'social_media', duracao: 6, unidade: 'dias', descricao: 'Produzir as artes de cada pauta.' },
      { titulo: 'Aprovação do cliente', categoria: 'entrega', duracao: 4, unidade: 'dias', descricao: 'Enviar o mês para aprovação e aplicar os ajustes pedidos.' },
      { titulo: 'Veiculação', categoria: 'social_media', duracao: 9, unidade: 'dias', descricao: 'Agendar e acompanhar as publicações no ar.' },
      { titulo: 'Relatório do mês', categoria: 'entrega', duracao: 2, unidade: 'dias', descricao: 'Fechar os resultados e apresentar ao cliente.' },
    ],
    tarefas: [
      { titulo: 'Reunião de briefing com o cliente', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 0 },
      { titulo: 'Coletar novidades, datas e promoções do mês', tipo: 'tarefa', prioridade: 'media', marcoIndice: 0 },
      { titulo: 'Gerar plano do mês com IA', tipo: 'planejamento', prioridade: 'alta', marcoIndice: 1 },
      { titulo: 'Revisar e ajustar as pautas', tipo: 'planejamento', prioridade: 'alta', marcoIndice: 1 },
      { titulo: 'Escrever legendas das pautas', tipo: 'post', prioridade: 'alta', marcoIndice: 2 },
      { titulo: 'Revisão interna de copy', tipo: 'tarefa', prioridade: 'media', marcoIndice: 2 },
      { titulo: 'Gerar artes dos posts', tipo: 'criativo', prioridade: 'alta', marcoIndice: 3 },
      { titulo: 'Ajuste fino dos criativos', tipo: 'criativo', prioridade: 'media', marcoIndice: 3 },
      { titulo: 'Enviar pautas para aprovação', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 4 },
      { titulo: 'Aplicar ajustes pedidos pelo cliente', tipo: 'tarefa', prioridade: 'urgente', marcoIndice: 4 },
      { titulo: 'Agendar publicações do mês', tipo: 'post', prioridade: 'alta', marcoIndice: 5 },
      { titulo: 'Monitorar publicações e engajamento', tipo: 'tarefa', prioridade: 'media', marcoIndice: 5 },
      { titulo: 'Fechar relatório de resultados', tipo: 'estrategia', prioridade: 'alta', marcoIndice: 6 },
      { titulo: 'Reunião de resultados com o cliente', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 6 },
    ],
  },
  {
    chave: 'onboarding',
    nome: 'Onboarding de cliente novo',
    descricao: 'Do kickoff à primeira publicação: acessos, marca, planejamento e a primeira leva de conteúdo.',
    perfis: ['agencia'],
    marcos: [
      // Duração 0 = marco pontual: acontece num dia e não consome prazo.
      { titulo: 'Kickoff e coleta de acessos', categoria: 'reuniao', duracao: 0, unidade: 'dias' },
      { titulo: 'Brand Board e documento de marca', categoria: 'branding', duracao: 5, unidade: 'dias' },
      { titulo: 'Planejamento inicial', categoria: 'estrategia', duracao: 4, unidade: 'dias' },
      { titulo: 'Primeira leva de conteúdo', categoria: 'social_media', duracao: 1, unidade: 'semanas' },
      { titulo: 'Primeira publicação', categoria: 'entrega', duracao: 0, unidade: 'dias' },
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
      { titulo: 'Kickoff', categoria: 'reuniao', duracao: 0, unidade: 'dias' },
      { titulo: 'Diagnóstico e escopo', categoria: 'estrategia', duracao: 1, unidade: 'semanas' },
      { titulo: 'Execução', categoria: 'entrega', duracao: 3, unidade: 'semanas' },
      { titulo: 'Revisão e entrega final', categoria: 'entrega', duracao: 3, unidade: 'dias' },
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
