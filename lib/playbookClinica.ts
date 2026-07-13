// Playbook de qualificação para o perfil CLÍNICA (client-safe, sem ids).
// Baseado no método do cliente de referência (Norah — harmonização/estética):
// roteiro de qualificação/agendamento + quebra de objeções + cadência de toques.
// É o PADRÃO do perfil; cada clínica ajusta o texto exato na aba Playbook do CRM.

export type PassoCadenciaSeed = { dia: number; canal: 'whatsapp' | 'ligacao' | 'email'; titulo: string; script: string }
export type PlaybookSeed = { roteiro: string; cadencia: PassoCadenciaSeed[] }

export const PLAYBOOK_CLINICA: PlaybookSeed = {
  roteiro: [
    'MÉTODO DÉCADA — qualificação e agendamento (siga as fases na ordem, sem pular):',
    '',
    'Fase 1 — Acolhimento: cumprimente, apresente-se e pergunte o nome do paciente.',
    'Fase 2 — Qualificação: idade, principais queixas/incômodos e o desejo de aparentar "menos 10 anos".',
    'Fase 3 — Método: explique o DÉCADA como a combinação de tecnologias/protocolos que rejuvenesce a aparência (sem detalhar técnicas ou produtos).',
    'Fase 4 — Agendamento: convide para a avaliação presencial (consulta R$ 100) — é onde o plano é personalizado.',
    'Fase 5 — Objeções: trate a objeção específica (abaixo) e reconduza ao agendamento.',
    'Fase 6 — Confirmação: confirme data e hora e reforce o atendimento exclusivo.',
    '',
    'REGRAS DE OURO:',
    '• Não informe valores de tratamento nem detalhes técnicos antes da consulta.',
    '• Explore a motivação do paciente ANTES de falar em preço.',
    '• Use provas sociais (casos parecidos) para gerar segurança.',
    '',
    'QUEBRA DE OBJEÇÕES:',
    '1. Só quer saber o preço → antes do valor, entenda o que a pessoa quer resolver.',
    '2. "Vi mais barato em outro lugar" → diferencie por qualidade, segurança e resultado.',
    '3. Não quer pagar a consulta → a avaliação é exclusiva e personalizada.',
    '4. Medo do resultado → mostre casos semelhantes e a segurança do protocolo.',
    '5. "Não tenho horário" → adapte à rotina do paciente e ofereça opções.',
    '6. Falta de confiança → construa credibilidade (formação, estrutura, casos).',
    '7. Limite do cartão → apresente opções de parcelamento.',
    '8. "Vou pensar" → crie urgência gentil e agende um retorno com data.',
  ].join('\n'),
  cadencia: [
    { dia: 0, canal: 'whatsapp', titulo: 'Primeiro contato', script: 'Oi {nome}! Aqui é {sdr} da {clinica}. Que bom que você se interessou pelo Método DÉCADA. Posso te fazer duas perguntinhas rápidas pra entender seu caso?' },
    { dia: 0, canal: 'whatsapp', titulo: 'Convite para a avaliação', script: 'Pelo que você me contou, a avaliação presencial é o melhor caminho — é nela que montamos seu plano personalizado. Tenho horários essa semana; prefere início ou fim da semana?' },
    { dia: 1, canal: 'whatsapp', titulo: 'Lembrete gentil', script: 'Oi {nome}, consegui um horário ótimo para a sua avaliação. Quer que eu reserve para você?' },
    { dia: 3, canal: 'whatsapp', titulo: 'Prova social', script: '{nome}, olha o resultado de uma paciente com um caso parecido com o seu: [antes/depois]. Bora marcar a sua avaliação?' },
    { dia: 6, canal: 'whatsapp', titulo: 'Última tentativa', script: '{nome}, não quero ser insistente. Se fizer sentido para você agora, seguro o seu horário; se preferir, retomo mais para frente. O que você acha?' },
  ],
}
