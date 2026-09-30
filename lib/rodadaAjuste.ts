// RODADA DE AJUSTE — o cliente pede ajuste, o designer entrega a nova versão, a equipe revisa
// e a peça volta ao cliente. FASE 0 do plano de 29/09/2026 (memória
// proj-briefing-solicitacoes-cliente): consertar o circuito que estava quebrado.
//
// Dono, 29/09: "O cliente pede ajuste e chega para nós. Porém ainda não está fluido como o
// designer recebe essa solicitação, como ele substitui o criativo e como chega para o
// cliente aprovar novamente."
//
// O QUE ESTAVA QUEBRADO (código, 29/09):
//   - o ajuste do cliente mantém a peça em `aprovacao_criativo` + status `corrigir`, e o
//     gancho de concluir a tarefa (lib/esteiraFluxo.aoConcluirTarefa) só age em `criativo`:
//     o designer concluía e NADA voltava para a peça;
//   - a troca da arte dependia de alguém clicar "Substituir a mídia" no Studio;
//   - reenviar não limpava o pedido antigo: o cliente reabria e via os pinos velhos em cima
//     da arte nova; a versão anterior se perdia.
//
// COMO FICA:
//   1. Concluir a tarefa numa rodada vira VERSÃO NOVA PENDENTE (`versaoNova`). A arte do
//      cliente NÃO muda ainda: enquanto a peça está "em ajuste", o link mostra a arte com o
//      botão "Aprovar assim mesmo" — trocar ali deixaria o cliente aprovar uma versão que a
//      equipe não revisou (revisão interna obrigatória, decisão do dono).
//   2. A equipe revisa e reenvia (qualquer um dos botões de reenviar, mesma regra aqui no
//      servidor): a versão que o cliente viu vai para o histórico (`versoes`) COM o pedido
//      dela, a nova entra, o pedido é limpo, a rodada soma 1 e o prazo reinicia.
//   3. O histórico guarda também as versões descartadas — é por ele que se sabe qual anexo
//      da tarefa já foi usado, sem depender de o designer "rebaixar" o anexo antigo.

import { anexosCriativoPronto, type Anexo } from './producaoVinculo'

/** Status em que a peça está com o pedido do cliente em aberto. */
export const STATUS_RODADA = ['corrigir', 'reprovado']

export type AnotacaoPedido = { x?: number; y?: number; text?: string; texto?: string; img?: number; id?: any; resolvido?: boolean }

export type VersaoNova = {
  imagens: string[]
  entregueEm: string
  por?: string
  tarefaId?: string
  /** false = carrossel com menos arquivos que lâminas: não dá para trocar sozinho. */
  completa: boolean
}

export type VersaoArquivada = {
  n: number                 // rodada em que esta versão esteve com o cliente
  imagens: string[]
  legenda?: string
  pedido?: { texto?: string; anotacoes?: AnotacaoPedido[] }
  arquivadaEm: string
  status?: string           // corrigir | reprovado (o que o cliente decidiu sobre ela)
  descartada?: boolean      // entrega do designer que NÃO chegou ao cliente
  motivo?: string
}

export type PostRodada = {
  status?: string
  imagens?: string[]
  legenda?: string
  motivoReprovacao?: string
  ajusteCriativo?: string
  anotacoes?: AnotacaoPedido[]
  versaoNova?: VersaoNova
  versoes?: VersaoArquivada[]
  rodada?: number
}

export const emRodadaDeAjuste = (p?: { status?: string } | null) => !!p && STATUS_RODADA.includes(p.status || '')
export const rodadaAtual = (p: { rodada?: number }) => (p.rodada && p.rodada > 0 ? p.rodada : 1)

/** O texto do pedido. O link público grava em `motivoReprovacao`, o portal em `ajusteCriativo`. */
export const textoDoPedido = (p: { motivoReprovacao?: string; ajusteCriativo?: string }) =>
  String(p.motivoReprovacao || p.ajusteCriativo || '').trim()

const textoDoPino = (a: AnotacaoPedido) => String(a?.text ?? a?.texto ?? '').trim()

/** Itens do pedido: o recado geral primeiro, depois cada ponto marcado na arte. */
export function itensDoPedido(texto?: string, anotacoes?: AnotacaoPedido[]): string[] {
  const t = String(texto || '').trim()
  return [...(t ? [t] : []), ...(anotacoes || []).map(textoDoPino).filter(Boolean)]
}

/**
 * O pedido como ele chega à tarefa do designer. Antes o link público juntava os pinos e o
 * portal NEM mandava os pinos — agora as duas portas usam esta mesma função.
 */
export function feedbackParaTarefa(texto?: string, anotacoes?: AnotacaoPedido[]): string {
  const t = String(texto || '').trim()
  const pinos = (anotacoes || []).filter(a => textoDoPino(a))
  const lista = pinos.map((a, i) => `${i + 1}) ${textoDoPino(a)}${(a.img ?? 0) > 0 ? ` (lâmina ${(a.img as number) + 1})` : ''}`).join('; ')
  return [t, lista ? `Pontos marcados na arte: ${lista}` : ''].filter(Boolean).join(' — ')
}

// Toda URL que já passou por esta peça: a arte atual, as do histórico e a versão pendente.
function urlsConhecidas(p: PostRodada): Set<string> {
  const s = new Set<string>(p.imagens || [])
  for (const v of p.versoes || []) for (const u of v.imagens || []) s.add(u)
  for (const u of p.versaoNova?.imagens || []) s.add(u)
  return s
}

/**
 * A arte NOVA que o designer entregou na tarefa: o criativo pronto (lib/producaoVinculo) que
 * esta peça ainda não viu. O anexo da versão anterior continua na tarefa marcado como
 * criativo — é o histórico que o exclui, não o designer.
 */
export function novaVersaoDaTarefa(p: PostRodada, anexos: Anexo[] = []): { imagens: string[]; completa: boolean } | null {
  const conhecidas = urlsConhecidas(p)
  const novos = anexosCriativoPronto(anexos).map(a => a.url).filter(u => !!u && !conhecidas.has(u))
  if (!novos.length) return null
  const atuais = (p.imagens || []).length
  return { imagens: novos, completa: atuais <= 1 || novos.length >= atuais }
}

function registroDescartado(p: PostRodada, vn: VersaoNova, motivo: string, agora: string): VersaoArquivada {
  return { n: rodadaAtual(p), imagens: vn.imagens, arquivadaEm: agora, descartada: true, motivo }
}

/**
 * Concluiu a tarefa numa rodada de ajuste: a arte nova fica PENDENTE de revisão da equipe.
 * Devolve o patch do post, ou null quando não é rodada ou não veio arte nova.
 */
export function entregaNaRodada(p: PostRodada, anexos: Anexo[], por: string, tarefaId: string, agora: string): Record<string, any> | null {
  if (!emRodadaDeAjuste(p)) return null
  const nv = novaVersaoDaTarefa(p, anexos)
  if (!nv) return null
  return {
    versaoNova: { ...nv, entregueEm: agora, por, tarefaId },
    criativoEntregueEm: agora,
    ajusteInterno: undefined,
    atualizadoEm: agora,
    // Entrega que substitui outra ainda não revisada: a anterior fica registrada.
    ...(p.versaoNova ? { versoes: [...(p.versoes || []), registroDescartado(p, p.versaoNova, 'Substituída por uma entrega mais nova do designer', agora)] } : {}),
  }
}

/** Tira a versão pendente de cena, registrando o porquê. {} quando não há versão pendente. */
export function descartarVersaoNova(p: PostRodada, motivo: string, agora: string): Record<string, any> {
  if (!p.versaoNova) return {}
  return { versaoNova: undefined, versoes: [...(p.versoes || []), registroDescartado(p, p.versaoNova, motivo, agora)] }
}

const mesmasUrls = (a: string[], b: string[]) => a.length === b.length && a.every((u, i) => u === b[i])

/**
 * A peça sai da rodada rumo ao cliente de novo (qualquer botão de reenviar — Studio,
 * Planner, editor, Solicitações). Regra ÚNICA, aplicada no servidor:
 *   - a versão que o cliente viu vai para o histórico com o pedido dela;
 *   - a versão pendente do designer entra no lugar (se for completa e a equipe não montou a
 *     mídia à mão neste mesmo envio — aí vale o que a equipe montou);
 *   - pedido limpo (o link não recarrega os pinos velhos), rodada + 1, prazo reinicia;
 *   - reenviar É a revisão da equipe (criativoRevisaoInternaEm).
 * `imagensDoEnvio` = as imagens que vieram no mesmo pedido de reenvio (o editor manda todas).
 */
export function patchDoReenvio(antes: PostRodada, imagensDoEnvio: string[] | undefined, agora: string): Record<string, any> | null {
  if (!emRodadaDeAjuste(antes)) return null
  const versoes: VersaoArquivada[] = [...(antes.versoes || []), {
    n: rodadaAtual(antes),
    imagens: antes.imagens || [],
    legenda: antes.legenda,
    pedido: { texto: textoDoPedido(antes), anotacoes: antes.anotacoes || [] },
    arquivadaEm: agora,
    status: antes.status,
  }]
  const patch: Record<string, any> = {
    anotacoes: [],
    motivoReprovacao: undefined,
    ajusteCriativo: undefined,
    motivoResolvido: undefined,
    ajusteInterno: undefined,
    versaoNova: undefined,
    aguardandoDesde: agora,
    criativoRevisaoInternaEm: agora,
    rodada: rodadaAtual(antes) + 1,
  }
  const montouNaMao = Array.isArray(imagensDoEnvio) && !mesmasUrls(imagensDoEnvio, antes.imagens || [])
  if (antes.versaoNova) {
    if (antes.versaoNova.completa && !montouNaMao) patch.imagens = antes.versaoNova.imagens
    else versoes.push(registroDescartado(antes, antes.versaoNova, montouNaMao
      ? 'A equipe montou a mídia à mão no reenvio'
      : 'Entrega parcial do carrossel: não substituída automaticamente', agora))
  }
  patch.versoes = versoes
  return patch
}

/**
 * Aprovação com versão pendente no meio da rodada.
 *   - o CLIENTE aprovou ("Aprovar assim mesmo"): aprovou o que viu — a versão anterior. A do
 *     designer é descartada (registrada), nunca publicada sem ele ver;
 *   - a EQUIPE aprovou por cima (aprovação interna soberana): vale a versão nova, se completa.
 */
export function versaoNaAprovacao(p: PostRodada, porEquipe: boolean, agora: string): Record<string, any> {
  if (!p.versaoNova) return {}
  if (porEquipe && p.versaoNova.completa) {
    return {
      imagens: p.versaoNova.imagens,
      versaoNova: undefined,
      versoes: [...(p.versoes || []), { n: rodadaAtual(p), imagens: p.imagens || [], legenda: p.legenda, pedido: { texto: textoDoPedido(p), anotacoes: p.anotacoes || [] }, arquivadaEm: agora, status: p.status }],
    }
  }
  return descartarVersaoNova(p, porEquipe ? 'Aprovação interna com entrega parcial: mantida a arte anterior' : 'O cliente aprovou a versão anterior', agora)
}

/**
 * Para a tela Solicitações: o pedido de uma entrada do registro, sobre a ARTE QUE O CLIENTE
 * VIU. Se a rodada já foi encerrada (reenviada), o pedido e a arte estão no histórico — a
 * primeira versão não descartada arquivada depois do pedido. Senão, estão na peça.
 * (Antes a tela desenhava os pinos antigos em cima da arte atual.)
 */
export function pedidoDaEntrada(ts: number, p: PostRodada): { texto: string; anotacoes: AnotacaoPedido[]; imagens: string[]; encerrado: boolean } {
  const v = (p.versoes || []).find(x => !x.descartada && new Date(x.arquivadaEm).getTime() >= ts)
  if (v) return { texto: v.pedido?.texto || '', anotacoes: v.pedido?.anotacoes || [], imagens: v.imagens || [], encerrado: true }
  return { texto: textoDoPedido(p), anotacoes: p.anotacoes || [], imagens: p.imagens || [], encerrado: false }
}

/** Os itens da última rodada encerrada (para a mensagem de reenvio). */
export function itensDaUltimaRodada(p: PostRodada): string[] {
  const v = [...(p.versoes || [])].reverse().find(x => !x.descartada)
  return v ? itensDoPedido(v.pedido?.texto, v.pedido?.anotacoes) : []
}

/**
 * Mensagem pronta para colar no WhatsApp do cliente (decisão do dono, 29/09: o sistema monta,
 * nada é enviado sozinho). Data no fuso de Brasília, explícito — nunca o da máquina.
 */
export function mensagemNovaVersao(o: { itens: string[]; link: string; dataPostagem?: string }): string {
  let quando = ''
  if (o.dataPostagem) {
    const d = new Date(o.dataPostagem)
    if (!isNaN(d.getTime())) quando = ` do dia ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })}`
  }
  const itens = o.itens.map(i => i.replace(/\s+/g, ' ').trim()).filter(Boolean)
  return [
    `Olá! A nova versão do post${quando} está pronta para a sua aprovação${itens.length ? ', com os ajustes que você pediu:' : '.'}`,
    ...itens.map(i => `• ${i}`),
    '',
    `Para aprovar ou pedir outro ajuste: ${o.link}`,
  ].join('\n')
}
