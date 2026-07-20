// Processo de cidadania — ETAPAS do caso e matemática de progresso.
// Puro, client-safe, testável: NÃO importa lib/redis (que abre conexão no import).
// Esta é a CASA CANÔNICA das etapas: rota, componente e Redis (o tipo EtapaProcesso)
// referenciam daqui — não repetir a lista em outro lugar.
//
// O funil COMERCIAL (lead → contrato) vive no CRM. Aqui é a ENTREGA pós-venda:
// da viabilidade ao deferimento. 'deferido' = ganho (cidadania saiu); 'arquivado'
// = encerrado sem êxito (sem viabilidade, desistência).

export type EtapaProcesso =
  | 'viabilidade' | 'genealogia' | 'documentos' | 'traducao'
  | 'dossie' | 'protocolo' | 'acompanhamento' | 'deferido' | 'arquivado'

export type DefEtapa = {
  chave: EtapaProcesso
  label: string
  descricao: string
  ganho?: boolean   // desfecho de sucesso
  perdido?: boolean // desfecho de encerramento sem êxito
}

// Ordem do fluxo de trabalho. As duas últimas são DESFECHOS (fora da esteira
// linear): 'arquivado' pode acontecer a qualquer momento, 'deferido' é o fim feliz.
export const ETAPAS_PROCESSO: DefEtapa[] = [
  { chave: 'viabilidade', label: 'Viabilidade', descricao: 'Análise inicial: há linhagem elegível?' },
  { chave: 'genealogia', label: 'Pesquisa genealógica', descricao: 'Levantar a linha até o ascendente estrangeiro' },
  { chave: 'documentos', label: 'Coleta de documentos', descricao: 'Reunir certidões de cada pessoa da linhagem' },
  { chave: 'traducao', label: 'Apostilamento e tradução', descricao: 'Apostilar (Haia) e traduzir os documentos' },
  { chave: 'dossie', label: 'Montagem do dossiê', descricao: 'Organizar o processo para protocolo' },
  { chave: 'protocolo', label: 'Protocolo', descricao: 'Protocolar no órgão competente' },
  { chave: 'acompanhamento', label: 'Acompanhamento', descricao: 'Acompanhar a análise até a decisão' },
  { chave: 'deferido', label: 'Deferido', descricao: 'Cidadania reconhecida', ganho: true },
  { chave: 'arquivado', label: 'Arquivado', descricao: 'Encerrado sem êxito', perdido: true },
]

// Etapas do fluxo de trabalho (exclui os desfechos). É a régua do progresso.
export const ETAPAS_FLUXO: EtapaProcesso[] = ETAPAS_PROCESSO
  .filter(e => !e.ganho && !e.perdido)
  .map(e => e.chave)

export function etapaDef(chave?: string | null): DefEtapa | null {
  if (!chave) return null
  return ETAPAS_PROCESSO.find(e => e.chave === chave) || null
}

export function etapaLabel(chave?: string | null): string {
  return etapaDef(chave)?.label || 'Sem etapa'
}

// Índice na lista completa (inclui desfechos). -1 se desconhecida.
export function indiceEtapa(chave?: string | null): number {
  return ETAPAS_PROCESSO.findIndex(e => e.chave === chave)
}

export function ehFinal(chave?: string | null): boolean {
  const d = etapaDef(chave)
  return !!(d && (d.ganho || d.perdido))
}

// Progresso 0..1. Desfecho de sucesso = 1; arquivado = 0 (encerrado sem avanço
// relevante — não faz sentido "80% arquivado"). Nas etapas de fluxo, a posição
// na esteira: 1ª etapa não é 0 (já começou o trabalho) nem a última é 1 (falta o
// deferimento) — mapeia [0..ETAPAS_FLUXO.length] em (0..1).
export function progressoProcesso(chave?: string | null): number {
  const d = etapaDef(chave)
  if (!d) return 0
  if (d.ganho) return 1
  if (d.perdido) return 0
  const i = ETAPAS_FLUXO.indexOf(d.chave) // 0-based dentro do fluxo
  return Math.round(((i + 1) / (ETAPAS_FLUXO.length + 1)) * 100) / 100
}

// Próxima etapa na esteira. Da última etapa de fluxo ('acompanhamento') vai para
// 'deferido'. Desfechos não têm próxima (null).
export function proximaEtapa(chave?: string | null): EtapaProcesso | null {
  const d = etapaDef(chave)
  if (!d || d.ganho || d.perdido) return null
  const i = ETAPAS_FLUXO.indexOf(d.chave)
  if (i < ETAPAS_FLUXO.length - 1) return ETAPAS_FLUXO[i + 1]
  return 'deferido'
}

// Etapa anterior na esteira. A primeira não tem anterior; desfechos voltam para
// a última etapa de fluxo (reabrir um caso encerrado).
export function etapaAnterior(chave?: string | null): EtapaProcesso | null {
  const d = etapaDef(chave)
  if (!d) return null
  if (d.ganho || d.perdido) return ETAPAS_FLUXO[ETAPAS_FLUXO.length - 1]
  const i = ETAPAS_FLUXO.indexOf(d.chave)
  if (i > 0) return ETAPAS_FLUXO[i - 1]
  return null
}
