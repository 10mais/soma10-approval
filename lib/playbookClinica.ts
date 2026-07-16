// Playbook de qualificação para o perfil CLÍNICA (client-safe, sem ids).
// Baseado no método do cliente de referência (Norah — harmonização/estética):
// roteiro de qualificação/agendamento + quebra de objeções + cadência de toques.
// É o PADRÃO do perfil; cada clínica ajusta o texto exato na aba Playbook do CRM.

export type PassoCadenciaSeed = { dia: number; canal: 'whatsapp' | 'ligacao' | 'email'; titulo: string; script: string }
// Reaquecimento é OUTRA coisa que a cadência: a cadência persegue quem acabou de
// levantar a mão (dia 0, 1, 3...); aqui a pessoa JÁ VEIO e sumiu — não há "dia
// zero", há um motivo para voltar a falar. Por isso `quando` (o gatilho) no
// lugar de `dia`.
export type PassoReaquecimentoSeed = { quando: string; titulo: string; script: string }
export type PlaybookSeed = { roteiro: string; cadencia: PassoCadenciaSeed[]; reaquecimento: PassoReaquecimentoSeed[] }

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
  // REAQUECIMENTO DE BASE — a lista de quem já veio é o ativo mais barato da
  // clínica: já confiou, já pagou, já conhece o resultado. As mensagens partem
  // do que ELA fez (o procedimento e a data estão na ficha), nunca de "oi, tudo
  // bem?" genérico, e não prometem preço nem prazo — a regra de ouro do método
  // vale aqui igual.
  reaquecimento: [
    {
      quando: 'Procedimento vencendo (o efeito acaba em ~6 meses)',
      titulo: 'Hora da manutenção',
      script: 'Oi {primeiro}, tudo bem? Aqui é {sdr} da {clinica}. Faz cerca de {tempo} que você fez {procedimento} com a gente — normalmente é por volta desta época que a manutenção rende mais, porque o efeito ainda não foi embora de todo. Quer que eu veja uma agenda para a sua avaliação?',
    },
    {
      quando: 'Veio uma vez e não voltou (3 a 12 meses)',
      titulo: 'Retomada com memória',
      script: 'Oi {primeiro}! Estava revendo os atendimentos e lembrei de você — na época a gente conversou sobre {procedimento}. Como você está se sentindo com o resultado hoje? Se quiser, faço uma reavaliação para ver o que faz sentido agora.',
    },
    {
      quando: 'Sumiu depois da avaliação, sem fechar',
      titulo: 'Porta aberta, sem cobrança',
      script: 'Oi {primeiro}, tudo bem? Você fez sua avaliação com a gente e acabou não seguindo — e tudo bem, cada coisa tem seu tempo. Continuo com o seu plano aqui. Faz sentido retomarmos agora ou prefere que eu procure mais para frente?',
    },
    {
      quando: 'Aniversário do paciente',
      titulo: 'Parabéns (sem venda na primeira mensagem)',
      script: 'Oi {primeiro}, passando só para te desejar um feliz aniversário! Que o seu ano seja lindo. Um beijo de toda a equipe da {clinica}.',
    },
    {
      quando: 'Novidade que muda o caso DELA (protocolo/tecnologia nova)',
      titulo: 'Novidade com nome e endereço',
      script: 'Oi {primeiro}! Lembrei de você porque chegou aqui um protocolo novo para exatamente aquilo que te incomodava quando você veio ({queixa}). Quer que eu te explique em dois minutos como funciona?',
    },
    {
      quando: 'Base fria (mais de 1 ano sem contato)',
      titulo: 'Reabertura honesta',
      script: 'Oi {primeiro}, aqui é {sdr} da {clinica}. Faz um tempo que a gente não se fala! Estou colocando a agenda em dia e queria saber: você gostaria de continuar recebendo novidades nossas por aqui? Se sim, tenho uma coisa que acho que combina com você.',
    },
  ],
}
