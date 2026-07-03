import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente, BrandPlaybook } from '@/lib/redis'
import { revalidateTag } from 'next/cache'
import { registrarGasto, custoEstimado } from '@/lib/anthropicSaldo'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 300

// Equipe (nao cliente/vendas) edita o Playbook da marca.
async function equipeBrand() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente' || role === 'vendas') return null
  return session
}

const CAMPOS_PB = ['posicionamento', 'padraoCopy', 'criativosQueFuncionam', 'fazer', 'naoFazer', 'restricoes', 'observacoes'] as const

// GET ?clienteId — retorna o Playbook atual do cliente
export async function GET(req: NextRequest) {
  const session = await equipeBrand()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const clienteId = req.nextUrl.searchParams.get('clienteId') || ''
  const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })
  return NextResponse.json({ playbook: cliente.playbook || {} })
}

// PUT — salva o Playbook (curadoria humana). Marca aprovado/origem/autor.
export async function PUT(req: NextRequest) {
  const session = await equipeBrand()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const { clienteId, playbook } = await req.json()
  const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

  const limpo: BrandPlaybook = {}
  for (const c of CAMPOS_PB) limpo[c] = String((playbook || {})[c] || '').trim()
  limpo.aprovado = (playbook || {}).aprovado === true
  limpo.origemUltimaEdicao = (playbook || {}).origemUltimaEdicao === 'ia' ? 'ia' : 'manual'
  limpo.atualizadoEm = new Date().toISOString()
  limpo.atualizadoPor = session.user?.name || ''

  await redis.set(`cliente:${clienteId}`, { ...cliente, playbook: limpo })
  revalidateTag('clientes')
  return NextResponse.json({ ok: true, playbook: limpo })
}

// POST — DESTILA um rascunho de Playbook a partir do contexto da marca (Brand Board +
// documento de marca). NÃO salva: retorna o rascunho para curadoria/aprovação humana.
export async function POST(req: NextRequest) {
  const session = await equipeBrand()
  if (!session) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const KEY = process.env.ANTHROPIC_API_KEY?.trim()
  if (!KEY) return NextResponse.json({ error: 'IA não configurada (ANTHROPIC_API_KEY).' }, { status: 500 })

  const { clienteId } = await req.json()
  const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

  const contexto = [
    `Marca/cliente: ${cliente.nome}`,
    cliente.segmento ? `Segmento/Nicho: ${cliente.segmento}` : '',
    cliente.palavrasChave ? `Palavras-chave: ${cliente.palavrasChave}` : '',
    cliente.descricao ? `Descrição do negócio: ${cliente.descricao}` : '',
    cliente.publicoAlvo ? `Público-alvo: ${cliente.publicoAlvo}` : '',
    cliente.tomDeVoz ? `Tom de voz: ${cliente.tomDeVoz}` : '',
    cliente.preferencias ? `Preferências/restrições informadas: ${cliente.preferencias}` : '',
    cliente.documentoMarca ? `\nDOCUMENTO DE MARCA (referência editorial):\n${(cliente.documentoMarca || '').slice(0, 12000)}` : '',
  ].filter(Boolean).join('\n')

  if (!(cliente.segmento || cliente.documentoMarca || cliente.descricao)) {
    return NextResponse.json({ error: 'Preencha o Brand Board (segmento/descrição) ou gere o documento de marca antes de destilar o Playbook.' }, { status: 400 })
  }

  const prompt = `Você é um(a) diretor(a) de estratégia de uma agência de marketing. A partir do contexto da marca abaixo, DESTILE um PLAYBOOK OPERACIONAL — as regras práticas que a equipe (e os agentes de IA) devem seguir ao produzir conteúdo para este cliente.

Não repita o documento de marca; extraia dele apenas o que vira REGRA acionável. Onde faltar informação, proponha o padrão mais provável para o nicho (mas seja conservador em restrições).

CONTEXTO DA MARCA:
${contexto}

Responda APENAS com um objeto JSON válido (sem texto fora do JSON, sem markdown), com exatamente estas chaves (strings; use listas com "- " e quebras de linha quando fizer sentido; deixe "" se não houver base):
{
  "posicionamento": "promessa central / como a marca se posiciona, em 1-3 frases",
  "padraoCopy": "estrutura e padrão de copy que funciona (gancho, corpo, CTA, tamanho, emojis, hashtags)",
  "criativosQueFuncionam": "formatos e criativos que tendem a performar para este cliente/nicho",
  "fazer": "do's — o que SEMPRE fazer (lista)",
  "naoFazer": "don'ts — o que NUNCA fazer (lista)",
  "restricoes": "restrições legais, de marca e compliance (lista)",
  "observacoes": "outras notas úteis"
}`

  try {
    const client = new Anthropic({ apiKey: KEY })
    const msg = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    } as any)
    await registrarGasto(custoEstimado(msg.usage)).catch(() => {})

    const texto = (msg.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
    const jsonMatch = texto.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'A IA não retornou um rascunho válido. Tente novamente.' }, { status: 502 })
    let rascunho: any
    try { rascunho = JSON.parse(jsonMatch[0]) } catch { return NextResponse.json({ error: 'A IA retornou um formato inválido. Tente novamente.' }, { status: 502 }) }

    const limpo: BrandPlaybook = {}
    for (const c of CAMPOS_PB) limpo[c] = String(rascunho[c] || '').trim()
    limpo.origemUltimaEdicao = 'ia'
    limpo.aprovado = false // rascunho: aguarda curadoria humana
    return NextResponse.json({ ok: true, rascunho: limpo })
  } catch (err: any) {
    const m = err?.message || 'erro ao destilar'
    console.error('[brand/playbook] destilar:', m)
    return NextResponse.json({ error: `Erro ao destilar: ${m}` }, { status: 500 })
  }
}
