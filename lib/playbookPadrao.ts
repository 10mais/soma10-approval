// DE QUEM É O SCRIPT que uma instância nova recebe no Playbook antigo do CRM.
//
// Existe porque isso já deu errado: até 01/10 a regra era uma linha solta —
// "é clínica? script de clínica : script da agência" — e TODO perfil que não
// fosse clínica herdava o script do 10+. A Deny Turismo abriu a Biblioteca e
// encontrou "Oi {nome}! Aqui é {sdr} da 10+. Vi o trabalho de vocês..." como
// cadência dela; o mesmo caiu na Sua Dupla Cidadania e na Missões.
//
// A regra agora é explícita e testada, porque o erro é silencioso: ninguém
// percebe conteúdo errado no banco até alguém abrir a tela e ler.
//
// Conteúdo de nicho novo NÃO entra aqui: o lugar dele é a Biblioteca de Vendas
// (lib/bibliotecaSeeds/*), que tem as quatro seções e é editável na tela.

export type DonoDoPadrao = 'clinica' | 'agencia' | 'vazio'

/**
 * `perfil` é o perfil da instância (null = a agência, o 10+).
 * - clínica → script de clínica (método DÉCADA)
 * - agência → script do 10+
 * - qualquer outro perfil → VAZIO. Melhor nascer em branco do que nascer com o
 *   discurso de outro negócio na boca da equipe.
 */
export function padraoDoPerfil(perfil: string | null | undefined): DonoDoPadrao {
  if (perfil === 'clinica') return 'clinica'
  if (!perfil) return 'agencia'
  return 'vazio'
}
