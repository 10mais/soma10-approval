// QUEM LÊ E ESCREVE O PRONTUÁRIO (clínica) — decisão do dono em 15/11/2026
// ("Sim, restringir"), que fechou a pendência 10.7.9 do redesenho da clínica.
//
// Prontuário = o registro de cada atendimento (`Agendamento.registroAtendimento`,
// a evolução que a profissional escreve ao atender). Fica com QUEM ATENDE e com
// o admin (a dona da clínica). Comercial, recepção e gerente sem área de saúde
// não leem nem escrevem. O resto do atendimento (status, procedimentos
// realizados, valor) segue com a equipe: é operação e alimenta CRM e metas.
//
// A trava é no SERVIDOR (/api/agenda): o campo sai da resposta, e no salvar ele
// é IGNORADO para quem não pode — o formulário dessa pessoa não tem o texto, e
// mandá-lo vazio apagaria o que a doutora escreveu. Atendimento com prontuário
// também só é excluído por quem pode lê-lo.
//
// Puro (client-safe): a rota e a tela chamam, o teste cobre.

import { ehProfissionalAgenda } from './agenda'

export function podeLerProntuario(u: { role?: string; recebeAgenda?: boolean; areaSaude?: string } | null | undefined): boolean {
  if (!u) return false
  if (u.role === 'admin') return true
  if (u.role === 'cliente') return false
  return ehProfissionalAgenda(u)
}

// Tira o prontuário de um atendimento. Deixa só o AVISO de que ele existe
// (`temProntuario`), para a ficha dizer "registrado" sem mostrar o conteúdo.
export function semProntuario<T extends object>(a: T): Omit<T, 'registroAtendimento'> & { temProntuario?: boolean } {
  const { registroAtendimento, ...resto } = a as T & { registroAtendimento?: string }
  return (String(registroAtendimento || '').trim() ? { ...resto, temProntuario: true } : resto) as Omit<T, 'registroAtendimento'> & { temProntuario?: boolean }
}

export const temProntuarioEscrito = (a: { registroAtendimento?: string } | null | undefined) => !!String(a?.registroAtendimento || '').trim()
