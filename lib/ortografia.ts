// Corretor ortográfico DO NAVEGADOR nos campos do sistema.
//
// Contexto (medido em produção 2026-08-29): o app já entrega `<html lang="pt-BR">`
// e todo campo de texto resolve `lang` para pt-BR. Mesmo assim o Chrome só
// corrige nos idiomas que o USUÁRIO habilitou — sem Português (Brasil) na lista
// (ou com uma extensão tipo Grammarly por cima), ele corrige tudo pelo dicionário
// de inglês e sublinha o texto inteiro de vermelho. Nenhuma linha de código
// nossa muda isso.
//
// O que o sistema pode fazer é DESLIGAR o corretor: melhor sem correção do que
// com um mar de vermelho embaixo de palavras certas — sublinhado que sempre
// mente é sublinhado que ninguém mais lê.
//
// Como funciona: `spellcheck` é HERDADO. Marcar o `<html>` desliga em todos os
// campos de uma vez — por isso nenhum campo pode fixar `spellCheck` na marra
// (só `lang`), senão ele ganharia da herança e a chave não teria efeito.

export const CHAVE_ORTOGRAFIA = 'soma10_ortografia'

function store(): Storage | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null }
}

// Padrão LIGADO: quem tem o dicionário certo instalado merece a correção.
export function ortografiaLigada(): boolean {
  const s = store()
  if (!s) return true
  try { return s.getItem(CHAVE_ORTOGRAFIA) !== '0' } catch { return true }
}

export function definirOrtografia(ligada: boolean): void {
  const s = store()
  try { s?.setItem(CHAVE_ORTOGRAFIA, ligada ? '1' : '0') } catch { /* sem storage: vale só nesta aba */ }
  aplicarOrtografia(ligada)
}

// Escreve (ou apaga) o atributo no <html>. Sem `documentElement` — no servidor,
// no teste — é no-op, e não uma exceção que derruba a página.
export function aplicarOrtografia(ligada = ortografiaLigada()): void {
  try {
    const el = typeof document !== 'undefined' ? document.documentElement : null
    if (!el) return
    if (ligada) el.removeAttribute('spellcheck')
    else el.setAttribute('spellcheck', 'false')
  } catch { /* ambiente sem DOM */ }
}
