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

// VOCABULÁRIO POR IDIOMA (dono, 20/09: o sistema fala português, inglês e espanhol). A frase
// é montada por pedaços porque os números são clicáveis; por isso cada idioma traz as PARTES,
// não um texto pronto. Em português há duas formas de dizer cada fato (a fraseologia gira com
// o dia); nos outros idiomas, uma — melhor uma frase certa do que duas capengas.
export type IdiomaFrase = 'pt' | 'en' | 'es'

type Voc = {
  abertura: [string[], string[], string[]] // manhã, tarde, noite
  conj: { e: string; virgula: string }
  atrasadas: (n: number) => Parte[][]
  ajustes: (n: number, quem?: string) => Parte[][]
  vencemHoje: (n: number) => Parte[][]
  paradas: (n: number, dias: number, quem?: string) => Parte[][]
  esperando: (n: number) => Parte[][]
  reuniao: (titulo: string, hora: string) => Parte[][]
  publicaHoje: (n: number) => Parte[][]
  nadaVence: (titulo: string, quando: string) => Parte[]
  quando: (d: number) => string
  filaZerada: string[]
  bomMomento: string
  subFilaNenhumaHoje: (n: number) => string
  subFilaSemPrazo: (n: number) => string
  subFila: (n: number) => string
  nenhumaTarefa: string
}

const pl = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`

const VOC: Record<IdiomaFrase, Voc> = {
  pt: {
    abertura: [['Hoje, ', 'Bom dia. Hoje, ', 'Para hoje: '], ['Ainda hoje, ', 'Nesta tarde, ', 'Até o fim do dia, '], ['Antes de fechar o dia, ', 'Ficou para hoje: ', 'Sobrou para hoje: ']],
    conj: { e: ' e ', virgula: ', ' },
    atrasadas: n => [
      [{ texto: pl(n, 'tarefa está atrasada', 'tarefas estão atrasadas'), destaque: true, quente: true, alvo: 'tarefas' }],
      [{ texto: 'você tem ' }, { texto: pl(n, 'tarefa vencida', 'tarefas vencidas'), destaque: true, quente: true, alvo: 'tarefas' }],
    ],
    ajustes: (n, quem) => [
      [{ texto: pl(n, 'material voltou', 'materiais voltaram'), destaque: true, quente: true, alvo: 'clientes' }, { texto: quem && n === 1 ? ` do ${quem} para ajuste` : ' do cliente para ajuste' }],
      [{ texto: quem && n === 1 ? `${quem} pediu ajuste em ` : 'o cliente pediu ajuste em ' }, { texto: pl(n, 'material', 'materiais'), destaque: true, quente: true, alvo: 'clientes' }],
    ],
    vencemHoje: n => [
      [{ texto: pl(n, 'tarefa vence', 'tarefas vencem'), destaque: true, alvo: 'tarefas' }],
      [{ texto: 'vencem ' }, { texto: pl(n, 'tarefa', 'tarefas'), destaque: true, alvo: 'tarefas' }, { texto: ' suas' }],
    ],
    paradas: (n, dias, quem) => [
      [{ texto: pl(n, 'material seu está parado', 'materiais seus estão parados'), destaque: true, quente: true, alvo: 'clientes' }, { texto: ` há ${dias} dias${quem && n === 1 ? ` no ${quem}` : ''}` }],
      [{ texto: quem && n === 1 ? `${quem} segura ` : 'clientes seguram ' }, { texto: pl(n, 'aprovação', 'aprovações'), destaque: true, quente: true, alvo: 'clientes' }, { texto: ` há ${dias} dias` }],
    ],
    esperando: n => [
      [{ texto: pl(n, 'material seu espera', 'materiais seus esperam'), destaque: true, alvo: 'clientes' }, { texto: ' aprovação' }],
      [{ texto: pl(n, 'aprovação pendente', 'aprovações pendentes'), destaque: true, alvo: 'clientes' }, { texto: ' nos seus materiais' }],
    ],
    reuniao: (titulo, hora) => [
      [{ texto: titulo, destaque: true, alvo: 'reunioes' }, { texto: ` às ${hora}` }],
      [{ texto: `às ${hora}, ` }, { texto: titulo, destaque: true, alvo: 'reunioes' }],
    ],
    publicaHoje: n => [
      [{ texto: pl(n, 'post seu sai', 'posts seus saem'), destaque: true, alvo: 'hoje' }],
      [{ texto: pl(n, 'publicação sua', 'publicações suas'), destaque: true, alvo: 'hoje' }, { texto: ' vão ao ar' }],
    ],
    nadaVence: (titulo, quando) => [{ texto: 'Nada vence hoje. ' }, { texto: 'O mais próximo', destaque: true, alvo: 'tarefas' }, { texto: `: ${titulo}, ${quando}.` }],
    quando: d => (d === 1 ? 'amanhã' : `em ${d} dias`),
    filaZerada: ['Fila zerada. ', 'Nada pendente com você. ', 'Dia limpo. '],
    bomMomento: 'Bom momento para adiantar o mês.',
    subFilaNenhumaHoje: n => `${pl(n, 'tarefa aberta', 'tarefas abertas')} na sua fila, nenhuma para hoje.`,
    subFilaSemPrazo: n => `${pl(n, 'tarefa aberta', 'tarefas abertas')}, todas sem prazo.`,
    subFila: n => `${pl(n, 'tarefa aberta', 'tarefas abertas')} na sua fila`,
    nenhumaTarefa: 'Nenhuma tarefa aberta.',
  },
  en: {
    abertura: [['Today, '], ['Still today, '], ['Before the day ends, ']],
    conj: { e: ' and ', virgula: ', ' },
    atrasadas: n => [[{ texto: pl(n, 'task is overdue', 'tasks are overdue'), destaque: true, quente: true, alvo: 'tarefas' }]],
    ajustes: (n, quem) => [[{ texto: pl(n, 'piece came back', 'pieces came back'), destaque: true, quente: true, alvo: 'clientes' }, { texto: quem && n === 1 ? ` from ${quem} for changes` : ' from the client for changes' }]],
    vencemHoje: n => [[{ texto: pl(n, 'task is due', 'tasks are due'), destaque: true, alvo: 'tarefas' }, { texto: ' today' }]],
    paradas: (n, dias, quem) => [[{ texto: pl(n, 'piece of yours is stuck', 'pieces of yours are stuck'), destaque: true, quente: true, alvo: 'clientes' }, { texto: ` for ${dias} days${quem && n === 1 ? ` at ${quem}` : ''}` }]],
    esperando: n => [[{ texto: pl(n, 'piece of yours is waiting', 'pieces of yours are waiting'), destaque: true, alvo: 'clientes' }, { texto: ' for approval' }]],
    reuniao: (titulo, hora) => [[{ texto: titulo, destaque: true, alvo: 'reunioes' }, { texto: ` at ${hora}` }]],
    publicaHoje: n => [[{ texto: pl(n, 'post of yours goes live', 'posts of yours go live'), destaque: true, alvo: 'hoje' }]],
    nadaVence: (titulo, quando) => [{ texto: 'Nothing is due today. ' }, { texto: 'Next up', destaque: true, alvo: 'tarefas' }, { texto: `: ${titulo}, ${quando}.` }],
    quando: d => (d === 1 ? 'tomorrow' : `in ${d} days`),
    filaZerada: ['Queue is clear. '],
    bomMomento: 'Good moment to get ahead of the month.',
    subFilaNenhumaHoje: n => `${pl(n, 'open task', 'open tasks')} in your queue, none for today.`,
    subFilaSemPrazo: n => `${pl(n, 'open task', 'open tasks')}, none with a deadline.`,
    subFila: n => `${pl(n, 'open task', 'open tasks')} in your queue`,
    nenhumaTarefa: 'No open tasks.',
  },
  es: {
    abertura: [['Hoy, '], ['Aún hoy, '], ['Antes de cerrar el día, ']],
    conj: { e: ' y ', virgula: ', ' },
    atrasadas: n => [[{ texto: pl(n, 'tarea está atrasada', 'tareas están atrasadas'), destaque: true, quente: true, alvo: 'tarefas' }]],
    ajustes: (n, quem) => [[{ texto: pl(n, 'material volvió', 'materiales volvieron'), destaque: true, quente: true, alvo: 'clientes' }, { texto: quem && n === 1 ? ` de ${quem} para ajuste` : ' del cliente para ajuste' }]],
    vencemHoje: n => [[{ texto: pl(n, 'tarea vence', 'tareas vencen'), destaque: true, alvo: 'tarefas' }, { texto: ' hoy' }]],
    paradas: (n, dias, quem) => [[{ texto: pl(n, 'material suyo está parado', 'materiales suyos están parados'), destaque: true, quente: true, alvo: 'clientes' }, { texto: ` hace ${dias} días${quem && n === 1 ? ` en ${quem}` : ''}` }]],
    esperando: n => [[{ texto: pl(n, 'material suyo espera', 'materiales suyos esperan'), destaque: true, alvo: 'clientes' }, { texto: ' aprobación' }]],
    reuniao: (titulo, hora) => [[{ texto: titulo, destaque: true, alvo: 'reunioes' }, { texto: ` a las ${hora}` }]],
    publicaHoje: n => [[{ texto: pl(n, 'publicación suya sale', 'publicaciones suyas salen'), destaque: true, alvo: 'hoje' }]],
    nadaVence: (titulo, quando) => [{ texto: 'Nada vence hoy. ' }, { texto: 'Lo más próximo', destaque: true, alvo: 'tarefas' }, { texto: `: ${titulo}, ${quando}.` }],
    quando: d => (d === 1 ? 'mañana' : `en ${d} días`),
    filaZerada: ['Fila vacía. '],
    bomMomento: 'Buen momento para adelantar el mes.',
    subFilaNenhumaHoje: n => `${pl(n, 'tarea abierta', 'tareas abiertas')} en su fila, ninguna para hoy.`,
    subFilaSemPrazo: n => `${pl(n, 'tarea abierta', 'tareas abiertas')}, todas sin plazo.`,
    subFila: n => `${pl(n, 'tarea abierta', 'tareas abiertas')} en su fila`,
    nenhumaTarefa: 'Ninguna tarea abierta.',
  },
}

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

export function fatosDe(c: ContextoPessoa, agora: number = Date.now(), idioma: IdiomaFrase = 'pt'): Fato[] {
  const v = VOC[idioma] || VOC.pt
  const semente = sementeDoDia(agora)
  const fatos: Fato[] = []

  const abertas = c.tarefas.filter(t => ['a_fazer', 'em_andamento', 'em_revisao', undefined].includes(t.status as any))
  const atrasadas = abertas.filter(t => { const d = diasAte(t.prazo, agora); return d !== undefined && d < 0 })
  const hoje = abertas.filter(t => diasAte(t.prazo, agora) === 0)

  if (atrasadas.length) {
    const n = atrasadas.length
    fatos.push({ peso: 100, partes: escolher(v.atrasadas(n), semente, 0) })
  }

  if (c.ajustes.length) {
    const n = c.ajustes.length
    const quem = c.ajustes[0].clienteNome
    fatos.push({ peso: 90, partes: escolher(v.ajustes(n, quem), semente, 1) })
  }

  if (hoje.length) {
    const n = hoje.length
    fatos.push({ peso: 85, partes: escolher(v.vencemHoje(n), semente, 2) })
  }

  const paradas = c.aprovacoes.filter(a => { const d = diasAte(a.desde, agora); return d !== undefined && d <= -3 })
  const esperando = c.aprovacoes.length
  if (paradas.length) {
    const n = paradas.length
    const maisAntiga = Math.max(...paradas.map(a => -(diasAte(a.desde, agora) || 0)))
    const quem = paradas[0].clienteNome
    fatos.push({ peso: 80, partes: escolher(v.paradas(n, maisAntiga, quem), semente, 3) })
  } else if (esperando) {
    fatos.push({ peso: 60, partes: escolher(v.esperando(esperando), semente, 4) })
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
    fatos.push({ peso: emBreve ? 70 : 40, partes: escolher(v.reuniao(r.titulo, r.hora), semente, 5) })
  }

  if (c.publicaHoje) {
    const n = c.publicaHoje
    fatos.push({ peso: 50, partes: escolher(v.publicaHoje(n), semente, 6) })
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
function abertura(agora: number, semente: number, idioma: IdiomaFrase): string {
  const v = VOC[idioma] || VOC.pt
  const h = new Date(agora).getHours()
  if (h < 12) return escolher(v.abertura[0], semente, 0)
  if (h < 18) return escolher(v.abertura[1], semente, 1)
  return escolher(v.abertura[2], semente, 2)
}

export function montarManchete(c: ContextoPessoa, agora: number = Date.now(), idioma: IdiomaFrase = 'pt'): Manchete {
  const v = VOC[idioma] || VOC.pt
  const semente = sementeDoDia(agora)
  const fatos = fatosDe(c, agora, idioma)
  const abertas = c.tarefas.filter(t => ['a_fazer', 'em_andamento', 'em_revisao', undefined].includes(t.status as any))

  // Nada urgente: dizer isso de um jeito útil, apontando o que vem a seguir.
  if (!fatos.length) {
    const comPrazo = abertas
      .map(t => ({ t, d: diasAte(t.prazo, agora) }))
      .filter(x => x.d !== undefined && (x.d as number) > 0)
      .sort((a, b) => (a.d as number) - (b.d as number))
    if (comPrazo.length) {
      const { t, d } = comPrazo[0]
      const quando = v.quando(d as number)
      return {
        partes: v.nadaVence(t.titulo || '', quando),
        subtitulo: v.subFilaNenhumaHoje(abertas.length),
        tom: 'tranquilo',
      }
    }
    return {
      partes: [{ texto: escolher(v.filaZerada, semente, 3) }, { texto: v.bomMomento }],
      subtitulo: abertas.length ? v.subFilaSemPrazo(abertas.length) : v.nenhumaTarefa,
      tom: 'tranquilo',
    }
  }

  const top = fatos.slice(0, 3)
  const tom: Manchete['tom'] = top[0].peso >= 80 ? 'urgente' : 'normal'

  // Costura: abertura + fato1 [, fato2] [e fato3].
  const partes: Parte[] = [{ texto: abertura(agora, semente, idioma) }]
  top.forEach((f, i) => {
    if (i > 0) partes.push({ texto: i === top.length - 1 ? v.conj.e : v.conj.virgula })
    partes.push(...f.partes)
  })
  partes.push({ texto: '.' })

  // Subtítulo: o que ficou de fora da manchete, para não sumir.
  const sobra: string[] = []
  const restantes = fatos.slice(3)
  if (restantes.length) sobra.push(restantes.map(f => f.partes.map(p => p.texto).join('')).join(', '))
  if (abertas.length) sobra.push(v.subFila(abertas.length))
  const subtitulo = sobra.length ? primeiraMaiuscula([{ texto: sobra.join(' · ') + '.' }])[0].texto : ''

  return { partes, subtitulo, tom }
}

// Texto puro da manchete (sem cores) — para testes e para o assistente.
export function textoDaManchete(m: Manchete): string { return m.partes.map(p => p.texto).join('') }
