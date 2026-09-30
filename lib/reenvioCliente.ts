// "APROVAR E REENVIAR AO CLIENTE" — a ação da equipe no fim da rodada de ajuste (dono, 29/09:
// revisão interna obrigatória, 1 clique; aviso ao cliente = mensagem pronta para copiar).
// Roda NO NAVEGADOR (fetch + área de transferência): só importar em componente de tela.
// A regra do que muda na peça mora no servidor (PUT /api/posts → lib/rodadaAjuste.patchDoReenvio),
// a mesma dos outros botões de reenviar; aqui é só o clique único e a mensagem.

import { itensDaUltimaRodada, mensagemNovaVersao } from './rodadaAjuste'

export type ResultadoReenvio = { ok: boolean; erro?: string; post?: any; mensagem?: string; copiado?: boolean }

export async function aprovarEReenviar(p: { id: string; clienteId?: string; etapa?: string }): Promise<ResultadoReenvio> {
  // Status muda para aguardando: o servidor aplica a versão nova, arquiva a anterior com o
  // pedido e limpa o pedido. Peça da esteira volta para a etapa de aprovação do criativo
  // (é por ela que o portal do cliente lista); peça avulsa do Planner não ganha etapa.
  const corpo: Record<string, any> = { id: p.id, status: 'aguardando_aprovacao' }
  if (p.etapa) corpo.etapa = 'aprovacao_criativo'
  const r = await fetch('/api/posts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
    .then(x => x.json()).catch(() => null)
  if (!r || r.error || !r.post) return { ok: false, erro: r?.error || 'Não foi possível reenviar. Tente de novo.' }

  const tk = p.clienteId
    ? await fetch('/api/aprovacao-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId: p.clienteId }) }).then(x => x.json()).catch(() => null)
    : null
  const link = tk?.token ? `${window.location.origin}/aprovacoes/${tk.token}` : ''
  if (!link) return { ok: true, post: r.post, erro: 'Reenviado, mas não foi possível gerar o link do cliente.' }

  const mensagem = mensagemNovaVersao({ itens: itensDaUltimaRodada(r.post), link, dataPostagem: r.post.dataAgendada })
  let copiado = false
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(mensagem); copiado = true } } catch { /* sem permissão: a tela mostra a mensagem */ }
  return { ok: true, post: r.post, mensagem, copiado }
}
