'use client'
import { useEffect, useMemo, useState } from 'react'
import AvatarCliente from './AvatarCliente'
import { fecharFora } from '@/lib/fecharModal'
import { atrasada, emRisco, diasDeAtraso } from '@/lib/entregas'
import { valorDaReserva as calcularValorReserva } from '@/lib/pacoteViagem'
import { saldoDevedor } from '@/lib/financeiroReserva'
import { LayoutVeiculo, capacidadeLayout } from '@/lib/layoutVeiculo'
import { pedirConversaWhatsApp, pedirFichaContato } from '@/lib/conversaInterna'

type Cliente = { id: string; nome: string; logo?: string; corPrimaria?: string; corSecundaria?: string; tipo?: string; entregaveis?: string[]; postsMensais?: number }
type Post = { id: string; clienteId: string; clienteNome: string; status: string; dataAgendada?: string; criadoEm: string; atualizadoEm?: string; etapa?: string; erroPublicacao?: string; imagens: string[] }
type Marco = { id: string; clienteId: string; clienteNome?: string; titulo: string; categoria?: string; status: string; dataInicio?: string; dataFim?: string }
type Tarefa = { id: string; titulo: string; status: string; prazo?: string; responsavelNome?: string; clienteNome?: string }

const META_MIN = 12
const META_BOA = 15
const META_EXC = 18

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function faixaStatus(qtd: number): { label: string; cor: string; bg: string } {
  if (qtd >= META_EXC) return { label: 'Destaque', cor: 'var(--v2-amber)', bg: 'var(--v2-amber-bg)' }
  if (qtd >= META_BOA) return { label: 'Excelente', cor: 'var(--v2-ok)', bg: 'var(--v2-ok-bg)' }
  if (qtd >= META_MIN) return { label: 'Saudável', cor: 'var(--v2-ok)', bg: 'var(--v2-ok-bg)' }
  if (qtd >= 8) return { label: 'Atenção', cor: 'var(--v2-amber)', bg: 'var(--v2-amber-bg)' }
  return { label: 'Crítico', cor: 'var(--v2-hot)', bg: 'var(--v2-hot-bg)' }
}

function barPct(qtd: number): number { return Math.min(100, Math.round((qtd / META_EXC) * 100)) }
function barCor(qtd: number): string {
  if (qtd >= META_EXC) return 'var(--v2-amber-on)'
  if (qtd >= META_BOA) return 'var(--v2-ok)'
  if (qtd >= META_MIN) return 'var(--v2-ok)'
  if (qtd >= 8) return 'var(--v2-amber-on)'
  return 'var(--v2-hot)'
}

function temSocialMedia(c: Cliente): boolean {
  return (c.entregaveis || []).includes('social_media')
}

type AgLite = { id: string; pacienteNome: string; pacienteTelefone?: string; dataInicio: string; status: string; servico?: string; profissionalNome: string }
type ContatoLite = { id: string; nome: string; telefone?: string; tipo?: string; nascimento?: string; ativo?: boolean }
type ViagemLite = { id: string; titulo: string; dataIda: string; dataVolta?: string; veiculoId?: string; valorPacote: number; descontoPadrao?: number; status: string }
type ReservaLite = { id: string; viagemId: string; passageiros: { poltrona?: string; faixa?: 'adulto' | 'crianca' | 'meia' }[]; desconto?: number; status: string; financeiro?: any; criadoEm: string }
type VeiculoLite = { id: string; nome?: string; layout?: LayoutVeiculo }

// Ícone WhatsApp (SVG — sem emoji, regra do produto)
const IconWhats = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="var(--v2-ok)"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.4-.7-2.9-1.2-4.7-4.1-4.9-4.3-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4l.9 2.1c0 .2.1.4 0 .6l-.4.6-.5.5c-.2.2-.3.3-.1.6.2.3.8 1.4 1.8 2.2 1.2 1.1 2.3 1.4 2.6 1.6.3.1.5.1.7-.1l1-1.2c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.6.3 0 .2 0 .8-.2 1.4Z"/></svg>
)

export default function DashboardHome({ clientes, posts, onVerCliente, onIr, perfilClinica = false, perfilTurismo = false, perfilTelefonia = false, lojaAtiva = '' }: {
  clientes: Cliente[]
  posts: Post[]
  onVerCliente: (id: string) => void
  onIr?: (aba: string) => void
  perfilClinica?: boolean
  perfilTurismo?: boolean
  perfilTelefonia?: boolean
  lojaAtiva?: string
}) {
  const agora = new Date()
  const mesAtual = agora.getMonth()
  const anoAtual = agora.getFullYear()
  const [alertasAberto, setAlertasAberto] = useState(true)

  // Playbook (marcos) e Tarefas — buscados aqui (o Painel é client, ssr:false).
  const [marcos, setMarcos] = useState<Marco[]>([])
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  useEffect(() => {
    if (!perfilClinica) fetch('/api/playbook').then(r => r.json()).then(d => { if (Array.isArray(d)) setMarcos(d) }).catch(() => {})
    fetch('/api/tarefas').then(r => r.json()).then(d => { if (Array.isArray(d)) setTarefas(d) }).catch(() => {})
  }, [perfilClinica])

  // Home clínica: agenda das próximas 24h + aniversariantes do mês
  const [ags24, setAgs24] = useState<AgLite[]>([])
  const [contatos, setContatos] = useState<ContatoLite[]>([])
  useEffect(() => {
    if (!perfilClinica) return
    const de = new Date(); const ate = new Date(de.getTime() + 24 * 3600 * 1000)
    fetch(`/api/agenda?de=${de.toISOString()}&ate=${ate.toISOString()}`).then(r => r.json())
      .then(d => { if (Array.isArray(d?.agendamentos)) setAgs24(d.agendamentos) }).catch(() => {})
    fetch('/api/crm/contatos').then(r => r.json()).then(d => { if (Array.isArray(d)) setContatos(d) }).catch(() => {})
  }, [perfilClinica])

  const emDias = (iso?: string) => iso ? (new Date(iso).getTime() - agora.getTime()) / 86400000 : Infinity
  const dataCurta = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` }

  // Ações da semana: tarefas e marcos vencendo em até 7 dias (inclui atrasados) + posts no cliente.
  const tarefasSemana = useMemo(() => tarefas
    .filter(t => t.status !== 'concluido' && t.prazo && emDias(t.prazo) <= 7)
    .sort((a, b) => new Date(a.prazo!).getTime() - new Date(b.prazo!).getTime())
    .slice(0, 8), [tarefas])
  const marcosSemana = useMemo(() => marcos
    .filter(m => m.status !== 'concluido' && m.status !== 'cancelado' && m.dataFim && emDias(m.dataFim) <= 7)
    .sort((a, b) => new Date(a.dataFim!).getTime() - new Date(b.dataFim!).getTime())
    .slice(0, 6), [marcos])
  const postsNoCliente = useMemo(() => posts.filter(p => p.status === 'aguardando_aprovacao'), [posts])
  // Entregas: posts com data vencida sem entrega + posts vencendo em ≤2 dias parados.
  const entregasAtrasadas = useMemo(() => posts.filter(p => atrasada(p))
    .sort((a, b) => new Date(a.dataAgendada!).getTime() - new Date(b.dataAgendada!).getTime()).slice(0, 8), [posts])
  const entregasEmRisco = useMemo(() => posts.filter(p => !atrasada(p) && emRisco(p))
    .sort((a, b) => new Date(a.dataAgendada!).getTime() - new Date(b.dataAgendada!).getTime()).slice(0, 6), [posts])
  const temSemana = tarefasSemana.length > 0 || marcosSemana.length > 0 || postsNoCliente.length > 0 || entregasAtrasadas.length > 0 || entregasEmRisco.length > 0

  // Andamento do Playbook: progresso geral dos marcos ativos.
  const pbTotal = useMemo(() => marcos.filter(m => m.status !== 'cancelado').length, [marcos])
  const pbConcluidos = useMemo(() => marcos.filter(m => m.status === 'concluido').length, [marcos])
  const pbAtrasados = useMemo(() => marcos.filter(m => (m.status === 'atrasado') || (m.status !== 'concluido' && m.status !== 'cancelado' && m.dataFim && emDias(m.dataFim) < 0)).length, [marcos])
  const pbAndamento = useMemo(() => marcos.filter(m => m.status === 'em_andamento').slice(0, 5), [marcos])
  const pbPct = pbTotal ? Math.round((pbConcluidos / pbTotal) * 100) : 0

  // Atalhos rápidos para as abas principais.
  const atalhos: { aba: string; label: string }[] = [
    { aba: 'studio', label: 'Studio' }, { aba: 'tarefas', label: 'Tarefas' }, { aba: 'playbook', label: 'Playbook' },
    { aba: 'planner', label: 'Planner' }, { aba: 'crm', label: 'CRM' }, { aba: 'conversao', label: 'Conversão & Retenção' },
  ]

  // Apenas clientes externos com social media
  const clientesSM = useMemo(() => clientes.filter(c => c.tipo !== 'interno' && temSocialMedia(c)), [clientes])

  const postsMes = useMemo(() => posts.filter(p => {
    // Meta = trabalho FEITO no mês (pedido do dono, 20/08): publicadas E
    // programadas. Programada = criativo pronto com data marcada — inclui a
    // fila de publicação, o que aguarda o cliente aprovar (etapa
    // aprovacao_criativo: a arte existe) e a falha técnica de publicação.
    // Fora da régua: copy em aprovação (sem arte) e o que voltou p/ ajuste.
    if (p.etapa && p.etapa !== 'pronto' && p.etapa !== 'aprovacao_criativo') return false
    const ehDoMes = (iso: string | undefined) => {
      if (!iso) return false
      const d = new Date(iso)
      return d.getMonth() === mesAtual && d.getFullYear() === anoAtual
    }
    if (p.status === 'publicado') return ehDoMes(p.atualizadoEm || p.criadoEm)
    if (['agendado', 'publicando', 'falha_publicacao', 'aguardando_aprovacao'].includes(p.status)) return ehDoMes(p.dataAgendada)
    return false
  }), [posts, mesAtual, anoAtual])

  const contagemPorCliente = useMemo(() => {
    const mapa: Record<string, number> = {}
    for (const c of clientesSM) mapa[c.id] = 0
    for (const p of postsMes) { if (mapa[p.clienteId] !== undefined) mapa[p.clienteId]++ }
    return mapa
  }, [clientesSM, postsMes])

  const pautasEsteira = posts.filter(p => p.etapa && p.etapa !== 'pronto').length
  const falhasPendentes = posts.filter(p => p.status === 'falha_publicacao').length
  const clientesSemBrandLista = clientes.filter(c => c.tipo !== 'interno' && !(c as any).segmento && !(c as any).palavrasChave && !(c as any).descricao && !(c as any).documentoMarca)
  const clientesSemBrand = clientesSemBrandLista.length
  const clientesSemEntregaveis = clientes.filter(c => c.tipo !== 'interno' && !(c.entregaveis || []).length).length

  const clientesOrdenados = useMemo(() =>
    [...clientesSM].sort((a, b) => (contagemPorCliente[a.id] || 0) - (contagemPorCliente[b.id] || 0))
  , [clientesSM, contagemPorCliente])

  // ---- Home clínica (perfilClinica): agenda, confirmações, pacientes, aniversariantes ----
  const ehHoje = (iso: string) => { const d = new Date(iso); return d.toDateString() === agora.toDateString() }
  const agsHoje = useMemo(() => ags24.filter(a => ehHoje(a.dataInicio) && a.status !== 'cancelado'), [ags24])
  const aguardandoConfirmacao = useMemo(() => agsHoje.filter(a => a.status === 'agendado'), [agsHoje])
  const pacientesAtivos = useMemo(() => contatos.filter(c => (!c.tipo || c.tipo === 'paciente') && c.ativo !== false), [contatos])
  const aniversariantes = useMemo(() => contatos
    .filter(c => c.ativo !== false && c.nascimento && Number(c.nascimento.slice(5, 7)) === mesAtual + 1)
    .sort((a, b) => Number(a.nascimento!.slice(8, 10)) - Number(b.nascimento!.slice(8, 10))), [contatos, mesAtual])
  // Parabenizar abre a conversa no inbox do CRM (aba Mensagens), não o wa.me:
  // o toque fica registrado e o time vê. Ver lib/conversaInterna.
  const abrirConversa = (tel?: string) => { if (pedirConversaWhatsApp(tel)) onIr?.('crm') }
  // Abrir a FICHA do paciente (dados + historico de atendimentos) no CRM. Mesma
  // ponte da conversa — quem desenha a ficha e o CRM. Ver lib/conversaInterna.
  const abrirFicha = (id: string) => { if (pedirFichaContato(id)) onIr?.('crm') }
  // Lista completa dos aniversariantes (o cartao da home mostra so os primeiros).
  const [anivAberto, setAnivAberto] = useState(false)
  const [buscaAniv, setBuscaAniv] = useState('')
  const anivFiltrados = useMemo(() => {
    const q = buscaAniv.trim().toLowerCase()
    if (!q) return aniversariantes
    const dig = q.replace(/\D/g, '')
    return aniversariantes.filter(c => c.nome.toLowerCase().includes(q) || (!!dig && (c.telefone || '').replace(/\D/g, '').includes(dig)))
  }, [aniversariantes, buscaAniv])

  // Risco de atraso: meta do mês (postsMensais) ainda não coberta por publicado+agendado
  const clientesEmRisco = useMemo(() => agora.getDate() < 5 ? [] : clientesSM.filter(c => {
    const meta = Number(c.postsMensais) || META_MIN
    return (contagemPorCliente[c.id] || 0) < meta && (contagemPorCliente[c.id] || 0) >= 8
  }), [clientesSM, contagemPorCliente])
  const temAlertas = falhasPendentes > 0 || clientesSemBrand > 0 || clientesSemEntregaveis > 0 || clientesEmRisco.length > 0 || clientesOrdenados.some(c => (contagemPorCliente[c.id] || 0) < 8)

  // ---- Home turismo (perfilTurismo): operação de viagens ----
  const [viagens, setViagens] = useState<ViagemLite[]>([])
  const [reservasT, setReservasT] = useState<ReservaLite[]>([])
  const [veiculosT, setVeiculosT] = useState<VeiculoLite[]>([])
  useEffect(() => {
    if (!perfilTurismo) return
    fetch('/api/viagens').then(r => r.json()).then(d => setViagens(Array.isArray(d) ? d : (d?.viagens || []))).catch(() => {})
    fetch('/api/reservas').then(r => r.json()).then(d => setReservasT(Array.isArray(d) ? d : (d?.reservas || []))).catch(() => {})
    fetch('/api/frota').then(r => r.json()).then(d => setVeiculosT(Array.isArray(d) ? d : (d?.veiculos || []))).catch(() => {})
  }, [perfilTurismo])

  const excById = useMemo(() => Object.fromEntries(viagens.map(e => [e.id, e])) as Record<string, ViagemLite>, [viagens])
  const capacidadeDe = (veiculoId?: string) => { const v = veiculosT.find(b => b.id === veiculoId); return v?.layout ? capacidadeLayout(v.layout) : 0 }
  const reservasAtivasT = useMemo(() => reservasT.filter(r => r.status !== 'cancelada'), [reservasT])
  const paxDaViagem = (excId: string) => reservasAtivasT.filter(r => r.viagemId === excId).reduce((s, r) => s + (r.passageiros?.length || 0), 0)
  const valorDaReserva = (r: ReservaLite) => calcularValorReserva(excById[r.viagemId] || {}, r.passageiros || [], r.desconto || 0)
  const hojeStr = agora.toISOString().slice(0, 10)
  const ehDoMesStr = (iso?: string) => { if (!iso) return false; const d = new Date(iso); return d.getMonth() === mesAtual && d.getFullYear() === anoAtual }
  const proximasSaidas = useMemo(() => viagens
    .filter(e => (e.status === 'aberta' || e.status === 'planejada') && e.dataIda && e.dataIda >= hojeStr)
    .sort((a, b) => a.dataIda.localeCompare(b.dataIda)), [viagens, hojeStr])
  const reservasDoMes = useMemo(() => reservasAtivasT.filter(r => ehDoMesStr(r.criadoEm)), [reservasAtivasT, mesAtual, anoAtual])
  const receitaMes = useMemo(() => reservasDoMes.reduce((s, r) => s + valorDaReserva(r), 0), [reservasDoMes, excById])
  const aReceber = useMemo(() => reservasAtivasT.reduce((s, r) => s + (r.financeiro ? saldoDevedor(r.financeiro) : valorDaReserva(r)), 0), [reservasAtivasT, excById])
  const ocupacaoMedia = useMemo(() => {
    const abertas = viagens.filter(e => e.status === 'aberta' || e.status === 'planejada')
    const ocs = abertas.map(e => { const cap = capacidadeDe(e.veiculoId); return cap ? paxDaViagem(e.id) / cap : null }).filter((x): x is number => x !== null)
    return ocs.length ? Math.round((ocs.reduce((s, x) => s + x, 0) / ocs.length) * 100) : 0
  }, [viagens, reservasAtivasT, veiculosT])
  const saidasBaixaOcup = useMemo(() => proximasSaidas.filter(e => { const cap = capacidadeDe(e.veiculoId); return cap && emDias(e.dataIda) <= 21 && paxDaViagem(e.id) / cap < 0.5 }), [proximasSaidas, reservasAtivasT, veiculosT])
  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  // ---- Home telefonia (varejo): vendas do dia, ticket, estoque baixo, top produtos ----
  const [vendasTel, setVendasTel] = useState<any[]>([])
  const [produtosTel, setProdutosTel] = useState<any[]>([])
  const [saldoTel, setSaldoTel] = useState<Record<string, number>>({})
  useEffect(() => {
    if (!perfilTelefonia) return
    fetch(`/api/vendas?lojaId=${encodeURIComponent(lojaAtiva)}`).then(r => r.json()).then(d => setVendasTel(Array.isArray(d?.vendas) ? d.vendas : [])).catch(() => {})
    fetch(`/api/produtos?lojaId=${encodeURIComponent(lojaAtiva)}`).then(r => r.json()).then(d => setProdutosTel(Array.isArray(d?.produtos) ? d.produtos : [])).catch(() => {})
    fetch(`/api/estoque?lojaId=${encodeURIComponent(lojaAtiva)}`).then(r => r.json()).then(d => {
      if (d?.saldos) setSaldoTel(d.saldos)
      else if (d?.porLoja) { const acc: Record<string, number> = {}; for (const loja of Object.values(d.porLoja) as Record<string, number>[]) for (const [pid, q] of Object.entries(loja)) acc[pid] = (acc[pid] || 0) + q; setSaldoTel(acc) }
      else setSaldoTel({})
    }).catch(() => {})
  }, [perfilTelefonia, lojaAtiva])
  const vendasHojeTel = useMemo(() => vendasTel.filter(v => !v.cancelada && (v.data || '').slice(0, 10) === hojeStr), [vendasTel, hojeStr])
  const totalHojeTel = vendasHojeTel.reduce((s, v) => s + (Number(v.total) || 0), 0)
  const ticketTel = vendasHojeTel.length ? totalHojeTel / vendasHojeTel.length : 0
  const vendasMesTel = useMemo(() => vendasTel.filter(v => !v.cancelada && ehDoMesStr(v.data)), [vendasTel, mesAtual, anoAtual])
  const receitaMesTel = vendasMesTel.reduce((s, v) => s + (Number(v.total) || 0), 0)
  const baixoEstoqueTel = useMemo(() => produtosTel.filter(p => (p.estoqueMinimo || 0) > 0 && (saldoTel[p.id] || 0) < p.estoqueMinimo), [produtosTel, saldoTel])
  const topProdutosTel = useMemo(() => {
    const m: Record<string, { nome: string; qtd: number }> = {}
    for (const v of vendasMesTel) for (const it of (v.itens || [])) { m[it.produtoId] = m[it.produtoId] || { nome: it.nome, qtd: 0 }; m[it.produtoId].qtd += it.quantidade }
    return Object.values(m).sort((a, b) => b.qtd - a.qtd).slice(0, 5)
  }, [vendasMesTel])

  if (perfilTelefonia) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--v2-ink)' }}>Painel — Varejo</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--v2-ink3)', fontSize: 14 }}>{lojaAtiva ? 'Loja selecionada' : 'Todas as lojas (rede)'} · {MESES[mesAtual]} de {anoAtual}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {[
            { label: 'Vendas hoje', valor: String(vendasHojeTel.length), cor: 'var(--v2-ink)' },
            { label: 'Faturamento hoje', valor: brl(totalHojeTel), cor: 'var(--v2-ok)' },
            { label: 'Ticket médio (hoje)', valor: brl(ticketTel), cor: 'var(--v2-ink)' },
            { label: 'Estoque baixo', valor: String(baixoEstoqueTel.length), cor: baixoEstoqueTel.length ? 'var(--v2-hot)' : 'var(--v2-ok)' },
          ].map(k => (
            <div key={k.label} style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--v2-ink3)', fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: k.cor, marginTop: 4 }}>{k.valor}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13, color: 'var(--v2-ink3)' }}>Faturamento no mês: <strong style={{ color: 'var(--v2-ink)' }}>{brl(receitaMesTel)}</strong> · {vendasMesTel.length} venda(s)</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--v2-ink)' }}>Mais vendidos no mês</h2>
              {onIr && <button onClick={() => onIr('vendas')} style={{ background: 'none', border: 'none', color: 'var(--v2-info)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Ir ao PDV</button>}
            </div>
            {topProdutosTel.length === 0 ? <p style={{ color: 'var(--v2-ink3)', fontSize: 13, margin: 0 }}>Nenhuma venda no mês ainda.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {topProdutosTel.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 20, fontSize: 13, fontWeight: 800, color: 'var(--v2-ink3)' }}>{i + 1}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--v2-ink2)' }}>{p.qtd} un.</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: baixoEstoqueTel.length ? 'var(--v2-amber-bg)' : 'var(--v2-surface)', border: `1px solid ${baixoEstoqueTel.length ? 'var(--v2-amber-bg)' : 'var(--v2-surface2)'}`, borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: baixoEstoqueTel.length ? 'var(--v2-amber)' : 'var(--v2-ink)' }}>Estoque baixo</h2>
              {onIr && <button onClick={() => onIr('produtos')} style={{ background: 'none', border: 'none', color: 'var(--v2-info)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Ver estoque</button>}
            </div>
            {baixoEstoqueTel.length === 0 ? <p style={{ color: 'var(--v2-ink3)', fontSize: 13, margin: 0 }}>Tudo acima do mínimo.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {baixoEstoqueTel.slice(0, 6).map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#7c2d12' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</span>
                    <strong style={{ whiteSpace: 'nowrap', marginLeft: 8 }}>{saldoTel[p.id] || 0} / mín {p.estoqueMinimo}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {([['vendas', 'PDV / Vendas'], ['produtos', 'Produtos'], ['crm', 'CRM'], ['rentabilidade', 'Financeiro']] as const).map(([aba, label]) => (
            onIr ? <button key={aba} onClick={() => onIr(aba)} style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, color: 'var(--v2-ink)', cursor: 'pointer' }}>{label}</button> : null
          ))}
        </div>
      </div>
    )
  }

  if (perfilTurismo) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--v2-ink)' }}>Painel — Operação</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--v2-ink3)', fontSize: 14 }}>{MESES[mesAtual]} de {anoAtual}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {[
            { label: 'Próximas saídas', valor: String(proximasSaidas.length), cor: 'var(--v2-ink)' },
            { label: 'Reservas no mês', valor: String(reservasDoMes.length), cor: 'var(--v2-ink)' },
            { label: 'Ocupação média', valor: `${ocupacaoMedia}%`, cor: ocupacaoMedia >= 60 ? 'var(--v2-ok)' : ocupacaoMedia >= 35 ? 'var(--v2-amber)' : 'var(--v2-hot)' },
            { label: 'A receber', valor: brl(aReceber), cor: 'var(--v2-ok)' },
          ].map(k => (
            <div key={k.label} style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--v2-ink3)', fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: k.cor, marginTop: 4 }}>{k.valor}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13, color: 'var(--v2-ink3)' }}>Receita reservada no mês: <strong style={{ color: 'var(--v2-ink)' }}>{brl(receitaMes)}</strong></div>

        <div style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 14, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--v2-ink)' }}>Próximas saídas</h2>
            {onIr && <button onClick={() => onIr('viagens')} style={{ background: 'none', border: 'none', color: 'var(--v2-info)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Ver viagens</button>}
          </div>
          {proximasSaidas.length === 0 ? (
            <p style={{ color: 'var(--v2-ink3)', fontSize: 13, margin: 0 }}>Nenhuma saída futura programada.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {proximasSaidas.slice(0, 6).map(e => {
                const cap = capacidadeDe(e.veiculoId); const pax = paxDaViagem(e.id); const pct = cap ? Math.round(pax / cap * 100) : 0
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ minWidth: 52, textAlign: 'center', background: 'var(--v2-surface1)', borderRadius: 8, padding: '6px 4px' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--v2-ink)' }}>{dataCurta(e.dataIda)}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--v2-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.titulo}</div>
                      <div style={{ height: 6, background: 'var(--v2-surface2)', borderRadius: 4, marginTop: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 60 ? 'var(--v2-ok)' : pct >= 35 ? 'var(--v2-amber-on)' : 'var(--v2-hot)' }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--v2-ink2)', minWidth: 78, textAlign: 'right' }}>{cap ? `${pax}/${cap}` : `${pax} pax`} · {pct}%</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {saidasBaixaOcup.length > 0 && (
          <div style={{ background: 'var(--v2-amber-bg)', border: '1px solid var(--v2-amber-bg)', borderRadius: 14, padding: 16 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 800, color: 'var(--v2-amber)' }}>Baixa ocupação — saídas em até 21 dias</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {saidasBaixaOcup.slice(0, 6).map(e => {
                const cap = capacidadeDe(e.veiculoId); const pax = paxDaViagem(e.id)
                return <div key={e.id} style={{ fontSize: 13, color: '#7c2d12' }}>{dataCurta(e.dataIda)} · <strong>{e.titulo}</strong> — {pax}/{cap} poltronas</div>
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {([['viagens', 'Viagens'], ['reservas', 'Reservas'], ['frota', 'Frota'], ['crm', 'CRM'], ['rentabilidade', 'Financeiro']] as const).map(([aba, label]) => (
            onIr ? <button key={aba} onClick={() => onIr(aba)} style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, color: 'var(--v2-ink)', cursor: 'pointer' }}>{label}</button> : null
          ))}
        </div>
      </div>
    )
  }

  if (perfilClinica) {
    return (
      <div>
        <h2 style={{ margin: '0 0 16px', fontSize: 20, color: 'var(--v2-ink)' }}>Painel — {MESES[mesAtual]} {anoAtual}</h2>

        {/* Atalhos */}
        {onIr && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {[{ aba: 'agenda', label: 'Agenda' }, { aba: 'crm', label: 'CRM' }, { aba: 'tarefas', label: 'Tarefas' }].map(a => (
              <button key={a.aba} onClick={() => onIr(a.aba)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--v2-surface)', color: 'var(--v2-ink)', border: '1px solid var(--v2-rule)', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                {a.label}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--v2-ink3)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M9 7h8v8" /></svg>
              </button>
            ))}
          </div>
        )}

        {/* KPIs da clínica */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
          {([
            { label: 'Atendimentos hoje', valor: agsHoje.length, cor: 'var(--v2-ink)' },
            { label: 'Aguardando confirmação', valor: aguardandoConfirmacao.length, cor: aguardandoConfirmacao.length > 0 ? 'var(--v2-amber)' : 'var(--v2-ok)' },
            { label: 'Pacientes ativos', valor: pacientesAtivos.length, cor: 'var(--v2-info)' },
            // Número que pede ação: abre a lista inteira do mês (o cartão ao lado
            // mostra só os primeiros), com ficha e WhatsApp de cada paciente.
            { label: 'Aniversariantes do mês', valor: aniversariantes.length, cor: '#7c3aed', acao: aniversariantes.length > 0 ? (() => setAnivAberto(true)) : undefined, dica: 'Ver todos os aniversariantes do mês' },
          ] as { label: string; valor: number; cor: string; acao?: () => void; dica?: string }[]).map(kpi => (
            <div key={kpi.label} onClick={kpi.acao} title={kpi.dica}
              role={kpi.acao ? 'button' : undefined} tabIndex={kpi.acao ? 0 : undefined}
              onKeyDown={kpi.acao ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); kpi.acao!() } }) : undefined}
              style={{ background: 'var(--v2-surface)', borderRadius: 14, padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: kpi.acao ? 'pointer' : 'default' }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)' }}>{kpi.label}</p>
              <p style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 800, color: kpi.cor }}>{kpi.valor}</p>
              {kpi.acao && <p style={{ margin: '2px 0 0', fontSize: 11.5, fontWeight: 700, color: 'var(--v2-info)' }}>Ver lista</p>}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, marginBottom: 20 }}>
          {/* Próximas 24h */}
          <div style={{ background: 'var(--v2-surface)', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, color: 'var(--v2-ink)' }}>Agendamentos das próximas 24h</h3>
              {onIr && <button onClick={() => onIr('agenda')} style={{ background: 'none', border: 'none', color: 'var(--v2-info)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Abrir agenda</button>}
            </div>
            {ags24.filter(a => a.status !== 'cancelado').length === 0 && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink3)' }}>Nenhum agendamento nas próximas 24 horas.</p>}
            {ags24.filter(a => a.status !== 'cancelado').slice(0, 10).map(a => (
              <div key={a.id} onClick={() => onIr?.('agenda')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: '1px solid var(--v2-surface1)', cursor: onIr ? 'pointer' : 'default' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--v2-ink)', flexShrink: 0 }}>{ehHoje(a.dataInicio) ? '' : 'amanhã '}{new Date(a.dataInicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                <span style={{ flex: 1, fontSize: 12.5, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.pacienteNome}{a.servico ? ` · ${a.servico}` : ''}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: a.status === 'confirmado' ? 'var(--v2-ok)' : 'var(--v2-amber)', flexShrink: 0 }}>{a.status === 'confirmado' ? 'Confirmado' : 'Aguardando'}</span>
              </div>
            ))}
          </div>

          {/* Aniversariantes do mês */}
          <div style={{ background: 'var(--v2-surface)', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, color: 'var(--v2-ink)' }}>Aniversariantes de {MESES[mesAtual]}</h3>
              {aniversariantes.length > 0 && <button onClick={() => setAnivAberto(true)} style={{ background: 'none', border: 'none', color: 'var(--v2-info)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Ver todos ({aniversariantes.length})</button>}
            </div>
            {aniversariantes.length === 0 && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink3)' }}>Nenhum aniversariante este mês (preencha o nascimento no cadastro do paciente).</p>}
            {aniversariantes.slice(0, 12).map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: '1px solid var(--v2-surface1)' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#7c3aed', flexShrink: 0 }}>{c.nascimento!.slice(8, 10)}/{c.nascimento!.slice(5, 7)}</span>
                <button onClick={() => abrirFicha(c.id)} title="Abrir a ficha do paciente (dados e histórico)"
                  style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: 0, fontSize: 12.5, color: 'var(--v2-ink)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</button>
                {c.telefone && (
                  <button onClick={() => abrirConversa(c.telefone)} title="Abrir a conversa no WhatsApp (Mensagens do CRM)"
                    style={{ display: 'inline-flex', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}><IconWhats /></button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tarefas da semana */}
        <div style={{ background: 'var(--v2-surface)', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 15, color: 'var(--v2-ink)' }}>Tarefas da semana</h3>
          {tarefasSemana.length === 0 && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink3)' }}>Nada vencendo nos próximos 7 dias.</p>}
          {tarefasSemana.map(t => { const atras = emDias(t.prazo) < 0; return (
            <div key={t.id} onClick={() => onIr?.('tarefas')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: '1px solid var(--v2-surface1)', cursor: onIr ? 'pointer' : 'default' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: atras ? 'var(--v2-hot)' : 'var(--v2-amber-on)', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12.5, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titulo}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: atras ? 'var(--v2-hot)' : 'var(--v2-amber)', flexShrink: 0 }}>{atras ? 'atrasada' : dataCurta(t.prazo)}</span>
            </div>
          ) })}
        </div>

        {/* Aniversariantes do mês — a lista INTEIRA (o cartão da home corta em 12).
            Cada linha leva aos dois lugares onde o time faz alguma coisa com o
            aniversário: a ficha do paciente (dados + histórico de atendimentos) e
            a conversa de WhatsApp no CRM. */}
        {anivAberto && (
          <div onClick={fecharFora(() => setAnivAberto(false), { perguntar: false })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
            <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: 'var(--v2-surface)', borderRadius: 16, maxWidth: 560, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: 'var(--v2-ink)' }}>Aniversariantes de {MESES[mesAtual]}</h3>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#7c3aed' }}>{aniversariantes.length}</span>
                <span style={{ flex: 1 }} />
                <button onClick={() => setAnivAberto(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--v2-ink3)', lineHeight: 1 }}>×</button>
              </div>
              <p style={{ margin: '4px 0 12px', fontSize: 12.5, color: 'var(--v2-ink3)' }}>Clique no nome para abrir a ficha do paciente (dados e histórico de atendimentos). O ícone verde abre a conversa no WhatsApp.</p>
              <input value={buscaAniv} onChange={e => setBuscaAniv(e.target.value)} placeholder="Buscar por nome ou telefone"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--v2-rule)', borderRadius: 10, fontSize: 13, outline: 'none' }} />
              <div style={{ overflowY: 'auto', marginTop: 6 }}>
                {anivFiltrados.length === 0 && <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--v2-ink3)' }}>Nenhum aniversariante com esse nome ou telefone.</p>}
                {anivFiltrados.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: '1px solid var(--v2-surface1)' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#7c3aed', flexShrink: 0, minWidth: 38 }}>{c.nascimento!.slice(8, 10)}/{c.nascimento!.slice(5, 7)}</span>
                    <button onClick={() => abrirFicha(c.id)} title="Abrir a ficha do paciente (dados e histórico)"
                      style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--v2-ink3)' }}>{c.telefone || 'sem telefone'}{c.tipo && c.tipo !== 'paciente' ? ` · ${c.tipo}` : ''}{c.ativo === false ? ' · inativo' : ''}</span>
                    </button>
                    {c.telefone && (
                      <button onClick={() => abrirConversa(c.telefone)} title="Abrir a conversa no WhatsApp (Mensagens do CRM)"
                        style={{ display: 'inline-flex', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}><IconWhats /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', fontSize: 20, color: 'var(--v2-ink)' }}>Painel — {MESES[mesAtual]} {anoAtual}</h2>

      {/* Atalhos rápidos */}
      {onIr && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {atalhos.map(a => (
            <button key={a.aba} onClick={() => onIr(a.aba)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--v2-surface)', color: 'var(--v2-ink)', border: '1px solid var(--v2-rule)', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              {a.label}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--v2-ink3)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M9 7h8v8" /></svg>
            </button>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Clientes ativos', valor: clientes.filter(c => c.tipo !== 'interno').length, cor: 'var(--v2-ink)' },
          { label: 'Posts no mês', valor: postsMes.length, cor: 'var(--v2-ok)' },
          { label: 'Pautas na esteira', valor: pautasEsteira, cor: 'var(--v2-info)' },
          { label: 'Falhas pendentes', valor: falhasPendentes, cor: falhasPendentes > 0 ? 'var(--v2-hot)' : 'var(--v2-ok)' },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: 'var(--v2-surface)', borderRadius: 14, padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)' }}>{kpi.label}</p>
            <p style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 800, color: kpi.cor }}>{kpi.valor}</p>
          </div>
        ))}
      </div>

      {/* Ações da semana + Andamento do Playbook */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, marginBottom: 20 }}>
        {/* Ações da semana */}
        <div style={{ background: 'var(--v2-surface)', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 15, color: 'var(--v2-ink)' }}>Ações da semana</h3>
          {!temSemana && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink3)' }}>Nada vencendo nos próximos 7 dias. Tudo em dia.</p>}
          {entregasAtrasadas.length > 0 && (
            <button onClick={() => onIr?.('studio')} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 6, background: 'var(--v2-hot-bg)', border: '1px solid var(--v2-hot-bg)', borderRadius: 9, cursor: onIr ? 'pointer' : 'default' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--v2-hot)' }}>{entregasAtrasadas.length} entrega(s) ATRASADA(s) — data venceu sem post entregue</span>
            </button>
          )}
          {postsNoCliente.length > 0 && (
            <button onClick={() => onIr?.('planner')} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 6, background: 'var(--v2-amber-bg)', border: '1px solid var(--v2-amber-bg)', borderRadius: 9, cursor: onIr ? 'pointer' : 'default' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--v2-amber)' }}>{postsNoCliente.length} post(s) aguardando aprovação do cliente</span>
            </button>
          )}
          {entregasAtrasadas.map(p => (
            <div key={p.id} onClick={() => onIr?.('studio')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: '1px solid var(--v2-surface1)', cursor: onIr ? 'pointer' : 'default' }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--v2-hot)', background: 'var(--v2-hot-bg)', borderRadius: 4, padding: '2px 5px', flexShrink: 0 }}>ENTREGA</span>
              <span style={{ flex: 1, fontSize: 12.5, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.clienteNome} · post de {dataCurta(p.dataAgendada)}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--v2-hot)', flexShrink: 0 }}>{diasDeAtraso(p) === 0 ? 'venceu hoje' : `há ${diasDeAtraso(p)}d`}</span>
            </div>
          ))}
          {entregasEmRisco.map(p => (
            <div key={p.id} onClick={() => onIr?.('studio')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: '1px solid var(--v2-surface1)', cursor: onIr ? 'pointer' : 'default' }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--v2-amber)', background: 'var(--v2-amber-bg)', borderRadius: 4, padding: '2px 5px', flexShrink: 0 }}>ENTREGA</span>
              <span style={{ flex: 1, fontSize: 12.5, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.clienteNome} · vence {dataCurta(p.dataAgendada)} e ainda está &quot;{p.status === 'rascunho' ? 'rascunho' : 'em ajuste'}&quot;</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--v2-amber)', flexShrink: 0 }}>{dataCurta(p.dataAgendada)}</span>
            </div>
          ))}
          {tarefasSemana.map(t => { const atras = emDias(t.prazo) < 0; return (
            <div key={t.id} onClick={() => onIr?.('tarefas')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: '1px solid var(--v2-surface1)', cursor: onIr ? 'pointer' : 'default' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: atras ? 'var(--v2-hot)' : 'var(--v2-amber-on)', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12.5, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titulo}{t.clienteNome ? ` · ${t.clienteNome}` : ''}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: atras ? 'var(--v2-hot)' : 'var(--v2-amber)', flexShrink: 0 }}>{atras ? 'atrasada' : dataCurta(t.prazo)}</span>
            </div>
          ) })}
          {marcosSemana.map(m => { const atras = emDias(m.dataFim) < 0; return (
            <div key={m.id} onClick={() => onIr?.('playbook')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: '1px solid var(--v2-surface1)', cursor: onIr ? 'pointer' : 'default' }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#6d28d9', background: '#ede9fe', borderRadius: 4, padding: '2px 5px', flexShrink: 0 }}>MARCO</span>
              <span style={{ flex: 1, fontSize: 12.5, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.titulo}{m.clienteNome ? ` · ${m.clienteNome}` : ''}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: atras ? 'var(--v2-hot)' : 'var(--v2-amber)', flexShrink: 0 }}>{atras ? 'atrasado' : dataCurta(m.dataFim)}</span>
            </div>
          ) })}
        </div>

        {/* Andamento do Playbook */}
        <div style={{ background: 'var(--v2-surface)', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 15, color: 'var(--v2-ink)' }}>Andamento do Playbook</h3>
            {onIr && <button onClick={() => onIr('playbook')} style={{ background: 'none', border: 'none', color: 'var(--v2-info)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Abrir</button>}
          </div>
          {pbTotal === 0 && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink3)' }}>Nenhum marco cadastrado ainda.</p>}
          {pbTotal > 0 && <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--v2-ink)' }}>{pbPct}%</span>
              <span style={{ fontSize: 12, color: 'var(--v2-ink3)' }}>{pbConcluidos} de {pbTotal} marcos concluídos{pbAtrasados > 0 ? ` · ${pbAtrasados} atrasado(s)` : ''}</span>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: 'var(--v2-surface2)', overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ height: '100%', width: `${pbPct}%`, background: 'var(--v2-ok)', borderRadius: 999, transition: 'width .3s' }} />
            </div>
            {pbAndamento.length > 0 && <>
              <p style={{ margin: '0 0 6px', fontSize: 10.5, fontWeight: 800, color: 'var(--v2-ink3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Em andamento</p>
              {pbAndamento.map(m => (
                <div key={m.id} onClick={() => m.clienteId ? onVerCliente(m.clienteId) : onIr?.('playbook')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid var(--v2-surface1)', cursor: 'pointer' }}>
                  <span style={{ flex: 1, fontSize: 12.5, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.titulo}</span>
                  <span style={{ fontSize: 11, color: 'var(--v2-ink3)', flexShrink: 0 }}>{m.clienteNome || ''}</span>
                </div>
              ))}
            </>}
          </>}
        </div>
      </div>

      {/* Grafico de metas — TOPO */}
      {clientesOrdenados.length > 0 && (
        <div style={{ background: 'var(--v2-surface)', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 15, color: 'var(--v2-ink)' }}>Meta de postagens — {MESES[mesAtual]} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--v2-ink3)' }}>(publicadas + programadas)</span></h3>
            <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--v2-ink3)' }}>
              <span>Min: {META_MIN}</span><span>|</span><span>Bom: {META_BOA}</span><span>|</span><span>Exc: {META_EXC}+</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {clientesOrdenados.map(c => {
              const qtd = contagemPorCliente[c.id] || 0
              const fx = faixaStatus(qtd)
              return (
                <div key={c.id} onClick={() => onVerCliente(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', background: c.corPrimaria || '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10, color: c.corSecundaria || '#111', flexShrink: 0 }}>
                    <AvatarCliente logo={c.logo} nome={c.nome} clienteId={c.id} />
                  </div>
                  <span style={{ width: 110, fontSize: 12, fontWeight: 600, color: 'var(--v2-ink2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{c.nome}</span>
                  <div style={{ flex: 1, position: 'relative', height: 18, borderRadius: 999, background: 'var(--v2-surface2)', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${barPct(qtd)}%`, background: barCor(qtd), borderRadius: 999, transition: 'width .3s' }} />
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${(META_MIN / META_EXC) * 100}%`, width: 1.5, background: 'rgba(0,0,0,0.15)' }} />
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${(META_BOA / META_EXC) * 100}%`, width: 1.5, background: 'rgba(0,0,0,0.12)' }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: fx.cor, width: 28, textAlign: 'right', flexShrink: 0 }}>{qtd}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: fx.cor, background: fx.bg, borderRadius: 999, padding: '2px 8px', flexShrink: 0, minWidth: 60, textAlign: 'center' }}>{fx.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Alertas — colapsivel */}
      {temAlertas && (
        <div style={{ background: 'var(--v2-hot-bg)', border: '1px solid var(--v2-hot-bg)', borderRadius: 14, marginBottom: 20, overflow: 'hidden' }}>
          <button onClick={() => setAlertasAberto(v => !v)} style={{ width: '100%', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--v2-hot)' }}>Precisa de atenção</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v2-hot)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: alertasAberto ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {alertasAberto && (
            <div style={{ padding: '0 18px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {falhasPendentes > 0 && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-hot)' }}>{falhasPendentes} post(s) com falha de publicacao pendente.</p>}
              {clientesOrdenados.filter(c => (contagemPorCliente[c.id] || 0) < 8).map(c => (
                <p key={c.id} style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-hot)' }}><strong>{c.nome}</strong> esta em nivel critico ({contagemPorCliente[c.id] || 0} posts no mes).</p>
              ))}
              {clientesEmRisco.map(c => { const meta = Number(c.postsMensais) || META_MIN; return (
                <p key={'r' + c.id} style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-amber)' }}>⚠ <strong>{c.nome}</strong> abaixo da meta do mês: {contagemPorCliente[c.id] || 0} de {meta} (publicadas + programadas). Faltam {meta - (contagemPorCliente[c.id] || 0)} a planejar.</p>
              ) })}
              {clientesSemBrand > 0 && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-amber)' }}>{clientesSemBrand} cliente(s) sem Brand Board preenchido: {clientesSemBrandLista.map(c => c.nome).join(', ')}.</p>}
              {clientesSemEntregaveis > 0 && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-amber)' }}>{clientesSemEntregaveis} cliente(s) sem entregaveis definidos (configure em Clientes).</p>}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
