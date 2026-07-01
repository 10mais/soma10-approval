import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis, Cliente, Usuario, CrmNegocio, CrmContato, TemplateProjeto, Marco, Tarefa } from '@/lib/redis'
import { revalidateTag } from 'next/cache'
import { notificarEquipe } from '@/lib/notificacoes'
import { v4 as uuid } from 'uuid'
import bcrypt from 'bcryptjs'

export const runtime = 'nodejs'

function gerarSenha() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

// Converte um negócio GANHO em Cliente: cria o cliente (com login opcional),
// aplica um modelo de entregas (marcos+tarefas no Playbook), grava a passagem de
// bastão (handoff) no cliente e vincula o negócio.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  // Closer (vendas) faz a passagem de bastao Ganho->Cliente; admin/gerente tambem
  if (!session || (role !== 'admin' && role !== 'gerente' && role !== 'vendas')) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const { negocioId, cliente: dados, handoff, templateId, dataInicio } = await req.json()
  const negocio = await redis.get<CrmNegocio>(`negocio:${negocioId}`)
  if (!negocio) return NextResponse.json({ error: 'negócio não encontrado' }, { status: 404 })
  if (negocio.clienteId) return NextResponse.json({ error: 'este negócio já foi convertido em cliente' }, { status: 400 })
  if (!String(dados?.nome || '').trim()) return NextResponse.json({ error: 'informe o nome do cliente' }, { status: 400 })

  const contato = negocio.contatoId ? await redis.get<CrmContato>(`contato:${negocio.contatoId}`) : null
  const agora = new Date().toISOString()
  const autor = session.user?.name || ''

  // Texto da passagem de bastão (Closer -> Gestor) para o onboarding
  const handoffVendas = [
    negocio.empresa ? `Empresa: ${negocio.empresa}` : '',
    negocio.segmento ? `Segmento: ${negocio.segmento}` : '',
    negocio.faturamentoEstimado ? `Faturamento estimado: ${negocio.faturamentoEstimado}` : '',
    negocio.valor ? `Valor fechado: ${Number(negocio.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : '',
    contato ? `Contato: ${contato.nome}${contato.telefone ? ' · ' + contato.telefone : ''}` : '',
    negocio.donoNome ? `Vendido por: ${negocio.donoNome}` : '',
    handoff?.escopoVendido ? `\n— Escopo vendido —\n${handoff.escopoVendido}` : '',
    handoff?.expectativas ? `\n— Expectativas/objetivos —\n${handoff.expectativas}` : '',
    negocio.dores ? `\n— Dores levantadas —\n${negocio.dores}` : '',
    negocio.solucoes ? `\n— Soluções propostas —\n${negocio.solucoes}` : '',
    handoff?.detalhes ? `\n— Detalhes importantes —\n${handoff.detalhes}` : '',
    handoff?.observacoes ? `\n— Observações —\n${handoff.observacoes}` : '',
  ].filter(Boolean).join('\n')

  // 1) Cria o cliente
  const cliente: Cliente = {
    id: uuid(),
    nome: String(dados.nome).trim(),
    instagram: dados.instagram || negocio.instagram || '',
    corPrimaria: dados.corPrimaria || '#ffc00f',
    corSecundaria: dados.corSecundaria || '#111111',
    tipo: 'cliente',
    entregaveis: Array.isArray(dados.entregaveis) ? dados.entregaveis : [],
    postsMensais: Number(dados.postsMensais) || 0,
    ...(dados.contratoValor !== undefined ? { contratoValor: Number(dados.contratoValor) || 0 } : (negocio.valor ? { contratoValor: Number(negocio.valor) } : {})),
    handoffVendas,
    criadoEm: agora,
  }

  let senhaPlana = ''
  if (dados.loginEmail) {
    const jaExiste = await redis.get(`usuario:${dados.loginEmail}`)
    if (jaExiste) return NextResponse.json({ error: 'Já existe um usuário com este e-mail de login' }, { status: 400 })
    senhaPlana = gerarSenha()
    const usuarioCliente: Usuario = {
      id: uuid(), nome: cliente.nome, email: dados.loginEmail, senha: await bcrypt.hash(senhaPlana, 10),
      role: 'cliente', clienteId: cliente.id, criadoEm: agora,
    }
    await redis.set(`usuario:${dados.loginEmail}`, usuarioCliente)
    await redis.sadd('usuarios', dados.loginEmail)
    cliente.loginEmail = dados.loginEmail
    cliente.loginSenha = senhaPlana
  }

  await redis.set(`cliente:${cliente.id}`, cliente)
  await redis.sadd('clientes', cliente.id)
  revalidateTag('clientes')
  if (cliente.loginEmail) revalidateTag('usuarios')

  // 2) Aplica o modelo de entregas (marcos + tarefas no Playbook), se escolhido
  let marcosCriados = 0, tarefasCriadas = 0
  if (templateId) {
    const t = await redis.get<TemplateProjeto>(`template:${templateId}`)
    if (t) {
      let cursor = dataInicio ? new Date(dataInicio) : new Date()
      const marcoIds: string[] = []
      for (const m of (t.marcos || [])) {
        const ini = new Date(cursor)
        const dur = Math.max(0, Number(m.diasDuracao) || 0)
        const fim = new Date(ini.getTime() + dur * 24 * 60 * 60 * 1000)
        const marco: Marco = {
          id: uuid(), clienteId: cliente.id, clienteNome: cliente.nome,
          titulo: m.titulo, descricao: m.descricao || '', categoria: (m.categoria as any) || 'outro',
          status: 'planejado', dataInicio: ini.toISOString(), dataFim: dur > 0 ? fim.toISOString() : '',
          responsavelNome: '', criadoPor: autor, criadoEm: agora, atualizadoEm: agora,
        }
        await redis.set(`marco:${marco.id}`, marco)
        await redis.sadd('marcos', marco.id)
        marcoIds.push(marco.id)
        if (dur > 0) cursor = fim
      }
      marcosCriados = marcoIds.length
      for (const tr of (t.tarefas || [])) {
        const marcoId = (typeof tr.marcoIndice === 'number' && marcoIds[tr.marcoIndice]) ? marcoIds[tr.marcoIndice] : undefined
        const tarefa: Tarefa = {
          id: uuid(), titulo: tr.titulo, descricao: '', tipo: (tr.tipo as any) || 'tarefa',
          status: 'a_fazer', prioridade: (tr.prioridade as any) || 'media',
          clienteId: cliente.id, clienteNome: cliente.nome, ...(marcoId ? { marcoId } : {}),
          criadoPor: autor, criadoEm: agora, atualizadoEm: agora,
          atividades: [{ id: uuid(), tipo: 'criacao', descricao: `Criada na conversão do CRM (modelo "${t.nome}")`, autor, criadoEm: agora }],
          comentarios: [],
        }
        await redis.set(`tarefa:${tarefa.id}`, tarefa)
        await redis.sadd('tarefas', tarefa.id)
        tarefasCriadas++
      }
    }
  }

  // 3) Marca o negócio como ganho e vincula o cliente
  const ganhoEstagio = (await redis.get<any[]>('crm:estagios') || []).find((e: any) => e.ganho)
  const negAtualizado: CrmNegocio = {
    ...negocio,
    status: 'ganho',
    clienteId: cliente.id,
    templateId: templateId || negocio.templateId,
    handoff: handoff || negocio.handoff,
    ...(ganhoEstagio ? { estagioId: ganhoEstagio.id } : {}),
    atividades: [...(negocio.atividades || []), { id: uuid(), tipo: 'ganho' as const, texto: `Convertido em cliente "${cliente.nome}"${templateId ? ` + modelo de entregas aplicado (${marcosCriados} marcos, ${tarefasCriadas} tarefas)` : ''}`, autor, criadoEm: agora }],
    atualizadoEm: agora,
  }
  await redis.set(`negocio:${negocioId}`, negAtualizado)

  // 4) Avisa a equipe (gestores) com a "ficha" do cliente para completar o Playbook de entregas
  const resumoNotif = `Venda fechada por ${negocio.donoNome || autor}.${negocio.valor ? ` Valor: ${Number(negocio.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.` : ''}${templateId ? ` ${marcosCriados} etapas e ${tarefasCriadas} tarefas aplicadas.` : ''}\n\n${handoffVendas}`.slice(0, 900)
  await notificarEquipe('geral', `Novo cliente: ${cliente.nome} — passagem de bastão`, resumoNotif).catch(() => {})

  // Motor de automações: negócio ganho + cliente novo
  const { dispararEvento } = await import('@/lib/automacoesEngine')
  const ctxAuto = { clienteId: cliente.id, clienteNome: cliente.nome, valor: Number(negocio.valor) || 0, segmento: negocio.segmento || '', donoNome: negocio.donoNome || '', donoEmail: negocio.dono || '' }
  await dispararEvento('negocio_ganho', ctxAuto)
  await dispararEvento('cliente_novo', { clienteId: cliente.id, clienteNome: cliente.nome, segmento: negocio.segmento || '', contratoValor: Number((cliente as any).contratoValor) || 0 })

  return NextResponse.json({ ok: true, clienteId: cliente.id, marcos: marcosCriados, tarefas: tarefasCriadas, loginSenha: senhaPlana || undefined })
}
