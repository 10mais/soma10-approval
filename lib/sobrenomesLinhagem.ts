// Sobrenomes de linhagem — as famílias imigrantes cujos descendentes têm direito
// à cidadania. É a primeira pergunta da qualificação ("qual o sobrenome da
// família?"), e por isso vira lista fechada: digitado à mão, o mesmo sobrenome
// entra como "Lunkes", "Lunques" e "lunkes", e aí não dá para contar quantos
// leads existem por família nem cruzar com a pesquisa genealógica já feita.
//
// ⚠️ LISTA A PREENCHER — o dono tem os sobrenomes e vai enviar. Enquanto ela
// estiver vazia, o campo aceita texto livre (um <select> vazio seria uma tela
// quebrada); assim que os sobrenomes entrarem aqui, ele vira dropdown sozinho.
// Manter em ordem alfabética.
export const SOBRENOMES_LINHAGEM: string[] = [
  // Ex.: 'Lunkes', 'Muller', 'Schmitz', ...
]

// Ordenados para exibição, sem duplicatas e sem espaços sobrando.
export function sobrenomesOrdenados(lista: string[] = SOBRENOMES_LINHAGEM): string[] {
  return Array.from(new Set(lista.map(s => String(s || '').trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'pt', { sensitivity: 'base' }))
}

// A lista já foi preenchida? Decide se o campo é dropdown fechado ou texto livre.
export function temListaSobrenomes(lista: string[] = SOBRENOMES_LINHAGEM): boolean {
  return sobrenomesOrdenados(lista).length > 0
}
