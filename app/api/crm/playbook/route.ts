import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import { v4 as uuid } from 'uuid'
import { getPerfilInstancia } from '@/lib/perfisInstancia'
import { PLAYBOOK_CLINICA } from '@/lib/playbookClinica'

export const runtime = 'nodejs'

const CHAVE = 'crm:playbookQualificacao'

export type CadenciaPasso = { id: string; dia: number; canal: 'whatsapp' | 'ligacao' | 'email'; titulo: string; script: string }
export type PassoReaquecimento = { id: string; quando: string; titulo: string; script: string }
export type PlaybookQualificacao = { roteiro: string; cadencia: CadenciaPasso[]; reaquecimento?: PassoReaquecimento[] }

// Padrão da instância clínica: playbook de clínica em vez do de marketing/agência.
function padraoClinica(): PlaybookQualificacao {
  return { roteiro: PLAYBOOK_CLINICA.roteiro, cadencia: PLAYBOOK_CLINICA.cadencia.map(p => ({ id: uuid(), ...p })), reaquecimento: PLAYBOOK_CLINICA.reaquecimento.map(p => ({ id: uuid(), ...p })) }
}

function padrao(): PlaybookQualificacao {
  return {
    roteiro: [
      'Roteiro de qualificação (descobrir antes de avançar):',
      '• Qual o segmento e há quanto tempo está no mercado?',
      '• Como capta clientes hoje? O que já tentou em marketing?',
      '• Qual a maior dor/objetivo agora (mais clientes, autoridade, vendas)?',
      '• Quem decide a contratação? Tem verba prevista?',
      '• Qual a urgência? O que acontece se não resolver isso?',
    ].join('\n'),
    cadencia: [
      { id: uuid(), dia: 0, canal: 'whatsapp', titulo: 'Primeiro contato', script: 'Oi {nome}! Aqui é {sdr} da 10+. Vi o trabalho de vocês e acredito que dá pra atrair muito mais clientes com a estratégia certa. Posso te mostrar como em 10 min?' },
      { id: uuid(), dia: 1, canal: 'ligacao', titulo: 'Ligação de descoberta', script: 'Apresentar-se, aplicar o roteiro de qualificação acima, ouvir mais do que falar e marcar a reunião de diagnóstico.' },
      { id: uuid(), dia: 3, canal: 'whatsapp', titulo: 'Follow-up + prova', script: 'Oi {nome}, lembrei de você! Olha esse resultado de um cliente do mesmo segmento: [case]. Faz sentido a gente conversar 10 min essa semana?' },
      { id: uuid(), dia: 5, canal: 'email', titulo: 'E-mail de valor', script: 'Assunto: Como [segmento] está atraindo clientes em 2026\n\nConteúdo curto com 1 insight + convite para uma conversa.' },
      { id: uuid(), dia: 7, canal: 'ligacao', titulo: 'Última tentativa (break-up)', script: 'Oi {nome}, tentei algumas vezes e não quero ser inconveniente. Faz sentido seguirmos agora ou prefere que eu retome mais pra frente?' },
    ],
  }
}

async function carregar(): Promise<PlaybookQualificacao> {
  const t = await redis.get<PlaybookQualificacao>(CHAVE)
  if (t && Array.isArray(t.cadencia)) {
    // Instância que já tinha playbook salvo (a Norah) não conhece a seção nova:
    // sem isto, "Reaquecimento" nasceria vazia justamente onde o dono pediu.
    // AUSENTE = nunca viu, recebe o padrão. VAZIO = apagou de propósito, respeita.
    if (!Array.isArray(t.reaquecimento) && (await getPerfilInstancia()) === 'clinica') {
      return { ...t, reaquecimento: PLAYBOOK_CLINICA.reaquecimento.map(p => ({ id: uuid(), ...p })) }
    }
    return t
  }
  const novo = (await getPerfilInstancia()) === 'clinica' ? padraoClinica() : padrao()
  await redis.set(CHAVE, novo)
  return novo
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  return NextResponse.json(await carregar())
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'admin' && role !== 'gerente')) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const body = await req.json()
  const cadencia: CadenciaPasso[] = Array.isArray(body.cadencia)
    ? body.cadencia.map((p: any) => ({ id: String(p.id || uuid()), dia: Number(p.dia) || 0, canal: (['whatsapp', 'ligacao', 'email'].includes(p.canal) ? p.canal : 'whatsapp'), titulo: String(p.titulo || ''), script: String(p.script || '') }))
    : []
  cadencia.sort((a, b) => a.dia - b.dia)
  const reaquecimento: PassoReaquecimento[] = Array.isArray(body.reaquecimento)
    ? body.reaquecimento.map((p: any) => ({ id: String(p.id || uuid()), quando: String(p.quando || ''), titulo: String(p.titulo || ''), script: String(p.script || '') }))
    : []
  const data: PlaybookQualificacao = { roteiro: String(body.roteiro || ''), cadencia, reaquecimento }
  await redis.set(CHAVE, data)
  return NextResponse.json({ ok: true, playbook: data })
}
