import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Produto, MovimentacaoEstoque, TipoMovEstoque } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { chaveEstoque, validarTransferencia } from '@/lib/estoque'
import { resolverEscopoLoja, podeEscreverNaLoja } from '@/lib/escopoLoja'
import { v4 as uuid } from 'uuid'

// Escopo do usuário da sessão (papel + loja vinda do TOKEN, nunca do request).
function escopoDe(session: any) {
  return { role: (session.user as any).role as string, lojaId: (session.user as any).lojaId as string | undefined }
}

export const runtime = 'nodejs'

// ESTOQUE por loja (perfil telefonia). O saldo VIVO é a chave numérica
// estoque:{loja}:{produto}, baixada com INCRBY atômico (Upstash é single-thread
// por chave — duas vendas simultâneas não vendem a mesma última unidade). As
// MovimentacaoEstoque são o log de auditoria.

async function sessaoEquipe() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}

async function produtoIds(): Promise<string[]> {
  return await redis.smembers('produtos')
}

// GET ?lojaId= : saldo de cada produto naquela loja. Admin/gestor sem lojaId:
// consolidado de TODAS. O ESCOPO manda: operador travado só lê a SUA loja — o
// ?lojaId= dele é ignorado (resolverEscopoLoja); sem loja atribuída = 403.
export async function GET(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const esc = resolverEscopoLoja(escopoDe(session), req.nextUrl.searchParams.get('lojaId'))
  if (esc.tipo === 'bloqueado') return NextResponse.json({ error: esc.motivo }, { status: 403 })
  const ids = await produtoIds()

  if (esc.tipo === 'loja') {
    if (!ids.length) return NextResponse.json({ lojaId: esc.lojaId, saldos: {} })
    const chaves = ids.map(pid => chaveEstoque(esc.lojaId, pid))
    const valores = await redis.mget<(number | null)[]>(...chaves)
    const saldos: Record<string, number> = {}
    ids.forEach((pid, i) => { saldos[pid] = Number(valores[i]) || 0 })
    return NextResponse.json({ lojaId: esc.lojaId, saldos })
  }

  // esc.tipo === 'todas' (admin/gestor) — consolidado; precisa das lojas para varrer as chaves.
  if (!ids.length) return NextResponse.json({ porLoja: {} })
  const lojas = (await redis.get<{ id: string }[]>('config:lojas')) || []
  const porLoja: Record<string, Record<string, number>> = {}
  for (const l of lojas) {
    const chaves = ids.map(pid => chaveEstoque(l.id, pid))
    const valores = ids.length ? await redis.mget<(number | null)[]>(...chaves) : []
    porLoja[l.id] = {}
    ids.forEach((pid, i) => { porLoja[l.id][pid] = Number(valores[i]) || 0 })
  }
  return NextResponse.json({ porLoja })
}

async function registrarMov(m: Omit<MovimentacaoEstoque, 'id' | 'criadoEm'>, autor?: string) {
  const mov: MovimentacaoEstoque = { id: uuid(), criadoEm: new Date().toISOString(), criadoPor: autor, ...m }
  await redis.set(`movestoque:${mov.id}`, mov)
  await redis.sadd('movestoque', mov.id)
  return mov
}

// POST: movimenta o estoque. tipo:
//   entrada     — soma na loja (compra/recebimento)
//   ajuste      — DEFINE o saldo (contagem física)
//   transferencia — tira da origem (lojaId) e põe no destino (lojaDestinoId)
export async function POST(req: NextRequest) {
  const session = await sessaoEquipe()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const autor = session.user?.name || session.user?.email || undefined
  const b = await req.json()
  const tipo = b.tipo as TipoMovEstoque
  const produtoId = String(b.produtoId || '').trim()
  if (!produtoId) return NextResponse.json({ error: 'produto obrigatório' }, { status: 400 })
  const produto = await redis.get<Produto>(`produto:${produtoId}`)
  if (!produto) return NextResponse.json({ error: 'produto não encontrado' }, { status: 404 })
  const qtd = Math.floor(Number(b.quantidade) || 0)

  if (tipo === 'entrada') {
    // Escopo: a loja vem do escopo do usuário, nunca crua do corpo (operador só na sua).
    const escr = podeEscreverNaLoja(escopoDe(session), b.lojaId)
    if ('erro' in escr) return NextResponse.json({ error: escr.erro }, { status: escr.status })
    const lojaId = escr.lojaId
    if (qtd <= 0) return NextResponse.json({ error: 'quantidade deve ser maior que zero' }, { status: 400 })
    const saldo = await redis.incrby(chaveEstoque(lojaId, produtoId), qtd)
    const mov = await registrarMov({ produtoId, lojaId, tipo: 'entrada', quantidade: qtd, motivo: b.motivo }, autor)
    return NextResponse.json({ ok: true, saldo, mov })
  }

  if (tipo === 'ajuste') {
    const escr = podeEscreverNaLoja(escopoDe(session), b.lojaId)
    if ('erro' in escr) return NextResponse.json({ error: escr.erro }, { status: escr.status })
    const lojaId = escr.lojaId
    // Contagem física: define o saldo absoluto. `quantidade` aqui é o saldo final.
    const alvo = Math.max(0, qtd)
    await redis.set(chaveEstoque(lojaId, produtoId), alvo)
    const mov = await registrarMov({ produtoId, lojaId, tipo: 'ajuste', quantidade: alvo, motivo: b.motivo || 'contagem física' }, autor)
    return NextResponse.json({ ok: true, saldo: alvo, mov })
  }

  if (tipo === 'transferencia') {
    // Transferir entre lojas exige ver a rede toda — operador travado não vê outras unidades.
    if (resolverEscopoLoja(escopoDe(session)).tipo !== 'todas') {
      return NextResponse.json({ error: 'Apenas a gestão da rede pode transferir entre lojas.' }, { status: 403 })
    }
    const lojaId = String(b.lojaId || '').trim()
    const lojaDestinoId = String(b.lojaDestinoId || '').trim()
    const saldoOrigem = Number(await redis.get<number>(chaveEstoque(lojaId, produtoId))) || 0
    const erro = validarTransferencia({ lojaOrigem: lojaId, lojaDestino: lojaDestinoId, quantidade: qtd, saldoOrigem })
    if (erro) return NextResponse.json({ error: erro }, { status: 400 })
    // Baixa atômica na origem; se ficou negativo (corrida), reverte e recusa.
    const novoOrigem = await redis.incrby(chaveEstoque(lojaId, produtoId), -qtd)
    if (novoOrigem < 0) {
      await redis.incrby(chaveEstoque(lojaId, produtoId), qtd)
      return NextResponse.json({ error: 'Estoque insuficiente na origem (mudou agora).' }, { status: 409 })
    }
    const novoDestino = await redis.incrby(chaveEstoque(lojaDestinoId, produtoId), qtd)
    await registrarMov({ produtoId, lojaId, lojaDestinoId, tipo: 'transferencia', quantidade: qtd, motivo: b.motivo }, autor)
    return NextResponse.json({ ok: true, saldoOrigem: novoOrigem, saldoDestino: novoDestino })
  }

  return NextResponse.json({ error: 'tipo de movimento inválido' }, { status: 400 })
}
