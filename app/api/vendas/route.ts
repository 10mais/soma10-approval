import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Venda, MovimentacaoEstoque, LancamentoFuturo, Produto } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { chaveEstoque, totalVenda } from '@/lib/estoque'
import { limparItensVenda, quantidadePorProduto, lancamentoDaVenda } from '@/lib/vendas'
import { resolverEscopoLoja, podeEscreverNaLoja } from '@/lib/escopoLoja'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// VENDAS (PDV do varejo, perfil telefonia). A baixa do estoque é o ponto de
// corrida: DECRBY atômico por produto (Upstash é single-thread por chave), e se
// QUALQUER item ficar negativo a venda é revertida inteira e recusada (409) — não
// existe venda parcial. Cada venda vira uma saída de estoque (auditoria) e uma
// entrada no Financeiro da loja (lancamentoDaVenda). Tudo escopado por loja.

function escopoDe(session: any) {
  return { role: (session.user as any).role as string, lojaId: (session.user as any).lojaId as string | undefined }
}

async function sessaoEquipe() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}

// GET: vendas da loja (operador só a sua; admin/gestor 'Todas' = todas; foca via ?lojaId=).
export async function GET(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const esc = resolverEscopoLoja(escopoDe(session), req.nextUrl.searchParams.get('lojaId'))
  if (esc.tipo === 'bloqueado') return NextResponse.json({ vendas: [] })
  const ids = await redis.smembers('vendas')
  let vendas = ids.length ? ((await redis.mget<(Venda | null)[]>(...ids.map(i => `venda:${i}`))).filter(Boolean) as Venda[]) : []
  if (esc.tipo === 'loja') vendas = vendas.filter(v => v.lojaId === esc.lojaId)
  vendas.sort((a, b) => new Date(b.data || b.criadoEm).getTime() - new Date(a.data || a.criadoEm).getTime())
  return NextResponse.json({ vendas })
}

export async function POST(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const b = await req.json()
  // Loja do escopo (operador na sua; admin/gestor precisam ter escolhido uma).
  const escr = podeEscreverNaLoja(escopoDe(session), b.lojaId)
  if ('erro' in escr) return NextResponse.json({ error: escr.erro }, { status: escr.status })
  const lojaId = escr.lojaId

  const limpo = limparItensVenda(b.itens)
  if ('erro' in limpo) return NextResponse.json({ error: limpo.erro }, { status: 400 })
  const itens = limpo.itens

  // Confere que os produtos existem (evita vender item apagado do catálogo).
  const pids = Object.keys(quantidadePorProduto(itens))
  const produtos = (await redis.mget<(Produto | null)[]>(...pids.map(p => `produto:${p}`)))
  if (produtos.some(p => !p)) return NextResponse.json({ error: 'Um dos produtos não existe mais no catálogo.' }, { status: 400 })

  // BAIXA ATÔMICA: DECRBY por produto; se algum estourar, reverte tudo e recusa.
  const qByProd = quantidadePorProduto(itens)
  const aplicadas: [string, number][] = []
  for (const [pid, q] of Object.entries(qByProd)) {
    const novo = await redis.incrby(chaveEstoque(lojaId, pid), -q)
    aplicadas.push([pid, q])
    if (novo < 0) {
      for (const [rpid, rq] of aplicadas) await redis.incrby(chaveEstoque(lojaId, rpid), rq)
      const nome = itens.find(i => i.produtoId === pid)?.nome || 'produto'
      return NextResponse.json({ error: `Estoque insuficiente de "${nome}" nesta loja.` }, { status: 409 })
    }
  }

  const agora = new Date().toISOString()
  const autor = session.user?.name || session.user?.email || undefined
  const desconto = Math.max(0, Number(b.desconto) || 0)
  const venda: Venda = {
    id: uuid(),
    lojaId,
    itens,
    ...(desconto > 0 ? { desconto } : {}),
    total: totalVenda(itens, desconto),
    formaPagamento: b.formaPagamento || 'dinheiro',
    ...(b.contatoId ? { contatoId: String(b.contatoId) } : {}),
    // Vendedor atribuído no PDV (nome escolhido no balcão); sem escolha = quem operou.
    vendedor: (b.vendedor && String(b.vendedor).trim().slice(0, 80)) || autor,
    data: agora,
    criadoPor: autor,
    criadoEm: agora,
  }
  await redis.set(`venda:${venda.id}`, venda)
  await redis.sadd('vendas', venda.id)

  // Saída de estoque por item (log de auditoria, vinculada à venda).
  for (const it of itens) {
    const mov: MovimentacaoEstoque = { id: uuid(), produtoId: it.produtoId, lojaId, tipo: 'saida', quantidade: it.quantidade, vendaId: venda.id, motivo: 'venda', criadoPor: autor, criadoEm: agora }
    await redis.set(`movestoque:${mov.id}`, mov)
    await redis.sadd('movestoque', mov.id)
  }

  // Entrada no Financeiro da loja (venda à vista = recebida).
  const lanc: LancamentoFuturo = { ...lancamentoDaVenda(venda, `Venda no PDV${venda.contatoId ? '' : ' (balcão)'}`), criadoPor: autor }
  await redis.set(`lancamento:${lanc.id}`, lanc)
  await redis.sadd('lancamentos', lanc.id)

  return NextResponse.json({ ok: true, venda })
}

// DELETE ?id= : CANCELA a venda (não apaga — auditoria). Estorna o estoque
// (INCRBY de volta na loja), remove a entrada do caixa e marca cancelada.
// Escopo: operador só cancela venda da SUA loja.
export async function DELETE(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'excluir', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  const venda = await redis.get<Venda>(`venda:${id}`)
  if (!venda) return NextResponse.json({ error: 'não encontrada' }, { status: 404 })
  const escr = podeEscreverNaLoja(escopoDe(session), venda.lojaId)
  if ('erro' in escr) return NextResponse.json({ error: escr.erro }, { status: escr.status })
  if (venda.cancelada) return NextResponse.json({ error: 'Venda já cancelada.' }, { status: 400 })

  const agora = new Date().toISOString()
  const autor = session.user?.name || session.user?.email || undefined
  // Estorno: devolve cada item ao estoque da loja + registra a entrada (auditoria).
  for (const [pid, q] of Object.entries(quantidadePorProduto(venda.itens))) {
    await redis.incrby(chaveEstoque(venda.lojaId, pid), q)
    const mov: MovimentacaoEstoque = { id: uuid(), produtoId: pid, lojaId: venda.lojaId, tipo: 'entrada', quantidade: q, vendaId: venda.id, motivo: 'estorno de venda cancelada', criadoPor: autor, criadoEm: agora }
    await redis.set(`movestoque:${mov.id}`, mov)
    await redis.sadd('movestoque', mov.id)
  }
  // Remove a entrada do caixa (o dinheiro não entrou).
  await redis.del(`lancamento:venda-${venda.id}`)
  await redis.srem('lancamentos', `venda-${venda.id}`)

  const cancelada: Venda = { ...venda, cancelada: true, canceladaEm: agora, canceladaPor: autor }
  await redis.set(`venda:${venda.id}`, cancelada)
  return NextResponse.json({ ok: true, venda: cancelada })
}
