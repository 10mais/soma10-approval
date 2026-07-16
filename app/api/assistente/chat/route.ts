import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente, ConfigAgencia, Agente } from '@/lib/redis'
import { registrarGasto, custoEstimado } from '@/lib/anthropicSaldo'
import { ferramentasPara, executarFerramenta, ferramentasAcaoSchemas, ehAcao, resumoAcao } from '@/lib/assistenteTools'
import { v4 as uuid } from 'uuid'
import Anthropic from '@anthropic-ai/sdk'
import { REGRA_PTBR_CURTA } from '@/lib/regraPtBr'

export const runtime = 'nodejs'
export const maxDuration = 120

type ChatMsg = { role: 'user' | 'assistant'; content: string; imagens?: string[] }

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
  // Sanitiza e limita o historico (ultimas 20 mensagens) para conter custo/abuso.
  // Mensagens do usuario podem trazer PRINTS (imagens ja subidas ao Blob): viram
  // blocos de imagem por URL para a visao do modelo (ex.: print de conversa).
  const messages: any[] = entrada
    .filter(m => (m?.role === 'user' || m?.role === 'assistant') && ((typeof m?.content === 'string' && m.content.trim()) || (m?.role === 'user' && Array.isArray(m?.imagens) && m.imagens.length > 0)))
    .slice(-20)
    .map(m => {
      const texto = typeof m.content === 'string' ? m.content.slice(0, 8000) : ''
      const urls = (m.role === 'user' && Array.isArray(m.imagens))
        ? m.imagens.filter((u: any) => typeof u === 'string' && /^https:\/\//.test(u)).slice(0, 4)
        : []
      if (urls.length) {
        return {
          role: 'user' as const,
          content: [
            ...urls.map((url: string) => ({ type: 'image' as const, source: { type: 'url' as const, url } })),
            { type: 'text' as const, text: texto || 'Analise a(s) imagem(ns) anexada(s) e ajude no atendimento.' },
          ],
        }
      }
      return { role: m.role, content: texto }
    })

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

  // Agente treinado selecionado (Fase 1: conversa + leitura). Se houver, sua persona assume.
  const agenteId = typeof body?.agenteId === 'string' ? body.agenteId : ''
  let agente: Agente | null = agenteId ? await redis.get<Agente>(`agente:${agenteId}`).catch(() => null) : null
  if (agente && agente.ativo === false) agente = null

  if (agente) {
    let listaClientes = ''
    try {
      const ids = await redis.smembers('clientes')
      const cls = ids.length ? ((await redis.mget<(Cliente | null)[]>(...ids.map(i => `cliente:${i}`))).filter(Boolean) as Cliente[]) : []
      listaClientes = cls.filter(c => c.tipo !== 'interno').map(c => `- ${c.nome}${c.segmento ? ` (${c.segmento})` : ''}${c.instagram ? ` — @${(c.instagram || '').replace(/^@/, '')}` : ''}`).join('\n')
    } catch { /* opcional */ }
    usarWebSearch = (agente.ferramentas || []).includes('web_search')
    system = `Você é "${agente.nome}"${agente.funcao ? `, ${agente.funcao}` : ''} da ${nomeAgencia}, uma agência de marketing digital. Você atua dentro do sistema Soma10 e conversa com a EQUIPE da agência (nunca com clientes finais).

Você está falando com ${usuario?.name || 'um membro da equipe'}${usuario?.cargo ? `, ${usuario.cargo}` : ''} (papel: ${role}).

${agente.instrucoes || ''}

${(agente.conhecimento || []).length ? `BASE DE CONHECIMENTO (documentos treinados neste agente — use como referência principal ao responder; cite quando fizer sentido):\n${(agente.conhecimento || []).map(d => `--- ${d.nome} ---\n${(d.texto || '').trim()}`).join('\n\n').slice(0, 16000)}\n` : ''}
${listaClientes ? `Clientes ativos da agência (use como referência quando o usuário citar um cliente pelo nome):\n${listaClientes}` : ''}

${REGRA_PTBR_CURTA}

Regras gerais: seja direto, prático e acionável; use Markdown quando ajudar a organizar. Use suas ferramentas de leitura para dados reais. Se você tiver ferramentas de AÇÃO (ex.: criar tarefa/etapa), pode PREPARÁ-las quando o usuário pedir — mas toda ação passa por CONFIRMAÇÃO do usuário antes de acontecer; você nunca executa nada sozinho. Ao preparar uma ação, confirme em texto o que foi preparado e peça para o usuário confirmar no cartão.`
  } else if (ehVendas) {
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

    system = `Você é o assistente de VENDAS da ${nomeAgencia}, uma agência de marketing digital. Você atende exclusivamente o time comercial dentro do CRM do sistema Soma10.

Você está conversando com ${usuario?.name || 'um vendedor'}${usuario?.funcaoVendas ? ` (${usuario.funcaoVendas === 'closer' ? 'Closer' : 'SDR/BDR'})` : ''}.

ESCOPO — fale SOMENTE sobre vendas. Você ajuda com:
- Prospecção, qualificação (SDR/BDR) e fechamento (Closer).
- Funil, etapas, pipeline, follow-up, cadência e próximos passos.
- Scripts de abordagem, quebra de objeções, propostas e mensagens de venda.
- Interpretar os dados do funil interno (abaixo) e sugerir ações.
- Pesquisar na web técnicas, benchmarks e referências de vendas quando útil.

Se perguntarem algo FORA de vendas (operação, criativo, social media, tarefas, financeiro), responda gentilmente que você é o assistente de vendas e só trata de temas comerciais.

FUNIL ATUAL (negócios abertos por etapa):
${resumoFunil || '(sem dados de funil)'}

NEGÓCIOS DESTE VENDEDOR:
${meusNegocios || '(nenhum negócio atribuído a você no momento)'}

Regras de estilo:
- ${REGRA_PTBR_CURTA}
- Seja direto, prático e acionável.
- Use Markdown para organizar respostas longas.
- Ao citar o funil, use os números reais acima.
- Você não executa ações no sistema; você orienta e produz texto.`
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

    system = `Você é o assistente de IA interno da ${nomeAgencia}, uma agência de marketing digital. Você ajuda a EQUIPE da agência (não os clientes finais) dentro do sistema Soma10 — a plataforma de gestão da agência (aprovação de conteúdo, esteira de produção, publicação em Instagram/Facebook, tarefas, playbook, CRM de vendas e financeiro).

Você está conversando com ${usuario?.name || 'um membro da equipe'}${usuario?.cargo ? `, ${usuario.cargo}` : ''} (papel no sistema: ${role}).

Para que serve você:
- Escrever e revisar copy de social media, legendas, roteiros, e-mails e propostas.
- Dar ideias de conteúdo, estratégia, campanhas e planejamento.
- Tirar dúvidas de marketing, redes sociais, tráfego pago e atendimento a cliente.
- Ajudar a estruturar tarefas, briefings e textos do dia a dia da operação.

${listaClientes ? `Clientes ativos da agência (use como referência quando o usuário citar um cliente pelo nome):\n${listaClientes}` : ''}

Regras de estilo:
- ${REGRA_PTBR_CURTA}
- Seja direto, prático e acionável — nada de generalidades vazias nem enrolação.
- Use Markdown (negrito, listas, títulos) para organizar respostas longas.
- Quando gerar copy/legenda, entregue pronta para usar.
- Se faltar contexto essencial (ex.: qual cliente, qual objetivo), faça 1 pergunta curta antes de produzir.
- Você TEM acesso de LEITURA aos dados reais do sistema através de ferramentas (consultar_tarefas, consultar_clientes, consultar_crm, consultar_brandboard${role === 'admin' ? ', consultar_financeiro' : ''}). Ao produzir copy/criativo/estratégia para um cliente, use consultar_brandboard ANTES para seguir as diretrizes da marca (tom, do's & don'ts, o que funciona). Quando o usuário perguntar números, status, prazos ou qualquer dado real (ex.: "quantas tarefas tenho hoje"), USE as ferramentas e responda com os dados reais — não diga que não tem acesso. Você só LÊ dados; não executa ações nem altera nada.`
  }

  const client = new Anthropic({ apiKey: KEY })
  const encoder = new TextEncoder()

  // Ferramentas de leitura do banco. Com agente: só as que ele tem habilitadas (respeitando o papel).
  const ferramentasDB = agente
    ? ferramentasPara(role).filter(t => (agente!.ferramentas || []).includes(t.name))
    : (ehVendas ? [] : ferramentasPara(role))
  // Fase 2: ferramentas de AÇÃO (só para agentes que as tenham). Não executam — geram propostas.
  const ferramentasAcao = agente ? ferramentasAcaoSchemas().filter(t => (agente!.ferramentas || []).includes(t.name)) : []
  const tools: any[] = [
    ...(usarWebSearch ? [{ type: 'web_search_20260209', name: 'web_search', max_uses: 4 }] : []),
    ...ferramentasDB,
    ...ferramentasAcao,
  ]

  const stream = new ReadableStream({
    async start(controller) {
      let convo: any[] = [...messages]
      let custoTotal = 0
      const propostas: any[] = [] // ações preparadas pelo agente, aguardando confirmação do usuário
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
            const resultados = await Promise.all(chamadas.map(async (b: any) => {
              // Ações NÃO executam aqui: viram propostas p/ o usuário confirmar
              if (ehAcao(b.name)) {
                const prop = { id: uuid(), acao: b.name, params: b.input || {}, resumo: resumoAcao(b.name, b.input), agenteId: agente?.id || '', agenteNome: agente?.nome || '' }
                propostas.push(prop)
                return { type: 'tool_result', tool_use_id: b.id, content: 'Acao PREPARADA e mostrada ao usuario para confirmar. Ainda NAO foi executada. Confirme em texto o que foi preparado e peca para ele confirmar no cartao.' }
              }
              return { type: 'tool_result', tool_use_id: b.id, content: await executarFerramenta(b.name, b.input, { role }) }
            }))
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
        // Sentinela final com as ações propostas (o cliente separa pelo caractere ␞ e some com ele do texto)
        if (propostas.length) controller.enqueue(encoder.encode('␞' + JSON.stringify(propostas)))
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
