import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente, Post } from '@/lib/redis'
import { v4 as uuid } from 'uuid'
import { checarRate } from '@/lib/rateLimit'

export const runtime = 'nodejs'

// POST (equipe): garante o token de aprovação do cliente e devolve o token/link.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { clienteId, rotacionar } = await req.json()
  const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

  // Rotação: revoga o token atual (o link antigo para de funcionar) e gera um novo.
  if (rotacionar && cliente.aprovacaoToken) {
    await redis.del(`aprovtoken:${cliente.aprovacaoToken}`)
    cliente.aprovacaoToken = undefined
  }

  let token = cliente.aprovacaoToken
  if (!token) {
    token = uuid().replace(/-/g, '').slice(0, 20)
    await redis.set(`cliente:${clienteId}`, { ...cliente, aprovacaoToken: token })
  }
  await redis.set(`aprovtoken:${token}`, clienteId) // mapa reverso O(1)
  return NextResponse.json({ ok: true, token })
}

// GET ?token= (público): lista os materiais aguardando aprovação do cliente.
export async function GET(req: NextRequest) {
  const rl = await checarRate(req, 'aprov-link', 60, 60); if (rl) return rl
  const token = req.nextUrl.searchParams.get('token') || ''
  if (!token) return NextResponse.json({ error: 'token obrigatório' }, { status: 400 })

  const clienteId = await redis.get<string>(`aprovtoken:${token}`)
  if (!clienteId) return NextResponse.json({ error: 'link inválido' }, { status: 404 })
  const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  // Cliente suspenso por inadimplência: o link público não mostra/aprova conteúdo.
  if (cliente.inadimplente) return NextResponse.json({ suspenso: true, clienteNome: cliente.nome })

  const ids = await redis.smembers('posts')
  const todos = ids.length ? ((await redis.mget<(Post | null)[]>(...ids.map(i => `post:${i}`))).filter(Boolean) as Post[]) : []
  const posts = todos
    // Mostra os aguardando aprovação E os que estão EM AJUSTE (corrigir) — para o
    // criativo não sumir enquanto a agência trabalha e o cliente poder editar o ajuste.
    // A COPY em aprovação (etapa aprovacao_copy) entra pelo mesmo link: o cliente
    // aprova o TEXTO antes de a arte ser produzida (linha de montagem).
    .filter(p => p.clienteId === clienteId && (p.status === 'aguardando_aprovacao' || p.status === 'corrigir' || p.etapa === 'aprovacao_copy'))
    .sort((a, b) => (a.criadoEm || '').localeCompare(b.criadoEm || ''))
    .map(p => ({
      id: p.id, codigo: (p as any).codigo, imagens: p.imagens || [], legenda: p.legenda || '',
      formato: (p as any).formato || '', dataAgendada: (p as any).dataAgendada || '', capasVideo: (p as any).capasVideo || {},
      status: p.status, anotacoes: (p as any).anotacoes || [], ajusteCriativo: (p as any).ajusteCriativo || '', motivoReprovacao: (p as any).motivoReprovacao || '',
      // Copy em aprovação: o card do link vira "arte de texto" com estes campos.
      ehCopy: p.etapa === 'aprovacao_copy',
      headline: (p as any).headline || '', subheadline: (p as any).subheadline || '',
      textoImagem: (p as any).textoImagem || '', cta: (p as any).cta || '',
      laminas: ((p as any).laminas || []).map((l: any) => ({ texto: l?.texto || '' })),
      medidas: (p as any).medidas || '', localAplicacao: (p as any).localAplicacao || '',
      ajusteCopy: (p as any).ajusteCopy || '',
    }))

  // PROGRAMAÇÃO em cascata (painel do link): o que já está aprovado/agendado
  // deste cliente, da próxima postagem em diante (+ publicados de hoje). O
  // cliente vê o plano inteiro se materializar a cada aprovação.
  const ehVideo = (u: string) => /\.(mp4|mov|m4v|webm)(\?|$)/i.test(u || '')
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const programacao = todos
    .filter(p => p.clienteId === clienteId && !(p as any).excluidoEm
      && ['agendado', 'aprovado', 'publicando', 'publicado'].includes(p.status)
      && (p as any).dataAgendada && new Date((p as any).dataAgendada).getTime() >= hoje.getTime())
    .sort((a, b) => ((a as any).dataAgendada || '').localeCompare((b as any).dataAgendada || ''))
    .map(p => {
      const imgs = p.imagens || []
      const primeira = imgs[0] || ''
      const capa = imgs.find(u => !ehVideo(u)) || ((p as any).capasVideo || {})[primeira] || ''
      return {
        id: p.id, dataAgendada: (p as any).dataAgendada, formato: (p as any).formato || 'feed',
        status: p.status === 'publicado' ? 'publicado' : p.status === 'publicando' ? 'publicando' : 'agendado',
        capa, legenda: (p.legenda || '').slice(0, 90),
      }
    })

  // Logo do perfil: cliente.logo pode estar expirado (URL do IG → 403). Manda
  // também o ativo 'logo' da marca (Blob permanente) como fallback pro mockup.
  const assetLogo = (Array.isArray(cliente.assetsMarca) ? cliente.assetsMarca : []).find(a => a?.categoria === 'logo')?.url || ''
  return NextResponse.json({ clienteNome: cliente.nome, logo: cliente.logo || '', logoAlt: assetLogo, instagram: cliente.instagram || '', posts, programacao })
}
