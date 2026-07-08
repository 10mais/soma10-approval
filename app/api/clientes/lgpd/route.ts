import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente } from '@/lib/redis'
import { exportarCliente, apagarDadosCliente } from '@/lib/lgpd'
import { registrarAuditoria } from '@/lib/auditoria'
import { capturarErro } from '@/lib/erros'

export const runtime = 'nodejs'
export const maxDuration = 300

// LGPD — SOMENTE ADMIN.
// GET ?id=  → exporta todos os dados do cliente (portabilidade) como JSON.
// POST { id, confirmar } → apaga TODOS os dados do cliente (direito ao esquecimento).
//   `confirmar` precisa ser o NOME EXATO do cliente (trava contra clique acidental).

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id') || ''
  const dados = await exportarCliente(id)
  if (!dados) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
  await registrarAuditoria({ ator: session.user?.name || session.user?.email || 'admin', acao: 'dados_exportados', alvo: dados._meta?.clienteNome || id, detalhe: `LGPD — portabilidade` })
  const nome = (dados._meta?.clienteNome || 'cliente').replace(/[^\w-]+/g, '_')
  return new NextResponse(JSON.stringify(dados, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="dados-${nome}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const { id, confirmar } = await req.json().catch(() => ({} as any))
  const cliente = await redis.get<Cliente>(`cliente:${id}`)
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
  // Dupla trava: precisa digitar o NOME EXATO do cliente.
  if (!confirmar || String(confirmar).trim().toLowerCase() !== (cliente.nome || '').trim().toLowerCase()) {
    return NextResponse.json({ error: 'Confirmação inválida — digite o nome exato do cliente.' }, { status: 400 })
  }
  try {
    const r = await apagarDadosCliente(id)
    if (!r.ok) return NextResponse.json({ error: r.erro || 'falha ao apagar' }, { status: 500 })
    await registrarAuditoria({ ator: session.user?.name || session.user?.email || 'admin', acao: 'dados_apagados', alvo: cliente.nome, detalhe: `LGPD — esquecimento. Contagens: ${JSON.stringify(r.contagens)}` })
    return NextResponse.json({ ok: true, ...r })
  } catch (e: any) {
    await capturarErro('clientes/lgpd', e, { clienteId: id })
    return NextResponse.json({ error: e?.message || 'falha ao apagar' }, { status: 500 })
  }
}
