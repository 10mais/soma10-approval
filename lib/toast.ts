// API global de notificacoes visuais (toast) e confirmacao estilizada.
// Substitui os alert()/confirm() nativos por componentes com a identidade do
// sistema. Funciona via CustomEvents — o <Toaster/> (montado no layout) escuta.

export type ToastTipo = 'sucesso' | 'erro' | 'info'

// Mostra um toast. tipo 'erro' fica vermelho, 'sucesso' verde, 'info' amarelo.
export function toast(mensagem: string, tipo: ToastTipo = 'info', titulo?: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('soma-toast', { detail: { mensagem, tipo, titulo } }))
}

export function toastErro(mensagem: string, titulo?: string) { toast(mensagem, 'erro', titulo) }
export function toastOk(mensagem: string, titulo?: string) { toast(mensagem, 'sucesso', titulo) }

// Confirmacao estilizada — substitui window.confirm. Retorna Promise<boolean>.
export function confirmar(
  mensagem: string,
  opts?: { titulo?: string; okLabel?: string; cancelLabel?: string; perigo?: boolean }
): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  return new Promise(resolve => {
    const id = Math.random().toString(36).slice(2)
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail
      if (d?.id !== id) return
      window.removeEventListener('soma-confirm-result', handler)
      resolve(!!d.ok)
    }
    window.addEventListener('soma-confirm-result', handler)
    window.dispatchEvent(new CustomEvent('soma-confirm', { detail: { id, mensagem, ...opts } }))
  })
}
