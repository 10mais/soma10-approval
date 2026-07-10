import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

// Tipos
// Hierarquia: admin > gerente > usuario > vendas > cliente
export type Role = 'admin' | 'gerente' | 'usuario' | 'cliente' | 'vendas'

export type Usuario = {
  id: string
  nome: string
  email: string
  senha: string
  role: Role
  cargo?: string
  funcaoVendas?: 'sdr' | 'closer' // sub-funcao do papel 'vendas' (SDR/BDR ou Closer)
  // Override de permissões POR USUÁRIO (sobre o padrão do papel). Financeiro é sempre só admin.
  // Cada módulo aceita boolean (formato antigo) ou { ver, editar, excluir } (novo, 3 níveis).
  permissoes?: Record<'producao' | 'estrategia' | 'crm' | 'clientes', boolean | { ver?: boolean; editar?: boolean; excluir?: boolean }> | Partial<Record<string, any>>
  // Permissões DETALHADAS (por aba + por ação) — override individual (ver lib/permissoesGranular)
  permissoesGranular?: { abas?: Record<string, boolean>; acoes?: Record<string, boolean> }
  foto?: string
  telefone?: string
  bio?: string
  fusoHorario?: string
  clienteId?: string
  custoHora?: number // custo/hora do profissional em R$ (custo operacional por cliente)
  salarioFixo?: number // remuneração fixa mensal em R$
  salarioVariavel?: number // remuneração variável mensal em R$ (= valorPorProjeto x qtdProjetos)
  valorPorProjeto?: number // valor pago por projeto/cliente
  qtdProjetos?: number // quantidade de projetos/clientes atendidos
  twoFactorSecret?: string // segredo TOTP (verificação em 2 fatores) — opt-in por usuário
  twoFactorEnabled?: boolean // 2FA confirmado e ativo (exige código no login)
  twoFactorMethod?: 'app' | 'email' // como recebe o código: app autenticador ou e-mail
  criadoEm: string
}

// Conta bancária (saldo manual) — base da Saúde do Caixa. Chave: config:contasBancarias (array)
export type ContaBancaria = {
  id: string
  nome: string
  saldo: number
  atualizadoEm?: string
}

// Lançamento futuro (previsão de entrada/saída). Set `lancamentos`, chave `lancamento:{id}`.
export type LancamentoFuturo = {
  id: string
  tipo: 'entrada' | 'saida'
  descricao: string
  valor: number
  data: string // YYYY-MM-DD prevista
  clienteId?: string
  recebido?: boolean // marcado quando efetivado
  criadoPor?: string
  criadoEm: string
}

// Motor de automações flexível (gatilho + condições + sequência de passos).
// Chaves: config:automacoesRegras (Automacao[]); automacoes:pendentes (ZSET por vencimento).
export type AutomacaoCondicao = {
  campo: string
  operador: 'igual' | 'diferente' | 'contem' | 'maior' | 'menor' | 'preenchido' | 'vazio'
  valor?: string
}
export type AutomacaoPasso = {
  id: string
  atrasoDias: number // 0 = imediato; N = executa N dias após o gatilho
  acao: string       // chave do registry de ações
  params: Record<string, any>
}
export type Automacao = {
  id: string
  nome: string
  ativo: boolean
  gatilho: string    // chave do registry de gatilhos
  condicoes?: AutomacaoCondicao[]
  condicaoLogica?: 'todas' | 'qualquer'
  alvo: 'todos' | 'selecionados'
  clienteIds?: string[]          // quando alvo='selecionados'
  clienteIdsExcluidos?: string[] // override: desliga p/ clientes X quando alvo='todos'
  passos: AutomacaoPasso[]
  criadoPor?: string
  criadoEm: string
}

// Despesa da agência (folha entra à parte, via Usuario)
export type Despesa = {
  id: string
  descricao: string
  valor: number
  tipo: 'fixo' | 'variavel'
  categoria?: string
  mes: string // competência 'YYYY-MM'
  criadoPor?: string
  criadoEm: string
}

export type Apontamento = {
  id: string
  usuarioEmail: string
  usuarioNome: string
  minutos: number
  descricao?: string
  data: string // ISO — dia do trabalho realizado
  criadoEm: string
}

export type ReceitaAvulsa = {
  id: string
  mes: string // competência 'YYYY-MM'
  valor: number
  descricao?: string
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
  contratoValor?: number // valor mensal RECORRENTE em R$ (modo mensal)
  contratoInicio?: string // ISO date — início do contrato
  contratoRenovacao?: string // ISO date — próxima renovação/vencimento
  contratoCiclo?: 'mensal' | 'trimestral' | 'semestral' | 'anual'
  diaVencimento?: number // dia do mês em que o cliente paga (1-31) — usado na previsão de saldo
  // Cobranças avulsas/pontuais e modulares (valor por mês). Somam à receita do mês.
  // Pontual = um lançamento; Modular = um lançamento por mês com valores diferentes.
  receitasAvulsas?: ReceitaAvulsa[]
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
  statusToken?: string // token do link público de status (sem login)
  // Permissoes do portal do cliente (role 'cliente'). Flag ausente/undefined = liberado (default tudo-ligado).
  permissoes?: PermissoesCliente
  // Passagem de bastao (Closer -> Gestor) gravada na conversao Ganho->Cliente do CRM
  handoffVendas?: string
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
  // Playbook operacional da marca (regras de OPERACAO por cliente), curado por humano
  playbook?: BrandPlaybook
  // Token do link público ÚNICO de aprovação (todos os materiais aguardando do cliente)
  aprovacaoToken?: string
  // Referências visuais da marca (URLs no Blob) — legado (string[]); use assetsMarca.
  referenciasVisuais?: string[]
  // Ativos da marca por categoria (logo, fotos, elementos, ícones, prints) — Studio
  assetsMarca?: AssetMarca[]
  // Token do link público de NPS (pesquisa de satisfação)
  npsToken?: string
  // Squad do cliente: e-mails dos colaboradores responsáveis por atendê-lo.
  // Usado como responsável padrão sugerido ao criar tarefas do cliente.
  squad?: string[]
  // Fontes da marca (arquivos .ttf/.otf/.woff2 no Blob) — o motor de criativos
  // embute via @font-face para a arte sair na TIPOGRAFIA real do cliente.
  fontes?: FonteMarca[]
  // "Vibe" visual da marca — guia o motor de criativos (layout, fundo, tom).
  style?: EstiloMarca
  // Módulos contratados (plano modular): { moduloKey: { ativo, valor, desde } }.
  // Núcleo (entregas/aprovacoes/solicitar) é sempre liberado; add-ons por aqui.
  modulos?: Record<string, { ativo?: boolean; valor?: number; desde?: string }>
  // Suspensão por inadimplência: bloqueia o acesso do cliente ao portal.
  inadimplente?: boolean
  suspensoDesde?: string
  // Cobrança recorrente (Stripe). Vinculados server-side pela cobrança/webhook.
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  assinaturaStatus?: string // active | past_due | canceled | ...
}

// Resposta de NPS (0-10 + comentário). Chaves: set `nps`, `nps:{id}`, `cliente:{id}:nps`.
export type NpsResposta = {
  id: string
  clienteId: string
  score: number // 0-10
  comentario?: string
  periodo?: 'mensal' | 'trimestral'
  criadoEm: string
}

// Playbook operacional da marca — camada de conhecimento IA-First. Diferente do Brand Board
// (identidade) e do documentoMarca (referencia editorial gerada por IA): aqui ficam as REGRAS
// DE OPERACAO por cliente (o que funciona, restricoes, do's & don'ts, padrao de copy).
// Curado por HUMANO, com apoio de IA (destilacao de documentos enviados). `aprovado` marca
// que a curadoria humana foi concluida (supervisao humana no loop).
export type BrandPlaybook = {
  posicionamento?: string        // promessa central / como a marca se posiciona
  padraoCopy?: string            // estrutura e padrao de copy que funciona
  criativosQueFuncionam?: string // formatos/criativos que performam
  fazer?: string                 // do's — sempre fazer
  naoFazer?: string              // don'ts — nunca fazer
  restricoes?: string            // restricoes (legais, de marca, compliance)
  observacoes?: string           // outras notas
  aprovado?: boolean             // curadoria humana concluida
  origemUltimaEdicao?: 'manual' | 'ia' // de onde veio a ultima versao
  atualizadoEm?: string
  atualizadoPor?: string
}

// Ativo visual da marca (logo, foto, elemento, ícone, print). Alimenta a direção
// de arte da IA no Studio — ela "olha" essas imagens p/ reconhecer fonte/logo/cores.
export type CategoriaAsset = 'logo' | 'foto' | 'elemento' | 'icone' | 'print' | 'outro'
export type AssetMarca = {
  id: string
  url: string
  categoria: CategoriaAsset
  nome?: string
  criadoEm?: string
}

// Fonte da marca (arquivo no Blob). `papel` diz onde usar: 'titulo' (display,
// headlines) ou 'texto' (corpo). O motor de criativos embute via @font-face.
export type FonteMarca = {
  id: string
  nome: string // nome da família (ex.: "Montserrat")
  url: string
  papel?: 'titulo' | 'texto'
  peso?: number // 400 | 600 | 700...
  italico?: boolean
  criadoEm?: string
}

// "Vibe" visual da marca — atalho de direção de arte para o motor de criativos.
export type EstiloMarca = 'minimalista' | 'premium' | 'energetico' | 'clean' | 'elegante' | 'moderno' | 'classico' | 'divertido'

// Permissoes do portal do cliente. Cada flag controla um acesso/acao.
// Ausente (undefined) = liberado, para nao alterar clientes ja existentes.
export type PermissoesCliente = {
  entregas?: boolean   // ve a aba Entregas
  aprovacoes?: boolean // ve a aba Aprovacoes
  aprovar?: boolean    // pode aprovar/reprovar (vs so visualizar)
  solicitar?: boolean  // ve Solicitar conteudo
  esteira?: boolean    // ve a Esteira
  planner?: boolean    // ve o Planner
}

// Helper: a permissao esta liberada? (undefined/ausente = liberado)
export function podeCliente(permissoes: PermissoesCliente | undefined, chave: keyof PermissoesCliente): boolean {
  return permissoes?.[chave] !== false
}

export type ConfigAgencia = {
  nomeAgencia: string
  emailContato?: string
  logo?: string
  corPrimaria?: string
  corSecundaria?: string
  atualizadoEm?: string
  // Pessoas e Cultura — personalizacao da pagina publica "Trabalhe conosco"
  recrutamentoLogo?: string
  recrutamentoTitulo?: string
  recrutamentoSubtitulo?: string
  recrutamentoDescricao?: string
  recrutamentoMensagemFinalTitulo?: string
  recrutamentoMensagemFinal?: string
  recrutamentoVagas?: string[] // vagas/oportunidades selecionaveis pelo candidato (dropdown)
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
  | 'entrega_atrasada'
  | 'contrato_renovacao'
  | 'briefing_solicitado'
  | 'candidatura'
  // Vendas (CRM) — unicos tipos que aparecem no Inbox do papel 'vendas'
  | 'crm_followup'
  | 'crm_lead'
  | 'crm_reuniao'
  | 'crm_briefing'
  | 'geral'

export type Notificacao = {
  id: string
  destinatarioEmail: string
  tipo: TipoNotificacao
  titulo: string
  mensagem: string
  postId?: string
  tarefaId?: string // destino: abre a tarefa em modal ao clicar na notificacao
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
export type TarefaTipo = 'tarefa' | 'carrossel' | 'criativo' | 'ecommerce' | 'estrategia' | 'landing_page' | 'planejamento' | 'post' | 'reel' | 'story' | 'video' | 'briefing' | 'copy' | 'campanha'
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
  marcoId?: string // etapa do Playbook a que a tarefa pertence
  tarefaPaiId?: string // tarefa-mãe (subtarefa = filha de outra tarefa)
  prazo?: string // ISO date
  recorrencia?: 'diaria' | 'semanal' | 'quinzenal' | 'mensal' // ao concluir, gera a próxima ocorrência
  anexos?: { nome: string; url: string; tipo: string }[]
  atividades?: TarefaAtividade[]
  comentarios?: TarefaComentario[]
  apontamentos?: Apontamento[] // horas trabalhadas (apontamento de tempo)
  checklist?: { id: string; texto: string; feito: boolean }[] // Definition of Done por tipo
  origemPostId?: string // pauta da Esteira que originou esta tarefa (vinculo)
  origemBriefingId?: string // briefing de campanha que originou esta tarefa (vinculo)
  documentoId?: string // documento interno vinculado à tarefa
  mapaId?: string // mapa mental vinculado à tarefa
  relacionadas?: string[] // ids de outras tarefas relacionadas (vinculo bidirecional manual)
  criadoPor: string
  criadoEm: string
  atualizadoEm: string
  concluidoEm?: string
}

// Modelos de projeto reutilizáveis (geram marcos do Playbook + tarefas num clique)
export type TemplateMarco = { titulo: string; categoria: string; descricao?: string; diasDuracao?: number }
export type TemplateTarefa = { titulo: string; tipo?: string; prioridade?: string; marcoIndice?: number }
export type TemplateProjeto = {
  id: string
  nome: string
  descricao?: string
  marcos: TemplateMarco[]
  tarefas: TemplateTarefa[]
  criadoPor?: string
  criadoEm: string
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

// Candidatura (Trabalhe conosco) — formulario publico, visivel so para admin
export type CandidaturaStatus = 'nova' | 'em_analise' | 'aprovada' | 'reprovada'
export type Candidatura = {
  id: string
  nome: string
  email: string
  telefone?: string
  vaga?: string
  mensagem?: string
  curriculoUrl?: string
  curriculoNome?: string
  status: CandidaturaStatus
  criadoEm: string
}

// Briefing de campanha (gerado/refinado com IA a partir do Brand Board)
export type BriefingCampanha = {
  id: string
  clienteId: string
  clienteNome: string
  titulo: string
  marcoId?: string // etapa do Playbook a que a campanha pertence
  objetivo: string // vendas, leads, alcance, engajamento, trafego, reconhecimento
  plataformas: string[] // ['meta', 'google', 'tiktok', ...]
  verba?: string
  periodo?: string
  publico?: string
  oferta?: string
  observacoes?: string
  conteudo: string // o briefing completo (Markdown), gerado/editado
  tarefaId?: string // tarefa (tipo campanha) vinculada a este briefing
  criadoPor: string
  criadoEm: string
  atualizadoEm: string
}

export type PostStatus ='rascunho' | 'agendado' | 'aguardando_aprovacao' | 'aprovado' | 'corrigir' | 'reprovado' | 'publicando' | 'publicado' | 'falha_publicacao'

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
  marcoId?: string // etapa do Playbook a que o post pertence
  imagens: string[]
  legenda: string
  status: PostStatus
  formato?: 'feed' | 'reel' | 'story'
  dataAgendada?: string
  codigo?: string
  criadoPor: string
  criadoEm: string
  atualizadoEm: string
  anotacoes?: any[] // marcações do cliente; cada item pode ter { resolvido?: boolean }
  motivoReprovacao?: string
  motivoResolvido?: boolean // marca o texto geral do ajuste como resolvido pela equipe
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
  etapaDesde?: string // ISO — quando a pauta entrou na etapa atual (cycle-time/aging)
  preAprovado?: boolean // conteúdo recorrente pré-aprovado pelo cliente (dispensa aprovação)
  tarefaId?: string // tarefa criada a partir desta pauta da Esteira (vinculo)
  // Studio Fase 0 — matéria-prima da IA e medição da taxa de edição
  iaGerado?: {
    briefing?: string
    sugestaoImagem?: string
    textoImagem?: string
    legenda?: string
    formato?: 'feed' | 'reel' | 'story'
    geradoEm: string
  } // snapshot do que a IA gerou (para comparar com a edição humana)
  editadoAposIA?: boolean // humano alterou briefing/copy/criativo depois da geração
  criativoGerado?: boolean // a imagem foi gerada pelo motor de criativos do Studio (template/IA)
  // "Receita" do criativo gerado — permite reabrir no editor e re-renderizar/refinar
  criativoData?: {
    template: string
    headline?: string
    subheadline?: string
    bullets?: string[]
    rodape?: string
    corFundo?: string
    corAccent?: string
    fundoUrl?: string
    logoUrl?: string
    handle?: string
    // Brief rico (motor novo) — campos de copy de anúncio de verdade
    objetivo?: string // ver lib/criativoObjetivos.ts (venda|lead|institucional|...)
    cta?: string // chamada para ação curta (ex.: "Agende agora")
    oferta?: string // texto da oferta/promoção (ex.: "20% OFF até sexta")
    preco?: string // preço em destaque (ex.: "R$ 97/mês")
    dataEvento?: string // data por extenso na arte (ex.: "12 de agosto")
    horaEvento?: string
    localEvento?: string
    legal?: string // letras miúdas (condições, CRM/CRO, etc.)
    whatsapp?: string // número/link exibido na arte
    // HTML autocontido gerado pelo motor novo (Claude desenha) — re-render determinístico
    html?: string
  }
}

// ===== CRM de vendas (SDR/Closer) =====
// Estágio do funil (configurável). Chaves: crm:estagios (array), índices crm:negocios, crm:contatos.
// Pipeline (funil) — agrupa etapas. Permite vários funis (ex.: Marketing, +Clínicas, Mentoria).
export type CrmPipeline = { id: string; nome: string; ordem: number }
export type CrmEstagio = { id: string; nome: string; ordem: number; ganho?: boolean; perdido?: boolean; pipelineId?: string }

// Empresa/conta — agrupa contatos e negócios
export type CrmEmpresa = {
  id: string
  nome: string
  segmento?: string
  site?: string
  instagram?: string
  telefone?: string
  observacoes?: string
  criadoPor: string
  criadoEm: string
  atualizadoEm: string
}

export type CrmContato = {
  id: string
  nome: string
  email?: string
  telefone?: string // WhatsApp — preparado para a integração oficial futura
  empresa?: string
  empresaId?: string // vínculo com a entidade Empresa
  profissionalAutonomo?: boolean // PF sem empresa (autônomo) — dispensa vínculo com Empresa
  areaAtuacao?: string // área/segmento de atuação do contato
  cargo?: string
  observacoes?: string
  criadoPor: string
  criadoEm: string
  atualizadoEm: string
}

export type CrmAtividade = {
  id: string
  tipo: 'criacao' | 'nota' | 'ligacao' | 'email' | 'reuniao' | 'whatsapp' | 'estagio' | 'ganho' | 'perdido'
  texto: string
  autor: string
  criadoEm: string
}

// Agendamento/cadência de contato com o lead (mensagem, ligação, reunião…)
export type CrmAgendamento = {
  id: string
  quando: string // YYYY-MM-DD — data prevista do toque
  canal: 'whatsapp' | 'ligacao' | 'email' | 'reuniao' | 'outro'
  titulo: string
  nota?: string
  feito?: boolean
  criadoEm: string
}

// Passagem de bastão Closer -> Gestor de Projetos (quanto mais detalhe, melhor o onboarding)
export type CrmHandoff = {
  escopoVendido?: string
  expectativas?: string
  detalhes?: string
  observacoes?: string
}

export type CrmNegocioStatus = 'aberto' | 'ganho' | 'perdido'
export type CrmNegocio = {
  id: string
  titulo: string
  valor?: number
  estagioId: string
  pipelineId?: string // funil ao qual o negócio pertence (ausente = pipeline padrão)
  status: CrmNegocioStatus
  dono?: string // e-mail do responsável (SDR/closer)
  donoNome?: string
  contatoId?: string
  empresaId?: string // vínculo com a entidade Empresa
  origem?: string
  probabilidade?: number
  previsaoFechamento?: string // ISO date
  proximoFollowUp?: string // ISO date — lembrete do próximo contato (cron avisa o dono)
  // Qualificação da oportunidade (quanto mais rico, melhor a venda e o handoff)
  empresa?: string
  segmento?: string
  faturamentoEstimado?: string // faixa em texto (ex.: "R$ 50-100k/mês")
  instagram?: string // @ ou site da empresa
  dores?: string // principais dores/desafios do prospect
  solucoes?: string // possíveis soluções / o que oferecer
  motivoPerdido?: string
  descricao?: string
  handoff?: CrmHandoff
  templateId?: string // modelo de entregas aplicado na conversão
  clienteId?: string // cliente criado ao ganhar
  agendamentos?: CrmAgendamento[] // cadência de toques agendados (lembretes via cron)
  atividades?: CrmAtividade[]
  criadoPor: string
  criadoEm: string
  atualizadoEm: string
}

// Mapa mental (nós + conexões). Chave `mapa:{id}`, índice `mapas`.
export type MapaNo = { id: string; texto: string; x: number; y: number; cor?: string; colapsado?: boolean }
export type MapaConexao = { id: string; de: string; para: string }
export type MapaMental = {
  id: string
  titulo: string
  nos: MapaNo[]
  conexoes: MapaConexao[]
  layout?: 'mapa' | 'organograma' | 'lista'
  clienteId?: string // atribuído a um cliente (fixa a logomarca no editor)
  clienteNome?: string
  criadoPor?: string
  criadoEm: string
  atualizadoEm: string
}

// Documento interno (tipo Google Docs da equipe). Chave `documento:{id}`, índice `documentos`.
export type Documento = {
  id: string
  titulo: string
  conteudo: string // HTML (RichText)
  token?: string // link público de leitura (compartilhar externamente)
  clienteId?: string // atribuído a um cliente (fixa a logomarca no editor)
  clienteNome?: string
  fontSize?: number // tamanho base da fonte do documento (conforto de leitura)
  criadoPor?: string
  criadoPorNome?: string
  atualizadoPorNome?: string
  criadoEm: string
  atualizadoEm: string
}

// Agente de IA treinado (Fase 1: persona + ferramentas de LEITURA). Chave `agente:{id}`, índice `agentes`.
export type Agente = {
  id: string
  nome: string
  funcao?: string        // ex.: Copywriter, Gestor de Projetos, SDR
  descricao?: string     // resumo curto exibido na lista
  instrucoes: string     // "treino" — persona + regras (vai no system prompt do agente)
  ferramentas: string[]  // nomes das ferramentas habilitadas (consultar_tarefas, web_search, etc.)
  conhecimento?: AgenteConhecimento[] // base de conhecimento (documentos com texto extraido)
  cor?: string           // cor do avatar
  ativo: boolean
  criadoPor?: string
  criadoEm: string
  atualizadoEm: string
}

// Documento da base de conhecimento de um agente: o arquivo (Blob) + o texto ja
// extraido (PDF/imagem via Claude, DOCX via mammoth), injetado no system prompt.
export type AgenteConhecimento = {
  nome: string
  url: string
  tipo: string   // extensao (pdf, docx, png...)
  texto: string  // conteudo extraido
  em: string
}
