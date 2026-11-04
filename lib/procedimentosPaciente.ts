// QUEM FEZ QUAL PROCEDIMENTO — pedido do dono (04/11/2026): "procura por botox e
// aparecer os pacientes, sem precisar entrar no contato para visualizar o que foi
// realizado".
//
// Duas fontes, e as duas contam:
// 1. A Agenda: `procedimentosRealizados` de cada atendimento CONCLUÍDO (preenchido
//    no modal "Atendido"). É o registro de verdade do que a paciente fez AQUI.
// 2. A ficha: `ultimoProcedimento`, anotado À MÃO porque a base veio do sistema
//    anterior. Sem ele, quem foi atendida antes do Soma10 sumiria da busca.
//
// Casar é por TRECHO, sem acento e sem caixa: "botox" acha "Botox full face" e
// "Toxina botulínica (Botox)". É o que a recepção digita.
//
// Puro (sem fetch, sem React): a lista de pacientes chama, o teste cobre.

export type AtendimentoProc = {
  contatoId?: string
  status: string
  dataInicio: string
  procedimentosRealizados?: string[]
}
export type ContatoProc = { id: string; ultimoProcedimento?: string }

export type ProcedimentoFeito = {
  nome: string      // grafia do registro mais recente
  chave: string     // normalizada: agrupa "Botox" e " botox"
  vezes: number     // atendimentos que registraram (0 = só anotado na ficha)
  ultima?: string   // ISO do atendimento mais recente; ausente quando só anotado
  anotado?: boolean // veio (também) do "Último procedimento" da ficha
}

export function chaveProcedimento(nome: string): string {
  return String(nome || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim()
}

const tempo = (iso?: string) => {
  const t = iso ? new Date(iso).getTime() : NaN
  return isNaN(t) ? -Infinity : t
}

// contatoId → procedimentos que a pessoa fez, o mais recente primeiro (o que só
// foi anotado na ficha, sem data, vai para o fim).
export function procedimentosPorContato(atendimentos: AtendimentoProc[], contatos: ContatoProc[] = []): Map<string, ProcedimentoFeito[]> {
  const porContato = new Map<string, Map<string, ProcedimentoFeito>>()
  const doContato = (id: string) => {
    let m = porContato.get(id)
    if (!m) { m = new Map(); porContato.set(id, m) }
    return m
  }

  for (const a of atendimentos || []) {
    if (!a || a.status !== 'atendido' || !a.contatoId || !Array.isArray(a.procedimentosRealizados)) continue
    const t = tempo(a.dataInicio)
    if (t === -Infinity) continue
    const m = doContato(a.contatoId)
    // O mesmo procedimento marcado duas vezes no MESMO atendimento conta uma vez.
    const vistos = new Set<string>()
    for (const bruto of a.procedimentosRealizados) {
      const nome = String(bruto || '').trim()
      const chave = chaveProcedimento(nome)
      if (!chave || vistos.has(chave)) continue
      vistos.add(chave)
      const atual = m.get(chave)
      if (!atual) { m.set(chave, { nome, chave, vezes: 1, ultima: a.dataInicio }); continue }
      atual.vezes++
      if (t > tempo(atual.ultima)) { atual.ultima = a.dataInicio; atual.nome = nome }
    }
  }

  for (const c of contatos || []) {
    const nome = String(c?.ultimoProcedimento || '').trim()
    const chave = chaveProcedimento(nome)
    if (!c?.id || !chave) continue
    const m = doContato(c.id)
    const atual = m.get(chave)
    if (atual) atual.anotado = true
    else m.set(chave, { nome, chave, vezes: 0, anotado: true })
  }

  const saida = new Map<string, ProcedimentoFeito[]>()
  porContato.forEach((m, id) => {
    const lista = Array.from(m.values()).sort((x, y) => (tempo(y.ultima) - tempo(x.ultima)) || x.nome.localeCompare(y.nome, 'pt'))
    if (lista.length) saida.set(id, lista)
  })
  return saida
}

// Procedimentos da pessoa que casam com o termo (trecho, sem acento/caixa).
// Termo vazio não casa nada: "sem filtro" é decisão de quem chama.
export function casaProcedimento(procs: ProcedimentoFeito[] | undefined, termo: string): ProcedimentoFeito[] {
  const q = chaveProcedimento(termo)
  if (!q || !procs?.length) return []
  return procs.filter(p => p.chave.includes(q))
}

// Opções do filtro: o catálogo da clínica + o que já apareceu na Agenda
// (procedimento antigo pode nem estar no catálogo), cada um com QUANTOS
// PACIENTES o fizeram. O texto livre do "Último procedimento" fica fora da
// lista ("Botox e preenchimento" viraria uma opção torta), mas segue achado
// pelo filtro e pela busca, que casam por trecho. Catálogo que ninguém fez
// ainda aparece no fim, com 0.
export function opcoesFiltroProcedimento(mapa: Map<string, ProcedimentoFeito[]>, catalogo: string[] = []): { nome: string; pacientes: number }[] {
  const nomes = new Map<string, string>() // chave → grafia
  for (const n of catalogo || []) {
    const k = chaveProcedimento(n)
    if (k && !nomes.has(k)) nomes.set(k, String(n).trim())
  }
  mapa.forEach(lista => lista.forEach(p => { if (p.vezes > 0 && !nomes.has(p.chave)) nomes.set(p.chave, p.nome) }))
  const opcoes = Array.from(nomes.entries()).map(([k, nome]) => {
    let pacientes = 0
    mapa.forEach(lista => { if (lista.some(p => p.chave.includes(k))) pacientes++ })
    return { nome, pacientes }
  })
  return opcoes.sort((a, b) => (b.pacientes - a.pacientes) || a.nome.localeCompare(b.nome, 'pt'))
}
