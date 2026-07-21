import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { evolutionConfigurado, normalizarUrlEvolution, normalizarChaveEvolution, explicaFalhaConexao } from '@/lib/whatsapp'

export const runtime = 'nodejs'

// Tela de conexão do WhatsApp (Evolution) DENTRO do Soma10 — admin.
// GET: estado da conexão. POST: conectar (devolve QR) / desconectar / registrar webhook.
// O host do Evolution fica sempre no Railway; aqui só falamos com ele pela API.

const base = () => normalizarUrlEvolution(process.env.EVOLUTION_API_URL)
const inst = () => process.env.EVOLUTION_INSTANCE || ''
const headers = () => ({ apikey: normalizarChaveEvolution(process.env.EVOLUTION_API_KEY), 'Content-Type': 'application/json' })

function webhookUrl(): string {
  const raiz = (process.env.APPROVAL_BASE_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '')
  const u = `${raiz}/api/whatsapp/webhook`
  return process.env.WHATSAPP_VERIFY_TOKEN ? `${u}?token=${encodeURIComponent(process.env.WHATSAPP_VERIFY_TOKEN)}` : u
}

// Registra o webhook na Evolution apontando de volta pro Soma10 (idempotente).
async function registrarWebhook(): Promise<boolean> {
  try {
    const r = await fetch(`${base()}/webhook/set/${inst()}`, {
      method: 'POST', headers: headers(),
      // base64: o Evolution embute os bytes da mídia no próprio webhook — caminho
      // mais robusto para o inbox salvar imagem/áudio/vídeo no Blob.
      body: JSON.stringify({ webhook: { enabled: true, url: webhookUrl(), base64: true, events: ['MESSAGES_UPSERT'] } }),
    })
    return r.ok
  } catch { return false }
}

// CRIA a instância no host do Evolution. Instância nova (ex.: denyturismo) não
// existe no host até alguém criá-la — e /instance/connect nunca cria, só pede o
// QR. Sem isto, toda instância provisionada obrigava o dono a abrir o /manager
// do Railway e criar à mão (foi o caso da Deny). O create com qrcode:true já
// devolve o QR/código de pareamento na própria resposta.
// Corpo v2 (integration BAILEYS = WhatsApp Web/QR); se o host for v1 e rejeitar,
// tenta o corpo mínimo antigo.
async function criarInstancia(numero?: string): Promise<{ ok: boolean; base64?: string | null; codigo?: string | null; erro?: string }> {
  const tentar = async (corpo: any) => {
    const r = await fetch(`${base()}/instance/create`, { method: 'POST', headers: headers(), body: JSON.stringify(corpo) })
    const d = await r.json().catch(() => ({} as any))
    return { r, d }
  }
  try {
    // `number` no create faz o Evolution devolver o CÓDIGO de pareamento junto.
    let { r, d } = await tentar({ instanceName: inst(), qrcode: true, integration: 'WHATSAPP-BAILEYS', ...(numero ? { number: numero } : {}) })
    if (!r.ok) ({ r, d } = await tentar({ instanceName: inst(), qrcode: true, ...(numero ? { number: numero } : {}) }))
    if (!r.ok) {
      const detalhe = [d?.response?.message, d?.message, d?.error].flat().filter((x: any) => typeof x === 'string' && x.trim()).join(' · ')
      // 401 no CREATE tem causa específica e vale explicar: /instance/create é um
      // endpoint GLOBAL do host — ele exige a AUTHENTICATION_API_KEY do Evolution,
      // não um token de instância. Dá para consultar o estado de uma instância com
      // token menor e mesmo assim levar 401 aqui, que foi o caso da Sua Dupla.
      if (r.status === 401 || r.status === 403) {
        return { ok: false, erro: `O Evolution recusou a chave ao criar a instância "${inst()}" (HTTP ${r.status}). A EVOLUTION_API_KEY precisa ser a AUTHENTICATION_API_KEY GLOBAL do host — a mesma que está no Railway, em Variables do serviço Evolution. Token de instância não cria instância.` }
      }
      return { ok: false, erro: `O Evolution não deixou criar a instância "${inst()}"${detalhe ? ` — ${detalhe}` : ''} (HTTP ${r.status}).` }
    }
    return { ok: true, base64: d?.qrcode?.base64 || d?.base64 || null, codigo: d?.qrcode?.code || d?.qrcode?.pairingCode || d?.pairingCode || null }
  } catch (e: any) {
    return { ok: false, erro: `Falha ao criar a instância no Evolution (${e?.message || e}).` }
  }
}

// Host (sem a chave) da EVOLUTION_API_URL — vai para a tela no diagnóstico.
// A URL não é segredo (a apikey é), e mostrá-la resolve o caso real: quem
// cadastra as envs como "Sensitive" na Vercel NÃO CONSEGUE MAIS RELÊ-LAS, então
// errar a URL vira um erro mudo impossível de conferir pelo painel.
function hostEvolution(): string {
  try { return new URL(base()).host } catch { return String(process.env.EVOLUTION_API_URL || '').slice(0, 80) }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (!evolutionConfigurado()) return NextResponse.json({ configurado: false, estado: 'nao_configurado' })
  const comum = { configurado: true, instancia: inst(), host: hostEvolution() }
  try {
    const r = await fetch(`${base()}/instance/connectionState/${inst()}`, { headers: headers() })
    const d = await r.json().catch(() => ({} as any))
    // Antes o status HTTP era ignorado: 401 (apikey errada) e 404 (instância
    // inexistente) caíam em "desconhecido" e a pessoa ficava sem saber o motivo.
    if (!r.ok) {
      // 404 NÃO é erro: é o estado normal antes do primeiro pareamento — a
      // instância só passa a existir quando alguém clica em Conectar.
      if (r.status === 404) return NextResponse.json({ ...comum, estado: 'sem_instancia' })
      if (r.status === 401 || r.status === 403) {
        return NextResponse.json({ ...comum, estado: 'erro', erro: `O Evolution recusou a chave (HTTP ${r.status}). Confira a EVOLUTION_API_KEY desta instância — ela precisa ser a AUTHENTICATION_API_KEY do host ${hostEvolution()}.` })
      }
      const detalhe = [d?.response?.message, d?.message, d?.error].flat().filter((x: any) => typeof x === 'string' && x.trim()).join(' · ')
      return NextResponse.json({ ...comum, estado: 'erro', erro: `O Evolution respondeu HTTP ${r.status}${detalhe ? ` — ${detalhe}` : ''}.` })
    }
    const estado = d?.instance?.state || d?.state || 'desconhecido'
    return NextResponse.json({ ...comum, estado })
  } catch (e: any) {
    // fetch nem completou: URL errada/malformada ou host fora do ar.
    return NextResponse.json({ ...comum, estado: 'erro', erro: `Não consegui falar com o host "${hostEvolution()}" (${e?.message || e}). Confira a EVOLUTION_API_URL desta instância — precisa começar com https:// e ser o domínio do Evolution no Railway.` })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (!evolutionConfigurado()) return NextResponse.json({ error: 'Evolution não configurado (faltam as variáveis EVOLUTION_* na Vercel).' }, { status: 400 })
  const { acao, numero } = await req.json().catch(() => ({} as any))
  // Número do WhatsApp a parear (com DDI). Com ele, o Evolution gera o CÓDIGO de
  // pareamento — o caminho que funciona quando o celular recusa o QR com "Não
  // foi possível conectar o dispositivo" (aconteceu na Norah e na Deny).
  const num = String(numero || '').replace(/\D/g, '')

  if (acao === 'desconectar') {
    try { await fetch(`${base()}/instance/logout/${inst()}`, { method: 'DELETE', headers: headers() }) } catch {}
    return NextResponse.json({ ok: true })
  }

  if (acao === 'webhook') {
    return NextResponse.json({ ok: await registrarWebhook() })
  }

  // Conectar: garante o webhook e devolve o QR (base64) / código de pareamento.
  // Com `numero`, o connect leva ?number= e o Evolution devolve o pairingCode.
  const conectarUrl = `${base()}/instance/connect/${inst()}${num ? `?number=${num}` : ''}`
  await registrarWebhook()
  try {
    const r = await fetch(conectarUrl, { headers: headers() })
    const d = await r.json().catch(() => ({} as any))
    const base64 = d?.base64 || d?.qrcode?.base64 || null
    const codigo = d?.code || d?.qrcode?.code || d?.pairingCode || null
    if (base64 || codigo) return NextResponse.json({ ok: true, base64, codigo })

    // 404 = a instância ainda não existe no host (o connect nunca cria). Em vez
    // de mandar o dono ao /manager do Railway, CRIA aqui e segue o pareamento.
    if (r.status === 404) {
      const criada = await criarInstancia(num || undefined)
      if (!criada.ok) return NextResponse.json({ error: criada.erro }, { status: 502 })
      await registrarWebhook() // agora a instância existe; o webhook cola
      if (criada.base64 || criada.codigo) return NextResponse.json({ ok: true, base64: criada.base64, codigo: criada.codigo })
      // Criou mas o create não trouxe QR — pede pelo caminho normal.
      const r2 = await fetch(conectarUrl, { headers: headers() })
      const d2 = await r2.json().catch(() => ({} as any))
      const b2 = d2?.base64 || d2?.qrcode?.base64 || null
      const c2 = d2?.code || d2?.qrcode?.code || d2?.pairingCode || null
      if (b2 || c2) return NextResponse.json({ ok: true, base64: b2, codigo: c2 })
      return NextResponse.json({ error: `Instância "${inst()}" criada, mas o Evolution não devolveu o QR — clique em Conectar de novo.` }, { status: 502 })
    }

    // Sem QR = erro. Devolver o motivo do Evolution em vez de "tente de novo":
    // 401 é apikey errada; o resto sai traduzido. Sem isto, cada pareamento novo
    // vira caça ao tesouro.
    return NextResponse.json({ error: explicaFalhaConexao(r.status, d, inst()) }, { status: 502 })
  } catch (e: any) {
    return NextResponse.json({ error: `Não deu para falar com o Evolution (${e?.message || e}). Confira a EVOLUTION_API_URL desta instância.` }, { status: 502 })
  }
}
