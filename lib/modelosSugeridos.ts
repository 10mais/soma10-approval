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
    descricao: 'O onboarding completo da 10+: formalização, acessos, ativos, DNA da marca, auditorias, ganhos rápidos e go live.',
    perfis: ['agencia'],
    // Transcrito do ClickUp — PRODUTO > SUCESSO DO CLIENTE > Onboarding (lista
    // 901324605689), 12 etapas de primeiro nível e as 81 tarefas diretas delas.
    //
    // Três traduções foram necessárias, porque o ClickUp e o Playbook não têm a
    // mesma forma:
    // 1) DURAÇÕES: não existem no ClickUp (uma das tarefas de lá é justamente
    //    "Estipular prazo médio para CONCLUSÃO DO ONBOARDING"). As daqui são
    //    proposta de partida, aprovada pelo dono para ser corrigida no uso.
    // 2) ORDEM: no ClickUp as etapas convivem soltas; aqui viram uma linha do
    //    tempo em SÉRIE. Coletar acessos e Solicitar ativos, que na vida real
    //    correm em paralelo, aparecem uma depois da outra.
    // 3) PROFUNDIDADE: o ClickUp tem 3 e 4 níveis, o Playbook tem 2. O detalhe
    //    fino (Perfis > Instagram > Bio/@/Destaques) foi resumido no título da
    //    tarefa em vez de virar item próprio.
    marcos: [
      { titulo: 'Formalização de abertura', categoria: 'reuniao', duracao: 2, unidade: 'dias', descricao: 'Kickoff, pasta no Drive, responsáveis internos e registro do contrato.' },
      { titulo: 'Coletar acessos', categoria: 'outro', duracao: 5, unidade: 'dias', descricao: 'Redes, Business Manager, contas de anúncios, Google, site e domínio.' },
      { titulo: 'Solicitar ativos da marca', categoria: 'branding', duracao: 5, unidade: 'dias', descricao: 'Logo, cores, fontes, fotos, vídeos e provas sociais.' },
      { titulo: 'Balizamento operacional com o cliente', categoria: 'reuniao', duracao: 2, unidade: 'dias', descricao: 'Canal oficial, quem aprova, prazos e frequência de reuniões.' },
      { titulo: 'Criar documento DNA da marca', categoria: 'branding', duracao: 3, unidade: 'dias', descricao: 'Dados do negócio: contatos, serviços, ticket médio e capacidade.' },
      { titulo: 'Análise de posicionamento', categoria: 'estrategia', duracao: 3, unidade: 'dias', descricao: 'Auditoria dos perfis e da landing page.' },
      { titulo: 'Análises e auditoria de contas', categoria: 'trafego', duracao: 3, unidade: 'dias', descricao: 'Meta Ads, Google Ads, GTM, GA4 e LinkedIn Ads.' },
      { titulo: 'Planejamento de campanhas', categoria: 'trafego', duracao: 3, unidade: 'dias' },
      { titulo: 'Agendar nova captação', categoria: 'outro', duracao: 0, unidade: 'dias', descricao: 'Marco pontual: agenda a captação e abre os primeiros briefings.' },
      { titulo: 'Ganhos rápidos', categoria: 'entrega', duracao: 5, unidade: 'dias', descricao: 'Primeiros criativos, fast traffic, avaliações e ajuste das redes.' },
      { titulo: 'Entregas rápidas', categoria: 'entrega', duracao: 3, unidade: 'dias' },
      { titulo: 'Go live e conclusão do onboarding', categoria: 'entrega', duracao: 0, unidade: 'dias', descricao: 'Marco pontual: comunica o início e fecha o onboarding.' },
    ],
    tarefas: [
      // 0 — Formalização de abertura
      { titulo: 'Agendamento do kickoff', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 0 },
      { titulo: 'Criar pasta principal do cliente no Drive', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 0 },
      { titulo: 'Definir responsáveis internos por área', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 0 },
      { titulo: 'Definir gestor do cliente (GP/CS)', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 0 },
      { titulo: 'Criação do grupo do WhatsApp', tipo: 'tarefa', prioridade: 'media', marcoIndice: 0 },
      { titulo: 'Registrar data oficial de início do contrato', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 0 },
      { titulo: 'Registrar prazo de contrato', tipo: 'tarefa', prioridade: 'media', marcoIndice: 0 },
      { titulo: 'Registrar escopo contratado', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 0 },
      { titulo: 'Subir template de entregas', tipo: 'tarefa', prioridade: 'media', marcoIndice: 0 },
      { titulo: 'Ajustar entregas (retirar o que NÃO está incluso)', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 0 },
      { titulo: 'Adicionar tag do segmento', tipo: 'tarefa', prioridade: 'baixa', marcoIndice: 0 },
      { titulo: 'Adicionar tag do estágio ITAE (se não for clínica)', tipo: 'tarefa', prioridade: 'baixa', marcoIndice: 0 },
      // 1 — Coletar acessos
      { titulo: 'Solicitar acesso ao Instagram', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 1 },
      { titulo: 'Solicitar acesso ao Meta Business Manager', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 1 },
      { titulo: 'Verificar nível de permissão (admin/parceiro)', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 1 },
      { titulo: 'Verificar se a conta está vinculada ao BM correto', tipo: 'tarefa', prioridade: 'media', marcoIndice: 1 },
      { titulo: 'Verificar conta de anúncios existente', tipo: 'tarefa', prioridade: 'media', marcoIndice: 1 },
      { titulo: 'Verificar método de pagamento ativo', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 1 },
      { titulo: 'Registrar e-mail administrador do BM', tipo: 'tarefa', prioridade: 'media', marcoIndice: 1 },
      { titulo: 'Validar autenticação em dois fatores (2FA)', tipo: 'tarefa', prioridade: 'media', marcoIndice: 1 },
      { titulo: 'Testar acesso interno da equipe', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 1 },
      { titulo: 'Solicitar acessos do Google (Analytics, Tag Manager, Search Console e Meu Negócio)', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 1 },
      { titulo: 'Solicitar acesso às contas de anúncios (Meta Ads e Google Ads)', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 1 },
      { titulo: 'Solicitar acesso ao site', tipo: 'tarefa', prioridade: 'media', marcoIndice: 1 },
      { titulo: 'Solicitar acesso à hospedagem', tipo: 'tarefa', prioridade: 'media', marcoIndice: 1 },
      { titulo: 'Solicitar acesso ao domínio', tipo: 'tarefa', prioridade: 'media', marcoIndice: 1 },
      // 2 — Solicitar ativos da marca
      { titulo: 'Solicitar logo oficial', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 2 },
      { titulo: 'Solicitar versões da logo (PNG/JPG/vetor)', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 2 },
      { titulo: 'Solicitar manual de marca (se existir)', tipo: 'tarefa', prioridade: 'media', marcoIndice: 2 },
      { titulo: 'Solicitar cores oficiais', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 2 },
      { titulo: 'Solicitar fontes utilizadas', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 2 },
      { titulo: 'Solicitar imagens institucionais', tipo: 'tarefa', prioridade: 'media', marcoIndice: 2 },
      { titulo: 'Solicitar fotos da equipe', tipo: 'tarefa', prioridade: 'media', marcoIndice: 2 },
      { titulo: 'Solicitar fotos do espaço físico', tipo: 'tarefa', prioridade: 'media', marcoIndice: 2 },
      { titulo: 'Solicitar vídeos institucionais', tipo: 'video', prioridade: 'baixa', marcoIndice: 2 },
      { titulo: 'Solicitar depoimentos existentes', tipo: 'tarefa', prioridade: 'media', marcoIndice: 2 },
      { titulo: 'Solicitar provas sociais existentes', tipo: 'tarefa', prioridade: 'media', marcoIndice: 2 },
      { titulo: 'Organizar todos os ativos na pasta correta do Drive', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 2 },
      { titulo: 'Identificar necessidade de nova captação', tipo: 'tarefa', prioridade: 'media', marcoIndice: 2 },
      // 3 — Balizamento operacional
      { titulo: 'Definir canal oficial de comunicação', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 3 },
      { titulo: 'Definir responsável por aprovações', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 3 },
      { titulo: 'Balizar prazo padrão de aprovação', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 3 },
      { titulo: 'Definir dias e horários de contato', tipo: 'tarefa', prioridade: 'media', marcoIndice: 3 },
      { titulo: 'Definir frequência de reuniões', tipo: 'tarefa', prioridade: 'media', marcoIndice: 3 },
      { titulo: 'Definir processo de solicitação do cliente', tipo: 'tarefa', prioridade: 'media', marcoIndice: 3 },
      { titulo: 'Definir processo de ajustes e revisões', tipo: 'tarefa', prioridade: 'media', marcoIndice: 3 },
      { titulo: 'Registrar acordos operacionais', tipo: 'tarefa', prioridade: 'media', marcoIndice: 3 },
      // 4 — DNA da marca
      { titulo: 'Coletar região de abrangência (cidades/raio)', tipo: 'estrategia', prioridade: 'alta', marcoIndice: 4 },
      { titulo: 'Coletar telefone comercial', tipo: 'tarefa', prioridade: 'media', marcoIndice: 4 },
      { titulo: 'Coletar WhatsApp principal', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 4 },
      { titulo: 'Coletar e-mail comercial', tipo: 'tarefa', prioridade: 'media', marcoIndice: 4 },
      { titulo: 'Coletar dias e horários de funcionamento', tipo: 'tarefa', prioridade: 'media', marcoIndice: 4 },
      { titulo: 'Coletar serviços oferecidos', tipo: 'estrategia', prioridade: 'alta', marcoIndice: 4 },
      { titulo: 'Coletar ticket médio (estimado)', tipo: 'estrategia', prioridade: 'alta', marcoIndice: 4 },
      { titulo: 'Coletar capacidade de atendimento diária/mensal', tipo: 'estrategia', prioridade: 'media', marcoIndice: 4 },
      { titulo: 'Coletar nome do responsável pelas decisões', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 4 },
      // 5 — Análise de posicionamento (3º nível resumido no título)
      { titulo: 'Auditar perfis: Instagram, Facebook e Google Meu Negócio', tipo: 'estrategia', prioridade: 'alta', marcoIndice: 5 },
      { titulo: 'Auditar landing page: informações, desempenho e layout (se tiver)', tipo: 'estrategia', prioridade: 'media', marcoIndice: 5 },
      // 6 — Auditoria de contas
      { titulo: 'Auditar conta de Meta Ads', tipo: 'estrategia', prioridade: 'alta', marcoIndice: 6 },
      { titulo: 'Auditar conta de Google Ads', tipo: 'estrategia', prioridade: 'alta', marcoIndice: 6 },
      { titulo: 'Auditar Google Tag Manager', tipo: 'tarefa', prioridade: 'media', marcoIndice: 6 },
      { titulo: 'Auditar Google Analytics 4', tipo: 'tarefa', prioridade: 'media', marcoIndice: 6 },
      { titulo: 'Auditar LinkedIn Ads (quando necessário)', tipo: 'tarefa', prioridade: 'baixa', marcoIndice: 6 },
      // 7 — Planejamento de campanhas
      { titulo: 'Planejar campanhas de Google Ads', tipo: 'estrategia', prioridade: 'alta', marcoIndice: 7 },
      { titulo: 'Planejar campanhas de Meta Ads', tipo: 'estrategia', prioridade: 'alta', marcoIndice: 7 },
      // 8 — Nova captação
      { titulo: 'Agendar captação e abrir os primeiros briefings', tipo: 'tarefa', prioridade: 'media', marcoIndice: 8 },
      // 9 — Ganhos rápidos
      { titulo: 'Produzir 5 criativos iniciais', tipo: 'criativo', prioridade: 'alta', marcoIndice: 9 },
      { titulo: 'Criar campanha Fast Traffic', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 9 },
      { titulo: 'Briefing da landing page', tipo: 'tarefa', prioridade: 'media', marcoIndice: 9 },
      { titulo: 'Avaliações no Google Meu Negócio', tipo: 'tarefa', prioridade: 'media', marcoIndice: 9 },
      { titulo: 'Materiais para uso offline', tipo: 'criativo', prioridade: 'baixa', marcoIndice: 9 },
      { titulo: 'Campanha de remarketing rápida', tipo: 'tarefa', prioridade: 'media', marcoIndice: 9 },
      { titulo: 'Ajuste das redes sociais', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 9 },
      { titulo: 'Publicação de artigos', tipo: 'post', prioridade: 'baixa', marcoIndice: 9 },
      // 10 — Entregas rápidas
      { titulo: 'Otimizações no Google Meu Negócio', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 10 },
      { titulo: 'Implementar ferramentas', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 10 },
      // 11 — Go live
      { titulo: 'Comunicação de início (go live)', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 11 },
      { titulo: 'Enviar mensagem oficial de início do projeto', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 11 },
      { titulo: 'Confirmar data de início da execução', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 11 },
      { titulo: 'Informar próximos passos operacionais', tipo: 'tarefa', prioridade: 'media', marcoIndice: 11 },
      { titulo: 'Mover status para "Onboarding concluído"', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 11 },
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
