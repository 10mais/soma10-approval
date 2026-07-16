import { redis } from './redis'

// TRAVA DE ASSENTO — quem impede vender a mesma poltrona duas vezes.
//
// O erro que isto conserta: `/api/reservas` fazia LÊ tudo → confere → grava. Dois
// atendentes (balcão e telefone) clicando no mesmo segundo leem a poltrona livre,
// os dois passam na conferência e os dois gravam. Conferir antes de gravar não
// segura corrida — em nenhum banco.
//
// Em Postgres isso seria `@@unique([viagemId, assento])`, uma linha. Redis não tem
// constraint: a garantia vem de `SET NX`, que só grava se a chave AINDA NÃO existe.
// A operação é atômica no servidor Redis, então de dois pedidos simultâneos exatamente
// um ganha.
//
// Chave: `viagem:{viagemId}:assento:{numero}` → id da reserva dona.
// Ela é ÍNDICE DE TRAVA, não fonte da verdade do dado — a reserva continua em
// `reserva:{id}`. Por isso `semearTravas` existe: reserva criada antes desta trava
// não tem chave, e sem semear a poltrona dela pareceria livre.

const chave = (viagemId: string, assento: string) => `viagem:${viagemId}:assento:${assento}`

export type ResultadoTrava = { ok: true } | { ok: false; conflitos: string[] }

// Tenta ficar com TODOS os assentos. Ou pega todos, ou não pega nenhum: se o 3º
// falhar, devolve os 2 primeiros. Sem isso, uma reserva parcial deixaria poltrona
// travada sem dono — e ninguém mais conseguiria vendê-la.
export async function reservarAssentos(viagemId: string, assentos: string[], reservaId: string): Promise<ResultadoTrava> {
  const pegos: string[] = []
  for (const a of assentos) {
    const ganhou = await redis.set(chave(viagemId, a), reservaId, { nx: true })
    if (ganhou === 'OK') { pegos.push(a); continue }
    // Já tem dono. Se for esta mesma reserva, seguir (idempotente: reenvio do
    // formulário não pode falhar contra si próprio).
    const dono = await redis.get<string>(chave(viagemId, a))
    if (dono === reservaId) { pegos.push(a); continue }
    await soltar(viagemId, pegos, reservaId)
    return { ok: false, conflitos: [a] }
  }
  return { ok: true }
}

// Solta só o que É desta reserva — nunca a poltrona de outra pessoa.
async function soltar(viagemId: string, assentos: string[], reservaId: string): Promise<void> {
  for (const a of assentos) {
    const dono = await redis.get<string>(chave(viagemId, a))
    if (dono === reservaId) await redis.del(chave(viagemId, a))
  }
}

export const liberarAssentos = soltar

// Editar reserva = soltar o que saiu e pegar o que entrou. A ordem importa: solta
// primeiro, senão trocar 5→6 mantendo o 5 falharia contra a própria reserva.
export async function reatribuirAssentos(viagemId: string, antes: string[], depois: string[], reservaId: string): Promise<ResultadoTrava> {
  const saiu = antes.filter(a => !depois.includes(a))
  await soltar(viagemId, saiu, reservaId)
  const entrou = depois.filter(a => !antes.includes(a))
  const r = await reservarAssentos(viagemId, entrou, reservaId)
  if (!r.ok) {
    // Falhou: devolve o que tinha, para a reserva não ficar sem os assentos dela.
    await reservarAssentos(viagemId, saiu, reservaId)
  }
  return r
}

// Semeia as travas de reservas que nasceram ANTES desta trava existir. Sem isso a
// poltrona delas pareceria livre e seria vendida de novo. Idempotente.
export async function semearTravas(viagemId: string, reservas: { id: string; passageiros: { poltrona?: string }[]; status?: string }[]): Promise<number> {
  let semeadas = 0
  for (const r of reservas) {
    if (r.status === 'cancelada') continue
    for (const p of r.passageiros || []) {
      if (!p.poltrona) continue
      const ganhou = await redis.set(chave(viagemId, p.poltrona), r.id, { nx: true })
      if (ganhou === 'OK') semeadas++
    }
  }
  return semeadas
}
