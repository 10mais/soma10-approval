// CONFIGURAÇÃO DO ONBOARDING — fases > etapas, editável em Configurações.
//
// Pedido do dono (07/09/2026): "quero configurar mais etapas do onboarding,
// subdivididas em etapas e fases". O conteúdo NÃO vive no código: fica em
// `config:onboarding` (Redis). Sem nada gravado, vale o padrão abaixo — que é
// exatamente o checklist que já existia, então clientes em onboarding não
// perdem o que já marcaram (os ids são os mesmos).
//
// Cada ETAPA é manual (a equipe marca) ou automática (o sistema detecta por
// um `auto` conhecido: escopo, marca, redes, playbook, primeiro post).

export type Detector = 'escopo' | 'marca' | 'redes' | 'playbook' | 'primeiro'
export type EtapaOnb = { id: string; nome: string; dica?: string; auto?: Detector }
export type FaseOnb = { id: string; nome: string; etapas: EtapaOnb[] }
export type ConfigOnboarding = { fases: FaseOnb[] }

export const DETECTORES: { chave: Detector; label: string; explica: string }[] = [
  { chave: 'escopo', label: 'Escopo do contrato definido', explica: 'entregáveis ou posts/mês preenchidos no cadastro' },
  { chave: 'marca', label: 'Brand Board preenchido', explica: 'segmento, descrição ou palavras-chave na aba Marca' },
  { chave: 'redes', label: 'Redes sociais conectadas', explica: 'Instagram ou Facebook conectado' },
  { chave: 'playbook', label: 'Playbook (etapas) criado', explica: 'ao menos um marco no Playbook do cliente' },
  { chave: 'primeiro', label: 'Primeiro conteúdo publicado', explica: 'um post com status publicado' },
]
const DETECTOR_SET = new Set<string>(DETECTORES.map(d => d.chave))

export function configPadrao(): ConfigOnboarding {
  return { fases: [
    { id: 'formalizacao', nome: 'Formalização', etapas: [
      { id: 'contrato', nome: 'Contrato formalizado e assinado', dica: 'Financeiro / jurídico' },
      { id: 'acessos', nome: 'Acessos recebidos (Meta, site, ferramentas)', dica: 'Solicitar ao cliente' },
      { id: 'passagem', nome: 'Passagem de bastão lida pelo gestor', dica: 'Texto do closer na ficha' },
      { id: 'kickoff', nome: 'Reunião de kickoff realizada', dica: 'Alinhamento inicial com o cliente' },
    ] },
    { id: 'fundacao', nome: 'Fundação', etapas: [
      { id: 'escopo', nome: 'Escopo do contrato definido', dica: 'Editar cliente: entregáveis ou posts/mês', auto: 'escopo' },
      { id: 'marca', nome: 'Brand Board preenchido', dica: 'Aba Marca', auto: 'marca' },
      { id: 'redes', nome: 'Redes sociais conectadas', dica: 'Conectar Instagram / Facebook', auto: 'redes' },
      { id: 'playbook', nome: 'Playbook (etapas) criado', dica: 'Aba Playbook: aplicar o modelo de onboarding', auto: 'playbook' },
    ] },
    { id: 'golive', nome: 'Go live', etapas: [
      { id: 'primeiro', nome: 'Primeiro conteúdo publicado', dica: 'Planner', auto: 'primeiro' },
    ] },
  ] }
}

export function slug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}
const ID_OK = /^[a-z0-9][a-z0-9_-]{0,39}$/

// Aceita o que vier do banco/da tela e devolve uma config válida: ids únicos
// (gerados do nome quando faltam), nomes sem espaço sobrando, etapas sem nome
// descartadas, `auto` só se for detector conhecido. Sem fase válida = padrão.
export function normalizarConfig(bruto: unknown): ConfigOnboarding {
  const lista = (bruto as any)?.fases
  if (!Array.isArray(lista)) return configPadrao()
  const usados = new Set<string>()
  const unico = (base: string, nome: string, fallback: string) => {
    let id = ID_OK.test(base) ? base : (slug(base) || slug(nome) || fallback)
    if (!ID_OK.test(id)) id = fallback
    let n = 2; const raiz = id
    while (usados.has(id)) id = `${raiz}-${n++}`
    usados.add(id); return id
  }
  const fases: FaseOnb[] = []
  for (const f of lista) {
    const nome = typeof f?.nome === 'string' ? f.nome.trim() : ''
    if (!nome) continue
    const etapas: EtapaOnb[] = []
    for (const e of (Array.isArray(f?.etapas) ? f.etapas : [])) {
      const en = typeof e?.nome === 'string' ? e.nome.trim() : ''
      if (!en) continue
      const et: EtapaOnb = { id: unico(String(e?.id || ''), en, `etapa-${usados.size + 1}`), nome: en }
      const dica = typeof e?.dica === 'string' ? e.dica.trim() : ''
      if (dica) et.dica = dica
      if (typeof e?.auto === 'string' && DETECTOR_SET.has(e.auto)) et.auto = e.auto as Detector
      etapas.push(et)
    }
    fases.push({ id: unico(String(f?.id || ''), nome, `fase-${fases.length + 1}`), nome, etapas })
  }
  return fases.length ? { fases } : configPadrao()
}

export function etapasDaConfig(cfg: ConfigOnboarding): EtapaOnb[] {
  return cfg.fases.flatMap(f => f.etapas)
}
