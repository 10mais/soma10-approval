import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente, Plano, Post } from '@/lib/redis'
import { indexarPost } from '@/lib/postsIndex'
import { registrarGasto, custoEstimado } from '@/lib/anthropicSaldo'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
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
  if (await bloqueiaPapel((session.user as any).role, 'producao', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
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

  // Studio Fase 0 — Brand Playbook operacional (regras de OPERACAO curadas por humano).
  // Tem prioridade sobre o Brand Board por ser destilado do que de fato funciona para a marca.
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

  // Busca tendencias do Google Trends para enriquecer as pautas
  let trendsTxt = ''
  try {
    const termoPrincipal = (cliente.segmento || (cliente.palavrasChave || '').split(',')[0] || '').trim()
    if (termoPrincipal) {
      const headers: Record<string, string> = { 'accept-language': 'pt-BR' }
      const reqExplore = encodeURIComponent(JSON.stringify({ comparisonItem: [{ keyword: termoPrincipal, geo: 'BR', time: 'now 7-d' }], category: 0, property: '' }))
      const exp = await fetch(`https://trends.google.com/trends/api/explore?hl=pt-BR&tz=180&req=${reqExplore}`, { headers }).then(r => r.text()).catch(() => '')
      if (exp) {
        const expJson = JSON.parse(exp.replace(/^\)\]\}'/, ''))
        const widget = (expJson?.widgets || []).find((w: any) => w.id === 'RELATED_QUERIES')
        if (widget) {
          const reqRel = encodeURIComponent(JSON.stringify(widget.request))
          const rel = await fetch(`https://trends.google.com/trends/api/widgetdata/relatedsearches?hl=pt-BR&tz=180&req=${reqRel}&token=${widget.token}`, { headers }).then(r => r.text()).catch(() => '')
          if (rel) {
            const relJson = JSON.parse(rel.replace(/^\)\]\}'/, ''))
            const lista = relJson?.default?.rankedList?.[1]?.rankedKeyword || relJson?.default?.rankedList?.[0]?.rankedKeyword || []
            const termos = lista.slice(0, 8).map((k: any) => k.query).filter(Boolean)
            if (termos.length) trendsTxt = `\nTENDENCIAS EM ALTA (Google Trends BR, ultima semana):\n${termos.join(', ')}\nUse essas tendencias como inspiracao quando fizerem sentido para o nicho.`
          }
        }
      }
    }
  } catch { /* trends e best-effort */ }

  const prompt = `Voce e um estrategista de conteudo de uma agencia de marketing digital. Gere exatamente ${qtd} pautas de conteudo para o mes de ${mesNome}/${ano} do cliente abaixo.

BRAND BOARD DO CLIENTE:
${brand}
${playbookTxt}
${trendsTxt}

REGRAS:
- Cada pauta deve ser ESPECIFICA e acionavel para este nicho (nada generico).
- Varie os formatos: Feed (imagem estatica) e Reel (video curto). NAO sugira Stories.
- Distribua as datas ao longo do mes (3-4x por semana, exceto domingos).
- Sugira um HORARIO para cada postagem (entre 10h e 20h, variando).
- O tom de voz deve seguir o informado acima.
- Respeite as preferencias e restricoes da marca.
- As legendas devem ser completas e publicaveis (com no maximo 5 hashtags relevantes no final).

Responda APENAS com um JSON valido (sem markdown, sem explicacao, sem backticks) no formato:
[
  {
    "briefing": "tema/ideia da pauta",
    "sugestaoImagem": "descricao visual para o designer",
    "textoImagem": "texto que aparece na arte (ou vazio)",
    "legenda": "legenda completa com hashtags",
    "formato": "feed" | "reel",
    "dia": numero do dia do mes (1-${new Date(ano, plano.mes, 0).getDate()}),
    "hora": numero da hora (10-20),
    "minuto": 0 ou 30
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
      const hora = Math.min(Math.max(Number(p.hora) || 17, 6), 23)
      const minuto = [0, 30].includes(Number(p.minuto)) ? Number(p.minuto) : 0
      const dataAgendada = new Date(ano, plano.mes - 1, dia, hora, minuto, 0).toISOString()
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
        // Studio Fase 0 — captura a matéria-prima da IA para medir a taxa de edição
        iaGerado: {
          briefing: (p.briefing || '').trim(),
          sugestaoImagem: (p.sugestaoImagem || '').trim(),
          textoImagem: (p.textoImagem || '').trim(),
          legenda: (p.legenda || '').trim(),
          formato,
          geradoEm: criadoEm,
        },
      }
      await redis.set(`post:${post.id}`, post)
      await redis.sadd('posts', post.id)
      await redis.sadd(`plano:${planoId}:pautas`, post.id)
      await indexarPost(post.clienteId, post.id)
      postsCriados.push(post)
    }

    return NextResponse.json({ ok: true, quantidade: postsCriados.length })
  } catch (err: any) {
    console.error('[gerar-plano] erro:', err?.message)
    return NextResponse.json({ error: `Erro ao gerar plano: ${err?.message || 'desconhecido'}` }, { status: 500 })
  }
}
