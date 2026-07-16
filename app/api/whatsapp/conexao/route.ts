import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { evolutionConfigurado, normalizarUrlEvolution, explicaFalhaConexao } from '@/lib/whatsapp'

export const runtime = 'nodejs'

// Tela de conexão do WhatsApp (Evolution) DENTRO do Soma10 — admin.
// GET: estado da conexão. POST: conectar (devolve QR) / desconectar / registrar webhook.
// O host do Evolution fica sempre no Railway; aqui só falamos com ele pela API.

const base = () => normalizarUrlEvolution(process.env.EVOLUTION_API_URL)
const inst = () => process.env.EVOLUTION_INSTANCE || ''
const headers = () => ({ apikey: process.env.EVOLUTION_API_KEY as string, 'Content-Type': 'application/json' })

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

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (!evolutionConfigurado()) return NextResponse.json({ configurado: false, estado: 'nao_configurado' })
  try {
    const r = await fetch(`${base()}/instance/connectionState/${inst()}`, { headers: headers() })
    const d = await r.json().catch(() => ({} as any))
    const estado = d?.instance?.state || d?.state || 'desconhecido'
    return NextResponse.json({ configurado: true, estado, instancia: inst() })
  } catch (e: any) {
    return NextResponse.json({ configurado: true, estado: 'erro', erro: e?.message || String(e) })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (!evolutionConfigurado()) return NextResponse.json({ error: 'Evolution não configurado (faltam as variáveis EVOLUTION_* na Vercel).' }, { status: 400 })
  const { acao } = await req.json().catch(() => ({} as any))

  if (acao === 'desconectar') {
    try { await fetch(`${base()}/instance/logout/${inst()}`, { method: 'DELETE', headers: headers() }) } catch {}
    return NextResponse.json({ ok: true })
  }

  if (acao === 'webhook') {
    return NextResponse.json({ ok: await registrarWebhook() })
  }

  // Conectar: garante o webhook e devolve o QR (base64) / código de pareamento.
  await registrarWebhook()
  try {
    const r = await fetch(`${base()}/instance/connect/${inst()}`, { headers: headers() })
    const d = await r.json().catch(() => ({} as any))
    const base64 = d?.base64 || d?.qrcode?.base64 || null
    const codigo = d?.code || d?.qrcode?.code || d?.pairingCode || null
    if (base64 || codigo) return NextResponse.json({ ok: true, base64, codigo })
    // Sem QR = erro. Devolver o motivo do Evolution em vez de "tente de novo":
    // 404 aqui quase sempre é instância que não existe no host (esta rota pede o
    // QR de uma instância, nunca a cria), e 401 é apikey errada. Sem isto, cada
    // pareamento novo vira caça ao tesouro.
    return NextResponse.json({ error: explicaFalhaConexao(r.status, d, inst()) }, { status: 502 })
  } catch (e: any) {
    return NextResponse.json({ error: `Não deu para falar com o Evolution (${e?.message || e}). Confira a EVOLUTION_API_URL desta instância.` }, { status: 502 })
  }
}
