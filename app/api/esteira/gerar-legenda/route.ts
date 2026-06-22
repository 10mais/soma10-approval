import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente } from '@/lib/redis'
import { registrarGasto, custoEstimado } from '@/lib/anthropicSaldo'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') {
    return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  }

  const KEY = process.env.ANTHROPIC_API_KEY?.trim()
  if (!KEY) return NextResponse.json({ error: 'IA nao configurada. Defina ANTHROPIC_API_KEY na Vercel.' }, { status: 500 })

  const { clienteId, briefing, sugestaoImagem, textoImagem, formato } = await req.json()
  if (!clienteId) return NextResponse.json({ error: 'clienteId obrigatorio' }, { status: 400 })

  const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'cliente nao encontrado' }, { status: 404 })

  const brand = [
    `Nome: ${cliente.nome}`,
    cliente.instagram ? `Instagram: @${(cliente.instagram || '').replace(/^@/, '')}` : '',
    cliente.segmento ? `Segmento: ${cliente.segmento}` : '',
    cliente.palavrasChave ? `Palavras-chave: ${cliente.palavrasChave}` : '',
    cliente.descricao ? `Descricao: ${cliente.descricao}` : '',
    cliente.publicoAlvo ? `Publico-alvo: ${cliente.publicoAlvo}` : '',
    cliente.tomDeVoz ? `Tom de voz: ${cliente.tomDeVoz}` : '',
    cliente.preferencias ? `Preferencias/restricoes: ${cliente.preferencias}` : '',
    cliente.documentoMarca ? `\nDocumento de marca (referencia editorial):\n${cliente.documentoMarca.slice(0, 2000)}` : '',
  ].filter(Boolean).join('\n')

  const instrucoes = [
    briefing ? `BRIEFING DA PAUTA: ${briefing}` : '',
    sugestaoImagem ? `SUGESTAO DE IMAGEM: ${sugestaoImagem}` : '',
    textoImagem ? `TEXTO NA IMAGEM: ${textoImagem}` : '',
    formato ? `FORMATO: ${formato}` : '',
  ].filter(Boolean).join('\n')

  const prompt = `Voce e um copywriter de social media de uma agencia de marketing digital. Escreva UMA legenda completa e publicavel para o post descrito abaixo.

BRAND BOARD DO CLIENTE:
${brand}

${instrucoes}

REGRAS:
- A legenda deve ser ESPECIFICA para o briefing/tema informado.
- Siga o tom de voz da marca (informado acima).
- Respeite as preferencias e restricoes.
- Inclua no maximo 5 hashtags relevantes no final.
- Se for Reel, faca um gancho forte na primeira frase.
- Nao use emojis em excesso (maximo 3-4 por legenda).
- Tamanho ideal: 3 a 6 paragrafos curtos.
- Entregue APENAS a legenda (sem explicacao, sem aspas, sem titulo).`

  try {
    const client = new Anthropic({ apiKey: KEY })
    const msg = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' } as any,
      messages: [{ role: 'user', content: prompt }],
    } as any)

    await registrarGasto(custoEstimado(msg.usage)).catch(() => {})

    const legenda = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim()
    if (!legenda) return NextResponse.json({ error: 'A IA nao retornou conteudo.' }, { status: 502 })

    return NextResponse.json({ ok: true, legenda })
  } catch (err: any) {
    return NextResponse.json({ error: `Erro: ${err?.message || 'desconhecido'}` }, { status: 500 })
  }
}
