// FASE DO CLIENTE — o ciclo de vida dentro da operação.
//
// Pedido do dono (07/09/2026): "um momento exclusivo para o ONBOARDING. Todo
// cliente que chega passa obrigatoriamente por lá. Depois passa para EM
// PRODUÇÃO." A fase vive no próprio Cliente (`fase`), gravada pelo servidor:
// nasce em `onboarding` (POST /api/clientes e conversão do CRM) e só muda pela
// rota de transição (/api/clientes/fase), que exige o checklist completo — ou
// um admin forçando, com registro em auditoria.
//
// Cliente antigo sem o campo é tratado como `producao`: a carteira que já
// existe não volta para o onboarding por causa de um campo novo.
//
// O CHECKLIST vem de lib/onboardingConfig (fases > etapas, editável em
// Configurações). Etapa manual = a equipe marca (fica em `onboardingChecklist`
// por id); etapa automática = detectada pelos dados do cliente.

import { configPadrao, etapasDaConfig, type ConfigOnboarding, type Detector, type EtapaOnb } from './onboardingConfig'

export type FaseCliente = 'onboarding' | 'producao'

export const FASE_ROTULO: Record<FaseCliente, string> = { onboarding: 'Onboarding', producao: 'Em produção' }

export function faseDoCliente(c: { fase?: string } | null | undefined): FaseCliente {
  return c?.fase === 'onboarding' ? 'onboarding' : 'producao'
}

export type ItemOnboarding = { chave: string; label: string; dica?: string; ok: boolean; manual: boolean; auto?: Detector; faseId: string; faseNome: string }

// Compatibilidade: as etapas manuais do padrão (quem só precisa das chaves).
export const ITENS_MANUAIS: { chave: string; label: string; dica?: string }[] =
  etapasDaConfig(configPadrao()).filter(e => !e.auto).map(e => ({ chave: e.id, label: e.nome, dica: e.dica }))

export type EntradaChecklist = {
  cliente: { segmento?: string; descricao?: string; palavrasChave?: unknown; metaConectado?: boolean; instagramConectado?: boolean; entregaveis?: unknown[]; postsMensais?: number; onboardingChecklist?: Record<string, boolean> | null } | null | undefined
  marcos: number
  publicados: number
}

function detectar(auto: Detector, e: EntradaChecklist): boolean {
  const c = e.cliente
  switch (auto) {
    case 'escopo': return !!((c?.entregaveis && c.entregaveis.length > 0) || (c?.postsMensais && c.postsMensais > 0))
    case 'marca': return !!(c?.segmento || c?.descricao || c?.palavrasChave)
    case 'redes': return !!(c?.metaConectado || c?.instagramConectado)
    case 'playbook': return e.marcos > 0
    case 'primeiro': return e.publicados > 0
  }
}

export function checklistOnboarding(e: EntradaChecklist, cfg: ConfigOnboarding = configPadrao()): ItemOnboarding[] {
  const marcados = e.cliente?.onboardingChecklist || {}
  const itens: ItemOnboarding[] = []
  for (const f of cfg.fases) {
    for (const et of f.etapas) {
      itens.push({
        chave: et.id, label: et.nome, dica: et.dica, faseId: f.id, faseNome: f.nome,
        manual: !et.auto, auto: et.auto,
        ok: et.auto ? detectar(et.auto, e) : !!marcados[et.id],
      })
    }
  }
  return itens
}

export type FaseChecklist = { id: string; nome: string; itens: ItemOnboarding[]; feitos: number; total: number }
export function agruparPorFase(itens: ItemOnboarding[], cfg: ConfigOnboarding = configPadrao()): FaseChecklist[] {
  return cfg.fases.map(f => {
    const meus = itens.filter(i => i.faseId === f.id)
    return { id: f.id, nome: f.nome, itens: meus, feitos: meus.filter(i => i.ok).length, total: meus.length }
  }).filter(f => f.total > 0)
}

export function pendentesOnboarding(itens: ItemOnboarding[]): ItemOnboarding[] {
  return itens.filter(i => !i.ok)
}

export function podeConcluirOnboarding(itens: ItemOnboarding[]): boolean {
  return pendentesOnboarding(itens).length === 0
}

// Regras de transição, avaliadas no servidor.
export type PedidoTransicao = { de: FaseCliente; para: FaseCliente; itens: ItemOnboarding[]; ehAdmin: boolean; forcar?: boolean }
export type ResultadoTransicao = { ok: true } | { ok: false; motivo: string; pendentes?: string[] }

export function avaliarTransicao(p: PedidoTransicao): ResultadoTransicao {
  if (p.de === p.para) return { ok: false, motivo: `O cliente já está em "${FASE_ROTULO[p.para]}".` }
  if (p.para === 'producao') {
    const pend = pendentesOnboarding(p.itens)
    if (pend.length === 0) return { ok: true }
    if (p.ehAdmin && p.forcar) return { ok: true }
    return { ok: false, motivo: `Faltam ${pend.length} ${pend.length === 1 ? 'item' : 'itens'} do onboarding.`, pendentes: pend.map(i => i.label) }
  }
  // producao -> onboarding (reabrir): só admin.
  if (!p.ehAdmin) return { ok: false, motivo: 'Só um administrador pode reabrir o onboarding.' }
  return { ok: true }
}

// Só ids de etapas MANUAIS da config entram no checklist gravado (nada vindo
// do cliente vira campo solto; etapa automática não se marca à mão).
export function limparChecklist(bruto: unknown, cfg: ConfigOnboarding = configPadrao()): Record<string, boolean> {
  const saida: Record<string, boolean> = {}
  if (bruto && typeof bruto === 'object') {
    const manuais: EtapaOnb[] = etapasDaConfig(cfg).filter(e => !e.auto)
    for (const m of manuais) {
      const v = (bruto as Record<string, unknown>)[m.id]
      if (v === true) saida[m.id] = true
    }
  }
  return saida
}
