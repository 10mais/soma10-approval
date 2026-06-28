import { redis } from './redis'

// Automações curadas (liga/desliga). Gatilho -> ação.
export type Automacoes = {
  postAprovadoCriaTarefa?: boolean   // cliente aprova post -> cria tarefa de publicação
  etapaConcluidaNotifica?: boolean   // etapa do Playbook concluída -> notifica a equipe
  clienteNovoNotifica?: boolean      // cliente novo cadastrado -> notifica os gestores
}

export async function getAutomacoes(): Promise<Automacoes> {
  return (await redis.get<Automacoes>('config:automacoes')) || {}
}
