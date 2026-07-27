import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Produto, MovimentacaoEstoque } from '@/lib/redis'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { chaveEstoque } from '@/lib/estoque'
import { podeEscreverNaLoja } from '@/lib/escopoLoja'
import { LinhaImportProduto, chaveMatchProduto, CATEGORIAS_IMPORT } from '@/lib/produtosImport'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// IMPORTAÇÃO EM MASSA de produtos (perfil telefonia). Catálogo é COMPARTILHADO:
// casa por SKU (ou nome) — existe = atualiza os campos; não existe = cria. O
// estoque é POR LOJA: a `quantidade` de cada linha entra como ENTRADA na loja
// escolhida (movimentação auditável). A loja vem do escopo (operador só a dele).

function escopoDe(session: any) {
  return { role: (session.user as any).role as string, lojaId: (session.user as any).lojaId as string | undefined }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const b = await req.json()
  const escr = podeEscreverNaLoja(escopoDe(session), b.lojaId)
  if ('erro' in escr) return NextResponse.json({ error: escr.erro }, { status: escr.status })
  const lojaId = escr.lojaId

  const linhas: LinhaImportProduto[] = Array.isArray(b.linhas) ? b.linhas : []
  if (!linhas.length) return NextResponse.json({ error: 'Nada para importar.' }, { status: 400 })
  if (linhas.length > 2000) return NextResponse.json({ error: 'Importe no máximo 2000 produtos por vez.' }, { status: 400 })

  // Índice do catálogo atual (uma leitura) para casar por SKU/nome.
  const ids = await redis.smembers('produtos')
  const atuais = ids.length ? ((await redis.mget<(Produto | null)[]>(...ids.map(i => `produto:${i}`))).filter(Boolean) as Produto[]) : []
  const porChave = new Map<string, Produto>()
  for (const p of atuais) porChave.set(chaveMatchProduto(p), p)

  const autor = session.user?.name || session.user?.email || undefined
  const agora = new Date().toISOString()
  let criados = 0, atualizados = 0, unidades = 0

  for (const linha of linhas) {
    const nome = String(linha?.nome || '').trim()
    const preco = Number(linha?.precoVenda)
    if (!nome || !isFinite(preco) || preco < 0) continue
    const categoria = (CATEGORIAS_IMPORT.includes(linha?.categoria as any) ? linha.categoria : 'outro') as Produto['categoria']
    const campos = {
      nome,
      sku: (linha?.sku || '').trim() || undefined,
      categoria,
      precoVenda: Math.round(preco * 100) / 100,
      ...(Number.isFinite(Number(linha?.precoCusto)) ? { precoCusto: Math.max(0, Number(linha.precoCusto)) } : {}),
      ...(Number.isFinite(Number(linha?.estoqueMinimo)) ? { estoqueMinimo: Math.max(0, Math.floor(Number(linha.estoqueMinimo))) } : {}),
      ativo: true,
    }
    const existente = porChave.get(chaveMatchProduto({ sku: campos.sku, nome }))
    let produto: Produto
    if (existente) {
      produto = { ...existente, ...campos, atualizadoEm: agora }
      atualizados++
    } else {
      produto = { id: uuid(), ...campos, criadoPor: autor, criadoEm: agora, atualizadoEm: agora }
      await redis.sadd('produtos', produto.id)
      criados++
    }
    await redis.set(`produto:${produto.id}`, produto)
    porChave.set(chaveMatchProduto(produto), produto)

    // Entrada de estoque na loja (auditável), se veio quantidade.
    const qtd = Math.max(0, Math.floor(Number(linha?.quantidade) || 0))
    if (qtd > 0) {
      await redis.incrby(chaveEstoque(lojaId, produto.id), qtd)
      const mov: MovimentacaoEstoque = { id: uuid(), produtoId: produto.id, lojaId, tipo: 'entrada', quantidade: qtd, motivo: 'importação em massa', criadoPor: autor, criadoEm: agora }
      await redis.set(`movestoque:${mov.id}`, mov)
      await redis.sadd('movestoque', mov.id)
      unidades += qtd
    }
  }

  return NextResponse.json({ ok: true, criados, atualizados, unidades, lojaId })
}
