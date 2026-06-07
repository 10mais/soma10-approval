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

export type PostStatus = 'rascunho' | 'aguardando_aprovacao' | 'aprovado' | 'corrigir' | 'reprovado' | 'publicado'

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
}
