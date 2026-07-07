import DOMPurify from 'isomorphic-dompurify'

// Sanitiza HTML rico (RichText, documentos, notepads) antes de renderizar.
// Remove <script>, handlers on*, javascript:, etc., preservando a formatação
// (negrito, listas, títulos, cor/alinhamento via style, links). Vale client e server.
export function sanitizeHtml(html: string): string {
  if (!html) return ''
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
  })
}
