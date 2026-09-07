import { redis } from './redis'
import { normalizarConfig, type ConfigOnboarding } from './onboardingConfig'

// Leitura da config do onboarding no Redis (servidor). Separado do lib puro
// (que não toca banco e é testável) e da rota (que só pode exportar handlers).
export const CHAVE_ONBOARDING = 'config:onboarding'

export async function lerConfigOnboarding(): Promise<ConfigOnboarding> {
  return normalizarConfig(await redis.get(CHAVE_ONBOARDING).catch(() => null))
}
