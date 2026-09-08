// COMUNICAÇÃO DIÁRIA com o cliente (dono, 08/09/2026).
//
// A definição é dele, e virou lei aqui: "COMUNICAR É GERAR VALOR COM OBJETIVIDADE".
//
//   CONTA: ganho, vitória, informação do processo, questionamento relevante da
//   semana, confirmação de reunião (com link, horário e pauta) e envio de
//   material/estratégia para aprovação.
//
//   NÃO CONTA: saudação isolada ("bom dia", "excelente semana"), cobrança
//   ("vocês já conseguiram levantar aquilo?") e figurinha/frase motivacional.
//
// A segunda regra, igualmente dele: "não pode repetir comunicação, mas pode
// evoluir uma tarefa/plano e comunicar sobre o mesmo assunto". Por isso todo
// comunicado guarda um par ASSUNTO + ESTADO. O assunto é o objeto real do
// sistema (uma pauta, uma tarefa, um marco). O estado é onde ele estava naquele
// momento. Um candidato só aparece se aquele par ainda não foi comunicado; se o
// objeto andou, o estado é outro e o mesmo assunto volta, como continuação.
//
// Tudo aqui é puro: recebe os dados que a tela já carregou e devolve a pauta do
// dia. Nada de rede, nada de escrita.

export type TipoComunicacao = 'ganho' | 'vitoria' | 'processo' | 'questionamento' | 'reuniao' | 'material'

export const TIPOS: { key: TipoComunicacao; label: string; dica: string }[] = [
  { key: 'material', label: 'Material para aprovação', dica: 'Envio de peça ou estratégia para o cliente aprovar' },
  { key: 'vitoria', label: 'Vitória', dica: 'Algo que ficou pronto, foi ao ar ou saiu como planejado' },
  { key: 'ganho', label: 'Ganho', dica: 'Resultado com número: alcance, leads, vendas, economia' },
  { key: 'processo', label: 'Informação do processo', dica: 'Onde a entrega está e o que vem a seguir' },
  { key: 'questionamento', label: 'Questionamento da semana', dica: 'Pergunta que trava algo, com a consequência e o prazo' },
  { key: 'reuniao', label: 'Confirmação de reunião', dica: 'Data, horário, link e pauta' },
]
export const LABEL_TIPO: Record<string, string> = Object.fromEntries(TIPOS.map(t => [t.key, t.label]))

export type Comunicado = {
  id: string
  clienteId: string
  tipo: TipoComunicacao
  texto: string
  assunto: string // 'post:xxx' | 'tarefa:xxx' | 'marco:xxx' | 'etapa:m1:s2' | 'livre:...'
  estado: string // marca do momento do assunto; muda = pode comunicar de novo
  canal?: 'whatsapp' | 'copiado' | 'outro'
  autor?: string
  em: string // ISO
}

// ---------------------------------------------------------------- o texto vale?

const SAUDACOES = /\b(bom dia|boa tarde|boa noite|ol[áa]|oi|opa|e a[íi]|bom in[íi]cio|excelente semana|[óo]tima semana|boa semana|bom fim de semana|feliz|abra[çc]o|abs|valeu|obrigad[oa])\b/gi
const COBRANCA = /\b(j[áa] conseguiram|conseguiu ver|conseguiram ver|alguma previs[ãa]o|aguardo (o )?retorno|fico no aguardo|podem (me )?enviar|poderiam (me )?enviar|lembrando que|reforçando o pedido|retomando o assunto|s[óo] lembrando|alguma novidade|tem not[íi]cia)\b/i
// O que transforma cobrança em questionamento: consequência ou prazo explícito.
const CONSEQUENCIA = /\b(sem (isso|ele|ela|esse|essa)|caso contr[áa]rio|sen[ãa]o|para (poder|conseguir|seguir|entrar|manter)|depende|trava|impede|atrasa|fica de fora|sai da grade|precisamos para)\b/i
const PRAZO = /(\b(at[ée]|antes de|no m[áa]ximo|prazo)\b|\b\d{1,2}\/\d{1,2}\b|\b(segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo|hoje|amanh[ãa])\b)/i
const MOTIVACIONAL = /\b(bora|vamos que vamos|foco (e|and) f[ée]|sucesso|garra|energia boa|positividade|gratid[ãa]o)\b/i

export type Veredito = { ok: boolean; motivo?: string; dica?: string }

// Vale como comunicação do dia? A regra é conservadora de propósito: na dúvida
// ela deixa passar, porque quem escreveu escolheu o tipo e sabe o contexto. Ela
// barra só o que o dono listou explicitamente como "não conta".
export function avaliarTexto(texto: string, tipo?: TipoComunicacao): Veredito {
  const t = (texto || '').trim()
  if (t.length < 25) return { ok: false, motivo: 'Curto demais para gerar valor.', dica: 'Diga o quê, por quê importa e o que acontece agora.' }

  // Sobrou algo além de saudação e pontuação?
  // Sem \p{L} (a flag u exige target es6+ neste tsconfig): acentos do pt-BR listados à mão.
  const semSaudacao = t.replace(SAUDACOES, ' ').replace(/[^0-9A-Za-zÀ-ÖØ-öø-ÿ]+/g, ' ').trim()
  if (semSaudacao.length < 20) {
    return { ok: false, motivo: 'Isso é uma saudação, não uma comunicação.', dica: 'Saudação sozinha não conta. Traga um fato: entrega, resultado, decisão ou pergunta que destrava algo.' }
  }
  if (MOTIVACIONAL.test(t) && semSaudacao.length < 60) {
    return { ok: false, motivo: 'Frase motivacional não conta como comunicação.', dica: 'Troque por um fato do projeto.' }
  }
  if (tipo !== 'reuniao' && COBRANCA.test(t) && !CONSEQUENCIA.test(t) && !PRAZO.test(t)) {
    return {
      ok: false,
      motivo: 'Isso é cobrança: pede sem dizer por que importa.',
      dica: 'Vire questionamento: diga o que trava sem a resposta e até quando você precisa dela.',
    }
  }
  return { ok: true }
}

// ---------------------------------------------------------------- a semana

export type DiaSemana = { data: string; rotulo: string; diaCurto: string; hoje: boolean; futuro: boolean }

const DIA_MS = 86400000
const CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Segunda a sexta da semana que contém `agora` (a comunicação é de dia útil).
export function semanaUtil(agora: number = Date.now()): DiaSemana[] {
  const hoje = new Date(agora); hoje.setHours(0, 0, 0, 0)
  const hojeYmd = ymd(hoje)
  const segunda = new Date(hoje.getTime() - ((hoje.getDay() + 6) % 7) * DIA_MS)
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(segunda.getTime() + i * DIA_MS)
    const data = ymd(d)
    return {
      data,
      rotulo: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      diaCurto: CURTO[d.getDay()],
      hoje: data === hojeYmd,
      futuro: data > hojeYmd,
    }
  })
}

export function doDia(comunicados: Comunicado[], data: string): Comunicado[] {
  return comunicados.filter(c => (c.em || '').slice(0, 10) === data)
}

// Dias ÚTEIS sem nenhuma comunicação que conta, contando de trás para frente a
// partir de hoje (hoje entra na conta). Fim de semana não pesa.
export function diasUteisSemComunicar(comunicados: Comunicado[], agora: number = Date.now()): number {
  const dias = new Set(comunicados.map(c => (c.em || '').slice(0, 10)))
  let n = 0
  const d = new Date(agora); d.setHours(0, 0, 0, 0)
  for (let i = 0; i < 30; i++) {
    const dia = new Date(d.getTime() - i * DIA_MS)
    const semana = dia.getDay()
    if (semana === 0 || semana === 6) continue
    if (dias.has(ymd(dia))) break
    n++
  }
  return n
}

// ---------------------------------------------------------------- candidatos

export type PostCom = {
  id: string; legenda?: string; headline?: string; briefing?: string; formato?: string
  status?: string; etapa?: string; excluidoEm?: string
  dataAgendada?: string; aguardandoDesde?: string
  copyAprovadaEm?: string; criativoAprovadoEm?: string; publicadoEm?: string; atualizadoEm?: string
}
export type TarefaCom = { id: string; titulo: string; status?: string; tipo?: string; prazo?: string; concluidoEm?: string; excluidoEm?: string; clienteId?: string }
export type MarcoCom = { id: string; titulo: string; status?: string; categoria?: string; dataInicio?: string; dataFim?: string; subetapas?: { id: string; titulo: string; status?: string; dataFim?: string }[] }

export type Candidato = {
  assunto: string
  estado: string
  tipo: TipoComunicacao
  fato: string // o que aconteceu, em linguagem de equipe
  texto: string // sugestão pronta, em linguagem de cliente
  quando?: string
  anteriores: number // quantas vezes este assunto já foi comunicado
}

const ETAPAS_CLIENTE = ['aprovacao_copy', 'aprovacao_criativo']
const AJUSTE = ['corrigir', 'reprovado']
const ABERTA = ['a_fazer', 'em_andamento', 'em_revisao']

function tituloPost(p: PostCom): string {
  const t = (p.headline || p.legenda || p.briefing || '').replace(/\s+/g, ' ').trim()
  return t ? (t.length > 60 ? t.slice(0, 57) + '…' : t) : 'Material sem título'
}
const dia = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '')
const diasDesde = (iso: string | undefined, agora: number) => {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? Math.max(0, Math.floor((agora - t) / DIA_MS)) : 0
}
// Semana ISO aproximada, usada como estado de itens PARADOS: o mesmo item pode
// voltar na semana seguinte, nunca no dia seguinte.
function semanaChave(agora: number): string {
  const d = new Date(agora); d.setHours(0, 0, 0, 0)
  const segunda = new Date(d.getTime() - ((d.getDay() + 6) % 7) * DIA_MS)
  return ymd(segunda)
}

export function candidatosDoDia(entrada: {
  posts?: PostCom[]
  tarefas?: TarefaCom[]
  marcos?: MarcoCom[]
  comunicados?: Comunicado[]
  agora?: number
}): Candidato[] {
  const agora = entrada.agora ?? Date.now()
  const posts = (entrada.posts || []).filter(p => !p.excluidoEm)
  const tarefas = (entrada.tarefas || []).filter(t => !t.excluidoEm)
  const marcos = entrada.marcos || []
  const feitos = entrada.comunicados || []
  const jaFoi = new Set(feitos.map(c => `${c.assunto}|${c.estado}`))
  const vezes = (assunto: string) => feitos.filter(c => c.assunto === assunto).length
  const out: Candidato[] = []
  const por = (assunto: string, estado: string) => !jaFoi.has(`${assunto}|${estado}`)

  // 1) MATERIAL esperando o cliente. Recém-enviado é convite; parado há dias vira
  //    questionamento (com consequência e prazo), nunca cobrança repetida.
  for (const p of posts) {
    const esperando = !AJUSTE.includes(p.status || '') && (p.status === 'aguardando_aprovacao' || ETAPAS_CLIENTE.includes(p.etapa || ''))
    if (!esperando) continue
    const parado = diasDesde(p.aguardandoDesde || p.atualizadoEm, agora)
    const assunto = `post:${p.id}`
    if (parado >= 3) {
      const estado = `parado:${semanaChave(agora)}`
      if (por(assunto, estado)) out.push({
        assunto, estado, tipo: 'questionamento', quando: p.aguardandoDesde,
        fato: `"${tituloPost(p)}" espera aprovação há ${parado} dias`,
        texto: `O material "${tituloPost(p)}" está pronto desde ${dia(p.aguardandoDesde)} e depende da sua aprovação para entrar na programação. Sem o aval, ele sai do calendário deste mês. Consegue olhar até amanhã?`,
        anteriores: vezes(assunto),
      })
    } else {
      const estado = `aguardando:${p.etapa || p.status || 'aprovacao'}`
      if (por(assunto, estado)) out.push({
        assunto, estado, tipo: 'material', quando: p.aguardandoDesde,
        fato: `"${tituloPost(p)}" foi enviado para aprovação`,
        texto: `Enviamos "${tituloPost(p)}" para a sua aprovação. É só abrir o link, revisar e aprovar ou pedir ajuste direto por lá.`,
        anteriores: vezes(assunto),
      })
    }
  }

  // 2) PUBLICADO: virou entrega no ar.
  for (const p of posts) {
    if (p.status !== 'publicado') continue
    const assunto = `post:${p.id}`, estado = 'publicado'
    if (!por(assunto, estado)) continue
    out.push({
      assunto, estado, tipo: 'vitoria', quando: p.publicadoEm || p.dataAgendada,
      fato: `"${tituloPost(p)}" foi publicado`,
      texto: `"${tituloPost(p)}" está no ar desde ${dia(p.publicadoEm || p.dataAgendada)}. Em alguns dias trago os números dele.`,
      anteriores: vezes(assunto),
    })
  }

  // 3) APROVADO pelo cliente: informação de processo, o que acontece agora.
  for (const p of posts) {
    const aprovado = p.criativoAprovadoEm || p.copyAprovadaEm
    if (!aprovado || p.status === 'publicado') continue
    const assunto = `post:${p.id}`, estado = p.criativoAprovadoEm ? 'aprovado_criativo' : 'aprovado_copy'
    if (!por(assunto, estado)) continue
    out.push({
      assunto, estado, tipo: 'processo', quando: aprovado,
      fato: `"${tituloPost(p)}" foi aprovado e seguiu na produção`,
      texto: p.criativoAprovadoEm
        ? `"${tituloPost(p)}" aprovado, obrigado. Já está programado${p.dataAgendada ? ` para ${dia(p.dataAgendada)}` : ''} e não precisa de mais nada da sua parte.`
        : `Texto de "${tituloPost(p)}" aprovado. A arte entra em produção agora e volta para você aprovar antes de publicar.`,
      anteriores: vezes(assunto),
    })
  }

  // 4) TAREFA concluída: informação de processo (o que a agência entregou).
  for (const t of tarefas) {
    if (t.status !== 'concluido' || !t.concluidoEm) continue
    const assunto = `tarefa:${t.id}`, estado = 'concluido'
    if (!por(assunto, estado)) continue
    out.push({
      assunto, estado, tipo: 'processo', quando: t.concluidoEm,
      fato: `Tarefa "${t.titulo}" concluída`,
      texto: `Concluímos "${t.titulo}"${t.concluidoEm ? ` em ${dia(t.concluidoEm)}` : ''}. Seguimos para a próxima etapa do plano.`,
      anteriores: vezes(assunto),
    })
  }

  // 5) PLAYBOOK: etapa e marco concluídos são vitória de plano.
  for (const m of marcos) {
    for (const se of m.subetapas || []) {
      if (se.status !== 'concluido') continue
      const assunto = `etapa:${m.id}:${se.id}`, estado = 'concluido'
      if (!por(assunto, estado)) continue
      out.push({
        assunto, estado, tipo: 'vitoria', quando: se.dataFim,
        fato: `Etapa "${se.titulo}" (${m.titulo}) concluída`,
        texto: `Fechamos a etapa "${se.titulo}", dentro de ${m.titulo}. É mais um pedaço do plano entregue.`,
        anteriores: vezes(assunto),
      })
    }
    if (m.status === 'concluido') {
      const assunto = `marco:${m.id}`, estado = 'concluido'
      if (por(assunto, estado)) out.push({
        assunto, estado, tipo: 'vitoria', quando: m.dataFim,
        fato: `Marco "${m.titulo}" concluído`,
        texto: `Concluímos "${m.titulo}" por completo. Já podemos falar dos próximos passos na nossa conversa desta semana.`,
        anteriores: vezes(assunto),
      })
    }
    // 6) REUNIÃO de hoje ou amanhã (marco de categoria reunião).
    if (m.categoria === 'reuniao' && m.dataInicio) {
      const hoje0 = new Date(agora); hoje0.setHours(0, 0, 0, 0)
      const faltam = Math.round((new Date(m.dataInicio).getTime() - hoje0.getTime()) / DIA_MS)
      if (faltam >= 0 && faltam <= 1) { // hoje ou amanhã; reunião passada não volta
        const assunto = `marco:${m.id}`, estado = `reuniao:${ymd(new Date(m.dataInicio))}`
        if (por(assunto, estado)) out.push({
          assunto, estado, tipo: 'reuniao', quando: m.dataInicio,
          fato: `Reunião "${m.titulo}" em ${dia(m.dataInicio)}`,
          texto: `Confirmando nossa reunião de ${dia(m.dataInicio)}. Pauta: ${m.titulo}. Envio o link em seguida. Se precisar remarcar, me avise hoje.`,
          anteriores: vezes(assunto),
        })
      }
    }
  }

  // 7) TAREFA com prazo vencendo que depende do cliente é questionamento da semana.
  for (const t of tarefas) {
    if (!t.prazo || !ABERTA.includes(t.status || '')) continue
    const faltam = Math.ceil((new Date(t.prazo).getTime() - agora) / DIA_MS)
    if (faltam > 2 || faltam < -30) continue
    const assunto = `tarefa:${t.id}`, estado = `prazo:${semanaChave(agora)}`
    if (!por(assunto, estado)) continue
    out.push({
      assunto, estado, tipo: 'questionamento', quando: t.prazo,
      fato: `"${t.titulo}" ${faltam < 0 ? `venceu há ${-faltam} dias` : faltam === 0 ? 'vence hoje' : `vence em ${faltam} dias`}`,
      texto: `Sobre "${t.titulo}": o prazo é ${dia(t.prazo)} e ainda falta a sua parte para fechar. Sem isso a entrega escorrega para a semana que vem. Consegue retornar até ${dia(t.prazo)}?`,
      anteriores: vezes(assunto),
    })
  }

  const ordem: Record<TipoComunicacao, number> = { material: 0, questionamento: 1, reuniao: 2, vitoria: 3, ganho: 4, processo: 5 }
  return out.sort((a, b) => ordem[a.tipo] - ordem[b.tipo] || (b.quando || '').localeCompare(a.quando || ''))
}

// O que já está PREVISTO para os dias que ainda vêm na semana (a faixa da semana
// mostra isso nos dias futuros, para a pessoa enxergar a semana inteira).
export type Previsto = { data: string; texto: string }

export function previstoNaSemana(entrada: { posts?: PostCom[]; tarefas?: TarefaCom[]; marcos?: MarcoCom[] }, semana: DiaSemana[]): Previsto[] {
  const dias = new Set(semana.filter(d => d.futuro || d.hoje).map(d => d.data))
  const out: Previsto[] = []
  for (const p of entrada.posts || []) {
    if (p.excluidoEm || !p.dataAgendada) continue
    const data = p.dataAgendada.slice(0, 10)
    if (dias.has(data) && p.status !== 'publicado') out.push({ data, texto: `Publicação: ${tituloPost(p)}` })
  }
  for (const t of entrada.tarefas || []) {
    if (t.excluidoEm || !t.prazo || !ABERTA.includes(t.status || '')) continue
    const data = t.prazo.slice(0, 10)
    if (dias.has(data)) out.push({ data, texto: `Prazo: ${t.titulo}` })
  }
  for (const m of entrada.marcos || []) {
    if (!m.dataFim) continue
    const data = m.dataFim.slice(0, 10)
    if (dias.has(data)) out.push({ data, texto: `${m.categoria === 'reuniao' ? 'Reunião' : 'Entrega'}: ${m.titulo}` })
  }
  return out
}
