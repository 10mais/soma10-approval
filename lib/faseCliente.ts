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

export type FaseCliente = 'onboarding' | 'producao'

export const FASE_ROTULO: Record<FaseCliente, string> = { onboarding: 'Onboarding', producao: 'Em produção' }

export function faseDoCliente(c: { fase?: string } | null | undefined): FaseCliente {
  return c?.fase === 'onboarding' ? 'onboarding' : 'producao'
}

// Itens do checklist. Os AUTOMÁTICOS são detectados pelos dados (nada a marcar);
// os MANUAIS a equipe marca na tela (ficam em `onboardingChecklist`). A lista
// segue o onboarding da 10+ no ClickUp (formalização, acessos, ativos, DNA da
// marca, go live) — ver lib/modelosSugeridos.
export type ItemOnboarding = { chave: string; label: string; dica?: string; ok: boolean; manual: boolean }

export const ITENS_MANUAIS: { chave: string; label: string; dica?: string }[] = [
  { chave: 'contrato', label: 'Contrato formalizado e assinado', dica: 'Financeiro / jurídico' },
  { chave: 'acessos', label: 'Acessos recebidos (Meta, site, ferramentas)', dica: 'Solicitar ao cliente' },
  { chave: 'passagem', label: 'Passagem de bastão lida pelo gestor', dica: 'Texto do closer na ficha' },
  { chave: 'kickoff', label: 'Reunião de kickoff realizada', dica: 'Alinhamento inicial com o cliente' },
]

export type EntradaChecklist = {
  cliente: { segmento?: string; descricao?: string; palavrasChave?: unknown; metaConectado?: boolean; instagramConectado?: boolean; entregaveis?: unknown[]; postsMensais?: number; onboardingChecklist?: Record<string, boolean> | null } | null | undefined
  marcos: number
  publicados: number
}

export function checklistOnboarding(e: EntradaChecklist): ItemOnboarding[] {
  const c = e.cliente
  const marcados = c?.onboardingChecklist || {}
  const automaticos: ItemOnboarding[] = [
    { chave: 'escopo', label: 'Escopo do contrato definido', dica: 'Editar cliente: entregáveis ou posts/mês', ok: !!((c?.entregaveis && c.entregaveis.length > 0) || (c?.postsMensais && c.postsMensais > 0)), manual: false },
    { chave: 'marca', label: 'Brand Board preenchido', dica: 'Aba Marca', ok: !!(c?.segmento || c?.descricao || c?.palavrasChave), manual: false },
    { chave: 'redes', label: 'Redes sociais conectadas', dica: 'Conectar Instagram / Facebook', ok: !!(c?.metaConectado || c?.instagramConectado), manual: false },
    { chave: 'playbook', label: 'Playbook (etapas) criado', dica: 'Aba Playbook: aplicar o modelo de onboarding', ok: e.marcos > 0, manual: false },
    { chave: 'primeiro', label: 'Primeiro conteúdo publicado', dica: 'Planner', ok: e.publicados > 0, manual: false },
  ]
  const manuais: ItemOnboarding[] = ITENS_MANUAIS.map(m => ({ ...m, ok: !!marcados[m.chave], manual: true }))
  // Ordem de jornada: formalizar → acessos → passagem → kickoff → escopo → marca → redes → playbook → primeiro post
  return [...manuais, ...automaticos]
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

// Só chaves conhecidas entram no checklist manual gravado (nada vindo do cliente vira campo solto).
export function limparChecklist(bruto: unknown): Record<string, boolean> {
  const saida: Record<string, boolean> = {}
  if (bruto && typeof bruto === 'object') {
    for (const m of ITENS_MANUAIS) {
      const v = (bruto as Record<string, unknown>)[m.chave]
      if (v === true) saida[m.chave] = true
    }
  }
  return saida
}
