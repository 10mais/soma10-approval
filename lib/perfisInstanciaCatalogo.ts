// Perfis de instância (client-safe) — presets aplicados UMA vez no bootstrap
// de uma instância nova (/api/setup). Cada perfil define o ponto de partida
// conforme o que o cliente contratou: permissões por papel (módulos), telas
// visíveis para a equipe (granular) e o funil de CRM já semeado. Tudo continua
// ajustável depois pelo admin em Configurações — o perfil só evita a
// configuração manual repetida a cada instância (ex.: toda clínica nasce igual).

import { PermissoesPapel } from './permissoesCatalogo'
import { PermGranularPapel } from './permissoesGranular'
import { PLAYBOOK_CLINICA, PlaybookSeed } from './playbookClinica'

export type PerfilInstancia = 'clinica' | 'gestao' | 'turismo' | 'cidadania'

export type DefPerfil = {
  chave: PerfilInstancia
  label: string
  descricao: string
  // Semeia config:permissoesPapel (módulos Ver/Editar/Excluir por papel)
  permissoesPapel?: PermissoesPapel
  // Semeia config:permissoesGranular (telas off por papel; default = ligado)
  permissoesGranular?: PermGranularPapel
  // Semeia crm:pipelines + crm:estagios (se ausente, o seed padrão "Comercial"
  // do garantirSetupCrm acontece lazy no primeiro acesso ao CRM). Aceita VÁRIOS
  // funis — ex.: clínica tem "Agendamentos" (consulta paga) + "Tratamentos" (venda na cadeira).
  pipelines?: { nome: string; estagios: { nome: string; ganho?: boolean; perdido?: boolean }[] }[]
  // Semeia crm:playbookQualificacao (roteiro + cadência). Ausente = padrão de agência.
  playbook?: PlaybookSeed
}

// Telas de social media/marketing que um cliente de gestão não contratou.
const ABAS_SOCIAL_OFF = { studio: false, planner: false, agentes: false, mapas: false }

// Abas que o modo clínica esconde de TODOS os papéis, admin incluso (decisão do
// dono 2026-07-13: "isso para clínicas não precisa"). Diferente das permissões
// (que o admin sempre atravessa), esta lista é aplicada direto na navegação.
export const ABAS_OCULTAS_CLINICA: string[] = [
  'studio', 'planner', 'mapas',
  'playbook', 'campanhas', 'modelos', 'automacoes', // módulo Estratégia inteiro
  'conversao', // Conversão & Retenção
  'candidaturas', 'recrutamento', // Pessoas e Cultura (Trabalhe Conosco)
  'solicitacoes', // Solicitações do cliente (conceito de agência)
  'clientes', // gestão de clientes B2B (agência/assessoria) — clínica usa Pacientes no CRM
]

// Abas que o modo turismo (operadora de viagens) esconde de TODOS os papéis.
// Turismo usa CRM + Financeiro + módulos próprios de Operação (Viagens/Ônibus/
// Reservas/Recebíveis, adicionados na navegação por perfilTurismo). Não usa
// produção de conteúdo, Estratégia de agência, nem a Agenda clínica.
export const ABAS_OCULTAS_TURISMO: string[] = [
  'studio', 'planner', 'mapas', 'agentes', // produção de conteúdo/social
  'playbook', 'campanhas', 'modelos', 'automacoes', // Estratégia de agência
  'conversao', // Conversão & Retenção (agência)
  'candidaturas', 'recrutamento', // Trabalhe Conosco
  'solicitacoes', // Solicitações do cliente (agência)
  'clientes', // gestão de clientes B2B de agência — turismo usa Contatos/Empresas do CRM
  'agenda', // agenda clínica (turismo tem calendário de ônibus próprio, F5)
  'carga', // carga da equipe (métrica de agência de conteúdo; turismo não usa)
]

// Abas que o modo CIDADANIA (assessoria de cidadania por descendência) esconde de
// TODOS os papéis. É um perfil de GESTÃO especializado: mantém CRM + Financeiro +
// Projetos (Playbook/Tarefas/Modelos) e ganha a esteira de Processos própria.
// Não usa produção de conteúdo/social, Estratégia de agência, Agenda clínica nem
// "Trabalhe Conosco".
export const ABAS_OCULTAS_CIDADANIA: string[] = [
  'studio', 'planner', 'mapas', 'agentes', 'documentos', 'carga', // produção de conteúdo/social
  'campanhas', 'automacoes', // Estratégia de agência (Playbook/Modelos ficam)
  'conversao', // Conversão & Retenção (agência)
  'candidaturas', 'recrutamento', // Trabalhe Conosco
  'solicitacoes', // Solicitações do cliente (agência)
  'clientes', // gestão de clientes B2B — cidadania usa Contatos do CRM + Processos
  'agenda', // agenda clínica
]

// A Agenda é tela de CLÍNICA: nasceu para marcar atendimento de paciente
// (profissional, queixa principal, prontuário, "confirmado = pago"). Ficou
// visível na agência e na gestão por descuido meu — lá ninguém agenda paciente,
// e o que faz falta é a agenda de COMPROMISSOS da empresa, vinda do Google
// Calendar (projeto à parte, decidido em 2026-07-16: agenda da empresa +
// pessoal por cima, só leitura). Até ela existir, tela nenhuma é melhor que a
// tela errada.
export const ABAS_OCULTAS_AGENCIA: string[] = ['agenda']
export const ABAS_OCULTAS_GESTAO: string[] = ['agenda']

// Quais telas somem de TODOS os papéis (admin incluso) nesta instância.
// Vive aqui, e não no dashboard, porque lá são 4.500 linhas sem teste — e
// esconder tela por regra inline já custou caro no filtro do Planner.
// `null`/desconhecido = agência (instância sem config:perfilInstancia).
export function abasOcultasDoPerfil(perfil: string | null | undefined): string[] {
  if (perfil === 'clinica') return ABAS_OCULTAS_CLINICA
  if (perfil === 'turismo') return ABAS_OCULTAS_TURISMO
  if (perfil === 'cidadania') return ABAS_OCULTAS_CIDADANIA
  if (perfil === 'gestao') return ABAS_OCULTAS_GESTAO
  return ABAS_OCULTAS_AGENCIA
}

export const PERFIS: DefPerfil[] = [
  {
    chave: 'clinica',
    label: 'Clínica',
    descricao: 'CRM (funil de pacientes) + Agenda de atendimentos. Ex.: Norah, Phenoma.',
    permissoesPapel: {
      gerente: {
        producao: { ver: true, editar: true, excluir: true },
        estrategia: { ver: false, editar: false, excluir: false },
        crm: { ver: true, editar: true, excluir: true },
        clientes: { ver: false, editar: false, excluir: false },
      },
      usuario: {
        producao: { ver: true, editar: true, excluir: false },
        estrategia: { ver: false, editar: false, excluir: false },
        crm: { ver: true, editar: true, excluir: false },
        clientes: { ver: false, editar: false, excluir: false },
      },
    },
    permissoesGranular: {
      gerente: { abas: { ...ABAS_SOCIAL_OFF, conversao: false } },
      usuario: { abas: { ...ABAS_SOCIAL_OFF, conversao: false } },
    },
    // Dois estágios de venda da clínica:
    // 1) Agendamentos — a consulta só é agendada mediante pagamento antecipado
    //    (filtra curiosos, aumenta comparecimento). Ganho = compareceu.
    // 2) Tratamentos — a "venda na cadeira": valor do plano só é conhecido após
    //    a avaliação da profissional; a equipe abre a oportunidade e preenche o R$.
    pipelines: [
      {
        nome: 'Agendamentos',
        estagios: [
          { nome: 'Lead novo' },
          { nome: 'Em conversa' },
          { nome: 'Em agendamento' },
          { nome: 'Consulta paga' },
          { nome: 'Compareceu', ganho: true },
          { nome: 'Não compareceu', perdido: true },
        ],
      },
      {
        nome: 'Tratamentos',
        estagios: [
          { nome: 'Avaliação feita' },
          { nome: 'Proposta apresentada' },
          { nome: 'Em negociação' },
          { nome: 'Fechou', ganho: true },
          { nome: 'Não fechou', perdido: true },
        ],
      },
    ],
    playbook: PLAYBOOK_CLINICA,
  },
  {
    chave: 'gestao',
    label: 'Gestão',
    descricao: 'CRM + Financeiro (admin) + Projetos (Playbook/Tarefas/Modelos). Ex.: Sua Dupla Cidadania.',
    permissoesPapel: {
      gerente: {
        producao: { ver: true, editar: true, excluir: true },
        estrategia: { ver: true, editar: true, excluir: true },
        crm: { ver: true, editar: true, excluir: true },
        clientes: { ver: false, editar: false, excluir: false },
      },
      usuario: {
        producao: { ver: true, editar: true, excluir: false },
        estrategia: { ver: true, editar: true, excluir: false },
        crm: { ver: true, editar: true, excluir: false },
        clientes: { ver: false, editar: false, excluir: false },
      },
    },
    permissoesGranular: {
      gerente: { abas: { ...ABAS_SOCIAL_OFF, agenda: false, campanhas: false, automacoes: false } },
      usuario: { abas: { ...ABAS_SOCIAL_OFF, agenda: false, campanhas: false, automacoes: false } },
    },
  },
  {
    chave: 'turismo',
    label: 'Turismo',
    descricao: 'Operadora de viagens rodoviárias: CRM + Operação (viagens, ônibus, reservas, poltronas) + Financeiro. Ex.: Deny Turismo.',
    permissoesPapel: {
      gerente: {
        producao: { ver: true, editar: true, excluir: true },
        estrategia: { ver: false, editar: false, excluir: false },
        crm: { ver: true, editar: true, excluir: true },
        clientes: { ver: false, editar: false, excluir: false },
      },
      usuario: {
        producao: { ver: true, editar: true, excluir: false },
        estrategia: { ver: false, editar: false, excluir: false },
        crm: { ver: true, editar: true, excluir: false },
        clientes: { ver: false, editar: false, excluir: false },
      },
    },
    permissoesGranular: {
      gerente: { abas: { ...ABAS_SOCIAL_OFF, conversao: false, agenda: false } },
      usuario: { abas: { ...ABAS_SOCIAL_OFF, conversao: false, agenda: false } },
    },
    // Funil de vendas de viagem (kanban). Ganho = Emitido; Perdido = desistência.
    pipelines: [
      {
        nome: 'Vendas de Viagem',
        estagios: [
          { nome: 'Novo lead' },
          { nome: 'Cotação enviada' },
          { nome: 'Proposta enviada' },
          { nome: 'Reserva' },
          { nome: 'Pago' },
          { nome: 'Emitido', ganho: true },
          { nome: 'Perdido', perdido: true },
        ],
      },
    ],
  },
  {
    chave: 'cidadania',
    label: 'Cidadania',
    descricao: 'Assessoria de cidadania por descendência: CRM (funil comercial) + Financeiro + Projetos + esteira de Processos (viabilidade → deferimento). Ex.: Sua Dupla Cidadania.',
    // Espelha o perfil gestão: CRM + Projetos (Produção/Estratégia) ligados,
    // clientes B2B desligado (usa Contatos do CRM + Processos).
    permissoesPapel: {
      gerente: {
        producao: { ver: true, editar: true, excluir: true },
        estrategia: { ver: true, editar: true, excluir: true },
        crm: { ver: true, editar: true, excluir: true },
        clientes: { ver: false, editar: false, excluir: false },
      },
      usuario: {
        producao: { ver: true, editar: true, excluir: false },
        estrategia: { ver: true, editar: true, excluir: false },
        crm: { ver: true, editar: true, excluir: false },
        clientes: { ver: false, editar: false, excluir: false },
      },
    },
    permissoesGranular: {
      gerente: { abas: { ...ABAS_SOCIAL_OFF, agenda: false, campanhas: false, automacoes: false } },
      usuario: { abas: { ...ABAS_SOCIAL_OFF, agenda: false, campanhas: false, automacoes: false } },
    },
    // Funil COMERCIAL (lead → contrato assinado). A ENTREGA do processo (viabilidade
    // → deferimento) vive na esteira de Processos, não no CRM.
    pipelines: [
      {
        nome: 'Comercial',
        estagios: [
          { nome: 'Lead novo' },
          { nome: 'Contato feito' },
          { nome: 'Análise de viabilidade' },
          { nome: 'Proposta enviada' },
          { nome: 'Contrato assinado', ganho: true },
          { nome: 'Sem viabilidade', perdido: true },
        ],
      },
    ],
  },
]

export function perfilDef(chave?: string | null): DefPerfil | null {
  if (!chave) return null
  return PERFIS.find(p => p.chave === chave) || null
}

// Nome de exibição do sistema por perfil (branding front-only). Sempre "Soma10";
// o sufixo varia por linha de produto. Client-safe (sem Redis).
// clinica → Soma10 Clinic · turismo/gestao → Soma10 App · agência/padrão → Soma10 Agency.
export function nomeSistema(perfil?: string | null): string {
  if (perfil === 'clinica') return 'Soma10 Clinic'
  if (perfil === 'turismo' || perfil === 'gestao' || perfil === 'cidadania') return 'Soma10 App'
  return 'Soma10 Agency'
}

// Perfis que NÃO usam "Trabalhe Conosco"/recrutamento (clínica, turismo). Usado
// para 404 nas rotas públicas de candidaturas/recrutamento nessas instâncias.
export function perfilSemRecrutamento(perfil?: string | null): boolean {
  return perfil === 'clinica' || perfil === 'turismo' || perfil === 'cidadania'
}
