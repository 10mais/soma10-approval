'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'
import { frequenciaPaciente } from '@/lib/agenda'
import { fecharFora } from '@/lib/fecharModal'
import { consumirConversaWhatsApp } from '@/lib/conversaInterna'
import { telefoneWhatsApp, mesmoTelefone } from '@/lib/telefoneBR'
import { formatarCnpj, cnpjValido, soDigitosCnpj } from '@/lib/cnpj'
import BibliotecaVendasTela from './BibliotecaVendas'

type Estagio = { id: string; nome: string; ordem: number; ganho?: boolean; perdido?: boolean; pipelineId?: string }
type Empresa = { id: string; nome: string; segmento?: string; site?: string; instagram?: string; telefone?: string; observacoes?: string }
type Interacao = { id: string; tipo: string; texto: string; autor: string; data: string; criadoEm: string }
type ProximoPasso = { id: string; titulo: string; quando: string; nota?: string; feito?: boolean; tarefaId?: string }
type Contato = { id: string; nome: string; telefone?: string; email?: string; empresa?: string; empresaId?: string; cargo?: string; areaAtuacao?: string; profissionalAutonomo?: boolean; observacoes?: string; tipo?: string; nascimento?: string; preferenciasViagem?: string; etiquetas?: string[]; ativo?: boolean; historico?: Interacao[]; proximosPassos?: ProximoPasso[]; ultimoContato?: string; criadoEm?: string }
type Atividade = { id: string; tipo: string; texto: string; autor: string; criadoEm: string }
type Negocio = {
  id: string; titulo: string; valor?: number; estagioId: string; pipelineId?: string; status: string
  dono?: string; donoNome?: string; contatoId?: string; origem?: string; previsaoFechamento?: string; proximoFollowUp?: string
  descricao?: string; atividades?: Atividade[]; criadoEm: string; atualizadoEm: string
  empresa?: string; segmento?: string; faturamentoEstimado?: string; instagram?: string; dores?: string; solucoes?: string
  queixaPrincipal?: string
  destinoDesejado?: string; qtdPassageiros?: number; epocaDesejada?: string; preferencias?: string
  clienteId?: string; handoff?: { escopoVendido?: string; expectativas?: string; detalhes?: string; observacoes?: string }
  empresaId?: string
  agendamentos?: { id: string; quando: string; canal: string; titulo: string; nota?: string; feito?: boolean }[]
}

const fmtR$ = (v?: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const TIPOS_ATIV: [string, string][] = [['nota', 'Nota'], ['ligacao', 'Ligação'], ['whatsapp', 'WhatsApp'], ['email', 'E-mail'], ['reuniao', 'Reunião']]

export default function CRM({ usuarios = [], onClienteCriado, podeEditar = false, podeExcluir = false, perfilClinica = false, perfilTurismo = false, onIrAgenda }: { usuarios?: any[]; onClienteCriado?: () => void; podeEditar?: boolean; podeExcluir?: boolean; perfilClinica?: boolean; perfilTurismo?: boolean; onIrAgenda?: () => void }) {
  const [estagios, setEstagios] = useState<Estagio[]>([])
  const [negocios, setNegocios] = useState<Negocio[]>([])
  const [contatos, setContatos] = useState<Contato[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  // Atendimentos (clínica) — só para calcular a frequência dos pacientes na lista
  const [agendamentos, setAgendamentos] = useState<{ contatoId?: string; status: string; dataInicio: string }[]>([])
  const [carregando, setCarregando] = useState(true)
  const [novoModal, setNovoModal] = useState(false)
  // Contato já escolhido ao abrir a oportunidade (ex.: vindo do inbox)
  const [novoNegocioContatoId, setNovoNegocioContatoId] = useState('')
  const [aberto, setAberto] = useState<Negocio | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const [vista, setVista] = useState<'painel' | 'funil' | 'contatos' | 'empresas' | 'mensagens' | 'playbook'>(() => (typeof window !== 'undefined' && (sessionStorage.getItem('crm_vista') as any)) || 'funil')
  useEffect(() => { try { sessionStorage.setItem('crm_vista', vista) } catch {} }, [vista])
  // Clínica não tem Empresas. 'pacientes' foi unificado em Contatos — o
  // sessionStorage antigo pode trazer essa vista, que já não existe.
  useEffect(() => {
    if (perfilClinica && vista === 'empresas') setVista('funil')
    if ((vista as string) === 'pacientes') setVista('contatos')
  }, [perfilClinica, vista])
  // "Agendar" a partir do CRM: guarda o pré-preenchimento e navega pra Agenda
  function agendarNoCrm(prefill: { pacienteNome: string; pacienteTelefone?: string; contatoId?: string }) {
    try { sessionStorage.setItem('agenda_prefill', JSON.stringify(prefill)) } catch {}
    onIrAgenda?.()
  }
  // Abrir a conversa de WhatsApp interna (aba Mensagens) de um telefone.
  // `contatoId` (quando vem da ficha/oportunidade) VINCULA a conversa a ele: nós
  // sabemos de quem é o número — deixar o atendente vincular à mão seria pedir
  // que ele repita o que o sistema já sabe.
  const [abrirConversaTel, setAbrirConversaTel] = useState('')
  const [abrirConversaContatoId, setAbrirConversaContatoId] = useState('')
  function abrirWhatsAppInterno(telefone: string, contatoId?: string) {
    const tel = telefoneWhatsApp(telefone) || telefone
    if (!telefoneWhatsApp(telefone)) {
      // Sem número reconhecível não há conversa: abrir uma thread com número
      // inválido mandaria mensagem para sabe-se lá quem.
      toast('Telefone inválido para o WhatsApp. Corrija o número na ficha do contato (com DDD).', 'erro')
      return
    }
    setAberto(null); setContatoModal(null)
    setAbrirConversaTel(tel)
    setAbrirConversaContatoId(contatoId || '')
    setVista('mensagens')
  }
  // Vindo de FORA do CRM (ex.: aniversariantes na home): a outra tela deixa o
  // telefone no sessionStorage e navega pra cá — mesmo padrão do agenda_prefill.
  // Chave consumida na leitura: recarregar não pode reabrir a conversa sozinho.
  useEffect(() => {
    const tel = consumirConversaWhatsApp()
    if (tel) abrirWhatsAppInterno(tel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-scroll do funil ao arrastar um card para perto da borda (facilita chegar
  // em Ganho/Perdido). Só rola quando o card está perto da borda; no meio, não rola.
  const funilRef = useRef<HTMLDivElement>(null)
  const scrollTimer = useRef<any>(null)
  function autoScrollDrag(e: React.DragEvent) {
    e.preventDefault()
    const el = funilRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const EDGE = 90, VEL = 18
    const dir = e.clientX > rect.right - EDGE ? 1 : e.clientX < rect.left + EDGE ? -1 : 0
    if (scrollTimer.current) { clearInterval(scrollTimer.current); scrollTimer.current = null }
    if (dir !== 0) scrollTimer.current = setInterval(() => { el.scrollLeft += dir * VEL }, 16)
  }
  function pararAutoScroll() {
    if (scrollTimer.current) { clearInterval(scrollTimer.current); scrollTimer.current = null }
  }
  // PRÓXIMAS ABORDAGENS — os lembretes das fichas reunidos num lugar só.
  // Não é pipeline: é a agenda de quem precisa ser abordado (hoje / semana).
  // Sai dos contatos já carregados; nada de chamada extra.
  const [abordagensAberto, setAbordagensAberto] = useState(false)
  const hojeYmd = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
  const abordagens = useMemo(() => {
    const hoje = hojeYmd()
    const fim = new Date(); fim.setDate(fim.getDate() + 7)
    const fimYmd = `${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, '0')}-${String(fim.getDate()).padStart(2, '0')}`
    const itens = contatos.flatMap(c => (c.proximosPassos || [])
      .filter(p => !p.feito)
      .map(p => ({ contato: c, passo: p })))
    const atrasadas = itens.filter(i => i.passo.quando < hoje).sort((a, b) => a.passo.quando.localeCompare(b.passo.quando))
    const deHoje = itens.filter(i => i.passo.quando === hoje)
    const semana = itens.filter(i => i.passo.quando > hoje && i.passo.quando <= fimYmd).sort((a, b) => a.passo.quando.localeCompare(b.passo.quando))
    return { atrasadas, hoje: deHoje, semana, urgentes: atrasadas.length + deHoje.length }
  }, [contatos])
  async function concluirAbordagem(contatoId: string, passoId: string) {
    const r = await fetch('/api/crm/contatos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: contatoId, togglePasso: passoId }) }).then(x => x.json()).catch(() => null)
    if (r?.ok) carregar(); else toast('Não foi possível concluir a abordagem.', 'erro')
  }

  const [contatoModal, setContatoModal] = useState<Contato | null | 'novo'>(null)
  // Abordagem rápida (primeira mensagem sem sair da lista de contatos)
  const [abordar, setAbordar] = useState<Contato | null>(null)
  const [empresaModal, setEmpresaModal] = useState<Empresa | null | 'novo'>(null)
  const [bulkModal, setBulkModal] = useState(false)
  // Pipelines (múltiplos funis)
  const [pipelines, setPipelines] = useState<{ id: string; nome: string; ordem: number }[]>([])
  const [pipelineSel, setPipelineSel] = useState('')
  const [pipelinesModal, setPipelinesModal] = useState(false)
  const [etapasModal, setEtapasModal] = useState(false)

  function csvEscape(v: any) { const s = String(v ?? ''); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  function exportarCSV() {
    const linhas = [['Nome', 'Telefone', 'Email', 'Empresa', 'Cargo', 'Observações'].join(';')]
    contatos.forEach((c: any) => linhas.push([c.nome, c.telefone, c.email, c.empresa, c.cargo, c.observacoes].map(csvEscape).join(';')))
    const blob = new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `contatos-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url)
  }
  // Abre a PRÉVIA de importação (não importa direto): lê o arquivo em linhas/colunas
  // e deixa o usuário conferir e mapear as colunas antes de confirmar.
  const [importar, setImportar] = useState<{ linhas: string[][]; tipo?: string } | null>(null)
  async function importarCSV(file: File, tipo?: string) {
    if (!/\.csv$/i.test(file.name) && file.type && !/csv|excel|spreadsheet|text/.test(file.type)) {
      toast('Envie um arquivo .csv (nome; telefone; e-mail; …).', 'erro'); return
    }
    const txt = await file.text()
    // Barra arquivo binário (Excel .xlsx/.zip/.pdf) lido como texto — vira lixo (assinatura "PK", bytes de controle, caractere de substituição).
    const amostra = txt.slice(0, 4000)
    if (/^PK\x03\x04/.test(txt) || /%PDF-/.test(txt.slice(0, 8)) || /[\x00-\x08\x0E-\x1F]/.test(amostra) || (amostra.match(/�/g) || []).length > 3) {
      toast('Isso parece um Excel/arquivo binário (.xlsx), não um CSV. No Excel ou Google Sheets use "Salvar como / Baixar como CSV (UTF-8)" e importe o .csv gerado.', 'erro')
      return
    }
    const brutas = txt.replace(/\r/g, '').split('\n').filter(l => l.trim())
    if (!brutas.length) { toast('Arquivo vazio.', 'erro'); return }
    const sep = (brutas[0].match(/;/g) || []).length >= (brutas[0].match(/,/g) || []).length ? ';' : ','
    const linhas = brutas.map(l => l.split(sep).map(s => s.trim().replace(/^"|"$/g, '')))
    setImportar({ linhas, tipo })
  }

  function carregar() {
    Promise.all([
      fetch('/api/crm/estagios').then(r => r.json()),
      fetch('/api/crm/negocios').then(r => r.json()),
      fetch('/api/crm/contatos').then(r => r.json()),
      fetch('/api/crm/empresas').then(r => r.json()),
      fetch('/api/crm/pipelines').then(r => r.json()),
    ]).then(([e, n, c, emp, pl]) => {
      setEstagios(Array.isArray(e) ? e : [])
      setNegocios(Array.isArray(n) ? n : [])
      setContatos(Array.isArray(c) ? c : [])
      setEmpresas(Array.isArray(emp) ? emp : [])
      const pls = Array.isArray(pl) ? pl : []
      setPipelines(pls)
      // Frequência dos pacientes: carrega os atendimentos (clínica) para a lista
      if (perfilClinica) fetch('/api/agenda').then(r => r.json()).then(d => { if (Array.isArray(d?.agendamentos)) setAgendamentos(d.agendamentos) }).catch(() => {})
      setPipelineSel(prev => (prev && pls.some((p: any) => p.id === prev)) ? prev : (pls[0]?.id || ''))
      setCarregando(false)
    }).catch(() => setCarregando(false))
  }
  useEffect(() => { carregar() }, [])

  async function moverEstagio(neg: Negocio, estagioId: string) {
    if (neg.estagioId === estagioId) return
    setNegocios(ns => ns.map(n => n.id === neg.id ? { ...n, estagioId } : n))
    await fetch('/api/crm/negocios', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: neg.id, estagioId }) }).catch(() => {})
    carregar()
  }

  const contatoDe = (id?: string) => contatos.find(c => c.id === id)
  const totalPorEstagio = (eid: string) => negocios.filter(n => n.estagioId === eid).reduce((s, n) => s + (Number(n.valor) || 0), 0)
  // Filtros por pipeline (negócio/etapa sem pipelineId caem no pipeline padrão = o primeiro)
  const padraoId = pipelines[0]?.id || ''
  const estagiosDoPipeline = (pid: string) => estagios.filter(e => (e.pipelineId || padraoId) === pid)
  const negociosDoPipeline = (pid: string) => negocios.filter(n => (n.pipelineId || padraoId) === pid)
  // Origens conhecidas (dropdown editável): padrões + as já usadas nos negócios
  const origensConhecidas = Array.from(new Set(['Indicação', 'Instagram', 'Ex-paciente', 'Tráfego pago', 'Tráfego orgânico', 'Prospecção ativa', 'Site', 'Google', 'Evento', ...negocios.map(n => (n.origem || '').trim()).filter(Boolean)])).sort((a, b) => a.localeCompare(b, 'pt'))
  // Legenda por aba (perfil-aware). Fica FORA da linha das abas para não deslocá-las.
  const subtitulo = perfilClinica
    ? (({ painel: 'Visão geral dos agendamentos e da captação de pacientes.', funil: 'Arraste os pacientes entre as etapas do agendamento.', pacientes: 'Pacientes que já passaram por atendimento.', contatos: 'Leads e contatos ainda não atendidos.', mensagens: 'Conversas com pacientes e leads.', playbook: 'Roteiro de atendimento e cadência de mensagens.' } as Record<string, string>)[vista] || '')
    : (vista === 'funil' ? 'Arraste os negócios entre as etapas. Clique para ver detalhes e a timeline.' : vista === 'contatos' ? 'Contatos de prospects e clientes.' : 'Roteiro de qualificação e cadência de mensagens para SDR/closer.')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#111', flexShrink: 0 }}>CRM</h2>
        <div style={{ display: 'flex', gap: 4, background: '#f0f0f0', borderRadius: 10, padding: 3 }}>
          {((perfilClinica
            ? [['painel', 'Painel'], ['funil', 'Funil'], ['contatos', 'Contatos'], ['mensagens', 'Mensagens'], ['playbook', 'Biblioteca de Vendas']]
            : [['painel', 'Painel'], ['funil', 'Funil'], ['contatos', 'Contatos'], ['empresas', 'Empresas'], ['mensagens', 'Mensagens'], ['playbook', 'Biblioteca de Vendas']]
          ) as ['painel' | 'funil' | 'contatos' | 'empresas' | 'mensagens' | 'playbook', string][]).map(([v, l]) => (
            <button key={v} onClick={() => setVista(v)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12.5, background: vista === v ? '#fff' : 'transparent', color: vista === v ? '#111' : '#888', boxShadow: vista === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{l}</button>
          ))}
        </div>
        {vista === 'funil' && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Discreto: só um contador. Vira alerta quando há atrasada/para hoje. */}
            <button onClick={() => setAbordagensAberto(true)} title="Lembretes registrados nas fichas dos contatos"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', background: '#fff', color: abordagens.urgentes ? '#b45309' : '#555', border: `1px solid ${abordagens.urgentes ? '#fde68a' : '#e0e0e0'}`, borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              Próximas abordagens
              {abordagens.urgentes > 0 && (
                <span style={{ background: '#b45309', color: '#fff', borderRadius: 999, fontSize: 10.5, fontWeight: 800, padding: '1px 7px' }}>{abordagens.urgentes}</span>
              )}
            </button>
            {podeEditar && <button onClick={() => setNovoModal(true)} style={{ padding: '10px 18px', background: 'var(--marca, #ffc00f)', color: 'var(--marca-texto, #111)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ {perfilClinica || perfilTurismo ? 'Nova oportunidade' : 'Novo negócio'}</button>}
          </div>
        )}
        {vista === 'contatos' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={exportarCSV} style={{ padding: '9px 14px', background: '#f5f5f5', color: '#444', border: '1px solid #e0e0e0', borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Exportar CSV</button>
            <label style={{ padding: '9px 14px', background: '#f5f5f5', color: '#444', border: '1px solid #e0e0e0', borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
              Importar CSV
              <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) importarCSV(e.target.files[0], perfilClinica ? 'lead' : undefined); e.target.value = '' }} />
            </label>
            {podeEditar && <button onClick={() => setBulkModal(true)} style={{ padding: '9px 14px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Adicionar vários</button>}
            {podeEditar && <button onClick={() => setContatoModal('novo')} style={{ padding: '9px 16px', background: 'var(--marca, #ffc00f)', color: 'var(--marca-texto, #111)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Novo</button>}
          </div>
        )}
        {vista === 'empresas' && podeEditar && (
          <button onClick={() => setEmpresaModal('novo')} style={{ marginLeft: 'auto', padding: '10px 18px', background: 'var(--marca, #ffc00f)', color: 'var(--marca-texto, #111)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Nova empresa</button>
        )}
      </div>
      {subtitulo && <p style={{ margin: '0 0 16px', fontSize: 13, color: '#999' }}>{subtitulo}</p>}

      {/* Seletor de pipeline (funil e painel) */}
      {(vista === 'funil' || vista === 'painel') && pipelines.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pipeline</span>
          <div style={{ display: 'flex', gap: 4, background: '#f0f0f0', borderRadius: 9, padding: 3, flexWrap: 'wrap' }}>
            {pipelines.map(p => (
              <button key={p.id} onClick={() => setPipelineSel(p.id)} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: pipelineSel === p.id ? '#111' : 'transparent', color: pipelineSel === p.id ? '#fff' : '#666' }}>{p.nome}</button>
            ))}
          </div>
          {podeEditar && <button onClick={() => setEtapasModal(true)} style={{ padding: '6px 12px', background: '#fff', color: '#444', border: '1px solid #e0e0e0', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Editar etapas</button>}
          {podeEditar && <button onClick={() => setPipelinesModal(true)} style={{ padding: '6px 12px', background: '#fff', color: '#444', border: '1px solid #e0e0e0', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Gerenciar pipelines</button>}
        </div>
      )}

      {carregando ? <p style={{ color: '#aaa' }}>Carregando...</p> : vista === 'painel' ? (
        <PainelVendas negocios={negociosDoPipeline(pipelineSel)} estagios={estagiosDoPipeline(pipelineSel)} usuarios={usuarios} perfilClinica={perfilClinica} />
      ) : vista === 'contatos' ? (
        // Lista ÚNICA: leads e pacientes convivem aqui (o tipo vira só um selo).
        <ContatosLista contatos={contatos} negocios={negocios} onAbrir={c => setContatoModal(c)} podeExcluir={podeExcluir} onRecarregar={carregar} perfilClinica={perfilClinica} agendamentos={perfilClinica ? agendamentos : undefined} mostrarFrequencia={perfilClinica} onImportar={podeEditar ? (f => importarCSV(f, perfilClinica ? 'lead' : undefined)) : undefined} />
      ) : vista === 'empresas' ? (
        <EmpresasLista empresas={empresas} contatos={contatos} negocios={negocios} onAbrir={e => setEmpresaModal(e)} />
      ) : vista === 'mensagens' ? (
        <MensagensInbox contatos={contatos} perfilClinica={perfilClinica} podeExcluir={podeExcluir} onContatosMudou={carregar} abrirTel={abrirConversaTel} abrirContatoId={abrirConversaContatoId} onAbriuTel={() => { setAbrirConversaTel(''); setAbrirConversaContatoId('') }}
          onAbrirOportunidade={podeEditar ? (contatoId => { setNovoNegocioContatoId(contatoId); setNovoModal(true) }) : undefined} />
      ) : vista === 'playbook' ? (
        <BibliotecaVendasTela podeEditar={podeEditar} />
      ) : (
        <div ref={funilRef} className="crm-kanban" onDragOver={autoScrollDrag} onDrop={pararAutoScroll} onDragEnd={pararAutoScroll}
          style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12, alignItems: 'stretch', minHeight: 'calc(100vh - 220px)' }}>
          {estagiosDoPipeline(pipelineSel).map(est => {
            const cards = negocios.filter(n => n.estagioId === est.id)
            const cor = est.ganho ? '#16a34a' : est.perdido ? '#b91c1c' : '#111'
            return (
              <div key={est.id}
                onDragOver={e => { e.preventDefault(); setOverCol(est.id) }}
                onDrop={() => { const n = negocios.find(x => x.id === dragId); if (n) moverEstagio(n, est.id); setDragId(null); setOverCol(null); pararAutoScroll() }}
                style={{ flex: '0 0 270px', width: 270, background: overCol === est.id ? '#fff8e1' : '#f6f6f6', borderRadius: 12, padding: 10, minHeight: 120, border: overCol === est.id ? '1.5px dashed #ffc00f' : '1.5px solid transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 10px' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: cor }}>{est.nome}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#999' }}>{cards.length}</span>
                </div>
                {cards.length > 0 && <p style={{ margin: '0 6px 8px', fontSize: 11, color: '#999' }}>{fmtR$(totalPorEstagio(est.id))}</p>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {cards.map(n => {
                    const ct = contatoDe(n.contatoId)
                    return (
                      <div key={n.id} draggable onDragStart={() => setDragId(n.id)} onDragEnd={() => { setDragId(null); setOverCol(null); pararAutoScroll() }}
                        onClick={() => setAberto(n)}
                        style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer', border: '1px solid #eee' }}>
                        <p style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 700, color: '#111' }}>{n.titulo}</p>
                        {!!n.valor && <p style={{ margin: '0 0 4px', fontSize: 12.5, fontWeight: 700, color: '#16a34a' }}>{fmtR$(n.valor)}</p>}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <span style={{ fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ct?.nome || 'Sem contato'}</span>
                          {n.donoNome && <span style={{ fontSize: 10, color: '#aaa', flexShrink: 0 }}>{n.donoNome.split(' ')[0]}</span>}
                        </div>
                        {n.proximoFollowUp && (() => { const atrasado = new Date(new Date(n.proximoFollowUp).setHours(23, 59, 59, 999)).getTime() < Date.now(); return (
                          <span style={{ display: 'inline-block', marginTop: 6, fontSize: 10, fontWeight: 700, color: atrasado ? '#b91c1c' : '#888', background: atrasado ? '#fee2e2' : '#f0f0f0', borderRadius: 999, padding: '2px 8px' }}>
                            {atrasado ? 'Follow-up atrasado' : 'Follow-up'} · {new Date(n.proximoFollowUp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </span>
                        ) })()}
                        {(() => {
                          const prox = [...(n.agendamentos || [])].filter(a => !a.feito).sort((a, b) => a.quando.localeCompare(b.quando))[0]
                          if (!prox) return null
                          const atrasado = new Date(prox.quando + 'T23:59:59').getTime() < Date.now()
                          return (
                            <span style={{ display: 'inline-block', marginTop: 6, marginLeft: 6, fontSize: 10, fontWeight: 700, color: atrasado ? '#b91c1c' : '#1d4ed8', background: atrasado ? '#fee2e2' : '#eff6ff', borderRadius: 999, padding: '2px 8px' }}>
                              {prox.canal} · {new Date(prox.quando + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                            </span>
                          )
                        })()}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Próximas abordagens — o que precisa ser feito HOJE e na semana, vindo
          dos lembretes das fichas. Nada a ver com o estágio do funil. */}
      {abordagensAberto && (
        <div onClick={fecharFora(() => setAbordagensAberto(false), { perguntar: false })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 520, width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#111' }}>Próximas abordagens</h3>
              <span style={{ flex: 1 }} />
              <button onClick={() => setAbordagensAberto(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999', lineHeight: 1 }}>×</button>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#999' }}>Lembretes registrados nas fichas dos contatos. Concluir aqui dá baixa na tarefa do responsável.</p>
            {([
              ['Atrasadas', abordagens.atrasadas, '#b91c1c'],
              ['Hoje', abordagens.hoje, '#b45309'],
              ['Próximos 7 dias', abordagens.semana, '#1d4ed8'],
            ] as [string, { contato: Contato; passo: ProximoPasso }[], string][]).map(([titulo, itens, cor]) => (
              <div key={titulo} style={{ marginBottom: 14 }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: cor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{titulo} · {itens.length}</p>
                {itens.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 12, color: '#ccc' }}>Nada por aqui.</p>
                ) : itens.map(({ contato: c, passo: p }) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: '1px solid #f5f5f5' }}>
                    <button onClick={() => concluirAbordagem(c.id, p.id)} title="Marcar como feita"
                      style={{ width: 17, height: 17, borderRadius: 5, border: '1.5px solid #cbd5e1', background: '#fff', cursor: 'pointer', flexShrink: 0 }} />
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: cor, flexShrink: 0 }}>{p.quando.split('-').reverse().slice(0, 2).join('/')}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</p>
                      <p style={{ margin: 0, fontSize: 11.5, color: '#777', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.titulo}</p>
                    </div>
                    <button onClick={() => { setAbordagensAberto(false); setContatoModal(c) }} title="Abrir a ficha do contato"
                      style={{ background: 'none', border: 'none', color: '#1d4ed8', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', flexShrink: 0, padding: 0 }}>Abrir ficha</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {novoModal && <NovoNegocioModal estagios={estagiosDoPipeline(pipelineSel)} pipelineId={pipelineSel} usuarios={usuarios} contatos={contatos} origens={origensConhecidas} perfilClinica={perfilClinica} perfilTurismo={perfilTurismo} contatoIdInicial={novoNegocioContatoId} onClose={() => { setNovoModal(false); setNovoNegocioContatoId('') }} onSalvo={() => { setNovoModal(false); setNovoNegocioContatoId(''); carregar() }} />}
      {aberto && <NegocioModal negocio={aberto} estagios={estagios} pipelines={pipelines} padraoId={padraoId} contato={contatoDe(aberto.contatoId)} usuarios={usuarios} podeExcluir={podeExcluir} perfilClinica={perfilClinica} perfilTurismo={perfilTurismo} onAgendar={perfilClinica ? agendarNoCrm : undefined} onAbrirWhatsApp={abrirWhatsAppInterno} onClose={() => setAberto(null)} onMudou={() => carregar()} onFechar={() => { setAberto(null); carregar() }} onClienteCriado={onClienteCriado} />}
      {abordar && <AbordagemModal contato={abordar} podeEditar={podeEditar}
        onClose={() => setAbordar(null)}
        onAbrirConversa={(tel, cid) => { setAbordar(null); abrirWhatsAppInterno(tel, cid) }}
        onAbrirOportunidade={podeEditar ? (contatoId => { setAbordar(null); setNovoNegocioContatoId(contatoId); setNovoModal(true) }) : undefined} />}
      {contatoModal && <ContatoModal contato={contatoModal === 'novo' ? null : contatoModal} podeExcluir={podeExcluir} perfilClinica={perfilClinica} perfilTurismo={perfilTurismo} tipoPadrao={vista === 'contatos' && perfilClinica ? 'lead' : 'paciente'} onAgendar={perfilClinica ? agendarNoCrm : undefined}
        onAbrirWhatsApp={(telefone, contatoId) => {
          // `telefone` vem do formulário (a ficha acabou de salvar): a lista em
          // memória ainda tem o número antigo e abordaria o número errado.
          const c = contatos.find(x => x.id === contatoId)
          setContatoModal(null)
          if (c) setAbordar({ ...c, telefone })
          carregar()
        }}
        onAbrirOportunidade={podeEditar ? (contatoId => { setContatoModal(null); setNovoNegocioContatoId(contatoId); setNovoModal(true) }) : undefined}
        onClose={() => setContatoModal(null)} onSalvo={() => { setContatoModal(null); carregar() }} />}
      {importar && <ImportarContatosModal linhas={importar.linhas} tipo={importar.tipo} perfilClinica={perfilClinica} onClose={() => setImportar(null)} onImportado={() => { setImportar(null); carregar() }} />}
      {bulkModal && <BulkContatosModal onClose={() => setBulkModal(false)} onSalvo={() => { setBulkModal(false); carregar() }} />}
      {empresaModal && <EmpresaModal empresa={empresaModal === 'novo' ? null : empresaModal} contatos={contatos} negocios={negocios} podeExcluir={podeExcluir}
        onAbrirContato={c => { setEmpresaModal(null); setContatoModal(c) }}
        onClose={() => setEmpresaModal(null)} onSalvo={() => { setEmpresaModal(null); carregar() }} />}
      {pipelinesModal && <PipelinesModal pipelines={pipelines} podeExcluir={podeExcluir} onClose={() => setPipelinesModal(false)} onMudou={carregar} />}
      {etapasModal && <EtapasModal pipelineId={pipelineSel} pipelineNome={pipelines.find(p => p.id === pipelineSel)?.nome || ''} estagios={estagiosDoPipeline(pipelineSel)} onClose={() => setEtapasModal(false)} onMudou={carregar} />}
    </div>
  )
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }

function PainelVendas({ negocios, estagios, usuarios, perfilClinica = false }: { negocios: Negocio[]; estagios: Estagio[]; usuarios: any[]; perfilClinica?: boolean }) {
  const agora = new Date(), m = agora.getMonth(), y = agora.getFullYear()
  const noMes = (iso?: string) => { if (!iso) return false; const d = new Date(iso); return d.getMonth() === m && d.getFullYear() === y }
  const abertos = negocios.filter(n => n.status === 'aberto')
  const ganhos = negocios.filter(n => n.status === 'ganho')
  const perdidos = negocios.filter(n => n.status === 'perdido')
  const ganhosMes = ganhos.filter(n => noMes(n.atualizadoEm))
  const perdidosMes = perdidos.filter(n => noMes(n.atualizadoEm))
  const valorAberto = abertos.reduce((s, n) => s + (Number(n.valor) || 0), 0)
  const valorGanhoMes = ganhosMes.reduce((s, n) => s + (Number(n.valor) || 0), 0)
  const fechados = ganhosMes.length + perdidosMes.length
  const winRate = fechados > 0 ? Math.round((ganhosMes.length / fechados) * 100) : 0
  const ticket = ganhos.length > 0 ? ganhos.reduce((s, n) => s + (Number(n.valor) || 0), 0) / ganhos.length : 0
  const colsAbertas = estagios.filter(e => !e.ganho && !e.perdido)
  const porVendedor = Object.values(abertos.reduce((acc: any, n) => {
    const k = n.donoNome || '—'; acc[k] = acc[k] || { nome: k, qtd: 0, valor: 0 }; acc[k].qtd++; acc[k].valor += Number(n.valor) || 0; return acc
  }, {})).sort((a: any, b: any) => b.valor - a.valor)
  // De onde vêm os negócios (todas as situações — mede o canal, não o resultado)
  const porOrigem = (Object.values(negocios.reduce((acc: any, n) => {
    const k = (n.origem || '').trim(); if (!k) return acc
    acc[k] = acc[k] || { nome: k, qtd: 0 }; acc[k].qtd++; return acc
  }, {})) as { nome: string; qtd: number }[]).sort((a, b) => b.qtd - a.qtd).slice(0, 8)

  const Card = ({ titulo, valor, sub, cor }: { titulo: string; valor: string; sub?: string; cor?: string }) => (
    <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <p style={{ margin: 0, fontSize: 12, color: '#999', fontWeight: 600 }}>{titulo}</p>
      <p style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 800, color: cor || '#111' }}>{valor}</p>
      {sub && <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#aaa' }}>{sub}</p>}
    </div>
  )

  return (
    <div style={{ maxWidth: 920 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
        <Card titulo="Em aberto" valor={fmtR$(valorAberto)} sub={`${abertos.length} negócio(s)`} />
        <Card titulo="Ganho no mês" valor={fmtR$(valorGanhoMes)} sub={`${ganhosMes.length} venda(s)`} cor="#16a34a" />
        <Card titulo="Win rate (mês)" valor={`${winRate}%`} sub={`${ganhosMes.length} ganho / ${perdidosMes.length} perdido`} />
        <Card titulo="Ticket médio" valor={fmtR$(ticket)} sub="negócios ganhos" />
      </div>

      <span style={{ fontSize: 13, fontWeight: 800, color: '#111', display: 'block', marginBottom: 10 }}>Funil (em aberto por etapa)</span>
      <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 18 }}>
        {colsAbertas.map(e => {
          const ns = abertos.filter(n => n.estagioId === e.id)
          const val = ns.reduce((s, n) => s + (Number(n.valor) || 0), 0)
          const maxQtd = Math.max(1, ...colsAbertas.map(c => abertos.filter(n => n.estagioId === c.id).length))
          return (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{ width: 120, fontSize: 12.5, fontWeight: 700, color: '#444', flexShrink: 0 }}>{e.nome}</span>
              <div style={{ flex: 1, height: 22, background: '#f4f4f4', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ width: `${(ns.length / maxQtd) * 100}%`, height: '100%', background: '#ffc00f', minWidth: ns.length ? 6 : 0 }} />
              </div>
              <span style={{ width: 130, textAlign: 'right', fontSize: 12, color: '#888', flexShrink: 0 }}>{ns.length} · {fmtR$(val)}</span>
            </div>
          )
        })}
      </div>

      <span style={{ fontSize: 13, fontWeight: 800, color: '#111', display: 'block', marginBottom: 10 }}>Origem dos negócios</span>
      <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 18 }}>
        {porOrigem.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: '#aaa' }}>Nenhum negócio com origem preenchida ainda.</p> : porOrigem.map(o => (
          <div key={o.nome} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ width: 120, fontSize: 12.5, fontWeight: 700, color: '#444', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.nome}</span>
            <div style={{ flex: 1, height: 18, background: '#f4f4f4', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: `${(o.qtd / porOrigem[0].qtd) * 100}%`, height: '100%', background: '#111', minWidth: 6, borderRadius: 6 }} />
            </div>
            <span style={{ width: 40, textAlign: 'right', fontSize: 12.5, fontWeight: 800, color: '#111', flexShrink: 0 }}>{o.qtd}</span>
          </div>
        ))}
      </div>

      <span style={{ fontSize: 13, fontWeight: 800, color: '#111', display: 'block', marginBottom: 10 }}>{perfilClinica ? 'Pipeline por responsável' : 'Pipeline por vendedor'}</span>
      <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        {porVendedor.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: '#aaa' }}>Sem negócios em aberto.</p> : porVendedor.map((v: any) => (
          <div key={v.nome} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
            <span style={{ fontSize: 13, color: '#333' }}>{v.nome}</span>
            <span style={{ fontSize: 12.5, color: '#888' }}>{v.qtd} negócio(s) · <b style={{ color: '#111' }}>{fmtR$(v.valor)}</b></span>
          </div>
        ))}
      </div>
    </div>
  )
}

const CANAL: Record<string, { label: string; cor: string }> = {
  whatsapp: { label: 'WhatsApp', cor: '#16a34a' }, ligacao: { label: 'Ligação', cor: '#1d4ed8' }, email: { label: 'E-mail', cor: '#7c3aed' },
}
type Passo = { id: string; dia: number; canal: string; titulo: string; script: string }

function BulkContatosModal({ onClose, onSalvo }: { onClose: () => void; onSalvo: () => void }) {
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const linhas = texto.split('\n').filter(l => l.trim())
  async function salvar() {
    const lote = linhas.map(l => {
      const sep = (l.match(/;/g) || []).length >= (l.match(/,/g) || []).length ? ';' : ','
      const c = l.split(sep).map(s => s.trim())
      return { nome: c[0] || '', telefone: c[1] || '', email: c[2] || '', empresa: c[3] || '' }
    }).filter(c => c.nome)
    if (!lote.length) return
    setSalvando(true)
    const r = await fetch('/api/crm/contatos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lote }) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (r?.ok) { toast(`${r.criados} contato(s) adicionado(s).`, 'sucesso'); onSalvo() } else toast('Falha ao adicionar.', 'erro')
  }
  return (
    <div onClick={fecharFora(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 16, color: '#111' }}>Adicionar vários contatos</h3>
        <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#999' }}>Um contato por linha, separando por <b>;</b> (ou vírgula): <code style={{ background: '#f5f5f5', padding: '1px 5px', borderRadius: 4 }}>Nome ; Telefone ; Email ; Empresa</code></p>
        <textarea value={texto} onChange={e => setTexto(e.target.value)} autoFocus placeholder={'João Silva ; +5511999990000 ; joao@empresa.com ; Clínica X\nMaria Souza ; +5511988887777 ; maria@loja.com ; Loja Y'}
          style={{ width: '100%', minHeight: 200, padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
          <button onClick={salvar} disabled={salvando || linhas.length === 0} style={{ flex: 1, padding: '11px 0', background: linhas.length ? '#ffc00f' : '#f0f0f0', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: linhas.length ? 'pointer' : 'not-allowed' }}>{salvando ? 'Adicionando...' : `Adicionar ${linhas.length || ''} contato(s)`}</button>
          <button onClick={onClose} style={{ padding: '11px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// Vincula contato/negócio a uma empresa por empresaId OU pelo nome (texto) batendo
function ligadosEmpresa(emp: Empresa, contatos: Contato[], negocios: Negocio[]) {
  const nome = (emp.nome || '').toLowerCase()
  const cts = contatos.filter(c => c.empresaId === emp.id || (c.empresa && c.empresa.toLowerCase() === nome))
  const negs = negocios.filter(n => n.empresaId === emp.id || ((n as any).empresa && (n as any).empresa.toLowerCase() === nome))
  return { cts, negs }
}

function EmpresasLista({ empresas, contatos, negocios, onAbrir }: { empresas: Empresa[]; contatos: Contato[]; negocios: Negocio[]; onAbrir: (e: Empresa) => void }) {
  if (empresas.length === 0) return <div style={{ background: '#fff', borderRadius: 14, padding: '50px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}><p style={{ margin: 0, fontSize: 14, color: '#888' }}>Nenhuma empresa ainda.</p></div>
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
      {empresas.map(e => {
        const { cts, negs } = ligadosEmpresa(e, contatos, negocios)
        const aberto = negs.filter(n => n.status === 'aberto').reduce((s, n) => s + (Number(n.valor) || 0), 0)
        return (
          <div key={e.id} onClick={() => onAbrir(e)} style={{ background: '#fff', borderRadius: 12, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #eee', cursor: 'pointer' }}>
            <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#111' }}>{e.nome}</p>
            {e.segmento && <p style={{ margin: '0 0 8px', fontSize: 12, color: '#888' }}>{e.segmento}</p>}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#555', background: '#f0f0f0', borderRadius: 999, padding: '2px 8px' }}>{cts.length} contato(s)</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', borderRadius: 999, padding: '2px 8px' }}>{negs.length} negócio(s)</span>
              {aberto > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', borderRadius: 999, padding: '2px 8px' }}>{fmtR$(aberto)} em aberto</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EmpresaModal({ empresa, contatos, negocios, onClose, onSalvo, podeExcluir = false, onAbrirContato }: { empresa: Empresa | null; contatos: Contato[]; negocios: Negocio[]; onClose: () => void; onSalvo: () => void; podeExcluir?: boolean; onAbrirContato?: (c: Contato) => void }) {
  const [f, setF] = useState<any>({ nome: empresa?.nome || '', cnpj: formatarCnpj((empresa as any)?.cnpj), segmento: empresa?.segmento || '', site: empresa?.site || '', instagram: empresa?.instagram || '', telefone: empresa?.telefone || '', observacoes: empresa?.observacoes || '' })
  const [salvando, setSalvando] = useState(false)
  const lig = empresa ? ligadosEmpresa(empresa, contatos, negocios) : { cts: [], negs: [] }

  // Vínculo com contatos, aqui mesmo — inclusive na CRIAÇÃO (a empresa nasce
  // com gente dentro; antes era criar, ir em Contatos e editar um por um).
  // Pendente até salvar: a empresa nova só tem id depois do POST.
  const [vincularIds, setVincularIds] = useState<string[]>([])
  const [desvincularIds, setDesvincularIds] = useState<string[]>([])
  const [buscaCt, setBuscaCt] = useState('')
  const [seletorAberto, setSeletorAberto] = useState(false)

  const jaLigados = lig.cts.filter(c => !desvincularIds.includes(c.id))
  const pendentes = contatos.filter(c => vincularIds.includes(c.id))
  const naFicha = [...jaLigados, ...pendentes]
  const candidatos = useMemo(() => {
    const q = semAcento(buscaCt.trim())
    const fora = contatos.filter(c => !naFicha.some(x => x.id === c.id))
    const lista = q ? fora.filter(c => semAcento(c.nome).includes(q) || semAcento(c.empresa || '').includes(q)) : fora
    return lista.slice(0, 30) // lista longa: sem busca, só os primeiros
  }, [contatos, naFicha, buscaCt])

  async function salvar() {
    if (!f.nome.trim()) return
    setSalvando(true)
    const corpo = { ...f, cnpj: soDigitosCnpj(f.cnpj) }
    let id = empresa?.id || ''
    if (id) await fetch('/api/crm/empresas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...corpo }) }).catch(() => {})
    else id = await fetch('/api/crm/empresas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }).then(x => x.json()).then(d => d?.empresa?.id || '').catch(() => '')
    // O vínculo mora no CONTATO (empresaId), então cada um é um PUT. Grava o
    // nome junto: as duas telas casam por id OU por nome (ligadosEmpresa).
    if (id) {
      await Promise.all([
        ...vincularIds.map(cid => fetch('/api/crm/contatos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: cid, empresaId: id, empresa: f.nome.trim() }) }).catch(() => {})),
        ...desvincularIds.map(cid => fetch('/api/crm/contatos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: cid, empresaId: '', empresa: '' }) }).catch(() => {})),
      ])
    }
    setSalvando(false); onSalvo()
  }
  async function excluir() {
    if (!empresa?.id || !(await confirmar('Excluir esta empresa? Os contatos e negócios não são apagados.', { titulo: 'Excluir empresa', okLabel: 'Excluir', perigo: true }))) return
    await fetch(`/api/crm/empresas?id=${empresa.id}`, { method: 'DELETE' }).catch(() => {})
    onSalvo()
  }
  return (
    <div onClick={fecharFora(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#111' }}>{empresa ? 'Editar empresa' : 'Nova empresa'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label style={labelStyle}>Nome *</label><input value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} style={inputStyle} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>CNPJ</label>
              <input value={f.cnpj} onChange={e => setF({ ...f, cnpj: formatarCnpj(e.target.value) })} inputMode="numeric" placeholder="00.000.000/0000-00" style={inputStyle} />
              {/* Opcional — mas se veio errado, avisa. CNPJ torto vai parar em
                  contrato e nota, e ninguém confere de novo. Não impede salvar. */}
              {f.cnpj.trim() && !cnpjValido(f.cnpj) && (
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#b91c1c', fontWeight: 600 }}>CNPJ incompleto ou inválido — confira antes de salvar.</p>
              )}
            </div>
            <div><label style={labelStyle}>Segmento</label><input value={f.segmento} onChange={e => setF({ ...f, segmento: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Telefone</label><input value={f.telefone} onChange={e => setF({ ...f, telefone: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Site</label><input value={f.site} onChange={e => setF({ ...f, site: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Instagram</label><input value={f.instagram} onChange={e => setF({ ...f, instagram: e.target.value })} style={inputStyle} /></div>
          </div>
          <div><label style={labelStyle}>Observações</label><textarea value={f.observacoes} onChange={e => setF({ ...f, observacoes: e.target.value })} style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} /></div>
        </div>
        {/* Contatos da empresa: clicáveis (abrem a ficha) e vinculáveis daqui */}
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
          <label style={labelStyle}>Contatos desta empresa</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {naFicha.map(c => (
              <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: vincularIds.includes(c.id) ? '#fef9c3' : '#f4f4f5', border: '1px solid #e5e7eb', borderRadius: 999, padding: '4px 6px 4px 10px', fontSize: 12, fontWeight: 600, color: '#333' }}>
                <button onClick={() => onAbrirContato?.(c)} title="Abrir a ficha do contato"
                  style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: onAbrirContato ? '#1d4ed8' : '#333', cursor: onAbrirContato ? 'pointer' : 'default' }}>{c.nome}</button>
                <button onClick={() => {
                  if (vincularIds.includes(c.id)) setVincularIds(ids => ids.filter(x => x !== c.id))
                  else setDesvincularIds(ids => [...ids, c.id])
                }} title="Desvincular da empresa"
                  style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '0 2px' }}>×</button>
              </span>
            ))}
            {naFicha.length === 0 && <span style={{ fontSize: 12, color: '#aaa' }}>Nenhum contato vinculado.</span>}
            <button onClick={() => setSeletorAberto(v => !v)}
              style={{ padding: '4px 10px', background: '#fff', border: '1.5px dashed #d4d4d8', borderRadius: 999, fontSize: 12, fontWeight: 700, color: '#666', cursor: 'pointer' }}>+ Vincular</button>
          </div>

          {seletorAberto && (
            <div style={{ marginTop: 8, border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              <input value={buscaCt} onChange={e => setBuscaCt(e.target.value)} autoFocus placeholder="Buscar contato por nome..."
                style={{ ...inputStyle, border: 'none', borderBottom: '1px solid #f0f0f0', borderRadius: 0 }} />
              <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                {candidatos.map(c => (
                  <button key={c.id} onClick={() => { setVincularIds(ids => [...ids, c.id]); setBuscaCt('') }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid #f7f7f7', fontSize: 12.5, color: '#333', cursor: 'pointer' }}>
                    {c.nome}{c.empresa ? <span style={{ color: '#aaa' }}> · hoje em {c.empresa}</span> : ''}
                  </button>
                ))}
                {candidatos.length === 0 && <p style={{ margin: 0, padding: '10px 12px', fontSize: 12, color: '#aaa' }}>Nenhum contato encontrado.</p>}
              </div>
            </div>
          )}
          {(vincularIds.length > 0 || desvincularIds.length > 0) && (
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#92400e' }}>As mudanças de vínculo são aplicadas ao salvar.</p>
          )}
          {lig.negs.length > 0 && <p style={{ margin: '10px 0 0', fontSize: 12, color: '#888' }}><b>Negócios:</b> {lig.negs.map(n => n.titulo).join(', ')}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={salvar} disabled={salvando || !f.nome.trim()} style={{ flex: 1, padding: '11px 0', background: f.nome.trim() ? '#ffc00f' : '#f0f0f0', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: f.nome.trim() ? 'pointer' : 'not-allowed' }}>{salvando ? 'Salvando...' : empresa ? 'Salvar' : 'Criar empresa'}</button>
          {empresa && podeExcluir && <button onClick={excluir} style={{ padding: '11px 16px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Excluir</button>}
          <button onClick={onClose} style={{ padding: '11px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// Normaliza p/ busca: sem acento, minúsculo (achar "Joao" digitando "joão" e vice-versa)
const semAcento = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function ContatosLista({ contatos: contatosTodos, negocios, onAbrir, podeExcluir = false, onRecarregar, perfilClinica = false, onImportar, agendamentos = [], mostrarFrequencia = false }: { contatos: Contato[]; negocios: Negocio[]; onAbrir: (c: Contato) => void; podeExcluir?: boolean; onRecarregar: () => void; perfilClinica?: boolean; onImportar?: (f: File) => void; agendamentos?: { contatoId?: string; status: string; dataInicio: string }[]; mostrarFrequencia?: boolean }) {
  const [vista, setVista] = useState<'lista' | 'cards'>('lista')
  // Busca: nome, telefone, e-mail, empresa, área e etiquetas. Telefone casa só
  // pelos dígitos — assim "99994104" acha "+55 (55) 99994-4104".
  const [busca, setBusca] = useState('')
  const contatos = useMemo(() => {
    const q = semAcento(busca.trim())
    if (!q) return contatosTodos
    const qDigitos = q.replace(/\D/g, '')
    return contatosTodos.filter(c => {
      if (qDigitos && (c.telefone || '').replace(/\D/g, '').includes(qDigitos)) return true
      const alvo = semAcento([c.nome, c.email, c.empresa, c.areaAtuacao, c.cargo, (c.etiquetas || []).join(' ')].filter(Boolean).join(' '))
      return alvo.includes(q)
    })
  }, [contatosTodos, busca])
  // Datas dos atendimentos CONCLUÍDOS por contato — base da coluna Frequência
  const datasAtendidas = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const a of agendamentos) {
      if (a.status !== 'atendido' || !a.contatoId) continue
      const arr = m.get(a.contatoId); arr ? arr.push(a.dataInicio) : m.set(a.contatoId, [a.dataInicio])
    }
    return m
  }, [agendamentos])
  // Rótulo curto de frequência para a célula da lista
  function labelFreq(id: string): { txt: string; forte: boolean } {
    const f = frequenciaPaciente(datasAtendidas.get(id) || [])
    if (f.total === 0) return { txt: '—', forte: false }
    if (f.total === 1) return { txt: '1 atend.', forte: false }
    return { txt: `${f.total}× · a cada ~${f.mediaDias}d`, forte: true }
  }
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [excluindo, setExcluindo] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  // Mesclar duplicados: exige exatamente 2 selecionados
  const [mesclarAberto, setMesclarAberto] = useState(false)
  const [principalId, setPrincipalId] = useState('')
  const [mesclando, setMesclando] = useState(false)
  // Arrastar arquivo CSV sobre a lista = importar contatos em massa
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setArrastando(false)
    const f = e.dataTransfer.files?.[0]
    if (f && onImportar) onImportar(f)
  }
  // Envolve o conteúdo com a área de "soltar arquivo" (dropzone) e a sobreposição
  const dz = (children: React.ReactNode) => (
    <div
      onDragOver={onImportar ? (e => { e.preventDefault(); if (!arrastando) setArrastando(true) }) : undefined}
      onDragLeave={onImportar ? (() => setArrastando(false)) : undefined}
      onDrop={onImportar ? onDrop : undefined}
      style={{ position: 'relative' }}
    >
      {children}
      {arrastando && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,192,15,0.12)', border: '2px dashed #ffc00f', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, pointerEvents: 'none' }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#a16207' }}>Solte o arquivo .csv para importar em massa</span>
        </div>
      )}
    </div>
  )

  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const todos = contatos.length > 0 && sel.size === contatos.length
  const toggleTodos = () => setSel(todos ? new Set() : new Set(contatos.map(c => c.id)))
  const empresaLabel = (c: Contato) => c.profissionalAutonomo ? 'Autônomo' : (c.empresa || '—')
  // Limpeza de importação quebrada: nomes-lixo de arquivo binário importado como CSV.
  const quebrados = contatos.filter(c => pareceQuebrado(c.nome))
  const selecionarQuebrados = () => setSel(new Set(quebrados.map(c => c.id)))

  async function excluirSelecionados() {
    if (sel.size === 0) return
    if (!(await confirmar(`Excluir ${sel.size} contato(s) selecionado(s)? Esta ação não pode ser desfeita.`, { titulo: 'Excluir contatos', okLabel: `Excluir ${sel.size}`, perigo: true }))) return
    setExcluindo(true)
    const r = await fetch(`/api/crm/contatos?ids=${Array.from(sel).join(',')}`, { method: 'DELETE' }).then(x => x.json()).catch(() => null)
    setExcluindo(false)
    if (r?.ok) { toast(`${r.excluidos} contato(s) excluído(s).`, 'sucesso'); setSel(new Set()); onRecarregar() }
    else toast('Falha ao excluir.', 'erro')
  }

  // Contatos selecionados (para mesclar) + pontuação de "completude" p/ sugerir o principal
  const selecionados = contatos.filter(c => sel.has(c.id))
  const completude = (c?: Contato) => [c?.telefone, c?.email, c?.empresa, c?.areaAtuacao, (c as any)?.nascimento, (c as any)?.historico?.length].filter(Boolean).length
  function abrirMesclar() {
    if (selecionados.length !== 2) return
    const [a, b] = selecionados
    setPrincipalId(completude(a) >= completude(b) ? a.id : b.id) // sugere o mais completo
    setMesclarAberto(true)
  }
  async function mesclar() {
    const secundarioId = selecionados.map(c => c.id).find(i => i !== principalId)
    if (!principalId || !secundarioId) return
    setMesclando(true)
    const r = await fetch('/api/crm/contatos/mesclar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ principalId, secundarioId }) }).then(x => x.json()).catch(() => null)
    setMesclando(false)
    if (r?.ok) { toast('Contatos mesclados.', 'sucesso'); setMesclarAberto(false); setSel(new Set()); onRecarregar() }
    else toast(r?.error || 'Falha ao mesclar.', 'erro')
  }

  // Base vazia de verdade: nem mostra a busca (não há o que buscar).
  if (contatosTodos.length === 0) return dz(
    <div style={{ background: '#fff', borderRadius: 14, padding: '50px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <p style={{ margin: 0, fontSize: 14, color: '#888' }}>Nenhum contato ainda.</p>
      {onImportar && <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#bbb' }}>Arraste um arquivo .csv aqui para importar em massa.</p>}
    </div>
  )

  const barraSel = sel.size > 0 && (
    <>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: '#111', color: '#fff', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 700 }}>{sel.size} selecionado(s)</span>
      {podeExcluir && sel.size === 2 && <button onClick={abrirMesclar} style={{ padding: '7px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Mesclar duplicados</button>}
      {podeExcluir && <button onClick={excluirSelecionados} disabled={excluindo} style={{ padding: '7px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: excluindo ? 'default' : 'pointer' }}>{excluindo ? 'Excluindo...' : 'Excluir selecionados'}</button>}
      <button onClick={() => setSel(new Set())} style={{ padding: '7px 12px', background: 'transparent', color: '#ddd', border: '1px solid #555', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Limpar seleção</button>
    </div>
    {mesclarAberto && selecionados.length === 2 && (
      <div onClick={fecharFora(() => setMesclarAberto(false))} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 480, width: '100%', padding: 22 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 16.5, color: '#111' }}>Mesclar contatos</h3>
          <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#999' }}>Escolha qual registro fica como principal. O outro será removido e seus dados (telefone, histórico, negócios, agendamentos e conversas) vão para o principal.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selecionados.map(c => {
              const marcado = principalId === c.id
              return (
                <button key={c.id} onClick={() => setPrincipalId(c.id)} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 10, border: `1.5px solid ${marcado ? '#2563eb' : '#e6e6e6'}`, background: marcado ? '#eff6ff' : '#fff', cursor: 'pointer' }}>
                  <span style={{ width: 16, height: 16, borderRadius: 999, border: `2px solid ${marcado ? '#2563eb' : '#ccc'}`, background: marcado ? '#2563eb' : '#fff', flexShrink: 0, boxShadow: marcado ? 'inset 0 0 0 2px #fff' : 'none' }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: '#111' }}>{c.nome}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[c.telefone, c.email, empresaLabel(c) !== '—' ? empresaLabel(c) : ''].filter(Boolean).join(' · ') || 'sem outros dados'}</span>
                  </span>
                  {marcado && <span style={{ fontSize: 10.5, fontWeight: 800, color: '#2563eb', flexShrink: 0 }}>PRINCIPAL</span>}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => setMesclarAberto(false)} style={{ padding: '10px 16px', background: '#f0f0f0', border: 'none', borderRadius: 9, color: '#666', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={mesclar} disabled={mesclando} style={{ padding: '10px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: mesclando ? 'wait' : 'pointer' }}>{mesclando ? 'Mesclando…' : 'Mesclar'}</button>
          </div>
        </div>
      </div>
    )}
    </>
  )

  const toggleVista = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 4, background: '#f0f0f0', borderRadius: 9, padding: 3, width: 'fit-content' }}>
        {([['lista', 'Lista'], ['cards', 'Cards']] as const).map(([v, l]) => (
          <button key={v} onClick={() => setVista(v)} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: vista === v ? '#fff' : 'transparent', color: vista === v ? '#111' : '#888', boxShadow: vista === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{l}</button>
        ))}
      </div>
      {/* Busca — com a lista única (leads + pacientes) ela fica longa */}
      <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 380 }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', color: '#bbb', pointerEvents: 'none' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
        </span>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, telefone, e-mail…"
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 30px 8px 30px', borderRadius: 9, border: '1px solid #e6e6e6', fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }} />
        {busca && (
          <button onClick={() => setBusca('')} title="Limpar busca"
            style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px' }}>×</button>
        )}
      </div>
      {busca && <span style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>{contatos.length} de {contatosTodos.length}</span>}
      {podeExcluir && quebrados.length > 0 && (
        <button onClick={selecionarQuebrados} title="Seleciona os contatos com nome corrompido (importação de arquivo binário) para você conferir e excluir"
          style={{ padding: '6px 13px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
          Selecionar {quebrados.length} quebrado(s)
        </button>
      )}
    </div>
  )

  // Busca sem resultado: mantém a caixa na tela para o usuário corrigir o termo.
  const nadaEncontrado = contatos.length === 0 && (
    <div style={{ background: '#fff', borderRadius: 14, padding: '40px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <p style={{ margin: 0, fontSize: 13.5, color: '#888' }}>Nenhum contato encontrado para “{busca}”.</p>
    </div>
  )

  if (vista === 'cards') {
    return dz(
      <div>
        {toggleVista}
        {barraSel}
        {nadaEncontrado}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {contatos.map(c => {
            const nNeg = negocios.filter(n => n.contatoId === c.id).length
            const marcado = sel.has(c.id)
            return (
              <div key={c.id} style={{ position: 'relative', background: '#fff', borderRadius: 12, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: `1px solid ${marcado ? '#111' : '#eee'}`, cursor: 'pointer' }} onClick={() => onAbrir(c)}>
                <input type="checkbox" checked={marcado} onClick={e => e.stopPropagation()} onChange={() => toggle(c.id)} style={{ position: 'absolute', top: 12, right: 12, width: 16, height: 16, cursor: 'pointer' }} />
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#111', paddingRight: 22 }}>{c.nome}</p>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: '#888' }}>{empresaLabel(c)}</p>
                {c.areaAtuacao && <p style={{ margin: '0 0 4px', fontSize: 11.5, color: '#7c3aed', fontWeight: 600 }}>{c.areaAtuacao}</p>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {c.telefone && <span style={{ fontSize: 12, color: '#555' }}>{c.telefone}</span>}
                  {c.email && <span style={{ fontSize: 12, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</span>}
                </div>
                {nNeg > 0 && <span style={{ display: 'inline-block', marginTop: 8, fontSize: 10.5, fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', borderRadius: 999, padding: '2px 8px' }}>{nNeg} negócio(s)</span>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Vista LISTA (tabela) com seleção
  const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.03em', padding: '10px 12px', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { fontSize: 13, color: '#333', padding: '10px 12px', borderTop: '1px solid #f2f2f2' }
  return dz(
    <div>
      {toggleVista}
      {barraSel}
      {nadaEncontrado}
      {contatos.length > 0 && (
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #eee', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 40 }}><input type="checkbox" checked={todos} onChange={toggleTodos} style={{ width: 16, height: 16, cursor: 'pointer' }} title="Selecionar todos" /></th>
              <th style={th}>Nome</th>
              <th style={th}>Empresa</th>
              <th style={th}>Área de atuação</th>
              <th style={th}>Telefone</th>
              {!perfilClinica && <th style={th}>E-mail</th>}
              {perfilClinica && <th style={th}>Última interação</th>}
              {mostrarFrequencia && <th style={th}>Frequência</th>}
              <th style={{ ...th, textAlign: 'center' }}>Neg.</th>
            </tr>
          </thead>
          <tbody>
            {contatos.map(c => {
              const nNeg = negocios.filter(n => n.contatoId === c.id).length
              const marcado = sel.has(c.id)
              const ult = haQuanto(c.ultimoContato)
              return (
                <tr key={c.id} style={{ background: marcado ? '#fffbeb' : '#fff', cursor: 'pointer' }} onClick={() => onAbrir(c)}>
                  <td style={td} onClick={e => e.stopPropagation()}><input type="checkbox" checked={marcado} onChange={() => toggle(c.id)} style={{ width: 16, height: 16, cursor: 'pointer' }} /></td>
                  <td style={{ ...td, fontWeight: 700, color: '#111' }}>{c.nome}</td>
                  <td style={td}>{empresaLabel(c)}</td>
                  <td style={{ ...td, color: c.areaAtuacao ? '#7c3aed' : '#bbb' }}>{c.areaAtuacao || '—'}</td>
                  <td style={td}>{c.telefone || '—'}</td>
                  {!perfilClinica && <td style={{ ...td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email || '—'}</td>}
                  {perfilClinica && <td style={td}>{ult ? <span style={{ fontSize: 12, fontWeight: 700, color: ult.frio ? '#b91c1c' : '#666' }}>{ult.txt}{ult.frio ? ' · reabordar' : ''}</span> : <span style={{ color: '#ccc' }}>—</span>}</td>}
                  {mostrarFrequencia && (() => { const fq = labelFreq(c.id); return <td style={td}><span style={{ fontSize: 12, fontWeight: fq.forte ? 700 : 500, color: fq.forte ? '#166534' : '#ccc' }}>{fq.txt}</span></td> })()}
                  <td style={{ ...td, textAlign: 'center' }}>{nNeg > 0 ? <span style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', borderRadius: 999, padding: '2px 8px' }}>{nNeg}</span> : <span style={{ color: '#ccc' }}>—</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  )
}

const STATUS_AG: Record<string, { label: string; cor: string }> = {
  agendado: { label: 'Agendado', cor: '#1d4ed8' }, confirmado: { label: 'Confirmado', cor: '#166534' },
  atendido: { label: 'Atendido', cor: '#374151' }, faltou: { label: 'Faltou', cor: '#b91c1c' }, cancelado: { label: 'Cancelado', cor: '#9ca3af' },
}
// Tipos de toque de nutrição (linha do tempo do paciente/contato)
const TIPOS_INTER: { key: string; label: string; cor: string }[] = [
  { key: 'nota', label: 'Nota', cor: '#6b7280' }, { key: 'ligacao', label: 'Ligação', cor: '#1d4ed8' },
  { key: 'whatsapp', label: 'WhatsApp', cor: '#16a34a' }, { key: 'email', label: 'E-mail', cor: '#7c3aed' },
  { key: 'retorno', label: 'Retorno', cor: '#0891b2' }, { key: 'reabordagem', label: 'Reabordagem', cor: '#d97706' },
  { key: 'campanha', label: 'Campanha', cor: '#c026d3' }, { key: 'outro', label: 'Outro', cor: '#9ca3af' },
]
const interInfo = (k: string) => TIPOS_INTER.find(t => t.key === k) || TIPOS_INTER[0]
// Detecta nome "quebrado": lixo de um arquivo binário (.xlsx/.zip) importado como
// CSV. Serve para SELECIONAR esses contatos e apagar em massa com segurança
// (o usuário confere antes). Heurística: caractere de substituição, bytes de
// controle, assinatura ZIP "PK", ou alta proporção de caracteres estranhos.
function pareceQuebrado(nome: string): boolean {
  const s = (nome || '')
  if (!s.trim()) return true
  if (/�/.test(s)) return true                       // caractere de substituição (encoding quebrado)
  if (/[\x00-\x08\x0E-\x1F]/.test(s)) return true          // bytes de controle
  if (/PK[\x03\x04]/.test(s) || /\[Content_Types\]|xl\/(worksheets|metadata)/.test(s)) return true // assinatura de .xlsx/zip
  // Sem flag 'u' (alvo TS < es6): À-ÿ cobre letras acentuadas do pt-BR (Latin-1).
  const estranhos = (s.match(/[^a-zA-Z0-9À-ÿ\s.,'’&@()+/#º°ª-]/g) || []).length
  return estranhos / s.length > 0.3
}

// "há X dias/meses" — usado no indicador de última interação
function haQuanto(iso?: string): { txt: string; frio: boolean } | null {
  if (!iso) return null
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (isNaN(dias)) return null
  const frio = dias >= 90
  if (dias <= 0) return { txt: 'hoje', frio: false }
  if (dias === 1) return { txt: 'ontem', frio: false }
  if (dias < 30) return { txt: `há ${dias}d`, frio }
  const meses = Math.floor(dias / 30)
  return { txt: `há ${meses} ${meses === 1 ? 'mês' : 'meses'}`, frio }
}

// Importação em massa com PRÉVIA e mapeamento de colunas — o usuário confere
// antes de gravar, então dado errado não entra. Formato esperado é só um palpite;
// as colunas são remapeáveis.
function ImportarContatosModal({ linhas, tipo, perfilClinica, onClose, onImportado }: {
  linhas: string[][]; tipo?: string; perfilClinica: boolean; onClose: () => void; onImportado: () => void
}) {
  const CAMPOS: { k: string; label: string; req?: boolean }[] = perfilClinica
    ? [{ k: 'nome', label: 'Nome', req: true }, { k: 'telefone', label: 'Telefone' }, { k: 'email', label: 'E-mail' }, { k: 'nascimento', label: 'Nascimento' }, { k: 'etiquetas', label: 'Etiquetas' }]
    : [{ k: 'nome', label: 'Nome', req: true }, { k: 'telefone', label: 'Telefone' }, { k: 'email', label: 'E-mail' }, { k: 'empresa', label: 'Empresa' }, { k: 'cargo', label: 'Cargo' }]
  const nCols = Math.max(...linhas.map(l => l.length), 0)
  const cabDetectado = /nome/i.test((linhas[0] || []).join(' ')) && /(email|telefone|empresa|nascimento|celular|whats)/i.test((linhas[0] || []).join(' '))
  const [cab, setCab] = useState(cabDetectado)
  const [map, setMap] = useState<Record<string, number>>({})
  const [salvando, setSalvando] = useState(false)

  const PATS: Record<string, RegExp> = {
    nome: /nome|paciente|cliente/i, telefone: /tel|whats|fone|celular/i, email: /mail/i,
    nascimento: /nasc|aniver/i, etiquetas: /etiq|tag/i, empresa: /empresa|clinica|company/i, cargo: /cargo|fun[cç]/i,
  }
  useEffect(() => {
    const m: Record<string, number> = {}
    CAMPOS.forEach((c, i) => {
      let idx = -1
      if (cab && linhas[0]) idx = linhas[0].findIndex(h => PATS[c.k]?.test(h))
      if (idx < 0) idx = i < nCols ? i : -1 // posição como palpite
      m[c.k] = idx
    })
    setMap(m)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cab])

  const dados = cab ? linhas.slice(1) : linhas
  const val = (row: string[], k: string) => (map[k] >= 0 ? (row[map[k]] || '') : '')
  function normData(s: string): string {
    const br = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/)
    if (br) { const [, d, mo, y] = br; const yy = y.length === 2 ? '20' + y : y; return `${yy}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}` }
    const iso = s.match(/^\d{4}-\d{2}-\d{2}/)
    return iso ? s.slice(0, 10) : ''
  }
  function montarLote() {
    return dados.map(row => {
      const o: any = tipo ? { tipo } : {}
      for (const c of CAMPOS) {
        const v = val(row, c.k)
        if (!v) continue
        if (c.k === 'nascimento') { const nd = normData(v); if (nd) o.nascimento = nd }
        else if (c.k === 'etiquetas') o.etiquetas = v.split(/[;,|]/).map(x => x.trim()).filter(Boolean)
        else o[c.k] = v
      }
      return o
    }).filter(o => (o.nome || '').trim())
  }
  const validos = montarLote()

  async function importar() {
    if (map.nome === undefined || map.nome < 0) { toast('Escolha qual coluna é o Nome.', 'erro'); return }
    if (!validos.length) { toast('Nenhuma linha com nome preenchido.', 'erro'); return }
    setSalvando(true)
    const r = await fetch('/api/crm/contatos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lote: validos }) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (r?.ok) { toast(`${r.criados} ${perfilClinica ? 'paciente(s)/contato(s)' : 'contato(s)'} importado(s).`, 'sucesso'); onImportado() }
    else toast(r?.error || 'Falha ao importar.', 'erro')
  }

  const colOpts = Array.from({ length: nCols }, (_, i) => i)
  const th: React.CSSProperties = { textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#888', textTransform: 'uppercase', padding: '6px 8px', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { fontSize: 12, color: '#333', padding: '6px 8px', borderTop: '1px solid #f2f2f2', whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }

  return (
    <div onClick={fecharFora(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 720, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 16, color: '#111' }}>Importar {perfilClinica ? 'pacientes/contatos' : 'contatos'} — confira antes</h3>
        <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#888' }}>
          Formato sugerido (separado por ; ou vírgula): <b>{CAMPOS.map(c => c.label).join(' · ')}</b>. Se a ordem do seu arquivo for outra, ajuste o mapa abaixo — a prévia mostra como vai ficar.
        </p>

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, color: '#333', fontWeight: 600, marginBottom: 14 }}>
          <input type="checkbox" checked={cab} onChange={e => setCab(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
          A primeira linha é cabeçalho (ignorar na importação)
        </label>

        {/* Mapa de colunas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 16 }}>
          {CAMPOS.map(c => (
            <div key={c.k}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: c.req ? '#b45309' : '#888', marginBottom: 4 }}>{c.label}{c.req ? ' *' : ''}</label>
              <select value={map[c.k] ?? -1} onChange={e => setMap(m => ({ ...m, [c.k]: Number(e.target.value) }))} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 8px', borderRadius: 8, border: `1.5px solid ${c.req && (map[c.k] ?? -1) < 0 ? '#fca5a5' : '#e0e0e0'}`, fontSize: 12, fontFamily: 'inherit', background: '#fff' }}>
                <option value={-1}>—</option>
                {colOpts.map(i => <option key={i} value={i}>{cab && linhas[0]?.[i] ? linhas[0][i] : `Coluna ${i + 1}`}</option>)}
              </select>
            </div>
          ))}
        </div>

        {/* Prévia */}
        <div style={{ border: '1px solid #eee', borderRadius: 10, overflowX: 'auto', marginBottom: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{CAMPOS.map(c => <th key={c.k} style={th}>{c.label}</th>)}</tr></thead>
            <tbody>
              {dados.slice(0, 6).map((row, ri) => (
                <tr key={ri}>
                  {CAMPOS.map(c => {
                    const v = val(row, c.k)
                    const show = c.k === 'nascimento' ? (normData(v) || (v ? `? ${v}` : '')) : v
                    return <td key={c.k} style={{ ...td, color: c.k === 'nome' && !v ? '#dc2626' : '#333' }}>{show || <span style={{ color: '#ccc' }}>—</span>}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: '#888' }}>
          {validos.length} de {dados.length} linha(s) serão importadas{dados.length > validos.length ? ` (${dados.length - validos.length} sem nome serão ignoradas)` : ''}
          {perfilClinica && tipo ? ` · entram como ${tipo === 'paciente' ? 'Paciente' : 'Lead'}` : ''}.
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 16px', background: '#f0f0f0', border: 'none', borderRadius: 10, color: '#666', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={importar} disabled={salvando || !validos.length} style={{ padding: '10px 18px', background: validos.length ? '#111' : '#f0f0f0', color: validos.length ? '#fff' : '#aaa', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: validos.length ? 'pointer' : 'not-allowed' }}>{salvando ? 'Importando…' : `Importar ${validos.length}`}</button>
        </div>
      </div>
    </div>
  )
}

// `prefill` só vale na criação (contato null) — é como o inbox abre a ficha já
// com o telefone e o nome que vieram do WhatsApp. `onSalvo` devolve o contato
// recém-criado para quem precisa do id (o inbox vincula a conversa a ele).
// Abordagem em série: dispara a PRIMEIRA mensagem sem sair da lista de contatos.
// Ir para a aba Mensagens a cada contato obrigava a voltar, achar onde parou e
// abrir o próximo — o trabalho é percorrer a lista, não conversar (para
// conversar existe "Abrir conversa completa" aqui dentro).
function AbordagemModal({ contato, podeEditar, onClose, onAbrirConversa, onAbrirOportunidade }: {
  contato: Contato
  podeEditar: boolean
  onClose: () => void
  onAbrirConversa: (telefone: string, contatoId?: string) => void
  onAbrirOportunidade?: (contatoId: string) => void
}) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [templates, setTemplates] = useState<{ id: string; titulo: string; texto: string }[]>([])
  useEffect(() => {
    fetch('/api/crm/msg-templates').then(r => r.json()).then(d => { if (Array.isArray(d?.templates)) setTemplates(d.templates) }).catch(() => {})
  }, [])

  const tel = telefoneWhatsApp(contato.telefone)
  const primeiro = (contato.nome || '').trim().split(/\s+/)[0] || ''
  // Mesmos placeholders do inbox: abordagem em série é o mesmo script com o nome trocado.
  const aplicar = (t: string) => t.replace(/\{nome\}/gi, contato.nome || '').replace(/\{primeiro\}/gi, primeiro)

  async function enviar() {
    if (!texto.trim() || !tel || enviando) return
    setEnviando(true)
    const r = await fetch('/api/crm/mensagens', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefone: tel, texto: texto.trim() }),
    }).then(x => x.json()).catch(() => ({ error: 'Erro de conexão' }))
    // Vincula mesmo quando o envio falha: o número é dele de qualquer jeito.
    await fetch('/api/crm/mensagens', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefone: tel, contatoId: contato.id }),
    }).catch(() => {})
    setEnviando(false)
    if (r?.error) { toast(r.error, 'erro'); return }
    toast(`Mensagem enviada para ${primeiro || contato.nome}.`, 'sucesso')
    onClose()
  }

  return (
    <div onClick={fecharFora(onClose, { temAlteracoes: () => !!texto.trim() })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 460, width: '100%', padding: 22 }}>
        <h3 style={{ margin: '0 0 2px', fontSize: 16, color: '#111' }}>Abordar {contato.nome}</h3>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: '#999' }}>
          {tel ? `WhatsApp +${tel}` : 'Contato sem telefone válido — corrija o número na ficha (com DDD).'}
        </p>

        {tel && (<>
          {templates.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {templates.slice(0, 6).map(t => (
                <button key={t.id} onClick={() => setTexto(prev => (prev.trim() ? prev.replace(/\s*$/, '') + '\n' : '') + aplicar(t.texto))}
                  style={{ padding: '5px 10px', background: '#f4f4f5', border: '1px solid #e5e7eb', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: '#444', cursor: 'pointer' }}>{t.titulo}</button>
              ))}
            </div>
          )}
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={5} autoFocus
            placeholder={`Primeira mensagem para ${primeiro || 'o contato'}...`}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
        </>)}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14, flexWrap: 'wrap' }}>
          <button onClick={onClose} style={{ padding: '9px 14px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Fechar</button>
          {podeEditar && onAbrirOportunidade && (
            <button onClick={() => onAbrirOportunidade(contato.id)}
              style={{ padding: '9px 14px', background: '#fff', color: '#111', border: '1.5px solid #111', borderRadius: 9, fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>Nova oportunidade</button>
          )}
          {tel && (<>
            <button onClick={() => onAbrirConversa(tel, contato.id)} title="Ver o histórico e conversar na aba Mensagens"
              style={{ padding: '9px 14px', background: '#fff', color: '#166534', border: '1.5px solid #bbf7d0', borderRadius: 9, fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>Abrir conversa</button>
            <button onClick={enviar} disabled={!texto.trim() || enviando}
              style={{ padding: '9px 18px', background: texto.trim() && !enviando ? '#25D366' : '#e5e7eb', color: texto.trim() && !enviando ? '#fff' : '#aaa', border: 'none', borderRadius: 9, fontWeight: 800, fontSize: 12.5, cursor: texto.trim() && !enviando ? 'pointer' : 'not-allowed' }}>
              {enviando ? 'Enviando...' : 'Enviar'}
            </button>
          </>)}
        </div>
      </div>
    </div>
  )
}

function ContatoModal({ contato, prefill, onClose, onSalvo, podeExcluir = false, perfilClinica = false, perfilTurismo = false, tipoPadrao = 'paciente', onAgendar, onAbrirWhatsApp, onAbrirOportunidade }: { contato: Contato | null; prefill?: { nome?: string; telefone?: string }; onClose: () => void; onSalvo: (criado?: Contato) => void; podeExcluir?: boolean; perfilClinica?: boolean; perfilTurismo?: boolean; tipoPadrao?: string; onAgendar?: (p: { pacienteNome: string; pacienteTelefone?: string; contatoId?: string }) => void; onAbrirWhatsApp?: (telefone: string, contatoId?: string) => void; onAbrirOportunidade?: (contatoId: string) => void }) {
  const [f, setF] = useState<any>({ nome: contato?.nome || prefill?.nome || '', empresa: (contato as any)?.empresa || '', profissionalAutonomo: !!(contato as any)?.profissionalAutonomo, areaAtuacao: (contato as any)?.areaAtuacao || '', telefone: contato?.telefone || prefill?.telefone || '', email: contato?.email || '', cargo: (contato as any)?.cargo || '', observacoes: (contato as any)?.observacoes || '', tipo: contato?.tipo || (perfilClinica ? tipoPadrao : perfilTurismo ? (contato?.tipo || 'lead') : ''), nascimento: contato?.nascimento || '', ultimoProcedimento: (contato as any)?.ultimoProcedimento || '', nuncaVeio: !!(contato as any)?.nuncaVeio, preferenciasViagem: contato?.preferenciasViagem || '', etiquetasTxt: (contato?.etiquetas || []).join(', '), ativo: contato?.ativo !== false })
  const [salvando, setSalvando] = useState(false)
  // Histórico de atendimentos do paciente (da Agenda — perfil clínica, só ao editar)
  const [historico, setHistorico] = useState<{ id: string; dataInicio: string; servico?: string; status: string; profissionalNome: string; registroAtendimento?: string; procedimentosRealizados?: string[]; valorInvestido?: number }[] | null>(null)
  // Catálogo de Procedimentos (mesma fonte da Agenda) para sugerir no campo.
  const [procedimentos, setProcedimentos] = useState<string[]>([])
  useEffect(() => {
    if (!perfilClinica) return
    fetch('/api/procedimentos').then(r => r.json())
      .then(d => setProcedimentos(Array.isArray(d?.procedimentos) ? d.procedimentos.map((p: any) => p.nome).filter(Boolean) : []))
      .catch(() => {})
  }, [perfilClinica])
  useEffect(() => {
    if (!perfilClinica || !contato?.id) return
    fetch(`/api/agenda?contatoId=${contato.id}`).then(r => r.json())
      .then(d => setHistorico(Array.isArray(d?.agendamentos) ? d.agendamentos : []))
      .catch(() => setHistorico([]))
  }, [perfilClinica, contato?.id])
  const fmtBRL = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  // Conversa de WhatsApp do contato — entra no histórico agregada por dia
  // ("3 mensagens trocadas"), senão a timeline viraria um chat.
  const [msgsDias, setMsgsDias] = useState<{ dia: string; total: number; recebidas: number; ultima: string }[]>([])
  useEffect(() => {
    const tel = (contato?.telefone || '').replace(/\D/g, '')
    if (!perfilClinica || !tel) { setMsgsDias([]); return }
    fetch(`/api/crm/mensagens?tel=${tel}`).then(r => r.json()).then(d => {
      const msgs: any[] = Array.isArray(d?.mensagens) ? d.mensagens : []
      const porDia = new Map<string, { dia: string; total: number; recebidas: number; ultima: string }>()
      for (const m of msgs) {
        const dia = String(m.em).slice(0, 10)
        const a = porDia.get(dia) || { dia, total: 0, recebidas: 0, ultima: m.em }
        a.total++; if (m.de === 'cliente') a.recebidas++
        if (new Date(m.em) > new Date(a.ultima)) a.ultima = m.em
        porDia.set(dia, a)
      }
      setMsgsDias(Array.from(porDia.values()))
    }).catch(() => setMsgsDias([]))
  }, [perfilClinica, contato?.telefone])

  // Toques manuais antigos: seguem VISÍVEIS no histórico (dado real já registrado),
  // mas o registro novo é feito no CRM — a ficha é só leitura da linha do tempo.
  const [interacoes, setInteracoes] = useState<Interacao[]>(contato?.historico || [])
  async function removerToque(interacaoId: string) {
    if (!contato?.id) return
    const r = await fetch('/api/crm/contatos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: contato.id, removerInteracao: interacaoId }) }).then(x => x.json()).catch(() => null)
    if (r?.ok) setInteracoes(r.contato.historico || [])
  }
  // Próximos passos (jornada futura): "o que fazer e daqui quanto tempo".
  // Cada passo vira uma Tarefa para a equipe na data (o servidor cria/conclui/remove junto).
  const [passos, setPassos] = useState<{ id: string; titulo: string; quando: string; feito?: boolean }[]>(((contato as any)?.proximosPassos) || [])
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const hojeYmd = ymd(new Date())
  const [novoPasso, setNovoPasso] = useState({ titulo: '', quando: '' })
  const [addPassoBusy, setAddPassoBusy] = useState(false)
  const diasAte = (d: string) => Math.round((new Date(d + 'T00:00').getTime() - new Date(new Date().toDateString()).getTime()) / 86400000)
  // Atalhos: o caso comum é "retorno em X" — evita abrir o calendário à toa.
  const emDias = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d) }
  async function addPasso() {
    if (!contato?.id || !novoPasso.titulo.trim() || !novoPasso.quando || addPassoBusy) return
    setAddPassoBusy(true)
    const r = await fetch('/api/crm/contatos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: contato.id, novoPasso: { titulo: novoPasso.titulo, quando: novoPasso.quando } }) }).then(x => x.json()).catch(() => null)
    setAddPassoBusy(false)
    if (r?.ok) { setPassos(r.contato.proximosPassos || []); setNovoPasso({ titulo: '', quando: '' }); toast('Abordagem agendada — o comercial foi avisado.', 'sucesso') }
    else toast(r?.error || 'Falha ao agendar a abordagem.', 'erro')
  }
  async function togglePasso(passoId: string) {
    if (!contato?.id) return
    const r = await fetch('/api/crm/contatos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: contato.id, togglePasso: passoId }) }).then(x => x.json()).catch(() => null)
    if (r?.ok) setPassos(r.contato.proximosPassos || [])
  }
  async function removerPasso(passoId: string) {
    if (!contato?.id) return
    const r = await fetch('/api/crm/contatos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: contato.id, removerPasso: passoId }) }).then(x => x.json()).catch(() => null)
    if (r?.ok) setPassos(r.contato.proximosPassos || [])
  }
  const passosOrdenados = [...passos].sort((a, b) => (a.feito ? 1 : 0) - (b.feito ? 1 : 0) || a.quando.localeCompare(b.quando))
  // HISTÓRICO completo do contato, montado sozinho de tudo que aconteceu:
  // criação, atendimentos (com procedimentos e valor), conversas de WhatsApp,
  // abordagens programadas/feitas e os toques manuais antigos. Recente primeiro.
  const timeline = [
    ...interacoes.map(i => ({ id: i.id, data: i.data, kind: 'toque' as const, i })),
    ...(historico || []).map(h => ({ id: h.id, data: h.dataInicio, kind: 'agenda' as const, h })),
    ...msgsDias.map(w => ({ id: `wa-${w.dia}`, data: w.ultima, kind: 'whatsapp' as const, w })),
    ...passos.map(p => ({ id: `passo-${p.id}`, data: `${p.quando}T09:00:00`, kind: 'passo' as const, p })),
    ...(contato?.criadoEm ? [{ id: 'criado', data: contato.criadoEm, kind: 'criado' as const }] : []),
  ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
  // Frequência: a partir dos atendimentos CONCLUÍDOS do paciente
  const freq = frequenciaPaciente((historico || []).filter(h => h.status === 'atendido').map(h => h.dataInicio))

  function corpoDoForm() {
    const { etiquetasTxt, ...resto } = f
    return { ...resto, etiquetas: String(etiquetasTxt || '').split(',').map((s: string) => s.trim()).filter(Boolean), tipo: f.tipo || undefined }
  }

  async function salvar() {
    if (!f.nome.trim()) return
    setSalvando(true)
    const corpo = corpoDoForm()
    let criado: Contato | undefined
    if (contato?.id) await fetch('/api/crm/contatos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: contato.id, ...corpo }) }).catch(() => {})
    else criado = await fetch('/api/crm/contatos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }).then(x => x.json()).then(d => d?.contato).catch(() => undefined)
    setSalvando(false); onSalvo(criado)
  }

  // Os atalhos do topo (WhatsApp / Oportunidade) SAEM da ficha. Salvam antes de
  // ir: quem corrigiu o telefone e clicou em WhatsApp perderia a correção — e
  // ainda abriria a conversa do número velho.
  async function salvarEIr(ir: () => void) {
    if (contato?.id && f.nome.trim()) {
      setSalvando(true)
      await fetch('/api/crm/contatos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: contato.id, ...corpoDoForm() }) }).catch(() => {})
      setSalvando(false)
    }
    ir()
  }
  async function excluir() {
    if (!contato?.id || !(await confirmar('Excluir este contato?', { titulo: 'Excluir contato', okLabel: 'Excluir', perigo: true }))) return
    await fetch(`/api/crm/contatos?id=${contato.id}`, { method: 'DELETE' }).catch(() => {})
    onSalvo()
  }
  return (
    <div onClick={fecharFora(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 440, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#111', flex: 1, minWidth: 140 }}>{contato ? (perfilClinica ? (contato.tipo === 'paciente' ? 'Editar paciente' : 'Editar contato') : 'Editar contato') : (perfilClinica ? (tipoPadrao === 'paciente' ? 'Novo paciente' : 'Novo contato') : 'Novo contato')}</h3>
          {/* Atalhos só na ficha JÁ SALVA: a oportunidade precisa do id do contato,
              e a conversa precisa do telefone. Em contato novo eles não existem. */}
          {contato && String(f.telefone || '').trim() && onAbrirWhatsApp && (
            <button onClick={() => salvarEIr(() => onAbrirWhatsApp(f.telefone, contato.id))} disabled={salvando} title="Abrir a conversa no WhatsApp (Mensagens do CRM)"
              style={{ padding: '7px 14px', background: '#25D366', color: '#fff', border: 'none', borderRadius: 999, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>WhatsApp</button>
          )}
          {contato && onAbrirOportunidade && (
            <button onClick={() => salvarEIr(() => onAbrirOportunidade(contato.id))} disabled={salvando} title="Abrir uma oportunidade no funil para este contato"
              style={{ padding: '7px 14px', background: '#fff', color: '#111', border: '1.5px solid #111', borderRadius: 999, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>Oportunidade</button>
          )}
          {perfilClinica && contato && onAgendar && (
            <button onClick={() => onAgendar({ pacienteNome: contato.nome, pacienteTelefone: contato.telefone, contatoId: contato.id })}
              style={{ padding: '7px 14px', background: '#111', color: '#fff', border: 'none', borderRadius: 999, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>Agendar</button>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label style={labelStyle}>Nome *</label><input value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} style={inputStyle} /></div>
          {perfilClinica && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={labelStyle}>Tipo</label>
                <select value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })} style={{ ...inputStyle, background: '#fff' }}>
                  <option value="paciente">Paciente</option><option value="lead">Lead</option><option value="profissional">Profissional</option><option value="fornecedor">Fornecedor</option><option value="outro">Outro</option>
                </select>
              </div>
              <div><label style={labelStyle}>Nascimento</label><input type="date" value={f.nascimento} onChange={e => setF({ ...f, nascimento: e.target.value })} style={inputStyle} /></div>
            </div>
          )}
          {perfilClinica || perfilTurismo ? (
            // Clínica e turismo: sem empresa/área/cargo/autônomo — a venda é para pessoa física
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={labelStyle}>WhatsApp / telefone</label><input value={f.telefone} onChange={e => setF({ ...f, telefone: e.target.value })} placeholder="+55..." style={inputStyle} /></div>
              <div><label style={labelStyle}>E-mail</label><input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} style={inputStyle} /></div>
              {perfilTurismo && <div><label style={labelStyle}>Nascimento</label><input type="date" value={f.nascimento} onChange={e => setF({ ...f, nascimento: e.target.value })} style={inputStyle} /></div>}
              {perfilTurismo && <div><label style={labelStyle}>Etiquetas (vírgula)</label><input value={f.etiquetasTxt} onChange={e => setF({ ...f, etiquetasTxt: e.target.value })} placeholder="Ex: VIP, grupo igreja" style={inputStyle} /></div>}
            </div>
          ) : (<>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#333', fontWeight: 600 }}>
              <input type="checkbox" checked={f.profissionalAutonomo} onChange={e => setF({ ...f, profissionalAutonomo: e.target.checked, empresa: e.target.checked ? '' : f.empresa })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              Profissional Autônomo (sem empresa)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={labelStyle}>Empresa</label><input value={f.empresa} disabled={f.profissionalAutonomo} onChange={e => setF({ ...f, empresa: e.target.value })} placeholder={f.profissionalAutonomo ? 'Autônomo' : ''} style={{ ...inputStyle, background: f.profissionalAutonomo ? '#f5f5f5' : '#fff', color: f.profissionalAutonomo ? '#aaa' : '#111' }} /></div>
              <div><label style={labelStyle}>Área de atuação</label><input value={f.areaAtuacao} onChange={e => setF({ ...f, areaAtuacao: e.target.value })} placeholder="Ex: Odontologia, Advocacia..." style={inputStyle} /></div>
              <div><label style={labelStyle}>Cargo</label><input value={f.cargo} onChange={e => setF({ ...f, cargo: e.target.value })} style={inputStyle} /></div>
              <div><label style={labelStyle}>WhatsApp / telefone</label><input value={f.telefone} onChange={e => setF({ ...f, telefone: e.target.value })} placeholder="+55..." style={inputStyle} /></div>
              <div><label style={labelStyle}>E-mail</label><input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} style={inputStyle} /></div>
            </div>
          </>)}
          {perfilClinica && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
              <div><label style={labelStyle}>Etiquetas (separadas por vírgula)</label><input value={f.etiquetasTxt} onChange={e => setF({ ...f, etiquetasTxt: e.target.value })} placeholder="Ex: botox, avaliação, VIP" style={inputStyle} /></div>
              {contato && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#333', fontWeight: 600, paddingBottom: 10 }}>
                  <input type="checkbox" checked={f.ativo} onChange={e => setF({ ...f, ativo: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                  Ativo
                </label>
              )}
            </div>
          )}
          {perfilClinica && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
              <div>
                <label style={labelStyle}>Último procedimento</label>
                {/* À mão porque a base veio de outro sistema: o histórico da
                    Agenda só existe para quem foi atendido AQUI. A lista sugere
                    o catálogo de Procedimentos (o mesmo da Agenda), mas aceita
                    texto livre — procedimento antigo pode nem estar no catálogo. */}
                <input list="lista-procedimentos" value={f.ultimoProcedimento} disabled={f.nuncaVeio}
                  onChange={e => setF({ ...f, ultimoProcedimento: e.target.value })}
                  placeholder={f.nuncaVeio ? 'Nunca veio à clínica' : 'Ex.: Botox, Preenchimento labial...'}
                  style={{ ...inputStyle, background: f.nuncaVeio ? '#f7f7f7' : '#fff', color: f.nuncaVeio ? '#aaa' : '#111' }} />
                <datalist id="lista-procedimentos">
                  {procedimentos.map(p => <option key={p} value={p} />)}
                </datalist>
              </div>
              {/* "Nunca veio" é a resposta honesta para lead que nunca sentou na
                  cadeira: sem ela, campo vazio é ambíguo — nunca veio, ou
                  ninguém anotou? Marcar limpa o campo (não pode dizer os dois). */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#333', fontWeight: 600, paddingBottom: 10, whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={!!f.nuncaVeio}
                  onChange={e => setF({ ...f, nuncaVeio: e.target.checked, ...(e.target.checked ? { ultimoProcedimento: '' } : {}) })}
                  style={{ width: 16, height: 16, cursor: 'pointer' }} />
                Nunca veio
              </label>
            </div>
          )}
          {perfilTurismo && (
            <div>
              <label style={labelStyle}>Preferências e desejos de viagem</label>
              <textarea value={f.preferenciasViagem} onChange={e => setF({ ...f, preferenciasViagem: e.target.value })} placeholder="Destinos dos sonhos, tipo de viagem (praia/serra), leito, época preferida... vira oportunidade futura" style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} />
            </div>
          )}
          <div><label style={labelStyle}>Observações</label><textarea value={f.observacoes} onChange={e => setF({ ...f, observacoes: e.target.value })} style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} /></div>

          {perfilClinica && contato?.id && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Histórico e nutrição</label>
                {freq.total > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#166534', background: '#dcfce7', borderRadius: 999, padding: '3px 10px' }}>
                    {freq.total} atendimento{freq.total > 1 ? 's' : ''}{freq.mediaDias != null ? ` · a cada ~${freq.mediaDias} dias` : ''}
                  </span>
                )}
              </div>
              {/* Próximos passos — jornada futura do paciente (cada passo vira tarefa) */}
              <div style={{ margin: '10px 0 12px', background: '#f8faff', border: '1px solid #e3eaff', borderRadius: 10, padding: 10 }}>
                <label style={{ ...labelStyle, marginBottom: 6 }}>Próximas abordagens (jornada)</label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input value={novoPasso.titulo} onChange={e => setNovoPasso(p => ({ ...p, titulo: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addPasso() }}
                    placeholder="O que fazer (ex.: Retorno de avaliação)" style={{ ...inputStyle, flex: 1, minWidth: 170 }} />
                  {/* Data exata — o comercial é avisado na semana e no dia */}
                  <input type="date" value={novoPasso.quando} min={hojeYmd} onChange={e => setNovoPasso(p => ({ ...p, quando: e.target.value }))}
                    style={{ ...inputStyle, width: 150, flexShrink: 0, color: novoPasso.quando ? '#111' : '#999' }} />
                  <button onClick={addPasso} disabled={addPassoBusy || !novoPasso.titulo.trim() || !novoPasso.quando}
                    title={!novoPasso.quando ? 'Escolha a data da abordagem' : 'Agendar abordagem'}
                    style={{ padding: '9px 14px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: novoPasso.titulo.trim() && novoPasso.quando ? 1 : 0.5, flexShrink: 0 }}>+</button>
                </div>
                {/* Atalhos de data (o caso comum é "retorno em X") */}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: passosOrdenados.length ? 8 : 0 }}>
                  {([['7 dias', 7], ['15 dias', 15], ['30 dias', 30], ['60 dias', 60], ['90 dias', 90]] as [string, number][]).map(([lab, n]) => {
                    const d = emDias(n)
                    const ativo = novoPasso.quando === d
                    return (
                      <button key={n} type="button" onClick={() => setNovoPasso(p => ({ ...p, quando: d }))}
                        style={{ padding: '3px 10px', borderRadius: 999, border: `1px solid ${ativo ? '#1d4ed8' : '#dbe3f0'}`, background: ativo ? '#dbeafe' : '#fff', color: ativo ? '#1d4ed8' : '#77839a', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{lab}</button>
                    )
                  })}
                </div>
                {passosOrdenados.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {passosOrdenados.map(p => {
                      const n = diasAte(p.quando)
                      const prazoTxt = p.feito ? '' : n > 0 ? `em ${n}d` : n === 0 ? 'hoje' : `atrasado ${-n}d`
                      return (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 2px' }}>
                          <button onClick={() => togglePasso(p.id)} title={p.feito ? 'Reabrir' : 'Concluir'}
                            style={{ width: 16, height: 16, borderRadius: 5, border: p.feito ? 'none' : '1.5px solid #cbd5e1', background: p.feito ? '#16a34a' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>
                            {p.feito && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                          </button>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', flexShrink: 0 }}>{new Date(p.quando + 'T00:00').toLocaleDateString('pt-BR')}</span>
                          {prazoTxt && <span style={{ fontSize: 10.5, fontWeight: 700, color: n < 0 ? '#b91c1c' : '#94a3b8', flexShrink: 0 }}>{prazoTxt}</span>}
                          <span style={{ flex: 1, fontSize: 12.5, color: p.feito ? '#9ca3af' : '#333', textDecoration: p.feito ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.titulo}</span>
                          {podeExcluir && <button onClick={() => removerPasso(p.id)} title="Remover" style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 15, lineHeight: 1, flexShrink: 0 }}>×</button>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              {/* O histórico é AUTOMÁTICO (criação, atendimentos, WhatsApp, abordagens).
                  Registro manual de toque vive no CRM, não na ficha. */}
              {timeline.length === 0
                ? <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>Sem histórico ainda. Atendimentos, mensagens e abordagens aparecem aqui automaticamente.</p>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 260, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 10 }}>
                    {timeline.map(item => item.kind === 'criado' ? (
                      <div key={item.id} style={{ padding: '7px 10px', borderBottom: '1px solid #f6f6f6', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: '#6b7280', background: '#f3f4f6', borderRadius: 4, padding: '2px 5px', flexShrink: 0 }}>INÍCIO</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#111', flexShrink: 0 }}>{new Date(item.data).toLocaleDateString('pt-BR')}</span>
                        <span style={{ flex: 1, fontSize: 12, color: '#666' }}>Contato criado</span>
                      </div>
                    ) : item.kind === 'whatsapp' ? (
                      <div key={item.id} style={{ padding: '7px 10px', borderBottom: '1px solid #f6f6f6', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: '#166534', background: '#dcfce7', borderRadius: 4, padding: '2px 5px', flexShrink: 0 }}>WHATSAPP</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#111', flexShrink: 0 }}>{new Date(item.data).toLocaleDateString('pt-BR')}</span>
                        <span style={{ flex: 1, fontSize: 12, color: '#666' }}>
                          {item.w.total} mensage{item.w.total > 1 ? 'ns' : 'm'} · {item.w.recebidas} recebida{item.w.recebidas === 1 ? '' : 's'}
                        </span>
                      </div>
                    ) : item.kind === 'passo' ? (
                      <div key={item.id} style={{ padding: '7px 10px', borderBottom: '1px solid #f6f6f6', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: item.p.feito ? '#166534' : '#1d4ed8', background: item.p.feito ? '#dcfce7' : '#dbeafe', borderRadius: 4, padding: '2px 5px', flexShrink: 0 }}>{item.p.feito ? 'FEITO' : 'ABORDAGEM'}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#111', flexShrink: 0 }}>{new Date(item.p.quando + 'T00:00').toLocaleDateString('pt-BR')}</span>
                        <span style={{ flex: 1, fontSize: 12, color: item.p.feito ? '#9ca3af' : '#444', textDecoration: item.p.feito ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.p.titulo}</span>
                      </div>
                    ) : item.kind === 'agenda' ? (
                      <div key={item.id} style={{ padding: '7px 10px', borderBottom: '1px solid #f6f6f6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 9, fontWeight: 800, color: '#374151', background: '#e5e7eb', borderRadius: 4, padding: '2px 5px', flexShrink: 0 }}>AGENDA</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#111', flexShrink: 0 }}>{new Date(item.h.dataInicio).toLocaleDateString('pt-BR')}</span>
                          <span style={{ flex: 1, fontSize: 12, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.h.servico || '—'} · {(item.h.profissionalNome || '').split(' ')[0]}</span>
                          <span style={{ fontSize: 10.5, fontWeight: 800, color: (STATUS_AG[item.h.status] || STATUS_AG.agendado).cor, flexShrink: 0 }}>{(STATUS_AG[item.h.status] || STATUS_AG.agendado).label}</span>
                        </div>
                        {item.h.registroAtendimento && <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#555', background: '#fafafa', borderRadius: 6, padding: '5px 8px', whiteSpace: 'pre-wrap' }}>{item.h.registroAtendimento}</p>}
                        {Array.isArray(item.h.procedimentosRealizados) && item.h.procedimentosRealizados.length > 0 && (
                          <p style={{ margin: '4px 0 0', fontSize: 11, fontWeight: 700, color: '#166534' }}>
                            {item.h.procedimentosRealizados.join(' · ')}{item.h.valorInvestido ? ` — ${fmtBRL(item.h.valorInvestido)}` : ''}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div key={item.id} style={{ padding: '7px 10px', borderBottom: '1px solid #f6f6f6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', background: interInfo(item.i.tipo).cor, borderRadius: 4, padding: '2px 5px', flexShrink: 0 }}>{interInfo(item.i.tipo).label.toUpperCase()}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#111', flexShrink: 0 }}>{new Date(item.i.data).toLocaleDateString('pt-BR')}</span>
                          <span style={{ flex: 1, fontSize: 12, color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.i.texto}</span>
                          {podeExcluir && <button onClick={() => removerToque(item.i.id)} title="Remover" style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 15, lineHeight: 1, flexShrink: 0 }}>×</button>}
                        </div>
                        {item.i.autor && <p style={{ margin: '2px 0 0 34px', fontSize: 10.5, color: '#aaa' }}>{item.i.autor}</p>}
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={salvar} disabled={salvando || !f.nome.trim()} style={{ flex: 1, padding: '11px 0', background: f.nome.trim() ? '#ffc00f' : '#f0f0f0', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: f.nome.trim() ? 'pointer' : 'not-allowed' }}>{salvando ? 'Salvando...' : contato ? 'Salvar' : 'Criar contato'}</button>
          {contato && podeExcluir && <button onClick={excluir} style={{ padding: '11px 16px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Excluir</button>}
          <button onClick={onClose} style={{ padding: '11px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function PipelinesModal({ pipelines, podeExcluir = false, onClose, onMudou }: { pipelines: { id: string; nome: string; ordem: number }[]; podeExcluir?: boolean; onClose: () => void; onMudou: () => void }) {
  const [novo, setNovo] = useState('')
  const [editId, setEditId] = useState('')
  const [editNome, setEditNome] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function criar() {
    if (!novo.trim()) return
    setSalvando(true)
    const r = await fetch('/api/crm/pipelines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: novo.trim() }) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (r?.ok) { setNovo(''); toast('Pipeline criado.', 'sucesso'); onMudou() } else toast(r?.error || 'Falha ao criar.', 'erro')
  }
  async function renomear(id: string) {
    if (!editNome.trim()) return
    const r = await fetch('/api/crm/pipelines', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, nome: editNome.trim() }) }).then(x => x.json()).catch(() => null)
    if (r?.ok) { setEditId(''); onMudou() } else toast(r?.error || 'Falha ao renomear.', 'erro')
  }
  async function excluir(id: string, nome: string) {
    if (!(await confirmar(`Excluir o pipeline "${nome}"? As oportunidades dele serão movidas para outro pipeline.`, { titulo: 'Excluir pipeline', okLabel: 'Excluir', perigo: true }))) return
    const r = await fetch(`/api/crm/pipelines?id=${id}`, { method: 'DELETE' }).then(x => x.json()).catch(() => null)
    if (r?.ok) { toast('Pipeline excluído.', 'sucesso'); onMudou() } else toast(r?.error || 'Falha ao excluir.', 'erro')
  }

  return (
    <div onClick={fecharFora(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#111' }}>Pipelines</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#999' }}>Crie funis separados (ex.: Marketing, +Clínicas, Mentoria). Cada um tem suas etapas.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {pipelines.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f7f7f7', borderRadius: 10, padding: '8px 12px' }}>
              {editId === p.id ? (
                <>
                  <input value={editNome} onChange={e => setEditNome(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') renomear(p.id) }} style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={() => renomear(p.id)} style={{ padding: '7px 12px', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Salvar</button>
                  <button onClick={() => setEditId('')} style={{ padding: '7px 10px', background: 'none', color: '#888', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: '#111' }}>{p.nome}</span>
                  <button onClick={() => { setEditId(p.id); setEditNome(p.nome) }} style={{ padding: '6px 10px', background: '#fff', color: '#444', border: '1px solid #e0e0e0', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Renomear</button>
                  {podeExcluir && pipelines.length > 1 && <button onClick={() => excluir(p.id, p.nome)} style={{ padding: '6px 10px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Excluir</button>}
                </>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={novo} onChange={e => setNovo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') criar() }} placeholder="Nome do novo pipeline (ex.: Marketing)" style={{ ...inputStyle, flex: 1 }} />
          <button onClick={criar} disabled={!novo.trim() || salvando} style={{ padding: '10px 16px', background: novo.trim() ? 'var(--marca, #ffc00f)' : '#f0f0f0', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: novo.trim() ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>{salvando ? '...' : '+ Criar'}</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '10px 18px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

function EtapasModal({ pipelineId, pipelineNome, estagios, onClose, onMudou }: { pipelineId: string; pipelineNome: string; estagios: Estagio[]; onClose: () => void; onMudou: () => void }) {
  type Item = { id: string; nome: string; ganho?: boolean; perdido?: boolean }
  const [lista, setLista] = useState<Item[]>(() => estagios.map(e => ({ id: e.id, nome: e.nome, ganho: e.ganho, perdido: e.perdido })))
  const [salvando, setSalvando] = useState(false)
  const novoId = () => (typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`)

  const setNome = (i: number, nome: string) => setLista(l => l.map((e, idx) => idx === i ? { ...e, nome } : e))
  const remover = (i: number) => setLista(l => l.filter((_, idx) => idx !== i))
  const mover = (i: number, dir: -1 | 1) => setLista(l => { const j = i + dir; if (j < 0 || j >= l.length) return l; const n = [...l]; const tmp = n[i]; n[i] = n[j]; n[j] = tmp; return n })
  function adicionar() {
    setLista(l => {
      const idxTerminal = l.findIndex(e => e.ganho || e.perdido)
      const nova: Item = { id: novoId(), nome: '' }
      return idxTerminal < 0 ? [...l, nova] : [...l.slice(0, idxTerminal), nova, ...l.slice(idxTerminal)]
    })
  }
  async function salvar() {
    if (lista.some(e => !e.nome.trim())) { toast('Dê um nome a todas as etapas.', 'erro'); return }
    setSalvando(true)
    const payload = lista.map((e, idx) => ({ id: e.id, nome: e.nome.trim(), ordem: idx, ...(e.ganho ? { ganho: true } : {}), ...(e.perdido ? { perdido: true } : {}) }))
    const r = await fetch('/api/crm/estagios', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pipelineId, estagios: payload }) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (r?.ok) { toast('Etapas salvas.', 'sucesso'); onMudou(); onClose() } else toast(r?.error || 'Falha ao salvar.', 'erro')
  }

  const arrow = (d: string) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
  return (
    <div onClick={fecharFora(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#111' }}>Etapas — {pipelineNome}</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#999' }}>Renomeie, adicione, reordene ou remova as fases deste pipeline. Ganho e Perdido são obrigatórios e não podem ser removidos.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {lista.map((e, i) => {
            const terminal = e.ganho || e.perdido
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f7f7f7', borderRadius: 10, padding: '6px 10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', color: '#999' }}>
                  <button onClick={() => mover(i, -1)} disabled={i === 0} title="Subir" style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? '#ddd' : '#888', padding: 0, lineHeight: 0 }}>{arrow('m18 15-6-6-6 6')}</button>
                  <button onClick={() => mover(i, 1)} disabled={i === lista.length - 1} title="Descer" style={{ background: 'none', border: 'none', cursor: i === lista.length - 1 ? 'default' : 'pointer', color: i === lista.length - 1 ? '#ddd' : '#888', padding: 0, lineHeight: 0 }}>{arrow('m6 9 6 6 6-6')}</button>
                </div>
                <input value={e.nome} onChange={ev => setNome(i, ev.target.value)} placeholder="Nome da etapa" style={{ ...inputStyle, flex: 1 }} />
                {terminal
                  ? <span style={{ fontSize: 10.5, fontWeight: 800, color: e.ganho ? '#16a34a' : '#b91c1c', background: e.ganho ? '#f0fdf4' : '#fef2f2', borderRadius: 999, padding: '3px 9px', flexShrink: 0 }}>{e.ganho ? 'Ganho' : 'Perdido'}</span>
                  : <button onClick={() => remover(i)} title="Remover etapa" style={{ background: 'none', border: 'none', color: '#c00', cursor: 'pointer', fontSize: 18, lineHeight: 1, flexShrink: 0, padding: '0 4px' }}>×</button>}
              </div>
            )
          })}
        </div>
        <button onClick={adicionar} style={{ padding: '9px 14px', background: '#f0f0f0', color: '#333', border: '1px dashed #ccc', borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', width: '100%' }}>+ Adicionar etapa</button>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={salvar} disabled={salvando} style={{ flex: 1, padding: '11px 0', background: 'var(--marca, #ffc00f)', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>{salvando ? 'Salvando...' : 'Salvar etapas'}</button>
          <button onClick={onClose} style={{ padding: '11px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function NovoNegocioModal({ estagios, pipelineId, usuarios, contatos, origens = [], perfilClinica = false, perfilTurismo = false, contatoIdInicial = '', onClose, onSalvo }: { estagios: Estagio[]; pipelineId?: string; usuarios: any[]; contatos: Contato[]; origens?: string[]; perfilClinica?: boolean; perfilTurismo?: boolean; contatoIdInicial?: string; onClose: () => void; onSalvo: () => void }) {
  const [f, setF] = useState({ titulo: '', valor: '', contatoNome: '', contatoTelefone: '', dono: '', origem: '', previsaoFechamento: '', estagioId: '', empresa: '', profissionalAutonomo: false, segmento: '', faturamentoEstimado: '', instagram: '', dores: '', solucoes: '', queixaPrincipal: '', destinoDesejado: '', qtdPassageiros: '', epocaDesejada: '', preferencias: '' })
  // Clínica e turismo vendem para PESSOA: a oportunidade nasce do contato, sem
  // exigir empresa (regra de agência de marketing).
  const semEmpresa = perfilClinica || perfilTurismo
  // #5 — toda oportunidade precisa de um contato: existente ou novo
  const [modoContato, setModoContato] = useState<'existente' | 'novo'>((contatos || []).length ? 'existente' : 'novo')
  // Vindo do inbox, o contato já chega escolhido (a conversa É o contato)
  const [contatoId, setContatoId] = useState(contatoIdInicial)
  const [buscaContato, setBuscaContato] = useState('') // pesquisa do contato pelo nome
  const [salvando, setSalvando] = useState(false)
  // #3 — responsavel: somente admins ou quem tem funcao de vendas
  const equipe = (usuarios || []).filter(u => u.role === 'admin' || u.role === 'vendas')

  const contatoSel = (contatos || []).find(c => c.id === contatoId)
  const buscaLc = buscaContato.trim().toLowerCase()
  const contatosFiltrados = buscaLc
    ? (contatos || []).filter(c => c.nome.toLowerCase().includes(buscaLc) || (c.empresa || '').toLowerCase().includes(buscaLc))
    : (contatos || [])
  // Validação: clínica/turismo exigem só o contato (pessoa física); agência exige empresa também.
  const valido = (modoContato === 'existente' ? !!contatoId : !!f.contatoNome.trim()) && (semEmpresa || !!f.empresa.trim() || f.profissionalAutonomo)

  async function salvar() {
    if (!valido) { toast(semEmpresa ? 'Escolha ou informe o contato.' : 'Preencha o contato e a empresa (ou marque Profissional Autônomo).', 'erro'); return }
    setSalvando(true)
    // Define o contato: usa o existente ou cria um novo. O nome do contato é o nome da oportunidade.
    let idContato = contatoId
    let nomeNegocio = contatoSel?.nome || ''
    if (modoContato === 'novo') {
      const corpo: any = { nome: f.contatoNome, telefone: f.contatoTelefone }
      if (semEmpresa) corpo.tipo = 'lead'
      else { corpo.empresa = f.profissionalAutonomo ? '' : f.empresa; corpo.profissionalAutonomo = f.profissionalAutonomo }
      const c = await fetch('/api/crm/contatos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }).then(r => r.json()).catch(() => null)
      idContato = c?.contato?.id || ''
      nomeNegocio = f.contatoNome.trim()
    }
    if (!idContato) { setSalvando(false); toast('Não foi possível vincular o contato. Tente novamente.', 'erro'); return }
    const dono = equipe.find(u => u.email === f.dono)
    const r = await fetch('/api/crm/negocios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: nomeNegocio || 'Oportunidade', valor: Number(f.valor) || 0, contatoId: idContato, pipelineId: pipelineId || '', profissionalAutonomo: f.profissionalAutonomo, dono: f.dono, donoNome: dono?.nome || '', origem: f.origem, previsaoFechamento: f.previsaoFechamento, estagioId: f.estagioId, empresa: f.empresa, segmento: f.segmento, faturamentoEstimado: f.faturamentoEstimado, instagram: f.instagram, dores: f.dores, solucoes: f.solucoes, queixaPrincipal: f.queixaPrincipal, destinoDesejado: f.destinoDesejado, qtdPassageiros: Number(f.qtdPassageiros) || 0, epocaDesejada: f.epocaDesejada, preferencias: f.preferencias }),
    }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (!r?.ok) { toast(r?.error || 'Não foi possível criar o negócio.', 'erro'); return }
    onSalvo()
  }

  return (
    <div onClick={fecharFora(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#111' }}>{semEmpresa ? 'Nova oportunidade' : 'Novo negócio'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* #5 — contato obrigatorio: existente ou novo */}
          <div>
            <label style={labelStyle}>Contato da oportunidade *</label>
            <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: 9, padding: 3, marginBottom: 8 }}>
              {([['existente', 'Contato existente'], ['novo', 'Novo contato']] as const).map(([k, lab]) => (
                <button key={k} type="button" onClick={() => setModoContato(k)} disabled={k === 'existente' && !(contatos || []).length}
                  style={{ flex: 1, padding: '7px 10px', border: 'none', borderRadius: 7, cursor: (k === 'existente' && !(contatos || []).length) ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700, background: modoContato === k ? '#fff' : 'transparent', color: modoContato === k ? '#111' : '#888', boxShadow: modoContato === k ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}>{lab}</button>
              ))}
            </div>
            {modoContato === 'existente' ? (
              contatoSel ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 9, padding: '9px 12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111' }}>{contatoSel.nome}</p>
                    {(contatoSel.empresa || contatoSel.profissionalAutonomo) && <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#888' }}>{contatoSel.empresa || 'Autônomo'}</p>}
                  </div>
                  <button type="button" onClick={() => { setContatoId(''); setBuscaContato('') }} style={{ background: 'none', border: 'none', color: '#16a34a', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Trocar</button>
                </div>
              ) : (
                <div>
                  <input value={buscaContato} onChange={e => setBuscaContato(e.target.value)} autoFocus placeholder="Pesquisar contato pelo nome..." style={inputStyle} />
                  <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #eee', borderRadius: 9, marginTop: 6 }}>
                    {contatosFiltrados.length === 0 ? (
                      <p style={{ margin: 0, padding: 12, fontSize: 12.5, color: '#888' }}>Nenhum contato encontrado.{buscaContato.trim() ? ' Use "Novo contato" para criar.' : ''}</p>
                    ) : contatosFiltrados.slice(0, 50).map(c => (
                      <button key={c.id} type="button" onClick={() => { setContatoId(c.id); setF(prev => ({ ...prev, empresa: c.empresa || '', profissionalAutonomo: !!c.profissionalAutonomo })) }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: '#fff', border: 'none', borderBottom: '1px solid #f5f5f5', cursor: 'pointer', fontSize: 13 }}>
                        <span style={{ fontWeight: 700, color: '#111' }}>{c.nome}</span>{c.empresa ? <span style={{ color: '#888' }}> — {c.empresa}</span> : c.profissionalAutonomo ? <span style={{ color: '#888' }}> — Autônomo</span> : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input value={f.contatoNome} onChange={e => setF({ ...f, contatoNome: e.target.value })} placeholder={perfilClinica ? 'Nome do paciente / lead' : perfilTurismo ? 'Nome do cliente / lead' : 'Nome do responsável'} style={inputStyle} />
                <input value={f.contatoTelefone} onChange={e => setF({ ...f, contatoTelefone: e.target.value })} placeholder="WhatsApp / telefone" style={inputStyle} />
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={labelStyle}>Valor (R$)</label><input type="number" min="0" value={f.valor} onChange={e => setF({ ...f, valor: e.target.value })} placeholder="0" style={inputStyle} /></div>
            <div><label style={labelStyle}>Etapa</label>
              <select value={f.estagioId} onChange={e => setF({ ...f, estagioId: e.target.value })} style={{ ...inputStyle, background: '#fff' }}>
                <option value="">Primeira (Lead)</option>
                {estagios.filter(e => !e.ganho && !e.perdido).map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={labelStyle}>{perfilClinica ? 'Responsável' : 'Vendedor responsável'}</label>
              <select value={f.dono} onChange={e => setF({ ...f, dono: e.target.value })} style={{ ...inputStyle, background: '#fff' }}>
                <option value="">Eu</option>
                {equipe.map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Previsão</label><input type="date" value={f.previsaoFechamento} onChange={e => setF({ ...f, previsaoFechamento: e.target.value })} style={inputStyle} /></div>
          </div>
          <div><label style={labelStyle}>Origem</label>
            <input value={f.origem} onChange={e => setF({ ...f, origem: e.target.value })} list="crm-origens" placeholder="Selecione ou digite..." style={inputStyle} />
            <datalist id="crm-origens">{origens.map(o => <option key={o} value={o} />)}</datalist>
          </div>

          {perfilClinica ? (<>
            <div><label style={labelStyle}>Queixa principal</label><input value={f.queixaPrincipal} onChange={e => setF({ ...f, queixaPrincipal: e.target.value })} placeholder="O que a paciente relata (ex.: melasma, flacidez, acne...)" style={inputStyle} /></div>
            <div><label style={labelStyle}>Observações</label><textarea value={f.dores} onChange={e => setF({ ...f, dores: e.target.value })} placeholder="Anotações sobre a oportunidade (interesse, procedimento, etc.)" style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} /></div>
          </>) : perfilTurismo ? (<>
            {/* Turismo: a qualificação é DA VIAGEM — destino, pessoas, época e desejos */}
            <div style={{ height: 1, background: '#f0f0f0', margin: '2px 0' }} />
            <span style={{ fontSize: 12.5, fontWeight: 800, color: '#111' }}>Sobre a viagem</span>
            <div><label style={labelStyle}>Destino / viagem de interesse</label><input value={f.destinoDesejado} onChange={e => setF({ ...f, destinoDesejado: e.target.value })} placeholder="Ex.: Foz do Iguaçu, praia no verão..." style={inputStyle} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={labelStyle}>Quantas pessoas</label><input type="number" min="1" value={f.qtdPassageiros} onChange={e => setF({ ...f, qtdPassageiros: e.target.value })} placeholder="Ex.: 4" style={inputStyle} /></div>
              <div><label style={labelStyle}>Época desejada</label><input value={f.epocaDesejada} onChange={e => setF({ ...f, epocaDesejada: e.target.value })} placeholder="Ex.: setembro / férias" style={inputStyle} /></div>
            </div>
            <div><label style={labelStyle}>Preferências e desejos</label><textarea value={f.preferencias} onChange={e => setF({ ...f, preferencias: e.target.value })} placeholder="Ex.: leito, hotel com café, viaja com criança, quer parcelar..." style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} /></div>
          </>) : (<>
            <div style={{ height: 1, background: '#f0f0f0', margin: '2px 0' }} />
            <span style={{ fontSize: 12.5, fontWeight: 800, color: '#111' }}>Qualificação da oportunidade</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#333', fontWeight: 600 }}>
              <input type="checkbox" checked={f.profissionalAutonomo} onChange={e => setF({ ...f, profissionalAutonomo: e.target.checked, empresa: e.target.checked ? '' : f.empresa })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              Profissional Autônomo (sem empresa)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={labelStyle}>Empresa {f.profissionalAutonomo ? '' : '*'}</label><input value={f.empresa} disabled={f.profissionalAutonomo} onChange={e => setF({ ...f, empresa: e.target.value })} placeholder={f.profissionalAutonomo ? 'Autônomo' : 'Nome da empresa'} style={{ ...inputStyle, background: f.profissionalAutonomo ? '#f5f5f5' : '#fff', color: f.profissionalAutonomo ? '#aaa' : '#111' }} /></div>
              <div><label style={labelStyle}>Segmento / nicho</label><input value={f.segmento} onChange={e => setF({ ...f, segmento: e.target.value })} placeholder="Ex: Odontologia" style={inputStyle} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={labelStyle}>Faturamento estimado</label><input value={f.faturamentoEstimado} onChange={e => setF({ ...f, faturamentoEstimado: e.target.value })} placeholder="Ex: R$ 50-100k/mês" style={inputStyle} /></div>
              <div><label style={labelStyle}>Instagram / site</label><input value={f.instagram} onChange={e => setF({ ...f, instagram: e.target.value })} placeholder="@empresa ou site" style={inputStyle} /></div>
            </div>
            <div><label style={labelStyle}>Principais dores / desafios</label><textarea value={f.dores} onChange={e => setF({ ...f, dores: e.target.value })} placeholder="O que mais incomoda o prospect hoje..." style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} /></div>
            <div><label style={labelStyle}>Possíveis soluções</label><textarea value={f.solucoes} onChange={e => setF({ ...f, solucoes: e.target.value })} placeholder="O que podemos oferecer / proposta de valor..." style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} /></div>
          </>)}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={salvar} disabled={salvando || !valido} style={{ flex: 1, padding: '11px 0', background: valido ? '#ffc00f' : '#f0f0f0', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: valido ? 'pointer' : 'not-allowed' }}>{salvando ? 'Salvando...' : (semEmpresa ? 'Criar oportunidade' : 'Criar negócio')}</button>
          <button onClick={onClose} style={{ padding: '11px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function NegocioModal({ negocio, estagios, pipelines = [], padraoId = '', contato, usuarios, onClose, onMudou, onFechar, onClienteCriado, podeExcluir = false, perfilClinica = false, perfilTurismo = false, onAgendar, onAbrirWhatsApp }: { negocio: Negocio; estagios: Estagio[]; pipelines?: { id: string; nome: string; ordem: number }[]; padraoId?: string; contato?: Contato; usuarios: any[]; onClose: () => void; onMudou: () => void; onFechar: () => void; onClienteCriado?: () => void; podeExcluir?: boolean; perfilClinica?: boolean; perfilTurismo?: boolean; onAgendar?: (p: { pacienteNome: string; pacienteTelefone?: string; contatoId?: string }) => void; onAbrirWhatsApp: (telefone: string, contatoId?: string) => void }) {
  const [neg, setNeg] = useState<Negocio>(negocio)
  const pipeAtual = neg.pipelineId || padraoId
  const estagiosPipe = estagios.filter(e => (e.pipelineId || padraoId) === pipeAtual)
  // Move o negócio para outro pipeline: entra na primeira etapa do destino
  function moverPipeline(destinoId: string) {
    if (destinoId === pipeAtual) return
    const estDest = estagios.filter(e => (e.pipelineId || padraoId) === destinoId)
    const primeira = (estDest.find(e => !e.ganho && !e.perdido) || estDest[0])?.id || ''
    patch({ pipelineId: destinoId, estagioId: primeira })
  }
  const [tipoAtiv, setTipoAtiv] = useState('nota')
  const [textoAtiv, setTextoAtiv] = useState('')
  const [converter, setConverter] = useState(false)
  // Cadência / agendamentos (Fase 2)
  const [agQuando, setAgQuando] = useState('')
  const [agCanal, setAgCanal] = useState('whatsapp')
  const [agTitulo, setAgTitulo] = useState('')
  const estagio = estagios.find(e => e.id === neg.estagioId)

  async function patch(updates: any) {
    const r = await fetch('/api/crm/negocios', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: neg.id, ...updates }) }).then(x => x.json()).catch(() => null)
    if (r?.negocio) setNeg(r.negocio)
    onMudou()
  }
  async function addAtividade() {
    if (!textoAtiv.trim()) return
    await patch({ novaAtividade: { tipo: tipoAtiv, texto: textoAtiv.trim() } })
    setTextoAtiv('')
  }
  async function addAgendamento() {
    if (!agQuando || !agTitulo.trim()) return
    await patch({ novoAgendamento: { quando: agQuando, canal: agCanal, titulo: agTitulo.trim() } })
    setAgQuando(''); setAgTitulo('')
  }
  async function excluir() {
    if (!(await confirmar('Excluir este negócio?', { titulo: 'Excluir negócio', okLabel: 'Excluir', perigo: true }))) return
    await fetch(`/api/crm/negocios?id=${neg.id}`, { method: 'DELETE' }).catch(() => {})
    onFechar()
  }

  const tl = [...(neg.atividades || [])].reverse()

  return (
    <div onClick={fecharFora(onClose, { perguntar: false })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 560, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <input value={neg.titulo} onChange={e => setNeg({ ...neg, titulo: e.target.value })} onBlur={() => patch({ titulo: neg.titulo })}
            style={{ flex: 1, fontSize: 17, fontWeight: 800, color: '#111', border: 'none', outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', borderRadius: 999, padding: '4px 12px' }}>{fmtR$(neg.valor)}</span>
          <select value={neg.estagioId} onChange={e => patch({ estagioId: e.target.value })} style={{ fontSize: 12, fontWeight: 700, borderRadius: 999, padding: '4px 12px', border: '1.5px solid #e0e0e0', background: '#fff', cursor: 'pointer' }}>
            {estagiosPipe.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
          {pipelines.length > 1 && (
            <select value={pipeAtual} onChange={e => moverPipeline(e.target.value)} title="Mover para outro pipeline" style={{ fontSize: 12, fontWeight: 700, borderRadius: 999, padding: '4px 12px', border: '1.5px solid #c7d2fe', background: '#eef2ff', color: '#3730a3', cursor: 'pointer' }}>
              {pipelines.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          )}
          {neg.status === 'ganho' && <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: '#16a34a', borderRadius: 999, padding: '4px 12px' }}>GANHO</span>}
          {neg.status === 'perdido' && <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: '#b91c1c', borderRadius: 999, padding: '4px 12px' }}>PERDIDO</span>}
          {perfilClinica && onAgendar && (
            <button onClick={() => onAgendar({ pacienteNome: contato?.nome || neg.titulo, pacienteTelefone: contato?.telefone, contatoId: contato?.id })}
              title="Criar um horário na Agenda para este paciente/lead"
              style={{ fontSize: 12, fontWeight: 800, color: '#111', background: '#ffc00f', borderRadius: 999, padding: '4px 14px', border: 'none', cursor: 'pointer' }}>Agendar na agenda</button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Valor (R$)</label>
            <input type="number" min="0" value={neg.valor || 0} onChange={e => setNeg({ ...neg, valor: Number(e.target.value) })} onBlur={() => patch({ valor: neg.valor })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Responsável</label>
            <select value={neg.dono || ''} onChange={e => { const u = (usuarios || []).find((x: any) => x.email === e.target.value); patch({ dono: e.target.value, donoNome: u?.nome || '' }) }} style={{ ...inputStyle, background: '#fff' }}>
              <option value="">—</option>
              {(usuarios || []).filter(u => u.role === 'admin' || u.role === 'vendas').map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Próximo follow-up</label>
          <input type="date" value={(neg.proximoFollowUp || '').slice(0, 10)} onChange={e => setNeg({ ...neg, proximoFollowUp: e.target.value })} onBlur={() => patch({ proximoFollowUp: neg.proximoFollowUp })} style={inputStyle} />
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#bbb' }}>No dia, o responsável recebe um lembrete (push + inbox).</p>
        </div>

        {/* Cadência / agendamentos */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
            <label style={{ ...labelStyle, margin: 0 }}>Cadência / agendamentos</label>
            <button type="button" onClick={() => patch({ aplicarCadencia: true })} title="Gera os toques a partir da cadência do Playbook (a contar de hoje)"
              style={{ background: 'none', border: 'none', color: '#1d4ed8', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>+ Aplicar cadência do Playbook</button>
          </div>
          {(neg.agendamentos || []).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {[...(neg.agendamentos || [])].sort((a, b) => a.quando.localeCompare(b.quando)).map(a => {
                const venceu = !a.feito && new Date(a.quando + 'T23:59:59').getTime() < Date.now()
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: a.feito ? '#f5f5f5' : venceu ? '#fef2f2' : '#fafafa', borderRadius: 8, fontSize: 12.5 }}>
                    <input type="checkbox" checked={!!a.feito} onChange={() => patch({ toggleAgendamento: a.id })} style={{ cursor: 'pointer', flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, color: venceu ? '#b91c1c' : '#444', flexShrink: 0 }}>{new Date(a.quando + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#888', background: '#fff', border: '1px solid #eee', borderRadius: 999, padding: '1px 7px', flexShrink: 0 }}>{a.canal}</span>
                    <span style={{ flex: 1, color: '#333', textDecoration: a.feito ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titulo}</span>
                    <button type="button" onClick={() => patch({ removerAgendamento: a.id })} title="Remover" style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 15, lineHeight: 1, flexShrink: 0 }}>×</button>
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="date" value={agQuando} onChange={e => setAgQuando(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, fontFamily: 'inherit' }} />
            <select value={agCanal} onChange={e => setAgCanal(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, background: '#fff', fontFamily: 'inherit' }}>
              {(['whatsapp', 'ligacao', 'email', 'reuniao', 'outro'] as const).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={agTitulo} onChange={e => setAgTitulo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addAgendamento() }} placeholder="O que fazer (ex.: enviar proposta)" style={{ flex: 1, minWidth: 130, padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, fontFamily: 'inherit' }} />
            <button type="button" onClick={addAgendamento} disabled={!agQuando || !agTitulo.trim()} style={{ padding: '7px 12px', background: (agQuando && agTitulo.trim()) ? '#111' : '#f0f0f0', color: (agQuando && agTitulo.trim()) ? '#fff' : '#aaa', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Agendar</button>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#bbb' }}>Cada toque vira lembrete (push + inbox) para o responsável no dia agendado.</p>
        </div>

        {contato && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#fafafa', borderRadius: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111' }}>{contato.nome}</p>
              {contato.telefone && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>{contato.telefone}</p>}
            </div>
            {/* Conversa SEMPRE no inbox (aba Mensagens), em toda instância: o
                atendimento fica registrado e visível ao time. O wa.me abria o
                WhatsApp Web e o histórico morria no celular de quem atendeu. */}
            {contato.telefone && (
              <button onClick={() => onAbrirWhatsApp(contato.telefone!, contato.id)} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: '#25D366', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>WhatsApp</button>
            )}
          </div>
        )}

        {/* Qualificação — clínica só tem Observações; turismo tem a ficha DA VIAGEM;
            agência tem a ficha B2B de marketing */}
        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12, marginBottom: 14 }}>
          {perfilClinica ? (<>
            <div style={{ marginBottom: 10 }}><label style={labelStyle}>Queixa principal</label><input value={neg.queixaPrincipal || ''} onChange={e => setNeg({ ...neg, queixaPrincipal: e.target.value })} onBlur={() => patch({ queixaPrincipal: neg.queixaPrincipal })} placeholder="O que a paciente relata" style={inputStyle} /></div>
            <div><label style={labelStyle}>Observações</label><textarea value={neg.dores || ''} onChange={e => setNeg({ ...neg, dores: e.target.value })} onBlur={() => patch({ dores: neg.dores })} placeholder="Anotações sobre a oportunidade (interesse, procedimento...)" style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} /></div>
          </>) : perfilTurismo ? (<>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: '#111', display: 'block', marginBottom: 10 }}>Sobre a viagem</span>
            <div style={{ marginBottom: 10 }}><label style={labelStyle}>Destino / viagem de interesse</label><input value={neg.destinoDesejado || ''} onChange={e => setNeg({ ...neg, destinoDesejado: e.target.value })} onBlur={() => patch({ destinoDesejado: neg.destinoDesejado })} placeholder="Ex.: Foz do Iguaçu, praia no verão..." style={inputStyle} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div><label style={labelStyle}>Quantas pessoas</label><input type="number" min="1" value={neg.qtdPassageiros || ''} onChange={e => setNeg({ ...neg, qtdPassageiros: Number(e.target.value) || undefined })} onBlur={() => patch({ qtdPassageiros: neg.qtdPassageiros || 0 })} style={inputStyle} /></div>
              <div><label style={labelStyle}>Época desejada</label><input value={neg.epocaDesejada || ''} onChange={e => setNeg({ ...neg, epocaDesejada: e.target.value })} onBlur={() => patch({ epocaDesejada: neg.epocaDesejada })} placeholder="Ex.: setembro / férias" style={inputStyle} /></div>
            </div>
            <div><label style={labelStyle}>Preferências e desejos</label><textarea value={neg.preferencias || ''} onChange={e => setNeg({ ...neg, preferencias: e.target.value })} onBlur={() => patch({ preferencias: neg.preferencias })} placeholder="Ex.: leito, hotel com café, viaja com criança, quer parcelar..." style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} /></div>
          </>) : (<>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: '#111', display: 'block', marginBottom: 10 }}>Qualificação</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div><label style={labelStyle}>Empresa</label><input value={neg.empresa || ''} onChange={e => setNeg({ ...neg, empresa: e.target.value })} onBlur={() => patch({ empresa: neg.empresa })} style={inputStyle} /></div>
              <div><label style={labelStyle}>Segmento</label><input value={neg.segmento || ''} onChange={e => setNeg({ ...neg, segmento: e.target.value })} onBlur={() => patch({ segmento: neg.segmento })} style={inputStyle} /></div>
              <div><label style={labelStyle}>Faturamento estimado</label><input value={neg.faturamentoEstimado || ''} onChange={e => setNeg({ ...neg, faturamentoEstimado: e.target.value })} onBlur={() => patch({ faturamentoEstimado: neg.faturamentoEstimado })} style={inputStyle} /></div>
              <div><label style={labelStyle}>Instagram / site</label><input value={neg.instagram || ''} onChange={e => setNeg({ ...neg, instagram: e.target.value })} onBlur={() => patch({ instagram: neg.instagram })} style={inputStyle} /></div>
            </div>
            <div style={{ marginBottom: 10 }}><label style={labelStyle}>Principais dores</label><textarea value={neg.dores || ''} onChange={e => setNeg({ ...neg, dores: e.target.value })} onBlur={() => patch({ dores: neg.dores })} style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} /></div>
            <div><label style={labelStyle}>Possíveis soluções</label><textarea value={neg.solucoes || ''} onChange={e => setNeg({ ...neg, solucoes: e.target.value })} onBlur={() => patch({ solucoes: neg.solucoes })} style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} /></div>
          </>)}
        </div>

        {/* Timeline */}
        <label style={labelStyle}>Atividades</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <select value={tipoAtiv} onChange={e => setTipoAtiv(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 12, fontFamily: 'inherit', background: '#fff' }}>
            {TIPOS_ATIV.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <input value={textoAtiv} onChange={e => setTextoAtiv(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addAtividade() }} placeholder="Registrar interação / nota..." style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 12.5, fontFamily: 'inherit' }} />
          <button onClick={addAtividade} disabled={!textoAtiv.trim()} style={{ padding: '8px 14px', background: textoAtiv.trim() ? '#111' : '#f0f0f0', color: textoAtiv.trim() ? '#fff' : '#aaa', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Add</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto', marginBottom: 16 }}>
          {tl.length === 0 && <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>Nenhuma atividade ainda.</p>}
          {tl.map(a => (
            <div key={a.id} style={{ display: 'flex', gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: a.tipo === 'ganho' ? '#16a34a' : a.tipo === 'perdido' ? '#b91c1c' : a.tipo === 'estagio' ? '#ffc00f' : '#1d4ed8', marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12.5, color: '#333' }}>{a.texto}</p>
                <p style={{ margin: '1px 0 0', fontSize: 10.5, color: '#aaa' }}>{a.autor} · {new Date(a.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Clínica: ganhar = AGENDAR CONSULTA (abre a agenda). Turismo: ganhar =
            marcar GANHO e registrar a RESERVA (o financeiro nasce dela). Agência:
            passagem de bastão -> cliente. */}
        {perfilClinica ? (
          <button onClick={() => onAgendar?.({ pacienteNome: contato?.nome || neg.titulo, pacienteTelefone: contato?.telefone, contatoId: contato?.id })}
            style={{ width: '100%', padding: '12px 0', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer', marginBottom: 12 }}>
            Agendar consulta
          </button>
        ) : perfilTurismo ? (
          neg.status === 'ganho' ? (
            <div style={{ padding: '11px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, marginBottom: 12, fontSize: 12.5, color: '#166534', fontWeight: 700 }}>
              ✓ Venda concretizada — registre a reserva em <strong>Reservas</strong>: as parcelas e os pagamentos dela entram sozinhos no Financeiro.
            </div>
          ) : (
            <button onClick={() => { const g = estagiosPipe.find(e => e.ganho); patch(g ? { estagioId: g.id } : { status: 'ganho' }) }}
              style={{ width: '100%', padding: '12px 0', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer', marginBottom: 12 }}>
              Venda concretizada (ganho)
            </button>
          )
        ) : neg.clienteId ? (
          <div style={{ padding: '11px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, marginBottom: 12, fontSize: 12.5, color: '#166534', fontWeight: 700 }}>✓ Venda concretizada — cliente criado e entregas aplicadas.</div>
        ) : (
          <button onClick={() => setConverter(true)} style={{ width: '100%', padding: '12px 0', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer', marginBottom: 12 }}>
            Concretizar venda → criar cliente
          </button>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Fechar</button>
          {podeExcluir && <button onClick={excluir} style={{ padding: '11px 16px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Excluir</button>}
        </div>
      </div>
      {converter && !perfilClinica && !perfilTurismo && <ConversaoModal negocio={neg} contato={contato} onClose={() => setConverter(false)} onConvertido={(clienteId) => { setNeg({ ...neg, clienteId, status: 'ganho' }); setConverter(false); onMudou(); onClienteCriado?.() }} />}
    </div>
  )
}

function ConversaoModal({ negocio, contato, onClose, onConvertido }: { negocio: Negocio; contato?: Contato; onClose: () => void; onConvertido: (clienteId: string) => void }) {
  const [c, setC] = useState({
    nome: negocio.empresa || contato?.nome || negocio.titulo || '',
    instagram: negocio.instagram || '',
    loginEmail: contato?.email || '',
    contratoValor: String(negocio.valor || ''),
  })
  const [h, setH] = useState({ escopoVendido: negocio.solucoes || '', expectativas: '', detalhes: negocio.dores || '', observacoes: '' })
  const [templates, setTemplates] = useState<{ id: string; nome: string }[]>([])
  const [templateId, setTemplateId] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [resultado, setResultado] = useState<{ clienteId: string; marcos: number; tarefas: number; loginSenha?: string } | null>(null)

  useEffect(() => { fetch('/api/templates').then(r => r.json()).then(d => setTemplates(Array.isArray(d) ? d : [])).catch(() => {}) }, [])

  async function concretizar() {
    if (!c.nome.trim()) { setErro('Informe o nome do cliente.'); return }
    setSalvando(true); setErro('')
    const r = await fetch('/api/crm/converter', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ negocioId: negocio.id, cliente: { nome: c.nome, instagram: c.instagram, loginEmail: c.loginEmail || '', contratoValor: Number(c.contratoValor) || 0 }, handoff: h, templateId }),
    }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (!r || r.error) { setErro(r?.error || 'Falha ao converter.'); return }
    setResultado(r)
  }

  if (resultado) {
    return (
      <div onClick={fecharFora(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
        <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 440, width: '100%', padding: 24, textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#111' }}>Venda concretizada! 🎉</h3>
          <p style={{ margin: '0 0 6px', fontSize: 13.5, color: '#555' }}>Cliente <b>{c.nome}</b> criado, com <b>{resultado.marcos}</b> etapas e <b>{resultado.tarefas}</b> tarefas no Playbook.</p>
          {resultado.loginSenha && (
            <div style={{ margin: '10px 0', padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, fontSize: 12.5, color: '#92400e' }}>
              Acesso do cliente criado. Senha: <b style={{ userSelect: 'all' }}>{resultado.loginSenha}</b> — anote/envie ao cliente.
            </div>
          )}
          <button onClick={() => onConvertido(resultado.clienteId)} style={{ marginTop: 10, width: '100%', padding: '12px 0', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Concluir</button>
        </div>
      </div>
    )
  }

  return (
    <div onClick={fecharFora(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 520, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 17, color: '#111' }}>Passagem de bastão → Onboarding</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#999' }}>Quanto mais detalhe o closer passar, melhor o onboarding do cliente pelo Gestor.</p>

        <span style={{ fontSize: 12.5, fontWeight: 800, color: '#111' }}>Cliente</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '8px 0 16px' }}>
          <div><label style={labelStyle}>Nome *</label><input value={c.nome} onChange={e => setC({ ...c, nome: e.target.value })} style={inputStyle} /></div>
          <div><label style={labelStyle}>Instagram</label><input value={c.instagram} onChange={e => setC({ ...c, instagram: e.target.value })} placeholder="@cliente" style={inputStyle} /></div>
          <div><label style={labelStyle}>E-mail de acesso (opcional)</label><input value={c.loginEmail} onChange={e => setC({ ...c, loginEmail: e.target.value })} placeholder="cria login do portal" style={inputStyle} /></div>
          <div><label style={labelStyle}>Valor do contrato (R$)</label><input type="number" min="0" value={c.contratoValor} onChange={e => setC({ ...c, contratoValor: e.target.value })} style={inputStyle} /></div>
        </div>

        <span style={{ fontSize: 12.5, fontWeight: 800, color: '#111' }}>Handoff (Closer → Gestor)</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '8px 0 16px' }}>
          <div><label style={labelStyle}>Escopo vendido / entregáveis</label><textarea value={h.escopoVendido} onChange={e => setH({ ...h, escopoVendido: e.target.value })} style={{ ...inputStyle, minHeight: 54, resize: 'vertical' }} /></div>
          <div><label style={labelStyle}>Expectativas e objetivos do cliente</label><textarea value={h.expectativas} onChange={e => setH({ ...h, expectativas: e.target.value })} style={{ ...inputStyle, minHeight: 54, resize: 'vertical' }} /></div>
          <div><label style={labelStyle}>Detalhes importantes (decisor, prazos prometidos, sensibilidades)</label><textarea value={h.detalhes} onChange={e => setH({ ...h, detalhes: e.target.value })} style={{ ...inputStyle, minHeight: 54, resize: 'vertical' }} /></div>
          <div><label style={labelStyle}>Observações</label><textarea value={h.observacoes} onChange={e => setH({ ...h, observacoes: e.target.value })} style={{ ...inputStyle, minHeight: 44, resize: 'vertical' }} /></div>
        </div>

        <span style={{ fontSize: 12.5, fontWeight: 800, color: '#111' }}>Entregas (onboarding)</span>
        <div style={{ margin: '8px 0 16px' }}>
          <label style={labelStyle}>Modelo de projeto a aplicar (gera marcos + tarefas)</label>
          <select value={templateId} onChange={e => setTemplateId(e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
            <option value="">Não aplicar modelo agora</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
          {templates.length === 0 && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#ea580c' }}>Nenhum modelo cadastrado. Crie em Modelos para montar o escopo automaticamente.</p>}
        </div>

        {erro && <p style={{ margin: '0 0 10px', fontSize: 12.5, color: '#b91c1c', fontWeight: 700 }}>{erro}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={concretizar} disabled={salvando || !c.nome.trim()} style={{ flex: 1, padding: '12px 0', background: c.nome.trim() ? '#16a34a' : '#f0f0f0', color: c.nome.trim() ? '#fff' : '#aaa', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: c.nome.trim() ? 'pointer' : 'not-allowed' }}>{salvando ? 'Concretizando...' : 'Concretizar venda'}</button>
          <button onClick={onClose} style={{ padding: '12px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// Central de mensagens — conversa com leads pelo sistema (WhatsApp e Instagram Direct)
type MsgConversa = { id: string; telefone?: string; nome?: string; username?: string; foto?: string; contatoId?: string; ultimaMsg?: string; ultimaEm?: string; naoLidas?: number }

// Avatar da conversa: foto do perfil (com fallback para a inicial se faltar/quebrar)
function AvatarConv({ foto, nome, cor, tam = 34 }: { foto?: string; nome: string; cor: string; tam?: number }) {
  const [erro, setErro] = useState(false)
  const inicial = (nome || '?').replace('@', '').charAt(0).toUpperCase()
  return (
    <span style={{ width: tam, height: tam, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: cor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: tam < 30 ? 11 : 13 }}>
      {foto && !erro ? <img src={foto} alt="" onError={() => setErro(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : inicial}
    </span>
  )
}
type MsgItem = { id: string; de: 'cliente' | 'agente'; texto: string; em: string; autor?: string; autorFoto?: string; tipo?: 'imagem' | 'video' | 'audio' | 'documento' | 'figurinha'; midiaUrl?: string; mimetype?: string; fileName?: string; editada?: boolean }

// Mídia recebida do WhatsApp NUNCA é exibida pela URL crua do Blob — sempre pelo
// proxy autenticado (funciona com store privado OU público; exige login).
const midiaSrc = (u: string) => `/api/whatsapp/midia?url=${encodeURIComponent(u)}`

// Torna URLs do texto clicáveis (abre em nova aba), mantendo o resto como está.
function comLinks(texto: string) {
  return (texto || '').split(/(https?:\/\/[^\s]+)/g).map((p, i) =>
    /^https?:\/\//.test(p)
      ? <a key={i} href={p} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline', wordBreak: 'break-all' }}>{p}</a>
      : p
  )
}

// Nome sugerido ao baixar uma mídia sem nome original (ex.: foto-15-07-2026-1432.jpg)
function nomeArquivoMidia(m: { tipo?: string; mimetype?: string; em: string }): string {
  const d = new Date(m.em)
  const p = (n: number) => String(n).padStart(2, '0')
  const carimbo = `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}-${p(d.getHours())}${p(d.getMinutes())}`
  const ext = (m.mimetype || '').split('/')[1]?.split(';')[0] || 'jpg'
  const base = m.tipo === 'imagem' ? 'foto' : m.tipo === 'video' ? 'video' : m.tipo === 'audio' ? 'audio' : 'arquivo'
  return `${base}-${carimbo}.${ext}`
}

// Rótulos "[imagem]"/"[áudio]"… somem quando a mídia em si é exibida na bolha.
const ehRotuloMidia = (t: string) => /^\[[^\]]+\]$/.test((t || '').trim())
type CanalMsg = 'whatsapp' | 'instagram'

// Cada canal abstrai o endpoint, os nomes dos campos e a apresentação. A UI é a mesma.
const CANAL_CFG: Record<CanalMsg, {
  cor: string
  bolha: string
  aviso: string
  listar: () => Promise<any>
  historico: (id: string) => Promise<any>
  enviar: (id: string, texto: string) => Promise<any>
  vincular: (id: string, contatoId: string) => Promise<any>
  excluir?: (id: string) => Promise<any>
  excluirMensagem?: (id: string, msgId: string) => Promise<any>
  buscar?: (q: string) => Promise<{ tel: string; snippet: string }[]>
  norm: (c: any) => MsgConversa
  subId: (c: MsgConversa | undefined, id: string) => string
  matchContato: (c: MsgConversa, contatos: Contato[]) => string | undefined
  conectarUrl?: string
}> = {
  whatsapp: {
    cor: '#16a34a', bolha: '#dcf8c6',
    aviso: 'WhatsApp ainda não conectado. Conecte pelo QR em Configurações → Integrações → WhatsApp (mantém o número atual). As conversas aparecem aqui assim que parear.',
    listar: () => fetch('/api/crm/mensagens').then(r => r.json()).catch(() => null),
    historico: id => fetch(`/api/crm/mensagens?tel=${id}`).then(r => r.json()).catch(() => null),
    buscar: q => fetch(`/api/crm/mensagens?busca=${encodeURIComponent(q)}`).then(r => r.json()).then(d => Array.isArray(d?.matches) ? d.matches : []).catch(() => []),
    enviar: (id, texto) => fetch('/api/crm/mensagens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telefone: id, texto }) }).then(x => x.json()).catch(() => null),
    vincular: (id, contatoId) => fetch('/api/crm/mensagens', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telefone: id, contatoId }) }).catch(() => {}),
    excluir: id => fetch(`/api/crm/mensagens?tel=${id}`, { method: 'DELETE' }).then(x => x.json()).catch(() => null),
    excluirMensagem: (id, msgId) => fetch(`/api/crm/mensagens?tel=${id}&msgId=${encodeURIComponent(msgId)}`, { method: 'DELETE' }).then(x => x.json()).catch(() => null),
    norm: c => ({ ...c, id: c.telefone }),
    subId: (c, id) => (c as any)?.grupo ? 'Grupo do WhatsApp' : `+${id}`,
    matchContato: (c, contatos) => contatos.find(ct => mesmoTelefone(ct.telefone, c.id))?.nome,
  },
  instagram: {
    cor: '#d6249f', bolha: '#fce7f3',
    aviso: 'Instagram Direct ainda não conectado. As conversas aparecem aqui após a aprovação da permissão instagram_business_manage_messages no App Review, a conexão da conta do cliente e o webhook (INSTAGRAM_VERIFY_TOKEN) configurado na Meta.',
    listar: () => fetch('/api/crm/mensagens-instagram').then(r => r.json()).catch(() => null),
    historico: id => fetch(`/api/crm/mensagens-instagram?id=${id}`).then(r => r.json()).catch(() => null),
    enviar: (id, texto) => fetch('/api/crm/mensagens-instagram', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, texto }) }).then(x => x.json()).catch(() => null),
    vincular: (id, contatoId) => fetch('/api/crm/mensagens-instagram', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, contatoId }) }).catch(() => {}),
    excluirMensagem: (id, msgId) => fetch(`/api/crm/mensagens-instagram?id=${encodeURIComponent(id)}&msgId=${encodeURIComponent(msgId)}`, { method: 'DELETE' }).then(x => x.json()).catch(() => null),
    norm: c => ({ ...c }),
    subId: (c, id) => c?.username ? `@${c.username}` : id,
    matchContato: () => undefined,
    conectarUrl: '/api/instagram/oauth?messaging=1',
  },
}

function MensagensInbox({ contatos, perfilClinica = false, podeExcluir = false, onContatosMudou, abrirTel = '', abrirContatoId = '', onAbriuTel, onAbrirOportunidade }: { contatos: Contato[]; perfilClinica?: boolean; podeExcluir?: boolean; onContatosMudou?: () => void; abrirTel?: string; abrirContatoId?: string; onAbriuTel?: () => void; onAbrirOportunidade?: (contatoId: string) => void }) {
  // Clínica só usa WhatsApp; Instagram Direct fica fora (bloqueado no App Review e sem app)
  const CANAIS: CanalMsg[] = perfilClinica ? ['whatsapp'] : ['whatsapp', 'instagram']
  const [canal, setCanal] = useState<CanalMsg>(() => {
    const salvo = (typeof window !== 'undefined' && (sessionStorage.getItem('crm_canal') as CanalMsg)) || 'whatsapp'
    return CANAIS.includes(salvo) ? salvo : 'whatsapp'
  })
  const cfg = CANAL_CFG[canal]
  const [conversas, setConversas] = useState<MsgConversa[]>([])
  const [configurado, setConfigurado] = useState(true)
  const [contas, setContas] = useState<any[]>([])
  const [sel, setSel] = useState<string>('')
  const [mensagens, setMensagens] = useState<MsgItem[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [carregando, setCarregando] = useState(true)
  // Encaminhar (escolhe a conversa destino na lista) e editar mensagem enviada (~15 min)
  const [encaminhar, setEncaminhar] = useState<MsgItem | null>(null)
  const [editando, setEditando] = useState<MsgItem | null>(null)
  // Vincular contato: com centenas de contatos, o <select> era inviável — vira
  // um seletor com busca (nome/telefone), igual ao resto do CRM.
  const [vincularAberto, setVincularAberto] = useState(false)
  const [buscaVinculo, setBuscaVinculo] = useState('')
  const contatosVinculo = useMemo(() => {
    const q = semAcento(buscaVinculo.trim())
    if (!q) return contatos.slice(0, 50) // sem busca, só os primeiros (lista é longa)
    const qDig = q.replace(/\D/g, '')
    return contatos.filter(ct => {
      if (qDig && (ct.telefone || '').replace(/\D/g, '').includes(qDig)) return true
      return semAcento(ct.nome).includes(q)
    }).slice(0, 50)
  }, [contatos, buscaVinculo])

  // Visualizador de imagem: abre AQUI (não em outra guia) e permite baixar.
  const [lightbox, setLightbox] = useState<{ url: string; nome: string } | null>(null)
  useEffect(() => {
    if (!lightbox) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [lightbox])

  const nomeDe = (c: MsgConversa) => c.nome || contatos.find(ct => ct.id === c.contatoId)?.nome || cfg.matchContato(c, contatos) || cfg.subId(c, c.id)

  async function carregarConversas() {
    const d = await cfg.listar()
    if (d) { setConversas(Array.isArray(d.conversas) ? d.conversas.map(cfg.norm) : []); setConfigurado(!!d.configurado); setContas(Array.isArray(d.contas) ? d.contas : []) }
    setCarregando(false)
  }
  // Excluir UMA mensagem: some do Soma10, continua no aparelho do cliente. O
  // texto do aviso diz isso — prometer "apagou" o que não apagou lá é pior que
  // não ter o botão.
  async function excluirMensagem(m: MsgItem) {
    if (!cfg.excluirMensagem) return
    const ok = await confirmar('Ela sai do Soma10 para toda a equipe. No aparelho do cliente a mensagem continua — isto não apaga no WhatsApp/Instagram dele.', {
      titulo: 'Excluir esta mensagem?', okLabel: 'Excluir', cancelLabel: 'Cancelar', perigo: true,
    })
    if (!ok) return
    const r = await cfg.excluirMensagem(sel, m.id)
    if (r?.error) { toast(r.error, 'erro'); return }
    setMensagens(ms => ms.filter(x => x.id !== m.id))
    if (encaminhar?.id === m.id) setEncaminhar(null)
    if (editando?.id === m.id) { setEditando(null); setTexto('') }
    carregarConversas() // a prévia na lista pode ser a mensagem que acabou de sair
  }

  async function abrir(id: string) {
    setSel(id)
    setSugestoes([]); setSugestoesAbertas(false) // sugestão é da conversa anterior
    const d = await cfg.historico(id)
    if (d) setMensagens(Array.isArray(d.mensagens) ? d.mensagens : [])
    setConversas(cs => cs.map(c => c.id === id ? { ...c, naoLidas: 0 } : c))
  }
  async function enviar() {
    const t = texto.trim()
    if (!t || !sel || enviando) return
    // Modo edição: regrava a mensagem enviada (regra dos ~15 min do WhatsApp)
    if (editando) {
      setEnviando(true)
      const r = await fetch('/api/crm/mensagens', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telefone: sel, editarMsgId: editando.id, novoTexto: t }) }).then(x => x.json()).catch(() => null)
      setEnviando(false)
      if (r?.ok) { toast('Mensagem editada.', 'sucesso'); setEditando(null); setTexto(''); abrir(sel); carregarConversas() }
      else toast(r?.error || 'Não foi possível editar.', 'erro')
      return
    }
    setEnviando(true); setTexto('')
    const r = await cfg.enviar(sel, t)
    setEnviando(false)
    if (!r?.ok) toast(r?.error || 'Não foi possível enviar.', r?.registrado ? 'info' : 'erro')
    abrir(sel); carregarConversas()
  }
  // Encaminha a mensagem escolhida para OUTRA conversa (texto ou mídia do Blob)
  async function encaminharPara(destinoId: string) {
    if (!encaminhar) return
    const m = encaminhar
    setEncaminhar(null)
    const body: any = { telefone: destinoId }
    if (m.midiaUrl && m.tipo) {
      body.midia = { tipo: m.tipo, url: m.midiaUrl, ...(m.mimetype ? { mimetype: m.mimetype } : {}), ...(m.fileName ? { fileName: m.fileName } : {}) }
      if (m.texto && !ehRotuloMidia(m.texto)) body.texto = m.texto
    } else {
      body.texto = m.texto
    }
    const r = await fetch('/api/crm/mensagens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => null)
    if (r?.ok) { toast('Mensagem encaminhada.', 'sucesso'); if (destinoId === sel) abrir(sel); carregarConversas() }
    else toast(r?.error || 'Não foi possível encaminhar.', 'erro')
  }
  async function vincular(contatoId: string) {
    if (!sel) return
    await cfg.vincular(sel, contatoId)
    carregarConversas()
  }
  // Exclui a conversa aberta (histórico + metadados). O número volta a aparecer
  // se mandar mensagem de novo (o webhook recria a conversa do zero).
  async function excluirConversa() {
    if (!sel || !cfg.excluir) return
    const quem = conversaSel ? nomeDe(conversaSel) : cfg.subId(conversaSel, sel)
    if (!(await confirmar(`Excluir a conversa com "${quem}"? Todo o histórico de mensagens será removido. Esta ação não pode ser desfeita.`, { titulo: 'Excluir conversa', okLabel: 'Excluir', perigo: true }))) return
    const r = await cfg.excluir(sel)
    if (r?.ok) { toast('Conversa excluída.', 'sucesso'); setSel(''); setMensagens([]); carregarConversas() }
    else toast(r?.error || 'Não foi possível excluir a conversa.', 'erro')
  }
  // Criar contato a partir da conversa: abre a ficha normal (já com o telefone e
  // o nome que vieram do WhatsApp) e vincula a conversa assim que salvar.
  const [contatoNovo, setContatoNovo] = useState<{ nome: string; telefone: string } | null>(null)
  async function contatoNovoSalvo(criado?: Contato) {
    setContatoNovo(null)
    if (!criado?.id || !sel) return
    await cfg.vincular(sel, criado.id)
    onContatosMudou?.(); carregarConversas()
    toast('Contato criado e vinculado.', 'sucesso')
  }

  // Troca de canal (e carga inicial): reseta a seleção e recarrega
  useEffect(() => { try { sessionStorage.setItem('crm_canal', canal) } catch {}; setSel(''); setMensagens([]); setCarregando(true); carregarConversas() }, [canal])
  // Atualiza a conversa aberta periodicamente (recebe respostas do lead)
  useEffect(() => {
    if (!sel) return
    const id = setInterval(() => { abrir(sel) }, 15000)
    return () => clearInterval(id)
  }, [sel])

  const conversaSel = conversas.find(c => c.id === sel)

  // Modelos de mensagem (respostas rápidas) — compartilhados pela equipe
  const [templates, setTemplates] = useState<{ id: string; titulo: string; texto: string }[]>([])
  const [modelosAberto, setModelosAberto] = useState(false)
  const [templForm, setTemplForm] = useState<{ titulo: string; texto: string } | null>(null)
  const carregarTemplates = useCallback(() => {
    fetch('/api/crm/msg-templates').then(r => r.json()).then(d => { if (Array.isArray(d?.templates)) setTemplates(d.templates) }).catch(() => {})
  }, [])
  useEffect(() => { carregarTemplates() }, [carregarTemplates])
  function resolverPlaceholders(txt: string): string {
    const nome = (conversaSel ? nomeDe(conversaSel) : '').trim()
    const primeiro = nome.split(/\s+/)[0] || ''
    return txt.replace(/\{nome\}/gi, nome).replace(/\{primeiro\}/gi, primeiro)
  }
  function inserirModelo(t: { texto: string }) {
    setTexto(prev => (prev.trim() ? prev.replace(/\s*$/, '') + '\n' : '') + resolverPlaceholders(t.texto))
    setModelosAberto(false)
  }
  async function salvarTemplate() {
    if (!templForm || !templForm.titulo.trim() || !templForm.texto.trim()) { toast('Informe título e texto do modelo.', 'erro'); return }
    const r = await fetch('/api/crm/msg-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(templForm) }).then(x => x.json()).catch(() => null)
    if (r?.ok) { setTemplates(r.templates || []); setTemplForm(null); toast('Modelo salvo.', 'sucesso') }
    else toast(r?.error || 'Falha ao salvar o modelo.', 'erro')
  }
  async function removerTemplate(id: string) {
    if (!(await confirmar('Remover este modelo?', { titulo: 'Modelos de mensagem', okLabel: 'Remover', perigo: true }))) return
    const r = await fetch('/api/crm/msg-templates', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).then(x => x.json()).catch(() => null)
    if (r?.ok) setTemplates(r.templates || [])
  }

  // Assistente de perguntas — lê a conversa + o playbook do CRM e sugere a
  // próxima pergunta. Nunca envia: a escolhida cai no compositor para editar.
  const [sugestoes, setSugestoes] = useState<{ pergunta: string; porque: string; fase: string }[]>([])
  const [sugerindo, setSugerindo] = useState(false)
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false)
  async function sugerirPerguntas() {
    if (!sel || sugerindo) return
    setSugerindo(true); setSugestoesAbertas(true); setModelosAberto(false)
    const r = await fetch('/api/crm/sugerir-perguntas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telefone: sel }) }).then(x => x.json()).catch(() => null)
    setSugerindo(false)
    if (r?.ok && Array.isArray(r.sugestoes)) setSugestoes(r.sugestoes)
    else { setSugestoesAbertas(false); toast(r?.error || 'Não foi possível sugerir perguntas.', 'erro') }
  }
  function inserirPergunta(p: string) {
    setTexto(prev => (prev.trim() ? prev.replace(/\s*$/, '') + '\n' : '') + p)
    setSugestoesAbertas(false)
  }

  // Abrir uma conversa específica (vindo da ficha do contato ou da oportunidade).
  // `abrirContatoId` = já sabemos de quem é o número, então a conversa nasce
  // VINCULADA: sem isso a tela mostrava o número cru e pedia "Vincular
  // contato..." para uma pessoa que estava cadastrada o tempo todo.
  useEffect(() => {
    if (!abrirTel) return
    const tel = telefoneWhatsApp(abrirTel)
    if (!tel) { onAbriuTel?.(); return }
    if (canal !== 'whatsapp') { setCanal('whatsapp'); return }
    setConversas(cs => cs.some(c => c.id === tel) ? cs : [{ telefone: tel, id: tel, ...(abrirContatoId ? { contatoId: abrirContatoId } : {}) } as any, ...cs])
    abrir(tel)
    if (abrirContatoId) {
      const ja = conversas.find(c => c.id === tel)?.contatoId
      if (ja !== abrirContatoId) cfg.vincular(tel, abrirContatoId).then(() => carregarConversas()).catch(() => {})
    }
    onAbriuTel?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirTel, abrirContatoId, canal])

  // Busca de conversas: por nome/telefone/última mensagem (instantâneo, no cliente)
  // + busca full-text no histórico inteiro (no servidor, com debounce).
  const [busca, setBusca] = useState('')
  const buscaLc = busca.trim().toLowerCase()
  const [matchesTexto, setMatchesTexto] = useState<Record<string, string>>({}) // tel -> trecho
  const [buscandoTexto, setBuscandoTexto] = useState(false)
  useEffect(() => {
    const q = busca.trim()
    if (!cfg.buscar || q.length < 2) { setMatchesTexto({}); setBuscandoTexto(false); return }
    setBuscandoTexto(true)
    let vivo = true
    const t = setTimeout(async () => {
      const ms = await cfg.buscar!(q)
      if (!vivo) return
      const mapa: Record<string, string> = {}
      ms.forEach(m => { mapa[m.tel] = m.snippet })
      setMatchesTexto(mapa); setBuscandoTexto(false)
    }, 350)
    return () => { vivo = false; clearTimeout(t) }
  }, [busca, canal])
  const conversasFiltradas = buscaLc
    ? conversas.filter(c => `${nomeDe(c)} ${c.telefone || ''} ${c.ultimaMsg || ''}`.toLowerCase().includes(buscaLc) || !!matchesTexto[c.id])
    : conversas

  return (
    <div>
      {/* Seletor de canal (Instagram oculto no perfil clínica) */}
      {CANAIS.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {CANAIS.map(c => (
            <button key={c} onClick={() => setCanal(c)} style={{ padding: '7px 16px', borderRadius: 999, border: `1.5px solid ${canal === c ? CANAL_CFG[c].cor : '#e5e5e5'}`, background: canal === c ? CANAL_CFG[c].cor : '#fff', color: canal === c ? '#fff' : '#666', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
              {c === 'whatsapp' ? 'WhatsApp' : 'Instagram'}
            </button>
          ))}
        </div>
      )}
      {cfg.conectarUrl && (
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {contas.length > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#166534', background: '#dcfce7', borderRadius: 999, padding: '5px 12px' }}>
              ✓ Conectada: {contas.map((c: any) => `@${c.username || c.userId}`).join(', ')}
            </span>
          )}
          <button onClick={() => { window.location.href = cfg.conectarUrl! }}
            style={{ padding: '8px 16px', background: contas.length > 0 ? '#fff' : cfg.cor, color: contas.length > 0 ? cfg.cor : '#fff', border: contas.length > 0 ? `1.5px solid ${cfg.cor}` : 'none', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
            {contas.length > 0 ? 'Reconectar / adicionar conta' : 'Conectar conta do Instagram (mensagens)'}
          </button>
          <span style={{ fontSize: 11, color: '#888' }}>Conta de mensagens da própria agência (login de admin, conta profissional/testador).</span>
        </div>
      )}
      {!configurado && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '11px 14px', marginBottom: 14, fontSize: 12.5, color: '#92400e' }}>
          {cfg.aviso}
        </div>
      )}
      <div style={{ display: 'flex', gap: 14, height: 'min(620px, 70vh)', border: '1px solid #eee', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
        {/* Lista de conversas */}
        <div style={{ width: 280, borderRight: '1px solid #f0f0f0', overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 8, borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou dentro da conversa..." style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #e6e6e6', fontSize: 12.5, fontFamily: 'inherit' }} />
            {buscandoTexto && <p style={{ margin: '6px 2px 0', fontSize: 10.5, color: '#bbb' }}>Procurando no histórico das conversas…</p>}
          </div>
          {carregando ? <p style={{ padding: 16, color: '#aaa', fontSize: 13 }}>Carregando...</p>
            : conversas.length === 0 ? <p style={{ padding: 16, color: '#bbb', fontSize: 13 }}>Nenhuma conversa ainda.</p>
            : conversasFiltradas.length === 0 ? <p style={{ padding: 16, color: '#bbb', fontSize: 13 }}>{buscandoTexto ? 'Procurando…' : `Nada encontrado para “${busca}”.`}</p>
            : conversasFiltradas.map(c => {
              const trecho = matchesTexto[c.id]
              return (
              <button key={c.id} onClick={() => encaminhar ? encaminharPara(c.id) : abrir(c.id)} title={encaminhar ? 'Encaminhar para esta conversa' : undefined} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', borderBottom: '1px solid #f5f5f5', background: sel === c.id ? '#f0f9ff' : encaminhar ? '#fffbeb' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                <AvatarConv foto={c.foto} nome={nomeDe(c)} cor={cfg.cor} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomeDe(c)}</span>
                    {!!c.naoLidas && <span style={{ background: cfg.cor, color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 800, padding: '1px 7px', flexShrink: 0 }}>{c.naoLidas}</span>}
                  </span>
                  {trecho
                    ? <span style={{ fontSize: 11, color: '#a16207', background: '#fef9c3', borderRadius: 5, padding: '1px 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trecho}</span>
                    : <span style={{ fontSize: 11.5, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.ultimaMsg || '—'}</span>}
                </span>
              </button>
              )
            })}
        </div>
        {/* Conversa */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {!sel ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 13 }}>Selecione uma conversa</div>
          ) : (<>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                {conversaSel && <AvatarConv foto={conversaSel.foto} nome={nomeDe(conversaSel)} cor={cfg.cor} />}
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conversaSel ? nomeDe(conversaSel) : sel}</p>
                  <p style={{ margin: 0, fontSize: 11.5, color: '#999' }}>{cfg.subId(conversaSel, sel)}</p>
                </div>
              </div>
              {/* Com o contato vinculado, a conversa vira venda em 1 clique */}
              {conversaSel?.contatoId && onAbrirOportunidade && (
                <button onClick={() => onAbrirOportunidade(conversaSel.contatoId!)} title="Criar uma oportunidade no funil para este contato"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'var(--marca, #ffc00f)', color: 'var(--marca-texto, #111)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                  Abrir oportunidade
                </button>
              )}
              {/* Vincular contato — seletor com BUSCA (a lista tem centenas) */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button onClick={() => { setVincularAberto(v => !v); setBuscaVinculo('') }} title="Vincular a um contato do CRM"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: 190, padding: '6px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, background: '#fff', cursor: 'pointer', color: conversaSel?.contatoId ? '#111' : '#888', fontWeight: conversaSel?.contatoId ? 700 : 400 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conversaSel?.contatoId ? (contatos.find(ct => ct.id === conversaSel.contatoId)?.nome || 'Contato vinculado') : 'Vincular contato...'}
                  </span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}><path d="M6 9l6 6 6-6" /></svg>
                </button>
                {vincularAberto && (<>
                  <div onClick={fecharFora(() => setVincularAberto(false), { perguntar: false })} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
                  <div style={{ position: 'absolute', top: 'calc(100% + 5px)', right: 0, width: 260, background: '#fff', border: '1px solid #e6e6e6', borderRadius: 11, boxShadow: '0 8px 30px rgba(0,0,0,0.16)', zIndex: 31, overflow: 'hidden' }}>
                    <div style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                      <input autoFocus value={buscaVinculo} onChange={e => setBuscaVinculo(e.target.value)} placeholder="Buscar por nome ou telefone…"
                        style={{ width: '100%', boxSizing: 'border-box', padding: '7px 9px', borderRadius: 7, border: '1px solid #e6e6e6', fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }} />
                    </div>
                    <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                      <button onClick={() => { setVincularAberto(false); setContatoNovo({ nome: (conversaSel?.nome || '').trim(), telefone: canal === 'whatsapp' ? sel : '' }) }}
                        style={{ width: '100%', textAlign: 'left', padding: '9px 11px', border: 'none', borderBottom: '1px solid #f5f5f5', background: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#1d4ed8' }}>＋ Criar contato novo</button>
                      {conversaSel?.contatoId && (
                        <button onClick={() => { vincular(''); setVincularAberto(false) }}
                          style={{ width: '100%', textAlign: 'left', padding: '9px 11px', border: 'none', borderBottom: '1px solid #f5f5f5', background: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: '#b91c1c' }}>Desvincular</button>
                      )}
                      {contatosVinculo.length === 0 ? (
                        <p style={{ margin: 0, padding: '12px 11px', fontSize: 12, color: '#bbb' }}>Nenhum contato encontrado.</p>
                      ) : contatosVinculo.map(ct => (
                        <button key={ct.id} onClick={() => { vincular(ct.id); setVincularAberto(false) }}
                          style={{ width: '100%', textAlign: 'left', padding: '8px 11px', border: 'none', borderBottom: '1px solid #f8f8f8', background: conversaSel?.contatoId === ct.id ? '#f0f9ff' : '#fff', cursor: 'pointer' }}>
                          <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ct.nome}</span>
                          {ct.telefone && <span style={{ display: 'block', fontSize: 11, color: '#999' }}>{ct.telefone}</span>}
                        </button>
                      ))}
                      {!buscaVinculo && contatos.length > 50 && (
                        <p style={{ margin: 0, padding: '8px 11px', fontSize: 11, color: '#bbb', borderTop: '1px solid #f5f5f5' }}>Mostrando 50 de {contatos.length} — use a busca.</p>
                      )}
                    </div>
                  </div>
                </>)}
              </div>
              {cfg.excluir && (
                <button onClick={excluirConversa} title="Excluir conversa (remove todo o histórico)"
                  style={{ background: 'transparent', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                  Excluir
                </button>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8, background: '#fafafa' }}>
              {mensagens.length === 0 ? <p style={{ color: '#bbb', fontSize: 13, textAlign: 'center', margin: 'auto' }}>Sem mensagens.</p>
                : mensagens.map(m => {
                  const textoVisivel = m.midiaUrl && ehRotuloMidia(m.texto) ? '' : m.texto
                  // No grupo, mostra quem falou (avatar ao lado da bolha).
                  const comAutor = !!(conversaSel as any)?.grupo && m.de === 'cliente'
                  return (
                  <div key={m.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-end', alignSelf: m.de === 'agente' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                  {comAutor && <AvatarConv foto={m.autorFoto} nome={m.autor || '?'} cor={cfg.cor} tam={26} />}
                  <div style={{ padding: '8px 12px', borderRadius: 12, fontSize: 13, lineHeight: 1.45, background: m.de === 'agente' ? cfg.bolha : '#fff', border: m.de === 'agente' ? 'none' : '1px solid #ececec', color: '#222', whiteSpace: 'pre-wrap', wordBreak: 'break-word', minWidth: 0 }}>
                    {m.midiaUrl && m.tipo === 'imagem' && (
                      <button type="button" onClick={() => setLightbox({ url: midiaSrc(m.midiaUrl!), nome: m.fileName || nomeArquivoMidia(m) })} title="Ver imagem"
                        style={{ padding: 0, border: 'none', background: 'none', cursor: 'zoom-in', display: 'block', width: '100%' }}>
                        <img src={midiaSrc(m.midiaUrl)} alt="" style={{ maxWidth: 240, width: '100%', borderRadius: 8, display: 'block', marginBottom: textoVisivel ? 6 : 0 }} />
                      </button>
                    )}
                    {m.midiaUrl && m.tipo === 'figurinha' && (
                      <img src={midiaSrc(m.midiaUrl)} alt="" style={{ width: 110, display: 'block', marginBottom: textoVisivel ? 6 : 0 }} />
                    )}
                    {m.midiaUrl && m.tipo === 'video' && (
                      <video src={midiaSrc(m.midiaUrl)} controls preload="metadata" style={{ maxWidth: 260, width: '100%', borderRadius: 8, display: 'block', marginBottom: textoVisivel ? 6 : 0 }} />
                    )}
                    {m.midiaUrl && m.tipo === 'audio' && (
                      <audio src={midiaSrc(m.midiaUrl)} controls preload="metadata" style={{ maxWidth: 240, display: 'block', marginBottom: textoVisivel ? 6 : 0 }} />
                    )}
                    {m.midiaUrl && m.tipo === 'documento' && (
                      <a href={midiaSrc(m.midiaUrl)} download={m.fileName || nomeArquivoMidia(m)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#1d4ed8', fontWeight: 700, textDecoration: 'none', marginBottom: textoVisivel ? 6 : 0 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2zM14 2v6h6" /></svg>
                        {m.fileName || 'Baixar documento'}
                      </a>
                    )}
                    {!m.midiaUrl && m.tipo && <span style={{ fontStyle: 'italic', color: '#999' }}>{m.texto || '[mídia]'} <span style={{ fontSize: 10.5 }}>(mídia não disponível)</span></span>}
                    {textoVisivel && (!m.tipo || m.midiaUrl) && comLinks(textoVisivel)}
                    <span style={{ display: 'block', fontSize: 9.5, color: '#999', marginTop: 3, textAlign: 'right' }}>{m.editada ? 'editada · ' : ''}{m.autor ? `${m.autor} · ` : ''}{new Date(m.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    {(m.texto || m.midiaUrl) && (
                      <span style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 2 }}>
                        {canal === 'whatsapp' && (
                          <button onClick={() => { setEditando(null); setEncaminhar(m) }} title="Encaminhar para outra conversa"
                            style={{ background: 'none', border: 'none', color: '#8aa', cursor: 'pointer', fontSize: 10, fontWeight: 800, padding: 0 }}>Encaminhar</button>
                        )}
                        {canal === 'whatsapp' && m.de === 'agente' && !m.tipo && (Date.now() - new Date(m.em).getTime()) < 15 * 60 * 1000 && (
                          <button onClick={() => { setEncaminhar(null); setEditando(m); setTexto(m.texto) }} title="Editar (até ~15 min após o envio)"
                            style={{ background: 'none', border: 'none', color: '#8aa', cursor: 'pointer', fontSize: 10, fontWeight: 800, padding: 0 }}>Editar</button>
                        )}
                        {podeExcluir && cfg.excluirMensagem && (
                          <button onClick={() => excluirMensagem(m)} title="Excluir do Soma10 (não apaga no aparelho do cliente)"
                            style={{ background: 'none', border: 'none', color: '#c88', cursor: 'pointer', fontSize: 10, fontWeight: 800, padding: 0 }}>Excluir</button>
                        )}
                      </span>
                    )}
                  </div>
                  </div>
                  )
                })}
            </div>
            {(encaminhar || editando) && (
              <div style={{ borderTop: '1px solid #f0f0f0', padding: '7px 12px', background: '#fffbeb', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#92400e', fontWeight: 600 }}>
                {encaminhar ? 'Encaminhando — clique numa conversa da lista à esquerda para enviar.' : 'Editando mensagem enviada — altere o texto e confirme (vale até ~15 min).'}
                <span style={{ flex: 1 }} />
                <button onClick={() => { setEncaminhar(null); if (editando) { setEditando(null); setTexto('') } }}
                  style={{ background: 'none', border: 'none', color: '#92400e', fontWeight: 800, cursor: 'pointer', fontSize: 12, padding: 0 }}>Cancelar</button>
              </div>
            )}
            <div style={{ borderTop: '1px solid #f0f0f0', padding: 10, display: 'flex', gap: 8, alignItems: 'flex-end', position: 'relative' }}>
              {/* Popover de modelos de mensagem */}
              {modelosAberto && (
                <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 10, right: 10, maxHeight: 320, overflowY: 'auto', background: '#fff', border: '1px solid #e6e6e6', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.16)', padding: 10, zIndex: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: '#111' }}>Modelos de mensagem</span>
                    <span style={{ flex: 1 }} />
                    {!templForm && <button onClick={() => setTemplForm({ titulo: '', texto: '' })} style={{ padding: '4px 10px', background: '#f4f4f5', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 11.5, cursor: 'pointer', color: '#333' }}>+ Novo</button>}
                    <button onClick={() => { setModelosAberto(false); setTemplForm(null) }} style={{ padding: '4px 8px', background: 'transparent', border: 'none', fontSize: 15, cursor: 'pointer', color: '#999' }}>×</button>
                  </div>
                  {templForm && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 9, padding: 9, marginBottom: 8 }}>
                      <input value={templForm.titulo} onChange={e => setTemplForm(f => f && { ...f, titulo: e.target.value })} placeholder="Título (ex.: Confirmar consulta)" style={{ padding: '7px 9px', borderRadius: 7, border: '1px solid #e6e6e6', fontSize: 12.5, fontFamily: 'inherit' }} />
                      <textarea value={templForm.texto} onChange={e => setTemplForm(f => f && { ...f, texto: e.target.value })} placeholder="Texto do modelo. Use {primeiro} ou {nome} para o nome do contato." rows={3} style={{ padding: '7px 9px', borderRadius: 7, border: '1px solid #e6e6e6', fontSize: 12.5, fontFamily: 'inherit', resize: 'vertical' }} />
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button onClick={() => setTemplForm(null)} style={{ padding: '6px 11px', background: '#f0f0f0', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 12, cursor: 'pointer', color: '#666' }}>Cancelar</button>
                        <button onClick={salvarTemplate} style={{ padding: '6px 12px', background: '#111', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Salvar</button>
                      </div>
                    </div>
                  )}
                  {templates.length === 0 && !templForm && <p style={{ margin: '4px 2px', fontSize: 12, color: '#aaa' }}>Nenhum modelo ainda. Crie respostas rápidas para agilizar o atendimento.</p>}
                  {templates.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 4px', borderTop: '1px solid #f5f5f5' }}>
                      <button onClick={() => inserirModelo(t)} title="Inserir no compositor" style={{ flex: 1, textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#111' }}>{t.titulo}</span>
                        <span style={{ display: 'block', fontSize: 11.5, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.texto}</span>
                      </button>
                      <button onClick={() => removerTemplate(t.id)} title="Remover" style={{ background: 'transparent', border: 'none', color: '#c0392b', fontSize: 13, cursor: 'pointer', padding: '2px 5px', flexShrink: 0 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              {/* Popover do assistente — perguntas sugeridas a partir do playbook */}
              {sugestoesAbertas && (
                <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 10, right: 10, maxHeight: 320, overflowY: 'auto', background: '#fff', border: '1px solid #e6e6e6', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.16)', padding: 10, zIndex: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: '#111' }}>Próximas perguntas</span>
                    <span style={{ flex: 1 }} />
                    {!sugerindo && sugestoes.length > 0 && <button onClick={sugerirPerguntas} style={{ padding: '4px 10px', background: '#f4f4f5', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 11.5, cursor: 'pointer', color: '#333' }}>Gerar de novo</button>}
                    <button onClick={() => setSugestoesAbertas(false)} style={{ padding: '4px 8px', background: 'transparent', border: 'none', fontSize: 15, cursor: 'pointer', color: '#999' }}>×</button>
                  </div>
                  {sugerindo && <p style={{ margin: '4px 2px', fontSize: 12, color: '#aaa' }}>Lendo a conversa e o playbook...</p>}
                  {!sugerindo && sugestoes.map((s, i) => (
                    <button key={i} onClick={() => inserirPergunta(s.pergunta)} title="Inserir no compositor"
                      style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderTop: i ? '1px solid #f5f5f5' : 'none', cursor: 'pointer', padding: '8px 4px' }}>
                      <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#111' }}>{s.pergunta}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: '#999', marginTop: 2 }}>{[s.fase, s.porque].filter(Boolean).join(' · ')}</span>
                    </button>
                  ))}
                  {!sugerindo && <p style={{ margin: '8px 2px 2px', fontSize: 11, color: '#bbb' }}>Sugestões da IA a partir do playbook. Revise antes de enviar.</p>}
                </div>
              )}
              <button onClick={() => { setModelosAberto(v => !v); setSugestoesAbertas(false) }} title="Modelos de mensagem" style={{ padding: '9px 12px', background: modelosAberto ? '#111' : '#f4f4f5', color: modelosAberto ? '#fff' : '#444', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', flexShrink: 0 }}>Modelos</button>
              {canal === 'whatsapp' && (
                <button onClick={() => (sugestoesAbertas ? setSugestoesAbertas(false) : sugerirPerguntas())} disabled={sugerindo} title="Sugerir a próxima pergunta com base no playbook"
                  style={{ padding: '9px 12px', background: sugestoesAbertas ? '#111' : '#f4f4f5', color: sugestoesAbertas ? '#fff' : '#444', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: sugerindo ? 'wait' : 'pointer', flexShrink: 0 }}>
                  {sugerindo ? '...' : 'Sugerir'}
                </button>
              )}
              <textarea value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                placeholder="Escreva uma mensagem..." rows={1} style={{ flex: 1, resize: 'none', maxHeight: 110, border: '1px solid #e2e2e2', borderRadius: 10, padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
              <button onClick={enviar} disabled={!texto.trim() || enviando} style={{ padding: '9px 18px', background: texto.trim() && !enviando ? '#111' : '#eee', color: texto.trim() && !enviando ? '#fff' : '#aaa', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: texto.trim() && !enviando ? 'pointer' : 'not-allowed' }}>{enviando ? '...' : 'Enviar'}</button>
            </div>
          </>)}
        </div>
      </div>

      {/* Contato criado a partir da conversa — ficha normal, sem prompt do navegador */}
      {contatoNovo && (
        <ContatoModal contato={null} prefill={contatoNovo} perfilClinica={perfilClinica} tipoPadrao="lead"
          onClose={() => setContatoNovo(null)} onSalvo={contatoNovoSalvo} />
      )}

      {/* Visualizador de imagem — abre sobre a conversa (sem perder o contexto).
          Fecha no ESC, no X ou clicando fora; permite baixar no computador. */}
      {lightbox && (
        <div onClick={fecharFora(() => setLightbox(null), { perguntar: false })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 24, flexDirection: 'column', gap: 12 }}>
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 10, alignSelf: 'flex-end' }}>
            <a href={lightbox.url} download={lightbox.nome} title="Baixar no computador"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fff', color: '#111', borderRadius: 9, fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
              Baixar
            </a>
            <button onClick={() => setLightbox(null)} title="Fechar (Esc)"
              style={{ width: 34, height: 34, borderRadius: 9, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 20, lineHeight: 1, cursor: 'pointer' }}>×</button>
          </div>
          <img onClick={e => e.stopPropagation()} src={lightbox.url} alt=""
            style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 120px)', objectFit: 'contain', borderRadius: 10, background: '#fff' }} />
        </div>
      )}
    </div>
  )
}
