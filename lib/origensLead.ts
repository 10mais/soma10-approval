// Origem do lead — de onde a pessoa veio. Na clínica isso vira decisão de
// dinheiro (onde investir/parar de investir), então a lista é FECHADA: campo de
// texto livre produz "Instagram", "instagram", "insta", "IG" e um gráfico que
// mente. O dropdown fica em lib porque a tela de criar e a de editar a
// oportunidade precisam oferecer exatamente a MESMA lista, e o gráfico precisa
// somar por ela.

export const ORIGENS_CLINICA = ['Indicação', 'Recorrente', 'Link da bio', 'Meta Ads', 'Orgânico', 'Google', 'Outros'] as const
export type OrigemClinica = typeof ORIGENS_CLINICA[number]

// Negócio antigo (ou importado) sem o campo preenchido. Fatia PRÓPRIA, e não
// dentro de "Outros": "Outros" é uma escolha de quem cadastrou; isto é ausência
// de dado, e o gráfico precisa mostrar o tamanho do buraco.
export const SEM_ORIGEM = 'Sem origem'

export const COR_ORIGEM: Record<string, string> = {
  'Indicação': '#16a34a',
  'Recorrente': '#0ea5e9',
  'Link da bio': '#7c3aed',
  'Meta Ads': '#1d4ed8',
  'Orgânico': '#f59e0b',
  'Google': '#ef4444',
  'Outros': '#64748b',
  [SEM_ORIGEM]: '#cbd5e1',
}

function chave(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')
}

// Sinônimos exatos — o histórico da Norah foi digitado à mão antes da lista
// fechada existir ("Ex-paciente", "Tráfego pago", "Instagram"…). Sem isto cada
// grafia viraria "Outros" e o gráfico começaria cego.
const EXATOS: Record<string, OrigemClinica> = {
  'indicacao': 'Indicação', 'indicado': 'Indicação', 'indicacao de paciente': 'Indicação', 'indicacao medica': 'Indicação',
  'recorrente': 'Recorrente', 'ex-paciente': 'Recorrente', 'ex paciente': 'Recorrente', 'expaciente': 'Recorrente',
  'paciente antigo': 'Recorrente', 'retorno': 'Recorrente', 'ja e paciente': 'Recorrente',
  'link da bio': 'Link da bio', 'link na bio': 'Link da bio', 'link bio': 'Link da bio', 'bio': 'Link da bio', 'linktree': 'Link da bio',
  'meta ads': 'Meta Ads', 'trafego pago': 'Meta Ads', 'facebook ads': 'Meta Ads', 'instagram ads': 'Meta Ads',
  'face ads': 'Meta Ads', 'anuncio': 'Meta Ads', 'anuncios': 'Meta Ads', 'ads': 'Meta Ads', 'meta': 'Meta Ads',
  'organico': 'Orgânico', 'trafego organico': 'Orgânico', 'instagram': 'Orgânico', 'instagram organico': 'Orgânico',
  'rede social': 'Orgânico', 'redes sociais': 'Orgânico', 'perfil do instagram': 'Orgânico',
  'google': 'Google', 'google ads': 'Google', 'pesquisa google': 'Google', 'busca google': 'Google',
  'google meu negocio': 'Google', 'maps': 'Google', 'google maps': 'Google',
  'outros': 'Outros', 'outro': 'Outros',
}

// Devolve SEMPRE um item da lista fechada — ou '' quando não há nada escrito
// (quem soma trata a ausência como `SEM_ORIGEM`). Google é testado ANTES de
// "ads": "Google Ads" é Google, não Meta.
export function normalizaOrigem(bruta?: string): OrigemClinica | '' {
  const k = chave(String(bruta || ''))
  if (!k) return ''
  if (EXATOS[k]) return EXATOS[k]
  if (k.includes('google')) return 'Google'
  if (k.includes('indica')) return 'Indicação'
  if (k.includes('bio')) return 'Link da bio'
  if (k.includes('recorrente') || k.includes('ex-paciente') || k.includes('ex paciente') || k.includes('retorno')) return 'Recorrente'
  if (k.includes('meta') || k.includes('facebook') || k.includes('ads') || k.includes('pago') || k.includes('anunc')) return 'Meta Ads'
  if (k.includes('organic') || k.includes('instagram') || k.includes('tiktok')) return 'Orgânico'
  return 'Outros'
}

export type ItemOrigem = { origem?: string; status?: string; valor?: number }

export type FatiaOrigem = {
  nome: string
  qtd: number
  pct: number          // 0-100, sem arredondar (a tela decide as casas)
  cor: string
  anguloInicio: number // graus, 0 = meio-dia, sentido horário
  anguloFim: number
  // O que o canal virou. É isto que responde a pergunta seguinte à do gráfico:
  // não "de onde vêm os leads", mas "de onde vêm os que FECHAM".
  abertos: number
  ganhos: number
  perdidos: number
  valorGanho: number
  conversao: number    // ganhos ÷ leads do canal, 0-100
}

// Soma os negócios por origem já normalizada. Ordena por quantidade, mas
// "Outros" e "Sem origem" vão sempre para o fim: são resto, não canal — deixá-los
// no topo por volume esconderia o canal que de fato traz gente.
export function pizzaOrigens(itens: ItemOrigem[]): { total: number; fatias: FatiaOrigem[] } {
  const total = itens.length
  if (!total) return { total: 0, fatias: [] }

  type Acc = { qtd: number; abertos: number; ganhos: number; perdidos: number; valorGanho: number }
  const contagem = new Map<string, Acc>()
  for (const it of itens) {
    const nome = normalizaOrigem(it.origem) || SEM_ORIGEM
    const a = contagem.get(nome) || { qtd: 0, abertos: 0, ganhos: 0, perdidos: 0, valorGanho: 0 }
    a.qtd++
    // Status ausente conta como aberto (é o padrão do CRM ao criar).
    if (it.status === 'ganho') { a.ganhos++; a.valorGanho += Number(it.valor) || 0 }
    else if (it.status === 'perdido') a.perdidos++
    else a.abertos++
    contagem.set(nome, a)
  }

  const resto = (nome: string) => (nome === SEM_ORIGEM ? 2 : nome === 'Outros' ? 1 : 0)
  const ordem = Array.from(contagem.entries()).sort((a, b) => {
    const r = resto(a[0]) - resto(b[0])
    if (r) return r
    if (b[1].qtd !== a[1].qtd) return b[1].qtd - a[1].qtd
    return a[0].localeCompare(b[0], 'pt')
  })

  let angulo = 0
  const fatias = ordem.map(([nome, a]) => {
    const pct = (a.qtd / total) * 100
    const inicio = angulo
    angulo += (a.qtd / total) * 360
    return {
      nome, qtd: a.qtd, pct, cor: COR_ORIGEM[nome] || '#64748b', anguloInicio: inicio, anguloFim: angulo,
      abertos: a.abertos, ganhos: a.ganhos, perdidos: a.perdidos, valorGanho: a.valorGanho,
      conversao: (a.ganhos / a.qtd) * 100,
    }
  })
  return { total, fatias }
}

function ponto(cx: number, cy: number, r: number, grau: number): [number, number] {
  const rad = ((grau - 90) * Math.PI) / 180
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}
const n2 = (v: number) => Math.round(v * 100) / 100

// Caminho SVG de uma fatia de rosca (donut). Uma fatia de 100% NÃO passa por
// aqui: arco de 360° tem início e fim no mesmo ponto e o SVG desenha nada — a
// tela desenha um anel inteiro nesse caso (ver `fatiaUnica`).
export function fatiaPath(cx: number, cy: number, rExt: number, rInt: number, a0: number, a1: number): string {
  const grande = a1 - a0 > 180 ? 1 : 0
  const [x0, y0] = ponto(cx, cy, rExt, a0)
  const [x1, y1] = ponto(cx, cy, rExt, a1)
  const [x2, y2] = ponto(cx, cy, rInt, a1)
  const [x3, y3] = ponto(cx, cy, rInt, a0)
  return `M ${n2(x0)} ${n2(y0)} A ${rExt} ${rExt} 0 ${grande} 1 ${n2(x1)} ${n2(y1)} L ${n2(x2)} ${n2(y2)} A ${rInt} ${rInt} 0 ${grande} 0 ${n2(x3)} ${n2(y3)} Z`
}

// Todo mundo veio do mesmo canal: vira anel, não fatia.
export function fatiaUnica(fatias: FatiaOrigem[]): boolean {
  return fatias.length === 1
}

// Quanto a fatia se afasta do centro quando o mouse para em cima (o "explodir"
// do gráfico). Vetor no meio do arco — a tela só aplica como translate.
export function deslocamentoFatia(a0: number, a1: number, distancia: number): [number, number] {
  const meio = (a0 + a1) / 2
  const rad = ((meio - 90) * Math.PI) / 180
  return [n2(Math.cos(rad) * distancia), n2(Math.sin(rad) * distancia)]
}
