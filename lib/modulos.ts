// Catálogo de módulos do portal do cliente (client-safe). Plano modular:
// NÚCLEO (grátis, todo cliente) + ADD-ONS (cada cliente contrata separado, com
// valor de assinatura). A verdade de "quem contratou" fica em Cliente.modulos.

export type ModuloKey = 'entregas' | 'aprovacoes' | 'solicitar' | 'analytics' | 'listening' | 'marca' | 'playbook'

export type Modulo = {
  key: ModuloKey
  label: string
  descricao: string
  gratuito: boolean
  valorPadrao: number // sugestão mensal em R$ (o admin ajusta por cliente)
  rota?: string       // subpath no portal (para o nav dos add-ons)
}

export const MODULOS: Modulo[] = [
  { key: 'entregas', label: 'Entregas', descricao: 'Acompanha o que já foi entregue.', gratuito: true, valorPadrao: 0 },
  { key: 'aprovacoes', label: 'Aprovações', descricao: 'Aprovar, corrigir e marcar ajustes.', gratuito: true, valorPadrao: 0 },
  { key: 'solicitar', label: 'Solicitar conteúdo', descricao: 'Pedir conteúdos novos (com anexo).', gratuito: true, valorPadrao: 0 },
  { key: 'analytics', label: 'Analytics', descricao: 'Métricas reais de Instagram/Facebook.', gratuito: false, valorPadrao: 149, rota: '/analytics' },
  { key: 'listening', label: 'Social Listening', descricao: 'O que está em alta no nicho do cliente.', gratuito: false, valorPadrao: 99, rota: '/listening' },
  { key: 'marca', label: 'Brand Board', descricao: 'Identidade, DNA e ativos da marca.', gratuito: false, valorPadrao: 79, rota: '/marca' },
  { key: 'playbook', label: 'Playbook', descricao: 'Marcos e estratégia do projeto.', gratuito: false, valorPadrao: 129, rota: '/playbook' },
]

export const MODULOS_PAGOS = MODULOS.filter(m => !m.gratuito)

// Estado por cliente (Cliente.modulos): ativo + valor mensal cobrado + desde quando.
export type ClienteModulos = Record<string, { ativo?: boolean; valor?: number; desde?: string }>

// Cliente tem acesso ao módulo? Gratuito = sempre; pago = só se ativo.
export function temModulo(modulos: ClienteModulos | undefined, key: string): boolean {
  const m = MODULOS.find(x => x.key === key)
  if (!m) return false
  if (m.gratuito) return true
  return !!modulos?.[key]?.ativo
}

// Valor mensal somado dos add-ons ativos (usa o valor do cliente ou o padrão).
export function totalMensalModulos(modulos: ClienteModulos | undefined): number {
  return MODULOS_PAGOS.reduce((s, m) => {
    const e = modulos?.[m.key]
    return s + (e?.ativo ? (typeof e.valor === 'number' ? e.valor : m.valorPadrao) : 0)
  }, 0)
}
