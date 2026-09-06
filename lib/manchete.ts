// MANCHETE da Home — a frase de abertura, PESSOAL e derivada.
//
// A Home abre com uma frase, e os números dentro dela são a interface. Para
// não virar papel de parede, ela não pode ser a mesma para todo mundo nem a
// mesma todo dia: nasce da fila de QUEM ESTÁ LOGADO (as tarefas dela, os
// materiais que ela criou e estão esperando o cliente, as reuniões dela) e
// muda porque essa fila muda.
//
// Duas fontes de variação, de propósito:
//  1) Os FATOS — o que a pessoa tem hoje. É a variação que importa: se a frase
//     repete, é porque a situação repetiu, e isso é informação.
//  2) A FRASEOLOGIA — cada fato tem mais de uma forma de ser dito, e a
//     escolha gira com o dia. Determinística por dia: não pula a cada reload.
//
// Só entram os 3 fatos mais urgentes. Ordem de urgência fixa: atrasado >
// voltou do cliente > vence hoje > aprovação parada > reunião próxima >
// aprovação esperando > publica hoje. O resto vai para o subtítulo.
//
// Puro: nada de Redis. Quem monta o contexto é a rota; quem testa é o vitest.

export type ContextoPessoa = {
  nome?: string
  // Tarefas em que a pessoa é responsável, abertas (a_fazer/em_andamento/em_revisao).
  tarefas: { titulo?: string; prazo?: string; status?: string }[]
  // Posts CRIADOS por ela que estão esperando o cliente (aguardando_aprovacao / etapas de aprovação).
  aprovacoes: { titulo?: string; clienteNome?: string; desde?: string }[]
  // Posts criados por ela que o cliente devolveu (corrigir/reprovado).
  ajustes: { titulo?: string; clienteNome?: string }[]
  // Posts dela agendados para hoje.
  publicaHoje: number
  // Reuniões de hoje em que ela está: hora "HH:MM" e título.
  reunioes: { hora: string; titulo: string }[]
}

export type Parte = {
  texto: string
  destaque?: boolean      // vai em cor (é um número/nome clicável)
  quente?: boolean        // vermelho em vez de âmbar (parado/atrasado)
  alvo?: 'tarefas' | 'clientes' | 'hoje' | 'reunioes'
}

export type Manchete = {
  partes: Parte[]         // concatenar dá a frase; a tela pinta os destaques
  subtitulo: string
  tom: 'urgente' | 'normal' | 'tranquilo'
}

type Fato = { peso: number; partes: Parte[] }

const DIA_MS = 86400000

function inicioDoDia(t: number): number { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }

function diasAte(iso: string | undefined, agora: number): number | undefined {
  if (!iso) return undefined
  const t = new Date(iso).getTime()
  if (isNaN(t)) return undefined
  return Math.floor((inicioDoDia(t) - inicioDoDia(agora)) / DIA_MS)
}

// Semente do dia: gira a fraseologia uma vez por dia, igual para todos.
export function sementeDoDia(agora: number): number { return Math.floor(agora / DIA_MS) }

function escolher<T>(opcoes: T[], semente: number, salto: number): T { return opcoes[(semente + salto) % opcoes.length] }

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`

export function fatosDe(c: ContextoPessoa, agora: number = Date.now()): Fato[] {
  const semente = sementeDoDia(agora)
  const fatos: Fato[] = []

  const abertas = c.tarefas.filter(t => ['a_fazer', 'em_andamento', 'em_revisao', undefined].includes(t.status as any))
  const atrasadas = abertas.filter(t => { const d = diasAte(t.prazo, agora); return d !== undefined && d < 0 })
  const hoje = abertas.filter(t => diasAte(t.prazo, agora) === 0)

  if (atrasadas.length) {
    const n = atrasadas.length
    fatos.push({ peso: 100, partes: escolher([
      [{ texto: plural(n, 'tarefa está atrasada', 'tarefas estão atrasadas'), destaque: true, quente: true, alvo: 'tarefas' }],
      [{ texto: 'você tem ' }, { texto: plural(n, 'tarefa vencida', 'tarefas vencidas'), destaque: true, quente: true, alvo: 'tarefas' }],
    ], semente, 0) })
  }

  if (c.ajustes.length) {
    const n = c.ajustes.length
    const quem = c.ajustes[0].clienteNome
    fatos.push({ peso: 90, partes: escolher([
      [{ texto: plural(n, 'material voltou', 'materiais voltaram'), destaque: true, quente: true, alvo: 'clientes' }, { texto: quem && n === 1 ? ` do ${quem} para ajuste` : ' do cliente para ajuste' }],
      [{ texto: quem && n === 1 ? `${quem} pediu ajuste em ` : 'o cliente pediu ajuste em ' }, { texto: plural(n, 'material', 'materiais'), destaque: true, quente: true, alvo: 'clientes' }],
    ], semente, 1) })
  }

  if (hoje.length) {
    const n = hoje.length
    fatos.push({ peso: 85, partes: escolher([
      [{ texto: plural(n, 'tarefa vence', 'tarefas vencem'), destaque: true, alvo: 'tarefas' }],
      [{ texto: 'vencem ' }, { texto: plural(n, 'tarefa', 'tarefas'), destaque: true, alvo: 'tarefas' }, { texto: ' suas' }],
    ], semente, 2) })
  }

  const paradas = c.aprovacoes.filter(a => { const d = diasAte(a.desde, agora); return d !== undefined && d <= -3 })
  const esperando = c.aprovacoes.length
  if (paradas.length) {
    const n = paradas.length
    const maisAntiga = Math.max(...paradas.map(a => -(diasAte(a.desde, agora) || 0)))
    const quem = paradas[0].clienteNome
    fatos.push({ peso: 80, partes: escolher([
      [{ texto: plural(n, 'material seu está parado', 'materiais seus estão parados'), destaque: true, quente: true, alvo: 'clientes' }, { texto: ` há ${maisAntiga} dias${quem && n === 1 ? ` no ${quem}` : ''}` }],
      [{ texto: quem && n === 1 ? `${quem} segura ` : 'clientes seguram ' }, { texto: plural(n, 'aprovação', 'aprovações'), destaque: true, quente: true, alvo: 'clientes' }, { texto: ` há ${maisAntiga} dias` }],
    ], semente, 3) })
  } else if (esperando) {
    fatos.push({ peso: 60, partes: escolher([
      [{ texto: plural(esperando, 'material seu espera', 'materiais seus esperam'), destaque: true, alvo: 'clientes' }, { texto: ' aprovação' }],
      [{ texto: plural(esperando, 'aprovação pendente', 'aprovações pendentes'), destaque: true, alvo: 'clientes' }, { texto: ' nos seus materiais' }],
    ], semente, 4) })
  }

  const agoraD = new Date(agora)
  const minutosAgora = agoraD.getHours() * 60 + agoraD.getMinutes()
  const proximas = c.reunioes
    .map(r => ({ ...r, min: Number(r.hora.slice(0, 2)) * 60 + Number(r.hora.slice(3, 5)) }))
    .filter(r => r.min >= minutosAgora - 15)
    .sort((a, b) => a.min - b.min)
  if (proximas.length) {
    const r = proximas[0]
    const emBreve = r.min - minutosAgora <= 180
    fatos.push({ peso: emBreve ? 70 : 40, partes: escolher([
      [{ texto: r.titulo, destaque: true, alvo: 'reunioes' }, { texto: ` às ${r.hora}` }],
      [{ texto: `às ${r.hora}, ` }, { texto: r.titulo, destaque: true, alvo: 'reunioes' }],
    ], semente, 5) })
  }

  if (c.publicaHoje) {
    const n = c.publicaHoje
    fatos.push({ peso: 50, partes: escolher([
      [{ texto: plural(n, 'post seu sai', 'posts seus saem'), destaque: true, alvo: 'hoje' }],
      [{ texto: plural(n, 'publicação sua', 'publicações suas'), destaque: true, alvo: 'hoje' }, { texto: ' vão ao ar' }],
    ], semente, 6) })
  }

  return fatos.sort((a, b) => b.peso - a.peso)
}

function primeiraMaiuscula(p: Parte[]): Parte[] {
  if (!p.length) return p
  const [a, ...resto] = p
  return [{ ...a, texto: a.texto.charAt(0).toUpperCase() + a.texto.slice(1) }, ...resto]
}

// Abertura conforme a hora — de manhã "Hoje", à tarde "Ainda hoje", à noite
// "Antes de fechar o dia". A mesma fila lida em horas diferentes soa diferente.
// É a abertura que carrega o DIA: os fatos não dizem "hoje" de novo, senão a
// frase sai "Hoje, 2 tarefas vencem hoje".
function abertura(agora: number, semente: number): string {
  const h = new Date(agora).getHours()
  if (h < 12) return escolher(['Hoje, ', 'Bom dia. Hoje, ', 'Para hoje: '], semente, 0)
  if (h < 18) return escolher(['Ainda hoje, ', 'Nesta tarde, ', 'Até o fim do dia, '], semente, 1)
  return escolher(['Antes de fechar o dia, ', 'Ficou para hoje: ', 'Sobrou para hoje: '], semente, 2)
}

export function montarManchete(c: ContextoPessoa, agora: number = Date.now()): Manchete {
  const semente = sementeDoDia(agora)
  const fatos = fatosDe(c, agora)
  const abertas = c.tarefas.filter(t => ['a_fazer', 'em_andamento', 'em_revisao', undefined].includes(t.status as any))

  // Nada urgente: dizer isso de um jeito útil, apontando o que vem a seguir.
  if (!fatos.length) {
    const comPrazo = abertas
      .map(t => ({ t, d: diasAte(t.prazo, agora) }))
      .filter(x => x.d !== undefined && (x.d as number) > 0)
      .sort((a, b) => (a.d as number) - (b.d as number))
    if (comPrazo.length) {
      const { t, d } = comPrazo[0]
      const quando = d === 1 ? 'amanhã' : `em ${d} dias`
      return {
        partes: [{ texto: 'Nada vence hoje. ' }, { texto: 'O mais próximo', destaque: true, alvo: 'tarefas' }, { texto: `: ${t.titulo || 'uma tarefa'}, ${quando}.` }],
        subtitulo: `${plural(abertas.length, 'tarefa aberta', 'tarefas abertas')} na sua fila, nenhuma para hoje.`,
        tom: 'tranquilo',
      }
    }
    return {
      partes: [{ texto: escolher(['Fila zerada. ', 'Nada pendente com você. ', 'Dia limpo. '], semente, 3) }, { texto: 'Bom momento para adiantar o mês.' }],
      subtitulo: abertas.length ? `${plural(abertas.length, 'tarefa aberta', 'tarefas abertas')}, todas sem prazo.` : 'Nenhuma tarefa aberta.',
      tom: 'tranquilo',
    }
  }

  const top = fatos.slice(0, 3)
  const tom: Manchete['tom'] = top[0].peso >= 80 ? 'urgente' : 'normal'

  // Costura: abertura + fato1 [, fato2] [e fato3].
  const partes: Parte[] = [{ texto: abertura(agora, semente) }]
  top.forEach((f, i) => {
    if (i > 0) partes.push({ texto: i === top.length - 1 ? ' e ' : ', ' })
    partes.push(...f.partes)
  })
  partes.push({ texto: '.' })

  // Subtítulo: o que ficou de fora da manchete, para não sumir.
  const sobra: string[] = []
  const restantes = fatos.slice(3)
  if (restantes.length) sobra.push(restantes.map(f => f.partes.map(p => p.texto).join('')).join(', '))
  if (abertas.length) sobra.push(`${plural(abertas.length, 'tarefa aberta', 'tarefas abertas')} na sua fila`)
  const subtitulo = sobra.length ? primeiraMaiuscula([{ texto: sobra.join(' · ') + '.' }])[0].texto : ''

  return { partes, subtitulo, tom }
}

// Texto puro da manchete (sem cores) — para testes e para o assistente.
export function textoDaManchete(m: Manchete): string { return m.partes.map(p => p.texto).join('') }
