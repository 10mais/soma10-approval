// Resposta da Assistente no raio-X do lead (client-safe, sem I/O): interpreta o
// que a IA devolveu. Mesma escolha do parseSugestoes — texto de LLM não tem
// contrato, então prefere devolver `null` a devolver lixo: a tela mostra erro em
// vez de uma orientação inventada com cara de certeza.

export type OrientacaoLead = {
  leitura: string        // o que está acontecendo nesta conversa
  proximaAcao: string    // o que fazer AGORA
  mensagem: string       // texto pronto para enviar (o atendente edita antes)
  alertas: string[]      // riscos/objeções a não pisar
  fase: string           // fase do método em que a conversa está
}

const txt = (v: unknown, max = 600) => String(v ?? '').trim().slice(0, max)

export function parseOrientacao(bruto: string): OrientacaoLead | null {
  if (typeof bruto !== 'string') return null
  const ini = bruto.indexOf('{')
  const fim = bruto.lastIndexOf('}')
  if (ini < 0 || fim <= ini) return null
  let o: any
  try { o = JSON.parse(bruto.slice(ini, fim + 1)) } catch { return null }
  if (!o || typeof o !== 'object') return null
  const orientacao: OrientacaoLead = {
    leitura: txt(o.leitura),
    proximaAcao: txt(o.proximaAcao),
    mensagem: txt(o.mensagem, 1200),
    alertas: Array.isArray(o.alertas) ? o.alertas.map((a: unknown) => txt(a, 200)).filter(Boolean).slice(0, 4) : [],
    fase: txt(o.fase, 60),
  }
  // Sem leitura E sem próxima ação não sobrou orientação nenhuma — só uma caixa
  // vazia bonita. Melhor a tela dizer que não deu certo.
  if (!orientacao.leitura && !orientacao.proximaAcao) return null
  return orientacao
}
