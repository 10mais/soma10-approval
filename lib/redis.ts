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
  cargo?: string
  foto?: string
  telefone?: string
  bio?: string
  fusoHorario?: string
  clienteId?: string
  criadoEm: string
}

export type Cliente = {
  id: string
  nome: string
  instagram: string
  logo?: string
  corPrimaria?: string
  corSecundaria?: string
  tipo?: 'cliente' | 'interno' // cliente externo ou projeto interno da agência
  entregaveis?: string[] // ex.: ['social_media', 'trafego_meta', 'trafego_google', 'landing_page']
  postsMensais?: number // quantidade contratada de posts por mês (0 ou ausente = não se aplica)
  // Contrato (gestão de renovação)
  contratoValor?: number // valor mensal/contratual em R$
  contratoInicio?: string // ISO date — início do contrato
  contratoRenovacao?: string // ISO date — próxima renovação/vencimento
  contratoCiclo?: 'mensal' | 'trimestral' | 'semestral' | 'anual'
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
  | 'tarefa_atribuida'
  | 'tarefa_alterada'
  | 'tarefa_mencao'
  | 'tarefa_prazo_proximo'
  | 'tarefa_vencida'
  | 'mensagem_privada'
  | 'aprovacao_atrasada'
  | 'contrato_renovacao'
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

// Playbook — marcos/entregas por cliente
export type MarcoStatus = 'planejado' | 'em_andamento' | 'concluido' | 'atrasado' | 'cancelado'
export type MarcoCategoria = 'social_media' | 'trafego' | 'branding' | 'landing_page' | 'estrategia' | 'reuniao' | 'entrega' | 'outro'
export type Marco = {
  id: string
  clienteId: string
  clienteNome: string
  titulo: string
  descricao?: string
  categoria: MarcoCategoria
  status: MarcoStatus
  dataInicio: string // ISO
  dataFim?: string // ISO
  responsavelNome?: string
  criadoPor: string
  criadoEm: string
  atualizadoEm: string
}

// Gestao de tarefas
export type TarefaStatus = 'a_fazer' | 'em_andamento' | 'em_revisao' | 'concluido'
export type TarefaPrioridade = 'baixa' | 'media' | 'alta' | 'urgente'
export type TarefaTipo = 'tarefa' | 'carrossel' | 'criativo' | 'ecommerce' | 'estrategia' | 'landing_page' | 'planejamento' | 'post' | 'reel' | 'story' | 'video'
export type Tarefa = {
  id: string
  titulo: string
  descricao?: string
  tipo?: TarefaTipo
  status: TarefaStatus
  prioridade: TarefaPrioridade
  responsavelEmail?: string
  responsavelNome?: string
  clienteId?: string
  clienteNome?: string
  prazo?: string // ISO date
  anexos?: { nome: string; url: string; tipo: string }[]
  atividades?: TarefaAtividade[]
  comentarios?: TarefaComentario[]
  criadoPor: string
  criadoEm: string
  atualizadoEm: string
  concluidoEm?: string
}

export type TarefaAtividade = {
  id: string
  tipo: 'criacao' | 'status' | 'responsavel' | 'prioridade' | 'prazo' | 'cliente' | 'anexo' | 'comentario'
  descricao: string
  autor: string
  criadoEm: string
}

export type TarefaComentario = {
  id: string
  autor: string
  autorNome: string
  autorFoto?: string
  texto: string
  criadoEm: string
  editadoEm?: string
}

export type PostStatus ='rascunho' | 'agendado' | 'aguardando_aprovacao' | 'aprovado' | 'corrigir' | 'reprovado' | 'publicado' | 'falha_publicacao'

// Esteira de produção de criativos — etapas pelas quais uma pauta caminha
export type EtapaCriativo = 'briefing' | 'copy' | 'aprovacao_copy' | 'criativo' | 'aprovacao_criativo' | 'pronto'

// Plano mensal de conteúdo (guarda-chuva das pautas de um cliente num mês)
export type Plano = {
  id: string
  clienteId: string
  clienteNome: string
  mes: number // 1-12
  ano: number
  titulo?: string
  criadoPor: string
  criadoEm: string
}

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
  redesPublicadas?: string[] // redes em que o post JÁ foi publicado com sucesso (evita duplicação)
  midiaRemovida?: boolean // mídia já publicada e removida do Blob para liberar espaço
  thumbnail?: string // miniatura mantida após a limpeza (uma imagem leve por post)
  // Esteira de criativos
  planoId?: string // plano mensal a que a pauta pertence
  etapa?: EtapaCriativo // posição na esteira (ausente = post avulso, fora da esteira)
  briefing?: string // ideia/ângulo/objetivo da pauta
  sugestaoImagem?: string // descrição visual sugerida (opcional)
  textoImagem?: string // texto que deve aparecer na arte
  sugestaoLegenda?: string // rascunho de legenda sugerido no briefing
  ajusteCopy?: string // comentário do cliente ao pedir ajuste de copy
  ajusteCriativo?: string // comentário do cliente ao pedir ajuste de criativo
  copyAprovadaEm?: string
  criativoAprovadoEm?: string
  aguardandoDesde?: string // ISO — quando a pauta entrou numa etapa de aprovação (SLA)
}
