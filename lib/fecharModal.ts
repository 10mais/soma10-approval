import { clicouNoFundo } from './modalFora'

// Handler de fechar-ao-clicar-fora para os modais do sistema. A regra de "foi
// mesmo um clique no fundo?" mora em lib/modalFora.ts (puro, testado).
//
// Uso:
//   <div onClick={fecharFora(() => setForm(null))} …>                      // fecha
//   <div onClick={fecharFora(onClose, { temAlteracoes, salvar })} …>       // salva sozinho e fecha
//
// REGRA DO SISTEMA (dono, 08/09/2026): "salve automaticamente sempre que houver
// alteração; nunca 'sair sem salvar'". O diálogo "Sair sem salvar?" foi
// REMOVIDO de todo o sistema — ele aparecia até em quem só abriu para olhar
// (o marco do Playbook perguntava sempre) e ensinava a clicar sem ler.
//
// Como fica: clique fora com alteração pendente → `salvar()` (o modal grava e
// fecha por conta própria ao terminar; se o formulário estiver inválido, o
// próprio salvar avisa e o modal continua aberto). Sem alteração → fecha.
// Modal que não passa `salvar` fecha direto — vale para caixas de texto de
// ação (gerar plano, pedir ajuste), onde "salvar" seria executar a ação.
//
// `perguntar` e `temAlteracoes` continuam aceitos pelas chamadas antigas;
// `perguntar` não faz mais nada (não há mais pergunta).

type Opcoes = {
  perguntar?: boolean
  temAlteracoes?: () => boolean
  salvar?: () => void | Promise<void>
  mensagem?: string
  titulo?: string
}

export function fecharFora(aoFechar: () => void, opts: Opcoes = {}) {
  return (e: { target: unknown; currentTarget: unknown }) => {
    if (!clicouNoFundo(e)) return
    const sujo = opts.temAlteracoes ? opts.temAlteracoes() : false
    if (sujo && opts.salvar) { void opts.salvar(); return }
    aoFechar()
  }
}
