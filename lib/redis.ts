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
  // Integração Meta
  facebookPageId?: string
  facebookPageToken?: string
  instagramBusinessId?: string
  instagramUsername?: string
  metaConectado?: boolean
  // Login do cliente
  loginEmail?: string
  loginSenha?: string // senha em texto plano só para reexibir ao admin (a hash fica no Usuario)
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

export type PostStatus ='rascunho' | 'aguardando_aprovacao' | 'aprovado' | 'corrigir' | 'reprovado' | 'publicado' | 'falha_publicacao'

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
  midiaRemovida?: boolean // mídia já publicada e removida do Blob para liberar espaço
}
