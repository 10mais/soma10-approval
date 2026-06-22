import { NextRequest, NextResponse } from 'next/server'
import { redis, Post, Cliente } from '@/lib/redis'
import { processarPublicacao } from '@/lib/publicar'
import { notificarEquipe } from '@/lib/notificacoes'

export const runtime = 'nodejs'
export const maxDuration = 300

// Renova os tokens de longa duração do Instagram (no máx. 1x por dia).
// Tokens do graph.instagram.com duram ~60 dias e podem ser renovados por mais 60.
async function renovarTokensInstagram(agora: number) {
  const ultima = await redis.get<number>('tokens:ultimaRenovacao')
  if (ultima && agora - ultima < 12 * 60 * 60 * 1000) return // já renovou nas últimas 12h
  await redis.set('tokens:ultimaRenovacao', agora)

  const ids = await redis.smembers('clientes')
  for (const id of ids) {
    const c = await redis.get<Cliente>(`cliente:${id}`)
    if (!c?.instagramToken) continue
    try {
      const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${c.instagramToken}`).then(x => x.json())
      if (r?.access_token) {
        await redis.set(`cliente:${id}`, { ...c, instagramToken: r.access_token, instagramTokenAtualizadoEm: new Date().toISOString() })
      }
    } catch { /* segue para o próximo */ }
  }
}

// Publica automaticamente os posts agendados cuja data já chegou.
// Protegido pelo CRON_SECRET (a Vercel envia Authorization: Bearer <CRON_SECRET>).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  const agora = Date.now()

  // Mantém os tokens do Instagram sempre válidos (renova no máx. 1x/dia)
  await renovarTokensInstagram(agora)

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
    // CRITICO: remove do indice ANTES de publicar para evitar que outra instancia
    // do cron pegue o mesmo post e publique em duplicata (race condition)
    await redis.srem('agendados', id)
    // Re-le o post fresco do banco (pode ter sido atualizado por outra instancia)
    const postFresco = await redis.get<Post>(`post:${id}`)
    if (!postFresco || postFresco.status === 'publicado') continue
    const cliente = postFresco.clienteId ? await redis.get<any>(`cliente:${postFresco.clienteId}`) : null
    const resultado = await processarPublicacao(postFresco, cliente)
    await redis.set(`post:${id}`, { ...postFresco, ...resultado.campos })
    const nome = post.clienteNome || 'Cliente'
    if (resultado.ok) {
      publicados++
      await notificarEquipe('post_publicado', `Post agendado publicado — ${nome}`, `O post agendado de ${nome} foi publicado em ${resultado.redesOk}.`, id)
    } else {
      falhas++
      await notificarEquipe('post_falha_publicacao', `Falha no agendamento — ${nome}`, `Não foi possível publicar o post agendado de ${nome}. Motivo: ${resultado.motivo}`, id)
    }
  }

  return NextResponse.json({ ok: true, verificados, publicados, falhas })
}
