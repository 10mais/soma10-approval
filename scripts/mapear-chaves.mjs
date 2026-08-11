// Multi-tenant — inventário/checklist da migração (MULTITENANT-PLANO.md §3).
// Varre app/api e lib atrás de chamadas `redis.<método>(...)` e imprime uma
// tabela markdown: arquivo, nº de chamadas, métodos e famílias de chave literais.
// Uso:  node scripts/mapear-chaves.mjs > MULTITENANT-CHECKLIST.md
// Rodar de novo a qualquer momento — é gerado, não editado à mão.
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'

const RAIZ = process.cwd()
const ALVOS = ['app/api', 'lib']
// Fora do checklist: o próprio wrapper/registro e as rotas de admin que operam o
// banco inteiro de propósito (allowlist do teste estático).
const IGNORAR = [
  'lib/dbOrg.ts', 'lib/orgPrefix.ts', 'lib/orgs.ts', 'lib/redis.ts',
  'app/api/admin/reset-instancia/route.ts', 'lib/backup.ts',
]

function andar(dir, saida = []) {
  for (const nome of readdirSync(dir)) {
    const cheio = join(dir, nome)
    const st = statSync(cheio)
    if (st.isDirectory()) andar(cheio, saida)
    else if (/\.(ts|tsx)$/.test(nome) && !nome.endsWith('.test.ts')) saida.push(cheio)
  }
  return saida
}

const RE_CHAMADA = /redis\.([a-z][A-Za-z]*)\(\s*(?:(['"`])((?:(?!\2)[^$\\]|\\.)*?)(?:\2|\$))?/g

const linhas = []
let totalChamadas = 0
for (const alvo of ALVOS) {
  for (const arq of andar(join(RAIZ, alvo))) {
    const rel = relative(RAIZ, arq).replace(/\\/g, '/')
    if (IGNORAR.includes(rel)) continue
    const src = readFileSync(arq, 'utf8')
    const metodos = new Set()
    const familias = new Set()
    let n = 0
    for (const m of src.matchAll(RE_CHAMADA)) {
      n++
      metodos.add(m[1])
      if (m[3]) {
        // família = prefixo até o primeiro ':' (post:… -> post) ou a chave inteira (sets globais)
        const fam = m[3].includes(':') ? `${m[3].split(':')[0]}:` : m[3]
        if (fam.trim()) familias.add(fam)
      }
    }
    if (n > 0) { linhas.push({ rel, n, metodos: [...metodos].sort(), familias: [...familias].sort() }); totalChamadas += n }
  }
}

linhas.sort((a, b) => b.n - a.n)
const hoje = new Date().toISOString().slice(0, 10)
console.log(`# MULTITENANT-CHECKLIST.md — inventário de acesso ao Redis (gerado)\n`)
console.log(`> Gerado por \`node scripts/mapear-chaves.mjs\` em ${hoje}.`)
console.log(`> ${linhas.length} arquivos · ${totalChamadas} chamadas. Marcar o checkbox = arquivo migrado`)
console.log(`> para o wrapper (dbDaRequest/dbOrg) E listado em tests/isolamentoOrg.test.ts.\n`)
console.log(`| ✔ | Arquivo | Chamadas | Métodos | Famílias de chave |`)
console.log(`|---|---------|----------|---------|-------------------|`)
for (const l of linhas) {
  console.log(`| [ ] | ${l.rel} | ${l.n} | ${l.metodos.join(', ')} | ${l.familias.join(' · ') || '(dinâmicas)'} |`)
}
