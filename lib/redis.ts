import { Redis } from '@upstash/redis'
import type { LayoutVeiculo } from './layoutVeiculo'

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
  areaSaude?: string // clínicas: área de atuação (estética/dermato/nutrição…) do profissional que recebe pacientes.
  corAgenda?: string // clínicas: cor do profissional na Agenda (hex)
  recebeAgenda?: boolean // clínicas: Sim = profissional agendável (recebe pacientes na Agenda); Não = gestão/comercial (usa a agenda, mas não aparece como profissional). Ausente = infere pela areaSaude (retrocompat).
  tipoTurismo?: 'equipe' | 'motorista' | 'guia' | 'parceiro' // turismo: papel na operação (motorista fica selecionável nas Viagens)
  cnh?: string // turismo: nº da CNH (usado quando tipoTurismo = motorista)
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
  // Varejo multi-loja (perfil telefonia): vincula o usuário a UMA loja. Operador
  // (usuario/vendas) com lojaId = travado nela (isolamento entre unidades). Admin
  // e gerente SEM lojaId veem todas (gestor da rede); gerente COM lojaId = gerente
  // de uma unidade só. A regra vive em lib/escopoLoja.ts — o lojaId do operador
  // vem SEMPRE do token, nunca do request. Ausente em quem não é admin/gerente = bloqueado.
  lojaId?: string
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
  // Lançamento GERADO da venda de uma viagem (turismo): parcela ou pagamento da
  // reserva. A rota /api/reservas cria/atualiza/remove junto com a reserva —
  // a tela mostra a origem e não deixa apagar à mão (apagaria só a cópia).
  reservaId?: string
  // Idem para a assessoria de cidadania: parcela/pagamento do contrato de um
  // Processo. A rota /api/processos mantém em sincronia (lancamentosProcesso).
  processoId?: string
  // Varejo (telefonia): entrada gerada por uma venda do PDV. lojaId = caixa da
  // unidade. A rota /api/vendas cria junto; id determinístico (venda-{id}).
  vendaId?: string
  lojaId?: string
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
  // Perfis ADICIONAIS (cliente com filiais: 3 lojas = 3 Instagram). Os campos
  // acima seguem valendo como "conta principal" — nada foi migrado. Quem lê
  // qualquer conta usa lib/contasSociais, nunca os campos direto.
  contas?: import('./contasSociais').ContaSocial[]
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
  // Papéis do squad (designer, gestor de projetos, da operação e de tráfego).
  // NÃO substituem `squad`: quem ocupa papel entra na lista ao salvar (o
  // servidor faz a união em /api/clientes). Ver lib/squadPapeis.
  squadPapeis?: import('./squadPapeis').SquadPapeis
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

// Agendamento (módulo Agenda — clínicas/serviços). Chaves: `agendamento:{id}`,
// set `agendamentos`. Status flui: agendado -> confirmado -> atendido | faltou | cancelado.
export type AgendamentoStatus = 'agendado' | 'confirmado' | 'atendido' | 'faltou' | 'cancelado'
export type Agendamento = {
  id: string
  pacienteNome: string
  pacienteTelefone?: string
  contatoId?: string // vínculo com o cadastro do paciente (CrmContato) — perfil clínica
  profissionalEmail: string
  profissionalNome: string
  servico?: string
  dataInicio: string // ISO
  duracaoMin: number
  status: AgendamentoStatus
  observacoes?: string
  queixaPrincipal?: string // motivo da consulta relatado pelo paciente (clínicas)
  registroAtendimento?: string // evolução/prontuário simples escrito ao atender (dado de saúde — só no banco isolado da clínica)
  procedimentosRealizados?: string[] // clínicas: o que a paciente realizou neste atendimento (nomes do catálogo de procedimentos)
  valorInvestido?: number // clínicas: quanto a paciente investiu neste atendimento (R$)
  criadoEm: string
  criadoPor?: string
}

// Reunião interna (Pessoas e Cultura): pauta antes, ata depois, decisões que
// viram Tarefas. Chaves: `reuniao:{id}`, set `reunioes`.
export type ReuniaoDecisao = {
  id: string
  texto: string
  responsavelEmail?: string
  responsavelNome?: string
  prazo?: string // ISO date
  tarefaId?: string // preenchido quando a decisão vira tarefa
}
export type Reuniao = {
  id: string
  titulo: string
  data: string // ISO — quando a reunião acontece(u)
  participantes?: string
  pauta?: string // o que será discutido (antes da reunião)
  ata?: string // registro do que foi discutido/decidido
  decisoes?: ReuniaoDecisao[]
  status: 'agendada' | 'realizada'
  criadoPor?: string
  criadoEm: string
  atualizadoEm?: string
}

// Lista de espera da Agenda (clínicas): quem quer horário mas ainda não tem.
// Chaves: `espera:{id}`, set `esperas`. Vira agendamento pelo modal (e sai da lista).
export type EsperaItem = {
  id: string
  pacienteNome: string
  pacienteTelefone?: string
  contatoId?: string
  servico?: string
  profissionalEmail?: string // preferência (opcional)
  observacoes?: string
  criadoEm: string
  criadoPor?: string
}

// ── Turismo (operadora de viagens rodoviárias) ─────────────────────────────────────────
// FROTA. Chaves: `veiculo:{id}`, set `veiculos`. Cada veículo carrega o PRÓPRIO
// croqui (`layout`) — antes era um preset fixo no código (`layoutId`), e cadastrar
// veículo novo exigia deploy. Amenidades: Starlink/Wi-Fi/ar/banheiro…
export type TipoVeiculo = 'onibus' | 'micro' | 'van' | 'carro'
// 'excluido' = exclusão SUAVE: some dos seletores mas preserva o histórico das
// viagens/reservas que já apontam para ele.
export type CondicaoVeiculo = 'disponivel' | 'ocupado' | 'manutencao' | 'excluido'

// Serviço na ficha de manutenção. `proximaData`/`proximoKm` alimentam o alerta de
// revisão (vira Tarefa no cron).
export type ManutencaoVeiculo = {
  id: string
  data: string // YYYY-MM-DD
  tipo: 'preventiva' | 'corretiva' | 'revisao' | 'pneu' | 'oleo' | 'outro'
  km?: number
  oficina?: string
  custo?: number
  descricao?: string
  proximaData?: string // YYYY-MM-DD — próxima revisão prevista
  proximoKm?: number
  criadoPor?: string
  criadoEm: string
}

// Documento com validade (licenciamento/seguro/ANTT) — vencimento vira alerta.
export type DocumentoVeiculo = {
  id: string
  tipo: 'licenciamento' | 'seguro' | 'antt' | 'outro'
  numero?: string
  vencimento: string // YYYY-MM-DD
  observacoes?: string
}

export type Veiculo = {
  id: string
  nome: string // ex.: "DD 01 - Prata"
  tipo?: TipoVeiculo
  placa?: string
  layout: LayoutVeiculo // croqui próprio; a CAPACIDADE é contada dele (nunca persistida, p/ não divergir)
  condicao: CondicaoVeiculo
  amenidades?: string[]
  manutencoes?: ManutencaoVeiculo[]
  documentos?: DocumentoVeiculo[]
  observacoes?: string
  criadoPor?: string
  criadoEm: string
  atualizadoEm: string
}

// VIAGEM (uma saída): roteiro, datas, veículo, motoristas, valor e inclusos.
// Chaves: `viagem:{id}`, set `viagens`. Vagas derivam do croqui do veículo.
//
// Dois negócios diferentes convivem aqui (`tipo`):
//  - 'pacote'     → a operadora vende POLTRONA a poltrona. Valor POR CLIENTE
//                   (`valorPacote` × passageiros). Tem mapa de poltronas.
//  - 'fretamento' → alguém contrata o veículo INTEIRO por um preço fechado
//                   (`valorFechado`), não × passageiro. Sem venda de poltrona.
// Errar isso cobra 40× o valor de um fretamento — ver lib/pacoteViagem.ts.
export type MotoristaViagem = { nome: string; cpf?: string; cnh?: string; email?: string } // email = vínculo com o colaborador cadastrado (tipoTurismo=motorista)
export type StatusViagem = 'planejada' | 'aberta' | 'realizada' | 'cancelada'
export type TipoViagem = 'pacote' | 'fretamento'
// Parada do itinerário (timeline dia-a-dia da viagem, dentro de dataIda..dataVolta).
export type ParadaRoteiro = {
  id: string
  data: string        // YYYY-MM-DD
  hora?: string       // HH:MM
  titulo: string
  local?: string
  tipo?: string       // embarque/passeio/refeicao/hospedagem/translado/livre
  observacoes?: string
}
export type Viagem = {
  id: string
  titulo: string
  tipo: TipoViagem
  pacoteId?: string    // só em tipo='pacote': de qual modelo NASCEU (a viagem COPIA;
                       // mexer no pacote depois não reescreve viagem já vendida)
  roteiro?: string
  // Muda o que a LISTA de passageiros exige: nacional = CPF/RG; internacional =
  // passaporte + validade + nacionalidade. Ver lib/manifesto.ts.
  internacional?: boolean
  dataIda: string      // YYYY-MM-DD
  dataVolta?: string   // YYYY-MM-DD
  horaSaida?: string   // HH:MM — horário de saída
  horaRetorno?: string // HH:MM — horário previsto de retorno
  veiculoId?: string
  // CÓPIA do croqui do veículo no momento em que a viagem foi montada. Não é
  // cache: é o mapa que o passageiro comprou. A viagem NUNCA lê o croqui do
  // veículo ao vivo — reformar um carro mudaria o mapa de quem já comprou, e um
  // dia a poltrona 43 sumiria sem ninguém entender por quê.
  layoutSnap?: LayoutVeiculo
  motoristas?: MotoristaViagem[]
  valorPacote: number  // tipo='pacote': À VISTA, por cliente ADULTO
  precos?: PrecosViagem // criança/meia, entrada, parcelamento, formas aceitas
  hoteis?: HotelPacote[] // herdados do pacote (check-in/out em dia relativo)
  valorFechado?: number // tipo='fretamento': valor da viagem inteira
  contratante?: string  // tipo='fretamento': quem contratou o veículo
  descontoPadrao?: number
  inclusos?: string[]
  despesas?: DespesaViagem[]  // despesas previstas → break-even da viagem (lib/precificacaoViagem)
  paradas?: ParadaRoteiro[]   // itinerário dia-a-dia (timeline)
  status: StatusViagem
  observacoes?: string
  criadoPor?: string
  criadoEm: string
  atualizadoEm: string
}

// PACOTE DE VIAGEM — modelo reutilizável ("Foz do Iguaçu 3 dias" sai 5x no ano).
// Chaves: `pacoteviagem:{id}`, set `pacotesviagem`.
//
// ⚠️ NÃO confundir com `Pacote` de lib/pacotes.ts — aquele é pacote de TRATAMENTO
// da clínica (sessões/saldo), outro negócio inteiramente. Os dois nunca aparecem
// juntos porque as abas são gated por perfil de instância.
//
// A Viagem COPIA o pacote (não lê dele em tempo real): corrigir o preço de um
// pacote não pode reescrever viagem já vendida.
//
// O roteiro do modelo usa DIA RELATIVO (1 = dia da ida), não data absoluta — é o
// que deixa o mesmo pacote servir julho e dezembro. `lib/pacoteViagem.ts` converte
// em datas reais na hora de criar a viagem.
export type ParadaModelo = {
  id: string
  dia: number         // 1 = dia da ida, 2 = ida+1…
  hora?: string       // HH:MM
  titulo: string
  local?: string
  tipo?: string       // embarque/passeio/refeicao/hospedagem/translado/livre
  observacoes?: string
}

// Hotel previsto no pacote. Check-in/out em DIA RELATIVO, igual ao roteiro — vira
// data real junto com a viagem. Na fase 4 ganha vínculo com o cadastro de Hotéis.
export type HotelPacote = {
  id: string
  nome: string
  checkinDia?: number    // 1 = dia da ida
  checkinHora?: string   // HH:MM
  checkoutDia?: number
  checkoutHora?: string
}

export type FormaPagamento = 'pix' | 'cartao' | 'boleto' | 'dinheiro' | 'transferencia'

// Despesa prevista da viagem (combustível, pedágio, hotel do motorista…).
// OPCIONAL de propósito — serve para o break-even (lib/precificacaoViagem), não
// é contabilidade. Compartilhada entre PacoteViagem (planejamento) e Viagem
// (a saída real, que copia e ajusta).
export type DespesaViagem = {
  id: string
  descricao: string
  valor: number
}

// TABELA de preço do produto: o valor FECHADO por faixa (adulto/criança/meia) +
// os meios que a operadora aceita. Compartilhado entre PacoteViagem (o modelo) e
// Viagem (a saída real, que copia). `valorBase`/`valorPacote` = adulto.
//
// ⚠️ Entrada, sinal e parcelamento NÃO moram aqui: são NEGOCIAÇÃO, variam por
// cliente ou família e vivem em `Reserva.financeiro` (lib/financeiroReserva), que
// é por contratante. Guardar aqui daria a impressão de que o parcelamento é do
// produto — e aí duas famílias na mesma viagem não poderiam ter acordos diferentes.
export type PrecosViagem = {
  valorCrianca?: number
  valorMeia?: number
  formasAceitas?: FormaPagamento[]
}

export type PacoteViagem = {
  id: string
  nome: string
  destino?: string
  // Datas de REFERÊNCIA (uma saída típica): servem para preencher naturalmente e
  // para o sistema CALCULAR dias/noites. O pacote segue reutilizável — o roteiro é
  // guardado em dia relativo e a viagem escolhe a data real dela.
  dataIdaRef?: string    // YYYY-MM-DD
  dataVoltaRef?: string  // YYYY-MM-DD
  horaSaida?: string     // HH:MM
  horaRetorno?: string   // HH:MM
  dias?: number          // CALCULADO das datas de referência (ida conta como dia 1)
  noites?: number        // CALCULADO
  valorBase: number      // À VISTA, por cliente adulto — a viagem pode ajustar
  precos?: PrecosViagem
  inclusos?: string[]
  roteiroPadrao?: ParadaModelo[]
  hoteis?: HotelPacote[]
  // Precificação (opcional): despesas previstas + passageiros previstos dão o
  // break-even e os preços mínimo/aceitável/ideal — lib/precificacaoViagem.
  despesas?: DespesaViagem[]
  passageirosPrevistos?: number
  margemAceitavel?: number // %, sobre o custo por passageiro (padrão da tela: 20)
  margemIdeal?: number     // %, idem (padrão da tela: 35)
  observacoes?: string
  ativo?: boolean     // ausente = ativo
  criadoPor?: string
  criadoEm: string
  atualizadoEm: string
}

// PROCESSO DE CIDADANIA (assessoria) — o caso de uma família rumo à cidadania
// estrangeira por descendência. Chaves: `processo:{id}`, set `processos`.
// O funil COMERCIAL (lead → contrato) vive no CRM; aqui é a ENTREGA pós-venda:
// da viabilidade ao deferimento. As ETAPAS e a matemática de progresso vivem em
// lib/processoCidadania.ts (puro, testado) — o tipo EtapaProcesso é reexportado
// de lá; não repetir a lista aqui.
export type { EtapaProcesso } from './processoCidadania'
// Linhagem (árvore genealógica) — o tipo vive na lib pura; aqui só reexporta.
export type { PessoaLinhagem } from './linhagem'
export type StatusProcesso = 'ativo' | 'pausado' | 'concluido' | 'arquivado'
export type Processo = {
  id: string
  titulo: string             // nome da família / caso — ex.: "Família Muller"
  clienteId?: string         // CrmContato pagante (responsável pelo contrato)
  paisAlvo: string           // 'Luxemburgo' por padrão; genérico p/ outros países
  ascendente?: string        // nome do ascendente estrangeiro (raiz da linhagem)
  requerentes?: string[]     // ids de CrmContato com selo tipo:'requerente'
  linhagem?: import('./linhagem').PessoaLinhagem[] // prova de descendência (cadeia até o ascendente)
  etapa: import('./processoCidadania').EtapaProcesso
  status: StatusProcesso
  responsavelEmail?: string  // membro da equipe dono da carteira do caso
  numeroProcesso?: string    // protocolo/nº no órgão estrangeiro, quando houver
  valorContrato?: number     // valor fechado do contrato (total do parcelamento)
  // COBRANÇA do contrato: parcelas, vencimentos e pagamentos. O motor é o mesmo
  // do turismo (lib/financeiroContrato) — parcela e saldo não têm nicho. Vira
  // lançamento no Financeiro via lib/lancamentosProcesso, com id determinístico.
  financeiro?: import('./financeiroContrato').FinanceiroContrato
  prazoEstimado?: string     // YYYY-MM-DD — previsão de conclusão (opcional)
  observacoes?: string
  criadoPor?: string
  criadoEm: string
  atualizadoEm: string
}

// ─── VAREJO (perfil telefonia) ───────────────────────────────────────────────
// Multi-loja DENTRO de uma instância. `lojaId` nasce NATIVO aqui (módulo novo),
// não é o retrofit de tenant no CRM/Financeiro global. Ver plano Space Technology.

// Loja/filial. Lista em `config:lojas` (array), padrão de config:contasBancarias.
export type Loja = {
  id: string
  nome: string
  codigo?: string      // código curto/identificador da unidade (ex.: '01', 'MATRIZ')
  endereco?: string
  telefone?: string
  cnpj?: string
  ativa?: boolean
  // WhatsApp por loja (telefonia): nome da instância Evolution DESTA loja no host
  // compartilhado (ex.: 'space-santoangelo'). Cada loja pareia o seu número; o
  // webhook roteia o que chega por esta instância. Ver lib/whatsapp instanciaDaLoja.
  evolutionInstance?: string
  criadoEm?: string
}

// Produto do catálogo — COMPARTILHADO entre as lojas (mesmo SKU em todas). O
// SALDO é por loja e vive fora daqui (chave `estoque:{lojaId}:{produtoId}`,
// número, baixado com DECRBY atômico na venda). Molde: PacoteViagem (tabela de
// preço no modelo, sem estoque). Chaves: `produto:{id}` + set `produtos`.
export type CategoriaProduto = 'smartphone' | 'eletronico' | 'acessorio' | 'outro'
export type Produto = {
  id: string
  nome: string
  lojaId?: string           // varejo multi-loja: a loja DONA do produto (catálogo por loja). Ausente = legado/sem loja.
  marca?: string            // fabricante (agrupa a listagem)
  modelo?: string           // modelo do produto
  codigo?: string           // código interno da loja (distinto do SKU/código de barras)
  sku?: string
  categoria: CategoriaProduto
  precoVenda: number
  precoCusto?: number       // custo de aquisição (margem, não exibido ao cliente)
  estoqueMinimo?: number    // alerta "abaixo do mínimo" por loja
  ativo?: boolean
  descricao?: string
  criadoPor?: string
  criadoEm: string
  atualizadoEm: string
}

// Movimentação de estoque (log/auditoria; o saldo vivo é a chave numérica).
// entrada (compra), saida (venda/perda), transferencia (entre lojas), ajuste.
// Chaves: `movestoque:{id}` + set `movestoque`.
export type TipoMovEstoque = 'entrada' | 'saida' | 'transferencia' | 'ajuste'
export type MovimentacaoEstoque = {
  id: string
  produtoId: string
  lojaId: string            // loja afetada (na transferência: destino leva outra mov com sinal oposto na origem)
  lojaDestinoId?: string    // preenchido nas transferências (a origem é lojaId)
  tipo: TipoMovEstoque
  quantidade: number        // sempre positiva; o `tipo` diz a direção
  motivo?: string
  vendaId?: string          // baixa originada de uma venda
  criadoPor?: string
  criadoEm: string
}

// Venda (PDV) — vários itens, baixa no estoque, alimenta o financeiro da loja.
// O CrmNegocio tem valor ÚNICO e não modela carrinho — por isso é entidade nova.
// Chaves: `venda:{id}` + set `vendas`.
export type ItemVenda = {
  produtoId: string
  nome: string              // snapshot do nome no momento da venda
  quantidade: number
  precoUnit: number         // snapshot do preço (corrigir o produto não reescreve venda feita)
}
// Formas do PDV do varejo — diferem das do turismo (débito/crédito/outro no lugar
// de cartão/transferência), por isso é um tipo próprio, não o FormaPagamento acima.
export type FormaPagamentoVenda = 'dinheiro' | 'pix' | 'debito' | 'credito' | 'boleto' | 'outro'
export type Venda = {
  id: string
  lojaId: string
  itens: ItemVenda[]
  desconto?: number
  total: number             // soma dos itens - desconto
  formaPagamento: FormaPagamentoVenda
  // Parcelamento opcional (crediário) — mesmo motor do turismo/cidadania. Sem
  // financeiro = à vista (uma entrada única no caixa da loja).
  financeiro?: import('./financeiroContrato').FinanceiroContrato
  contatoId?: string        // cliente da venda (CrmContato), opcional
  vendedor?: string
  data: string              // ISO
  nfe?: { numero?: string; chave?: string; status?: 'pendente' | 'emitida' | 'cancelada'; emitidaEm?: string } // Fase 5 (registrado, não usado ainda)
  // Cancelamento: a venda NÃO é apagada (auditoria) — vira cancelada, o estoque
  // volta (estorno) e a entrada do caixa é removida. Ver DELETE /api/vendas.
  cancelada?: boolean
  canceladaEm?: string
  canceladaPor?: string
  criadoPor?: string
  criadoEm: string
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
export type TarefaStatus = 'a_fazer' | 'em_andamento' | 'em_revisao' | 'concluido' | 'descartado'
export type TarefaPrioridade = 'baixa' | 'media' | 'alta' | 'urgente'
export type TarefaTipo = 'tarefa' | 'carrossel' | 'criativo' | 'ecommerce' | 'estrategia' | 'landing_page' | 'planejamento' | 'post' | 'reel' | 'story' | 'video' | 'briefing' | 'copy' | 'campanha'
  // Tipos do perfil clínica (catálogo em GestaoTarefas TIPOS_CLINICA)
  | 'confirmacao_agenda' | 'retorno_paciente' | 'followup_orcamento' | 'compras_estoque' | 'administrativo' | 'financeiro_clinica' | 'reuniao_interna'
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
// `duracao` + `unidade` (dias/semanas/meses/anos) é o formato atual; `diasDuracao`
// é o anterior, sempre em dias, e segue valendo nos modelos já salvos. Quem lê os
// dois é duracaoDaEtapa() em lib/aplicarModelo.
export type TemplateMarco = { titulo: string; categoria: string; descricao?: string; diasDuracao?: number; duracao?: number; unidade?: 'dias' | 'semanas' | 'meses' | 'anos'; responsavelEmail?: string }
export type TemplateTarefa = { titulo: string; tipo?: string; prioridade?: string; marcoIndice?: number; responsavelEmail?: string }
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
  tarefaId?: string // tarefa-mãe criada a partir deste plano (linha de montagem Studio > Tarefa > Planner)
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
  formato?: 'feed' | 'reel' | 'story' | 'carrossel' | 'grafico' // grafico = material impresso/aplicado (banner, revista, fachada...)
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
  // Perfis do cliente que recebem este post. Vazio/ausente = conta principal,
  // que é como todo post existente se comporta (lib/contasSociais.contasAlvo).
  contaIds?: string[]
  capasVideo?: Record<string, string> // URL do vídeo -> URL da capa (thumbnail) escolhida
  // Onde JÁ publicou com sucesso (anti-duplicação). Formato "contaId:rede"; a
  // marca antiga ("instagram" solto) segue valendo para a conta principal.
  redesPublicadas?: string[]
  midiaRemovida?: boolean // mídia já publicada e removida do Blob para liberar espaço
  thumbnail?: string // miniatura mantida após a limpeza (uma imagem leve por post)
  excluidoEm?: string // ISO — soft-delete: foi para a lixeira (posts_excluidos), some das views ativas
  excluidoPor?: string // quem mandou para a lixeira
  // Esteira de criativos
  planoId?: string // plano mensal a que a pauta pertence
  etapa?: EtapaCriativo // posição na esteira (ausente = post avulso, fora da esteira)
  briefing?: string // ideia/ângulo/objetivo da pauta
  // A FRASE da peça: vai no layout do criativo ou como texto principal do vídeo.
  // Toda pauta tem a sua — é o que prende o dedo antes de qualquer legenda.
  headline?: string
  subheadline?: string // apoio da headline na arte (opcional)
  sugestaoImagem?: string // descrição visual sugerida (opcional)
  textoImagem?: string // texto que deve aparecer na arte ("copy do criativo")
  cta?: string // chamada para ação NA ARTE (ex.: "Agende agora")
  sugestaoLegenda?: string // rascunho de legenda sugerido no briefing
  anexos?: { nome: string; url: string; tipo: string }[] // referências da pauta (mesmo shape de Tarefa.anexos)
  // Carrossel: a copy separada lâmina por lâmina, cada uma com seu anexo (referência da arte daquela lâmina)
  laminas?: { texto: string; anexo?: { nome: string; url: string; tipo: string } }[]
  // Material gráfico (formato 'grafico'): specs do material impresso/aplicado
  medidas?: string // ex.: "3m x 1m", "21x29,7cm"
  localAplicacao?: string // banner, revista, fachada, adesivo...
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
    headline?: string
    subheadline?: string
    sugestaoImagem?: string
    textoImagem?: string
    cta?: string
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
  cnpj?: string // opcional; guardado só com dígitos (a tela formata)
  segmento?: string
  site?: string
  instagram?: string
  telefone?: string
  observacoes?: string
  criadoPor: string
  criadoEm: string
  atualizadoEm: string
}

// Tipo do contato (perfil clínica trata 'paciente' como cadastro de pacientes;
// perfil cidadania marca 'requerente' quem vai obter a cidadania).
export type CrmContatoTipo = 'paciente' | 'profissional' | 'fornecedor' | 'lead' | 'outro' | 'requerente'

export type CrmContato = {
  id: string
  nome: string
  lojaId?: string // varejo multi-loja (telefonia): a que unidade o contato pertence (isolamento). Ausente nos outros perfis.
  email?: string
  telefone?: string // WhatsApp — preparado para a integração oficial futura
  empresa?: string
  empresaId?: string // vínculo com a entidade Empresa
  profissionalAutonomo?: boolean // PF sem empresa (autônomo) — dispensa vínculo com Empresa
  areaAtuacao?: string // área/segmento de atuação do contato
  cargo?: string
  tipo?: CrmContatoTipo // ausente = contato comum (compatível com a base existente)
  nascimento?: string // YYYY-MM-DD — aniversariantes do mês (clínicas)
  preferenciasViagem?: string // turismo: desejos e preferências (destinos dos sonhos, tipo de viagem…) — vira oportunidade futura
  sobrenomeLinhagem?: string // cidadania: família imigrante de origem (lista fechada — ver lib/sobrenomesLinhagem)
  // Clínica: o que a pessoa fez da última vez. Preenchido À MÃO porque a base
  // veio de outro sistema — o histórico da Agenda só existe para quem foi
  // atendido AQUI. `nuncaVeio` é a resposta honesta para lead que nunca sentou
  // na cadeira: sem ele, campo vazio é ambíguo (nunca veio × ninguém anotou).
  ultimoProcedimento?: string
  nuncaVeio?: boolean
  etiquetas?: string[]
  ativo?: boolean // ausente = ativo
  observacoes?: string
  historico?: ContatoInteracao[] // linha do tempo de nutrição (toques ao longo do ano)
  proximosPassos?: ProximoPasso[] // clínicas: jornada futura do paciente (o que fazer e quando) — cada passo vira Tarefa para a equipe
  ultimoContato?: string // ISO — data do último toque (interação manual OU agendamento) p/ reabordagem
  criadoPor: string
  criadoEm: string
  atualizadoEm: string
}

// Passo FUTURO da jornada do paciente ("o que fazer e daqui quanto tempo").
// Criado na ficha do paciente; gera uma Tarefa para a equipe na data (tarefaId).
export type ProximoPasso = {
  id: string
  titulo: string
  quando: string // YYYY-MM-DD — data prevista
  nota?: string
  feito?: boolean
  tarefaId?: string // tarefa gerada automaticamente para a equipe
  criadoEm: string
}

// Toque de relacionamento registrado no paciente/contato (nutrição da base).
// Diferente do histórico de atendimentos (que vem da Agenda): aqui é o registro
// manual de contatos ao longo do tempo para reabordagens e ações.
export type ContatoInteracao = {
  id: string
  tipo: 'nota' | 'ligacao' | 'whatsapp' | 'email' | 'retorno' | 'reabordagem' | 'campanha' | 'outro'
  texto: string
  autor: string
  data: string // ISO — quando o toque aconteceu
  criadoEm: string
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
  lojaId?: string // varejo multi-loja (telefonia): a que unidade a oportunidade pertence (isolamento). Ausente nos outros perfis.
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
  queixaPrincipal?: string // clínica: queixa principal relatada pela paciente (espelha o campo da Agenda)
  // Turismo: a qualificação é DA VIAGEM, não de marketing — destino, quantas
  // pessoas, quando e o que o cliente deseja. Campos de agência ficam vazios lá.
  destinoDesejado?: string   // destino ou viagem de interesse
  qtdPassageiros?: number    // quantas pessoas pretendem viajar
  epocaDesejada?: string     // quando querem viajar (texto livre: "setembro", "férias")
  preferencias?: string      // preferências e desejos (leito, hotel, passeios…)
  // Cidadania: a qualificação é DA ELEGIBILIDADE — qual país, de qual ascendente
  // vem o direito e a que distância (bisneto/trineto muda a análise). Venda é
  // sempre para PESSOA FÍSICA: os campos de empresa ficam vazios aqui.
  paisInteresse?: string     // país da cidadania pretendida (padrão: Luxemburgo)
  ascendenteOrigem?: string  // ascendente estrangeiro / origem da família
  grauParentesco?: string    // filho, neto, bisneto, trineto…
  // A ANÁLISE DE NACIONALIDADE acontece AQUI, na qualificação: sem montar a
  // árvore não há como saber se existe viabilidade — ela é o instrumento da
  // venda, não um artefato pós-venda. Ao concretizar, o processo COPIA esta
  // linhagem (copia, não vincula: corrigir a análise depois não pode reescrever
  // um processo já em andamento).
  linhagem?: import('./linhagem').PessoaLinhagem[]
  // Processo ABERTO a partir desta venda (perfil cidadania). Não há passagem de
  // bastão nem criação de "cliente": concretizar a venda É abrir o processo.
  // Guardado para a abertura ser idempotente — sem ele, cada clique abriria outro.
  processoId?: string
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
