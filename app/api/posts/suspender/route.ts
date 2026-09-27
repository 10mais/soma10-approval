import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Post } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { registrarAuditoria } from '@/lib/auditoria'
import { contasDoCliente, ID_CONTA_PRINCIPAL } from '@/lib/contasSociais'
import { alterarAgendaYouTube } from '@/lib/youtube'
import { suspender, reativar, suspenderRede, reativarRede, TEXTO_MOTIVO, NOME_REDE, type Rede } from '@/lib/suspenderPost'

export const runtime = 'nodejs'
export const maxDuration = 60

// SUSPENDER / REATIVAR um post, inteiro ou uma rede só (regras em lib/suspenderPost).
// Só a equipe, com permissão de editar Produção. Post a post (decisão do dono, 27/09).
//
// Corpo: { id, acao: 'suspender' | 'reativar' | 'suspender-rede' | 'reativar-rede', rede?, novaData? }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel(role, 'producao', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }

  const { id, acao, rede, novaData } = await req.json().catch(() => ({} as any))
  if (!id || !acao) return NextResponse.json({ error: 'id e acao são obrigatórios' }, { status: 400 })
  if ((acao === 'suspender-rede' || acao === 'reativar-rede') && !['instagram', 'facebook', 'youtube'].includes(rede)) {
    return NextResponse.json({ error: 'rede inválida' }, { status: 400 })
  }

  // Não briga com uma publicação em andamento (o lock é o mesmo de lib/publicar).
  if (await redis.get(`publicando:${id}`)) return NextResponse.json({ error: TEXTO_MOTIVO.publicando, motivo: 'publicando' }, { status: 409 })

  const post = await redis.get<Post>(`post:${id}`)
  if (!post) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  const quem = session.user?.name || session.user?.email || 'equipe'
  const agora = new Date()

  let patch: Record<string, any>
  let youtube: 'cancelar' | 'reagendar' | null = null
  let detalhe = ''

  if (acao === 'suspender') {
    const r = suspender(post as any, quem, agora)
    if (r.ok === false) return NextResponse.json({ error: TEXTO_MOTIVO[r.motivo], motivo: r.motivo }, { status: 400 })
    patch = r.patch; if (r.cancelarYouTube) youtube = 'cancelar'
    detalhe = `post inteiro (estava ${post.status})`
  } else if (acao === 'reativar') {
    const r = reativar(post as any, agora, novaData)
    if (r.ok === false) return NextResponse.json({ error: TEXTO_MOTIVO[r.motivo], motivo: r.motivo }, { status: 400 })
    patch = r.patch; if (r.reagendarYouTube) youtube = 'reagendar'
    detalhe = `post inteiro (volta a ${patch.status})`
  } else if (acao === 'suspender-rede') {
    const r = suspenderRede(post as any, rede as Rede, agora)
    if (r.ok === false) return NextResponse.json({ error: TEXTO_MOTIVO[r.motivo], motivo: r.motivo }, { status: 400 })
    patch = r.patch; if (r.remoto) youtube = 'cancelar'
    detalhe = NOME_REDE[rede as Rede]
  } else if (acao === 'reativar-rede') {
    const r = reativarRede(post as any, rede as Rede, agora, novaData)
    if (r.ok === false) return NextResponse.json({ error: TEXTO_MOTIVO[r.motivo], motivo: r.motivo }, { status: 400 })
    patch = r.patch; if (r.remoto) youtube = 'reagendar'
    detalhe = NOME_REDE[rede as Rede]
  } else {
    return NextResponse.json({ error: 'ação inválida' }, { status: 400 })
  }

  // YouTube: o vídeo já está lá esperando a data. Mexe no YouTube ANTES de gravar — se o Google
  // recusar, o post continua como estava e a tela mostra o motivo (não fica "suspenso" aqui
  // com o vídeo ainda agendado lá).
  if (youtube) {
    const cliente = post.clienteId ? await redis.get<any>(`cliente:${post.clienteId}`) : null
    const contas = contasDoCliente(cliente)
    const ids = Object.entries(post.youtubeVideoIds || {})
    if (!ids.length) return NextResponse.json({ error: 'O post não tem o id do vídeo no YouTube. Ajuste direto no YouTube Studio.' }, { status: 400 })
    const quando = youtube === 'reagendar' ? (patch.youtubePublicarEm || post.youtubePublicarEm) : undefined
    for (const [contaId, videoId] of ids) {
      const conta = contas.find(c => c.id === (contaId || ID_CONTA_PRINCIPAL))
      if (!conta) return NextResponse.json({ error: 'O canal do YouTube deste vídeo não está mais conectado ao cliente.' }, { status: 400 })
      const r = await alterarAgendaYouTube(conta, videoId, quando)
      if (r.ok === false) return NextResponse.json({ error: r.erro, reconectar: !!r.reconectar }, { status: 502 })
    }
  }

  // Relê o post fresco e aplica só o patch (outra aba pode ter mexido nele no meio).
  const fresco = (await redis.get<Post>(`post:${id}`)) || post
  const atualizado: any = { ...fresco, ...patch }
  for (const k of Object.keys(patch)) if (patch[k] === undefined) delete atualizado[k]
  await redis.set(`post:${id}`, atualizado)
  // Índice da fila de publicação acompanha o status.
  if (atualizado.status === 'agendado') await redis.sadd('agendados', id)
  else await redis.srem('agendados', id)

  const rotulo = { 'suspender': 'post_suspenso', 'reativar': 'post_reativado', 'suspender-rede': 'post_rede_suspensa', 'reativar-rede': 'post_rede_reativada' }[acao as string]
  await registrarAuditoria({ ator: quem, acao: rotulo || acao, alvo: `${post.clienteNome || 'Cliente'} · post ${post.codigo || id}`, detalhe })

  return NextResponse.json({ ok: true, post: atualizado })
}
