import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente } from '@/lib/redis'
import { registrarGasto, custoEstimado } from '@/lib/anthropicSaldo'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 300 // Vercel Pro: até 5 min para a pesquisa + geração

// Gera um documento de marca aprofundado a partir do Brand Board do cliente.
// Usa o Claude (com busca na web) para pesquisar o nicho e produzir uma
// referência editorial completa para a produção de criativos.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  const KEY = process.env.ANTHROPIC_API_KEY?.trim()
  if (!KEY) {
    return NextResponse.json({
      error: 'IA não configurada. Defina a variável de ambiente ANTHROPIC_API_KEY na Vercel (crie a chave em console.anthropic.com).',
    }, { status: 500 })
  }

  const { clienteId } = await req.json()
  if (!clienteId) return NextResponse.json({ error: 'clienteId é obrigatório' }, { status: 400 })

  const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

  if (!(cliente.segmento || '').trim() && !(cliente.palavrasChave || '').trim()) {
    return NextResponse.json({
      error: 'Preencha ao menos o Segmento/Nicho e palavras-chave no Brand Board antes de gerar o documento.',
    }, { status: 400 })
  }

  const brand = [
    `Nome da marca/cliente: ${cliente.nome}`,
    cliente.instagram ? `Instagram: @${(cliente.instagram || '').replace(/^@/, '')}` : '',
    cliente.segmento ? `Segmento / Nicho: ${cliente.segmento}` : '',
    cliente.palavrasChave ? `Palavras-chave: ${cliente.palavrasChave}` : '',
    cliente.descricao ? `Descrição do negócio: ${cliente.descricao}` : '',
    cliente.publicoAlvo ? `Público-alvo: ${cliente.publicoAlvo}` : '',
    cliente.tomDeVoz ? `Tom de voz: ${cliente.tomDeVoz}` : '',
    cliente.preferencias ? `Preferências / restrições da marca: ${cliente.preferencias}` : '',
  ].filter(Boolean).join('\n')

  const prompt = `Você é um(a) estrategista de conteúdo sênior de uma agência de marketing. A partir do Brand Board abaixo, pesquise mais a fundo o nicho deste cliente (tendências atuais, comportamento do público, concorrência, sazonalidades, formatos que performam) usando busca na web quando útil, e produza um DOCUMENTO DE MARCA completo e prático, em português do Brasil.

Esse documento servirá de referência para a produção de criativos e linhas editoriais futuras. Seja específico e acionável — nada de generalidades vazias.

BRAND BOARD DO CLIENTE:
${brand}

Estruture o documento em Markdown com as seções:

1. **Resumo da marca** — posicionamento em 2-3 frases.
2. **O nicho em profundidade** — panorama do mercado/segmento, tendências atuais e o que está em alta agora.
3. **Persona do público-alvo** — quem é, dores, desejos, objeções, onde consome conteúdo.
4. **Pilares de conteúdo** — 4 a 6 pilares editoriais, cada um com objetivo e exemplos de pauta.
5. **Tom de voz e linguagem** — como falar, palavras a usar e a evitar.
6. **Diretrizes visuais e de criativos** — estilo de imagem, cores, formatos (Reels, carrossel, story) e o que funciona neste nicho.
7. **Ideias de conteúdo** — 15 sugestões concretas de posts (com formato sugerido).
8. **Hashtags e SEO social** — conjuntos de hashtags recomendados.
9. **Calendário/sazonalidades** — datas e ganchos relevantes para o nicho ao longo do ano.
10. **O que evitar** — riscos e armadilhas de conteúdo para esta marca.

Entregue apenas o documento final em Markdown, sem preâmbulos.`

  try {
    const client = new Anthropic({ apiKey: KEY })

    let messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }]
    const tools: Anthropic.Tool[] = [{ type: 'web_search_20260209', name: 'web_search', max_uses: 12 } as any]

    let documento = ''
    let custoTotal = 0
    // Loop para lidar com pause_turn quando a busca na web ultrapassa o limite de iterações
    for (let i = 0; i < 5; i++) {
      const stream = client.messages.stream({
        model: 'claude-opus-4-8',
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high' } as any,
        tools,
        messages,
      } as any)
      const msg = await stream.finalMessage()
      custoTotal += custoEstimado(msg.usage)

      documento = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')

      if (msg.stop_reason !== 'pause_turn') break
      messages = [...messages, { role: 'assistant', content: msg.content }]
    }

    // Desconta o custo estimado do saldo e alerta os admins se estiver acabando
    await registrarGasto(custoTotal).catch(() => {})

    if (!documento.trim()) {
      return NextResponse.json({ error: 'A IA não retornou conteúdo. Tente novamente.' }, { status: 502 })
    }

    const geradoEm = new Date().toISOString()
    const atualizado: Cliente = { ...cliente, documentoMarca: documento, documentoMarcaGeradoEm: geradoEm }
    await redis.set(`cliente:${clienteId}`, atualizado)

    return NextResponse.json({ ok: true, documentoMarca: documento, documentoMarcaGeradoEm: geradoEm })
  } catch (err: any) {
    const msg = err?.message || 'Erro desconhecido ao gerar o documento.'
    console.error('[brand/gerar-documento] erro:', msg)
    return NextResponse.json({ error: `Erro ao gerar documento: ${msg}` }, { status: 500 })
  }
}
