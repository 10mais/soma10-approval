'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { upload } from '@vercel/blob/client'
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
  criativoGerado?: boolean
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

// Campo com edição inline (painel expandido) — largura total, auto-cresce, sem alça.
function CelulaEditavel({ valor, onSalvar, placeholder, editavel }: {
  valor?: string; onSalvar: (v: string) => Promise<void>; placeholder?: string; editavel: boolean
}) {
  const [v, setV] = useState(valor || '')
  const [estado, setEstado] = useState<'idle' | 'salvando' | 'ok'>('idle')
  const original = useRef(valor || '')
  const focado = useRef(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  function crescer() { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` } }
  useEffect(() => { if (!focado.current) { setV(valor || ''); original.current = valor || '' } }, [valor])
  useEffect(() => { crescer() }, [v])

  if (!editavel) return <div style={{ width: '100%', fontSize: 12.5, color: '#333', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{v || <span style={{ color: '#ccc' }}>—</span>}</div>

  async function blur() {
    focado.current = false
    if (v === original.current) return
    setEstado('salvando')
    await onSalvar(v)
    original.current = v
    setEstado('ok'); setTimeout(() => setEstado('idle'), 1200)
  }
  return (
    <div style={{ position: 'relative', width: '100%' }} onClick={e => e.stopPropagation()}>
      <textarea ref={ref} value={v} placeholder={placeholder} className="st-input"
        onFocus={() => { focado.current = true }}
        onChange={e => setV(e.target.value)} onBlur={blur}
        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', border: '1px solid #e6e6e6', borderRadius: 10, fontSize: 12.5, fontFamily: 'inherit', resize: 'none', overflow: 'hidden', minHeight: 36, background: '#fff', color: '#222', lineHeight: 1.5 }} />
      {estado !== 'idle' && (
        <span style={{ position: 'absolute', top: 6, right: 8, fontSize: 9, fontWeight: 700, color: estado === 'ok' ? '#16a34a' : '#999' }}>
          {estado === 'ok' ? '✓ salvo' : 'salvando…'}
        </span>
      )}
    </div>
  )
}

// Rótulo curto acima de cada campo do painel expandido.
function CampoLabel({ children }: { children: ReactNode }) {
  return <span style={{ display: 'block', fontSize: 10, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4 }}>{children}</span>
}

export default function StudioMes({ clientes, clienteFixo, onAbrirComposer, podeEditar = true, podeExcluir = true }: {
  clientes: Cliente[]
  clienteFixo?: string
  onAbrirComposer?: (pauta: Pauta) => void
  podeEditar?: boolean
  podeExcluir?: boolean
}) {
  const [planos, setPlanos] = useState<Plano[]>([])
  // Seleção persistida (ao atualizar a página, permanece no mesmo lugar).
  const chaveSel = clienteFixo ? `studio:sel:${clienteFixo}` : 'studio:sel'
  const [clienteSel, setClienteSel] = useState<string>(() => {
    if (clienteFixo) return clienteFixo
    return typeof window !== 'undefined' ? (sessionStorage.getItem(`${chaveSel}:cli`) || '') : ''
  })
  const [planoSel, setPlanoSel] = useState<string>(() => (typeof window !== 'undefined' ? (sessionStorage.getItem(`${chaveSel}:plano`) || '') : ''))
  const [pautas, setPautas] = useState<Pauta[]>([])
  const [carregando, setCarregando] = useState(false)
  const [novoPlano, setNovoPlano] = useState(false)
  const [formPlano, setFormPlano] = useState({ clienteId: clienteFixo || '', mes: new Date().getMonth() + 1, ano: new Date().getFullYear() })
  const [gerandoIA, setGerandoIA] = useState(false)
  const [iaMsg, setIaMsg] = useState('')
  const [criandoLinha, setCriandoLinha] = useState(false)
  const [abertos, setAbertos] = useState<Set<string>>(new Set()) // linhas expandidas
  const [gerandoCriativo, setGerandoCriativo] = useState<string | null>(null)
  const [preview, setPreview] = useState<Pauta | null>(null) // lightbox estilo prévia de post
  function toggleLinha(id: string) {
    setAbertos(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function carregarPlanos() {
    const url = clienteFixo ? `/api/planos?clienteId=${clienteFixo}` : '/api/planos'
    fetch(url).then(r => r.json()).then(d => {
      const lista = Array.isArray(d) ? d : []
      setPlanos(lista)
      // NÃO seleciona ninguém por padrão na visão da agência (pergunta o cliente).
      // No portal (cliente fixo), abre no plano mais recente se não houver seleção salva.
      if (clienteFixo && !planoSel && lista.length > 0) setPlanoSel(lista[0].id)
    }).catch(() => {})
  }
  useEffect(() => { carregarPlanos() }, [clienteFixo])
  // Persiste a seleção (cliente + plano) para sobreviver ao refresh.
  useEffect(() => { if (typeof window !== 'undefined') sessionStorage.setItem(`${chaveSel}:cli`, clienteSel) }, [clienteSel, chaveSel])
  useEffect(() => { if (typeof window !== 'undefined') sessionStorage.setItem(`${chaveSel}:plano`, planoSel) }, [planoSel, chaveSel])

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
    // etapa 'aprovacao_criativo' faz o post aparecer na tela Aprovações do portal
    // do cliente (que filtra por etapa); status 'aguardando_aprovacao' mantém o
    // link público funcionando. O PUT seta aguardandoDesde ao entrar na etapa.
    setPautas(ps => ps.map(x => x.id === p.id ? { ...x, status: 'aguardando_aprovacao', etapa: 'aprovacao_criativo' } : x))
    await fetch('/api/posts', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, status: 'aguardando_aprovacao', etapa: 'aprovacao_criativo' }),
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

  // Gera o criativo (imagem) via template de marca — IA dirige a arte, servidor
  // rasteriza e devolve os bytes; o cliente sobe pelo fluxo upload() (URL pública).
  async function gerarCriativo(p: Pauta) {
    setGerandoCriativo(p.id)
    try {
      const r = await fetch('/api/studio/gerar-criativo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: p.id }),
      }).then(x => x.json()).catch(() => null)
      if (!r || r.error || !r.imagemBase64) { toast(r?.error || 'Falha ao gerar o criativo.', 'erro'); return }
      // base64 -> File
      const bin = atob(r.imagemBase64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const file = new File([bytes], `criativo-${p.id}.png`, { type: 'image/png' })
      const blob = await upload(`criativos/${p.id}-${Date.now()}.png`, file, {
        access: 'public', handleUploadUrl: '/api/upload', contentType: 'image/png', clientPayload: 'image/png',
      })
      await fetch('/api/posts', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, imagens: [blob.url, ...(p.imagens || [])], criativoGerado: true, formato: p.formato || 'feed' }),
      })
      toast(`Criativo gerado (${r.template})!`, 'sucesso')
      carregarPautas(planoSel)
    } catch (e: any) {
      toast(`Falha ao gerar o criativo: ${e?.message || 'erro'}`, 'erro')
    } finally {
      setGerandoCriativo(null)
    }
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

  // Seleção: cliente primeiro (agência), depois o mês/plano daquele cliente.
  const clientesDosPlanos = Array.from(new Map(planos.map(p => [p.clienteId, p.clienteNome])).entries())
    .map(([id, nome]) => ({ id, nome })).sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'))
  const planosDoCliente = clienteSel ? planos.filter(p => p.clienteId === clienteSel) : []
  function escolherCliente(cid: string) {
    setClienteSel(cid)
    const ps = planos.filter(p => p.clienteId === cid)
    setPlanoSel(ps[0]?.id || '') // planos vêm do mais recente ao mais antigo
  }

  return (
    <div className="st-root">
      <style>{`
        .st-root{--ease:cubic-bezier(.2,.8,.2,1)}
        .st-btn{transition:transform .16s var(--ease),box-shadow .18s,filter .18s,background .18s,opacity .16s;will-change:transform}
        .st-btn:hover{transform:translateY(-1px)}
        .st-btn:active{transform:translateY(0)}
        .st-cta{box-shadow:0 1px 3px rgba(0,0,0,.1)}
        .st-cta:hover{filter:brightness(1.03);box-shadow:0 4px 12px -4px rgba(0,0,0,.2)}
        .st-card{background:#fff;border:1px solid rgba(17,17,17,.05);border-radius:20px;box-shadow:0 1px 2px rgba(0,0,0,.025),0 18px 44px -32px rgba(0,0,0,.22)}
        .st-metric{transition:transform .18s var(--ease),box-shadow .18s}
        .st-metric:hover{transform:translateY(-2px);box-shadow:0 12px 26px -16px rgba(0,0,0,.28)}
        .st-row{animation:stFade .4s var(--ease) both;transition:background .16s ease}
        .st-row:hover{background:#fafbfc}
        .st-detail{animation:stSlide .26s var(--ease) both}
        .st-preview{transition:transform .2s var(--ease),box-shadow .2s}
        .st-preview:hover{transform:scale(1.03) rotate(-.4deg);box-shadow:0 18px 40px -18px rgba(0,0,0,.5)}
        .st-input{transition:border-color .15s,box-shadow .15s,background .15s}
        .st-input:focus{outline:none;border-color:var(--marca,#ffc00f);box-shadow:0 0 0 3px rgba(255,192,15,.2)}
        .st-chev{transition:transform .2s var(--ease)}
        @keyframes stFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes stSlide{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 23, fontWeight: 800, color: '#111', letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: 9 }}>
            Studio
            <span style={{ fontSize: 10, fontWeight: 800, color: '#7c3aed', background: 'linear-gradient(135deg,#7c3aed18,#7c3aed08)', border: '1px solid #7c3aed30', borderRadius: 999, padding: '3px 9px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Beta</span>
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#999' }}>A IA opera a fábrica; você rege a orquestra. Clique numa linha para abrir e editar tudo.</p>
        </div>
        {!clienteFixo && (
          <select className="st-input" value={clienteSel} onChange={e => escolherCliente(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: 12, border: '1.5px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit', minWidth: 200, background: '#fff', cursor: 'pointer' }}>
            <option value="">Escolher cliente…</option>
            {clientesDosPlanos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        )}
        {clienteSel && (
          <select className="st-input" value={planoSel} onChange={e => setPlanoSel(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: 12, border: '1.5px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit', minWidth: 160, background: '#fff', cursor: 'pointer' }}>
            <option value="">Mês…</option>
            {planosDoCliente.map(p => <option key={p.id} value={p.id}>{MESES[p.mes - 1]}/{p.ano}{p.titulo ? ` · ${p.titulo}` : ''}</option>)}
          </select>
        )}
        {podeEditar && <button className="st-btn" onClick={() => { setFormPlano(f => ({ ...f, clienteId: clienteSel || f.clienteId })); setNovoPlano(true) }} style={{ padding: '10px 16px', background: '#fff', color: '#3a3a3a', border: '1px solid #ececec', borderRadius: 11, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>+ Novo plano</button>}
        {planoSel && podeEditar && <>
          <button className="st-btn st-cta" onClick={novaLinha} disabled={criandoLinha} style={{ padding: '10px 16px', background: '#ffcb3a', color: '#3d3000', border: 'none', borderRadius: 11, fontWeight: 600, fontSize: 13, cursor: criandoLinha ? 'wait' : 'pointer' }}>+ Nova linha</button>
          <button className="st-btn st-cta" onClick={gerarPlanoIA} disabled={gerandoIA} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: '#1f1f22', color: '#ffce4a', border: 'none', borderRadius: 11, fontWeight: 600, fontSize: 13, cursor: gerandoIA ? 'not-allowed' : 'pointer', opacity: gerandoIA ? 0.6 : 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61z" /></svg>
            {gerandoIA ? 'Gerando…' : 'Gerar plano com IA'}
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
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div className="st-metric" style={{ background: '#fff', border: '1px solid rgba(17,17,17,.06)', borderRadius: 14, padding: '12px 18px', fontSize: 12.5, boxShadow: '0 1px 2px rgba(0,0,0,.03)' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#111', letterSpacing: '-0.02em', lineHeight: 1 }}>{pautas.length}</div>
            <div style={{ color: '#999', marginTop: 3, fontSize: 12 }}>pautas no mês</div>
          </div>
          {taxa !== null && (
            <div className="st-metric" title="Quantas pautas geradas pela IA a equipe ajustou. Alta = matéria-prima ainda precisa de trabalho; baixa = IA acertando bem." style={{ background: '#fff', border: '1px solid rgba(17,17,17,.06)', borderRadius: 14, padding: '12px 18px', fontSize: 12.5, boxShadow: '0 1px 2px rgba(0,0,0,.03)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, color: taxa >= 60 ? '#b45309' : '#16a34a' }}>{taxa}%</span>
                <span style={{ fontSize: 11.5, color: '#bbb', fontWeight: 700 }}>taxa de edição</span>
              </div>
              <div style={{ color: '#999', marginTop: 3, fontSize: 12 }}>{editadas.length} de {geradas.length} pautas da IA ajustadas</div>
            </div>
          )}
        </div>
      )}

      {/* Lista viva do mês — grid fluido, cabe na página sem scroll lateral */}
      {!planoSel ? (
        <div className="st-card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          {(!clienteSel && !clienteFixo) ? (
            <>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#fff4cf,#ffe79a)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#a9781a"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61z" /></svg>
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: 21, fontWeight: 700, color: '#111', letterSpacing: '-0.02em' }}>Com qual cliente vamos trabalhar hoje?</h3>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: '#999' }}>Escolha um cliente para abrir o Studio do mês.</p>
              <select className="st-input" value={clienteSel} onChange={e => escolherCliente(e.target.value)}
                style={{ padding: '12px 18px', borderRadius: 12, border: '1.5px solid #e6e6e6', fontSize: 14, minWidth: 280, background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                <option value="">Escolher cliente…</option>
                {clientesDosPlanos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              {clientesDosPlanos.length === 0 && <p style={{ margin: '16px 0 0', fontSize: 12.5, color: '#bbb' }}>Nenhum plano ainda — clique em “+ Novo plano” para começar.</p>}
            </>
          ) : (
            <>
              <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#111' }}>Escolha o mês</h3>
              <p style={{ margin: 0, fontSize: 13, color: '#999' }}>Selecione um mês acima, ou clique em “+ Novo plano” para começar.</p>
            </>
          )}
        </div>
      ) : carregando ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>Carregando pautas...</div>
      ) : pautas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 50, color: '#aaa', background: '#fff', borderRadius: 14, border: '1px solid #eee' }}>
          <p style={{ margin: '0 0 6px' }}>Nenhuma pauta neste plano ainda.</p>
          {podeEditar && <p style={{ margin: 0, fontSize: 13 }}>Clique em <strong>Gerar plano com IA</strong> para a IA propor o mês, ou <strong>+ Nova linha</strong> para começar do zero.</p>}
        </div>
      ) : (
        <div className="st-card" style={{ overflow: 'hidden' }}>
          <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
            {pautas.map((p, idx) => {
              const est = estadoStudio(p)
              const ajuste = p.ajusteCopy || p.ajusteCriativo || p.motivoReprovacao
              const podeEnviar = ['rascunho', 'corrigir', 'reprovado'].includes(p.status)
              const semMidia = (p.imagens || []).length === 0
              const aberto = abertos.has(p.id)
              const capa = (p.imagens || []).find(u => /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(u))
              const podeGerar = podeEditar && ['rascunho', 'corrigir', 'reprovado'].includes(p.status)
              const fmt = FORMATOS.find(f => f.key === (p.formato || 'feed')) || FORMATOS[0]
              const dataFmt = p.dataAgendada ? `${new Date(p.dataAgendada).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · ${new Date(p.dataAgendada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'sem data'
              return (
                <div key={p.id} className="st-row" style={{ borderBottom: '1px solid #f4f4f5', background: aberto ? '#fbfbfd' : undefined, animationDelay: `${Math.min(idx, 16) * 26}ms` }}>
                  {/* Item recolhido — lista limpa, sem controles nativos */}
                  <div onClick={() => toggleLinha(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', cursor: 'pointer' }}>
                    <svg className="st-chev" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#cbcbce" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: aberto ? 'rotate(90deg)' : 'none' }}><path d="M9 18l6-6-6-6" /></svg>
                    {capa ? (
                      <img src={capa} alt="" onClick={e => { e.stopPropagation(); setPreview(p) }} title="Ver prévia" style={{ width: 46, height: 58, borderRadius: 10, objectFit: 'cover', flexShrink: 0, boxShadow: '0 5px 14px -7px rgba(0,0,0,.45)', cursor: 'zoom-in' }} />
                    ) : (
                      <div style={{ width: 46, height: 58, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(135deg,#f4f4f5,#ececed)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cfcfd3' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 15l5-4 4 3 4-4 5 4" /><circle cx="9" cy="8.5" r="1.4" /></svg>
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: p.briefing ? '#1a1a1a' : '#bbb', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.briefing || 'Sem título — clique para editar'}</span>
                        {p.editadoAposIA && <span title="Ajustada pela equipe após a IA" style={{ fontSize: 9, fontWeight: 700, color: '#7c3aed', flexShrink: 0 }}>editada</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 5 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: est.cor, whiteSpace: 'nowrap' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: est.cor }} />{est.label}
                        </span>
                        <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#d8d8db', flexShrink: 0 }} />
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: '#9a9a9a', whiteSpace: 'nowrap' }}>
                          <span style={{ width: 6, height: 6, borderRadius: 2, background: fmt.cor }} />{fmt.label}
                        </span>
                        <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#d8d8db', flexShrink: 0 }} />
                        <span style={{ fontSize: 11.5, color: '#9a9a9a', whiteSpace: 'nowrap' }}>{dataFmt}</span>
                      </div>
                    </div>
                    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                      {podeGerar && (
                        <button className="st-btn" onClick={() => gerarCriativo(p)} disabled={gerandoCriativo === p.id} title="A IA dirige a arte e gera a imagem da marca"
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: 'transparent', color: '#7a6a2e', border: '1px solid #ece6d3', borderRadius: 10, fontWeight: 500, fontSize: 11.5, cursor: gerandoCriativo === p.id ? 'wait' : 'pointer', opacity: gerandoCriativo === p.id ? 0.7 : 1, whiteSpace: 'nowrap' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#b8901f"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61z" /></svg>
                          {gerandoCriativo === p.id ? 'Gerando…' : (capa ? 'Regerar' : 'Criar arte')}
                        </button>
                      )}
                      {podeEnviar && !semMidia && podeEditar && (
                        <button className="st-btn" onClick={() => enviarAoCliente(p)} style={{ padding: '8px 15px', background: '#ffcb3a', color: '#3d3000', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 11.5, cursor: 'pointer', whiteSpace: 'nowrap' }}>Enviar</button>
                      )}
                      {p.status === 'aguardando_aprovacao' && (
                        <button className="st-btn" onClick={() => copiarLink(p.clienteId)} style={{ padding: '8px 13px', background: '#fff', color: '#555', border: '1px solid #ececec', borderRadius: 10, fontWeight: 500, fontSize: 11.5, cursor: 'pointer', whiteSpace: 'nowrap' }}>Copiar link</button>
                      )}
                    </div>
                  </div>

                  {/* Painel expandido — edição completa (formato/data viram controles bonitos) */}
                  {aberto && (
                    <div className="st-detail" style={{ display: 'flex', gap: 24, flexWrap: 'wrap', padding: '2px 20px 22px 45px' }}>
                      <div style={{ flex: '1 1 400px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div><CampoLabel>Pauta / briefing</CampoLabel><CelulaEditavel valor={p.briefing} editavel={podeEditar} placeholder="Tema / ângulo da pauta..." onSalvar={v => salvarCampo(p.id, 'briefing', v)} /></div>
                        <div><CampoLabel>Copy (legenda)</CampoLabel><CelulaEditavel valor={p.legenda} editavel={podeEditar} placeholder="Legenda / copy do post..." onSalvar={v => salvarCampo(p.id, 'legenda', v)} /></div>
                        <div><CampoLabel>Direção de criativo</CampoLabel><CelulaEditavel valor={p.sugestaoImagem} editavel={podeEditar} placeholder="Descrição visual p/ o designer..." onSalvar={v => salvarCampo(p.id, 'sugestaoImagem', v)} /></div>
                        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
                          <div>
                            <CampoLabel>Formato</CampoLabel>
                            <div style={{ display: 'inline-flex', gap: 4, background: '#f4f4f5', borderRadius: 11, padding: 3 }}>
                              {FORMATOS.map(f => {
                                const on = (p.formato || 'feed') === f.key
                                return (
                                  <button key={f.key} className="st-btn" disabled={!podeEditar} onClick={() => salvarCampo(p.id, 'formato', f.key)}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: 'none', background: on ? '#fff' : 'transparent', color: on ? f.cor : '#8a8a8a', fontWeight: on ? 700 : 500, fontSize: 12, cursor: podeEditar ? 'pointer' : 'default', boxShadow: on ? '0 1px 4px rgba(0,0,0,.12)' : 'none' }}>
                                    <span style={{ width: 6, height: 6, borderRadius: 2, background: f.cor }} />{f.label}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                          <div>
                            <CampoLabel>Data e hora</CampoLabel>
                            <input type="datetime-local" className="st-input" value={toLocalInput(p.dataAgendada)} disabled={!podeEditar} onChange={e => salvarData(p.id, e.target.value)}
                              style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 12.5, fontFamily: 'inherit', color: '#333', background: '#fff' }} />
                          </div>
                        </div>
                      </div>
                      <div style={{ flex: '0 0 190px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                          <CampoLabel>Criativo</CampoLabel>
                          {capa ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                              <img className="st-preview" src={capa} alt="" onClick={() => setPreview(p)} title="Ampliar (prévia de post)" style={{ width: 160, height: 200, borderRadius: 16, objectFit: 'cover', border: '1px solid rgba(17,17,17,.06)', boxShadow: '0 14px 34px -18px rgba(0,0,0,.45)', cursor: 'zoom-in' }} />
                              {p.criativoGerado && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 800, color: '#7c3aed' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: '#7c3aed' }} />Gerado pela IA · toque para ampliar</span>}
                            </div>
                          ) : <div style={{ width: 160, height: 200, borderRadius: 16, border: '1.5px dashed #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#bbb', textAlign: 'center', padding: 8, background: '#fbfbfc' }}>Sem criativo ainda</div>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, width: 160 }}>
                          {podeEditar && podeEnviar && (
                            <button className="st-btn st-cta" onClick={() => enviarAoCliente(p)} style={{ padding: '10px 8px', background: '#ffcb3a', color: '#3d3000', border: 'none', borderRadius: 11, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Enviar ao cliente</button>
                          )}
                          {podeEditar && onAbrirComposer && (
                            <button className="st-btn" onClick={() => onAbrirComposer(p)} style={{ padding: '9px 8px', background: '#fff', color: '#555', border: '1px solid #ececec', borderRadius: 11, fontWeight: 500, fontSize: 11.5, cursor: 'pointer' }}>{semMidia ? 'Subir manual' : 'Abrir no editor'}</button>
                          )}
                          {podeExcluir && (
                            <button onClick={() => excluir(p)} style={{ padding: '6px 8px', background: 'transparent', color: '#c0716b', border: 'none', borderRadius: 8, fontWeight: 500, fontSize: 10.5, cursor: 'pointer' }}>Excluir</button>
                          )}
                        </div>
                        {ajuste && <p style={{ margin: 0, fontSize: 11, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '8px 10px', width: 160, boxSizing: 'border-box' }}><strong>Cliente pediu:</strong> {String(ajuste)}</p>}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Lightbox — prévia de post (como no Planner): imagem ampliada + legenda */}
      {preview && (() => {
        const img = (preview.imagens || []).find(u => /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(u)) || (preview.imagens || [])[0]
        const inicial = (preview.clienteNome || '?').trim().charAt(0).toUpperCase()
        return (
          <div onClick={() => setPreview(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, maxWidth: 400, width: '100%', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'stFade .18s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--marca, #ffc00f)', color: '#1a1400', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{inicial}</div>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#111' }}>{preview.clienteNome}</span>
                <button onClick={() => setPreview(null)} aria-label="Fechar" style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: '#888', display: 'flex' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
              {img && <img src={img} alt="" style={{ width: '100%', display: 'block', maxHeight: '64vh', objectFit: 'contain', background: '#000' }} />}
              {preview.legenda && (
                <div style={{ padding: '12px 14px', overflowY: 'auto' }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#222', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}><strong>{preview.clienteNome}</strong> {preview.legenda}</p>
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
