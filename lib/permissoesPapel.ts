import { redis } from './redis'

// Permissões por PAPEL (refina o que cada papel vê, sem ser por usuário).
// Só o ADMIN configura. Hierarquia: admin > gerente > usuario > vendas > cliente.
// Admin = tudo. Vendas = navegação isolada própria. Cliente = portal.
// O FINANCEIRO é exclusivo do admin (não configurável para ninguém).
// Configuráveis: Gerente e Usuário.

export type GrupoPermissao = 'producao' | 'estrategia' | 'crm' | 'clientes'
export type PapelConfig = 'gerente' | 'usuario'

export type PermissoesPapel = Partial<Record<PapelConfig, Partial<Record<GrupoPermissao, boolean>>>>

// Padrões por papel (Gerente amplo; Usuário limitado). Admin pode editar.
export const PADRAO: Record<PapelConfig, Record<GrupoPermissao, boolean>> = {
  gerente: { producao: true, estrategia: true, crm: true, clientes: false },
  usuario: { producao: true, estrategia: false, crm: false, clientes: false },
}

export const GRUPOS: { chave: GrupoPermissao; label: string }[] = [
  { chave: 'producao', label: 'Produção' },
  { chave: 'estrategia', label: 'Estratégia' },
  { chave: 'crm', label: 'Vendas (CRM)' },
  { chave: 'clientes', label: 'Clientes' },
]

export async function getPermissoesPapel(): Promise<PermissoesPapel> {
  return (await redis.get<PermissoesPapel>('config:permissoesPapel')) || {}
}

// O papel pode ver o grupo? Financeiro só admin. (server e client usam a mesma lógica)
export function podePapel(role: string | undefined, grupo: GrupoPermissao | 'financeiro', perms?: PermissoesPapel | null): boolean {
  if (role === 'admin') return true
  if (grupo === 'financeiro') return false // exclusivo do admin
  if (role === 'gerente' || role === 'usuario') {
    return perms?.[role]?.[grupo] ?? PADRAO[role][grupo]
  }
  return false
}

// Versão servidor (lê a config).
export async function papelPode(role: string | undefined, grupo: GrupoPermissao | 'financeiro'): Promise<boolean> {
  if (role === 'admin') return true
  if (grupo === 'financeiro') return false
  if (role === 'gerente' || role === 'usuario') return podePapel(role, grupo, await getPermissoesPapel())
  return false
}
