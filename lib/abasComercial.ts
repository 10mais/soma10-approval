// TELAS DO COMERCIAL (papel `vendas`). Ele vive isolado da operação: só alcança
// estas abas, e qualquer outra cai no CRM (ver memória gotcha-vendas-fora-da-
// operacao — na agência, "Vendas" é SDR e não encosta na produção).
//
// Na CLÍNICA o Comercial também MARCA CONSULTA, então a Agenda entra. Decisão do
// dono em 15/11/2026 ("Sim, liberar"), que fechou a pendência 10.7.1 do
// redesenho da clínica. Sem ela, o painel da semana creditava cada agendamento a
// quem marcou no lugar dela, e "Agendou" da comercial ficava zerado.
//
// Puro: o painel (app/dashboard/page.tsx) chama, o teste cobre.

export const ABAS_COMERCIAL_BASE = ['crm', 'metas', 'conversao', 'lista-pessoal', 'mensagens', 'minha-conta']

export function abasDoComercial(perfil?: string | null): string[] {
  return perfil === 'clinica' ? [...ABAS_COMERCIAL_BASE, 'agenda'] : ABAS_COMERCIAL_BASE
}

// A aba aberta tem que voltar para o CRM? Enquanto o perfil da instância não
// chegou, a Agenda ESPERA: recarregar a página com a Agenda aberta não pode
// jogar a comercial da clínica para o CRM só porque o perfil ainda está vindo.
// Qualquer outra aba fora da lista volta na hora, como sempre voltou.
export function comercialVoltaAoCrm(aba: string, perfil: string | null | undefined, perfilLido: boolean): boolean {
  if (abasDoComercial(perfil).includes(aba)) return false
  if (aba === 'agenda' && !perfilLido) return false
  return true
}
