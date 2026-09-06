import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente } from '@/lib/redis'
import { registrarGasto, custoEstimado } from '@/lib/anthropicSaldo'
import Anthropic from '@anthropic-ai/sdk'
import { REGRA_PTBR } from '@/lib/regraPtBr'

export const runtime = 'nodejs'
export const maxDuration = 120

// Relatório da semana → texto corrido para o cliente ("evidência de serviço").
// A IA recebe os FATOS já classificados (lib/relatorioSemana) e só escreve; não
// inventa entrega, não promete prazo que não está na lista.

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const KEY = process.env.ANTHROPIC_API_KEY?.trim()
  if (!KEY) return NextResponse.json({ error: 'IA não configurada. Defina ANTHROPIC_API_KEY na Vercel.' }, { status: 500 })

  const { clienteId, texto } = await req.json().catch(() => ({}))
  if (!clienteId || !texto) return NextResponse.json({ error: 'clienteId e texto são obrigatórios' }, { status: 400 })
  const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
  if (!cliente) return NextResponse.json({ error: 'cliente não encontrado' }, { status: 404 })

  const contexto = [
    `Cliente: ${cliente.nome}`,
    (cliente as any).segmento ? `Segmento: ${(cliente as any).segmento}` : '',
    (cliente as any).tomDeVoz ? `Tom de voz da marca: ${(cliente as any).tomDeVoz}` : '',
    `Agência: o Grupo 10+ (Soma10). Quem assina: ${session.user?.name || 'a equipe'}.`,
  ].filter(Boolean).join('\n')

  const prompt = `${REGRA_PTBR}

Você escreve o RELATÓRIO SEMANAL que a agência envia ao cliente por WhatsApp ou e-mail. O objetivo é EVIDÊNCIA DE SERVIÇO: o cliente precisa enxergar, em 30 segundos, o que foi feito por ele nesta semana, o valor disso e o que vem a seguir.

${contexto}

FATOS DA SEMANA (única fonte de verdade — não invente nada além disto):
${String(texto).slice(0, 6000)}

REGRAS:
- Texto corrido em português do Brasil, tom profissional e próximo, sem emojis, sem markdown (nada de asteriscos ou cerquilhas).
- Estrutura: saudação curta; "O que fizemos" (entregas, com números quando houver); "Em andamento" (deixe claro o que depende do cliente, sem cobrar de forma ríspida); "Próximos passos"; fechamento em uma linha convidando a falar.
- Se a semana não teve entregas, diga com honestidade e foque no que está sendo preparado — nunca infle.
- Máximo de 220 palavras. Sem assinatura formal; termine com o primeiro nome de quem assina.`

  try {
    const client = new Anthropic({ apiKey: KEY })
    const msg = await client.messages.create({ model: 'claude-opus-4-8', max_tokens: 900, messages: [{ role: 'user', content: prompt }] })
    await registrarGasto(custoEstimado(msg.usage)).catch(() => {})
    const narrativa = msg.content.map(c => (c.type === 'text' ? c.text : '')).join('').trim()
    if (!narrativa) return NextResponse.json({ error: 'A IA não retornou texto.' }, { status: 502 })
    return NextResponse.json({ narrativa })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Falha ao gerar o texto.' }, { status: 500 })
  }
}
