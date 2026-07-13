// Perfis de instância (client-safe) — presets aplicados UMA vez no bootstrap
// de uma instância nova (/api/setup). Cada perfil define o ponto de partida
// conforme o que o cliente contratou: permissões por papel (módulos), telas
// visíveis para a equipe (granular) e o funil de CRM já semeado. Tudo continua
// ajustável depois pelo admin em Configurações — o perfil só evita a
// configuração manual repetida a cada instância (ex.: toda clínica nasce igual).

import { PermissoesPapel } from './permissoesCatalogo'
import { PermGranularPapel } from './permissoesGranular'
import { PLAYBOOK_CLINICA, PlaybookSeed } from './playbookClinica'

export type PerfilInstancia = 'clinica' | 'gestao'

export type DefPerfil = {
  chave: PerfilInstancia
  label: string
  descricao: string
  // Semeia config:permissoesPapel (módulos Ver/Editar/Excluir por papel)
  permissoesPapel?: PermissoesPapel
  // Semeia config:permissoesGranular (telas off por papel; default = ligado)
  permissoesGranular?: PermGranularPapel
  // Semeia crm:pipelines + crm:estagios (se ausente, o seed padrão "Comercial"
  // do garantirSetupCrm acontece lazy no primeiro acesso ao CRM)
  pipeline?: { nome: string; estagios: { nome: string; ganho?: boolean; perdido?: boolean }[] }
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
]

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
    // Funil espelhado no sistema de referência da Norah (kanban "Agendamentos")
    pipeline: {
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
]

export function perfilDef(chave?: string | null): DefPerfil | null {
  if (!chave) return null
  return PERFIS.find(p => p.chave === chave) || null
}
