// APROVAÇÃO — o que o cartão do criativo e a tabela de copies compartilham entre o LINK
// PÚBLICO (/aprovacoes/[token]) e o PORTAL do cliente (/cliente/[id]/aprovacoes).
//
// Fase 1 da rodada de ajuste (dono, 29/09): "um único formulário de pedido no link e no
// portal". Antes o portal tinha outro formulário (sem marcar pontos na arte, e o "Rejeitar"
// virava ajuste) e outra rota. Agora as duas telas mostram os MESMOS componentes, e quem
// muda é só o `enviar`: o link manda com o token; o portal, com a sessão.

export const ehVideoUrl = (u: string) => /\.(mp4|mov|m4v|webm)(\?|$)/i.test(u || '')

export type Anot = { x: number; y: number; text: string; id: number; img: number }

export type PostA = {
  id: string; codigo?: string; imagens: string[]; legenda: string; formato?: string; dataAgendada?: string; capasVideo?: Record<string, string>; status?: string; anotacoes?: Anot[]; ajusteCriativo?: string; motivoReprovacao?: string
  // Copy em aprovação (linha de montagem): o card vira "arte de texto"
  ehCopy?: boolean; headline?: string; subheadline?: string; textoImagem?: string; cta?: string
  laminas?: { texto: string }[]; medidas?: string; localAplicacao?: string; ajusteCopy?: string
  // Prévia da arte (MockupCopy): cor e logo do cliente — por post quando a tela mistura clientes.
  corMarca?: string; fotoUrl?: string
}

/** O corpo de uma decisão (o mesmo de /api/decision, sem a credencial). */
export type CorpoDecisao = {
  id: string
  type: 'approved' | 'corrected' | 'rejected' | 'caption'
  rejectReason?: string
  novaLegenda?: string
  novaData?: string
  annotations?: Anot[]
  novosCampos?: { headline?: string; subheadline?: string; textoImagem?: string; cta?: string }
  novasLaminas?: string[] // carrossel: o texto de cada lâmina, na ordem
}

/** Resposta da rota de decisão (o que as telas leem dela). */
export type RespostaDecisao = { ok?: boolean; error?: string; aplicadoAutomaticamente?: boolean; agendadoPara?: string } | null

/** Quem manda a decisão: o link (token) ou o portal (sessão). */
export type EnviarDecisao = (corpo: CorpoDecisao) => Promise<RespostaDecisao>

export const btn = (bg: string, color: string, border?: string): React.CSSProperties => ({ padding: '12px 8px', background: bg, color, border: border ? `1.5px solid ${border}` : 'none', borderRadius: 12, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' })

// ISO -> valor de <input type="datetime-local"> (hora local).
export function toLocalInput(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export const rotuloAj: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--v2-ink2)', marginBottom: 6 }
export const campoAj: React.CSSProperties = { width: '100%', padding: '11px 13px', borderRadius: 8, border: '1px solid var(--v2-rule)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5, outline: 'none' }

/** POST de uma decisão na rota única. `extra` = a credencial (token do link) quando houver. */
export async function postarDecisao(corpo: CorpoDecisao, extra: Record<string, any> = {}): Promise<RespostaDecisao> {
  return fetch('/api/decision', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...corpo, ...extra }),
  }).then(x => x.json()).catch(() => null)
}

/** O post do banco no formato do cartão/tabela (portal e dashboard; o link já recebe assim da API). */
export const paraCartaoAprovacao = (p: any): PostA => ({ ...p, imagens: p.imagens || [], legenda: p.legenda || '', ehCopy: p.etapa === 'aprovacao_copy' })
