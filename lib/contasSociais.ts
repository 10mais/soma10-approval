// Contas sociais de um cliente — VÁRIOS perfis por cliente.
//
// O sistema nasceu com "conta = cliente": um `instagramToken` e um
// `facebookPageId` soltos no Cliente, campos escalares. Conectar uma segunda
// página sobrescrevia a primeira. Quem tem 3 lojas com 3 perfis precisava de 3
// cadastros da mesma marca — 3 Brand Boards, 3 financeiros, e o cliente
// aprovando o mesmo post 3 vezes.
//
// Agora o cliente tem `contas[]`. Mas NADA foi migrado: os campos antigos
// continuam onde estavam e viram a CONTA PRINCIPAL, sintetizada na leitura.
// Cliente que nunca teve mais de um perfil não percebe diferença, e não existe
// um script de migração que possa rodar pela metade em produção.
//
// Regra da casa: ninguém lê `cliente.instagramToken` direto. Lê daqui. O
// caminho da publicação é o mais caro de errar no sistema inteiro — post
// duplicado ou no perfil errado é irreversível, já saiu para o público.

export type ContaSocial = {
  id: string
  nome: string // rótulo interno ("Loja Centro"), escolhido pela equipe
  // Instagram via login do Instagram (graph.instagram.com) — é o que publica.
  instagramToken?: string
  instagramUserId?: string
  instagramUsername?: string
  instagramConectado?: boolean
  instagramTokenAtualizadoEm?: string
  // Página do Facebook (graph.facebook.com)
  facebookPageId?: string
  facebookPageToken?: string
  instagramBusinessId?: string
  metaConectado?: boolean
  logo?: string
  criadoEm?: string
}

// Id da conta sintetizada dos campos antigos. Estável de propósito: um post
// agendado guarda este id e precisa continuar resolvendo para a mesma conta
// depois de qualquer deploy.
export const ID_CONTA_PRINCIPAL = 'principal'

type ClienteComContas = {
  contas?: ContaSocial[]
  nome?: string
  logo?: string
  instagramToken?: string
  instagramUserId?: string
  instagramUsername?: string
  instagramConectado?: boolean
  instagramTokenAtualizadoEm?: string
  facebookPageId?: string
  facebookPageToken?: string
  instagramBusinessId?: string
  metaConectado?: boolean
}

// A conta principal existe se os campos antigos têm ALGUMA conexão de verdade.
// Cliente sem nenhuma rede conectada não ganha uma conta fantasma.
export function contaPrincipal(cliente?: ClienteComContas | null): ContaSocial | null {
  if (!cliente) return null
  const temIG = !!(cliente.instagramToken && cliente.instagramUserId)
  const temFB = !!(cliente.facebookPageToken && cliente.facebookPageId)
  if (!temIG && !temFB) return null
  return {
    id: ID_CONTA_PRINCIPAL,
    nome: cliente.instagramUsername ? `@${cliente.instagramUsername}` : (cliente.nome || 'Conta principal'),
    instagramToken: cliente.instagramToken,
    instagramUserId: cliente.instagramUserId,
    instagramUsername: cliente.instagramUsername,
    instagramConectado: cliente.instagramConectado,
    instagramTokenAtualizadoEm: cliente.instagramTokenAtualizadoEm,
    facebookPageId: cliente.facebookPageId,
    facebookPageToken: cliente.facebookPageToken,
    instagramBusinessId: cliente.instagramBusinessId,
    metaConectado: cliente.metaConectado,
    logo: cliente.logo,
  }
}

// Todas as contas do cliente: a principal (campos antigos) primeiro, depois as
// cadastradas em `contas[]`. Sem repetir id.
export function contasDoCliente(cliente?: ClienteComContas | null): ContaSocial[] {
  if (!cliente) return []
  const principal = contaPrincipal(cliente)
  const extras = (cliente.contas || []).filter(c => c && c.id && c.id !== ID_CONTA_PRINCIPAL)
  const vistos = new Set<string>()
  return [...(principal ? [principal] : []), ...extras].filter(c => {
    if (vistos.has(c.id)) return false
    vistos.add(c.id)
    return true
  })
}

export function contaPorId(cliente: ClienteComContas | null | undefined, id?: string): ContaSocial | null {
  if (!id) return null
  return contasDoCliente(cliente).find(c => c.id === id) || null
}

// Em quais redes ESTA conta consegue publicar. Conta que só tem Instagram não
// deve aparecer como opção de Facebook — antes isso era um filtro solto dentro
// de publicar.ts, checando o cliente inteiro.
export function redesDaConta(conta?: ContaSocial | null): ('instagram' | 'facebook')[] {
  if (!conta) return []
  const redes: ('instagram' | 'facebook')[] = []
  if (conta.instagramToken && conta.instagramUserId) redes.push('instagram')
  if (conta.metaConectado && conta.facebookPageToken && conta.facebookPageId) redes.push('facebook')
  return redes
}

export function contaConectada(conta?: ContaSocial | null): boolean {
  return redesDaConta(conta).length > 0
}

// Para onde um post vai.
//
// `contaIds` vazio ou ausente = post antigo, de antes deste campo existir:
// publica na conta principal, exatamente como publicava. Id que não existe mais
// (conta removida depois do agendamento) é DESCARTADO em silêncio aqui — quem
// decide o que fazer com "nenhuma conta sobrou" é quem chama, porque publicar
// no perfil errado é pior do que não publicar.
export function contasAlvo(cliente: ClienteComContas | null | undefined, contaIds?: string[]): ContaSocial[] {
  const todas = contasDoCliente(cliente)
  if (!contaIds || !contaIds.length) {
    const principal = todas.find(c => c.id === ID_CONTA_PRINCIPAL)
    return principal ? [principal] : todas.slice(0, 1)
  }
  const pedidos = new Set(contaIds)
  return todas.filter(c => pedidos.has(c.id))
}

// Chave do anti-duplicação, por CONTA e por rede.
//
// `redesPublicadas` guardava só 'instagram'/'facebook' — bastava quando havia
// uma conta só. Com várias, "instagram" não diz em QUAL perfil já saiu, e o
// post sairia uma vez só, no primeiro perfil. Formato novo: "contaId:rede".
// O formato antigo continua sendo lido para a conta principal, senão um post
// que já publicou antes deste deploy publicaria DE NOVO.
export function chavePublicacao(contaId: string, rede: string): string {
  return `${contaId}:${rede}`
}

export function jaPublicou(redesPublicadas: string[] | undefined, contaId: string, rede: string): boolean {
  const lista = redesPublicadas || []
  if (lista.includes(chavePublicacao(contaId, rede))) return true
  // Compatibilidade: marca antiga, sem conta, vale para a principal.
  return contaId === ID_CONTA_PRINCIPAL && lista.includes(rede)
}
