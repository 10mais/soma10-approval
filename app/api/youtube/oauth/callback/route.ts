import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente } from '@/lib/redis'
import { trocarCodigoYouTube, canalDoToken } from '@/lib/youtube'
import { ID_CONTA_PRINCIPAL, type ContaSocial } from '@/lib/contasSociais'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'

// Volta da tela de consentimento do Google: troca o código pelos tokens, descobre QUAL canal
// foi autorizado e guarda no cliente. O que dura é o `refresh_token`; o token de acesso vale
// uma hora e é pedido de novo na hora de subir o vídeo (lib/youtube).
export async function GET(req: NextRequest) {
  const base = (process.env.APPROVAL_BASE_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '')
  const volta = (erro?: string, nome?: string) =>
    NextResponse.redirect(`${base}/dashboard?${erro ? `youtube_erro=${encodeURIComponent(erro)}` : `youtube_ok=${encodeURIComponent(nome || '1')}`}#clientes`)

  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return volta('sem_permissao')

  const p = req.nextUrl.searchParams
  if (p.get('error')) return volta(p.get('error') === 'access_denied' ? 'cancelado' : String(p.get('error')))
  const code = p.get('code')
  const estadoBruto = p.get('state') || ''
  if (!code || !estadoBruto) return volta('sem_codigo')

  let estado: { cliente?: string; nova?: string; conta?: string }
  try { estado = JSON.parse(Buffer.from(estadoBruto, 'base64url').toString('utf8')) } catch { return volta('estado_invalido') }
  const clienteId = String(estado.cliente || '')
  if (!clienteId) return volta('sem_cliente')

  try {
    const tokens = await trocarCodigoYouTube(code)
    // Sem refresh_token não há conexão que sobreviva a uma hora. Acontece quando o Google
    // já tinha consentimento e não repetiu o token — por isso a ida pede `prompt=consent`.
    if (!tokens.refreshToken) return volta('sem_refresh')

    const canal = await canalDoToken(tokens.accessToken)
    if (!canal) return volta('sem_canal')

    const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
    if (!cliente) return volta('cliente_nao_encontrado')

    const agora = new Date().toISOString()
    const dadosYt = {
      youtubeRefreshToken: tokens.refreshToken,
      youtubeChannelId: canal.id,
      youtubeChannelTitle: canal.titulo,
      youtubeConectado: true,
      youtubeTokenAtualizadoEm: agora,
    }

    const contas: ContaSocial[] = Array.isArray((cliente as any).contas) ? [...(cliente as any).contas] : []
    const mesmoCanal = (c: ContaSocial) => c.youtubeChannelId === canal.id

    if (estado.conta && estado.conta !== ID_CONTA_PRINCIPAL) {
      // Reconexão de um perfil que já existe.
      const i = contas.findIndex(c => c.id === estado.conta)
      if (i < 0) return volta('perfil_nao_encontrado')
      contas[i] = { ...contas[i], ...dadosYt }
      await redis.set(`cliente:${clienteId}`, { ...cliente, contas, atualizadoEm: agora })
    } else if (estado.nova === '1') {
      // Perfil ADICIONAL. Canal repetido não vira perfil novo: seria o mesmo canal
      // publicando duas vezes o mesmo vídeo.
      const existente = contas.find(mesmoCanal)
      if (existente) Object.assign(existente, dadosYt)
      else contas.push({ id: uuid(), nome: canal.titulo, criadoEm: agora, ...dadosYt })
      await redis.set(`cliente:${clienteId}`, { ...cliente, contas, atualizadoEm: agora })
    } else {
      // Conta principal (campos do próprio cliente).
      await redis.set(`cliente:${clienteId}`, { ...cliente, ...dadosYt, atualizadoEm: agora })
    }

    return volta(undefined, canal.titulo)
  } catch (e: any) {
    console.error('[youtube/callback]', e?.message || e)
    return volta(e?.message ? String(e.message).slice(0, 120) : 'erro_interno')
  }
}
