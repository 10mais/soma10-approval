// Assistente de perguntas do inbox (client-safe, sem I/O): interpreta o que a
// IA devolveu. Fica fora da rota porque é a parte frágil — texto de LLM não tem
// contrato: às vezes vem embrulhado em ```json, às vezes com um parágrafo antes.
// Prefere devolver [] a devolver lixo: a UI mostra erro em vez de sugestão falsa.

export type Sugestao = { pergunta: string; porque: string; fase: string }

export const MAX_SUGESTOES = 3

export function parseSugestoes(bruto: string): Sugestao[] {
  if (typeof bruto !== 'string') return []
  // Recorta do primeiro [ ao último ] — descarta cerca de markdown e qualquer
  // "Claro, aqui estão:" que a IA insista em colocar antes do JSON.
  const ini = bruto.indexOf('[')
  const fim = bruto.lastIndexOf(']')
  if (ini < 0 || fim <= ini) return []
  let arr: unknown
  try { arr = JSON.parse(bruto.slice(ini, fim + 1)) } catch { return [] }
  if (!Array.isArray(arr)) return []
  return arr
    .map((s: any) => ({
      pergunta: String(s?.pergunta ?? '').trim(),
      porque: String(s?.porque ?? '').trim(),
      fase: String(s?.fase ?? '').trim(),
    }))
    // Sem pergunta não há sugestão; `porque`/`fase` são enfeite e podem faltar.
    .filter(s => s.pergunta)
    .slice(0, MAX_SUGESTOES)
}
