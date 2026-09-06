// "De quem é a bola" — Ball-in-court aplicado ao Playbook.
//
// O Playbook dizia QUANDO as coisas acontecem (Gantt) e um status digitado à
// mão. Nenhum dos dois responde à pergunta que o cliente e a equipe fazem:
// "e agora, o que falta e com quem está?". Status manual ainda envelhece — na
// semana em que ninguém atualiza, ele mente justamente para quem não tem como
// conferir.
//
// Aqui nada é digitado: o lado é DERIVADO do que já existe na operação. Post
// esperando aprovação = bola com o cliente. Post que voltou para ajuste = bola
// com a agência. Tarefa aberta = agência.
//
// Regra de desempate: quando os dois lados têm pendência, a bola é do CLIENTE.
// Não é diplomacia — é que o trabalho da agência costuma estar bloqueado pela
// aprovação, e mostrar "com a agência" enquanto quatro criativos esperam há
// dias inverteria a leitura de quem está segurando a fila.
//
// Puro de propósito: quem lê isto é a tela do cliente, e a conta precisa ser
// testável sem Redis.

export type LadoDaBola = 'cliente' | 'agencia' | 'ninguem'

export type ItemPendente = {
  titulo: string
  // Desde quando está parado, em ISO. Ausente = não dá para saber.
  desde?: string
  tipo: 'aprovacao' | 'ajuste' | 'tarefa'
}

export type BolaDaVez = {
  lado: LadoDaBola
  // Quantos itens em cada lado (o cliente vê o dele; a equipe vê os dois).
  totalCliente: number
  totalAgencia: number
  itens: ItemPendente[] // os do lado que está com a bola, mais antigos primeiro
  // Há quantos dias o item mais antigo do lado da bola está parado.
  diasParado?: number
}

export type PostBola = {
  titulo?: string
  briefing?: string
  legenda?: string
  headline?: string
  status?: string
  etapa?: string
  aguardandoDesde?: string
  atualizadoEm?: string
  excluidoEm?: string
}

export type TarefaBola = {
  titulo?: string
  status?: string
  prazo?: string
  atualizadoEm?: string
  concluidoEm?: string
}

// Esperando o cliente decidir. `aguardando_aprovacao` cobre o criativo avulso;
// as etapas cobrem a linha de montagem do Studio.
const ETAPAS_DO_CLIENTE = ['aprovacao_copy', 'aprovacao_criativo']

// Voltou do cliente e precisa ser refeito — bola da agência, não do cliente.
const STATUS_DE_AJUSTE = ['corrigir', 'reprovado']

// Tarefa que ainda consome alguém. 'descartado' e 'concluido' saem da conta.
const TAREFA_ABERTA = ['a_fazer', 'em_andamento', 'em_revisao']

function rotuloPost(p: PostBola): string {
  const t = (p.titulo || p.briefing || p.headline || p.legenda || '').replace(/\s+/g, ' ').trim()
  return t ? t.slice(0, 70) : 'Material sem título'
}

export function esperandoCliente(p: PostBola): boolean {
  if (p.excluidoEm) return false
  if (STATUS_DE_AJUSTE.includes(p.status || '')) return false // já voltou para a agência
  return p.status === 'aguardando_aprovacao' || ETAPAS_DO_CLIENTE.includes(p.etapa || '')
}

export function esperandoAgencia(p: PostBola): boolean {
  if (p.excluidoEm) return false
  return STATUS_DE_AJUSTE.includes(p.status || '')
}

// Dias inteiros entre duas datas. Nunca negativo: data no futuro conta como 0,
// senão relógio torto do cliente viraria "parado há -3 dias" na tela dele.
export function diasDesde(iso?: string, agora: number = Date.now()): number | undefined {
  if (!iso) return undefined
  const t = new Date(iso).getTime()
  if (isNaN(t)) return undefined
  return Math.max(0, Math.floor((agora - t) / 86400000))
}

export function calcularBola(
  posts: PostBola[] = [],
  tarefas: TarefaBola[] = [],
  agora: number = Date.now(),
): BolaDaVez {
  const doCliente: ItemPendente[] = posts.filter(esperandoCliente).map(p => ({
    titulo: rotuloPost(p),
    desde: p.aguardandoDesde || p.atualizadoEm,
    tipo: 'aprovacao' as const,
  }))

  const daAgencia: ItemPendente[] = [
    ...posts.filter(esperandoAgencia).map(p => ({
      titulo: rotuloPost(p),
      desde: p.atualizadoEm,
      tipo: 'ajuste' as const,
    })),
    ...tarefas.filter(t => TAREFA_ABERTA.includes(t.status || '')).map(t => ({
      titulo: (t.titulo || 'Tarefa sem título').slice(0, 70),
      desde: t.atualizadoEm,
      tipo: 'tarefa' as const,
    })),
  ]

  // Mais antigo primeiro: o que está parado há mais tempo é o que precisa
  // aparecer, não o que foi mexido por último.
  const porAntiguidade = (a: ItemPendente, b: ItemPendente) => {
    if (!a.desde) return 1
    if (!b.desde) return -1
    return new Date(a.desde).getTime() - new Date(b.desde).getTime()
  }
  doCliente.sort(porAntiguidade)
  daAgencia.sort(porAntiguidade)

  const lado: LadoDaBola = doCliente.length ? 'cliente' : daAgencia.length ? 'agencia' : 'ninguem'
  const itens = lado === 'cliente' ? doCliente : lado === 'agencia' ? daAgencia : []

  return {
    lado,
    totalCliente: doCliente.length,
    totalAgencia: daAgencia.length,
    itens,
    diasParado: itens.length ? diasDesde(itens[0].desde, agora) : undefined,
  }
}

// Frase pronta para a tela. `paraCliente` troca a pessoa: o cliente lê "sua vez",
// a equipe lê "com o cliente".
export function fraseDaBola(b: BolaDaVez, paraCliente: boolean): string {
  if (b.lado === 'ninguem') return 'Nada pendente no momento.'
  const n = b.itens.length
  const plural = n > 1
  if (b.lado === 'cliente') {
    const base = paraCliente
      ? `${n} ${plural ? 'materiais esperam' : 'material espera'} sua aprovação`
      : `${n} ${plural ? 'materiais esperam' : 'material espera'} o cliente aprovar`
    return b.diasParado && b.diasParado > 0 ? `${base} há ${b.diasParado} ${b.diasParado > 1 ? 'dias' : 'dia'}` : base
  }
  return paraCliente
    ? `Estamos trabalhando: ${n} ${plural ? 'itens em produção' : 'item em produção'}`
    : `${n} ${plural ? 'itens' : 'item'} com a equipe`
}
