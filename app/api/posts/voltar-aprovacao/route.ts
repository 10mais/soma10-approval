import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Post } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'

export const runtime = 'nodejs'

// "VOLTAR" um material do link de aprovação para a produção (SÓ EQUIPE).
// Caso de uso do dono (12/08): criativo/briefing subiu como teste ou por engano
// — precisa sair da fila do cliente SEM excluir a pauta do Studio/Planner.
// Volta uma casa na esteira: aprovacao_copy -> copy · aprovacao_criativo ->
// criativo · avulso (sem etapa) -> rascunho. Nada é apagado.

// GET: diz se quem chama é equipe — o link público usa isso para decidir se
// mostra o botão (cliente e visitante anônimo nunca veem).
export async function GET() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  return NextResponse.json({ equipe: !!session && role !== 'cliente' })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel(role, 'producao', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const post = await redis.get<Post>(`post:${id}`)
  if (!post) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })

  const etapa = (post as any).etapa
  // Só volta o que está de fato na mesa do cliente (aguardando ou em ajuste).
  const voltavel = post.status === 'aguardando_aprovacao' || post.status === 'corrigir'
    || etapa === 'aprovacao_copy' || etapa === 'aprovacao_criativo'
  if (!voltavel) return NextResponse.json({ error: 'este material não está em aprovação' }, { status: 400 })

  const agora = new Date().toISOString()
  const atualizado: any = { ...post, status: 'rascunho', atualizadoEm: agora, aguardandoDesde: undefined }
  if (etapa === 'aprovacao_copy') { atualizado.etapa = 'copy'; atualizado.etapaDesde = agora }
  else if (etapa === 'aprovacao_criativo') { atualizado.etapa = 'criativo'; atualizado.etapaDesde = agora }
  await redis.set(`post:${id}`, atualizado)
  await redis.srem('agendados', id) // segurança: garante fora da fila de publicação

  return NextResponse.json({ ok: true, etapa: atualizado.etapa || null })
}
