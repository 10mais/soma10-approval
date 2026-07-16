// "Abrir a conversa desta pessoa" a partir de OUTRA tela (a home dos
// aniversariantes, hoje). O CRM é quem sabe exibir o inbox, então quem pede
// deixa o telefone aqui e navega para lá — mesmo padrão do `agenda_prefill`.
//
// A chave mora nesta lib, e não solta em cada componente, porque os dois lados
// precisam concordar no nome: um `crm_abrir_tel` × `crmAbrirTel` seria um botão
// que não faz nada, e silenciosamente.

export const CRM_ABRIR_TEL = 'crm_abrir_tel'

// sessionStorage não existe no servidor (nem no teste); ausência = no-op.
function store(): Storage | null {
  try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null } catch { return null }
}

// Pede ao CRM que abra a conversa deste telefone. Devolve false quando não há
// número — assim quem chama não navega para uma tela que não vai abrir nada.
export function pedirConversaWhatsApp(telefone?: string): boolean {
  const tel = (telefone || '').replace(/\D/g, '')
  if (!tel) return false
  const s = store()
  if (!s) return false // sem onde guardar o pedido não há o que abrir do outro lado
  try { s.setItem(CRM_ABRIR_TEL, tel) } catch { return false }
  return true
}

// Lê E APAGA: o pedido vale uma vez. Sem isso, recarregar o CRM (ou voltar a
// ele depois) reabriria a conversa do aniversariante sozinho, do nada.
export function consumirConversaWhatsApp(): string {
  const s = store()
  if (!s) return ''
  try {
    const tel = s.getItem(CRM_ABRIR_TEL) || ''
    s.removeItem(CRM_ABRIR_TEL)
    return tel
  } catch { return '' }
}
