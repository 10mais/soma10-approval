import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente, CrmNegocio, Post, NpsResposta } from '@/lib/redis'
import { totalMensalModulos } from '@/lib/modulos'

export const runtime = 'nodejs'

const dias = (iso?: string) => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null
const ateData = (iso?: string) => iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000) : null

export async function GET() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || !['admin', 'gerente', 'vendas'].includes(role)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const [nIds, cIds, pIds] = await Promise.all([redis.smembers('crm:negocios'), redis.smembers('clientes'), redis.smembers('posts')])
  const [negocios, clientes, posts] = await Promise.all([
    nIds.length ? redis.mget<(CrmNegocio | null)[]>(...nIds.map(i => `negocio:${i}`)).then(a => a.filter(Boolean) as CrmNegocio[]) : Promise.resolve([]),
    cIds.length ? redis.mget<(Cliente | null)[]>(...cIds.map(i => `cliente:${i}`)).then(a => a.filter(Boolean) as Cliente[]) : Promise.resolve([]),
    pIds.length ? redis.mget<(Post | null)[]>(...pIds.map(i => `post:${i}`)).then(a => a.filter(Boolean) as Post[]) : Promise.resolve([]),
  ])

  // ---- CONVERSÃO (CRM) ----
  const ganhos = negocios.filter(n => n.status === 'ganho')
  const abertos = negocios.filter(n => n.status !== 'ganho' && n.status !== 'perdido')
  const soma = (arr: CrmNegocio[]) => arr.reduce((s, n) => s + (Number(n.valor) || 0), 0)
  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0)
  const ganhosMes = ganhos.filter(n => new Date(n.atualizadoEm || n.criadoEm) >= inicioMes)

  const porVendedorMap: Record<string, { nome: string; abertoValor: number; ganhoValor: number; ganhoQtd: number }> = {}
  for (const n of negocios) {
    const nome = n.donoNome || 'Sem responsável'
    const v = porVendedorMap[nome] || (porVendedorMap[nome] = { nome, abertoValor: 0, ganhoValor: 0, ganhoQtd: 0 })
    if (n.status === 'ganho') { v.ganhoValor += Number(n.valor) || 0; v.ganhoQtd++ }
    else if (n.status !== 'perdido') v.abertoValor += Number(n.valor) || 0
  }

  const valorOportunidades = soma(negocios)
  const valorConvertido = soma(ganhos)
  const conversao = {
    emAbertoQtd: abertos.length,
    emAbertoValor: soma(abertos),
    ganhosMesQtd: ganhosMes.length,
    ganhosMesValor: soma(ganhosMes),
    winRate: negocios.length ? Math.round((ganhos.length / negocios.length) * 100) : 0,
    valorOportunidades,
    valorConvertido,
    conversaoValor: valorOportunidades ? Math.round((valorConvertido / valorOportunidades) * 100) : 0,
    ticketMedio: ganhos.length ? Math.round(soma(ganhos) / ganhos.length) : 0,
    porVendedor: Object.values(porVendedorMap).sort((a, b) => (b.ganhoValor + b.abertoValor) - (a.ganhoValor + a.abertoValor)),
  }

  // ---- RETENÇÃO (clientes) ----
  const ativos = clientes.filter(c => c.tipo !== 'interno' && !(c as any).arquivado)
  // Mensalidade recorrente por cliente = contrato + assinaturas de módulos ativas.
  const mensal = (c: Cliente) => (Number(c.contratoValor) || 0) + totalMensalModulos((c as any).modulos)
  const mrr = ativos.reduce((s, c) => s + mensal(c), 0)
  const ltvs = ativos.map(c => {
    const d = dias(c.contratoInicio)
    const meses = Math.max(1, d ? Math.floor(d / 30) + 1 : 1)
    return mensal(c) * meses
  })
  const ltvMedio = ativos.length ? Math.round(ltvs.reduce((s, v) => s + v, 0) / ativos.length) : 0

  // Última atividade por cliente (post agendado/atualizado) para o sinal de churn
  const ultimaAtividade: Record<string, number> = {}
  for (const p of posts) {
    if (!p.clienteId) continue
    const t = new Date(p.dataAgendada || p.atualizadoEm || p.criadoEm || 0).getTime()
    if (!ultimaAtividade[p.clienteId] || t > ultimaAtividade[p.clienteId]) ultimaAtividade[p.clienteId] = t
  }

  // Renovações nos próximos 45 dias
  const renovacoes = ativos
    .map(c => ({ id: c.id, nome: c.nome, valor: mensal(c), data: c.contratoRenovacao, faltam: ateData(c.contratoRenovacao) }))
    .filter(c => c.faltam !== null && c.faltam >= 0 && c.faltam <= 45)
    .sort((a, b) => (a.faltam || 0) - (b.faltam || 0))

  // Risco de churn por inatividade (>= 21 dias sem post agendado/publicado)
  const churn = ativos
    .map(c => {
      const t = ultimaAtividade[c.id]
      const diasInativo = t ? Math.floor((Date.now() - t) / 86400000) : (dias(c.contratoInicio) ?? 999)
      return { id: c.id, nome: c.nome, diasInativo, semAtividade: !t }
    })
    .filter(c => c.diasInativo >= 21)
    .sort((a, b) => b.diasInativo - a.diasInativo)

  const retencao = { clientesAtivos: ativos.length, mrr, ltvMedio, renovacoes, churn }

  // ---- NPS ----
  const npsIds = await redis.smembers('nps')
  const respostas = npsIds.length ? (await redis.mget<(NpsResposta | null)[]>(...npsIds.map(i => `nps:${i}`))).filter(Boolean) as NpsResposta[] : []
  const promotores = respostas.filter(r => r.score >= 9).length
  const detratores = respostas.filter(r => r.score <= 6).length
  const npsScore = respostas.length ? Math.round(((promotores - detratores) / respostas.length) * 100) : null
  const npsPorCliente: Record<string, number> = {}
  for (const r of [...respostas].sort((a, b) => (a.criadoEm || '').localeCompare(b.criadoEm || ''))) npsPorCliente[r.clienteId] = r.score
  const nps = {
    score: npsScore, total: respostas.length, promotores, detratores,
    ultimos: [...respostas].sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || '')).slice(0, 8)
      .map(r => ({ clienteId: r.clienteId, nome: clientes.find(c => c.id === r.clienteId)?.nome || '', score: r.score, comentario: r.comentario || '', criadoEm: r.criadoEm })),
  }

  // ---- SAÚDE por cliente ----
  const peso: Record<string, number> = { risco: 0, atencao: 1, saudavel: 2 }
  const saude = ativos.map(c => {
    const t = ultimaAtividade[c.id]
    const diasInativo = t ? Math.floor((Date.now() - t) / 86400000) : (dias(c.contratoInicio) ?? 999)
    const faltamRenov = ateData(c.contratoRenovacao)
    const npsU = c.id in npsPorCliente ? npsPorCliente[c.id] : null
    const motivos: string[] = []
    let status: 'saudavel' | 'atencao' | 'risco' = 'saudavel'
    if (diasInativo >= 30) { status = 'risco'; motivos.push(`${diasInativo}d sem conteúdo`) }
    else if (diasInativo >= 21) { status = 'atencao'; motivos.push(`${diasInativo}d sem conteúdo`) }
    if (npsU !== null && npsU <= 6) { status = 'risco'; motivos.push(`NPS baixo (${npsU})`) }
    else if (npsU !== null && npsU <= 8 && status !== 'risco') { status = 'atencao'; motivos.push(`NPS ${npsU}`) }
    if (faltamRenov !== null && faltamRenov >= 0 && faltamRenov <= 30 && status === 'saudavel') { status = 'atencao'; motivos.push(`renova em ${faltamRenov}d`) }
    return { id: c.id, nome: c.nome, status, diasInativo, faltamRenov, nps: npsU, motivos }
  }).sort((a, b) => peso[a.status] - peso[b.status])

  return NextResponse.json({ conversao, retencao, saude, nps })
}
