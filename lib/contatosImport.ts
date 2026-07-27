// Importação de CLIENTES/contatos em massa (varejo). PURO e testável. Entende o
// EXPORT do ERP do cliente por NOME de coluna: Nome, CPF/CNPJ, DDD+Celular (junta),
// E-mail, Nascimento (DD/MM/AAAA), Endereço/Cidade/UF. A rota /api/crm/contatos
// grava o lote (com lojaId). Sem cabeçalho reconhecido → cai no formato simples
// (Nome ; Telefone ; Email ; Empresa).
import { celulas } from './produtosImport'

export type ContatoImport = { nome: string; telefone?: string; email?: string; nascimento?: string; observacoes?: string; empresa?: string }

function achar(header: string[], ...pats: RegExp[]): number {
  for (const p of pats) { const i = header.findIndex(h => p.test(h)); if (i >= 0) return i }
  return -1
}

export function ehCabecalhoContato(header: string[]): boolean {
  const j = header.join(' ')
  return /nome/i.test(j) && /(cpf|cnpj|celular|fone|e-?mail|nascimento|endere)/i.test(j)
}

// DD/MM/AAAA -> AAAA-MM-DD (ignora o resto).
function dataBRparaYmd(s: string): string {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s || '')
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''
}

// Telefone: primeiro par (DDD + Celular) com valor; celular tem prioridade sobre
// fone fixo. DDD é a coluna 'DDD' imediatamente ANTES da coluna de número.
function telefoneDe(header: string[], c: string[]): string {
  const cels = header.map((h, i) => (/celular/i.test(h) ? i : -1)).filter(i => i >= 0)
  const fones = header.map((h, i) => (/fone/i.test(h) ? i : -1)).filter(i => i >= 0)
  for (const i of [...cels, ...fones]) {
    const num = (c[i] || '').replace(/\D/g, '')
    if (!num) continue
    const ddd = i > 0 && /ddd/i.test(header[i - 1]) ? (c[i - 1] || '').replace(/\D/g, '') : ''
    return (ddd + num).slice(0, 15)
  }
  return ''
}

export function parseContatosPlanilha(texto: string): { linhas: ContatoImport[]; ignoradas: number } {
  const grade = celulas(texto)
  if (!grade.length) return { linhas: [], ignoradas: 0 }
  const header = grade[0]
  const val = (c: string[], i: number) => (i >= 0 ? (c[i] || '').trim() : '')

  // Sem cabeçalho reconhecido: formato simples posicional (Nome;Telefone;Email;Empresa).
  if (!ehCabecalhoContato(header)) {
    const linhas: ContatoImport[] = []
    let ignoradas = 0
    for (const c of grade) {
      const nome = (c[0] || '').trim()
      if (!nome) { if (c.some(x => x)) ignoradas++; continue }
      linhas.push({ nome, telefone: (c[1] || '').trim() || undefined, email: (c[2] || '').trim() || undefined, empresa: (c[3] || '').trim() || undefined })
    }
    return { linhas, ignoradas }
  }

  const col = {
    nome: achar(header, /^nome$/i, /raz[ãa]o social/i, /nome fantasia/i, /nome/i),
    email: achar(header, /e-?mail/i),
    cpf: achar(header, /cpf|cnpj/i),
    nasc: achar(header, /nascimento/i),
    endereco: achar(header, /endere/i),
    nro: achar(header, /^nro$|n[uú]mero/i),
    bairro: achar(header, /bairro/i),
    cidade: achar(header, /cidade/i),
    uf: achar(header, /^uf$/i),
  }
  const linhas: ContatoImport[] = []
  let ignoradas = 0
  for (const c of grade.slice(1)) {
    const nome = val(c, col.nome)
    if (!nome) { if (c.some(x => x.trim())) ignoradas++; continue }
    const cpf = val(c, col.cpf)
    const endereco = [val(c, col.endereco), val(c, col.nro), val(c, col.bairro)].filter(Boolean).join(', ')
    const cidade = [val(c, col.cidade), val(c, col.uf)].filter(Boolean).join('/')
    const obs = [cpf ? `CPF/CNPJ: ${cpf}` : '', endereco, cidade].filter(Boolean).join(' · ')
    linhas.push({
      nome: nome.slice(0, 120),
      telefone: telefoneDe(header, c) || undefined,
      email: val(c, col.email) || undefined,
      nascimento: dataBRparaYmd(val(c, col.nasc)) || undefined,
      observacoes: obs || undefined,
    })
  }
  return { linhas, ignoradas }
}
