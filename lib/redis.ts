import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

// Tipos
export type Role = 'admin' | 'gerente' | 'cliente'

export type Usuario = {
  id: string
  nome: string
  email: string
  senha: string
  role: Role
  cargo?: string // função/cargo da pessoa (ex.: Social Media, Designer)
  clienteId?: string // presente quando role === 'cliente', vincula ao Cliente
  criadoEm: string
}

export type Cliente = {
  id: string
  nome: string
  instagram: string
  logo?: string
  corPrimaria?: string
  corSecundaria?: string
  criadoEm: string
  // Integração Meta — Facebook (Página) e/ou Instagram (login do Instagram)
  facebookPageId?: string
  facebookPageToken?: string
  instagramBusinessId?: string
  instagramUsername?: string
  metaConectado?: boolean
  // Instagram via "API com login do Instagram" (graph.instagram.com)
  instagramToken?: string
  instagramUserId?: string
  instagramConectado?: boolean
  instagramTokenAtualizadoEm?: string
  // Login do cliente
  loginEmail?: string
  loginSenha?: string // senha em texto plano só para reexibir ao admin (a hash fica no Usuario)
  // Brands Board — identidade e DNA do cliente
  segmento?: string // nicho (ex.: Cardiologia)
  palavrasChave?: string // palavras-chave separadas por vírgula
  descricao?: string
  publicoAlvo?: string
  tomDeVoz?: string
  preferencias?: string
  documentos?: { nome: string; url: string }[]
  // Documento de marca aprofundado, gerado por IA a partir do Brand Board
  documentoMarca?: string
  documentoMarcaGeradoEm?: string
}

export type ConfigAgencia = {
  nomeAgencia: string
  emailContato?: string
  logo?: string
  corPrimaria?: string
  corSecundaria?: string
  atualizadoEm?: string
}

export type TipoNotificacao =
  | 'post_aprovado'
  | 'post_corrigir'
  | 'post_reprovado'
  | 'post_publicado'
  | 'post_falha_publicacao'
  | 'geral'

export type Notificacao = {
  id: string
  destinatarioEmail: string
  tipo: TipoNotificacao
  titulo: string
  mensagem: string
  postId?: string
  lida: boolean
  criadoEm: string
}

export type ChatMensagem = {
  id: string
  de: string // email de quem enviou
  deNome: string
  para: string // email do destinatário, ou 'equipe' para o canal geral
  texto: string
  criadoEm: string
}

export type PostStatus ='rascunho' | 'agendado' | 'aguardando_aprovacao' | 'aprovado' | 'corrigir' | 'reprovado' | 'publicado' | 'falha_publicacao'

export type Post = {
  id: string
  clienteId: string
  clienteNome: string
  imagens: string[]
  legenda: string
  status: PostStatus
  formato?: 'feed' | 'reel' | 'story'
  dataAgendada?: string
  codigo?: string
  criadoPor: string
  criadoEm: string
  atualizadoEm: string
  anotacoes?: any[]
  motivoReprovacao?: string
  erroPublicacao?: string
  rascunhoInterno?: boolean
  colaboradores?: string[] // até 4 @usuários marcados em colab
  redes?: ('instagram' | 'facebook')[] // redes onde publicar
  capasVideo?: Record<string, string> // URL do vídeo -> URL da capa (thumbnail) escolhida
  midiaRemovida?: boolean // mídia já publicada e removida do Blob para liberar espaço
  thumbnail?: string // miniatura mantida após a limpeza (uma imagem leve por post)
}
