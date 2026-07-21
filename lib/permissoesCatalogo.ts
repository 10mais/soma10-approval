// Catálogo e lógica de permissões (client-safe — sem imports de servidor).
// 3 níveis por módulo: Ver / Editar / Excluir. Usado pela UI e pelo motor (server).

export type GrupoPermissao = 'producao' | 'estrategia' | 'crm' | 'clientes'
export type Nivel = 'ver' | 'editar' | 'excluir'
export type NivelPerm = { ver?: boolean; editar?: boolean; excluir?: boolean }
export type PapelConfig = 'gerente' | 'usuario'
export type PermissoesPapel = Partial<Record<PapelConfig, Partial<Record<GrupoPermissao, NivelPerm>>>>

export const PADRAO: Record<PapelConfig, Record<GrupoPermissao, NivelPerm>> = {
  gerente: {
    producao: { ver: true, editar: true, excluir: true },
    estrategia: { ver: true, editar: true, excluir: true },
    crm: { ver: true, editar: true, excluir: true },
    clientes: { ver: false, editar: false, excluir: false },
  },
  usuario: {
    producao: { ver: true, editar: true, excluir: false },
    estrategia: { ver: false, editar: false, excluir: false },
    crm: { ver: false, editar: false, excluir: false },
    clientes: { ver: false, editar: false, excluir: false },
  },
}

export const GRUPOS: { chave: GrupoPermissao; label: string }[] = [
  { chave: 'producao', label: 'Produção' },
  { chave: 'estrategia', label: 'Estratégia' },
  { chave: 'crm', label: 'Vendas (CRM)' },
  { chave: 'clientes', label: 'Clientes' },
]
export const NIVEIS: { chave: Nivel; label: string }[] = [
  { chave: 'ver', label: 'Ver' },
  { chave: 'editar', label: 'Editar' },
  { chave: 'excluir', label: 'Excluir' },
]

// A matriz de permissões fala a língua da instância. "Produção"/"Estratégia" são
// termos de agência de marketing; numa assessoria de cidadania ninguém "produz
// conteúdo". E grupo que não tem NENHUMA tela atrás dele sai da matriz: linha
// que não controla nada só ensina a equipe a ignorar a tela de permissões
// (na cidadania, Estratégia e Clientes ficaram vazios — ver ABAS_OCULTAS_CIDADANIA).
export function gruposDoPerfil(perfil?: string | null): { chave: GrupoPermissao; label: string }[] {
  if (perfil === 'cidadania') return [
    { chave: 'producao', label: 'Operação (tarefas)' },
    { chave: 'crm', label: 'CRM e Processos' },
  ]
  if (perfil === 'turismo') return [
    { chave: 'producao', label: 'Operação' },
    { chave: 'crm', label: 'CRM e Reservas' },
  ]
  if (perfil === 'clinica') return [
    { chave: 'producao', label: 'Atendimento' },
    { chave: 'crm', label: 'CRM e Pacientes' },
  ]
  return GRUPOS
}

// Aceita valor antigo (boolean por módulo) ou novo (objeto {ver,editar,excluir}).
export function normalizaNivel(v: any): NivelPerm {
  if (typeof v === 'boolean') return { ver: v, editar: v, excluir: v }
  return (v && typeof v === 'object') ? v : {}
}

// Nível efetivo: override do usuário > config do papel > padrão do papel.
export function podeNivel(
  role: string | undefined,
  grupo: GrupoPermissao | 'financeiro',
  nivel: Nivel,
  permUsuario?: any,
  configPapel?: PermissoesPapel | null,
): boolean {
  if (role === 'admin') return true
  if (grupo === 'financeiro') return false // exclusivo do admin
  if (role !== 'gerente' && role !== 'usuario') return false
  const u = normalizaNivel(permUsuario?.[grupo])
  if (u[nivel] !== undefined) return !!u[nivel]
  const c = normalizaNivel(configPapel?.[role]?.[grupo])
  if (c[nivel] !== undefined) return !!c[nivel]
  return !!PADRAO[role][grupo][nivel]
}
