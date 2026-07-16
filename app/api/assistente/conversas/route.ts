import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { v4 as uuid } from 'uuid'
import { listarConversas, lerConversa, salvarConversa, excluirConversa, tituloDe, ConversaIA, MsgSalva } from '@/lib/assistenteConversas'

export const runtime = 'nodejs'

// Histórico do assistente/agentes — PRIVADO por usuário (ver lib/assistenteConversas).
// GET: lista os cabeçalhos; GET ?id=: a conversa inteira; POST: cria/atualiza;
// DELETE ?id=: apaga.

async function usuario() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email || ''
  if (!session || (session.user as any).role === 'cliente' || !email) return null
  return { email, nome: session.user?.name || '' }
}

export async function GET(req: NextRequest) {
  const u = await usuario()
  if (!u) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const id = (req.nextUrl.searchParams.get('id') || '').trim()
  if (id) {
    const c = await lerConversa(id, u.email)
    if (!c) return NextResponse.json({ error: 'não encontrada' }, { status: 404 })
    return NextResponse.json({ conversa: c })
  }
  return NextResponse.json({ conversas: await listarConversas(u.email) })
}

export async function POST(req: NextRequest) {
  const u = await usuario()
  if (!u) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const mensagens: MsgSalva[] = Array.isArray(body?.mensagens)
    ? body.mensagens
      .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant'))
      .map((m: any) => ({
        role: m.role,
        content: String(m.content || ''),
        ...(Array.isArray(m.imagens) && m.imagens.length ? { imagens: m.imagens.filter((x: any) => typeof x === 'string').slice(0, 4) } : {}),
        ...(Array.isArray(m.propostas) && m.propostas.length ? { propostas: m.propostas } : {}),
      }))
    : []
  // Conversa vazia (ou só com a bolha em branco do streaming) não vira registro.
  if (!mensagens.some(m => m.content.trim() || m.imagens?.length)) {
    return NextResponse.json({ error: 'conversa vazia' }, { status: 400 })
  }

  const agora = new Date().toISOString()
  const id = String(body?.id || '').trim() || uuid()
  const existente = await lerConversa(id, u.email)

  const conversa: ConversaIA = {
    id,
    email: u.email,
    ...(body?.agenteId ? { agenteId: String(body.agenteId) } : {}),
    ...(body?.agenteNome ? { agenteNome: String(body.agenteNome) } : {}),
    // Título nasce da primeira pergunta e NÃO muda depois: a pessoa já
    // memorizou a conversa por ele na lista.
    titulo: existente?.titulo || tituloDe(mensagens),
    mensagens,
    criadoEm: existente?.criadoEm || agora,
    atualizadoEm: agora,
  }
  return NextResponse.json({ ok: true, conversa: await salvarConversa(conversa) })
}

export async function DELETE(req: NextRequest) {
  const u = await usuario()
  if (!u) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const id = (req.nextUrl.searchParams.get('id') || '').trim()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const ok = await excluirConversa(id, u.email)
  if (!ok) return NextResponse.json({ error: 'não encontrada' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
