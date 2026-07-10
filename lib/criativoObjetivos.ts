// Taxonomia de OBJETIVO do criativo (client-safe, sem dependências).
// O objetivo guia a direção de arte do motor de criativos: quais campos do brief
// importam, o tom da copy e o tipo de layout que comunica melhor.

export type ObjetivoCriativo =
  | 'venda' | 'lead' | 'institucional' | 'autoridade' | 'prova_social'
  | 'oferta' | 'aviso' | 'educativo' | 'lancamento'

export type ObjetivoDef = {
  key: ObjetivoCriativo
  label: string
  dica: string // o que este objetivo pede na arte
  // Campos do brief rico que fazem sentido para este objetivo (a UI destaca esses)
  campos: ('cta' | 'oferta' | 'preco' | 'dataEvento' | 'horaEvento' | 'localEvento' | 'legal' | 'whatsapp')[]
}

export const OBJETIVOS: ObjetivoDef[] = [
  { key: 'venda', label: 'Venda direta', dica: 'Benefício claro + CTA forte; preço/oferta quando houver.', campos: ['cta', 'oferta', 'preco', 'whatsapp', 'legal'] },
  { key: 'lead', label: 'Captação de lead', dica: 'Promessa de valor + convite simples (baixo atrito).', campos: ['cta', 'whatsapp'] },
  { key: 'institucional', label: 'Institucional', dica: 'Marca em primeiro plano; mensagem de posicionamento.', campos: ['cta'] },
  { key: 'autoridade', label: 'Autoridade', dica: 'Demonstra domínio do assunto; tom confiante, sem vender.', campos: [] },
  { key: 'prova_social', label: 'Prova social', dica: 'Depoimento/resultado real em destaque.', campos: ['cta'] },
  { key: 'oferta', label: 'Oferta/Promoção', dica: 'A oferta É a mensagem; urgência e condição visíveis.', campos: ['oferta', 'preco', 'cta', 'legal', 'whatsapp'] },
  { key: 'aviso', label: 'Aviso/Comunicado', dica: 'Informação direta e legível (horário, mudança, recesso).', campos: ['dataEvento', 'horaEvento', 'localEvento'] },
  { key: 'educativo', label: 'Conteúdo educativo', dica: 'Dica/lista clara; hierarquia de leitura forte.', campos: [] },
  { key: 'lancamento', label: 'Lançamento/Evento', dica: 'Expectativa + dados do evento (data, hora, local).', campos: ['dataEvento', 'horaEvento', 'localEvento', 'cta'] },
]

export function objetivoDef(key?: string): ObjetivoDef | undefined {
  return OBJETIVOS.find(o => o.key === key)
}

// Rótulo seguro para exibição (aceita valor desconhecido/legado).
export function objetivoLabel(key?: string): string {
  return objetivoDef(key)?.label || ''
}
