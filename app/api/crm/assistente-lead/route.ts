import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, CrmContato, CrmNegocio, CrmEstagio } from '@/lib/redis'
import { registrarGasto, custoEstimado } from '@/lib/anthropicSaldo'
import { bloqueiaPapel } from '@/lib/permissoesPapel'
import { WaConversa, WaMensagem } from '@/lib/whatsapp'
import { ESTAGIOS_KEY } from '@/lib/crmPipelines'
import { getPerfilInstancia } from '@/lib/perfisInstancia'
import { PLAYBOOK_CLINICA } from '@/lib/playbookClinica'
import { BibliotecaVendas, CHAVE_BIBLIOTECA, bibliotecaParaPrompt } from '@/lib/bibliotecaVendas'
import { parseOrientacao } from '@/lib/orientacaoLead'
import { situacaoDaConversa, temperatura, resumoConversa } from '@/lib/raioXLead'
import Anthropic from '@anthropic-ai/sdk'
import { REGRA_PTBR } from '@/lib/regraPtBr'

export const runtime = 'nodejs'
export const maxDuration = 120

// ASSISTENTE DO ATENDIMENTO — o botão do raio-X do lead.
//
// Diferente de /api/crm/sugerir-perguntas (que devolve 3 perguntas alternativas
// para qualificar), aqui a pergunta é outra: "o que está acontecendo com este
// lead e o que eu faço AGORA?". Devolve leitura + próxima ação + UMA mensagem
// pronta para o atendente editar e mandar.
//
// O "treinamento" é o que o dono escreveu na BIBLIOTECA DE VENDAS (roteiro,
// objeções, cadências). Não existe treinamento paralelo escondido nesta rota:
// mudar o método é editar a Biblioteca, na tela, sem deploy.

const MAX_MSGS = 40

async function carregarMetodo(): Promise<string> {
  const bib = await redis.get<BibliotecaVendas>(CHAVE_BIBLIOTECA)
  if (bib) {
    const txt = bibliotecaParaPrompt(bib)
    if (txt.trim()) return txt
  }
  const pb = await redis.get<{ roteiro?: string }>('crm:playbookQualificacao')
  if (pb?.roteiro?.trim()) return pb.roteiro
  return (await getPerfilInstancia()) === 'clinica' ? PLAYBOOK_CLINICA.roteiro : ''
}

async function negocioDoContato(contatoId?: string): Promise<{ negocio: CrmNegocio; estagio?: string } | null> {
  if (!contatoId) return null
  const ids = await redis.smembers('crm:negocios')
  if (!ids.length) return null
  const negocios = ((await redis.mget<(CrmNegocio | null)[]>(...ids.map(i => `negocio:${i}`))).filter(Boolean) as CrmNegocio[])
  const negocio = negocios.find(n => n.contatoId === contatoId && n.status === 'aberto')
  if (!negocio) return null
  const estagios = (await redis.get<CrmEstagio[]>(ESTAGIOS_KEY)) || []
  return { negocio, estagio: estagios.find(e => e.id === negocio.estagioId)?.nome }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') {
    return NextResponse.json({ error: 'nao autorizado' }, { status: 401 })
  }
  if (await bloqueiaPapel((session.user as any).role, 'crm', 'editar', (session.user as any).permissoes)) {
    return NextResponse.json({ error: 'sem permissao' }, { status: 403 })
  }

  const KEY = process.env.ANTHROPIC_API_KEY?.trim()
  if (!KEY) return NextResponse.json({ error: 'IA nao configurada. Defina ANTHROPIC_API_KEY na Vercel.' }, { status: 500 })

  const body = await req.json().catch(() => ({}))
  const tel = String(body?.telefone || '').replace(/\D/g, '')
  // Pedido do atendente ("responde a objeção de preço", "reaquece") — opcional.
  const foco = String(body?.foco || '').trim().slice(0, 300)
  if (!tel) return NextResponse.json({ error: 'telefone obrigatorio' }, { status: 400 })

  const raw = await redis.lrange(`wa:msgs:${tel}`, -MAX_MSGS, -1)
  const mensagens = raw
    .map(m => { try { return typeof m === 'string' ? JSON.parse(m) : m } catch { return null } })
    .filter(Boolean) as WaMensagem[]
  if (!mensagens.length) return NextResponse.json({ error: 'Esta conversa ainda nao tem mensagens para analisar.' }, { status: 400 })

  const conversa = await redis.get<WaConversa>(`wa:conversa:${tel}`)
  const contato = conversa?.contatoId ? await redis.get<CrmContato>(`contato:${conversa.contatoId}`) : null
  const [metodo, negDados] = await Promise.all([carregarMetodo(), negocioDoContato(conversa?.contatoId)])

  const nome = contato?.nome || conversa?.nome || ''
  const agora = new Date()
  // O raio-X vai JUNTO no prompt: a IA não precisa recontar o tempo (e errar) —
  // a conta é a mesma que o atendente está vendo na tela.
  const sit = situacaoDaConversa(mensagens as any, agora)
  const temp = temperatura(mensagens as any, agora)
  const resumo = resumoConversa(mensagens as any, agora)

  const transcricao = mensagens
    .map(m => `${m.de === 'cliente' ? (nome || 'PACIENTE') : 'NOS'}: ${m.texto || `[${m.tipo || 'midia'}]`}`)
    .join('\n')

  const contexto = [
    nome ? `Nome: ${nome}` : '',
    contato?.tipo ? `Tipo de contato: ${contato.tipo}` : '',
    contato?.etiquetas?.length ? `Etiquetas: ${contato.etiquetas.join(', ')}` : '',
    (contato as any)?.ultimoProcedimento ? `Último procedimento: ${(contato as any).ultimoProcedimento}` : '',
    negDados?.estagio ? `Etapa atual no funil: ${negDados.estagio}` : '',
    negDados?.negocio.origem ? `Origem do lead: ${negDados.negocio.origem}` : '',
    negDados?.negocio.queixaPrincipal ? `Queixa principal registrada: ${negDados.negocio.queixaPrincipal}` : '',
    negDados?.negocio.dores ? `Observações: ${negDados.negocio.dores}` : '',
    `Situação da conversa: ${sit.label} — ${sit.detalhe}`,
    `Temperatura: ${temp.label} — ${temp.motivo}`,
    `Mensagens: ${resumo.total} no total (${resumo.doCliente} dela, ${resumo.nossas} nossas).`,
  ].filter(Boolean).join('\n')

  const prompt = `Você é a assistente de atendimento desta empresa, orientando quem está com o WhatsApp aberto agora. Leia a conversa e diga o que fazer NESTE momento.

${REGRA_PTBR}

${metodo ? `MÉTODO OFICIAL DA CASA (siga à risca — é o treinamento desta empresa):\n${metodo}\n` : ''}
O QUE SABEMOS DA PESSOA:
${contexto}

CONVERSA (a última linha é a mais recente):
${transcricao}
${foco ? `\nO ATENDENTE PEDIU ESPECIFICAMENTE: ${foco}\n` : ''}
SUA TAREFA:
1. "leitura": em 1 ou 2 frases, o que está acontecendo com este lead (interesse real, objeção, sumiço, hesitação).
2. "proximaAcao": o que o atendente deve fazer agora, em uma frase imperativa e concreta.
3. "mensagem": UMA mensagem pronta para enviar no WhatsApp, no tom da casa, que executa a próxima ação.
4. "alertas": até 3 riscos do que NÃO fazer com esta pessoa agora (ex.: não mandar preço ainda).
5. "fase": em que fase do método a conversa está.

REGRAS:
- Não invente NADA: nem preço, nem prazo, nem horário, nem resultado clínico, nem procedimento que não apareça na conversa ou nos dados acima.
- Respeite as regras de ouro do método (se ele proíbe antecipar preço/detalhe técnico, não antecipe).
- A mensagem vai direto para a pessoa: WhatsApp, 2 a 5 linhas, calorosa, sem parecer robô, ortografia e acentuação impecáveis.
- Ancore nas palavras que ELA usou; se ela não respondeu há dias, reaqueça sem cobrar e sem culpa.
- Uma pergunta só no fim da mensagem, para ela ter o que responder.

Responda APENAS com um objeto JSON válido, sem texto ao redor, sem markdown:
{"leitura":"...","proximaAcao":"...","mensagem":"...","alertas":["..."],"fase":"..."}`

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

    const texto = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim()
    const orientacao = parseOrientacao(texto)
    if (!orientacao) return NextResponse.json({ error: 'A IA nao retornou uma orientacao. Tente de novo.' }, { status: 502 })

    return NextResponse.json({ ok: true, orientacao })
  } catch (err: any) {
    return NextResponse.json({ error: `Erro: ${err?.message || 'desconhecido'}` }, { status: 500 })
  }
}
