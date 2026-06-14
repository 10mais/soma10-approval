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
  // Lê apenas o índice de agendados (barato — permite rodar a cada 1 min sem estourar o Redis)
  const ids = await redis.smembers('agendados')
  if (!ids.length) return NextResponse.json({ ok: true, verificados: 0, publicados: 0, falhas: 0 })

  const posts = await Promise.all(ids.map(id => redis.get<Post>(`post:${id}`)))

  let publicados = 0, falhas = 0, verificados = 0
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i]
    const id = ids[i]
    // Limpa entradas órfãs / que não estão mais agendadas
    if (!post || post.status !== 'agendado') { await redis.srem('agendados', id); continue }
    // Ainda não chegou a hora
    if (!post.dataAgendada || new Date(post.dataAgendada).getTime() > agora) continue

    verificados++
    const cliente = post.clienteId ? await redis.get<any>(`cliente:${post.clienteId}`) : null
    const resultado = await processarPublicacao(post, cliente)
    await redis.set(`post:${id}`, { ...post, ...resultado.campos })
    await redis.srem('agendados', id) // sai do índice (publicado ou falhou — não re-tenta em loop)
    const nome = post.clienteNome || 'Cliente'
    if (resultado.ok) {
      publicados++
      await notificarEquipe('post_publicado', `Post agendado publicado — ${nome}`, `O post agendado de ${nome} foi publicado em ${resultado.redesOk}.`, id)
    } else {
      falhas++
      await notificarEquipe('post_falha_publicacao', `⚠️ Falha no agendamento — ${nome}`, `Não foi possível publicar o post agendado de ${nome}. Motivo: ${resultado.motivo}`, id)
    }
  }

  return NextResponse.json({ ok: true, verificados, publicados, falhas })
}
