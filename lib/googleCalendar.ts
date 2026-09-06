// Google Agenda do 10+ — SÓ LEITURA, para a régua do dia da Home.
//
// Autenticação por CONTA DE SERVIÇO: o dono cria a conta no Google Cloud,
// compartilha a agenda da empresa com o e-mail dela (permissão "ver todos os
// detalhes") e coloca a chave nas envs. Sem OAuth de usuário, sem tela de
// consentimento, sem token que expira no celular de alguém.
//
// Envs (todas opcionais — sem elas a Home segue só com reuniões e posts):
//   GOOGLE_CALENDAR_SA_EMAIL   e-mail da conta de serviço
//   GOOGLE_CALENDAR_SA_KEY     chave privada PEM (a "private_key" do JSON; \n literais aceitos)
//   GOOGLE_CALENDAR_IDS        ids das agendas, separados por vírgula
//                              (ex.: "empresa@grupo10mais.com.br,c_abc123@group.calendar.google.com")
//
// O JWT é assinado com o crypto do Node (RS256) — nenhuma dependência nova.
// Falha de rede/credencial NUNCA derruba a Home: devolve lista vazia e o motivo.

import { createSign } from 'crypto'

export type EventoAgenda = { id: string; titulo: string; inicio: string; fim?: string; calendario?: string; diaInteiro?: boolean }

export function agendaConfigurada(): boolean {
  return !!(process.env.GOOGLE_CALENDAR_SA_EMAIL && process.env.GOOGLE_CALENDAR_SA_KEY && process.env.GOOGLE_CALENDAR_IDS)
}

function b64url(s: string | Buffer): string {
  return Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Assina o JWT de conta de serviço (RFC 7523) e troca por access token.
async function tokenDeAcesso(): Promise<string> {
  const email = process.env.GOOGLE_CALENDAR_SA_EMAIL || ''
  const chave = (process.env.GOOGLE_CALENDAR_SA_KEY || '').replace(/\\n/g, '\n')
  const agora = Math.floor(Date.now() / 1000)
  const cabecalho = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const corpo = b64url(JSON.stringify({
    iss: email, scope: 'https://www.googleapis.com/auth/calendar.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: agora, exp: agora + 3600,
  }))
  const assinador = createSign('RSA-SHA256')
  assinador.update(`${cabecalho}.${corpo}`)
  const assinatura = b64url(assinador.sign(chave))
  const jwt = `${cabecalho}.${corpo}.${assinatura}`

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })
  const d = await r.json().catch(() => ({} as any))
  if (!r.ok || !d.access_token) throw new Error(d?.error_description || d?.error || `HTTP ${r.status}`)
  return d.access_token as string
}

// Resposta crua da API -> nosso formato. Puro (testado). Evento de dia inteiro
// vem com `date` em vez de `dateTime`; cancelado (status) não entra.
export function normalizarEventos(itens: any[], calendario?: string): EventoAgenda[] {
  if (!Array.isArray(itens)) return []
  return itens
    .filter(e => e && e.status !== 'cancelled' && (e.start?.dateTime || e.start?.date))
    .map(e => {
      const diaInteiro = !e.start?.dateTime
      const inicio = e.start?.dateTime || `${e.start.date}T00:00:00`
      const fim = e.end?.dateTime || (e.end?.date ? `${e.end.date}T00:00:00` : undefined)
      return { id: String(e.id || inicio), titulo: (e.summary || '(sem título)').trim(), inicio, fim, calendario, diaInteiro }
    })
}

// Eventos de HOJE em todas as agendas configuradas.
export async function eventosDeHoje(agora: number = Date.now()): Promise<{ eventos: EventoAgenda[]; erro?: string }> {
  if (!agendaConfigurada()) return { eventos: [] }
  try {
    const token = await tokenDeAcesso()
    const ini = new Date(agora); ini.setHours(0, 0, 0, 0)
    const fim = new Date(ini); fim.setDate(fim.getDate() + 1)
    const ids = (process.env.GOOGLE_CALENDAR_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
    const listas = await Promise.all(ids.map(async id => {
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events?` + new URLSearchParams({
        timeMin: ini.toISOString(), timeMax: fim.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '50',
      })
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const d = await r.json().catch(() => ({} as any))
      if (!r.ok) throw new Error(`${id}: ${d?.error?.message || `HTTP ${r.status}`}`)
      return normalizarEventos(d.items, d.summary || id)
    }))
    return { eventos: listas.flat().sort((a, b) => a.inicio.localeCompare(b.inicio)) }
  } catch (e: any) {
    return { eventos: [], erro: e?.message || String(e) }
  }
}
