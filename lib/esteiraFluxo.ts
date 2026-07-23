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

// Concluir a tarefa do designer manda a pauta pro Planner como RASCUNHO, com a
// copy aprovada. So age quando a pauta esta em 'criativo' (producao da arte).
// Qualquer outra etapa — inclusive aprovacoes (bola do cliente) e 'pronto' (ja
// no Planner) — devolve null: concluir de novo, reabrir ou tarefa de pauta
// avulsa sem esteira nunca regride nem re-dispara nada.
export function aoConcluirTarefa(etapa?: string): { etapa: 'pronto'; status: 'rascunho' } | null {
  return etapa === 'criativo' ? { etapa: 'pronto', status: 'rascunho' } : null
}

// Copy aprovada => nasce a tarefa do designer. Idempotente: pauta que ja tem
// tarefa vinculada (post.tarefaId) nao ganha outra — o chamador reabre a
// existente (copy reaprovada apos ajuste).
export function deveCriarTarefaDesigner(post: { etapa?: string; tarefaId?: string }): boolean {
  return post.etapa === 'criativo' && !post.tarefaId
}

// Descricao da tarefa do designer: a copy aprovada INTEIRA, pronta para
// producao. HTML simples porque Tarefa.descricao e texto rico na UI.
export function descricaoTarefaDesigner(post: {
  briefing?: string; headline?: string; subheadline?: string
  textoImagem?: string; cta?: string; legenda?: string; sugestaoImagem?: string
  laminas?: { texto: string }[]
  medidas?: string; localAplicacao?: string
}): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const linhas = [
    '<p><strong>Copy aprovada pelo cliente — produzir o criativo.</strong></p>',
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
