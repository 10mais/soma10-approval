// FICHA DO PACIENTE (clínica) — pedido do dono (04/11/2026): "dentro do próprio
// contato, colocar mais campos para informação como prontuário e também salvar
// informações passadas durante conversa do WhatsApp, info durante a
// experiência... isso vai alimentando o 'banco de dados' do paciente".
//
// Duas partes:
// 1. FICHA CLÍNICA (anamnese): o que vale para a PESSOA e muda pouco —
//    alergias, medicamentos, condições de saúde, o que já fez, o que busca. O
//    prontuário de CADA visita continua no atendimento da Agenda
//    (registroAtendimento), que a ficha já mostra no histórico.
// 2. O QUE SABEMOS: notas que a equipe vai juntando, cada uma com categoria,
//    origem (WhatsApp ou a própria ficha) e QUANDO foi dita (a hora da
//    mensagem, não a hora em que alguém clicou).
//
// Campos e categorias vivem AQUI, com a chave de tradução do rótulo: rótulo
// repetido em cada tela diverge (lição de lib/formatoPost). Dado de saúde fica
// no banco isolado da clínica, como o prontuário.
//
// Puro (sem fetch, sem React): a rota e a tela chamam, o teste cobre.

export type CampoFicha = 'profissao' | 'cidade' | 'alergias' | 'medicamentos' | 'condicoes' | 'procedimentosAnteriores' | 'objetivo'
export type FichaClinica = Partial<Record<CampoFicha, string>>

// `longo` = caixa de texto de várias linhas; o resto é linha única.
export const CAMPOS_FICHA: { chave: CampoFicha; rotulo: string; dica: string; longo: boolean; max: number }[] = [
  { chave: 'profissao', rotulo: 'ficha.profissao', dica: 'ficha.profissao-ph', longo: false, max: 80 },
  { chave: 'cidade', rotulo: 'ficha.cidade', dica: 'ficha.cidade-ph', longo: false, max: 80 },
  { chave: 'alergias', rotulo: 'ficha.alergias', dica: 'ficha.alergias-ph', longo: true, max: 600 },
  { chave: 'medicamentos', rotulo: 'ficha.medicamentos', dica: 'ficha.medicamentos-ph', longo: true, max: 600 },
  { chave: 'condicoes', rotulo: 'ficha.condicoes', dica: 'ficha.condicoes-ph', longo: true, max: 800 },
  { chave: 'procedimentosAnteriores', rotulo: 'ficha.anteriores', dica: 'ficha.anteriores-ph', longo: true, max: 800 },
  { chave: 'objetivo', rotulo: 'ficha.objetivo', dica: 'ficha.objetivo-ph', longo: true, max: 800 },
]

// Limpa o que veio do formulário: só campos conhecidos, texto aparado e com
// teto. Campo vazio SAI, e ficha sem nada vira `undefined` (não um objeto de
// strings vazias gravado no banco).
export function sanitizarFicha(entrada: unknown): FichaClinica | undefined {
  if (!entrada || typeof entrada !== 'object') return undefined
  const saida: FichaClinica = {}
  for (const c of CAMPOS_FICHA) {
    const v = String((entrada as any)[c.chave] ?? '').trim().slice(0, c.max)
    if (v) saida[c.chave] = v
  }
  return Object.keys(saida).length ? saida : undefined
}

export function camposPreenchidos(f?: FichaClinica | null): number {
  return CAMPOS_FICHA.filter(c => String(f?.[c.chave] || '').trim()).length
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Alergia é o que ninguém pode deixar passar: a ficha mostra no topo. Resposta
// negativa ("nenhuma", "não tem", "nega", "sem alergias") não acende o alerta.
export function alertaAlergia(f?: FichaClinica | null): string | null {
  const v = String(f?.alergias || '').trim()
  if (!v) return null
  if (/^(nenhum|nenhuma|nao\b|nega\b|nada\b|sem alergia|desconhece|n\/a$|-+$)/.test(semAcento(v))) return null
  return v
}

// Une as fichas de dois cadastros (mesclar duplicados): a principal manda, a
// outra preenche o que falta.
export function fundirFichas(principal?: FichaClinica, outra?: FichaClinica): FichaClinica | undefined {
  const saida: FichaClinica = {}
  for (const c of CAMPOS_FICHA) {
    const v = String(principal?.[c.chave] || '').trim() || String(outra?.[c.chave] || '').trim()
    if (v) saida[c.chave] = v
  }
  return Object.keys(saida).length ? saida : undefined
}

// ── O QUE SABEMOS ────────────────────────────────────────────────────────────
export type CategoriaAnotacao = 'saude' | 'preferencia' | 'pessoal' | 'experiencia' | 'outro'
export const CATEGORIAS_ANOTACAO: { chave: CategoriaAnotacao; rotulo: string; cor: string; fundo: string }[] = [
  { chave: 'saude', rotulo: 'ficha.cat.saude', cor: 'var(--v2-hot)', fundo: 'var(--v2-hot-bg)' },
  { chave: 'preferencia', rotulo: 'ficha.cat.preferencia', cor: 'var(--v2-info)', fundo: 'var(--v2-info-bg)' },
  { chave: 'pessoal', rotulo: 'ficha.cat.pessoal', cor: 'var(--v2-amber)', fundo: 'var(--v2-amber-bg)' },
  { chave: 'experiencia', rotulo: 'ficha.cat.experiencia', cor: 'var(--v2-ok)', fundo: 'var(--v2-ok-bg)' },
  { chave: 'outro', rotulo: 'ficha.cat.outro', cor: 'var(--v2-ink2)', fundo: 'var(--v2-surface2)' },
]
export const categoriaAnotacao = (k?: string) => CATEGORIAS_ANOTACAO.find(c => c.chave === k) || CATEGORIAS_ANOTACAO[CATEGORIAS_ANOTACAO.length - 1]

export type OrigemAnotacao = 'whatsapp' | 'ficha'
export type AnotacaoPaciente = {
  id: string
  texto: string
  categoria: CategoriaAnotacao
  origem: OrigemAnotacao
  em: string        // ISO — quando foi dita (hora da mensagem) ou anotada
  autor: string     // quem salvou
  msgId?: string    // mensagem de WhatsApp de onde veio
  criadoEm: string
}

export const MAX_ANOTACOES = 500
export const MAX_TEXTO_ANOTACAO = 2000

// Monta a nota a partir do que a tela mandou. Texto vazio = erro; categoria e
// origem desconhecidas caem no padrão; data inválida vira "agora".
export function novaAnotacao(entrada: any, ctx: { id: string; autor: string; agora: string }): AnotacaoPaciente | { erro: string } {
  const texto = String(entrada?.texto ?? '').trim().slice(0, MAX_TEXTO_ANOTACAO)
  if (!texto) return { erro: 'escreva o que anotar' }
  const categoria: CategoriaAnotacao = CATEGORIAS_ANOTACAO.some(c => c.chave === entrada?.categoria) ? entrada.categoria : 'outro'
  const origem: OrigemAnotacao = entrada?.origem === 'whatsapp' ? 'whatsapp' : 'ficha'
  const t = new Date(entrada?.em ?? '').getTime()
  const em = isNaN(t) ? ctx.agora : new Date(t).toISOString()
  const msgId = origem === 'whatsapp' && entrada?.msgId ? String(entrada.msgId).slice(0, 200) : ''
  return {
    id: ctx.id, texto, categoria, origem, em,
    autor: String(ctx.autor || '').slice(0, 120),
    ...(msgId ? { msgId } : {}),
    criadoEm: ctx.agora,
  }
}

const tempo = (iso: string) => { const t = new Date(iso).getTime(); return isNaN(t) ? 0 : t }

// Junta a nota na lista. A MESMA mensagem salva duas vezes (dois cliques, duas
// pessoas) não duplica: a nova substitui a anterior, porque o texto ou a
// categoria podem ter sido corrigidos. Mais recente primeiro; com teto, para a
// ficha não crescer sem fim (sai a mais antiga).
export function juntarAnotacao(lista: AnotacaoPaciente[] | undefined, nova: AnotacaoPaciente): AnotacaoPaciente[] {
  const base = (lista || []).filter(a => a.id !== nova.id && !(nova.msgId && a.msgId === nova.msgId))
  return [nova, ...base].sort((a, b) => tempo(b.em) - tempo(a.em)).slice(0, MAX_ANOTACOES)
}

// Mesclar duplicados: junta as notas dos dois cadastros sem repetir.
export function fundirAnotacoes(a?: AnotacaoPaciente[], b?: AnotacaoPaciente[]): AnotacaoPaciente[] | undefined {
  let saida: AnotacaoPaciente[] = [...(a || [])]
  for (const n of b || []) saida = juntarAnotacao(saida, n)
  saida = saida.sort((x, y) => tempo(y.em) - tempo(x.em))
  return saida.length ? saida : undefined
}
