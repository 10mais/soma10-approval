// COLAB (collaborators) do Instagram — a regra num lugar só (dono, 26-27/10/2026: "está havendo
// algum erro na hora de marcar em colab algum perfil?"). A tela deixava marcar 4 perfis, a API
// guardava 4 e a publicação mandava só os 3 primeiros: o 4º nunca era convidado e ninguém sabia.
// A Meta aceita ATÉ 3 colaboradores por post (feed, Reels e carrossel; Story não tem colab):
// https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media
//
// Puro e client-safe; testes em tests/colab.test.ts.

/** Máximo de colaboradores que a Meta aceita num post. */
export const MAX_COLAB = 3

/** @ do Instagram: letras, números, ponto e sublinhado, até 30 caracteres. */
export const USUARIO_INSTAGRAM = /^[A-Za-z0-9._]{1,30}$/

/** "@Fulano", " fulano ", "instagram.com/fulano/" e "https://www.instagram.com/fulano?x=1" viram "fulano".
 *  O Instagram não diferencia maiúscula no @; minúscula evita marcar a mesma pessoa duas vezes. */
export function limparUsuario(valor: unknown): string {
  let s = String(valor ?? '').trim()
  const url = s.match(/instagram\.com\/([^/?#\s]+)/i)
  if (url) s = url[1]
  return s.replace(/^@+/, '').trim().toLowerCase()
}

/** Lista limpa: só @ válidos, sem repetidos, no máximo `max`. */
export function limparColaboradores(lista: unknown, max: number = MAX_COLAB): string[] {
  if (!Array.isArray(lista)) return []
  const out: string[] = []
  for (const item of lista) {
    const u = limparUsuario(item)
    if (u && USUARIO_INSTAGRAM.test(u) && !out.includes(u)) out.push(u)
  }
  return out.slice(0, max)
}

/** Os que ficam de fora por passar do limite (para avisar, em vez de sumir calado). */
export function colaboradoresAcimaDoLimite(lista: unknown, max: number = MAX_COLAB): string[] {
  if (!Array.isArray(lista)) return []
  const validos: string[] = []
  for (const item of lista) {
    const u = limparUsuario(item)
    if (u && USUARIO_INSTAGRAM.test(u) && !validos.includes(u)) validos.push(u)
  }
  return validos.slice(max)
}

/** Grupos para tentar de novo quando o Instagram recusa algum convidado: primeiro tirando um
 *  de cada vez, depois dois de cada vez... até ficar sem nenhum. O primeiro grupo aceito vale,
 *  e os que ficaram de fora dele são os recusados. Assim um @ errado não derruba os outros. */
export function gruposParaTentar(colab: string[]): string[][] {
  const n = colab.length
  const grupos: string[][] = []
  for (let tamanho = n - 1; tamanho >= 0; tamanho--) {
    const combinar = (inicio: number, atual: string[]) => {
      if (atual.length === tamanho) { grupos.push(atual); return }
      for (let i = inicio; i < n; i++) combinar(i + 1, [...atual, colab[i]])
    }
    combinar(0, [])
  }
  return grupos
}
