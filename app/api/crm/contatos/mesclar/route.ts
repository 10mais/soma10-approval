import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, CrmContato, CrmNegocio, Agendamento, EsperaItem } from '@/lib/redis'
import { WaConversa } from '@/lib/whatsapp'
import { IgConversa } from '@/lib/instagramDM'
import { bloqueiaPapel } from '@/lib/permissoesPapel'

export const runtime = 'nodejs'

// Mesclar dois contatos duplicados num só. O "principal" é mantido; o "secundário"
// tem os dados usados para preencher lacunas do principal e é removido. Todas as
// referências (negócios, agendamentos, conversas de WhatsApp) são reapontadas
// para o principal — não pode sobrar órfão apontando para o contato apagado.

async function autorizado() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return null
  return session
}

// Une dois contatos: principal manda; secundário preenche o que falta.
function fundir(p: CrmContato, s: CrmContato): CrmContato {
  const gap = (a?: string, b?: string) => (String(a || '').trim() ? a : b)
  const historico = [...(p.historico || []), ...(s.historico || [])]
    .sort((x, y) => new Date(x.data).getTime() - new Date(y.data).getTime())
  const etiquetas = Array.from(new Set([...(p.etiquetas || []), ...(s.etiquetas || [])]))
  const ultimoContato = [p.ultimoContato, s.ultimoContato].filter(Boolean).sort().pop()
  const obs = [p.observacoes, s.observacoes].map(o => (o || '').trim()).filter(Boolean)
  return {
    ...p,
    email: gap(p.email, s.email),
    telefone: gap(p.telefone, s.telefone),
    empresa: gap(p.empresa, s.empresa),
    empresaId: gap(p.empresaId, s.empresaId),
    areaAtuacao: gap(p.areaAtuacao, s.areaAtuacao),
    cargo: gap(p.cargo, s.cargo),
    nascimento: gap(p.nascimento, s.nascimento),
    // paciente > lead/outros; ativo se qualquer um estiver ativo
    tipo: p.tipo === 'paciente' || s.tipo === 'paciente' ? 'paciente' : (p.tipo || s.tipo),
    ativo: (p.ativo !== false) || (s.ativo !== false) ? undefined : false,
    etiquetas: etiquetas.length ? etiquetas : undefined,
    observacoes: obs.length ? obs.join('\n---\n') : undefined,
    historico: historico.length ? historico : undefined,
    ultimoContato,
    atualizadoEm: new Date().toISOString(),
  }
}

export async function POST(req: NextRequest) {
  const session = await autorizado()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'excluir', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissão' }, { status: 403 })
  }
  const { principalId, secundarioId } = await req.json()
  if (!principalId || !secundarioId || principalId === secundarioId) {
    return NextResponse.json({ error: 'selecione dois contatos diferentes' }, { status: 400 })
  }
  const [principal, secundario] = await Promise.all([
    redis.get<CrmContato>(`contato:${principalId}`),
    redis.get<CrmContato>(`contato:${secundarioId}`),
  ])
  if (!principal || !secundario) return NextResponse.json({ error: 'contato não encontrado' }, { status: 404 })

  // 1) Reaponta negócios do secundário -> principal
  const negIds = await redis.smembers('crm:negocios')
  const negocios = negIds.length ? ((await redis.mget<(CrmNegocio | null)[]>(...negIds.map(i => `negocio:${i}`))).filter(Boolean) as CrmNegocio[]) : []
  await Promise.all(negocios.filter(n => n.contatoId === secundarioId).map(n => redis.set(`negocio:${n.id}`, { ...n, contatoId: principalId })))

  // 2) Reaponta agendamentos do secundário -> principal
  const agIds = await redis.smembers('agendamentos')
  const ags = agIds.length ? ((await redis.mget<(Agendamento | null)[]>(...agIds.map(i => `agendamento:${i}`))).filter(Boolean) as Agendamento[]) : []
  await Promise.all(ags.filter(a => a.contatoId === secundarioId).map(a => redis.set(`agendamento:${a.id}`, { ...a, contatoId: principalId })))

  // 3) Reaponta conversas de WhatsApp vinculadas ao secundário -> principal
  const tels = await redis.smembers('wa:conversas')
  const convs = tels.length ? ((await Promise.all(tels.map(t => redis.get<WaConversa>(`wa:conversa:${t}`)))).filter(Boolean) as WaConversa[]) : []
  await Promise.all(convs.filter(c => c.contatoId === secundarioId).map(c => redis.set(`wa:conversa:${c.telefone}`, { ...c, contatoId: principalId })))

  // 4) Reaponta itens da lista de espera da agenda -> principal
  const espIds = await redis.smembers('esperas')
  const esperas = espIds.length ? ((await redis.mget<(EsperaItem | null)[]>(...espIds.map(i => `espera:${i}`))).filter(Boolean) as EsperaItem[]) : []
  await Promise.all(esperas.filter(e => e.contatoId === secundarioId).map(e => redis.set(`espera:${e.id}`, { ...e, contatoId: principalId })))

  // 5) Reaponta conversas de Instagram Direct -> principal
  const igIds = await redis.smembers('ig:conversas')
  const igConvs = igIds.length ? ((await Promise.all(igIds.map(i => redis.get<IgConversa>(`ig:conversa:${i}`)))).filter(Boolean) as IgConversa[]) : []
  await Promise.all(igConvs.filter(c => c.contatoId === secundarioId).map(c => redis.set(`ig:conversa:${c.id}`, { ...c, contatoId: principalId })))

  // 6) Grava o principal fundido e remove o secundário
  await redis.set(`contato:${principalId}`, fundir(principal, secundario))
  await redis.del(`contato:${secundarioId}`)
  await redis.srem('crm:contatos', secundarioId)

  return NextResponse.json({ ok: true })
}
