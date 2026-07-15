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
import { parseSugestoes } from '@/lib/sugestaoPerguntas'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 120

// Sugere as PRÓXIMAS PERGUNTAS a fazer para um lead/paciente no inbox do CRM.
// Não escreve a resposta pronta nem envia nada: devolve perguntas que o
// atendente escolhe, edita e manda. O método vem do playbook configurado da
// instância (crm:playbookQualificacao) — clínica usa o MÉTODO DÉCADA, agência
// usa o roteiro de qualificação. Um código só; o comportamento muda pelo dado.

const MAX_MSGS = 40 // histórico recente que vai no prompt

// Playbook: mesma chave/shape da rota /api/crm/playbook (só o roteiro importa aqui).
async function carregarRoteiro(): Promise<string> {
  const pb = await redis.get<{ roteiro?: string }>('crm:playbookQualificacao')
  if (pb?.roteiro?.trim()) return pb.roteiro
  // Instância que nunca abriu a aba Playbook ainda não tem a chave semeada.
  return (await getPerfilInstancia()) === 'clinica' ? PLAYBOOK_CLINICA.roteiro : ''
}

// A oportunidade aberta do contato dá a fase do funil e a queixa já levantada.
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

  const { telefone } = await req.json()
  const tel = String(telefone || '').replace(/\D/g, '')
  if (!tel) return NextResponse.json({ error: 'telefone obrigatorio' }, { status: 400 })

  const raw = await redis.lrange(`wa:msgs:${tel}`, -MAX_MSGS, -1)
  const mensagens = raw
    .map(m => { try { return typeof m === 'string' ? JSON.parse(m) : m } catch { return null } })
    .filter(Boolean) as WaMensagem[]
  if (!mensagens.length) return NextResponse.json({ error: 'Esta conversa ainda nao tem mensagens para analisar.' }, { status: 400 })

  const conversa = await redis.get<WaConversa>(`wa:conversa:${tel}`)
  const contato = conversa?.contatoId ? await redis.get<CrmContato>(`contato:${conversa.contatoId}`) : null
  const [roteiro, negDados] = await Promise.all([carregarRoteiro(), negocioDoContato(conversa?.contatoId)])

  const nome = contato?.nome || conversa?.nome || ''
  const transcricao = mensagens
    .map(m => `${m.de === 'cliente' ? (nome || 'PACIENTE') : 'NOS'}: ${m.texto || `[${m.tipo || 'midia'}]`}`)
    .join('\n')

  const contexto = [
    nome ? `Nome: ${nome}` : '',
    contato?.tipo ? `Tipo de contato: ${contato.tipo}` : '',
    contato?.nascimento ? `Nascimento: ${contato.nascimento}` : '',
    contato?.etiquetas?.length ? `Etiquetas: ${contato.etiquetas.join(', ')}` : '',
    negDados?.estagio ? `Etapa atual no funil: ${negDados.estagio}` : '',
    negDados?.negocio.origem ? `Origem do lead: ${negDados.negocio.origem}` : '',
    negDados?.negocio.queixaPrincipal ? `Queixa principal ja registrada: ${negDados.negocio.queixaPrincipal}` : '',
    negDados?.negocio.dores ? `Dores levantadas: ${negDados.negocio.dores}` : '',
  ].filter(Boolean).join('\n') || 'Nenhum dado cadastrado alem da conversa.'

  const prompt = `Voce e um SDR experiente. Analise a conversa de WhatsApp abaixo e sugira as PROXIMAS PERGUNTAS que o atendente deve fazer para criar conexao com a pessoa e avancar a venda.

${roteiro ? `PLAYBOOK OFICIAL (o metodo desta empresa — siga as fases e as regras a risca):\n${roteiro}\n` : ''}
O QUE JA SABEMOS SOBRE A PESSOA:
${contexto}

CONVERSA ATE AGORA (a ultima linha e a mais recente):
${transcricao}

SUA TAREFA:
1. Identifique em que fase do playbook a conversa esta AGORA (pela ultima mensagem, nao pelo inicio).
2. Sugira exatamente 3 perguntas para a mensagem seguinte.

REGRAS:
- PERGUNTAS, nao afirmacoes: cada sugestao termina em "?" e convida a pessoa a falar.
- Uma pergunta de cada vez: cada sugestao e uma opcao alternativa, nao um bloco para enviar junto.
- Nao repita o que ja foi perguntado na conversa; avance a partir da ultima resposta da pessoa.
- Ancore na fala DELA: use as palavras/queixas que ela mesma usou.
- Respeite as regras de ouro do playbook (ex.: nao antecipar preco ou detalhe tecnico se o playbook proibir).
- Nao invente fato algum: nem valor, nem horario, nem procedimento, nem prazo, nem resultado.
- Tom de WhatsApp: 1 ou 2 frases, pt-BR natural e caloroso, sem parecer questionario nem robo.
- Se a pessoa demonstrou objecao, priorize a pergunta que abre a objecao antes de reconduzir.
- Ortografia e gramatica pt-BR impecaveis (acentuacao e pontuacao corretas) — o texto vai direto para o paciente.

Responda APENAS com um array JSON valido, sem texto ao redor, sem markdown:
[{"pergunta":"a pergunta pronta para enviar","porque":"o que ela destrava, em ate 12 palavras","fase":"a fase do playbook"}]`

  try {
    const client = new Anthropic({ apiKey: KEY })
    const msg = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1500,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' } as any,
      messages: [{ role: 'user', content: prompt }],
    } as any)

    await registrarGasto(custoEstimado(msg.usage)).catch(() => {})

    const texto = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim()
    const sugestoes = parseSugestoes(texto)
    if (!sugestoes.length) return NextResponse.json({ error: 'A IA nao retornou sugestoes. Tente de novo.' }, { status: 502 })

    return NextResponse.json({ ok: true, sugestoes })
  } catch (err: any) {
    return NextResponse.json({ error: `Erro: ${err?.message || 'desconhecido'}` }, { status: 500 })
  }
}
