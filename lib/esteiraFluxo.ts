// Linha de montagem COPY > PRODUCAO: Studio > Tarefa > Planner.
//
// As TRANSICOES do fluxo vivem aqui, puras e testadas (tests/esteiraFluxo.test.ts),
// pelo mesmo motivo do lib/plannerFiltro: regra de fluxo inline em rota nao e
// alcancada por teste nenhum, e esta regra mexe no status de material do cliente.
//
// FLUXO VIGENTE (dono, 13/11/2026): a pauta nasce JUNTO com a tarefa (Social Media, fase da
// copy); copy aprovada passa a MESMA tarefa ao designer; designer entrega (Em revisão) e a
// pauta vira rascunho na Fila de programação; cliente aprova lá e a tarefa conclui; ajuste
// põe a tarefa Em ajuste. Memória: proj-fluxo-pauta-tarefa. O que segue é o histórico.
//
// O fluxo (decisoes do dono em 23/07):
//   1. copy produzida no Studio -> cliente aprova a copy (aprovacao_copy)
//   2. copy aprovada -> nasce a SUB-TAREFA do designer (deveCriarTarefaDesigner)
//   3. tarefa concluida -> pauta vai pro PLANNER COMO RASCUNHO (aoConcluirTarefa)
//   4. aprovacao do criativo segue o fluxo normal do Planner
//
// 20/10/2026 (dono): o plano do mês vira UMA tarefa (a "mãe", do Social Media / Copywriter) e
// cada pauta vira SUBTAREFA do designer quando a copy é aprovada, com prazo de 3 dias úteis
// antes da postagem. A subtarefa aparece no quadro e na barra do topo (70237e1) — em julho ela
// ficava invisível. Memória: proj-estudio-tarefa-unica.
import { diaDoInstante, subtrairDiasUteis } from './datas'
import type { SquadPapeis } from './squadPapeis'

// A automacao nunca tira o controle do humano: concluir/reabrir tarefa fora da
// etapa certa nao mexe na pauta, e nada aqui regride etapa.

// ENTREGA DO CRIATIVO (dono, 13/11/2026): "quando a tarefa for concluída (anexado o criativo
// pronto) ele já se vira uma postagem em rascunho como Fila de programação. Aí o colaborador
// abre, revisa e finaliza a programação." + "Quando o criativo é finalizado a tarefa passa para
// o status EM REVISÃO". A entrega (tarefa em Em revisão, ou concluída à mão, com criativo
// pronto) leva a pauta ao PROGRAMADOR: etapa 'pronto', status 'rascunho', marcada como na Fila
// de programação. O chamador grava `criativoEntregueEm`, `filaProgramacaoDesde` e as mídias.
// Histórico: 23/07 ia ao Planner como rascunho; 07/09 voltava ao Studio; 13/11 volta ao
// Programador, agora com a revisão e o envio ao cliente feitos na Fila de programação.
// Só age quando a pauta está em 'criativo' E há arte: sem criativo pronto nada vai ao
// Programador (a peça fica onde está). Qualquer outra etapa devolve null — entregar de novo,
// reabrir ou tarefa de pauta avulsa nunca regride nem re-dispara.
export function aoEntregarCriativo(etapa: string | undefined, temArte: boolean): { etapa: 'pronto'; status: 'rascunho'; naFila: true } | null {
  return etapa === 'criativo' && temArte ? { etapa: 'pronto', status: 'rascunho', naFila: true } : null
}

// Status que contam como ENTREGA do criativo pelo designer: Em revisão (o caminho do dono) e
// Concluído (quem conclui à mão antes da aprovação — a arte não pode ficar parada na tarefa).
export const STATUS_DE_ENTREGA = ['em_revisao', 'concluido']

// Cliente ou revisão interna pediu ajuste: a tarefa vai para EM AJUSTE (dono, 13/11). Tarefa
// descartada fica como está (alguém decidiu parar a peça; o ajuste não ressuscita).
export function statusAoPedirAjuste(statusAtual?: string): string {
  return statusAtual === 'descartado' ? 'descartado' : 'em_ajuste'
}

// PRAZO DA COPY (fase do Social Media, quando a tarefa nasce junto com a pauta): 2 dias úteis
// antes do prazo do criativo, para a copy ser aprovada a tempo de a arte ser feita. Nunca nasce
// atrasada (vira hoje). Sem data de postagem, sem prazo. Devolve AAAA-MM-DD.
export const DIAS_UTEIS_DA_COPY_ANTES_DO_CRIATIVO = 2
export function prazoDaCopy(dataPostagem: string | undefined, hoje: string): string {
  const criativo = prazoDoCriativo(dataPostagem, hoje)
  if (!criativo) return ''
  const alvo = subtrairDiasUteis(criativo, DIAS_UTEIS_DA_COPY_ANTES_DO_CRIATIVO)
  return alvo < hoje ? hoje : alvo
}

// Copy aprovada => nasce a tarefa do designer. Idempotente: pauta que ja tem
// tarefa vinculada (post.tarefaId) nao ganha outra — o chamador reabre a
// existente (copy reaprovada apos ajuste).
export function deveCriarTarefaDesigner(post: { etapa?: string; tarefaId?: string }): boolean {
  return post.etapa === 'criativo' && !post.tarefaId
}

// Descricao da tarefa do designer: a copy aprovada INTEIRA, pronta para
// producao. HTML simples porque Tarefa.descricao e texto rico na UI.
// FORMATO da pauta -> TIPO da tarefa. O tipo não é enfeite: ele pinta o chip no
// kanban e escolhe o checklist de Definition of Done (carrossel ganha
// "Design das lâminas", reel ganha "Gravação"). Nascer tudo como 'criativo'
// escondia que a peça era um carrossel de N lâminas.
export function tipoTarefaDoFormato(formato?: string): 'carrossel' | 'reel' | 'story' | 'post' | 'criativo' {
  switch (formato) {
    case 'carrossel': return 'carrossel'
    case 'reel': return 'reel'
    case 'story': return 'story'
    case 'feed': return 'post'
    // 'grafico' (banner, fachada, revista) e formato ausente ficam no genérico.
    default: return 'criativo'
  }
}

// Abertura da descrição: diz POR QUE a tarefa existe. Criada à mão a partir de um
// briefing, "copy aprovada pelo cliente" seria mentira — e o designer trabalharia
// achando que o texto já passou pelo cliente.
function aberturaTarefa(origem?: { manual?: boolean; etapa?: string }): string {
  if (!origem?.manual) return '<p><strong>Copy aprovada pelo cliente — produzir o criativo.</strong></p>'
  if (origem.etapa === 'briefing') return '<p><strong>Tarefa criada a partir do briefing da pauta.</strong> A copy ainda não foi escrita.</p>'
  if (origem.etapa === 'copy' || origem.etapa === 'aprovacao_copy') return '<p><strong>Tarefa criada a partir da pauta.</strong> A copy ainda NÃO foi aprovada pelo cliente.</p>'
  return '<p><strong>Tarefa criada a partir da pauta do Studio.</strong></p>'
}

export function descricaoTarefaDesigner(post: {
  briefing?: string; headline?: string; subheadline?: string
  textoImagem?: string; cta?: string; legenda?: string; sugestaoImagem?: string
  laminas?: { texto: string }[]
  medidas?: string; localAplicacao?: string
  formato?: string
}, origem?: { manual?: boolean; etapa?: string }): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const nLaminas = (post.laminas || []).length
  // Carrossel precisa anunciar QUANTAS lâminas: o designer dimensiona o trabalho
  // por isso, e lâmina sem texto (só com anexo) não aparece na lista abaixo.
  const formatoTxt = post.formato === 'carrossel'
    ? `Carrossel${nLaminas ? ` · ${nLaminas} lâmina${nLaminas > 1 ? 's' : ''}` : ''}`
    : post.formato === 'reel' ? 'Reel'
    : post.formato === 'story' ? 'Story'
    : post.formato === 'feed' ? 'Feed (imagem única)'
    : post.formato === 'grafico' ? 'Material gráfico'
    : ''
  const linhas = [
    aberturaTarefa(origem),
    formatoTxt ? `<p><strong>Formato:</strong> ${formatoTxt}</p>` : '',
    post.briefing ? `<p><strong>Briefing:</strong> ${esc(post.briefing)}</p>` : '',
    // Material gráfico: as specs vêm ANTES do texto — o designer produz na medida certa.
    post.localAplicacao ? `<p><strong>Local de aplicação:</strong> ${esc(post.localAplicacao)}</p>` : '',
    post.medidas ? `<p><strong>Medidas:</strong> ${esc(post.medidas)}</p>` : '',
    post.headline ? `<p><strong>Headline:</strong> ${esc(post.headline)}</p>` : '',
    post.subheadline ? `<p><strong>Sub-headline:</strong> ${esc(post.subheadline)}</p>` : '',
    post.textoImagem ? `<p><strong>Texto na arte:</strong> ${esc(post.textoImagem)}</p>` : '',
    // Carrossel: a copy vem separada lâmina por lâmina — o designer produz nessa ordem.
    ...(post.laminas || []).map((l, i) => l.texto ? `<p><strong>Lâmina ${i + 1}:</strong> ${esc(l.texto)}</p>` : ''),
    post.cta ? `<p><strong>CTA:</strong> ${esc(post.cta)}</p>` : '',
    post.sugestaoImagem ? `<p><strong>Direção de criativo:</strong> ${esc(post.sugestaoImagem)}</p>` : '',
    post.legenda ? `<p><strong>Legenda aprovada:</strong><br>${esc(post.legenda).replace(/\n/g, '<br>')}</p>` : '',
  ]
  return linhas.filter(Boolean).join('')
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

// Titulo da tarefa-mae do plano (nasce lazy na primeira copy aprovada).
export function tituloTarefaMae(plano: { clienteNome?: string; mes: number; ano: number; titulo?: string }): string {
  const mes = MESES[plano.mes - 1] || String(plano.mes)
  const base = `Plano de conteúdo — ${plano.clienteNome || 'Cliente'} — ${mes}/${plano.ano}`
  return plano.titulo ? `${base} · ${plano.titulo}` : base
}

// Titulo da sub-tarefa: mesma regra do relacionar (briefing > headline > legenda),
// colapsando espacos e cortando em 80.
export function tituloSubtarefa(pauta: { briefing?: string; headline?: string; legenda?: string }): string {
  const t = (pauta.briefing || pauta.headline || pauta.legenda || '').toString().replace(/\s+/g, ' ').trim().slice(0, 80)
  return t || 'Pauta'
}

// Prazo da tarefa-mae: a maior dataAgendada valida entre as pautas; sem nenhuma,
// o ultimo dia do mes do plano. Sempre ISO.
export function prazoTarefaMae(pautas: { dataAgendada?: string }[], plano: { mes: number; ano: number }): string {
  let max = ''
  for (const p of pautas || []) {
    if (!p?.dataAgendada) continue
    const d = new Date(p.dataAgendada)
    if (isNaN(d.getTime())) continue
    const iso = d.toISOString()
    if (iso > max) max = iso
  }
  if (max) return max
  // Date.UTC(ano, mes, 0): dia zero do mes SEGUINTE = ultimo dia do mes do plano (mes e 1-12).
  return new Date(Date.UTC(plano.ano, plano.mes, 0, 23, 59, 0)).toISOString()
}

// PRAZO FINAL do criativo (subtarefa do designer): 3 dias ÚTEIS antes da postagem — sobra tempo
// para a revisão interna e a aprovação do cliente (dono, 20/10/2026). Copy aprovada em cima da
// hora não nasce atrasada: o prazo vira HOJE. Sem data de postagem, sem prazo. Devolve AAAA-MM-DD.
export const DIAS_UTEIS_ANTES_DA_POSTAGEM = 3
export function prazoDoCriativo(dataPostagem: string | undefined, hoje: string): string {
  const dia = diaDoInstante(dataPostagem)
  if (!dia) return ''
  const alvo = subtrairDiasUteis(dia, DIAS_UTEIS_ANTES_DA_POSTAGEM)
  return alvo < hoje ? hoje : alvo
}

// AVISO "pauta para produzir" (dono, 20/10/2026: "O Designer precisa receber as notificações").
// Várias pautas do mesmo cliente em poucos minutos (o cliente aprova as copies de uma vez) viram
// UM aviso só, que vai sendo atualizado — dez pushes seguidos no celular fazem o designer silenciar.
export function avisoPautasNovas(clienteNome: string | undefined, titulos: string[], prazoTexto?: string, fase: 'copy' | 'criativo' = 'criativo'): { titulo: string; mensagem: string } {
  const cli = (clienteNome || '').trim() || 'Cliente'
  const lista = titulos.map(t => (t || '').trim() || 'Pauta')
  if (fase === 'copy') {
    if (lista.length <= 1) return { titulo: `Copy para escrever — ${cli}`, mensagem: `A pauta "${lista[0] || 'Pauta'}" nasceu e está com você para a copy.${prazoTexto ? ` Prazo: ${prazoTexto}.` : ''}` }
    const prim = lista.slice(0, 3).map(t => `"${t}"`).join(', ')
    return { titulo: `${lista.length} copies para escrever — ${cli}`, mensagem: `Estão com você: ${prim}${lista.length > 3 ? ` e mais ${lista.length - 3}` : ''}.` }
  }
  if (lista.length <= 1) {
    return { titulo: `Pauta para produzir — ${cli}`, mensagem: `A pauta "${lista[0] || 'Pauta'}" está com você.${prazoTexto ? ` Prazo: ${prazoTexto}.` : ''}` }
  }
  const primeiras = lista.slice(0, 3).map(t => `"${t}"`).join(', ')
  const resto = lista.length > 3 ? ` e mais ${lista.length - 3}` : ''
  return { titulo: `${lista.length} pautas para produzir — ${cli}`, mensagem: `Estão com você: ${primeiras}${resto}.` }
}

// DONO da tarefa do plano: o Social Media / Copywriter do squad (dono, 20/10/2026). Papel vago
// cai no gestor de projetos, depois no gestor da operação (mesma cadeia do responsavelPorTipo).
export function donoDoPlano(papeis?: SquadPapeis | null): string {
  for (const p of ['social_media', 'gestor_projetos', 'gestor_operacao'] as const) {
    const e = (papeis?.[p] || '').trim()
    if (e) return e
  }
  return ''
}

// REVISÃO INTERNA do criativo (dono, 07/09: "a aprovação do criativo é primeiro
// interna, então a equipe precisa conduzir essa parte"). Quando a tarefa do
// designer entrega o criativo (criativoEntregueEm), a pauta fica PENDENTE de
// revisão interna até alguém da equipe aprovar (criativoRevisaoInternaEm) ou
// pedir ajuste (que limpa a entrega e reabre a tarefa). Pauta sem entrega de
// tarefa (arte subida à mão no Studio) não passa por este portão: 'nao_se_aplica'.
// 'aguardando_designer': a equipe pediu ajuste e a nova entrega ainda nao veio —
// a arte antiga continua na pauta, mas NAO pode ir ao cliente.
export type RevisaoInterna = 'nao_se_aplica' | 'pendente' | 'aprovada' | 'aguardando_designer'
export function revisaoInternaDoCriativo(p: { criativoEntregueEm?: string; criativoRevisaoInternaEm?: string; etapa?: string; ajusteInterno?: string }): RevisaoInterna {
  if (!p.criativoEntregueEm) return p.ajusteInterno && p.etapa === 'criativo' ? 'aguardando_designer' : 'nao_se_aplica'
  if (p.criativoRevisaoInternaEm && p.criativoRevisaoInternaEm >= p.criativoEntregueEm) return 'aprovada'
  return p.etapa === 'criativo' ? 'pendente' : 'aprovada'
}
// Enviar ao cliente só com a revisão interna feita (ou quando ela não se aplica).
export function podeEnviarAoCliente(p: { criativoEntregueEm?: string; criativoRevisaoInternaEm?: string; etapa?: string; ajusteInterno?: string }): boolean {
  const r = revisaoInternaDoCriativo(p)
  return r !== 'pendente' && r !== 'aguardando_designer'
}
