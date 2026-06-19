import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Post } from '@/lib/redis'
import { processarPublicacao } from '@/lib/publicar'
import { notificarEquipe } from '@/lib/notificacoes'

export const runtime = 'nodejs'
export const maxDuration = 300

// Publica um post imediatamente nas redes selecionadas.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { id } = await req.json()
  const post = await redis.get<Post>(`post:${id}`)
  if (!post) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

  const cliente = post.clienteId ? await redis.get<any>(`cliente:${post.clienteId}`) : null
  const resultado = await processarPublicacao(post, cliente)

  await redis.set(`post:${id}`, { ...post, ...resultado.campos })
  await redis.srem('agendados', id) // se estava agendado, sai do índice

  const nome = post.clienteNome || 'Cliente'
  if (resultado.ok) {
    await notificarEquipe('post_publicado', `Post publicado — ${nome}`, `O post de ${nome} foi publicado em ${resultado.redesOk}.`, id)
    return NextResponse.json({ ok: true })
  } else {
    await notificarEquipe('post_falha_publicacao', `Falha ao publicar — ${nome}`, `Não foi possível publicar o post de ${nome}. Motivo: ${resultado.motivo}`, id)
    return NextResponse.json({ ok: false, error: resultado.motivo }, { status: 502 })
  }
}
