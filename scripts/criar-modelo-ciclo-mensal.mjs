/**
 * Cria (ou atualiza) o modelo de projeto "Ciclo mensal — Social Media".
 *
 * Escreve APENAS a chave `template:{id}` e o índice `templates`. Nenhum dado de
 * cliente é tocado: aplicar o modelo a um cliente continua sendo o clique em
 * Modelos → "Aplicar a cliente", que é quem cria marcos e tarefas de verdade.
 *
 * Idempotente: rodar duas vezes atualiza o mesmo modelo em vez de duplicar.
 *
 * Uso:
 *   1. Traga as credenciais para o .env.local (uma das duas):
 *        vercel env pull .env.local
 *        — ou cole KV_REST_API_URL e KV_REST_API_TOKEN manualmente.
 *   2. node scripts/criar-modelo-ciclo-mensal.mjs
 *      Use --dry para ver o que seria gravado sem escrever nada.
 */
import { readFileSync } from 'node:fs'
import { Redis } from '@upstash/redis'
import { v4 as uuid } from 'uuid'

// .env.local não é carregado fora do Next — parse mínimo, sem nova dependência.
function carregarEnv(arquivo = '.env.local') {
  try {
    for (const linha of readFileSync(arquivo, 'utf8').split('\n')) {
      const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {}
}
carregarEnv()

const NOME = 'Ciclo mensal — Social Media'

// Etapas em SÉRIE: /api/templates/aplicar encadeia (fim de uma = início da
// próxima). A soma dos diasDuracao é o comprimento do ciclo — 30 dias.
const marcos = [
  { titulo: 'Briefing e alinhamento do mês', categoria: 'reuniao', diasDuracao: 2, descricao: 'Entender o que o cliente tem de novo no mês: datas, promoções, prioridades.' },
  { titulo: 'Planejamento de pautas', categoria: 'estrategia', diasDuracao: 3, descricao: 'Montar o plano do mês e fechar as pautas com a equipe.' },
  { titulo: 'Copy', categoria: 'social_media', diasDuracao: 4, descricao: 'Escrever as legendas de todas as pautas do mês.' },
  { titulo: 'Criativos', categoria: 'social_media', diasDuracao: 6, descricao: 'Produzir as artes de cada pauta.' },
  { titulo: 'Aprovação do cliente', categoria: 'entrega', diasDuracao: 4, descricao: 'Enviar o mês para aprovação e aplicar os ajustes pedidos.' },
  { titulo: 'Veiculação', categoria: 'social_media', diasDuracao: 9, descricao: 'Agendar e acompanhar as publicações no ar.' },
  { titulo: 'Relatório do mês', categoria: 'entrega', diasDuracao: 2, descricao: 'Fechar os resultados e apresentar ao cliente.' },
]

// tipo/prioridade usam só os valores oferecidos pelo editor em Modelos.tsx —
// um tipo fora dessa lista deixa o select em branco ao editar o modelo na tela.
const tarefas = [
  { titulo: 'Reunião de briefing com o cliente', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 0 },
  { titulo: 'Coletar novidades, datas e promoções do mês', tipo: 'tarefa', prioridade: 'media', marcoIndice: 0 },
  { titulo: 'Gerar plano do mês com IA', tipo: 'planejamento', prioridade: 'alta', marcoIndice: 1 },
  { titulo: 'Revisar e ajustar as pautas', tipo: 'planejamento', prioridade: 'alta', marcoIndice: 1 },
  { titulo: 'Escrever legendas das pautas', tipo: 'post', prioridade: 'alta', marcoIndice: 2 },
  { titulo: 'Revisão interna de copy', tipo: 'tarefa', prioridade: 'media', marcoIndice: 2 },
  { titulo: 'Gerar artes dos posts', tipo: 'criativo', prioridade: 'alta', marcoIndice: 3 },
  { titulo: 'Ajuste fino dos criativos', tipo: 'criativo', prioridade: 'media', marcoIndice: 3 },
  { titulo: 'Enviar pautas para aprovação', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 4 },
  { titulo: 'Aplicar ajustes pedidos pelo cliente', tipo: 'tarefa', prioridade: 'urgente', marcoIndice: 4 },
  { titulo: 'Agendar publicações do mês', tipo: 'post', prioridade: 'alta', marcoIndice: 5 },
  { titulo: 'Monitorar publicações e engajamento', tipo: 'tarefa', prioridade: 'media', marcoIndice: 5 },
  { titulo: 'Fechar relatório de resultados', tipo: 'estrategia', prioridade: 'alta', marcoIndice: 6 },
  { titulo: 'Reunião de resultados com o cliente', tipo: 'tarefa', prioridade: 'alta', marcoIndice: 6 },
]

const dias = marcos.reduce((s, m) => s + m.diasDuracao, 0)
const seco = process.argv.includes('--dry')

if (seco) {
  console.log(`[dry] "${NOME}" — ${marcos.length} etapas (${dias} dias), ${tarefas.length} tarefas`)
  for (const [i, m] of marcos.entries()) {
    console.log(`  ${i + 1}. ${m.titulo} (${m.categoria}, ${m.diasDuracao}d)`)
    for (const t of tarefas.filter(t => t.marcoIndice === i)) console.log(`       · ${t.titulo} [${t.tipo}/${t.prioridade}]`)
  }
  process.exit(0)
}

if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
  console.error('Faltam KV_REST_API_URL e KV_REST_API_TOKEN. Rode `vercel env pull .env.local` ou cole as duas no .env.local.')
  process.exit(1)
}

const redis = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })

const ids = await redis.smembers('templates')
const existentes = ids.length ? (await redis.mget(...ids.map(i => `template:${i}`))).filter(Boolean) : []
const anterior = existentes.find(t => t?.nome === NOME)

const template = {
  id: anterior?.id || uuid(),
  nome: NOME,
  descricao: `Ciclo padrão de ${dias} dias: briefing → pautas → copy → criativos → aprovação → veiculação → relatório. Etapas extras (tráfego, landing page, branding) entram caso a caso pelo Playbook do cliente.`,
  marcos,
  tarefas,
  criadoPor: anterior?.criadoPor || 'script',
  criadoEm: anterior?.criadoEm || new Date().toISOString(),
}

await redis.set(`template:${template.id}`, template)
await redis.sadd('templates', template.id)

console.log(`${anterior ? 'Atualizado' : 'Criado'}: "${NOME}" (${template.id})`)
console.log(`${marcos.length} etapas · ${dias} dias · ${tarefas.length} tarefas`)
console.log('Agora é só ir em Modelos → "Aplicar a cliente" e escolher a data de início.')
