import { redis } from './redis'
import { PermGranularPapel, PermGranular, AcaoPerm, podeAcaoGranular } from './permissoesGranular'

export async function getPermGranularPapel(): Promise<PermGranularPapel> {
  return (await redis.get<PermGranularPapel>('config:permissoesGranular')) || {}
}

// true = BLOQUEIA a ação. Só afeta gerente/usuario; admin/vendas/cliente passam direto.
export async function bloqueiaAcao(role: string, acao: AcaoPerm, permUser?: PermGranular): Promise<boolean> {
  if (role !== 'gerente' && role !== 'usuario') return false
  const cfg = await getPermGranularPapel().catch(() => ({} as PermGranularPapel))
  return !podeAcaoGranular(role, acao, permUser, cfg)
}
