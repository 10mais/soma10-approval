// YOUTUBE — conexão do canal e envio do vídeo (a parte que fala com o Google).
//
// As REGRAS (título, descrição, Short × vídeo, agendamento) moram em lib/youtubePost, pura e
// testada. Aqui fica só o que precisa de rede: trocar código por token, renovar o token,
// descobrir o canal e subir o arquivo.
//
// ENVS (Google Cloud → APIs e serviços → Credenciais → ID do cliente OAuth, tipo "Aplicativo da Web"):
//   YOUTUBE_CLIENT_ID
//   YOUTUBE_CLIENT_SECRET
//   (o redirecionamento é `${APPROVAL_BASE_URL}/api/youtube/oauth/callback` e precisa estar
//    cadastrado no mesmo lugar, idêntico, com https)
//
// DUAS COISAS QUE O GOOGLE EXIGE e não dependem de código:
//   1. o escopo `youtube.upload` é SENSÍVEL: enquanto o app estiver "em teste", só canais
//      adicionados como testadores conectam, e o acesso cai a cada 7 dias. Publicar para
//      cliente de verdade exige a verificação do app (vídeo demonstrando, política de
//      privacidade e domínio verificado) — é o mesmo tipo de processo do App Review da Meta;
//   2. cada upload custa 1.600 unidades da cota diária (padrão: 10.000). Dá ~6 vídeos por dia
//      no projeto inteiro até o Google aprovar um aumento de cota.
//
// LIVE está fora de propósito (pedido do dono, 27/09): outro endpoint, outro fluxo.

import { corpoDoUpload, type PostYouTube } from './youtubePost'

const OAUTH_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'
const OAUTH_TOKEN = 'https://oauth2.googleapis.com/token'
const API = 'https://www.googleapis.com/youtube/v3'
const UPLOAD = 'https://www.googleapis.com/upload/youtube/v3/videos'

// `youtube.upload` sobe o vídeo; `youtube.readonly` lê o nome do canal para a tela mostrar
// EM QUAL canal o post vai sair — conectar às cegas é como publicar no perfil errado.
export const ESCOPOS_YOUTUBE = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
]

export function youtubeConfigurado(): boolean {
  return !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET)
}

// O endereço de volta sai do DOMÍNIO em que a pessoa está usando o sistema (a origem da
// requisição), e não de APPROVAL_BASE_URL. Dono, 27/09: "Erro 400: redirect_uri_mismatch" —
// a variável apontava para outro endereço que o cadastrado no Google. O Google exige o
// endereço IDÊNTICO nas duas pontas (ida e troca do código), então as duas usam a mesma
// origem. Sem origem (chamada interna), cai na variável como antes.
export function urlRedirecionamentoYouTube(origem?: string): string {
  const raiz = (origem || process.env.APPROVAL_BASE_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '')
  return `${raiz}/api/youtube/oauth/callback`
}

/** Tela de consentimento do Google. `estado` volta no callback (cliente + conta + de onde veio). */
export function urlConsentimentoYouTube(estado: string, origem?: string): string {
  const p = new URLSearchParams({
    client_id: String(process.env.YOUTUBE_CLIENT_ID || ''),
    redirect_uri: urlRedirecionamentoYouTube(origem),
    response_type: 'code',
    scope: ESCOPOS_YOUTUBE.join(' '),
    access_type: 'offline',      // sem isto não vem refresh_token e a conexão morre em 1 hora
    prompt: 'consent',           // garante o refresh_token mesmo em reconexão
    include_granted_scopes: 'true',
    state: estado,
  })
  return `${OAUTH_AUTH}?${p.toString()}`
}

export type TokensYouTube = { accessToken: string; refreshToken?: string; expiraEm: number }

async function postForm(url: string, corpo: Record<string, string>): Promise<any> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(corpo).toString(),
  })
  const d = await r.json().catch(() => ({} as any))
  if (!r.ok) throw new Error(explicaErroGoogle(r.status, d))
  return d
}

/** Mensagem que diz o que fazer — erro do Google costuma ser sigla seca. */
export function explicaErroGoogle(status: number, corpo: any): string {
  const msg = corpo?.error?.message || corpo?.error_description || corpo?.error || ''
  const motivo = corpo?.error?.errors?.[0]?.reason || ''
  if (motivo === 'quotaExceeded' || /quota/i.test(String(msg))) {
    return 'O YouTube recusou por COTA: a API dá 10.000 unidades por dia e cada vídeo custa 1.600 (~6 por dia). Peça aumento de cota no Google Cloud ou tente amanhã.'
  }
  if (motivo === 'youtubeSignupRequired') return 'Esta conta do Google não tem canal no YouTube. Crie o canal e conecte de novo.'
  if (motivo === 'forbidden' || status === 403) return `O Google recusou (403): ${msg || 'sem permissão'}. Confira se o canal conectado é o certo e se o app já passou pela verificação do Google.`
  if (status === 401) return 'A conexão com o YouTube expirou. Reconecte o canal deste cliente.'
  return `YouTube: ${msg || `HTTP ${status}`}`
}

/** Troca o código da tela de consentimento pelos tokens. */
export async function trocarCodigoYouTube(code: string, origem?: string): Promise<TokensYouTube> {
  const d = await postForm(OAUTH_TOKEN, {
    code,
    client_id: String(process.env.YOUTUBE_CLIENT_ID || ''),
    client_secret: String(process.env.YOUTUBE_CLIENT_SECRET || ''),
    redirect_uri: urlRedirecionamentoYouTube(origem),
    grant_type: 'authorization_code',
  })
  return { accessToken: d.access_token, refreshToken: d.refresh_token, expiraEm: Date.now() + (Number(d.expires_in) || 3600) * 1000 }
}

/** Token de uma hora a partir do refresh guardado na conta do cliente. */
export async function acessoYouTube(refreshToken: string): Promise<string> {
  const d = await postForm(OAUTH_TOKEN, {
    refresh_token: refreshToken,
    client_id: String(process.env.YOUTUBE_CLIENT_ID || ''),
    client_secret: String(process.env.YOUTUBE_CLIENT_SECRET || ''),
    grant_type: 'refresh_token',
  })
  return d.access_token
}

export type CanalYouTube = { id: string; titulo: string; foto?: string }

/** Canal do token (o que vai aparecer na tela como destino da publicação). */
export async function canalDoToken(accessToken: string): Promise<CanalYouTube | null> {
  const r = await fetch(`${API}/channels?part=snippet&mine=true`, { headers: { Authorization: `Bearer ${accessToken}` } })
  const d = await r.json().catch(() => ({} as any))
  if (!r.ok) throw new Error(explicaErroGoogle(r.status, d))
  const c = d?.items?.[0]
  if (!c?.id) return null
  return { id: c.id, titulo: c.snippet?.title || 'Canal', foto: c.snippet?.thumbnails?.default?.url }
}

export type ContaYouTube = {
  youtubeRefreshToken?: string
  youtubeChannelId?: string
  youtubeChannelTitle?: string
  youtubeConectado?: boolean
}

/**
 * Sobe o vídeo. O arquivo vem do Blob e vai para o YouTube por upload RETOMÁVEL: primeiro a
 * sessão (com o título, a descrição e o agendamento), depois os bytes. É o caminho que o
 * Google recomenda para arquivo grande — e o único que dá para acompanhar.
 *
 * Devolve o id do vídeo. Quem grava isso no post é quem chamou (lib/publicar), para a
 * anti-duplicação continuar sendo uma regra só.
 */
export async function subirVideoYouTube(
  conta: ContaYouTube,
  post: PostYouTube,
  videoUrl: string,
  agora = new Date(),
  miniaturaUrl?: string,
): Promise<{ ok: true; videoId: string; aviso?: string } | { ok: false; erro: string }> {
  if (!youtubeConfigurado()) return { ok: false, erro: 'YouTube não configurado (faltam YOUTUBE_CLIENT_ID e YOUTUBE_CLIENT_SECRET na Vercel).' }
  if (!conta.youtubeRefreshToken) return { ok: false, erro: 'Este perfil não tem canal do YouTube conectado.' }

  try {
    const token = await acessoYouTube(conta.youtubeRefreshToken)

    // 1) O arquivo (Blob). `content-length` é obrigatório para o upload retomável.
    const arq = await fetch(videoUrl)
    if (!arq.ok || !arq.body) return { ok: false, erro: `Não foi possível ler o vídeo no armazenamento (HTTP ${arq.status}).` }
    const tamanho = Number(arq.headers.get('content-length') || 0)
    const tipo = arq.headers.get('content-type') || 'video/*'

    // 2) Sessão de upload — aqui vão título, descrição, tags e o agendamento.
    const sessao = await fetch(`${UPLOAD}?uploadType=resumable&part=snippet,status`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': tipo,
        ...(tamanho ? { 'X-Upload-Content-Length': String(tamanho) } : {}),
      },
      body: JSON.stringify(corpoDoUpload(post, agora)),
    })
    if (!sessao.ok) {
      const d = await sessao.json().catch(() => ({} as any))
      return { ok: false, erro: explicaErroGoogle(sessao.status, d) }
    }
    const destino = sessao.headers.get('location')
    if (!destino) return { ok: false, erro: 'O YouTube não devolveu o endereço de upload.' }

    // 3) Os bytes, direto do Blob para o YouTube (sem passar por memória).
    const envio = await fetch(destino, {
      method: 'PUT',
      headers: { 'Content-Type': tipo, ...(tamanho ? { 'Content-Length': String(tamanho) } : {}) },
      body: arq.body as any,
      // Node exige `duplex: 'half'` para mandar um stream como corpo.
      ...({ duplex: 'half' } as any),
    })
    const res = await envio.json().catch(() => ({} as any))
    if (!envio.ok || !res?.id) return { ok: false, erro: explicaErroGoogle(envio.status, res) }

    // 4) Miniatura (a capa do vídeo). O vídeo JÁ subiu: falha aqui vira aviso, nunca erro —
    //    senão a nova tentativa subiria o vídeo de novo.
    const aviso = miniaturaUrl ? await definirMiniatura(token, res.id, miniaturaUrl) : undefined
    return { ok: true, videoId: res.id, ...(aviso ? { aviso } : {}) }
  } catch (e: any) {
    return { ok: false, erro: e?.message || String(e) }
  }
}

/**
 * Troca a miniatura do vídeo. Devolve um aviso em texto quando não deu (ou nada, se deu).
 * O YouTube só aceita miniatura personalizada de canal VERIFICADO (por telefone) e até 2 MB.
 */
async function definirMiniatura(token: string, videoId: string, url: string): Promise<string | undefined> {
  try {
    const img = await fetch(url)
    if (!img.ok) return `Miniatura não aplicada: não foi possível ler a capa (HTTP ${img.status}).`
    const bytes = await img.arrayBuffer()
    if (bytes.byteLength > 2 * 1024 * 1024) return 'Miniatura não aplicada: a capa passa de 2 MB (limite do YouTube).'
    const r = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': img.headers.get('content-type') || 'image/jpeg' },
      body: bytes,
    })
    if (r.ok) return undefined
    const d = await r.json().catch(() => ({} as any))
    if (r.status === 403) return 'Miniatura não aplicada: o canal precisa estar verificado no YouTube para usar miniatura personalizada.'
    return `Miniatura não aplicada — ${explicaErroGoogle(r.status, d)}`
  } catch (e: any) {
    return `Miniatura não aplicada: ${e?.message || e}`
  }
}
