// Pacotes de tratamento (clínica): venda de N sessões de um serviço a um paciente;
// cada atendimento consome uma sessão. Chaves Redis: `pacote:{id}`, set `pacotes`.
// Client-safe (sem import de redis) — reusado na UI e nos testes.

export type PacoteSessao = {
  id: string
  data: string            // ISO — quando a sessão foi realizada
  agendamentoId?: string  // atendimento da agenda que consumiu (quando veio de lá)
  profissionalNome?: string
  nota?: string
  registradoPor?: string
}

export type StatusPacote = 'ativo' | 'concluido' | 'cancelado'

export type Pacote = {
  id: string
  contatoId: string
  pacienteNome: string    // desnormalizado p/ exibir sem recarregar o contato
  titulo: string          // ex.: "10 sessões de Limpeza de Pele"
  servico?: string
  totalSessoes: number
  valor: number           // valor total do pacote (R$)
  sessoes: PacoteSessao[] // consumo — length = sessões usadas
  cancelado?: boolean
  vendidoPor?: string
  criadoPor?: string
  criadoEm: string
  atualizadoEm: string
}

export function usadas(p: Pick<Pacote, 'sessoes'>): number {
  return p.sessoes?.length || 0
}

export function restantes(p: Pick<Pacote, 'sessoes' | 'totalSessoes'>): number {
  return Math.max(0, (p.totalSessoes || 0) - usadas(p))
}

// Concluído quando não há sessões a usar; cancelado manda sobre tudo.
export function statusPacote(p: Pick<Pacote, 'sessoes' | 'totalSessoes' | 'cancelado'>): StatusPacote {
  if (p.cancelado) return 'cancelado'
  return (p.totalSessoes || 0) > 0 && restantes(p) === 0 ? 'concluido' : 'ativo'
}

export function valorPorSessao(p: Pick<Pacote, 'valor' | 'totalSessoes'>): number {
  const n = p.totalSessoes || 0
  return n > 0 ? (p.valor || 0) / n : 0
}

// Pode consumir mais uma sessão? (ativo e ainda há saldo)
export function podeConsumir(p: Pick<Pacote, 'sessoes' | 'totalSessoes' | 'cancelado'>): boolean {
  return !p.cancelado && restantes(p) > 0
}
