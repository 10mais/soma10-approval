import { NextRequest, NextResponse } from 'next/server'
import { redis, Post, Cliente } from '@/lib/redis'
import { notificar, notificarEquipe, notificarAdmins } from '@/lib/notificacoes'
import { cronAutorizado } from '@/lib/cronAuth'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })

  const agora = Date.now()
  const UM_DIA = 24 * 60 * 60 * 1000
  let aprovacoes = 0
  let renovacoes = 0

  // ---- 1) SLA de aprovacao (24h) ----
  const postIds = await redis.smembers('posts')
  const posts = postIds.length > 0 ? ((await redis.mget<(Post | null)[]>(...postIds.map(id => `post:${id}`))).filter(Boolean) as Post[]) : []
  const emAprovacao = posts.filter(p => (p.etapa === 'aprovacao_copy' || p.etapa === 'aprovacao_criativo') && p.aguardandoDesde)

  // cache de clientes para achar o loginEmail
  const clienteCache = new Map<string, Cliente | null>()
  async function getCliente(id?: string): Promise<Cliente | null> {
    if (!id) return null
    if (clienteCache.has(id)) return clienteCache.get(id)!
    const c = await redis.get<Cliente>(`cliente:${id}`)
    clienteCache.set(id, c)
    return c
  }

  for (const p of emAprovacao) {
    const espera = agora - new Date(p.aguardandoDesde!).getTime()
    if (espera < UM_DIA) continue
    const chave = `aprov_atraso:${p.id}`
    if (await redis.get(chave)) continue

    const dias = Math.floor(espera / UM_DIA)
    const oQue = p.etapa === 'aprovacao_copy' ? 'a copy' : 'o criativo'
    const titulo = 'Aprovacao pendente'
    const msgEquipe = `${p.clienteNome}: ${oQue} aguarda aprovacao do cliente ha ${dias} dia(s).`

    // Notifica o cliente (se tiver login) e a equipe
    const cliente = await getCliente(p.clienteId)
    if (cliente?.loginEmail) {
      await notificar(cliente.loginEmail, 'aprovacao_atrasada', 'Conteudo aguardando sua aprovacao', `Voce tem ${oQue} de um post aguardando aprovacao ha ${dias} dia(s). Acesse o portal para revisar.`, p.id)
    }
    await notificarEquipe('aprovacao_atrasada', titulo, msgEquipe, p.id)

    await redis.set(chave, '1')
    await redis.expire(chave, 86400) // re-cobra 1x/dia enquanto parado
    aprovacoes++
  }

  // ---- 2) Renovacao de contrato (30 dias) ----
  const cliIds = await redis.smembers('clientes')
  const clientes = cliIds.length > 0 ? ((await redis.mget<(Cliente | null)[]>(...cliIds.map(id => `cliente:${id}`))).filter(Boolean) as Cliente[]) : []
  const TRINTA_DIAS = 30 * UM_DIA

  for (const c of clientes) {
    if (!c.contratoRenovacao) continue
    const faltam = new Date(c.contratoRenovacao).getTime() - agora
    if (faltam < 0 || faltam > TRINTA_DIAS) continue // vencido ou ainda longe
    const chave = `renov_alerta:${c.id}`
    if (await redis.get(chave)) continue

    const dias = Math.ceil(faltam / UM_DIA)
    const valor = c.contratoValor ? ` (R$ ${c.contratoValor.toLocaleString('pt-BR')})` : ''
    await notificarAdmins('contrato_renovacao', 'Renovacao de contrato proxima', `O contrato de ${c.nome}${valor} renova em ${dias} dia(s).`)

    await redis.set(chave, '1')
    await redis.expire(chave, 7 * 86400) // ~4 lembretes no ultimo mes
    renovacoes++
  }

  return NextResponse.json({ ok: true, aprovacoes, renovacoes, postsVerificados: emAprovacao.length, clientesVerificados: clientes.length })
}
