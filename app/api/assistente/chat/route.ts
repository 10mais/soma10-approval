import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente, ConfigAgencia } from '@/lib/redis'
import { registrarGasto, custoEstimado } from '@/lib/anthropicSaldo'
import { ferramentasPara, executarFerramenta } from '@/lib/assistenteTools'
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

  // Contexto vivo: dados do usuario e agencia
  const usuario = session.user as any
  const meuEmail = session.user?.email || ''
  const config = await redis.get<ConfigAgencia>('config:agencia').catch(() => null)
  const nomeAgencia = config?.nomeAgencia || 'Grupo 10+'
  const ehVendas = role === 'vendas'

  let system: string
  let usarWebSearch = false

  if (ehVendas) {
    // Assistente de VENDAS: so fala de vendas/funil, navega o pipeline interno e
    // pesquisa sobre vendas na web. Injeta um resumo do CRM como contexto.
    usarWebSearch = true
    let resumoFunil = ''
    let meusNegocios = ''
    try {
      const estagios = (await redis.get<any[]>('crm:estagios')) || []
      const ids = await redis.smembers('crm:negocios')
      const negocios = (await Promise.all(ids.map(id => redis.get<any>(`negocio:${id}`)))).filter(Boolean) as any[]
      const abertos = negocios.filter(n => n.status === 'aberto')
      const nomeEstagio = (eid: string) => estagios.find((e: any) => e.id === eid)?.nome || '—'
      const fmt = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      // Funil: contagem + valor por etapa (so abertos)
      resumoFunil = (Array.isArray(estagios) ? estagios : [])
        .map((e: any) => {
          const ns = abertos.filter(n => n.estagioId === e.id)
          const soma = ns.reduce((s, n) => s + (Number(n.valor) || 0), 0)
          return `- ${e.nome}: ${ns.length} negocio(s), ${fmt(soma)}`
        }).join('\n')
      // Os negocios DESTE vendedor (dono), com proximo follow-up
      meusNegocios = abertos
        .filter(n => n.dono === meuEmail)
        .slice(0, 25)
        .map(n => `- ${n.titulo || n.empresa || 'Negocio'} · ${nomeEstagio(n.estagioId)} · ${fmt(Number(n.valor) || 0)}${n.proximoFollowUp ? ` · follow-up: ${new Date(n.proximoFollowUp).toLocaleDateString('pt-BR')}` : ''}`)
        .join('\n')
    } catch { /* contexto e best-effort */ }

    system = `Voce e o assistente de VENDAS da ${nomeAgencia}, uma agencia de marketing digital. Voce atende exclusivamente o time comercial dentro do CRM do sistema Soma10.

Voce esta conversando com ${usuario?.name || 'um vendedor'}${usuario?.funcaoVendas ? ` (${usuario.funcaoVendas === 'closer' ? 'Closer' : 'SDR/BDR'})` : ''}.

ESCOPO — fale SOMENTE sobre vendas. Voce ajuda com:
- Prospeccao, qualificacao (SDR/BDR) e fechamento (Closer).
- Funil, etapas, pipeline, follow-up, cadencia e proximos passos.
- Scripts de abordagem, quebra de objecoes, propostas e mensagens de venda.
- Interpretar os dados do funil interno (abaixo) e sugerir acoes.
- Pesquisar na web tecnicas, benchmarks e referencias de vendas quando util.

Se perguntarem algo FORA de vendas (operacao, criativo, social media, tarefas, financeiro), responda gentilmente que voce e o assistente de vendas e so trata de temas comerciais.

FUNIL ATUAL (negocios abertos por etapa):
${resumoFunil || '(sem dados de funil)'}

NEGOCIOS DESTE VENDEDOR:
${meusNegocios || '(nenhum negocio atribuido a voce no momento)'}

Regras de estilo:
- Responda SEMPRE em portugues do Brasil.
- Seja direto, pratico e acionavel.
- Use Markdown para organizar respostas longas.
- Ao citar o funil, use os numeros reais acima.
- Voce nao executa acoes no sistema; voce orienta e produz texto.`
  } else {
    // Assistente geral da equipe (admin/gerente)
    let listaClientes = ''
    try {
      const ids = await redis.smembers('clientes')
      const clientes = (await Promise.all(ids.map(id => redis.get<Cliente>(`cliente:${id}`)))).filter(Boolean) as Cliente[]
      listaClientes = clientes
        .filter(c => c.tipo !== 'interno')
        .map(c => `- ${c.nome}${c.segmento ? ` (${c.segmento})` : ''}${c.instagram ? ` — @${(c.instagram || '').replace(/^@/, '')}` : ''}`)
        .join('\n')
    } catch { /* roster e opcional */ }

    system = `Voce e o assistente de IA interno da ${nomeAgencia}, uma agencia de marketing digital. Voce ajuda a EQUIPE da agencia (nao os clientes finais) dentro do sistema Soma10 — a plataforma de gestao da agencia (aprovacao de conteudo, esteira de producao, publicacao em Instagram/Facebook, tarefas, playbook, CRM de vendas e financeiro).

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
- Voce TEM acesso de LEITURA aos dados reais do sistema atraves de ferramentas (consultar_tarefas, consultar_clientes, consultar_crm${role === 'admin' ? ', consultar_financeiro' : ''}). Quando o usuario perguntar numeros, status, prazos ou qualquer dado real (ex.: "quantas tarefas tenho hoje"), USE as ferramentas e responda com os dados reais — nao diga que nao tem acesso. Voce so LE dados; nao executa acoes nem altera nada.`
  }

  const client = new Anthropic({ apiKey: KEY })
  const encoder = new TextEncoder()

  // Ferramentas de leitura do banco (so para a equipe nao-vendas; vendas usa web search)
  const ferramentasDB = ehVendas ? [] : ferramentasPara(role)
  const tools: any[] = [
    ...(usarWebSearch ? [{ type: 'web_search_20260209', name: 'web_search', max_uses: 4 }] : []),
    ...ferramentasDB,
  ]

  const stream = new ReadableStream({
    async start(controller) {
      let convo: any[] = [...messages]
      let custoTotal = 0
      try {
        // Loop de tool-use: o modelo pode consultar o banco e continuar respondendo
        for (let i = 0; i < 6; i++) {
          const s = client.messages.stream({
            model: 'claude-opus-4-8',
            max_tokens: 2500,
            thinking: { type: 'adaptive' },
            output_config: { effort: 'low' } as any,
            system,
            messages: convo,
            ...(tools.length ? { tools } : {}),
          } as any)

          s.on('text', (delta: string) => controller.enqueue(encoder.encode(delta)))

          const final = await s.finalMessage()
          custoTotal += custoEstimado(final.usage)

          // Executa as ferramentas do app que o modelo pediu (tool_use)
          const chamadas = (final.content || []).filter((b: any) => b.type === 'tool_use')
          if (final.stop_reason === 'tool_use' && chamadas.length) {
            const resultados = await Promise.all(chamadas.map(async (b: any) => ({
              type: 'tool_result',
              tool_use_id: b.id,
              content: await executarFerramenta(b.name, b.input, { role }),
            })))
            convo = [...convo, { role: 'assistant', content: final.content }, { role: 'user', content: resultados }]
            continue
          }
          // pause_turn (busca na web): retoma o mesmo turno
          if (final.stop_reason === 'pause_turn') {
            convo = [...convo, { role: 'assistant', content: final.content }]
            continue
          }
          break
        }
        await registrarGasto(custoTotal).catch(() => {})
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
