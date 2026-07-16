import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import { v4 as uuid } from 'uuid'
import { getPerfilInstancia } from '@/lib/perfisInstancia'
import { BibliotecaVendas, BibliotecaSeed, CHAVE_BIBLIOTECA, vazia, FASES } from '@/lib/bibliotecaVendas'
import { migrarPlaybook, juntar, PlaybookAntigo } from '@/lib/bibliotecaMigrar'
import { SEED_MARKETING } from '@/lib/bibliotecaSeeds/marketing'
import { SEED_CLINICA } from '@/lib/bibliotecaSeeds/clinica'

export const runtime = 'nodejs'

// Biblioteca de Vendas do CRM. Uma estrutura, N nichos: o que muda por perfil é
// só o SEED. Semeada na primeira leitura e editável depois (admin/gerente).

const CHAVE_PLAYBOOK_ANTIGO = 'crm:playbookQualificacao'

function seedDoPerfil(perfil: string | null): BibliotecaSeed | null {
  if (perfil === 'clinica') return SEED_CLINICA
  if (!perfil) return SEED_MARKETING // instância sem perfil = agência (o 10+)
  return null // gestão/turismo: estrutura pronta, conteúdo a escrever
}

// Dá id a tudo que veio do seed (o seed é escrito sem id, para não repetir uuid
// no arquivo de conteúdo).
function instalar(seed: BibliotecaSeed | null): BibliotecaVendas {
  if (!seed) return vazia()
  return {
    objecoes: seed.objecoes.map(c => ({ id: uuid(), nome: c.nome, respostas: c.respostas.map(r => ({ id: uuid(), ...r })) })),
    cadencias: seed.cadencias.map(c => ({ id: uuid(), nome: c.nome, descricao: c.descricao, mensagens: c.mensagens.map(m => ({ id: uuid(), ...m })) })),
    roteiros: seed.roteiros.map(r => ({ id: uuid(), nome: r.nome, descricao: r.descricao, perguntas: r.perguntas.map(p => ({ id: uuid(), ...p })) })),
    reaquecimento: {
      leads: seed.reaquecimento.leads.map(s => ({ id: uuid(), ...s, mensagens: s.mensagens.map(m => ({ id: uuid(), ...m })) })),
      clientes: seed.reaquecimento.clientes.map(s => ({ id: uuid(), ...s, mensagens: s.mensagens.map(m => ({ id: uuid(), ...m })) })),
    },
  }
}

async function carregar(): Promise<BibliotecaVendas> {
  const salva = await redis.get<BibliotecaVendas>(CHAVE_BIBLIOTECA)
  if (salva && Array.isArray(salva.objecoes)) return salva

  // Primeira vez: instala o nicho E ABSORVE o playbook antigo — lá tem texto
  // refinado à mão (o DÉCADA da Norah). O antigo fica intacto no Redis: se esta
  // migração estiver errada, o original ainda está lá para conferir.
  const perfil = await getPerfilInstancia()
  const antigo = await redis.get<PlaybookAntigo>(CHAVE_PLAYBOOK_ANTIGO)
  const nova = juntar(instalar(seedDoPerfil(perfil)), migrarPlaybook(antigo))
  await redis.set(CHAVE_BIBLIOTECA, nova)
  return nova
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  return NextResponse.json(await carregar())
}

// Escrita: admin/gerente (mesma régua do Playbook que isto substitui).
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'admin' && role !== 'gerente')) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const b = await req.json().catch(() => null)
  if (!b) return NextResponse.json({ error: 'corpo inválido' }, { status: 400 })

  const txt = (v: unknown) => String(v ?? '')
  const item = (m: any) => ({ id: txt(m?.id) || uuid(), titulo: txt(m?.titulo), contexto: txt(m?.contexto), texto: txt(m?.texto) })
  const fases = FASES.map(f => f.key)

  const data: BibliotecaVendas = {
    objecoes: (Array.isArray(b.objecoes) ? b.objecoes : []).map((c: any) => ({
      id: txt(c?.id) || uuid(), nome: txt(c?.nome),
      respostas: (Array.isArray(c?.respostas) ? c.respostas : []).map(item),
    })),
    cadencias: (Array.isArray(b.cadencias) ? b.cadencias : []).map((c: any) => ({
      id: txt(c?.id) || uuid(), nome: txt(c?.nome), descricao: txt(c?.descricao) || undefined,
      mensagens: (Array.isArray(c?.mensagens) ? c.mensagens : []).map((m: any) => ({
        ...item(m), fase: fases.includes(m?.fase) ? m.fase : 'abordagem',
      })),
    })),
    roteiros: (Array.isArray(b.roteiros) ? b.roteiros : []).map((r: any) => ({
      id: txt(r?.id) || uuid(), nome: txt(r?.nome), descricao: txt(r?.descricao) || undefined,
      perguntas: (Array.isArray(r?.perguntas) ? r.perguntas : []).map((p: any) => ({
        id: txt(p?.id) || uuid(), pergunta: txt(p?.pergunta), contexto: txt(p?.contexto),
        ...(p?.seSim ? { seSim: txt(p.seSim) } : {}), ...(p?.seNao ? { seNao: txt(p.seNao) } : {}), ...(p?.parada ? { parada: txt(p.parada) } : {}),
      })),
    })),
    reaquecimento: {
      leads: (Array.isArray(b.reaquecimento?.leads) ? b.reaquecimento.leads : []).map((s: any) => ({
        id: txt(s?.id) || uuid(), nome: txt(s?.nome), quando: txt(s?.quando),
        mensagens: (Array.isArray(s?.mensagens) ? s.mensagens : []).map(item),
      })),
      clientes: (Array.isArray(b.reaquecimento?.clientes) ? b.reaquecimento.clientes : []).map((s: any) => ({
        id: txt(s?.id) || uuid(), nome: txt(s?.nome), quando: txt(s?.quando),
        mensagens: (Array.isArray(s?.mensagens) ? s.mensagens : []).map(item),
      })),
    },
  }
  await redis.set(CHAVE_BIBLIOTECA, data)
  return NextResponse.json({ ok: true, biblioteca: data })
}
