// Rotas publicas/standalone onde os widgets flutuantes da equipe (assistente de IA,
// banner de instalacao) NAO devem aparecer.
export const ROTAS_PUBLICAS = ['/privacidade', '/termos', '/exclusao-de-dados', '/aprovar', '/status', '/trabalhe-conosco', '/login', '/doc']

export function ehRotaPublica(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return ROTAS_PUBLICAS.some(r => pathname === r || pathname.startsWith(r + '/'))
}
