// CNPJ — formatação e conferência dos dígitos verificadores.
//
// O campo é OPCIONAL (decisão do dono), mas CNPJ errado é pior que CNPJ vazio:
// ninguém confere de novo, e ele vai parar em contrato e nota. Então a tela
// formata enquanto se digita e AVISA quando os dígitos não fecham — sem impedir
// de salvar: quem cadastra às vezes tem só um pedaço do número.

export function soDigitosCnpj(v?: string): string {
  return (v || '').replace(/\D/g, '').slice(0, 14)
}

// 00.000.000/0000-00 conforme digita (sem "pular" para a frente).
export function formatarCnpj(v?: string): string {
  const d = soDigitosCnpj(v)
  if (!d) return ''
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

// Dígitos verificadores (módulo 11). Não consulta a Receita — só diz se o número
// é POSSÍVEL, o que já pega erro de digitação.
export function cnpjValido(v?: string): boolean {
  const d = soDigitosCnpj(v)
  if (d.length !== 14) return false
  if (/^(\d)\1{13}$/.test(d)) return false // 00000000000000 passa no módulo 11 e não existe

  const dv = (base: string, pesos: number[]) => {
    const soma = base.split('').reduce((s, n, i) => s + Number(n) * pesos[i], 0)
    const r = soma % 11
    return r < 2 ? 0 : 11 - r
  }
  const d1 = dv(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const d2 = dv(d.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return d1 === Number(d[12]) && d2 === Number(d[13])
}

// ————— CPF —————
// Varejo (telefonia): o cliente de balcão é PF (CPF) na maioria, mas pode ser PJ
// (CNPJ) numa venda para empresa. Um só campo "CPF/CNPJ" resolve os dois; a
// contagem de dígitos diz qual é (11 = CPF, 14 = CNPJ). Mesma filosofia do CNPJ:
// opcional, formata enquanto digita, AVISA se os dígitos não fecham, não impede.

export function soDigitosCpf(v?: string): string {
  return (v || '').replace(/\D/g, '').slice(0, 11)
}

// 000.000.000-00 conforme digita.
export function formatarCpf(v?: string): string {
  const d = soDigitosCpf(v)
  if (!d) return ''
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export function cpfValido(v?: string): boolean {
  const d = (v || '').replace(/\D/g, '')
  if (d.length !== 11) return false
  if (/^(\d)\1{10}$/.test(d)) return false // 00000000000 etc. passam no módulo 11 e não existem

  const dv = (base: string) => {
    const n = base.length + 1
    const soma = base.split('').reduce((s, x, i) => s + Number(x) * (n - i), 0)
    const r = (soma * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(d.slice(0, 9)) === Number(d[9]) && dv(d.slice(0, 10)) === Number(d[10])
}

// ————— CPF ou CNPJ (campo único do varejo) —————

// Só dígitos, até 14 (comporta CPF e CNPJ). É o valor que vai para o Redis.
export function soDigitosDoc(v?: string): string {
  return (v || '').replace(/\D/g, '').slice(0, 14)
}

// Até 11 dígitos formata como CPF; a partir daí, como CNPJ.
export function formatarDoc(v?: string): string {
  const d = soDigitosDoc(v)
  return d.length <= 11 ? formatarCpf(d) : formatarCnpj(d)
}

// 11 dígitos → confere CPF; 14 → confere CNPJ; qualquer outra contagem = incompleto.
export function docValido(v?: string): boolean {
  const d = soDigitosDoc(v)
  if (d.length === 11) return cpfValido(d)
  if (d.length === 14) return cnpjValido(d)
  return false
}

// Rótulo do que está digitado, para o aviso da tela.
export function tipoDoc(v?: string): 'cpf' | 'cnpj' | 'vazio' | 'incompleto' {
  const d = soDigitosDoc(v)
  if (!d) return 'vazio'
  if (d.length === 11) return 'cpf'
  if (d.length === 14) return 'cnpj'
  return 'incompleto'
}
