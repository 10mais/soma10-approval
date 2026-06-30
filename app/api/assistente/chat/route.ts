import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente, ConfigAgencia } from '@/lib/redis'
import { registrarGasto, custoEstimado } from '@/lib/anthropicSaldo'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 120

type ChatMsg = { role: 'user' | 'assistant'; content: string }

// Assistente de IA flutuante (chat com o Claude) para a equipe da agencia.
// Resposta em STREAMING de texto puro: o componente le response.body em deltas.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') {
    return new Response('nao autorizado', { status: 401 })
  }

  const KEY = process.env.ANTHROPIC_API_KEY?.trim()
  if (!KEY) {
    return new Response('IA nao configurada. Defina ANTHROPIC_API_KEY na Vercel.', { status: 500 })
  }

  const body = await req.json().catch(() => null)
  const entrada: ChatMsg[] = Array.isArray(body?.messages) ? body.messages : []
  // Sanitiza e limita o historico (ultimas 20 mensagens) para conter custo/abuso
  const messages = entrada
    .filter(m => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string' && m.content.trim())
    .slice(-20)
    .map(m => ({ role: m.role, content: m.content.slice(0, 8000) }))

  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return new Response('mensagem do usuario obrigatoria', { status: 400 })
  }

  // Contexto vivo: dados do usuario, agencia e roster de clientes
  const usuario = session.user as any
  const config = await redis.get<ConfigAgencia>('config:agencia').catch(() => null)
  const nomeAgencia = config?.nomeAgencia || 'Grupo 10+'

  let listaClientes = ''
  try {
    const ids = await redis.smembers('clientes')
    const clientes = (await Promise.all(ids.map(id => redis.get<Cliente>(`cliente:${id}`)))).filter(Boolean) as Cliente[]
    listaClientes = clientes
      .filter(c => c.tipo !== 'interno')
      .map(c => `- ${c.nome}${c.segmento ? ` (${c.segmento})` : ''}${c.instagram ? ` — @${(c.instagram || '').replace(/^@/, '')}` : ''}`)
      .join('\n')
  } catch { /* roster e opcional */ }

  const system = `Voce e o assistente de IA interno da ${nomeAgencia}, uma agencia de marketing digital. Voce ajuda a EQUIPE da agencia (nao os clientes finais) dentro do sistema Soma10 — a plataforma de gestao da agencia (aprovacao de conteudo, esteira de producao, publicacao em Instagram/Facebook, tarefas, playbook, CRM de vendas e financeiro).

Voce esta conversando com ${usuario?.name || 'um membro da equipe'}${usuario?.cargo ? `, ${usuario.cargo}` : ''} (papel no sistema: ${role}).

Para que serve voce:
- Escrever e revisar copy de social media, legendas, roteiros, e-mails e propostas.
- Dar ideias de conteudo, estrategia, campanhas e planejamento.
- Tirar duvidas de marketing, redes sociais, trafego pago e atendimento a cliente.
- Ajudar a estruturar tarefas, briefings e textos do dia a dia da operacao.

${listaClientes ? `Clientes ativos da agencia (use como referencia quando o usuario citar um cliente pelo nome):\n${listaClientes}` : ''}

Regras de estilo:
- Responda SEMPRE em portugues do Brasil.
- Seja direto, pratico e acionavel — nada de generalidades vazias nem enrolacao.
- Use Markdown (negrito, listas, titulos) para organizar respostas longas.
- Quando gerar copy/legenda, entregue pronta para usar.
- Se faltar contexto essencial (ex.: qual cliente, qual objetivo), faca 1 pergunta curta antes de produzir.
- Voce nao tem acesso direto ao banco de dados nem executa acoes no sistema; voce orienta e produz texto.`

  const client = new Anthropic({ apiKey: KEY })
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const s = client.messages.stream({
          model: 'claude-opus-4-8',
          max_tokens: 2500,
          thinking: { type: 'adaptive' },
          output_config: { effort: 'low' } as any,
          system,
          messages,
        } as any)

        s.on('text', (delta: string) => {
          controller.enqueue(encoder.encode(delta))
        })

        const final = await s.finalMessage()
        await registrarGasto(custoEstimado(final.usage)).catch(() => {})
      } catch (err: any) {
        controller.enqueue(encoder.encode(`\n\n[Erro: ${err?.message || 'falha ao gerar resposta'}]`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
