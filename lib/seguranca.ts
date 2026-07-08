import { redis } from './redis'

// Interruptor GLOBAL da verificação em 2 fatores. DESLIGADO por padrão — o 2FA
// fica todo pronto (setup por usuário, e-mail/app), mas o login NÃO exige código
// nenhum enquanto isto estiver desligado.
// Motivo: o App Review da Meta/Facebook usa um login de teste (e-mail+senha) e o
// revisor não tem acesso ao 2º fator — exigir código quebraria a verificação.
// Ligar só DEPOIS da aprovação da Meta (toggle admin em Saúde do sistema).

export async function doisFatoresGlobalAtivo(): Promise<boolean> {
  try {
    return (await redis.get<boolean>('config:doisFatoresGlobal')) === true
  } catch {
    return false // falha fechada: na dúvida, NÃO exige 2FA (não tranca ninguém / não quebra o review)
  }
}

export async function setDoisFatoresGlobal(v: boolean): Promise<void> {
  await redis.set('config:doisFatoresGlobal', !!v)
}
