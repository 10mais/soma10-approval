// Corretor ortográfico DO NAVEGADOR nos campos do sistema.
//
// Contexto (medido em produção 2026-08-29): o app já entrega `<html lang="pt-BR">`
// e todo campo de texto resolve `lang` para pt-BR. Mesmo assim o Chrome só
// corrige nos idiomas que o USUÁRIO habilitou — sem Português (Brasil) na lista
// (ou com uma extensão tipo Grammarly por cima), ele corrige tudo pelo dicionário
// de inglês e sublinha o texto inteiro de vermelho. Nenhuma linha de código
// nossa escolhe o dicionário do navegador.
//
// DECISÃO DO DONO (04/11/2026): "RESOLVA a questão do corretor em todo o
// sistema". A caixa de 29/08 em Minha conta nascia LIGADA e quase ninguém sabia
// dela, então o mar de vermelho continuou. Agora o corretor nasce DESLIGADO em
// todo o sistema: o <html> já sai do servidor com spellcheck="false" (ver
// app/layout.tsx) e só liga para quem marcar a caixa, neste navegador.
//
// A chave ganhou o sufixo _v2 de propósito: a preferência antiga gravada como
// "ligado" (desmarcar e marcar de novo grava '1') faria o vermelho voltar para
// essa pessoa. Chave nova = todo mundo começa no padrão novo.
//
// Como funciona: `spellcheck` é HERDADO. Marcar o `<html>` desliga em todos os
// campos de uma vez — por isso nenhum campo pode fixar `spellCheck` na marra
// (só `lang`), senão ele ganharia da herança e a caixa não teria efeito.

export const CHAVE_ORTOGRAFIA = 'soma10_ortografia_v2'

function store(): Storage | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null } catch { return null }
}

// Padrão DESLIGADO: liga só quem escolheu ligar (gravado '1').
export function ortografiaLigada(): boolean {
  const s = store()
  if (!s) return false
  try { return s.getItem(CHAVE_ORTOGRAFIA) === '1' } catch { return false }
}

export function definirOrtografia(ligada: boolean): void {
  const s = store()
  try { s?.setItem(CHAVE_ORTOGRAFIA, ligada ? '1' : '0') } catch { /* sem storage: vale só nesta aba */ }
  aplicarOrtografia(ligada)
}

// Escreve (ou apaga) o atributo no <html>. Ligar APAGA o atributo (a herança
// volta ao padrão do navegador); desligar escreve spellcheck="false". Sem
// `documentElement` — no servidor, no teste — é no-op, e não uma exceção que
// derruba a página.
export function aplicarOrtografia(ligada = ortografiaLigada()): void {
  try {
    const el = typeof document !== 'undefined' ? document.documentElement : null
    if (!el) return
    if (ligada) el.removeAttribute('spellcheck')
    else el.setAttribute('spellcheck', 'false')
  } catch { /* ambiente sem DOM */ }
}
