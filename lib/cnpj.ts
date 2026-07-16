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
