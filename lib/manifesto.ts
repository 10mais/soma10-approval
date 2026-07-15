// MANIFESTO de passageiros: a lista oficial que sai do sistema — DAER/ANTT
// (nacional) ou lista internacional. Puro, client-safe, testável.
//
// Por que isto existe separado: lista rejeitada por dado faltando é retrabalho na
// véspera da viagem. A validação roda na tela (avisando cedo, na venda) e na
// exportação (barrando a lista incompleta), a partir da MESMA regra.
//
// Nacional  → nome completo + nascimento + um documento (CPF ou RG).
// Internacional → o de cima + passaporte com validade + nacionalidade.

export type PassageiroLite = {
  nome?: string
  cpf?: string
  rg?: string
  rgOrgao?: string
  nascimento?: string
  passaporte?: string
  passaporteValidade?: string
  nacionalidade?: string
  poltrona?: string
}

export type ReservaLite = {
  contratanteNome?: string
  passageiros?: PassageiroLite[]
  status?: string
}

export type ViagemManifesto = {
  titulo?: string
  dataIda?: string
  dataVolta?: string
  internacional?: boolean
}

const vazio = (s?: string) => !String(s || '').trim()
const ehData = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
// Só dígitos: o CPF chega formatado ou não, dependendo de quem digitou.
export const soDigitos = (s?: string) => String(s || '').replace(/\D/g, '')

// CPF válido pelos dígitos verificadores. Não basta ter 11 dígitos: "111.111.111-11"
// passaria e a Receita/DAER recusaria a lista inteira.
export function cpfValido(cpf?: string): boolean {
  const d = soDigitos(cpf)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const dig = (ate: number) => {
    let soma = 0
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * (ate + 1 - i)
    const r = (soma * 10) % 11
    return r === 10 ? 0 : r
  }
  return dig(9) === Number(d[9]) && dig(10) === Number(d[10])
}

// O que falta neste passageiro para ele entrar na lista. Vazio = pronto.
export function pendenciasDoPassageiro(p: PassageiroLite, internacional = false): string[] {
  const out: string[] = []
  const nome = String(p?.nome || '').trim()
  if (!nome) out.push('nome')
  // Nome completo: a lista pede nome civil, não apelido.
  else if (nome.split(/\s+/).length < 2) out.push('sobrenome')
  if (vazio(p?.cpf) && vazio(p?.rg)) out.push('CPF ou RG')
  if (!vazio(p?.cpf) && !cpfValido(p.cpf)) out.push('CPF inválido')
  if (!ehData(p?.nascimento)) out.push('nascimento')
  if (internacional) {
    if (vazio(p?.passaporte)) out.push('passaporte')
    if (!ehData(p?.passaporteValidade)) out.push('validade do passaporte')
    if (vazio(p?.nacionalidade)) out.push('nacionalidade')
  }
  return out
}

export const passageiroPronto = (p: PassageiroLite, internacional = false) => pendenciasDoPassageiro(p, internacional).length === 0

// Passageiro pode nascer sem poltrona (a viagem pode nem ter veículo ainda), mas
// não sem nome — é o mínimo para existir na reserva. As demais pendências avisam
// sem travar a venda; quem barra a lista incompleta é a exportação.
export const passageiroSalvavel = (p: PassageiroLite) => !vazio(p?.nome)

export type LinhaManifesto = {
  poltrona: string
  nome: string
  documento: string
  nascimento: string
  contratante: string
  pendencias: string
}

const fmtData = (s?: string) => (ehData(s) ? s!.split('-').reverse().join('/') : '')
const fmtCPF = (s?: string) => {
  const d = soDigitos(s)
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : String(s || '')
}

// Uma linha por passageiro de TODAS as reservas que não foram canceladas.
// Ordena por poltrona (numérica) e, sem poltrona, por nome — é como a lista é lida
// na porta do ônibus.
export function linhasManifesto(viagem: ViagemManifesto, reservas: ReservaLite[]): LinhaManifesto[] {
  const internacional = !!viagem?.internacional
  const linhas: LinhaManifesto[] = []
  for (const r of reservas || []) {
    if (r?.status === 'cancelada') continue
    for (const p of r?.passageiros || []) {
      const doc = internacional
        ? [p.passaporte ? `Passaporte ${p.passaporte}` : '', p.nacionalidade || ''].filter(Boolean).join(' · ')
        : [p.cpf ? `CPF ${fmtCPF(p.cpf)}` : '', p.rg ? `RG ${p.rg}${p.rgOrgao ? `/${p.rgOrgao}` : ''}` : ''].filter(Boolean).join(' · ')
      linhas.push({
        poltrona: p.poltrona || '',
        nome: String(p.nome || '').trim(),
        documento: doc,
        nascimento: fmtData(p.nascimento),
        contratante: String(r.contratanteNome || '').trim(),
        pendencias: pendenciasDoPassageiro(p, internacional).join(', '),
      })
    }
  }
  return linhas.sort((a, b) => {
    if (a.poltrona && b.poltrona) return Number(a.poltrona) - Number(b.poltrona) || a.nome.localeCompare(b.nome, 'pt')
    if (a.poltrona) return -1
    if (b.poltrona) return 1
    return a.nome.localeCompare(b.nome, 'pt')
  })
}

// Campo de CSV: aspas dobradas e envelopadas. Nome com vírgula ("Silva, João")
// quebraria a planilha inteira do DAER sem isto.
export function campoCSV(v: string): string {
  const s = String(v ?? '')
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// CSV do manifesto. Separador ';' e BOM: é o que o Excel em pt-BR abre em colunas
// sem o usuário ter que importar nada.
export function manifestoCSV(viagem: ViagemManifesto, reservas: ReservaLite[]): string {
  const internacional = !!viagem?.internacional
  const linhas = linhasManifesto(viagem, reservas)
  const cab = ['Poltrona', 'Nome completo', internacional ? 'Passaporte / Nacionalidade' : 'Documento', 'Nascimento', 'Contratante', 'Pendências']
  const corpo = linhas.map(l => [l.poltrona, l.nome, l.documento, l.nascimento, l.contratante, l.pendencias].map(campoCSV).join(';'))
  return '﻿' + [cab.map(campoCSV).join(';'), ...corpo].join('\r\n')
}

// Nome do arquivo: "manifesto-rio-de-janeiro-27-07-2026.csv".
export function nomeArquivoManifesto(viagem: ViagemManifesto): string {
  const slug = String(viagem?.titulo || 'viagem')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'viagem'
  const data = ehData(viagem?.dataIda) ? viagem!.dataIda!.split('-').reverse().join('-') : ''
  return `manifesto-${slug}${data ? `-${data}` : ''}.csv`
}
