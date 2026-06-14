import { NextRequest, NextResponse } from 'next/server'
import { redis, Post } from '@/lib/redis'
import { processarPublicacao } from '@/lib/publicar'
import { notificarEquipe } from '@/lib/notificacoes'

export const runtime = 'nodejs'
export const maxDuration = 60

// Publica automaticamente os posts agendados cuja data já chegou.
// Protegido pelo CRON_SECRET (a Vercel envia Authorization: Bearer <CRON_SECRET>).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  const agora = Date.now()
  const ids = await redis.smembers('posts')
  const posts = await Promise.all(ids.map(id => redis.get<Post>(`post:${id}`)))
  const aPublicar = posts.filter((p): p is Post =>
    !!p && p.status === 'agendado' && !!p.dataAgendada && new Date(p.dataAgendada).getTime() <= agora
  )

  let publicados = 0, falhas = 0
  for (const post of aPublicar) {
    const cliente = post.clienteId ? await redis.get<any>(`cliente:${post.clienteId}`) : null
    const resultado = await processarPublicacao(post, cliente)
    await redis.set(`post:${post.id}`, { ...post, ...resultado.campos })
    const nome = post.clienteNome || 'Cliente'
    if (resultado.ok) {
      publicados++
      await notificarEquipe('post_publicado', `Post agendado publicado — ${nome}`, `O post agendado de ${nome} foi publicado em ${resultado.redesOk}.`, post.id)
    } else {
      falhas++
      await notificarEquipe('post_falha_publicacao', `⚠️ Falha no agendamento — ${nome}`, `Não foi possível publicar o post agendado de ${nome}. Motivo: ${resultado.motivo}`, post.id)
    }
  }

  return NextResponse.json({ ok: true, verificados: aPublicar.length, publicados, falhas })
}
