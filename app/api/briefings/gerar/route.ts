import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente } from '@/lib/redis'
import { registrarGasto, custoEstimado } from '@/lib/anthropicSaldo'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 300

// Gera (ou refina) um briefing de campanha a partir do Brand Board do cliente +
// parametros da campanha. Reusa a integracao Anthropic do documento de marca.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const KEY = process.env.ANTHROPIC_API_KEY?.trim()
  if (!KEY) return NextResponse.json({ error: 'IA não configurada. Defina ANTHROPIC_API_KEY na Vercel.' }, { status: 500 })

  const { clienteId, objetivo, plataformas, verba, periodo, publico, oferta, observacoes, refino, conteudoAtual } = await req.json()
  if (!clienteId) return NextResponse.json({ error: 'clienteId é obrigatório' }, { status: 400 })

  const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

  const brand = [
    `Cliente: ${cliente.nome}`,
    cliente.instagram ? `Instagram: @${(cliente.instagram || '').replace(/^@/, '')}` : '',
    cliente.segmento ? `Segmento / Nicho: ${cliente.segmento}` : '',
    cliente.palavrasChave ? `Palavras-chave: ${cliente.palavrasChave}` : '',
    cliente.descricao ? `Descrição do negócio: ${cliente.descricao}` : '',
    cliente.publicoAlvo ? `Público-alvo (marca): ${cliente.publicoAlvo}` : '',
    cliente.tomDeVoz ? `Tom de voz: ${cliente.tomDeVoz}` : '',
    cliente.preferencias ? `Preferências / restrições: ${cliente.preferencias}` : '',
    cliente.documentoMarca ? `\nDOCUMENTO DE MARCA (referência):\n${(cliente.documentoMarca || '').slice(0, 4000)}` : '',
  ].filter(Boolean).join('\n')

  const params = [
    objetivo ? `Objetivo da campanha: ${objetivo}` : '',
    Array.isArray(plataformas) && plataformas.length ? `Plataformas: ${plataformas.join(', ')}` : '',
    verba ? `Verba: ${verba}` : '',
    periodo ? `Período/duração: ${periodo}` : '',
    publico ? `Público desta campanha: ${publico}` : '',
    oferta ? `Oferta/promoção: ${oferta}` : '',
    observacoes ? `Observações: ${observacoes}` : '',
  ].filter(Boolean).join('\n')

  // Prompt: geracao do zero OU refino do briefing atual
  const prompt = refino && conteudoAtual
    ? `Você é um(a) estrategista de mídia paga sênior. Refine o BRIEFING DE CAMPANHA abaixo conforme o pedido, mantendo o que está bom e mantendo o formato em Markdown.

PEDIDO DE AJUSTE: ${refino}

CONTEXTO DA MARCA:
${brand}

PARÂMETROS DA CAMPANHA:
${params}

BRIEFING ATUAL:
${conteudoAtual}

Entregue apenas o briefing revisado em Markdown, sem preâmbulos.`
    : `Você é um(a) estrategista de mídia paga sênior de uma agência. A partir do contexto da marca e dos parâmetros, produza um BRIEFING DE CAMPANHA completo e acionável, em português do Brasil. Use busca na web quando útil para trazer benchmarks/tendências atuais do nicho.

CONTEXTO DA MARCA:
${brand}

PARÂMETROS DA CAMPANHA:
${params || '(não informados — proponha o que fizer sentido para o nicho)'}

Estruture em Markdown com as seções:

1. **Resumo da campanha** — objetivo, mensagem central e resultado esperado.
2. **Público-alvo e segmentações** — personas, interesses, comportamentos e segmentações sugeridas para as plataformas escolhidas.
3. **Ângulos e mensagens** — 4 a 6 ângulos de comunicação distintos, com a dor/desejo que cada um ativa.
4. **Estrutura de campanha** — como organizar campanhas/conjuntos (ex.: topo, meio, fundo de funil; remarketing), com sugestão de divisão de verba se houver verba informada.
5. **Criativos** — formatos recomendados (Reels, carrossel, imagem, story), 6 a 8 ideias concretas de criativo com a headline/conceito de cada.
6. **Copy** — exemplos de texto principal e títulos para anúncios.
7. **Ofertas e CTAs** — chamadas e ofertas que funcionam para este objetivo.
8. **KPIs e metas** — quais métricas acompanhar e benchmarks realistas para o nicho.
9. **Cronograma sugerido** — fases da campanha ao longo do período.
10. **Riscos e cuidados** — o que evitar (políticas das plataformas, fadiga de criativo, etc.).

Entregue apenas o briefing final em Markdown, sem preâmbulos.`

  try {
    const client = new Anthropic({ apiKey: KEY })
    let messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }]
    const tools: Anthropic.Tool[] = [{ type: 'web_search_20260209', name: 'web_search', max_uses: 4 } as any]

    let conteudo = ''
    let custoTotal = 0
    for (let i = 0; i < 5; i++) {
      const stream = client.messages.stream({
        model: 'claude-opus-4-8',
        max_tokens: 8000,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' } as any,
        tools,
        messages,
      } as any)
      const msg = await stream.finalMessage()
      custoTotal += custoEstimado(msg.usage)
      conteudo = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
      if (msg.stop_reason !== 'pause_turn') break
      messages = [...messages, { role: 'assistant', content: msg.content }]
    }

    await registrarGasto(custoTotal).catch(() => {})

    if (!conteudo.trim()) return NextResponse.json({ error: 'A IA não retornou conteúdo. Tente novamente.' }, { status: 502 })
    return NextResponse.json({ ok: true, conteudo })
  } catch (err: any) {
    const msg = err?.message || 'Erro desconhecido ao gerar o briefing.'
    console.error('[briefings/gerar] erro:', msg)
    return NextResponse.json({ error: `Erro ao gerar briefing: ${msg}` }, { status: 500 })
  }
}
