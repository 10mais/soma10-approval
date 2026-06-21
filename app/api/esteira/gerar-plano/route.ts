import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente, Plano, Post } from '@/lib/redis'
import { registrarGasto, custoEstimado } from '@/lib/anthropicSaldo'
import Anthropic from '@anthropic-ai/sdk'
import { v4 as uuid } from 'uuid'

export const runtime = 'nodejs'
export const maxDuration = 300

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  const KEY = process.env.ANTHROPIC_API_KEY?.trim()
  if (!KEY) {
    return NextResponse.json({ error: 'IA não configurada. Defina ANTHROPIC_API_KEY na Vercel.' }, { status: 500 })
  }

  const { planoId, quantidade } = await req.json()
  if (!planoId) return NextResponse.json({ error: 'planoId é obrigatório' }, { status: 400 })

  const plano = await redis.get<Plano>(`plano:${planoId}`)
  if (!plano) return NextResponse.json({ error: 'plano não encontrado' }, { status: 404 })

  const cliente = await redis.get<Cliente>(`cliente:${plano.clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

  if (!(cliente.segmento || '').trim() && !(cliente.palavrasChave || '').trim()) {
    return NextResponse.json({ error: 'Preencha o Brand Board deste cliente antes de gerar o plano (segmento e palavras-chave).' }, { status: 400 })
  }

  const qtd = Math.min(Math.max(Number(quantidade) || 12, 4), 30)
  const mesNome = MESES[plano.mes - 1] || String(plano.mes)
  const ano = plano.ano

  // Monta o contexto do Brand Board
  const brand = [
    `Nome: ${cliente.nome}`,
    cliente.instagram ? `Instagram: @${(cliente.instagram || '').replace(/^@/, '')}` : '',
    cliente.segmento ? `Segmento/Nicho: ${cliente.segmento}` : '',
    cliente.palavrasChave ? `Palavras-chave: ${cliente.palavrasChave}` : '',
    cliente.descricao ? `Descrição: ${cliente.descricao}` : '',
    cliente.publicoAlvo ? `Público-alvo: ${cliente.publicoAlvo}` : '',
    cliente.tomDeVoz ? `Tom de voz: ${cliente.tomDeVoz}` : '',
    cliente.preferencias ? `Preferências/restrições: ${cliente.preferencias}` : '',
    cliente.documentoMarca ? `\nDNA da marca (referência editorial):\n${cliente.documentoMarca.slice(0, 3000)}` : '',
  ].filter(Boolean).join('\n')

  const prompt = `Você é um estrategista de conteúdo de uma agência de marketing digital. Gere exatamente ${qtd} pautas de conteúdo para o mês de ${mesNome}/${ano} do cliente abaixo.

BRAND BOARD DO CLIENTE:
${brand}

REGRAS:
- Cada pauta deve ser ESPECÍFICA e acionável para este nicho (nada genérico).
- Varie os formatos: Feed (imagem estática), Reel (vídeo curto) e Story.
- Distribua as datas ao longo do mês (3-4x por semana, exceto domingos).
- O tom de voz deve seguir o informado acima.
- Respeite as preferências e restrições da marca.
- As legendas devem ser completas e publicáveis (com hashtags relevantes no final).

Responda APENAS com um JSON válido (sem markdown, sem explicação, sem backticks) no formato:
[
  {
    "briefing": "tema/ideia da pauta",
    "sugestaoImagem": "descrição visual para o designer",
    "textoImagem": "texto que aparece na arte (ou vazio)",
    "legenda": "legenda completa com hashtags",
    "formato": "feed" | "reel" | "story",
    "dia": número do dia do mês (1-${new Date(ano, plano.mes, 0).getDate()})
  }
]`

  try {
    const client = new Anthropic({ apiKey: KEY })
    const msg = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' } as any,
      messages: [{ role: 'user', content: prompt }],
    } as any)

    await registrarGasto(custoEstimado(msg.usage)).catch(() => {})

    const texto = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
    // Extrai JSON do texto (pode vir com backticks ou texto extra)
    const jsonMatch = texto.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'A IA não retornou o formato esperado. Tente novamente.' }, { status: 502 })
    }

    let pautasGeradas: any[]
    try {
      pautasGeradas = JSON.parse(jsonMatch[0])
    } catch {
      return NextResponse.json({ error: 'Resposta da IA não é um JSON válido. Tente novamente.' }, { status: 502 })
    }

    if (!Array.isArray(pautasGeradas) || pautasGeradas.length === 0) {
      return NextResponse.json({ error: 'Nenhuma pauta gerada. Tente novamente.' }, { status: 502 })
    }

    // Cria os posts na esteira
    const criadoEm = new Date().toISOString()
    const postsCriados: Post[] = []
    for (const p of pautasGeradas) {
      const dia = Math.min(Math.max(Number(p.dia) || 1, 1), new Date(ano, plano.mes, 0).getDate())
      const dataAgendada = new Date(ano, plano.mes - 1, dia, 17, 0, 0).toISOString()
      const formato = ['feed', 'reel', 'story'].includes(p.formato) ? p.formato : 'feed'
      const post: Post = {
        id: uuid(),
        clienteId: plano.clienteId,
        clienteNome: plano.clienteNome,
        imagens: [],
        legenda: (p.legenda || '').trim(),
        status: 'rascunho',
        formato,
        dataAgendada,
        criadoPor: session.user?.name || '',
        criadoEm,
        atualizadoEm: criadoEm,
        rascunhoInterno: true,
        redes: ['instagram', 'facebook'],
        planoId,
        etapa: 'briefing',
        briefing: (p.briefing || '').trim(),
        sugestaoImagem: (p.sugestaoImagem || '').trim(),
        textoImagem: (p.textoImagem || '').trim(),
        sugestaoLegenda: (p.legenda || '').trim(),
      }
      await redis.set(`post:${post.id}`, post)
      await redis.sadd('posts', post.id)
      await redis.sadd(`plano:${planoId}:pautas`, post.id)
      postsCriados.push(post)
    }

    return NextResponse.json({ ok: true, quantidade: postsCriados.length })
  } catch (err: any) {
    console.error('[gerar-plano] erro:', err?.message)
    return NextResponse.json({ error: `Erro ao gerar plano: ${err?.message || 'desconhecido'}` }, { status: 500 })
  }
}
