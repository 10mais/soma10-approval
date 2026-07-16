// Telefone brasileiro → o número que o WhatsApp usa (DDI 55 + DDD + número).
//
// Por que existe: a base de contatos foi digitada por gente, e cada um escreveu
// de um jeito — "55 999766707", "(55) 99976-6707", "+55 55 99976-6707". O
// WhatsApp, não: a conversa dele é sempre o número COMPLETO com o 55 do país
// (5555999766707). Sem traduzir de um para o outro:
//   1. abrir a conversa pela ficha criava uma thread NOVA e vazia (o número sem
//      o 55 é outro id) — foi o que o dono viu: "Sem mensagens";
//   2. enviar por ali mandaria a mensagem para um número ERRADO;
//   3. a conversa nunca casava com o contato, e ficava o número cru na tela.
//
// Regra do 9º dígito: NÃO inventamos nem removemos o 9. Celular antigo salvo com
// 8 dígitos continua com 8 — quem decide isso é a operadora, não nós; chutar
// mandaria mensagem para outra pessoa.

const DDD_MIN = 11 // não existe DDD abaixo de 11 no Brasil
const DDD_MAX = 99

export function soDigitos(t?: string): string {
  return (t || '').replace(/\D/g, '')
}

// Devolve o número no formato do WhatsApp (5555999766707) ou '' quando não dá
// para afirmar qual é — e aí é melhor não abrir conversa nenhuma do que abrir a
// errada.
export function telefoneWhatsApp(entrada?: string): string {
  let d = soDigitos(entrada)
  if (!d) return ''
  d = d.replace(/^0+/, '') // "055 99976..." — zero de operadora
  if (!d) return ''

  // Já vem completo: 55 + DDD válido + 8 ou 9 dígitos.
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) {
    const ddd = Number(d.slice(2, 4))
    if (ddd >= DDD_MIN && ddd <= DDD_MAX) return d
  }

  // Brasileiro sem o país: DDD + 8 ou 9 dígitos.
  if (d.length === 10 || d.length === 11) {
    const ddd = Number(d.slice(0, 2))
    if (ddd >= DDD_MIN && ddd <= DDD_MAX) return `55${d}`
  }

  // Estrangeiro, ramal, número quebrado: não dá para adivinhar sem risco.
  return ''
}

// Dois telefones são a mesma pessoa? Compara já normalizado; se algum for
// impossível de normalizar, cai na comparação dos dígitos crus (melhor achar por
// igualdade literal do que não achar).
export function mesmoTelefone(a?: string, b?: string): boolean {
  const na = telefoneWhatsApp(a), nb = telefoneWhatsApp(b)
  if (na && nb) return na === nb
  const da = soDigitos(a), db = soDigitos(b)
  return !!da && da === db
}
