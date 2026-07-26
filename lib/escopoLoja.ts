// Escopo de loja do varejo multi-loja (perfil 'telefonia'). É a ESPINHA DE
// SEGURANÇA do isolamento entre unidades da MESMA empresa: o operador de uma loja
// só enxerga a SUA, e o `lojaId` dele vem SEMPRE do token da sessão — NUNCA de um
// parâmetro do request (senão bastaria pedir `?lojaId=` da loja alheia). Por isso
// `resolverEscopoLoja` IGNORA a loja pedida quando o usuário está travado numa.
//
// Regras (uma casa só, testada, usada por toda rota do varejo):
//   admin                    → vê todas; pode focar uma via seletor (lojaPedida)
//   gerente SEM lojaId       → gestor da rede: vê todas; pode focar uma (lojaPedida)
//   gerente/usuario/vendas COM lojaId → TRAVADO nessa loja (ignora lojaPedida)
//   usuario/vendas SEM lojaId → BLOQUEADO (fail-closed) — precisa ser vinculado
//
// Fail-closed de propósito: um operador sem loja atribuída não vê NADA, em vez de
// ver tudo. Vincular loja é ação do admin (ver [[telefonia-multiloja]]).

export type PapelEscopo = { role?: string | null; lojaId?: string | null }

export type EscopoLoja =
  | { tipo: 'todas' }                       // vê todas as lojas (consolidado)
  | { tipo: 'loja'; lojaId: string }        // travado/focado numa loja
  | { tipo: 'bloqueado'; motivo: string }   // fail-closed

const MOTIVO_SEM_LOJA = 'Usuário sem loja atribuída. Peça ao administrador para vincular você a uma unidade.'

const trim = (v?: string | null) => (v || '').trim()

// admin e gerente são os papéis com potencial de ver a rede inteira. (gerente só
// vê tudo se NÃO tiver loja fixa — gerente com loja é gerente de uma unidade.)
export function podeVerTodasAsLojas(role?: string | null): boolean {
  return role === 'admin' || role === 'gerente'
}

// Resolve o escopo efetivo de LEITURA. `lojaPedida` = o ?lojaId= do request; só é
// respeitado para quem vê todas (seletor de loja). Para o operador travado, a loja
// vem do token e a pedida é ignorada.
export function resolverEscopoLoja(user: PapelEscopo, lojaPedida?: string | null): EscopoLoja {
  const propria = trim(user?.lojaId)
  // admin nunca fica preso a uma loja: sempre pode ver todas ou focar via seletor.
  if (user?.role === 'admin') {
    const pedida = trim(lojaPedida)
    return pedida ? { tipo: 'loja', lojaId: pedida } : { tipo: 'todas' }
  }
  // Qualquer não-admin COM loja fixa está travado nela — a pedida é ignorada.
  if (propria) return { tipo: 'loja', lojaId: propria }
  // Sem loja fixa: gerente = gestor da rede (todas / foca via seletor).
  if (user?.role === 'gerente') {
    const pedida = trim(lojaPedida)
    return pedida ? { tipo: 'loja', lojaId: pedida } : { tipo: 'todas' }
  }
  // usuario/vendas (ou desconhecido) sem loja = bloqueado.
  return { tipo: 'bloqueado', motivo: MOTIVO_SEM_LOJA }
}

// Autoriza uma ESCRITA numa loja específica (entrada de estoque, venda, ajuste…).
// Devolve o lojaId efetivo em que a escrita PODE ocorrer, ou o erro/status HTTP.
// Quem vê todas precisa DIZER a loja (não dá para escrever "em todas"); o operador
// só escreve na própria (loja alvo divergente = 403).
export function podeEscreverNaLoja(
  user: PapelEscopo,
  lojaAlvo?: string | null,
): { ok: true; lojaId: string } | { ok: false; status: number; erro: string } {
  const alvo = trim(lojaAlvo)
  const esc = resolverEscopoLoja(user, alvo)
  if (esc.tipo === 'bloqueado') return { ok: false, status: 403, erro: esc.motivo }
  if (esc.tipo === 'todas') {
    if (!alvo) return { ok: false, status: 400, erro: 'Informe a loja.' }
    return { ok: true, lojaId: alvo }
  }
  // Travado numa loja: alvo vazio assume a própria; alvo divergente é recusado.
  if (alvo && alvo !== esc.lojaId) return { ok: false, status: 403, erro: 'Você só pode operar na sua loja.' }
  return { ok: true, lojaId: esc.lojaId }
}
