import { redis } from './redis'

// Excluir UMA mensagem do inbox (WhatsApp e Instagram usam o mesmo formato:
// lista Redis de JSON, cada item com `id`; a conversa guarda ultimaMsg/ultimaEm).
//
// Apaga só do Soma10 — a mensagem continua no celular do cliente. Decisão do
// dono (2026-07-16): "apagar para todos" dependeria da janela de tempo de cada
// rede e só valeria pro que nós mandamos.
//
// A pegadinha: lista do Redis não tem "delete no índice". O caminho correto é
// marcar a posição com uma SENTINELA (LSET) e remover por valor (LREM). Um LREM
// direto com o JSON original apagaria TODAS as mensagens de texto idêntico —
// dois "ok" na mesma conversa sumiriam juntos.

export const SENTINELA_APAGADA = '__soma10:apagada__'

type Item = { id?: string; texto?: string; em?: string }

function parse(raw: unknown): Item | null {
  try { return typeof raw === 'string' ? JSON.parse(raw) : (raw as Item) } catch { return null }
}

// Índice do item com esse id, ou -1. De trás pra frente: apaga-se quase sempre
// algo recente.
export function indiceDaMensagem(raws: unknown[], msgId: string): number {
  if (!msgId) return -1
  for (let i = raws.length - 1; i >= 0; i--) {
    if (parse(raws[i])?.id === msgId) return i
  }
  return -1
}

// Prévia da conversa DEPOIS de tirar o item do índice `idx`. Null = a conversa
// ficou vazia. Só muda quando se apaga a ÚLTIMA — apagar do meio não mexe na
// lista de conversas.
export function previaAposRemover(raws: unknown[], idx: number): { ultimaMsg: string; ultimaEm: string } | null {
  const restantes = raws.filter((_, i) => i !== idx)
  for (let i = restantes.length - 1; i >= 0; i--) {
    const o = parse(restantes[i])
    if (o) return { ultimaMsg: (o.texto || '').slice(0, 120), ultimaEm: o.em || '' }
  }
  return null
}

// Remove a mensagem e conserta a prévia da conversa. Devolve false quando não
// achou (id errado, ou já apagada por outra pessoa).
export async function apagarMensagemDaConversa(
  chaveLista: string,
  chaveConversa: string,
  msgId: string,
): Promise<boolean> {
  const raws = await redis.lrange(chaveLista, 0, -1)
  const idx = indiceDaMensagem(raws, msgId)
  if (idx < 0) return false

  await redis.lset(chaveLista, idx, SENTINELA_APAGADA)
  await redis.lrem(chaveLista, 1, SENTINELA_APAGADA)

  // A prévia é o que aparece na LISTA de conversas: sem isto, a conversa
  // continuaria anunciando uma mensagem que não existe mais.
  const previa = previaAposRemover(raws, idx)
  const conversa = await redis.get<Record<string, unknown>>(chaveConversa)
  if (conversa) {
    await redis.set(chaveConversa, previa
      ? { ...conversa, ...previa }
      : { ...conversa, ultimaMsg: '', ultimaEm: '' })
  }
  return true
}
