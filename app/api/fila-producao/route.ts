import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Post, Tarefa, Cliente } from '@/lib/redis'
import { getClientesRaw } from '@/lib/cache'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { tarefaDaPauta } from '@/lib/producaoVinculo'
import { tituloSubtarefa } from '@/lib/esteiraFluxo'
import { v4 as uuid } from 'uuid'
import {
  colunaDoCriativo, desdeQuandoNaColuna, alertaDoPrazo, prontoParaEnviar, ordenarFila, podeMoverCartao,
  COLUNAS_FILA, DESTINOS_FILA, type DestinoFila, type ItemFila,
} from '@/lib/filaProducao'

export const runtime = 'nodejs'

// FILA DE PRODUÇÃO de criativos (dono, 26/10/2026). GET: os cartões de TODA a equipe (só pautas do
// Estúdio com a copy aprovada), já com a coluna, os alertas e se quem pede pode mover cada um.
// PUT: o designer da peça (ou gestor do squad, gerente, admin) move entre Na fila, Em produção e
// Aguardando material. "Entregar" é concluir a tarefa com a arte (rota de tarefas, como sempre).
// Regras em lib/filaProducao (testadas).

const ehImagem = (u: string) => /\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/i.test(u || '')

function gestoresDo(cliente?: Cliente | null): string[] {
  const p = (cliente as any)?.squadPapeis || {}
  return [p.gestor_projetos, p.gestor_operacao].filter(Boolean)
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente' || role === 'vendas') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel(role, 'producao', 'ver', (session.user as any).permissoes)) return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  const eu = { email: String(session.user?.email || ''), role }
  const agora = Date.now()

  const [postIds, tarefaIds, clientes] = await Promise.all([redis.smembers('posts'), redis.smembers('tarefas'), getClientesRaw()])
  const posts = postIds.length ? ((await redis.mget<(Post | null)[]>(...postIds.map(id => `post:${id}`))).filter(Boolean) as Post[]) : []
  const tarefas = tarefaIds.length ? ((await redis.mget<(Tarefa | null)[]>(...tarefaIds.map(id => `tarefa:${id}`))).filter(Boolean) as Tarefa[]) : []
  // Cliente arquivado/excluído some (mesma regra das telas de produção).
  const porCliente = new Map(clientes.filter(c => !c.arquivado).map(c => [c.id, c]))

  const itens: ItemFila[] = []
  for (const p of posts) {
    if (!p.etapa || !p.clienteId || !porCliente.has(p.clienteId)) continue
    const t = tarefaDaPauta(p as any, tarefas as any) as Tarefa | undefined
    const coluna = colunaDoCriativo(p as any, t as any, agora)
    if (!coluna) continue
    const imagens = p.imagens || []
    const miniatura = (p as any).thumbnail || imagens.find(ehImagem) || (imagens[0] ? (p as any).capasVideo?.[imagens[0]] : undefined)
    // Só se mexe com a tarefa do designer aberta e numa coluna que é dele (o ajuste pedido
    // também é: ele começa a refazer). O resto anda sozinho pelo estado da pauta.
    const aberta = !!t && ['a_fazer', 'em_andamento'].includes(t.status)
    const colunaDoDesigner = !!COLUNAS_FILA.find(c => c.chave === coluna)?.doDesigner || coluna === 'ajuste_pedido'
    const alerta = alertaDoPrazo(coluna, t?.prazo, agora)
    itens.push({
      postId: p.id, tarefaId: t?.id, clienteId: p.clienteId, ...(p.planoId ? { planoId: p.planoId } : {}), clienteNome: p.clienteNome || porCliente.get(p.clienteId)?.nome || '',
      titulo: tituloSubtarefa(p as any), formato: (p as any).formato, ...(miniatura ? { miniatura } : {}),
      designerEmail: t?.responsavelEmail || undefined, designerNome: t?.responsavelNome || undefined,
      prazo: t?.prazo || undefined, dataPostagem: p.dataAgendada || undefined,
      coluna, desde: desdeQuandoNaColuna(coluna, p as any, t as any),
      ...(alerta ? { alerta } : {}),
      ...(t?.ajustePedidoEm && coluna !== 'aprovado' && coluna !== 'com_cliente' ? { ajuste: true } : {}),
      ...(prontoParaEnviar(coluna, p as any) ? { prontoParaEnviar: true } : {}),
      ...(!t?.responsavelEmail ? { semDesigner: true } : {}),
      ...((t as any)?.aguardandoMaterial ? { aguardando: (t as any).aguardandoMaterial } : {}),
      podeMover: aberta && colunaDoDesigner && podeMoverCartao(eu, t?.responsavelEmail, gestoresDo(porCliente.get(p.clienteId))),
    })
  }
  return NextResponse.json({ itens: ordenarFila(itens), geradoEm: agora })
}

const ROTULO: Record<DestinoFila, string> = { na_fila: 'Na fila', em_producao: 'Em produção', aguardando_material: 'Aguardando material' }

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente' || role === 'vendas') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const corpo = await req.json().catch(() => ({} as any))
  const para = corpo?.para as DestinoFila
  const motivo = String(corpo?.motivo || '').trim()
  if (!DESTINOS_FILA.includes(para)) return NextResponse.json({ error: 'Destino inválido.' }, { status: 400 })
  const t = await redis.get<Tarefa>(`tarefa:${String(corpo?.tarefaId || '')}`)
  if (!t || (t as any).excluidoEm) return NextResponse.json({ error: 'Tarefa não encontrada.' }, { status: 404 })
  if (!t.origemPostId) return NextResponse.json({ error: 'Esta tarefa não é de uma pauta do Estúdio.' }, { status: 400 })
  if (!['a_fazer', 'em_andamento'].includes(t.status)) return NextResponse.json({ error: 'Esta peça já foi entregue. Para mexer de novo, peça um ajuste na revisão.' }, { status: 400 })
  const cliente = t.clienteId ? await redis.get<Cliente>(`cliente:${t.clienteId}`) : null
  if (!podeMoverCartao({ email: String(session.user?.email || ''), role }, t.responsavelEmail, gestoresDo(cliente))) {
    return NextResponse.json({ error: 'Só o designer da peça, os gestores do squad, gerente e admin mudam o status.' }, { status: 403 })
  }
  if (para === 'aguardando_material' && !motivo) return NextResponse.json({ error: 'Diga o que está faltando para produzir.' }, { status: 400 })

  const agora = new Date().toISOString()
  const autor = session.user?.name || session.user?.email || ''
  const atualizado: any = { ...t, atualizadoEm: agora, filaDesde: agora }
  if (para === 'aguardando_material') {
    atualizado.aguardandoMaterial = { motivo: motivo.slice(0, 300), desde: agora, por: autor }
  } else {
    delete atualizado.aguardandoMaterial
    atualizado.status = para === 'em_producao' ? 'em_andamento' : 'a_fazer'
  }
  atualizado.atividades = [...(t.atividades || []), { id: uuid(), tipo: 'status', descricao: `Fila de produção: ${ROTULO[para]}${para === 'aguardando_material' ? ` — ${motivo.slice(0, 300)}` : ''}`, autor, criadoEm: agora }]
  await redis.set(`tarefa:${t.id}`, atualizado)
  return NextResponse.json({ ok: true })
}
