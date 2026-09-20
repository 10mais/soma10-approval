// VARREDURA DE IDIOMA — dono, 20/09/2026: "faça uma varredura no sistema e revise cada menu,
// cada configuração, cada etapa, ajuste tudo para unificar idiomas".
//
// O sistema tem mais de mil textos escritos direto dentro das telas. Traduzir isso a olho,
// arquivo por arquivo, deixa buraco — e buraco em tradução é a tela meio em inglês meio em
// português, que foi justamente a reclamação. Este script faz o trabalho mecânico:
//
//   node scripts/i18n-varredura.mjs                 → INVENTÁRIO (não altera nada)
//   node scripts/i18n-varredura.mjs --lista <arq>   → lista os textos daquele arquivo
//
// O que ele considera "texto de tela":
//   - texto solto entre tags:            <p>Nenhuma tarefa aberta.</p>
//   - atributos que a pessoa lê:         placeholder / title / aria-label / alt
//
// O que ele NUNCA toca (por isso a lista é conservadora):
//   - qualquer coisa dentro de crase (`...`) — é onde mora o CSS das telas e os textos com
//     ${variável}, que precisam de tradução com parâmetro, feita à mão;
//   - trecho com { } no meio (expressão React), classe/estilo, url, chave de dado;
//   - palavra sem letra (números, símbolos, emoji) e texto de 1 caractere.
//
// O relatório é a fila de trabalho: arquivo, quantidade e amostra.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAIZ = process.cwd()
const PASTAS = ['app', 'lib']
const IGNORAR = /node_modules|\.next|scripts[\\/]/

function arquivos(dir, saida = []) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    if (IGNORAR.test(caminho)) continue
    const st = statSync(caminho)
    if (st.isDirectory()) arquivos(caminho, saida)
    else if (/\.(tsx|ts)$/.test(nome)) saida.push(caminho)
  }
  return saida
}

// Tira as regiões que não podem ser mexidas: comentários e template strings (CSS, frases com
// variável). Substitui por espaço do mesmo tamanho, para os índices continuarem valendo.
function mascarar(src) {
  let fora = src.split('')
  const apagar = (i, j) => { for (let k = i; k < j && k < fora.length; k++) if (fora[k] !== '\n') fora[k] = ' ' }
  // comentários de linha e de bloco
  for (const m of src.matchAll(/\/\/[^\n]*/g)) apagar(m.index, m.index + m[0].length)
  for (const m of src.matchAll(/\/\*[\s\S]*?\*\//g)) apagar(m.index, m.index + m[0].length)
  // template strings (inclui o CSS dentro de <style>{`...`}</style>)
  for (const m of src.matchAll(/`[\s\S]*?`/g)) apagar(m.index, m.index + m[0].length)
  return fora.join('')
}

const TEM_LETRA = /[A-Za-zÀ-ÿ]/
const SO_CODIGO = /^[\s\d\W]+$/
const SUSPEITO = /[{}<>$]|=>|var\(|https?:|\.(tsx?|css|png|jpg|svg)\b|^[a-z-]+:[a-z]/i

function textoValido(t) {
  const s = t.trim()
  if (s.length < 2) return false
  if (!TEM_LETRA.test(s)) return false
  if (SO_CODIGO.test(s)) return false
  if (SUSPEITO.test(s)) return false
  // texto de tela nao atravessa linha nem carrega codigo (o `>` do `=>` engana o casamento)
  if (/[\r\n]/.test(t)) return false
  if (/[;=]|\.\w+\(|\breturn\b|\bconst\b|\.length\b|&&|\|\|/.test(s)) return false
  return true
}

// Pedaços de texto dentro de uma template string: `${n} etapas · ${x} fases` → "etapas ·",
// "fases". CSS entra por engano se não filtrar: bloco de estilo tem `;`, `:` e `{`.
function pedacosDeCrase(src) {
  const saida = []
  for (const m of src.matchAll(/`([^`]*)`/g)) {
    const corpo = m[1]
    if (/[{};]/.test(corpo.replace(/\$\{[^}]*\}/g, ''))) continue // é CSS ou código
    for (const pedaco of corpo.replace(/\$\{[^}]*\}/g, '\u0000').split('\u0000')) {
      const t = pedaco.trim()
      if (t.length < 3 || !TEM_LETRA.test(t) || SUSPEITO.test(t)) continue
      if (/^[a-z-]+$/.test(t) && t.length < 5) continue // 'px', 'auto', nome de classe
      if (!/\s/.test(t) && /[/_]/.test(t)) continue // caminho de arquivo/chave ('perfis/', 'ads_conta')
      if (/\d(\.\d+)?px|(solid|dashed|dotted|rgba?|calc|ease-|translate|scale)/.test(t)) continue // pedaco de CSS
      saida.push({ tipo: 'crase', texto: t, indice: m.index })
    }
  }
  return saida
}

export function textosDoArquivo(caminho) {
  const src = readFileSync(caminho, 'utf8')
  const m = mascarar(src)
  const achados = pedacosDeCrase(src)
  // texto entre tags
  for (const achado of m.matchAll(/>([^<>{}]+)</g)) {
    const bruto = achado[1]
    if (!textoValido(bruto)) continue
    achados.push({ tipo: 'texto', texto: bruto.trim(), indice: achado.index + 1 })
  }
  // atributos que a pessoa lê
  for (const achado of m.matchAll(/\b(placeholder|title|aria-label|alt)="([^"]+)"/g)) {
    if (!textoValido(achado[2])) continue
    achados.push({ tipo: achado[1], texto: achado[2].trim(), indice: achado.index })
  }
  return achados
}

const args = process.argv.slice(2)
const alvoLista = args.includes('--lista') ? args[args.indexOf('--lista') + 1] : ''

if (alvoLista) {
  for (const a of textosDoArquivo(join(RAIZ, alvoLista))) console.log(`${a.tipo}\t${a.texto}`)
} else {
  const lista = PASTAS.flatMap(p => arquivos(join(RAIZ, p)))
  const linhas = []
  let total = 0
  for (const caminho of lista) {
    const achados = textosDoArquivo(caminho)
    if (!achados.length) continue
    total += achados.length
    linhas.push({ arquivo: relative(RAIZ, caminho).replace(/\\/g, '/'), n: achados.length })
  }
  linhas.sort((a, b) => b.n - a.n)
  console.log(`TEXTOS DE TELA POR ARQUIVO (total ${total} em ${linhas.length} arquivos)\n`)
  for (const l of linhas) console.log(String(l.n).padStart(5), l.arquivo)
}
