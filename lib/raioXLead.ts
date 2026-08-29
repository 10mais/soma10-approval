// RAIO-X DO LEAD — o que a conversa de WhatsApp diz sobre a pessoa, sem
// ninguém precisar rolar o histórico para descobrir.
//
// Tudo aqui sai das mensagens que já existem (`wa:msgs:{tel}`) e do cadastro.
// Nada é digitado à mão: status de lead preenchido a dedo envelhece no primeiro
// dia corrido da clínica, e aí o painel passa a mentir com cara de verdade.

export type MsgRaioX = { de: 'cliente' | 'agente'; texto?: string; em: string; tipo?: string }

const HORA = 3600000
const horas = (a: number, b: number) => (a - b) / HORA

// ---- Situação: de quem é a bola ----

export type ChaveSituacao = 'sem_mensagens' | 'responder' | 'aguardando_resposta'

export type Situacao = {
  chave: ChaveSituacao
  label: string
  cor: string
  fundo: string
  detalhe: string
}

function tempoRelativo(h: number): string {
  if (h < 1) return `há ${Math.max(1, Math.round(h * 60))} min`
  if (h < 24) return `há ${Math.round(h)}h`
  const d = Math.round(h / 24)
  return d === 1 ? 'há 1 dia' : `há ${d} dias`
}

export function situacaoDaConversa(msgs: MsgRaioX[], agora: Date): Situacao {
  const ultima = msgs[msgs.length - 1]
  if (!ultima) return { chave: 'sem_mensagens', label: 'Sem mensagens', cor: '#6b7280', fundo: '#f4f4f5', detalhe: 'Nenhuma conversa ainda.' }
  const h = horas(agora.getTime(), new Date(ultima.em).getTime())
  if (ultima.de === 'cliente') {
    // A bola está com a gente. Passar de 1h vira urgência: em clínica, lead que
    // pergunta e espera vai perguntar na concorrência.
    const urgente = h >= 1
    return {
      chave: 'responder',
      label: urgente ? 'Esperando você responder' : 'Respondeu agora',
      cor: urgente ? '#b91c1c' : '#166534',
      fundo: urgente ? '#fef2f2' : '#f0fdf4',
      detalhe: `A pessoa mandou a última mensagem ${tempoRelativo(h)}.`,
    }
  }
  return {
    chave: 'aguardando_resposta',
    label: 'Aguardando resposta',
    cor: '#a16207',
    fundo: '#fffbeb',
    detalhe: `Nós falamos por último, ${tempoRelativo(h)}.`,
  }
}

// ---- Temperatura: quão viva está a conversa ----

export type ChaveTemp = 'quente' | 'morno' | 'frio' | 'sem_resposta'

export type Temperatura = {
  chave: ChaveTemp
  label: string
  cor: string
  fundo: string
  motivo: string
}

// Régua deliberadamente simples — e explicada na tela pelo `motivo`. Nota que
// só o cliente esquenta o lead: nós mandarmos cinco mensagens seguidas não
// torna ninguém "quente".
export function temperatura(msgs: MsgRaioX[], agora: Date): Temperatura {
  const doCliente = msgs.filter(m => m.de === 'cliente')
  if (!doCliente.length) {
    return { chave: 'sem_resposta', label: 'Sem resposta', cor: '#6b7280', fundo: '#f4f4f5', motivo: msgs.length ? 'A pessoa nunca respondeu.' : 'Nenhuma mensagem ainda.' }
  }
  const h = horas(agora.getTime(), new Date(doCliente[doCliente.length - 1].em).getTime())
  if (h <= 48) return { chave: 'quente', label: 'Lead quente', cor: '#b91c1c', fundo: '#fef2f2', motivo: `Respondeu ${tempoRelativo(h)} · ${doCliente.length} mensagem(ns) dela.` }
  if (h <= 24 * 7) return { chave: 'morno', label: 'Lead morno', cor: '#a16207', fundo: '#fffbeb', motivo: `Última resposta dela ${tempoRelativo(h)}.` }
  return { chave: 'frio', label: 'Lead frio', cor: '#1d4ed8', fundo: '#eff6ff', motivo: `Sem responder ${tempoRelativo(h)} — caso de reaquecimento.` }
}

// ---- Linha do tempo em números ----

export type ResumoConversa = {
  total: number
  doCliente: number
  nossas: number
  primeiroEm: string
  primeiroDe: 'cliente' | 'agente' | ''
  ultimaEm: string
  ultimaDe: 'cliente' | 'agente' | ''
  ultimaRespostaDelaEm: string
  horasDesdeUltima: number
}

export function resumoConversa(msgs: MsgRaioX[], agora: Date): ResumoConversa {
  const primeiro = msgs[0], ultima = msgs[msgs.length - 1]
  const doCliente = msgs.filter(m => m.de === 'cliente')
  return {
    total: msgs.length,
    doCliente: doCliente.length,
    nossas: msgs.length - doCliente.length,
    primeiroEm: primeiro?.em || '',
    primeiroDe: primeiro?.de || '',
    ultimaEm: ultima?.em || '',
    ultimaDe: ultima?.de || '',
    ultimaRespostaDelaEm: doCliente[doCliente.length - 1]?.em || '',
    horasDesdeUltima: ultima ? Math.round(horas(agora.getTime(), new Date(ultima.em).getTime()) * 10) / 10 : 0,
  }
}

// ---- Interesses: o que ela falou que quer ----

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Procura os PROCEDIMENTOS do catálogo da clínica dentro do que a PESSOA
// escreveu (o que nós escrevemos não conta: oferecer não é querer). Ordena pelo
// que ela repetiu mais — repetir é insistir.
export function interessesNaConversa(msgs: MsgRaioX[], catalogo: string[]): string[] {
  const texto = sem(msgs.filter(m => m.de === 'cliente').map(m => m.texto || '').join(' \n '))
  if (!texto.trim()) return []
  const achados: { nome: string; vezes: number }[] = []
  for (const nome of catalogo) {
    const termo = sem(String(nome || '')).trim()
    if (termo.length < 3) continue // "cx", "hd": casaria com qualquer coisa
    let vezes = 0, i = texto.indexOf(termo)
    while (i >= 0) { vezes++; i = texto.indexOf(termo, i + termo.length) }
    if (vezes) achados.push({ nome, vezes })
  }
  return achados.sort((a, b) => b.vezes - a.vezes || a.nome.localeCompare(b.nome, 'pt')).map(a => a.nome)
}

// ---- Placeholders das mensagens prontas ----

// {nome} / {primeiro} nos textos da Biblioteca de Vendas. Sem nome, a frase não
// pode virar "Oi {primeiro}" nem "Oi ," — vira uma saudação sem nome mesmo.
export function aplicarPlaceholders(texto: string, nome?: string): string {
  const completo = String(nome || '').trim()
  const primeiro = completo.split(/\s+/)[0] || ''
  return String(texto || '')
    .replace(/\{nome\}/gi, completo)
    .replace(/\{primeiro\}/gi, primeiro)
    .replace(/\s+,/g, ',')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}
