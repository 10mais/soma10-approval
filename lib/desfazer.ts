// DESFAZER (Ctrl+Z) do sistema inteiro — dono, 08/09/2026: "habilite um Ctrl+Z para
// desfazer alguma ação (exclusão, ajuste, texto, etc) em TODO o sistema".
//
// COMO FUNCIONA. Não existe "desfazer mágico": cada ação que muda dado no servidor
// registra aqui o SEU PRÓPRIO inverso, logo depois de gravar com sucesso.
//
//   registrarDesfazer('Prazo do marco', async () => { await fetch(...valores antigos); return true })
//
// O Ctrl+Z global (app/components/Desfazer.tsx) tira a última ação da pilha e roda o
// inverso. Quem está digitando num campo NÃO perde o Ctrl+Z do navegador: dentro de
// input, textarea ou editor, o atalho continua desfazendo o texto (regra `atalhoParaOSistema`).
//
// LIMITES, de propósito:
//   - a pilha vive na aba (recarregou, esvaziou) — desfazer é para o erro recém-cometido;
//   - guarda no máximo LIMITE ações e cada uma vale por VALIDADE_MS;
//   - ação que o inverso não conseguir refazer avisa em vez de fingir que deu certo.

export type AcaoDesfazivel = {
  id: string
  titulo: string // aparece no aviso: "Desfeito: <titulo>"
  em: number
  desfazer: () => Promise<boolean> | boolean
}

export const LIMITE = 25
export const VALIDADE_MS = 15 * 60 * 1000

// Empilha, joga fora o que venceu e mantém no máximo LIMITE (as mais antigas caem).
export function empilhar(pilha: AcaoDesfazivel[], acao: AcaoDesfazivel, agora: number = Date.now()): AcaoDesfazivel[] {
  const vivas = pilha.filter(a => agora - a.em < VALIDADE_MS)
  return [...vivas, acao].slice(-LIMITE)
}

// Tira a última ação ainda válida (e descarta as vencidas junto).
export function retirarUltima(pilha: AcaoDesfazivel[], agora: number = Date.now()): { acao?: AcaoDesfazivel; pilha: AcaoDesfazivel[] } {
  for (let i = pilha.length - 1; i >= 0; i--) {
    if (agora - pilha[i].em < VALIDADE_MS) return { acao: pilha[i], pilha: pilha.slice(0, i).filter(a => agora - a.em < VALIDADE_MS) }
  }
  return { pilha: [] }
}

// O Ctrl+Z é do SISTEMA ou do texto que a pessoa está digitando?
// Campo de texto (input de texto, textarea, editor rico) fica com o navegador.
export function atalhoParaOSistema(alvo: { tag?: string; tipo?: string; editavel?: boolean } | null | undefined): boolean {
  if (!alvo) return true
  if (alvo.editavel) return false
  const tag = (alvo.tag || '').toUpperCase()
  if (tag === 'TEXTAREA') return false
  if (tag === 'INPUT') {
    const t = (alvo.tipo || 'text').toLowerCase()
    // Campos onde o Ctrl+Z do navegador desfaz digitação de verdade.
    return !['text', 'search', 'url', 'tel', 'email', 'password', 'number', 'date', 'datetime-local', 'time', 'month'].includes(t)
  }
  return true
}

// ---------------------------------------------------------------- pilha da aba
let pilha: AcaoDesfazivel[] = []
const ouvintes = new Set<(n: number) => void>()
const avisar = () => ouvintes.forEach(f => f(pilha.length))

export function registrarDesfazer(titulo: string, desfazer: AcaoDesfazivel['desfazer']): string {
  const id = Math.random().toString(36).slice(2)
  pilha = empilhar(pilha, { id, titulo, em: Date.now(), desfazer })
  avisar()
  return id
}

export function quantasDesfazer(): number { return retirarUltima(pilha).acao ? pilha.length : 0 }
export function limparDesfazer() { pilha = []; avisar() }
export function assinarDesfazer(f: (n: number) => void): () => void { ouvintes.add(f); return () => { ouvintes.delete(f) } }

// Roda o inverso da última ação. Devolve o que aconteceu, para a tela avisar.
export async function desfazerUltima(): Promise<{ ok: boolean; titulo?: string; vazio?: boolean }> {
  const { acao, pilha: resto } = retirarUltima(pilha)
  pilha = resto
  avisar()
  if (!acao) return { ok: false, vazio: true }
  try {
    const ok = await acao.desfazer()
    return { ok: ok !== false, titulo: acao.titulo }
  } catch {
    return { ok: false, titulo: acao.titulo }
  }
}
