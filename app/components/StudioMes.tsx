'use client'
import { useEffect, useRef, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'

// ===== Studio (Fase 1) — tabela viva do mês por cliente =====
// Substitui o kanban de 6 colunas por uma linha por pauta, editável inline.
// Os estados fluem sozinhos: rascunho da IA -> equipe adiciona criativo -> envia
// ao cliente (link único) -> aprovado/agendado -> publicado. Mede a taxa de
// edição (quanto a equipe ajusta o que a IA gerou) desde o dia 1 — prova da Fase 0.

type Cliente = { id: string; nome: string; logo?: string; corPrimaria?: string; corSecundaria?: string }
type Plano = { id: string; clienteId: string; clienteNome: string; mes: number; ano: number; titulo?: string }
type Pauta = {
  id: string; clienteId: string; clienteNome: string; imagens: string[]; legenda: string
  status: string; formato?: string; etapa?: string; briefing?: string; planoId?: string
  sugestaoImagem?: string; textoImagem?: string; sugestaoLegenda?: string
  dataAgendada?: string; codigo?: string; colaboradores?: string[]; capasVideo?: Record<string, string>; redes?: string[]
  ajusteCopy?: string; ajusteCriativo?: string; motivoReprovacao?: string; anotacoes?: any[]
  criadoEm?: string; atualizadoEm?: string
  iaGerado?: { briefing?: string; legenda?: string; sugestaoImagem?: string; textoImagem?: string; formato?: string; geradoEm: string }
  editadoAposIA?: boolean
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const FORMATOS = [
  { key: 'feed', label: 'Feed', cor: '#1d4ed8' },
  { key: 'reel', label: 'Reel', cor: '#dc2626' },
  { key: 'carrossel', label: 'Carrossel', cor: '#0891b2' },
  { key: 'story', label: 'Story', cor: '#7c3aed' },
]

// Estado da linha e a ação natural seguinte (o "próximo passo" de cada pauta).
function estadoStudio(p: Pauta): { label: string; cor: string; bg: string } {
  switch (p.status) {
    case 'publicado': return { label: 'Publicado', cor: '#166534', bg: '#dcfce7' }
    case 'agendado': return { label: 'Agendado', cor: '#a16207', bg: '#fef9c3' }
    case 'aprovado': return { label: 'Aprovado', cor: '#166534', bg: '#dcfce7' }
    case 'aguardando_aprovacao': return { label: 'No cliente', cor: '#92400e', bg: '#fef3c7' }
    case 'corrigir': return { label: 'Ajuste pedido', cor: '#b45309', bg: '#fff3cd' }
    case 'reprovado': return { label: 'Reprovado', cor: '#b91c1c', bg: '#fee2e2' }
    case 'falha_publicacao': return { label: 'Falha', cor: '#b91c1c', bg: '#fee2e2' }
    default: // rascunho
      return (p.imagens || []).length > 0
        ? { label: 'Pronto p/ enviar', cor: '#1d4ed8', bg: '#eff6ff' }
        : { label: 'Rascunho', cor: '#666', bg: '#f0f0f0' }
  }
}

function toLocalInput(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso); if (isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

// Célula com edição inline — salva no blur só quando muda (isola re-render).
function CelulaEditavel({ valor, onSalvar, placeholder, editavel, largura }: {
  valor?: string; onSalvar: (v: string) => Promise<void>; placeholder?: string; editavel: boolean; largura: number
}) {
  const [v, setV] = useState(valor || '')
  const [estado, setEstado] = useState<'idle' | 'salvando' | 'ok'>('idle')
  const original = useRef(valor || '')
  const focado = useRef(false)
  useEffect(() => { if (!focado.current) { setV(valor || ''); original.current = valor || '' } }, [valor])

  if (!editavel) return <div style={{ fontSize: 12.5, color: '#333', whiteSpace: 'pre-wrap', width: largura }}>{v || <span style={{ color: '#ccc' }}>—</span>}</div>

  async function blur() {
    focado.current = false
    if (v === original.current) return
    setEstado('salvando')
    await onSalvar(v)
    original.current = v
    setEstado('ok'); setTimeout(() => setEstado('idle'), 1200)
  }
  return (
    <div style={{ position: 'relative', width: largura }}>
      <textarea value={v} placeholder={placeholder}
        onFocus={() => { focado.current = true }}
        onChange={e => setV(e.target.value)} onBlur={blur}
        rows={1}
        style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', border: '1px solid transparent', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit', resize: 'vertical', minHeight: 34, background: 'transparent', color: '#222', lineHeight: 1.4 }}
        onMouseEnter={e => { (e.target as HTMLElement).style.border = '1px solid #e5e7eb' }}
        onMouseLeave={e => { if (document.activeElement !== e.target) (e.target as HTMLElement).style.border = '1px solid transparent' }} />
      {estado !== 'idle' && (
        <span style={{ position: 'absolute', top: 4, right: 6, fontSize: 9, fontWeight: 700, color: estado === 'ok' ? '#16a34a' : '#999' }}>
          {estado === 'ok' ? '✓ salvo' : 'salvando…'}
        </span>
      )}
    </div>
  )
}

export default function StudioMes({ clientes, clienteFixo, onAbrirComposer, podeEditar = true, podeExcluir = true }: {
  clientes: Cliente[]
  clienteFixo?: string
  onAbrirComposer?: (pauta: Pauta) => void
  podeEditar?: boolean
  podeExcluir?: boolean
}) {
  const [planos, setPlanos] = useState<Plano[]>([])
  const [planoSel, setPlanoSel] = useState('')
  const [pautas, setPautas] = useState<Pauta[]>([])
  const [carregando, setCarregando] = useState(false)
  const [novoPlano, setNovoPlano] = useState(false)
  const [formPlano, setFormPlano] = useState({ clienteId: clienteFixo || '', mes: new Date().getMonth() + 1, ano: new Date().getFullYear() })
  const [gerandoIA, setGerandoIA] = useState(false)
  const [iaMsg, setIaMsg] = useState('')
  const [criandoLinha, setCriandoLinha] = useState(false)

  function carregarPlanos() {
    const url = clienteFixo ? `/api/planos?clienteId=${clienteFixo}` : '/api/planos'
    fetch(url).then(r => r.json()).then(d => {
      const lista = Array.isArray(d) ? d : []
      setPlanos(lista)
      if (!planoSel && lista.length > 0) setPlanoSel(lista[0].id)
    }).catch(() => {})
  }
  useEffect(() => { carregarPlanos() }, [clienteFixo])

  function carregarPautas(planoId: string) {
    if (!planoId) { setPautas([]); return }
    setCarregando(true)
    fetch(`/api/planos?id=${planoId}&pautas=1`).then(r => r.json())
      .then(d => setPautas(ordenar(d?.pautas || [])))
      .finally(() => setCarregando(false))
  }
  useEffect(() => { carregarPautas(planoSel) }, [planoSel])

  function ordenar(lista: Pauta[]) {
    return [...lista].sort((a, b) => {
      const da = a.dataAgendada ? new Date(a.dataAgendada).getTime() : Infinity
      const db = b.dataAgendada ? new Date(b.dataAgendada).getTime() : Infinity
      if (da !== db) return da - db
      return (a.criadoEm || '').localeCompare(b.criadoEm || '')
    })
  }

  async function criarPlano() {
    const cid = clienteFixo || formPlano.clienteId
    if (!cid) return
    const cli = clientes.find(c => c.id === cid)
    const r = await fetch('/api/planos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId: cid, clienteNome: cli?.nome, mes: formPlano.mes, ano: formPlano.ano }),
    }).then(x => x.json())
    if (r?.plano) { setNovoPlano(false); carregarPlanos(); setPlanoSel(r.plano.id) }
  }

  // Salva um campo inline (otimista, sem recarregar tudo).
  async function salvarCampo(id: string, campo: string, valor: string) {
    setPautas(ps => ps.map(p => p.id === id ? { ...p, [campo]: valor } : p))
    await fetch('/api/posts', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, [campo]: valor }),
    }).catch(() => {})
  }

  async function salvarData(id: string, localValue: string) {
    const iso = localValue ? new Date(localValue).toISOString() : ''
    setPautas(ps => ps.map(p => p.id === id ? { ...p, dataAgendada: iso } : p))
    await fetch('/api/posts', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, dataAgendada: iso }),
    }).catch(() => {})
    setPautas(ps => ordenar(ps))
  }

  async function novaLinha() {
    const plano = planos.find(p => p.id === planoSel)
    if (!plano) return
    setCriandoLinha(true)
    await fetch('/api/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clienteId: plano.clienteId, clienteNome: plano.clienteNome, imagens: [], legenda: '',
        formato: 'feed', rascunhoInterno: true, planoId: plano.id, etapa: 'briefing', briefing: '',
      }),
    }).catch(() => {})
    setCriandoLinha(false)
    carregarPautas(planoSel)
  }

  async function gerarPlanoIA() {
    if (!planoSel) return
    if (!(await confirmar('A IA vai gerar as pautas do mês com base no Brand Board + Brand Playbook do cliente. Isso consome créditos da IA. Continuar?', { titulo: 'Gerar plano com IA', okLabel: 'Continuar' }))) return
    setGerandoIA(true); setIaMsg('Gerando pautas com IA... (pode levar até 1 minuto)')
    try {
      const r = await fetch('/api/esteira/gerar-plano', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planoId: planoSel, quantidade: 12 }),
      })
      const d = await r.json()
      if (!r.ok) { setIaMsg(d?.error || 'Falha ao gerar o plano.'); return }
      setIaMsg(`${d.quantidade} pautas criadas!`)
      carregarPautas(planoSel)
      setTimeout(() => setIaMsg(''), 6000)
    } catch { setIaMsg('Erro de conexão ao gerar o plano.') }
    finally { setGerandoIA(false) }
  }

  // Envia a pauta ao cliente: status aguardando_aprovacao + copia o link único.
  async function enviarAoCliente(p: Pauta) {
    if ((p.imagens || []).length === 0) {
      const ok = await confirmar('Esta pauta ainda não tem criativo (imagem/vídeo). O cliente verá só a legenda. Enviar assim mesmo?', { titulo: 'Sem criativo', okLabel: 'Enviar mesmo assim' })
      if (!ok) return
    }
    setPautas(ps => ps.map(x => x.id === p.id ? { ...x, status: 'aguardando_aprovacao' } : x))
    await fetch('/api/posts', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, status: 'aguardando_aprovacao' }),
    }).catch(() => {})
    const tk = await fetch('/api/aprovacao-link', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId: p.clienteId }),
    }).then(x => x.json()).catch(() => null)
    const url = tk?.token ? `${window.location.origin}/aprovacoes/${tk.token}` : ''
    if (url && navigator.clipboard?.writeText) navigator.clipboard.writeText(url).catch(() => {})
    toast(url ? `Enviado ao cliente! Link copiado — envie: ${url}` : 'Enviado ao cliente. Pegue o link em Configurações › Clientes.', 'sucesso')
    carregarPautas(planoSel)
  }

  async function copiarLink(clienteId: string) {
    const r = await fetch('/api/aprovacao-link', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId }),
    }).then(x => x.json()).catch(() => null)
    if (r?.token) {
      const link = `${window.location.origin}/aprovacoes/${r.token}`
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).then(() => toast('Link do cliente copiado!', 'sucesso')).catch(() => toast(link, 'info'))
      else toast(link, 'info')
    }
  }

  async function excluir(p: Pauta) {
    if (!(await confirmar('Excluir esta pauta? Será removida permanentemente.', { titulo: 'Excluir pauta', okLabel: 'Excluir', perigo: true }))) return
    setPautas(ps => ps.filter(x => x.id !== p.id))
    await fetch(`/api/posts?id=${p.id}`, { method: 'DELETE' }).catch(() => {})
  }

  // Métrica da Fase 0: quanto a equipe ajusta o que a IA gerou.
  const geradas = pautas.filter(p => p.iaGerado)
  const editadas = geradas.filter(p => p.editadoAposIA)
  const taxa = geradas.length ? Math.round((editadas.length / geradas.length) * 100) : null

  const larguras = { estado: 118, pauta: 240, copy: 300, criativo: 220, formato: 108, data: 168, acoes: 150 }
  const cabecalho: [string, number][] = [
    ['Estado', larguras.estado], ['Pauta / briefing', larguras.pauta], ['Copy (legenda)', larguras.copy],
    ['Direção de criativo', larguras.criativo], ['Formato', larguras.formato], ['Data', larguras.data], ['Ações', larguras.acoes],
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: '#111', display: 'flex', alignItems: 'center', gap: 8 }}>
            Studio
            <span style={{ fontSize: 10, fontWeight: 800, color: '#7c3aed', background: '#7c3aed12', border: '1px solid #7c3aed30', borderRadius: 999, padding: '2px 8px', textTransform: 'uppercase' }}>Beta</span>
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: '#999' }}>A IA opera a fábrica; você rege a orquestra. Edite qualquer célula direto na tabela.</p>
        </div>
        <select value={planoSel} onChange={e => setPlanoSel(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', minWidth: 220 }}>
          <option value="">Selecione um plano...</option>
          {planos.map(p => <option key={p.id} value={p.id}>{clienteFixo ? '' : `${p.clienteNome} — `}{MESES[p.mes - 1]}/{p.ano}{p.titulo ? ` · ${p.titulo}` : ''}</option>)}
        </select>
        {podeEditar && <button onClick={() => setNovoPlano(true)} style={{ padding: '9px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Novo plano</button>}
        {planoSel && podeEditar && <>
          <button onClick={novaLinha} disabled={criandoLinha} style={{ padding: '9px 16px', background: 'var(--marca, #ffc00f)', color: 'var(--marca-texto, #111)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: criandoLinha ? 'wait' : 'pointer' }}>+ Nova linha</button>
          <button onClick={gerarPlanoIA} disabled={gerandoIA} style={{ padding: '9px 16px', background: '#111', color: '#ffc00f', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: gerandoIA ? 'not-allowed' : 'pointer', opacity: gerandoIA ? 0.6 : 1 }}>
            {gerandoIA ? 'Gerando...' : 'Gerar plano com IA'}
          </button>
        </>}
      </div>

      {/* Form de novo plano */}
      {novoPlano && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 18, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {!clienteFixo && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Cliente</label>
              <select value={formPlano.clienteId} onChange={e => setFormPlano(f => ({ ...f, clienteId: e.target.value }))} style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, minWidth: 200 }}>
                <option value="">Selecione...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Mês</label>
            <select value={formPlano.mes} onChange={e => setFormPlano(f => ({ ...f, mes: Number(e.target.value) }))} style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13 }}>
              {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Ano</label>
            <input type="number" value={formPlano.ano} onChange={e => setFormPlano(f => ({ ...f, ano: Number(e.target.value) }))} style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, width: 90 }} />
          </div>
          <button onClick={criarPlano} disabled={!clienteFixo && !formPlano.clienteId} style={{ padding: '10px 20px', background: (clienteFixo || formPlano.clienteId) ? 'var(--marca, #ffc00f)' : '#f0f0f0', color: (clienteFixo || formPlano.clienteId) ? 'var(--marca-texto, #111)' : '#aaa', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: (clienteFixo || formPlano.clienteId) ? 'pointer' : 'not-allowed' }}>Criar plano</button>
          <button onClick={() => setNovoPlano(false)} style={{ padding: '10px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
        </div>
      )}

      {iaMsg && (
        <div style={{ background: iaMsg.includes('criadas') ? '#dcfce7' : iaMsg.includes('Gerando') ? '#eff6ff' : '#fef2f2', border: `1px solid ${iaMsg.includes('criadas') ? '#86efac' : iaMsg.includes('Gerando') ? '#bfdbfe' : '#fecaca'}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: iaMsg.includes('criadas') ? '#166534' : iaMsg.includes('Gerando') ? '#1d4ed8' : '#b91c1c', display: 'flex', alignItems: 'center', gap: 10 }}>
          {gerandoIA && <span style={{ width: 14, height: 14, border: '2px solid #bfdbfe', borderTopColor: '#1d4ed8', borderRadius: '50%', display: 'inline-block', animation: 'girar 0.8s linear infinite', flexShrink: 0 }} />}
          {iaMsg}
          {gerandoIA && <style>{`@keyframes girar{to{transform:rotate(360deg)}}`}</style>}
        </div>
      )}

      {/* Barra de métricas — taxa de edição (payoff da Fase 0) */}
      {planoSel && pautas.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '8px 14px', fontSize: 12.5 }}>
            <strong style={{ fontSize: 16, color: '#111' }}>{pautas.length}</strong> <span style={{ color: '#888' }}>pautas no mês</span>
          </div>
          {taxa !== null && (
            <div title="Quantas pautas geradas pela IA a equipe ajustou. Alta = matéria-prima ainda precisa de trabalho; baixa = IA acertando bem." style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '8px 14px', fontSize: 12.5 }}>
              <strong style={{ fontSize: 16, color: taxa >= 60 ? '#b45309' : '#16a34a' }}>{taxa}%</strong>{' '}
              <span style={{ color: '#888' }}>taxa de edição — {editadas.length} de {geradas.length} pautas da IA ajustadas</span>
            </div>
          )}
        </div>
      )}

      {/* Tabela viva */}
      {!planoSel ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa', background: '#fff', borderRadius: 14, border: '1px solid #eee' }}>
          <p style={{ margin: 0 }}>Selecione ou crie um plano para abrir o Studio do mês.</p>
        </div>
      ) : carregando ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>Carregando pautas...</div>
      ) : pautas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 50, color: '#aaa', background: '#fff', borderRadius: 14, border: '1px solid #eee' }}>
          <p style={{ margin: '0 0 6px' }}>Nenhuma pauta neste plano ainda.</p>
          {podeEditar && <p style={{ margin: 0, fontSize: 13 }}>Clique em <strong>Gerar plano com IA</strong> para a IA propor o mês, ou <strong>+ Nova linha</strong> para começar do zero.</p>}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 14, border: '1px solid #eee' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1150 }}>
            <thead>
              <tr style={{ background: '#fafafa', borderBottom: '1.5px solid #eee' }}>
                {cabecalho.map(([t, w]) => (
                  <th key={t} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 800, color: '#999', textTransform: 'uppercase', letterSpacing: '0.03em', width: w, minWidth: w }}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pautas.map(p => {
                const est = estadoStudio(p)
                const ajuste = p.ajusteCopy || p.ajusteCriativo || p.motivoReprovacao
                const podeEnviar = ['rascunho', 'corrigir', 'reprovado'].includes(p.status)
                const semMidia = (p.imagens || []).length === 0
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f2f2f2', verticalAlign: 'top' }}>
                    {/* Estado */}
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 800, color: est.cor, background: est.bg, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap' }}>{est.label}</span>
                      {p.editadoAposIA && <span title="Ajustada pela equipe após a geração da IA" style={{ display: 'block', marginTop: 5, fontSize: 9, fontWeight: 700, color: '#7c3aed' }}>editada</span>}
                      {ajuste && <p style={{ margin: '6px 0 0', fontSize: 10.5, color: '#b91c1c', background: '#fef2f2', borderRadius: 6, padding: '4px 6px', width: larguras.estado - 12 }}>Cliente: {String(ajuste).slice(0, 80)}</p>}
                    </td>
                    {/* Pauta / briefing */}
                    <td style={{ padding: '6px 8px' }}>
                      <CelulaEditavel valor={p.briefing} editavel={podeEditar} largura={larguras.pauta - 8} placeholder="Tema / ângulo da pauta..." onSalvar={v => salvarCampo(p.id, 'briefing', v)} />
                    </td>
                    {/* Copy */}
                    <td style={{ padding: '6px 8px' }}>
                      <CelulaEditavel valor={p.legenda} editavel={podeEditar} largura={larguras.copy - 8} placeholder="Legenda / copy do post..." onSalvar={v => salvarCampo(p.id, 'legenda', v)} />
                    </td>
                    {/* Direção de criativo */}
                    <td style={{ padding: '6px 8px' }}>
                      <CelulaEditavel valor={p.sugestaoImagem} editavel={podeEditar} largura={larguras.criativo - 8} placeholder="Descrição visual p/ o designer..." onSalvar={v => salvarCampo(p.id, 'sugestaoImagem', v)} />
                      {(p.imagens || []).length > 0 && <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 700, color: '#16a34a' }}>✓ {p.imagens!.length} mídia(s)</span>}
                    </td>
                    {/* Formato */}
                    <td style={{ padding: '10px 12px' }}>
                      {podeEditar ? (
                        <select value={p.formato || 'feed'} onChange={e => salvarCampo(p.id, 'formato', e.target.value)}
                          style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, fontFamily: 'inherit', background: '#fff', color: (FORMATOS.find(f => f.key === (p.formato || 'feed'))?.cor) || '#333', fontWeight: 700 }}>
                          {FORMATOS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                        </select>
                      ) : <span style={{ fontSize: 12, fontWeight: 700 }}>{FORMATOS.find(f => f.key === (p.formato || 'feed'))?.label}</span>}
                    </td>
                    {/* Data */}
                    <td style={{ padding: '10px 12px' }}>
                      {podeEditar ? (
                        <input type="datetime-local" value={toLocalInput(p.dataAgendada)} onChange={e => salvarData(p.id, e.target.value)}
                          style={{ padding: '5px 6px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 11.5, fontFamily: 'inherit', color: '#333', width: larguras.data - 20 }} />
                      ) : <span style={{ fontSize: 11.5, color: '#666' }}>{p.dataAgendada ? new Date(p.dataAgendada).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</span>}
                    </td>
                    {/* Ações */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: larguras.acoes - 24 }}>
                        {podeEditar && semMidia && onAbrirComposer && (
                          <button onClick={() => onAbrirComposer(p)} style={{ padding: '6px 8px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>Adicionar criativo</button>
                        )}
                        {podeEditar && podeEnviar && (
                          <button onClick={() => enviarAoCliente(p)} style={{ padding: '6px 8px', background: 'var(--marca, #ffc00f)', color: 'var(--marca-texto, #111)', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 11, cursor: 'pointer' }}>Enviar ao cliente</button>
                        )}
                        {p.status === 'aguardando_aprovacao' && (
                          <button onClick={() => copiarLink(p.clienteId)} style={{ padding: '6px 8px', background: '#fff', color: '#111', border: '1px solid #ddd', borderRadius: 8, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>Copiar link</button>
                        )}
                        {podeEditar && onAbrirComposer && !semMidia && (
                          <button onClick={() => onAbrirComposer(p)} style={{ padding: '6px 8px', background: '#fff', color: '#555', border: '1px solid #e5e7eb', borderRadius: 8, fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>Abrir no editor</button>
                        )}
                        {podeExcluir && (
                          <button onClick={() => excluir(p)} style={{ padding: '5px 8px', background: 'transparent', color: '#b91c1c', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 10.5, cursor: 'pointer', textAlign: 'left' }}>Excluir</button>
                        )}
                      </div>
                    </td>
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
