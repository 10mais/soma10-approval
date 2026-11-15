import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUsuariosRaw, clientesAtivosIds } from '@/lib/cache'
import { getConfigLimite, salvarConfigLimite, tarefasAtivas } from '@/lib/limiteDemandasServer'
import { vagasDe, filaDe, ajusteEsperandoVaga, emRiscoDeAtraso, ehDemandaCriativa, type TarefaLimite } from '@/lib/limiteDemandas'
import { diaDoInstante } from '@/lib/datas'

export const runtime = 'nodejs'

// LIMITADOR DE DEMANDAS (dono, 15/11/2026). GET: as vagas de quem pede (com a fila dele, na ordem de
// pescar) e as de cada pessoa da produção (para "Produção do time", a Fila e a Carga). PUT (admin):
// liga/desliga, limite padrão e limite por pessoa. Regra em lib/limiteDemandas.

const resumo = (t: TarefaLimite) => ({
  id: t.id, titulo: t.titulo, clienteNome: t.clienteNome, status: t.status, prazo: t.prazo, prioridade: t.prioridade,
  ...(ajusteEsperandoVaga(t) ? { ajuste: true } : {}),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const eu = String(session.user?.email || '').toLowerCase()
  const [cfg, todas, usuarios, ativos] = await Promise.all([getConfigLimite(), tarefasAtivas(), getUsuariosRaw(), clientesAtivosIds()])
  // Cliente arquivado some (mesma regra das telas de produção); tarefa interna fica.
  const tarefas = todas.filter(t => !t.clienteId || ativos.has(t.clienteId)) as unknown as TarefaLimite[]
  const hoje = diaDoInstante(new Date().toISOString())

  const minhasVagas = vagasDe(eu, tarefas, cfg)
  const minhaFila = filaDe(eu, tarefas)

  // Pessoas com alguma demanda criativa aberta (ou com limite próprio configurado).
  const nomes = new Map(usuarios.filter(u => u.role !== 'cliente').map(u => [u.email.toLowerCase(), u.nome]))
  const emails = new Set<string>(Object.keys(cfg.porPessoa || {}))
  for (const t of tarefas) {
    const e = (t.responsavelEmail || '').toLowerCase()
    if (e && ehDemandaCriativa(t) && ['a_fazer', 'em_andamento', 'em_ajuste'].includes(t.status)) emails.add(e)
  }
  const porPessoa = Array.from(emails).filter(e => nomes.has(e)).map(email => {
    const v = vagasDe(email, tarefas, cfg)
    const fila = filaDe(email, tarefas)
    return {
      email, nome: nomes.get(email) || email,
      ocupadas: v.ocupadas, limite: v.limite, livres: v.livres, acima: v.acima,
      naFila: fila.length, ajustesEsperando: fila.filter(ajusteEsperandoVaga).length,
      emRisco: fila.filter(t => emRiscoDeAtraso(t, hoje)).length,
      emAndamento: v.tarefas.map(resumo),
    }
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  return NextResponse.json({
    ligado: cfg.ligado, limitePadrao: cfg.limite,
    ...(role === 'admin' ? { porPessoaConfig: cfg.porPessoa || {} } : {}),
    minhas: { ocupadas: minhasVagas.ocupadas, limite: minhasVagas.limite, livres: minhasVagas.livres, acima: minhasVagas.acima, emAndamento: minhasVagas.tarefas.map(resumo), fila: minhaFila.map(resumo) },
    porPessoa,
  })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'só admin' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const atual = await getConfigLimite()
  const nova = await salvarConfigLimite({
    ligado: b.ligado === undefined ? atual.ligado : !!b.ligado,
    limite: b.limite === undefined ? atual.limite : Number(b.limite),
    porPessoa: b.porPessoa === undefined ? atual.porPessoa : b.porPessoa,
  })
  return NextResponse.json({ ok: true, config: nova })
}
