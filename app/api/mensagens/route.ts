import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Usuario, ChatMensagem } from '@/lib/redis'
import { v4 as uuid } from 'uuid'
import { notificar } from '@/lib/notificacoes'

export const runtime = 'nodejs'

// Chave da conversa: canal geral da equipe ou DM entre dois e-mails (ordenados)
function chaveConversa(me: string, outro: string) {
  if (outro === 'equipe') return 'chat:equipe'
  return `chat:dm:${[me, outro].sort().join('|')}`
}

async function lerThread(chave: string): Promise<ChatMensagem[]> {
  const itens = await redis.lrange<ChatMensagem>(chave, 0, -1)
  return (itens || []).filter(Boolean)
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  const me = session?.user?.email || ''
  if (!session || role === 'cliente' || !me) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  // Lista de contatos (equipe) com prévia da última mensagem e não lidas
  if (req.nextUrl.searchParams.get('contatos')) {
    const emails = await redis.smembers('usuarios')
    const usuarios = (await Promise.all(emails.map(e => redis.get<Usuario>(`usuario:${e}`)))).filter(Boolean) as Usuario[]
    const equipe = usuarios.filter(u => u.role !== 'cliente' && u.email !== me)

    const contatos = await Promise.all([
      { email: 'equipe', nome: 'Equipe (geral)', role: 'canal' as const },
      ...equipe.map(u => ({ email: u.email, nome: u.nome, role: u.role })),
    ].map(async c => {
      const chave = chaveConversa(me, c.email)
      const msgs = await lerThread(chave)
      const ultima = msgs[msgs.length - 1]
      const lidoEm = (await redis.get<string>(`chat:read:${me}:${chave}`)) || ''
      const naoLidas = msgs.filter(m => m.de !== me && m.criadoEm > lidoEm).length
      return {
        ...c,
        ultimaMensagem: ultima ? ultima.texto : '',
        ultimaEm: ultima ? ultima.criadoEm : '',
        naoLidas,
      }
    }))

    contatos.sort((a, b) => (b.ultimaEm || '').localeCompare(a.ultimaEm || ''))
    return NextResponse.json(contatos)
  }

  // Thread de uma conversa específica
  const com = req.nextUrl.searchParams.get('com')
  if (!com) return NextResponse.json({ error: 'parâmetro "com" é obrigatório' }, { status: 400 })

  const chave = chaveConversa(me, com)
  const msgs = await lerThread(chave)
  // Marca como lida (último timestamp visto)
  await redis.set(`chat:read:${me}:${chave}`, new Date().toISOString())
  return NextResponse.json(msgs)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  const me = session?.user?.email || ''
  if (!session || role === 'cliente' || !me) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { para, texto } = await req.json()
  if (!para || !texto?.trim()) return NextResponse.json({ error: 'destinatário e texto são obrigatórios' }, { status: 400 })

  const msg: ChatMensagem = {
    id: uuid(),
    de: me,
    deNome: session.user?.name || me,
    para,
    texto: String(texto).slice(0, 4000),
    criadoEm: new Date().toISOString(),
  }

  const chave = chaveConversa(me, para)
  await redis.rpush(chave, msg)
  await redis.set(`chat:read:${me}:${chave}`, msg.criadoEm)

  // Notificar destinatario (DM) ou equipe (canal geral)
  if (para !== 'equipe') {
    await notificar(para, 'mensagem_privada', 'Nova mensagem', `${msg.deNome}: "${texto.slice(0, 80)}"`)
  } else {
    const emails = await redis.smembers('usuarios')
    const usuarios = (await Promise.all(emails.map(e => redis.get<Usuario>(`usuario:${e}`)))).filter(Boolean) as Usuario[]
    const equipe = usuarios.filter(u => u.role !== 'cliente' && u.email !== me)
    await Promise.all(equipe.map(u => notificar(u.email, 'mensagem_privada', 'Mensagem na equipe', `${msg.deNome}: "${texto.slice(0, 80)}"`)))
  }

  return NextResponse.json({ ok: true, mensagem: msg })
}
