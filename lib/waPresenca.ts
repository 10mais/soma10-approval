// "Ao vivo" do WhatsApp no CRM — regras puras (sem Redis, sem rede), com teste.
//
// Dono, 22/09/2026: "a conversa não atualiza automaticamente sem o F5. Essa atualização
// precisa ser constante, se possível também mostrar o DIGITANDO".
//
// Como funciona, ponta a ponta:
//  1. Toda mensagem gravada (webhook, envio pelo sistema, mídia anexada) sobe um contador
//     no Redis (`wa:versao`). O navegador pergunta só esse número, a cada poucos segundos
//     (`/api/crm/mensagens?pulso=1`) — resposta de poucos bytes. Mudou → recarrega a lista
//     e a conversa aberta. Não mudou → não baixa nada.
//  2. "Digitando…": o Evolution manda o evento `presence.update` quando a pessoa digita ou
//     grava áudio. O WhatsApp só entrega esse aviso de quem a gente "assinou" — por isso, ao
//     abrir uma conversa, o sistema assina a presença daquele número (sendPresence). O
//     estado fica no Redis com validade curta: se o aviso de "parou" se perder, some sozinho.

export type EstadoPresenca = 'digitando' | 'gravando'

/** De quanto em quanto tempo o navegador pergunta se algo mudou (aba visível). */
export const PULSO_MS = 2500
/** Validade do "digitando" no Redis — o WhatsApp repete o aviso enquanto a pessoa digita. */
export const DIGITANDO_TTL_S = 12
/** Re-assina a presença da conversa aberta de tempos em tempos (a conexão do WhatsApp cai e perde a assinatura). */
export const REASSINAR_MS = 60_000

const soDigitos = (s: string) => String(s || '').replace(/\D/g, '')

/** Traduz a presença do WhatsApp para o que a tela mostra. `null` = parou / não mostra nada. */
export function estadoDaPresenca(p?: string): EstadoPresenca | null {
  const v = String(p || '').toLowerCase()
  if (v === 'composing') return 'digitando'
  if (v === 'recording') return 'gravando'
  return null
}

/**
 * Lê o evento `presence.update` do Evolution. Formato (v2):
 *   { event: 'presence.update', data: { id: '5511…@s.whatsapp.net', presences: { '5511…@s.whatsapp.net': { lastKnownPresence: 'composing' } } } }
 * Em grupo, `id` é o grupo e `presences` traz quem está digitando — basta UM digitando.
 * Devolve null quando o evento não é de presença ou não dá para saber de quem é.
 */
export function presencaDoEvento(body: any): { telefone: string; estado: EstadoPresenca | null } | null {
  const evento = String(body?.event || '').toLowerCase().replace(/_/g, '.')
  if (!evento.includes('presence')) return null
  const d = Array.isArray(body?.data) ? body.data[0] : body?.data
  const jid = String(d?.id || d?.remoteJid || '')
  const telefone = soDigitos(jid.split('@')[0])
  if (!telefone) return null
  const presencas = d?.presences && typeof d.presences === 'object' ? Object.values(d.presences) as any[] : []
  let estado: EstadoPresenca | null = null
  for (const p of presencas) {
    const e = estadoDaPresenca(p?.lastKnownPresence)
    if (e === 'digitando') { estado = e; break } // digitar ganha de gravar se os dois vierem
    if (e) estado = e
  }
  return { telefone, estado }
}

/** Texto do aviso no cabeçalho da conversa (chave do dicionário, lib/i18n). */
export function chaveDoAviso(estado?: EstadoPresenca | null): string | null {
  if (estado === 'digitando') return 'crm.digitando'
  if (estado === 'gravando') return 'crm.gravando-audio'
  return null
}
