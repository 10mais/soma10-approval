import { redis, Cliente } from './redis'
import { temModulo } from './modulos'

// true = BLOQUEIA por falta do módulo. Só afeta role 'cliente' (equipe passa).
// Núcleo (entregas/aprovacoes/solicitar) é sempre liberado; add-ons dependem
// do Cliente.modulos[key].ativo.
export async function bloqueiaModuloCliente(role: string, clienteId: string | undefined, key: string): Promise<boolean> {
  if (role !== 'cliente') return false
  const cliente = clienteId ? await redis.get<Cliente>(`cliente:${clienteId}`) : null
  return !temModulo(cliente?.modulos, key)
}
