// Modo "Visualizar como cliente": quando ativo, um usuario da equipe ve o portal
// exatamente como o cliente veria (somente leitura, sem acoes de equipe).
// Diferente de "Acessar sub-account", onde a equipe edita tudo.

const CHAVE = 'soma10_view_as_client'

export function isViewAsClient(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(CHAVE) === '1'
}

export function setViewAsClient(on: boolean) {
  if (typeof window === 'undefined') return
  if (on) sessionStorage.setItem(CHAVE, '1')
  else sessionStorage.removeItem(CHAVE)
}
