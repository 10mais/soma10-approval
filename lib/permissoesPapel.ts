import { redis } from './redis'
import { podeNivel, PermissoesPapel, GrupoPermissao, Nivel } from './permissoesCatalogo'

// Server-side: lê a config e resolve permissões. Catálogo/lógica em ./permissoesCatalogo.
export * from './permissoesCatalogo'

export async function getPermissoesPapel(): Promise<PermissoesPapel> {
  return (await redis.get<PermissoesPapel>('config:permissoesPapel')) || {}
}

// Versão servidor: role/módulo/nível, com override opcional do usuário.
export async function papelPode(role: string | undefined, grupo: GrupoPermissao | 'financeiro', nivel: Nivel = 'ver', permUsuario?: any): Promise<boolean> {
  if (role === 'admin') return true
  if (grupo === 'financeiro') return false
  if (role !== 'gerente' && role !== 'usuario') return false
  return podeNivel(role, grupo, nivel, permUsuario, await getPermissoesPapel())
}
