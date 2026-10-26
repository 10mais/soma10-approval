// FILA DE PRODUÇÃO de criativos — dono, 26/10/2026: "Preciso de uma FILA DE PRODUÇÃO de
// criativos, onde os designers recebam os criativos para produzir e preencham qual o status...
// Essa esteira precisa estar visível no dashboard de toda equipe". Plano e decisões na memória
// proj-fila-producao. Puro e client-safe; testes em tests/filaProducao.test.ts.
//
// Um cartão = um criativo de pauta do Estúdio (copy já aprovada) + a subtarefa do designer.
// O designer move: Na fila, Em produção, Aguardando material (com motivo) e "Entregar" (conclui a
// tarefa com a arte). O resto anda sozinho pelo estado da pauta: Revisão interna, Com o cliente,
// Ajuste pedido (volta ao designer) e Aprovado (sai do quadro depois de 7 dias).
import { diaDoInstante, somarDias } from './datas'
import { revisaoInternaDoCriativo } from './esteiraFluxo'

export type ColunaFila = 'ajuste_pedido' | 'na_fila' | 'em_producao' | 'aguardando_material' | 'revisao_interna' | 'com_cliente' | 'aprovado'

/** Ordem na tela. Ajuste pedido primeiro: o cliente está esperando a nova versão. */
export const COLUNAS_FILA: { chave: ColunaFila; rotulo: string; doDesigner: boolean }[] = [
  { chave: 'ajuste_pedido', rotulo: 'Ajuste pedido', doDesigner: false },
  { chave: 'na_fila', rotulo: 'Na fila', doDesigner: true },
  { chave: 'em_producao', rotulo: 'Em produção', doDesigner: true },
  { chave: 'aguardando_material', rotulo: 'Aguardando material', doDesigner: true },
  { chave: 'revisao_interna', rotulo: 'Revisão interna', doDesigner: false },
  { chave: 'com_cliente', rotulo: 'Com o cliente', doDesigner: false },
  { chave: 'aprovado', rotulo: 'Aprovado', doDesigner: false },
]

/** Para onde o designer (ou quem coordena) pode mover um cartão. "Entregar" é concluir a tarefa. */
export type DestinoFila = 'na_fila' | 'em_producao' | 'aguardando_material'
export const DESTINOS_FILA: DestinoFila[] = ['na_fila', 'em_producao', 'aguardando_material']

/** Um cartão do quadro, como a API (/api/fila-producao) entrega para a tela. */
export type ItemFila = {
  postId: string; tarefaId?: string; clienteId: string; clienteNome: string; planoId?: string
  titulo: string; formato?: string; miniatura?: string
  designerEmail?: string; designerNome?: string
  prazo?: string; dataPostagem?: string
  coluna: ColunaFila; desde?: string
  alerta?: 'atrasado' | 'hoje'
  ajuste?: boolean; prontoParaEnviar?: boolean; semDesigner?: boolean
  aguardando?: { motivo: string; desde: string; por?: string }
  podeMover: boolean
}

/** Para onde o cartão pode ir a partir da coluna em que está (só nas colunas do designer). */
export function destinosDoCartao(coluna: ColunaFila): DestinoFila[] {
  switch (coluna) {
    case 'na_fila': case 'ajuste_pedido': return ['em_producao', 'aguardando_material']
    case 'em_producao': return ['na_fila', 'aguardando_material']
    case 'aguardando_material': return ['na_fila', 'em_producao']
    default: return []
  }
}

/** Onde o cartão aparece depois de mover: o ajuste pedido segue marcado até a entrega. */
export const colunaAposMover = (destino: DestinoFila, ajuste?: boolean): ColunaFila =>
  destino === 'na_fila' && ajuste ? 'ajuste_pedido' : destino

/** O movimento que devolve o cartão à coluna em que estava (para o Ctrl+Z). */
export function destinoDaColuna(coluna: ColunaFila): DestinoFila | null {
  if (coluna === 'na_fila' || coluna === 'ajuste_pedido') return 'na_fila'
  if (coluna === 'em_producao' || coluna === 'aguardando_material') return coluna
  return null
}

/** Soltou o cartão arrastado numa coluna: qual movimento isso é (null = a coluna não aceita). */
export function destinoAoSoltar(alvo: ColunaFila, cartao: { coluna: ColunaFila; ajuste?: boolean }): DestinoFila | null {
  if (alvo === cartao.coluna) return null
  // Peça em ajuste volta para "Ajuste pedido"; as outras, para "Na fila".
  const destino: DestinoFila | null =
    alvo === 'ajuste_pedido' ? (cartao.ajuste ? 'na_fila' : null)
    : alvo === 'na_fila' ? (cartao.ajuste ? null : 'na_fila')
    : alvo === 'em_producao' || alvo === 'aguardando_material' ? alvo
    : null
  return destino && destinosDoCartao(cartao.coluna).includes(destino) ? destino : null
}

const DIA = 86400000
const ABERTA = ['a_fazer', 'em_andamento']
const APROVADO_SAI_EM_DIAS = 7
const ms = (iso?: string) => { const n = iso ? new Date(iso).getTime() : NaN; return Number.isFinite(n) ? n : undefined }

export type PostFila = {
  id: string; status?: string; etapa?: string; excluidoEm?: string
  criativoEntregueEm?: string; criativoRevisaoInternaEm?: string; ajusteInterno?: string
  versaoNova?: unknown; criativoAprovadoEm?: string; etapaDesde?: string; aguardandoDesde?: string
}
export type TarefaFila = {
  id: string; status: string; ajustePedidoEm?: string; criadoEm?: string; atualizadoEm?: string; filaDesde?: string
  aguardandoMaterial?: { motivo: string; desde: string; por?: string }
}

/** Em que coluna o criativo está agora — ou null quando ele não pertence à fila. */
export function colunaDoCriativo(p: PostFila, t: TarefaFila | undefined, agora: number): ColunaFila | null {
  if (p.excluidoEm) return null
  // Só entra criativo de pauta do Estúdio com a copy aprovada.
  if (!p.etapa || p.etapa === 'briefing' || p.etapa === 'copy' || p.etapa === 'aprovacao_copy') return null
  // Aprovado/agendado/publicado: fica 7 dias à vista e sai.
  if (p.etapa === 'pronto' || ['aprovado', 'agendado', 'publicado', 'publicando'].includes(p.status || '')) {
    const desde = ms(p.criativoAprovadoEm || p.etapaDesde)
    return desde !== undefined && agora - desde > APROVADO_SAI_EM_DIAS * DIA ? null : 'aprovado'
  }
  // Designer com a tarefa aberta (inclusive refazendo um ajuste).
  if (t && ABERTA.includes(t.status)) {
    if (t.aguardandoMaterial) return 'aguardando_material'
    if (t.status === 'a_fazer') return t.ajustePedidoEm ? 'ajuste_pedido' : 'na_fila'
    return 'em_producao'
  }
  // A tarefa no "Em revisão" do quadro de Tarefas = entregue para a equipe revisar.
  if (t && t.status === 'em_revisao') return 'revisao_interna'
  // O cliente pediu ajuste: se o designer já entregou a nova versão, a equipe revisa; senão, ajuste.
  if (p.status === 'corrigir' || p.status === 'reprovado') return p.versaoNova ? 'revisao_interna' : 'ajuste_pedido'
  if (p.etapa === 'aprovacao_criativo' || p.status === 'aguardando_aprovacao') return 'com_cliente'
  if (p.criativoEntregueEm) return 'revisao_interna'
  // Criativo sem tarefa aberta e sem entrega (ex.: o squad não tem designer): espera na fila.
  return 'na_fila'
}

/** Desde quando o cartão está na coluna (para "há 2 dias"). Aproximado pelo que está gravado. */
export function desdeQuandoNaColuna(coluna: ColunaFila, p: PostFila, t: TarefaFila | undefined): string | undefined {
  switch (coluna) {
    case 'aguardando_material': return t?.aguardandoMaterial?.desde
    case 'ajuste_pedido': return t?.ajustePedidoEm || p.etapaDesde
    case 'na_fila': return t?.filaDesde || t?.criadoEm || p.etapaDesde
    case 'em_producao': return t?.filaDesde || t?.atualizadoEm
    case 'revisao_interna': return p.criativoEntregueEm || t?.atualizadoEm
    case 'com_cliente': return p.aguardandoDesde || p.etapaDesde
    case 'aprovado': return p.criativoAprovadoEm || p.etapaDesde
  }
}

/** Prazo do criativo em relação a hoje (dia de Brasília). Só conta nas colunas do designer. */
export function alertaDoPrazo(coluna: ColunaFila, prazo: string | undefined, agora: number): 'atrasado' | 'hoje' | null {
  if (!['ajuste_pedido', 'na_fila', 'em_producao', 'aguardando_material'].includes(coluna)) return null
  const dia = diaDoInstante(prazo)
  if (!dia) return null
  const hoje = diaDoInstante(new Date(agora).toISOString())
  return dia < hoje ? 'atrasado' : dia === hoje ? 'hoje' : null
}

/** Revisão interna com a arte aprovada pela equipe: falta só enviar ao cliente. */
export const prontoParaEnviar = (coluna: ColunaFila, p: PostFila): boolean =>
  coluna === 'revisao_interna' && revisaoInternaDoCriativo(p) === 'aprovada' && !p.versaoNova

/** Ordem dentro da coluna: atrasados primeiro, depois prazo do criativo, depois data de postagem. */
export function ordenarFila<T extends { prazo?: string; dataPostagem?: string; titulo?: string }>(itens: T[]): T[] {
  const chave = (x?: string) => ms(x) ?? Infinity
  return [...itens].sort((a, b) => (chave(a.prazo) - chave(b.prazo)) || (chave(a.dataPostagem) - chave(b.dataPostagem)) || (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR'))
}

/** Quem pode mover o cartão: o designer da peça, gestores do squad, gerente e admin. */
export function podeMoverCartao(quem: { email?: string; role?: string }, designerEmail?: string, gestores: string[] = []): boolean {
  if (quem.role === 'admin' || quem.role === 'gerente') return true
  const eu = (quem.email || '').trim().toLowerCase()
  if (!eu || quem.role === 'cliente') return false
  if ((designerEmail || '').trim().toLowerCase() === eu) return true
  return gestores.some(g => (g || '').trim().toLowerCase() === eu)
}

/** Dias corridos desde (para "há 2 dias"); 0 = hoje. */
export function diasDesde(iso: string | undefined, agora: number): number | undefined {
  const dia = diaDoInstante(iso)
  if (!dia) return undefined
  const hoje = diaDoInstante(new Date(agora).toISOString())
  let n = 0, d = dia
  while (d < hoje && n < 400) { d = somarDias(d, 1); n++ }
  return n
}
