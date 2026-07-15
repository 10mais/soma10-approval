// Alertas de vencimento da frota: documento (licenciamento/seguro/ANTT) prestes a
// vencer e revisão prevista chegando. Puro e testável — o cron só transforma o que
// sai daqui em Tarefa. Deixar um licenciamento vencer tira o carro da estrada, e é
// exatamente o tipo de prazo que ninguém lembra sem alguém cutucando.
//
// Tipos estruturais (não importa lib/redis, que abre conexão no import) — mesma
// convenção de lib/reservas.ts e lib/financeiroReserva.ts.

export type DocumentoLite = { id: string; tipo: string; numero?: string; vencimento: string }
export type ManutencaoLite = { id: string; tipo: string; proximaData?: string }
export type VeiculoLite = {
  id: string
  nome: string
  condicao?: string
  documentos?: DocumentoLite[]
  manutencoes?: ManutencaoLite[]
}

export type AlertaFrota = {
  chave: string      // dedupe estável: mesmo alerta não vira duas tarefas
  veiculoId: string
  titulo: string
  descricao: string
  quando: string     // YYYY-MM-DD — vira o prazo da tarefa
}

const ROTULO_DOC: Record<string, string> = {
  licenciamento: 'Licenciamento', seguro: 'Seguro', antt: 'ANTT', outro: 'Documento',
}
const ROTULO_MANUT: Record<string, string> = {
  preventiva: 'Manutenção preventiva', corretiva: 'Manutenção corretiva', revisao: 'Revisão',
  pneu: 'Troca de pneu', oleo: 'Troca de óleo', outro: 'Manutenção',
}

const ehData = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

// Dias entre duas datas YYYY-MM-DD (negativo = já passou). Sem hora: comparar
// meia-noite local dos dois lados evita o off-by-one de fuso.
export function diasEntre(de: string, ate: string): number {
  return Math.round((new Date(ate + 'T00:00').getTime() - new Date(de + 'T00:00').getTime()) / 86400000)
}

const dataBR = (ymd: string) => ymd.split('-').reverse().join('/')

// Alertas de UM veículo. Janela: vence em até `dias` OU já venceu (até `diasVencido`
// atrás — um licenciamento vencido há 6 meses não precisa virar tarefa nova todo dia).
// Veículo 'excluido' não gera alerta: saiu de circulação.
export function alertasDoVeiculo(v: VeiculoLite, hoje: string, dias = 30, diasVencido = 60): AlertaFrota[] {
  if (v.condicao === 'excluido') return []
  const out: AlertaFrota[] = []

  for (const d of v.documentos || []) {
    if (!ehData(d.vencimento)) continue
    const faltam = diasEntre(hoje, d.vencimento)
    if (faltam > dias || faltam < -diasVencido) continue
    const rotulo = ROTULO_DOC[d.tipo] || ROTULO_DOC.outro
    out.push({
      chave: `doc:${v.id}:${d.id}:${d.vencimento}`,
      veiculoId: v.id,
      titulo: `${rotulo} de ${v.nome} ${faltam < 0 ? 'venceu' : 'vence'} em ${dataBR(d.vencimento)}`,
      descricao: [
        `${rotulo}${d.numero ? ` nº ${d.numero}` : ''} do veículo ${v.nome}.`,
        faltam < 0 ? `Vencido há ${Math.abs(faltam)} dia(s).` : faltam === 0 ? 'Vence hoje.' : `Faltam ${faltam} dia(s).`,
      ].join(' '),
      quando: d.vencimento,
    })
  }

  for (const m of v.manutencoes || []) {
    if (!ehData(m.proximaData)) continue
    const faltam = diasEntre(hoje, m.proximaData!)
    if (faltam > dias || faltam < -diasVencido) continue
    const rotulo = ROTULO_MANUT[m.tipo] || ROTULO_MANUT.outro
    out.push({
      chave: `rev:${v.id}:${m.id}:${m.proximaData}`,
      veiculoId: v.id,
      titulo: `${rotulo} de ${v.nome} prevista para ${dataBR(m.proximaData!)}`,
      descricao: `Próxima ${rotulo.toLowerCase()} do veículo ${v.nome}. ${faltam < 0 ? `Atrasada há ${Math.abs(faltam)} dia(s).` : faltam === 0 ? 'É hoje.' : `Faltam ${faltam} dia(s).`}`,
      quando: m.proximaData!,
    })
  }

  return out.sort((a, b) => a.quando.localeCompare(b.quando))
}

export function alertasDaFrota(veiculos: VeiculoLite[], hoje: string, dias = 30, diasVencido = 60): AlertaFrota[] {
  return veiculos
    .flatMap(v => alertasDoVeiculo(v, hoje, dias, diasVencido))
    .sort((a, b) => a.quando.localeCompare(b.quando))
}
