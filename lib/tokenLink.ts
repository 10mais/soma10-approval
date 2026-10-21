// LINK PÚBLICO de documento no formato CURTO — dono, 21/10/2026: "O link de aprovação aparece
// de formas diferentes em mobile e desktop. É exatamente o mesmo link, porém em mobile tá dando
// aquela quebra." O documento usava o UUID inteiro (36 caracteres, com traços) e o WhatsApp do
// iPhone partia o link no meio (só um pedaço clicável). O link de aprovação de posts, que vai
// pelo WhatsApp todo dia sem problema, usa 20 caracteres sem traço: o documento passa a usar o
// mesmo formato. Link antigo continua abrindo (vira "antigo"); compartilhar de novo já dá o curto.

/** 20 caracteres, sem traço — o formato do link de aprovação (app/api/aprovacao-link). */
export function novoTokenCurto(gerarUuid: () => string): string {
  return gerarUuid().replace(/-/g, '').slice(0, 20)
}

/** Token no formato antigo (UUID com traços), que quebra no WhatsApp do iPhone. */
export const tokenNoFormatoAntigo = (token?: string | null): boolean => !!token && token.includes('-')

type DocComLink = { token?: string; tokensAntigos?: string[] }

/** O token abre o documento? O atual ou um antigo que ainda vale (revogar apaga todos). */
export function tokenAbreODoc(doc: DocComLink, token: string | null | undefined): boolean {
  if (!token) return false
  return doc.token === token || (doc.tokensAntigos || []).includes(token)
}

/** Ao compartilhar: sem link ganha um curto; link antigo vira "antigo" e o compartilhamento usa o curto. */
export function tokenParaCompartilhar(doc: DocComLink, gerarUuid: () => string): { token: string; tokensAntigos?: string[]; mudou: boolean } {
  if (doc.token && !tokenNoFormatoAntigo(doc.token)) return { token: doc.token, ...(doc.tokensAntigos?.length ? { tokensAntigos: doc.tokensAntigos } : {}), mudou: false }
  const antigos = [...(doc.tokensAntigos || []), ...(doc.token ? [doc.token] : [])]
  return { token: novoTokenCurto(gerarUuid), ...(antigos.length ? { tokensAntigos: antigos } : {}), mudou: true }
}
