// Linha de montagem COPY > PRODUCAO: Studio > Tarefa > Planner.
//
// As TRANSICOES do fluxo vivem aqui, puras e testadas (tests/esteiraFluxo.test.ts),
// pelo mesmo motivo do lib/plannerFiltro: regra de fluxo inline em rota nao e
// alcancada por teste nenhum, e esta regra mexe no status de material do cliente.
//
// O fluxo (decisoes do dono em 23/07):
//   1. copy produzida no Studio -> cliente aprova a copy (aprovacao_copy)
//   2. copy aprovada -> nasce a SUB-TAREFA do designer (deveCriarTarefaDesigner)
//   3. tarefa concluida -> pauta vai pro PLANNER COMO RASCUNHO (aoConcluirTarefa)
//   4. aprovacao do criativo segue o fluxo normal do Planner
//
// A automacao nunca tira o controle do humano: concluir/reabrir tarefa fora da
// etapa certa nao mexe na pauta, e nada aqui regride etapa.

// Concluir a tarefa do designer devolve a pauta ao STUDIO com o criativo pronto
// (decisao do dono, 07/09: "inicia no Studio, quando aprovado vira tarefa; quando
// a tarefa for concluida, volta pro Studio" — e do Studio a equipe sobe para
// aprovacao do cliente ou para o Planner). A pauta fica em 'criativo' (etapa da
// arte), status rascunho, e o chamador grava `criativoEntregueEm` + as midias.
// Antes (23/07) ia direto ao Planner como rascunho; isso pulava a revisao no Studio.
// So age quando a pauta esta em 'criativo'. Qualquer outra etapa — inclusive
// aprovacoes (bola do cliente) e 'pronto' (ja no Planner) — devolve null: concluir
// de novo, reabrir ou tarefa de pauta avulsa sem esteira nunca regride nem re-dispara.
export function aoConcluirTarefa(etapa?: string): { etapa: 'criativo'; status: 'rascunho'; voltaAoStudio: true } | null {
  return etapa === 'criativo' ? { etapa: 'criativo', status: 'rascunho', voltaAoStudio: true } : null
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
