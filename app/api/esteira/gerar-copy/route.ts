import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente, Post } from '@/lib/redis'
import { registrarGasto, custoEstimado } from '@/lib/anthropicSaldo'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { bloqueiaAcao } from '@/lib/permissoesGranularServer'
import Anthropic from '@anthropic-ai/sdk'
import { REGRA_PTBR } from '@/lib/regraPtBr'

export const runtime = 'nodejs'
export const maxDuration = 120

// Linha de montagem COPY > PRODUCAO: o plano nasce como esqueleto (so briefing);
// esta rota preenche a copy estruturada de UMA pauta — headline, sub-headline,
// copy do criativo (texto na arte), CTA e legenda — a partir do briefing + DNA
// da marca. Por padrao NAO sobrescreve campo ja preenchido pela equipe: a IA
// completa os vazios; `sobrescrever: true` troca tudo (decisao de quem clicou).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') {
    return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  }
  if (await bloqueiaPapel((session.user as any).role, 'producao', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  }
  if (await bloqueiaAcao((session.user as any).role, 'gerar_ia', (session.user as any).permissoesGranular)) {
    return NextResponse.json({ error: 'sem permissão para gerar com IA' }, { status: 403 })
  }

  const KEY = process.env.ANTHROPIC_API_KEY?.trim()
  if (!KEY) return NextResponse.json({ error: 'IA nao configurada. Defina ANTHROPIC_API_KEY na Vercel.' }, { status: 500 })

  const { postId, sobrescrever } = await req.json()
  if (!postId) return NextResponse.json({ error: 'postId obrigatorio' }, { status: 400 })

  const post = await redis.get<Post>(`post:${postId}`)
  if (!post) return NextResponse.json({ error: 'pauta nao encontrada' }, { status: 404 })
  if (!(post.briefing || '').trim()) {
    return NextResponse.json({ error: 'Escreva o briefing da pauta antes de gerar a copy — é dele que a IA parte.' }, { status: 400 })
  }

  const cliente = await redis.get<Cliente>(`cliente:${post.clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'cliente nao encontrado' }, { status: 404 })

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

  // Playbook operacional tem prioridade sobre o Brand Board (mesma regra do gerar-plano).
  const pb = cliente.playbook
  const playbookCampos = pb ? [
    pb.posicionamento ? `Posicionamento: ${pb.posicionamento}` : '',
    pb.padraoCopy ? `Padrão de copy que funciona: ${pb.padraoCopy}` : '',
    pb.criativosQueFuncionam ? `Criativos que funcionam: ${pb.criativosQueFuncionam}` : '',
    pb.fazer ? `SEMPRE fazer: ${pb.fazer}` : '',
    pb.naoFazer ? `NUNCA fazer: ${pb.naoFazer}` : '',
    pb.restricoes ? `Restrições (legais/marca/compliance): ${pb.restricoes}` : '',
    pb.observacoes ? `Observações: ${pb.observacoes}` : '',
  ].filter(Boolean) : []
  const playbookTxt = playbookCampos.length
    ? `\n\nPLAYBOOK OPERACIONAL DA MARCA (${pb!.aprovado ? 'APROVADO pela equipe' : 'RASCUNHO ainda não curado — trate como forte sinal, mas priorize o bom senso'}) — estas regras têm PRIORIDADE sobre o Brand Board acima:\n${playbookCampos.join('\n')}`
    : ''

  const pauta = [
    `BRIEFING DA PAUTA: ${(post.briefing || '').trim()}`,
    post.sugestaoImagem ? `DIREÇÃO DE CRIATIVO: ${post.sugestaoImagem}` : '',
    `FORMATO: ${post.formato || 'feed'}`,
  ].filter(Boolean).join('\n')

  const prompt = `Você é um copywriter sênior de social media de uma agência de marketing digital. Escreva a copy COMPLETA e estruturada da pauta abaixo — os textos vão direto para a arte e para a legenda do post.

${REGRA_PTBR}

BRAND BOARD DO CLIENTE:
${brand}
${playbookTxt}

${pauta}

REGRAS:
- Tudo deve ser ESPECÍFICO para o briefing e o nicho (nada genérico).
- headline: a frase que vai NA ARTE (ou abertura do vídeo). Até 60 caracteres, concreta, que faça o dedo parar.
- subheadline: apoio curto da headline na arte (uma linha). Se não fizer sentido, devolva vazio.
- textoImagem: texto adicional que aparece na arte (bullets, dado, frase de apoio). Se a arte só precisa da headline, devolva vazio.
- cta: chamada para ação CURTA que vai na arte (2 a 4 palavras, ex.: "Agende sua avaliação").
- legenda: completa e publicável, 3 a 6 parágrafos curtos, gancho forte na primeira frase se for Reel, no máximo 5 hashtags relevantes no final, no máximo 3-4 emojis.
- Siga o tom de voz da marca e respeite preferências e restrições.

Responda APENAS com um JSON válido (sem markdown, sem explicação, sem backticks) no formato:
{
  "headline": "a frase da arte (até 60 caracteres)",
  "subheadline": "apoio curto ou vazio",
  "textoImagem": "texto adicional na arte ou vazio",
  "cta": "chamada curta",
  "legenda": "legenda completa com hashtags"
}`

  try {
    const client = new Anthropic({ apiKey: KEY })
    const msg = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 3000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' } as any,
      messages: [{ role: 'user', content: prompt }],
    } as any)

    await registrarGasto(custoEstimado(msg.usage)).catch(() => {})

    const texto = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
    const jsonMatch = texto.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'A IA não retornou o formato esperado. Tente novamente.' }, { status: 502 })

    let campos: any
    try { campos = JSON.parse(jsonMatch[0]) } catch {
      return NextResponse.json({ error: 'Resposta da IA não é um JSON válido. Tente novamente.' }, { status: 502 })
    }

    const CHAVES = ['headline', 'subheadline', 'textoImagem', 'cta', 'legenda'] as const
    const gerados: Record<string, string> = {}
    for (const k of CHAVES) gerados[k] = (campos?.[k] || '').toString().trim()
    if (!gerados.headline && !gerados.legenda) {
      return NextResponse.json({ error: 'A IA não retornou conteúdo utilizável. Tente novamente.' }, { status: 502 })
    }

    // Aplica: campo vazio sempre recebe; campo preenchido só com `sobrescrever`.
    const agora = new Date().toISOString()
    const aplicados: string[] = []
    const atualizado: Post = { ...post, atualizadoEm: agora }
    for (const k of CHAVES) {
      const atual = ((post as any)[k] || '').toString().trim()
      if (gerados[k] && (sobrescrever || !atual)) {
        ;(atualizado as any)[k] = gerados[k]
        aplicados.push(k)
      }
    }
    // Snapshot da taxa de edição: só o que a IA de fato escreveu agora.
    if (aplicados.length > 0) {
      atualizado.iaGerado = {
        ...(post.iaGerado || {}),
        ...Object.fromEntries(aplicados.map(k => [k, gerados[k]])),
        geradoEm: agora,
      }
      atualizado.editadoAposIA = false
      await redis.set(`post:${post.id}`, atualizado)
    }

    return NextResponse.json({ ok: true, campos: gerados, aplicados, post: atualizado })
  } catch (err: any) {
    return NextResponse.json({ error: `Erro: ${err?.message || 'desconhecido'}` }, { status: 500 })
  }
}
