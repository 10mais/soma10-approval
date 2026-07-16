// Regra de idioma dos textos gerados por IA. Existe porque o dono cobrou
// (2026-07-16): "os briefings estão saindo sem acentos, com erros de português".
//
// Duas causas, e as duas precisavam de conserto:
//
// 1. ESPELHAMENTO. Metade dos nossos prompts estava escrita em português SEM
//    acento ("Voce e um copywriter de uma agencia..."). O modelo imita o
//    registro do que recebe — prompt sem acento, resposta sem acento. Por isso
//    todo prompt do sistema agora é escrito com acentuação correta. Não é
//    capricho: é entrada do modelo.
// 2. FALTA DE EXIGÊNCIA. Vários prompts não pediam pt-BR em lugar nenhum.
//
// Cole `REGRA_PTBR` em TODO prompt que gere texto para humano (legenda, pauta,
// briefing, documento, resposta do assistente). Não use no gerador de IMAGEM:
// aquele fala inglês de propósito (lib/nanoBanana, studio/gerar-foto-ia).

export const REGRA_PTBR = `IDIOMA: escreva em português do Brasil, com ortografia, acentuação, crase e pontuação corretas. Acentuação NÃO é opcional — "conteúdo", "estratégia", "você", "não", "público", "vídeo", "mês", "negócio". Nunca entregue texto sem acento nem em português de Portugal.`

// Versão curta, para prompt de system já longo (assistente/agentes).
export const REGRA_PTBR_CURTA = `Responda SEMPRE em português do Brasil, com acentuação e gramática corretas.`
