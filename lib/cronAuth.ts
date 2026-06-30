// Autoriza chamadas de cron. Aceita o CRON_SECRET tanto via ?secret= (cron-job.org)
// quanto via header Authorization: Bearer <CRON_SECRET> (Vercel Cron nativo).
export function cronAutorizado(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // sem secret configurado, não bloqueia
  try {
    const url = new URL(req.url)
    if (url.searchParams.get('secret') === secret) return true
  } catch {}
  if (req.headers.get('authorization') === `Bearer ${secret}`) return true
  return false
}
