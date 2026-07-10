// Guia de design do motor de criativos (a "Skill" destilada) + contrato de HTML.
// O Claude atua como DESIGNER: desenha cada criativo como HTML/CSS autocontido
// usando a identidade real da marca (fontes, cores, logo, elementos). O servidor
// injeta os arquivos pesados (fontes/imagens em base64) DEPOIS, via tokens — o
// modelo nunca vê base64 (custo baixo) e a receita salva fica pequena.
//
// Tokens disponíveis no HTML gerado:
//   {{LOGO}}        -> logomarca (data URI)
//   {{FUNDO}}       -> foto de fundo (data URI), quando houver
//   {{ELEMENTO_1}}  / {{ELEMENTO_2}} -> grafismos da marca, quando houver
// Fontes: font-family 'TituloMarca' e 'TextoMarca' (@font-face injetado no servidor).

export const CANVAS = { largura: 1080, altura: 1350 }

export type FonteResolvida = { familia: 'TituloMarca' | 'TextoMarca'; dataUri: string; peso: number; italico?: boolean }

// ===== Guia de design (princípios de direção de arte, ajustados por vibe) =====

const GUIA_BASE = `PRINCÍPIOS DE DESIGN (siga com rigor):
1. UMA mensagem focal. A headline domina a composição; todo o resto apoia.
2. Hierarquia clara: headline grande (peso 700+, na fonte 'TituloMarca'), apoio menor ('TextoMarca'), CTA como botão/pill destacado quando existir.
3. Área segura: NENHUM texto ou logo a menos de 88px das bordas do canvas.
4. Texto NUNCA estoura: use font-size fluido com clamp() e max-width; quebre linhas com line-height 1.05–1.2 em títulos.
5. Contraste garantido: texto sobre foto exige scrim (gradiente escuro) ou faixa de cor; contraste mínimo AA.
6. Use SOMENTE as cores da paleta da marca (+ branco/preto/tons neutros derivados).
7. A logo ({{LOGO}}) aparece 1x, discreta (topo ou rodapé), nunca dominando.
8. Grafismos da marca ({{ELEMENTO_1}}/{{ELEMENTO_2}}) são apoio: textura, canto, moldura — nunca cobrem texto.
9. Composição com intenção: grid, alinhamento consistente, respiro generoso. Nada de elementos soltos aleatórios.
10. Nada de clichê de "template genérico": evite caixa central + fundo chapado sem trabalho. Traga profundidade (camadas, gradientes sutis, recortes, blocos assimétricos).`

const GUIA_VIBE: Record<string, string> = {
  minimalista: 'VIBE MINIMALISTA: máximo respiro, 2-3 elementos no total, paleta contida, tipografia como protagonista.',
  premium: 'VIBE PREMIUM: fundo escuro/profundo, contraste alto, detalhes finos (linhas 1px, dourados/metálicos sutis se a paleta permitir), tipografia elegante espaçada.',
  energetico: 'VIBE ENERGÉTICA: diagonais, blocos de cor vibrante da paleta, tipografia pesada e grande, sensação de movimento.',
  clean: 'VIBE CLEAN: fundo claro, sombras suaves, cantos arredondados, organização em cards/blocos, leveza.',
  elegante: 'VIBE ELEGANTE: serifa no título se disponível, tons suaves, ornamentos discretos, simetria clássica.',
  moderno: 'VIBE MODERNA: geometria forte, grid visível, contraste de escala tipográfica, cores da marca em blocos sólidos.',
  classico: 'VIBE CLÁSSICA: sobriedade, centralização, hierarquia tradicional, paleta contida, confiança.',
  divertido: 'VIBE DIVERTIDA: formas orgânicas, rotações leves (2-4°), cores alegres da paleta, tipografia expressiva.',
}

export function guiaDesign(vibe?: string): string {
  const v = vibe && GUIA_VIBE[vibe] ? `\n\n${GUIA_VIBE[vibe]}` : ''
  return GUIA_BASE + v
}

// ===== Contrato técnico do HTML =====

export function contratoHtml(): string {
  return `CONTRATO TÉCNICO DO HTML (obrigatório):
- Documento completo: <!doctype html><html><head><style>...</style></head><body>...</body></html>
- Canvas EXATO: html,body{width:${CANVAS.largura}px;height:${CANVAS.altura}px;margin:0;overflow:hidden}
- TODO o CSS inline no <style> do head. PROIBIDO: <script>, @import, links externos, URLs http(s) — as únicas imagens permitidas são os tokens {{LOGO}}, {{FUNDO}}, {{ELEMENTO_1}}, {{ELEMENTO_2}}.
- Fontes: use font-family:'TituloMarca' (títulos/destaques) e 'TextoMarca' (demais textos), com fallback sans-serif. NÃO declare @font-face (o servidor injeta).
- Sem emoji. Texto em português exatamente como fornecido no briefing (não invente promoções/preços que não foram dados).
- Responda APENAS com o HTML (sem markdown, sem explicação, sem \`\`\`).`
}

// ===== Prompt do designer =====

export type BriefDesigner = {
  dna: string // DNA textual da marca (nome, segmento, tom, playbook)
  paleta: { primaria: string; secundaria: string }
  vibe?: string
  fontesInfo: string // "Título: Montserrat (700) · Texto: Inter (400)" ou aviso de fallback
  tokens: string[] // tokens disponíveis nesta geração
  briefing: string // pauta + direção de criativo
  headlineFixa?: string
  objetivo?: string // rótulo do objetivo + dica
  camposBrief: string // "CTA: Agende agora · Oferta: 20% OFF" (só os preenchidos)
  handle?: string
  temReferencias: boolean
}

export function promptDesigner(b: BriefDesigner): string {
  return `Você é o diretor de arte sênior de uma agência. Desenhe UM criativo de feed (${CANVAS.largura}x${CANVAS.altura}) como HTML/CSS autocontido, com a cara REAL desta marca.

MARCA:
${b.dna}
Paleta: primária ${b.paleta.primaria} · destaque ${b.paleta.secundaria}
Tipografia: ${b.fontesInfo}
${b.temReferencias ? 'Você RECEBE imagens de referência da marca (posts/ativos reais). REPLIQUE o estilo visual delas: composição, pesos, clima. A arte deve parecer da MESMA família visual.' : 'Sem referências visuais — derive o estilo da paleta, tipografia e vibe.'}

RECURSOS DISPONÍVEIS (tokens de imagem): ${b.tokens.join(', ') || 'nenhum'}
${b.handle ? `Assinatura/rodapé: ${b.handle}` : ''}

PAUTA:
${b.briefing}
${b.objetivo ? `\nOBJETIVO DO POST: ${b.objetivo}` : ''}
${b.camposBrief ? `\nDADOS DO ANÚNCIO (use exatamente, com destaque adequado): ${b.camposBrief}` : ''}
${b.headlineFixa ? `\nHEADLINE OBRIGATÓRIA (use EXATAMENTE, sem reescrever): "${b.headlineFixa}"` : '\nEscreva a headline: curta e impactante (máx. ~9 palavras), no tom da marca.'}

${guiaDesign(b.vibe)}

${contratoHtml()}`
}

export function promptRefinar(htmlAtual: string, instrucao: string): string {
  return `Você é o diretor de arte. Aqui está o HTML ATUAL de um criativo e uma INSTRUÇÃO do usuário. Devolva o HTML COMPLETO revisado conforme a instrução — mantendo o contrato técnico (canvas ${CANVAS.largura}x${CANVAS.altura}, tokens {{...}}, fontes 'TituloMarca'/'TextoMarca', sem scripts/URLs externas, sem emoji).

HTML ATUAL:
${htmlAtual}

INSTRUÇÃO: ${instrucao}

${contratoHtml()}`
}

// ===== Pós-processamento do HTML gerado =====

// Extrai o HTML da resposta do modelo (tolera cercas de markdown e texto em volta).
export function extrairHtml(texto: string): string | null {
  const semCerca = texto.replace(/```(?:html)?/gi, '')
  const m = semCerca.match(/<!doctype html[\s\S]*<\/html>/i) || semCerca.match(/<html[\s\S]*<\/html>/i)
  return m ? m[0] : null
}

// Defesa em profundidade: remove scripts/handlers e neutraliza referências externas.
// (O HTML roda só no Chrome headless do servidor, mas não custa garantir.)
export function sanitizarHtmlCriativo(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/@import[^;]+;/gi, '')
    // qualquer url http(s) em src/href/url() vira vazio — só tokens/data: passam
    .replace(/(src|href)\s*=\s*(["'])https?:\/\/[^"']*\2/gi, '$1=$2$2')
    .replace(/url\(\s*(["']?)https?:\/\/[^)]*\1\s*\)/gi, 'url()')
}

const PIXEL_TRANSPARENTE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

// Substitui os tokens {{...}} pelos data URIs; tokens desconhecidos viram pixel transparente.
export function aplicarTokens(html: string, mapa: Record<string, string>): string {
  let out = html
  for (const [token, dataUri] of Object.entries(mapa)) {
    out = out.split(`{{${token}}}`).join(dataUri)
  }
  return out.replace(/\{\{[A-Z0-9_]+\}\}/g, PIXEL_TRANSPARENTE)
}

// Injeta os @font-face (base64) no <head> — famílias 'TituloMarca'/'TextoMarca'.
export function injetarFontes(html: string, fontes: FonteResolvida[]): string {
  if (!fontes.length) return html
  const css = fontes.map(f =>
    `@font-face{font-family:'${f.familia}';src:url('${f.dataUri}');font-weight:${f.peso};font-style:${f.italico ? 'italic' : 'normal'};font-display:block}`
  ).join('\n')
  const bloco = `<style>${css}</style>`
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, m => `${m}\n${bloco}`)
  return bloco + html
}

// Pipeline completo: HTML do modelo -> HTML renderizável.
export function montarHtmlFinal(htmlIA: string, opts: { tokens: Record<string, string>; fontes: FonteResolvida[] }): string {
  const limpo = sanitizarHtmlCriativo(htmlIA)
  const comTokens = aplicarTokens(limpo, opts.tokens)
  return injetarFontes(comTokens, opts.fontes)
}
