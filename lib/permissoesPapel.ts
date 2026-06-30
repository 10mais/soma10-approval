import { redis } from './redis'

// Permissões por PAPEL (refina o que cada papel vê, sem ser por usuário).
// Admin = sempre tudo. Vendas = navegação isolada própria. Cliente = portal.
// Configurável só o GERENTE por enquanto.

export type GrupoPermissao = 'producao' | 'estrategia' | 'crm' | 'financeiro' | 'clientes'

export type PermissoesPapel = {
  gerente?: Partial<Record<GrupoPermissao, boolean>>
}

// Padrão = comportamento atual do sistema
export const PADRAO_GERENTE: Record<GrupoPermissao, boolean> = {
  producao: true,
  estrategia: true,
  crm: true,
  financeiro: false,
  clientes: false,
}

export const GRUPOS_LABEL: Record<GrupoPermissao, string> = {
  producao: 'Produção (Tarefas, Esteira, Carga)',
  estrategia: 'Estratégia (Playbook, Campanhas, Modelos, Automações)',
  crm: 'Vendas (CRM)',
  financeiro: 'Financeiro',
  clientes: 'Clientes',
}

export async function getPermissoesPapel(): Promise<PermissoesPapel> {
  return (await redis.get<PermissoesPapel>('config:permissoesPapel')) || {}
}

// O papel pode ver o grupo? (server e client usam a mesma lógica)
export function podePapel(role: string | undefined, grupo: GrupoPermissao, perms?: PermissoesPapel | null): boolean {
  if (role === 'admin') return true
  if (role === 'gerente') return perms?.gerente?.[grupo] ?? PADRAO_GERENTE[grupo]
  return false
}

// Versão servidor (lê a config). Use nas rotas para liberar gerente com permissão.
export async function papelPode(role: string | undefined, grupo: GrupoPermissao): Promise<boolean> {
  if (role === 'admin') return true
  if (role === 'gerente') return podePapel('gerente', grupo, await getPermissoesPapel())
  return false
}
