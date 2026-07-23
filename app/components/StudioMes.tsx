'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { upload } from '@vercel/blob/client'
import { toast, confirmar } from '@/lib/toast'
import { contraste, LARGURA, ALTURA } from '@/lib/criativoTemplates'
import { OBJETIVOS, objetivoDef } from '@/lib/criativoObjetivos'
import { atrasada, emRisco } from '@/lib/entregas'
import ProducaoBoard from './ProducaoBoard'
import { fecharFora } from '@/lib/fecharModal'

// ===== Studio (Fase 1) — tabela viva do mês por cliente =====
// Substitui o kanban de 6 colunas por uma linha por pauta, editável inline.
// Os estados fluem sozinhos: rascunho da IA -> equipe adiciona criativo -> envia
// ao cliente (link único) -> aprovado/agendado -> publicado. Mede a taxa de
// edição (quanto a equipe ajusta o que a IA gerou) desde o dia 1 — prova da Fase 0.

type Cliente = { id: string; nome: string; logo?: string; corPrimaria?: string; corSecundaria?: string }
type Plano = { id: string; clienteId: string; clienteNome: string; mes: number; ano: number; titulo?: string }
type Pauta = {
  id: string; clienteId: string; clienteNome: string; imagens: string[]; legenda: string
  status: string; formato?: string; etapa?: string; briefing?: string; headline?: string; planoId?: string
  sugestaoImagem?: string; textoImagem?: string; sugestaoLegenda?: string
  subheadline?: string; cta?: string; anexos?: { nome: string; url: string; tipo: string }[]
  tarefaId?: string
  dataAgendada?: string; codigo?: string; colaboradores?: string[]; capasVideo?: Record<string, string>; redes?: string[]
  ajusteCopy?: string; ajusteCriativo?: string; motivoReprovacao?: string; anotacoes?: any[]
  criadoEm?: string; atualizadoEm?: string
  iaGerado?: { briefing?: string; headline?: string; subheadline?: string; legenda?: string; sugestaoImagem?: string; textoImagem?: string; cta?: string; formato?: string; geradoEm: string }
  editadoAposIA?: boolean
  criativoGerado?: boolean
  criativoData?: any // receita do criativo (para reabrir no editor)
}

type Camada =
  | { id: string; tipo: 'texto'; x: number; y: number; w: number; texto: string; fontSize: number; cor: string; peso: number; align: 'left' | 'center' | 'right'; lineHeight?: number }
  | { id: string; tipo: 'imagem'; x: number; y: number; w: number; h: number; url?: string; radius: number; fit: 'cover' | 'contain' }
  | { id: string; tipo: 'forma'; x: number; y: number; w: number; h: number; cor: string; radius: number }
type CriativoSpec = { template: string; headline?: string; subheadline?: string; bullets?: string[]; rodape?: string; corFundo?: string; corAccent?: string; fundoUrl?: string; logoUrl?: string; handle?: string; camadas?: Camada[] }
const TEMPLATES_ART: { key: string; label: string }[] = [
  { key: 'capa', label: 'Capa' }, { key: 'foto', label: 'Foto' }, { key: 'dica', label: 'Dica' }, { key: 'citacao', label: 'Citação' }, { key: 'dado', label: 'Dado' },
]

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

// Régua do pipeline IA-first da pauta:
// DNA DA MARCA > BRIEFING > COPY > CRIATIVO > APROVAÇÃO > POSTAGEM.
// Mostra onde a pauta está e qual é o próximo passo.
function PipelinePauta({ p }: { p: Pauta }) {
  const temCriativo = (p.imagens || []).length > 0
  // falha_publicacao já passou pela aprovação — o problema é na POSTAGEM.
  const aprovado = ['aprovado', 'agendado', 'publicando', 'publicado', 'falha_publicacao'].includes(p.status)
  const passos: { label: string; ok: boolean; alerta?: boolean; meio?: boolean }[] = [
    { label: 'DNA da marca', ok: true }, // vem do cadastro do cliente (Marca)
    { label: 'Briefing', ok: !!(p.briefing || '').trim() },
    { label: 'Copy', ok: !!(p.legenda || '').trim() },
    { label: 'Criativo', ok: temCriativo },
    {
      label: p.status === 'aguardando_aprovacao' ? 'No cliente' : p.status === 'corrigir' ? 'Ajuste pedido' : p.status === 'reprovado' ? 'Reprovado' : 'Aprovação',
      ok: aprovado, alerta: p.status === 'corrigir' || p.status === 'reprovado', meio: p.status === 'aguardando_aprovacao',
    },
    {
      label: p.status === 'publicado' ? 'Publicado' : p.status === 'falha_publicacao' ? 'Falha na publicação' : (p.status === 'agendado' || p.status === 'publicando') ? 'Agendado' : 'Postagem',
      ok: p.status === 'publicado', alerta: p.status === 'falha_publicacao', meio: p.status === 'agendado' || p.status === 'publicando',
    },
  ]
  // Passo "atual" = o primeiro não-concluído. Se ele está em alerta (ajuste/falha)
  // ou no meio (no cliente/agendado), a cor própria dele prevalece — e os passos
  // seguintes ficam cinza (nada de destacar "Postagem" com a bola no cliente).
  const atualIdx = passos.findIndex(s => !s.ok)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '10px 12px', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 12 }}>
      {passos.map((s, i) => {
        const cor = s.alerta ? '#b91c1c' : s.ok ? '#16a34a' : s.meio ? '#a16207' : i === atualIdx ? '#111' : '#c2c2c6'
        const bg = s.alerta ? '#fee2e2' : s.ok ? '#dcfce7' : s.meio ? '#fef3c7' : i === atualIdx ? '#ffcb3a33' : 'transparent'
        return (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: bg, color: cor, fontSize: 11, fontWeight: i === atualIdx || s.alerta ? 800 : 700, whiteSpace: 'nowrap' }}>
              {s.ok ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              ) : (
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: cor, display: 'inline-block' }} />
              )}
              {s.label}
            </span>
            {i < passos.length - 1 && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#d8d8db" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>}
          </span>
        )
      })}
    </div>
  )
}

export default function StudioMes({ clientes, clienteFixo, onAbrirComposer, podeEditar = true, podeExcluir = true, podeGerarIA = true, podeEnviarCliente = true, postsGlobais, usuariosEquipe, meuEmail }: {
  clientes: Cliente[]
  clienteFixo?: string
  onAbrirComposer?: (pauta: Pauta) => void
  podeEditar?: boolean
  podeExcluir?: boolean
  podeGerarIA?: boolean
  podeEnviarCliente?: boolean
  // Visão "Hoje na produção" (tela de abertura): todas as pautas de todos os clientes
  postsGlobais?: any[]
  usuariosEquipe?: { nome: string; email: string }[]
  meuEmail?: string
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
  const [gerandoFoto, setGerandoFoto] = useState<string | null>(null) // foto realista por IA
  const [ideogramOn, setIdeogramOn] = useState(false) // algum motor de foto ligado
  const [motorFoto, setMotorFoto] = useState<string | null>(null) // 'nano-banana' | 'ideogram'
  const [linkModal, setLinkModal] = useState<{ url: string; cliente: string } | null>(null) // compartilhar link de aprovação
  const [preview, setPreview] = useState<Pauta | null>(null) // lightbox estilo prévia de post
  // Modal "Gerar arte" — escolher imagem de referência
  const [gerarModal, setGerarModal] = useState<Pauta | null>(null)
  const [modalAssets, setModalAssets] = useState<{ url: string; categoria: string }[]>([])
  const [modalCarregando, setModalCarregando] = useState(false)
  const [refSel, setRefSel] = useState<string>('sem') // 'sem' | url da imagem
  const [refHeadline, setRefHeadline] = useState('') // headline fixa (seguida à risca)
  const [modalEnviando, setModalEnviando] = useState(false)
  const [modalProg, setModalProg] = useState<number | null>(null)
  // Brief rico do motor novo (IA designer): objetivo + campos de anúncio
  const [briefObj, setBriefObj] = useState('')
  const [briefVals, setBriefVals] = useState<Record<string, string>>({})
  const rid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  // Editor de arte (Nível 1)
  const [editorPost, setEditorPost] = useState<Pauta | null>(null)
  const [editorSpec, setEditorSpec] = useState<CriativoSpec | null>(null)
  const [editorImg, setEditorImg] = useState('')
  const [editorPrompt, setEditorPrompt] = useState('')
  const [editorAplicando, setEditorAplicando] = useState(false)
  // Editor de arte Nível 2 (visual): camadas arrastáveis no canvas 1080x1350.
  const [editorModo, setEditorModo] = useState<'simples' | 'visual'>('simples')
  const [selCamada, setSelCamada] = useState<string | null>(null)
  const dragRef = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null)
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

  // Anexos da pauta (referências p/ o designer): sobem pro Blob e ficam no Post.
  const [anexando, setAnexando] = useState<string | null>(null)
  async function salvarAnexos(id: string, anexos: { nome: string; url: string; tipo: string }[]) {
    setPautas(ps => ps.map(x => x.id === id ? { ...x, anexos } : x))
    await fetch('/api/posts', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, anexos }),
    }).catch(() => {})
  }
  async function anexarArquivos(p: Pauta, files: FileList) {
    setAnexando(p.id)
    try {
      const novos: { nome: string; url: string; tipo: string }[] = []
      for (const file of Array.from(files)) {
        // /api/upload adiciona sufixo aleatório — o nome original vive no campo `nome`.
        const blob = await upload(`pautas/${p.id}/${file.name}`, file, {
          access: 'public', handleUploadUrl: '/api/upload',
          contentType: file.type || 'application/octet-stream', clientPayload: file.type || 'application/octet-stream',
        })
        novos.push({ nome: file.name, url: blob.url, tipo: file.type || '' })
      }
      await salvarAnexos(p.id, [...(p.anexos || []), ...novos])
    } catch (e: any) {
      toast(e?.message || 'Falha ao enviar o anexo. Tente novamente.', 'erro')
    } finally { setAnexando(null) }
  }

  // Gera a copy estruturada da pauta (headline/sub/texto na arte/CTA/legenda) a
  // partir do briefing + DNA da marca. Preenche só os vazios; substituir é opt-in.
  const [gerandoCopy, setGerandoCopy] = useState<string | null>(null)
  async function gerarCopyIA(p: Pauta) {
    if (!(p.briefing || '').trim()) { toast('Escreva o briefing da pauta primeiro — é dele que a IA parte.', 'erro'); return }
    const temAlgo = [p.headline, p.subheadline, p.textoImagem, p.cta, p.legenda].some(v => (v || '').trim())
    let sobrescrever = false
    if (temAlgo) sobrescrever = await confirmar('Há campos de copy já preenchidos. Substituir pelo texto novo da IA? "Cancelar" mantém o que existe e preenche só os vazios.', { titulo: 'Gerar copy', okLabel: 'Substituir tudo', cancelLabel: 'Só os vazios' })
    setGerandoCopy(p.id)
    try {
      const r = await fetch('/api/esteira/gerar-copy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: p.id, sobrescrever }),
      }).then(x => x.json())
      if (!r?.ok) { toast(r?.error || 'Falha ao gerar a copy.', 'erro'); return }
      if (r.post) setPautas(ps => ps.map(x => x.id === p.id ? { ...x, ...r.post } : x))
      if (r.aplicados?.length) toast(`Copy gerada — ${r.aplicados.length} campo(s) preenchido(s).`, 'sucesso')
      else toast('Todos os campos já tinham conteúdo — nada foi alterado.', 'sucesso')
    } catch { toast('Erro de conexão ao gerar a copy.', 'erro') }
    finally { setGerandoCopy(null) }
  }

  // Controles MANUAIS da linha de montagem: o responsável manda no processo.
  const [acaoPauta, setAcaoPauta] = useState<string | null>(null)
  async function aprovarCopyInterno(p: Pauta) {
    const ok = await confirmar('Aprovar a copy internamente, sem esperar o cliente? A pauta avança para Criativo e a tarefa do designer é criada.', { titulo: 'Aprovar internamente', okLabel: 'Aprovar copy' })
    if (!ok) return
    setAcaoPauta(p.id)
    try {
      const r = await fetch('/api/esteira/aprovar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: p.id, acao: 'aprovar_copy', comentario: '' }),
      }).then(x => x.json())
      if (!r?.ok) { toast(r?.error || 'Falha ao aprovar a copy.', 'erro'); return }
      toast('Copy aprovada internamente — a pauta avançou para Criativo.', 'sucesso')
      carregarPautas(planoSel)
    } catch { toast('Erro de conexão.', 'erro') } finally { setAcaoPauta(null) }
  }
  async function criarTarefaManual(p: Pauta) {
    setAcaoPauta(p.id)
    try {
      const r = await fetch('/api/esteira/relacionar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: p.id }),
      }).then(x => x.json())
      if (!r?.ok) { toast(r?.error || 'Falha ao criar a tarefa.', 'erro'); return }
      toast(r.resultado === 'criada' ? 'Tarefa criada na Gestão de tarefas.' : r.resultado === 'jaVinculada' ? 'Esta pauta já tem tarefa vinculada — foi atualizada.' : 'Pauta pronta não gera tarefa.', 'sucesso')
      carregarPautas(planoSel)
    } catch { toast('Erro de conexão.', 'erro') } finally { setAcaoPauta(null) }
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

  // Quantas pautas e com quais pilares — o dono pede "me dá 3 de bastidor" no
  // meio do mês, não só o mês fechado de 12. As pautas ENTRAM no plano atual
  // (a rota acrescenta, não substitui).
  const [planoModal, setPlanoModal] = useState(false)
  const [gerarQtd, setGerarQtd] = useState(12)
  const [gerarPilares, setGerarPilares] = useState('')

  async function gerarPlanoIA(qtd: number, pilares: string) {
    if (!planoSel) return
    setPlanoModal(false)
    setGerandoIA(true); setIaMsg(`Gerando ${qtd} ${qtd === 1 ? 'pauta' : 'pautas'} com IA... (pode levar até 1 minuto)`)
    try {
      const r = await fetch('/api/esteira/gerar-plano', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planoId: planoSel, quantidade: qtd, pilares: pilares.trim() || undefined }),
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
    if (url) {
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).catch(() => {})
      setLinkModal({ url, cliente: p.clienteNome || 'cliente' })
      toast('Enviado! Link pronto para compartilhar.', 'sucesso')
    } else {
      toast('Enviado ao cliente. Pegue o link em Configurações › Clientes.', 'sucesso')
    }
    carregarPautas(planoSel)
  }

  // Gera o criativo (imagem) via template de marca — IA dirige a arte, servidor
  // rasteriza e devolve os bytes; o cliente sobe pelo fluxo upload() (URL pública).
  async function gerarCriativo(p: Pauta, opts?: { fundoUrl?: string; semFoto?: boolean; headline?: string }) {
    setGerarModal(null)
    setGerandoCriativo(p.id)
    try {
      const r = await fetch('/api/studio/gerar-criativo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: p.id, fundoUrl: opts?.fundoUrl, semFoto: opts?.semFoto, headline: opts?.headline }),
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
        body: JSON.stringify({ id: p.id, imagens: [blob.url, ...(p.imagens || [])], criativoGerado: true, criativoData: r.criativoData, formato: p.formato || 'feed' }),
      })
      toast(`Criativo gerado (${r.template})!`, 'sucesso')
      carregarPautas(planoSel)
    } catch (e: any) {
      toast(`Falha ao gerar o criativo: ${e?.message || 'erro'}`, 'erro')
    } finally {
      setGerandoCriativo(null)
    }
  }

  // MOTOR NOVO (IA designer) — o Claude DESENHA o criativo em HTML com a
  // identidade real da marca (fontes/cores/logo/elementos) e o servidor
  // rasteriza via Chrome headless. Brief rico entra na direção de arte.
  async function gerarCriativoHtml(p: Pauta, opts?: { fundoUrl?: string; semFoto?: boolean; headline?: string }) {
    setGerarModal(null)
    setGerandoCriativo(p.id)
    try {
      const brief: Record<string, string> = { objetivo: briefObj }
      for (const [k, v] of Object.entries(briefVals)) { if (v.trim()) brief[k] = v.trim() }
      const r = await fetch('/api/studio/gerar-criativo-html', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: p.id, fundoUrl: opts?.fundoUrl, semFoto: opts?.semFoto, headline: opts?.headline, brief }),
      }).then(x => x.json()).catch(() => null)
      if (!r || r.error || !r.imagemBase64) { toast(r?.error || 'Falha ao gerar o criativo.', 'erro'); return }
      const blob = await upload(`criativos/${p.id}-${Date.now()}.png`, base64ParaFile(r.imagemBase64, `criativo-${p.id}.png`), {
        access: 'public', handleUploadUrl: '/api/upload', contentType: 'image/png', clientPayload: 'image/png',
      })
      await fetch('/api/posts', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, imagens: [blob.url, ...(p.imagens || [])], criativoGerado: true, criativoData: r.criativoData, formato: p.formato || 'feed' }),
      })
      toast('Criativo desenhado pela IA com a identidade da marca!', 'sucesso')
      carregarPautas(planoSel)
    } catch (e: any) {
      toast(`Falha ao gerar o criativo: ${e?.message || 'erro'}`, 'erro')
    } finally {
      setGerandoCriativo(null)
    }
  }

  // Remove SÓ o criativo (imagem/arte) da pauta — a pauta continua existindo.
  async function removerCriativo(p: Pauta) {
    if (!(await confirmar('Remover o criativo desta pauta? A pauta continua — só a arte/imagem é apagada.', { titulo: 'Remover criativo', okLabel: 'Remover', cancelLabel: 'Cancelar', perigo: true }))) return
    await fetch('/api/posts', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, imagens: [], criativoData: null, criativoGerado: false, thumbnail: '', capasVideo: {} }),
    }).catch(() => {})
    toast('Criativo removido. A pauta continua.', 'sucesso')
    carregarPautas(planoSel)
  }

  // Abre o modal de geração — carrega os ativos do cliente p/ escolher a referência.
  async function abrirGerarModal(p: Pauta) {
    setGerarModal(p); setRefSel('sem'); setModalAssets([]); setModalCarregando(true)
    // A HEADLINE da pauta manda: é a frase pensada para a arte. textoImagem e
    // briefing viram reserva (pauta antiga, de antes do campo existir).
    setRefHeadline((p.headline || p.textoImagem || p.briefing || '').trim())
    // Prefill do brief rico (se a pauta já tem receita salva)
    const cd = p.criativoData || {}
    setBriefObj(cd.objetivo || '')
    setBriefVals({
      cta: cd.cta || p.cta || '', oferta: cd.oferta || '', preco: cd.preco || '', dataEvento: cd.dataEvento || '',
      horaEvento: cd.horaEvento || '', localEvento: cd.localEvento || '', legal: cd.legal || '', whatsapp: cd.whatsapp || '',
    })
    // Descobre se a foto realista está ligada e qual motor (Nano Banana/Ideogram).
    fetch('/api/studio/gerar-foto-ia').then(r => r.json()).then(d => { setIdeogramOn(!!d?.configurado); setMotorFoto(d?.motor || null) }).catch(() => { setIdeogramOn(false); setMotorFoto(null) })
    try {
      const c = await fetch(`/api/clientes?id=${p.clienteId}`).then(x => x.json())
      const assets = Array.isArray(c?.assetsMarca) ? c.assetsMarca : []
      setModalAssets(assets.filter((a: any) => a?.url).map((a: any) => ({ url: a.url, categoria: a.categoria || 'outro' })))
    } catch { /* segue sem ativos */ } finally { setModalCarregando(false) }
  }

  // Converte base64 -> File (para subir no Blob pelo fluxo upload()).
  function base64ParaFile(b64: string, nome: string): File {
    const bin = atob(b64); const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new File([bytes], nome, { type: 'image/png' })
  }

  // FOTO REALISTA (Ideogram) -> CRIATIVO do briefing. Encadeia os dois motores:
  // 1) Ideogram gera a foto (fundo); 2) o gerador de arte escreve a mensagem do
  // briefing + logo/marca POR CIMA (template "foto"). Assim sai um criativo pronto,
  // não uma foto crua. Se a etapa 2 falhar, salva a foto pura (editável no visual).
  async function gerarFotoIA(p: Pauta) {
    setGerarModal(null)
    setGerandoFoto(p.id)
    try {
      // 1) Foto base no Ideogram
      const r = await fetch('/api/studio/gerar-foto-ia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: p.id }),
      }).then(x => x.json()).catch(() => null)
      if (!r || r.error || !r.imagemBase64) { toast(r?.error || 'Falha ao gerar a foto.', 'erro'); return }
      const fotoBlob = await upload(`criativos/${p.id}-fotobase-${Date.now()}.png`, base64ParaFile(r.imagemBase64, `fotobase-${p.id}.png`), {
        access: 'public', handleUploadUrl: '/api/upload', contentType: 'image/png', clientPayload: 'image/png',
      })

      // 2) Criativo do briefing usando a foto como FUNDO (template "foto" + headline)
      const rc = await fetch('/api/studio/gerar-criativo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: p.id, template: 'foto', fundoUrl: fotoBlob.url, headline: (p.headline || p.textoImagem || p.briefing || '').trim() || undefined }),
      }).then(x => x.json()).catch(() => null)

      if (rc && !rc.error && rc.imagemBase64) {
        const artBlob = await upload(`criativos/${p.id}-${Date.now()}.png`, base64ParaFile(rc.imagemBase64, `criativo-${p.id}.png`), {
          access: 'public', handleUploadUrl: '/api/upload', contentType: 'image/png', clientPayload: 'image/png',
        })
        await fetch('/api/posts', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: p.id, imagens: [artBlob.url, ...(p.imagens || [])], criativoGerado: true, criativoData: rc.criativoData, formato: p.formato || 'feed' }),
        })
        toast('Criativo gerado com foto por IA!', 'sucesso')
      } else {
        // Fallback: salva a foto crua como fundo editável (sem overlay).
        const criativoData = { template: 'livre', corFundo: '#141414', corAccent: '#ffc00f', fundoUrl: fotoBlob.url, camadas: [] }
        await fetch('/api/posts', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: p.id, imagens: [fotoBlob.url, ...(p.imagens || [])], criativoGerado: true, criativoData, formato: p.formato || 'feed' }),
        })
        toast(`Foto gerada (sem overlay: ${rc?.error || 'a arte falhou'}). Ajuste no editor visual.`, 'info')
      }
      carregarPautas(planoSel)
    } catch (e: any) {
      toast(`Falha ao gerar a foto: ${e?.message || 'erro'}`, 'erro')
    } finally {
      setGerandoFoto(null)
    }
  }

  // Adiciona uma nova imagem de referência no modal (sobe no Blob + salva nos ativos).
  async function subirNovaRef(p: Pauta, file: File) {
    setModalEnviando(true); setModalProg(0)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const blob = await upload(`ativos/${p.clienteId}/${rid()}.${ext}`, file, {
        access: 'public', handleUploadUrl: '/api/upload', contentType: file.type, clientPayload: file.type,
        onUploadProgress: ({ percentage }) => setModalProg(percentage),
      })
      setModalAssets(a => [{ url: blob.url, categoria: 'foto' }, ...a]); setRefSel(blob.url)
      // persiste no cliente para reuso futuro
      const c = await fetch(`/api/clientes?id=${p.clienteId}`).then(x => x.json()).catch(() => null)
      const atuais = Array.isArray(c?.assetsMarca) ? c.assetsMarca : []
      await fetch('/api/clientes', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.clienteId, assetsMarca: [{ id: rid(), url: blob.url, categoria: 'foto', nome: file.name, criadoEm: new Date().toISOString() }, ...atuais] }),
      }).catch(() => {})
    } catch (e: any) { toast(`Falha no upload: ${e?.message || 'erro'}`, 'erro') }
    finally { setModalEnviando(false); setModalProg(null) }
  }

  // Abre o editor de arte a partir da receita salva. Criativos com FOTO de fundo
  // (template 'foto'/'livre' ou fundoUrl) abrem no editor VISUAL — a foto vira
  // fundo e o texto vira camadas editáveis, sem risco de "sumir" ao re-renderizar.
  function abrirEditor(p: Pauta) {
    if (!p.criativoData) { toast('Gere a arte primeiro para poder editar.', 'info'); return }
    // Criativo do motor novo (IA designer): ajuste pelo brief + regenerar (refino visual = próxima fase).
    if (p.criativoData?.template === 'html') {
      toast('Criativo do IA designer: ajuste o brief e gere de novo para alterar.', 'info')
      abrirGerarModal(p)
      return
    }
    const capa = (p.imagens || []).find(u => /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(u)) || (p.imagens || [])[0] || ''
    const cd = p.criativoData || {}
    const ehFoto = cd.template === 'livre' || cd.template === 'foto' || !!cd.fundoUrl
    // Converte foto→livre (mantém a foto de fundo, semeia o texto como camadas).
    const spec = (ehFoto && cd.template !== 'livre') ? { ...cd, template: 'livre', camadas: seedCamadas(cd) } : { ...cd }
    setEditorPost(p); setEditorSpec(spec); setEditorImg(capa); setEditorPrompt('')
    setEditorModo(ehFoto ? 'visual' : 'simples'); setSelCamada(null)
    // Carrega os ativos da marca (para adicionar como camadas de imagem no visual).
    setModalAssets([])
    fetch(`/api/clientes?id=${p.clienteId}`).then(r => r.json()).then((c: any) => {
      const assets = Array.isArray(c?.assetsMarca) ? c.assetsMarca : []
      setModalAssets(assets.filter((a: any) => a?.url).map((a: any) => ({ url: a.url, categoria: a.categoria || 'outro' })))
    }).catch(() => {})
  }

  // ===== Editor visual (Nível 2) — helpers de camada =====
  const camadas = (editorSpec?.camadas || []) as Camada[]
  function setCamadas(next: Camada[]) { setEditorSpec(sp => sp ? { ...sp, camadas: next } : sp) }
  function updCamada(id: string, patch: any) { setCamadas(camadas.map(c => c.id === id ? { ...c, ...patch } as Camada : c)) }
  function delCamada(id: string) { setCamadas(camadas.filter(c => c.id !== id)); if (selCamada === id) setSelCamada(null) }
  function moveCamada(id: string, dir: -1 | 1) {
    const i = camadas.findIndex(c => c.id === id); if (i < 0) return
    const j = i + dir; if (j < 0 || j >= camadas.length) return
    const n = [...camadas];[n[i], n[j]] = [n[j], n[i]]; setCamadas(n)
  }
  function addCamada(c: Camada) { setCamadas([...camadas, c]); setSelCamada(c.id) }
  // Deriva camadas iniciais a partir da receita de template (dá um ponto de partida).
  function seedCamadas(s: CriativoSpec): Camada[] {
    const temFoto = !!s.fundoUrl
    const cor = temFoto ? '#ffffff' : contraste(s.corFundo || '#141414')
    const out: Camada[] = []
    // Scrim escuro na base p/ o texto branco ficar legível sobre a foto.
    if (temFoto) out.push({ id: rid(), tipo: 'forma', x: 0, y: 610, w: LARGURA, h: ALTURA - 610, cor: 'rgba(0,0,0,0.5)', radius: 0 })
    if (s.logoUrl) out.push({ id: rid(), tipo: 'imagem', url: s.logoUrl, x: 80, y: 80, w: 150, h: 150, radius: 16, fit: 'contain' })
    if (s.headline) out.push({ id: rid(), tipo: 'texto', texto: s.headline, x: 88, y: temFoto ? 900 : 560, w: 904, fontSize: 78, cor, peso: 700, align: 'left', lineHeight: 1.08 })
    if (s.subheadline) out.push({ id: rid(), tipo: 'texto', texto: s.subheadline, x: 88, y: temFoto ? 1130 : 812, w: 904, fontSize: 38, cor, peso: 400, align: 'left', lineHeight: 1.3 })
    const assinatura = (s.rodape || s.handle || '').toString()
    if (assinatura) out.push({ id: rid(), tipo: 'texto', texto: assinatura, x: 88, y: temFoto ? 1275 : 1190, w: 904, fontSize: 30, cor, peso: 600, align: 'left' })
    if (out.filter(c => c.tipo === 'texto').length === 0) out.push({ id: rid(), tipo: 'texto', texto: 'Texto', x: 120, y: 600, w: 840, fontSize: 78, cor, peso: 700, align: 'left', lineHeight: 1.08 })
    return out
  }
  // Alterna para o modo visual, semeando camadas na primeira vez.
  function entrarVisual() {
    setEditorSpec(sp => {
      if (!sp) return sp
      if (sp.template === 'livre' && Array.isArray(sp.camadas) && sp.camadas.length) return sp
      return { ...sp, template: 'livre', camadas: seedCamadas(sp) }
    })
    setEditorModo('visual'); setSelCamada(null)
  }

  // Aplica edição: re-renderiza (manual) ou refina (IA), sobe no Blob e salva no post.
  async function aplicarEditor(refinar: boolean) {
    if (!editorPost || !editorSpec) return
    setEditorAplicando(true)
    try {
      const body = refinar
        ? { postId: editorPost.id, modo: 'refinar', dados: editorSpec, instrucao: editorPrompt }
        : { postId: editorPost.id, modo: 'render', dados: editorSpec }
      const r = await fetch('/api/studio/gerar-criativo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }).then(x => x.json()).catch(() => null)
      if (!r || r.error || !r.imagemBase64) { toast(r?.error || 'Falha ao aplicar.', 'erro'); return }
      const bin = atob(r.imagemBase64); const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const file = new File([bytes], `criativo-${editorPost.id}.png`, { type: 'image/png' })
      const blob = await upload(`criativos/${editorPost.id}-${Date.now()}.png`, file, {
        access: 'public', handleUploadUrl: '/api/upload', contentType: 'image/png', clientPayload: 'image/png',
      })
      const novasImagens = [blob.url, ...((editorPost.imagens || []).slice(1))]
      await fetch('/api/posts', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editorPost.id, imagens: novasImagens, criativoData: r.criativoData, criativoGerado: true }),
      }).catch(() => {})
      setEditorSpec(r.criativoData); setEditorImg(blob.url)
      setEditorPost(ep => ep ? { ...ep, imagens: novasImagens, criativoData: r.criativoData } : ep)
      if (refinar) setEditorPrompt('')
      carregarPautas(planoSel)
      toast('Arte atualizada!', 'sucesso')
    } catch (e: any) { toast(`Erro: ${e?.message || 'falha'}`, 'erro') }
    finally { setEditorAplicando(false) }
  }

  async function copiarLink(clienteId: string, clienteNome?: string) {
    const r = await fetch('/api/aprovacao-link', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId }),
    }).then(x => x.json()).catch(() => null)
    if (r?.token) {
      const link = `${window.location.origin}/aprovacoes/${r.token}`
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).catch(() => {})
      setLinkModal({ url: link, cliente: clienteNome || 'cliente' })
    } else {
      toast('Não foi possível gerar o link. Tente em Configurações › Clientes.', 'erro')
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
  // Todos os clientes ativos aparecem — quem ainda não tem plano vem marcado, e
  // escolher já abre o form do mês em vez de cair numa tela vazia.
  const comPlano = new Set(planos.map(p => p.clienteId))
  const clientesDosPlanos = (clientes as any[])
    .filter(c => c.tipo !== 'interno')
    .map(c => ({ id: c.id, nome: c.nome, temPlano: comPlano.has(c.id) }))
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'))
  const planosDoCliente = clienteSel ? planos.filter(p => p.clienteId === clienteSel) : []
  function escolherCliente(cid: string) {
    setClienteSel(cid)
    const ps = planos.filter(p => p.clienteId === cid)
    setPlanoSel(ps[0]?.id || '') // planos vêm do mais recente ao mais antigo
    if (cid && ps.length === 0) { setFormPlano(f => ({ ...f, clienteId: cid })); setNovoPlano(true) }
  }

  // Abre uma pauta clicada na visão "Hoje na produção": seleciona cliente + mês
  // e expande a pauta — tudo dentro do Studio, sem trocar de aba.
  // Post avulso (sem plano/mês, criado direto no Planner): só abre no editor se
  // ainda estiver em produção — post já encaminhado (agendado/no cliente) NÃO
  // pode cair no composer, que sem a data agendada desagendaria ao salvar.
  function abrirPautaDoBoard(p: any) {
    if (!p.planoId) {
      const emProducao = ['rascunho', 'corrigir', 'reprovado'].includes(p.status)
      if (emProducao && onAbrirComposer) onAbrirComposer(p)
      else toast('Post avulso já encaminhado — gerencie pelo Planner.', 'info')
      return
    }
    setClienteSel(p.clienteId)
    setPlanoSel(p.planoId)
    setAbertos(new Set([p.id]))
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
        {!clienteFixo && clienteSel && (
          <button className="st-btn" onClick={() => { setClienteSel(''); setPlanoSel('') }} title="Voltar para a visão geral de todos os clientes"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 14px', background: '#fff', color: '#555', border: '1px solid #ececec', borderRadius: 11, fontWeight: 600, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Hoje na produção
          </button>
        )}
        {!clienteFixo && (
          <select className="st-input" value={clienteSel} onChange={e => escolherCliente(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: 12, border: '1.5px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit', minWidth: 200, background: '#fff', cursor: 'pointer' }}>
            <option value="">Escolher cliente…</option>
            {clientesDosPlanos.map(c => <option key={c.id} value={c.id}>{c.nome}{c.temPlano ? '' : ' · sem plano'}</option>)}
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
          {podeGerarIA && <button className="st-btn st-cta" onClick={() => setPlanoModal(true)} disabled={gerandoIA} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: '#1f1f22', color: '#ffce4a', border: 'none', borderRadius: 11, fontWeight: 600, fontSize: 13, cursor: gerandoIA ? 'not-allowed' : 'pointer', opacity: gerandoIA ? 0.6 : 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61z" /></svg>
            {gerandoIA ? 'Gerando…' : 'Gerar plano com IA'}
          </button>}
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
        (!clienteSel && !clienteFixo && (postsGlobais || []).length > 0) ? (
          /* Tela de ABERTURA: visão "Hoje na produção" — todos os clientes numa
             lista só (atrasados primeiro, quem está com a bola). Clicar numa
             pauta abre ela aqui mesmo, no cliente e mês certos. */
          <ProducaoBoard
            clientes={(clientes as any[]).filter(c => c.tipo !== 'interno')}
            posts={postsGlobais as any}
            usuarios={usuariosEquipe}
            meuEmail={meuEmail}
            onAbrirPauta={abrirPautaDoBoard}
          />
        ) : (
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
                  {clientesDosPlanos.some(c => c.temPlano) && (
                    <optgroup label="Com plano">
                      {clientesDosPlanos.filter(c => c.temPlano).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </optgroup>
                  )}
                  {clientesDosPlanos.some(c => !c.temPlano) && (
                    <optgroup label="Sem plano — escolher já cria">
                      {clientesDosPlanos.filter(c => !c.temPlano).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </optgroup>
                  )}
                </select>
                {clientesDosPlanos.length === 0 && <p style={{ margin: '16px 0 0', fontSize: 12.5, color: '#bbb' }}>Nenhum cliente cadastrado ainda.</p>}
              </>
            ) : (
              <>
                <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#111' }}>Escolha o mês</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#999' }}>Selecione um mês acima, ou clique em “+ Novo plano” para começar.</p>
              </>
            )}
          </div>
        )
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
              const anot = Array.isArray(p.anotacoes) ? p.anotacoes : []
              const podeEnviar = ['rascunho', 'corrigir', 'reprovado'].includes(p.status)
              const semMidia = (p.imagens || []).length === 0
              const aberto = abertos.has(p.id)
              const capa = (p.imagens || []).find(u => /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(u))
              const podeGerar = podeEditar && podeGerarIA && ['rascunho', 'corrigir', 'reprovado'].includes(p.status)
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
                        <span style={{ fontSize: 11.5, color: atrasada(p) ? '#b91c1c' : '#9a9a9a', fontWeight: atrasada(p) ? 800 : undefined, whiteSpace: 'nowrap' }}>{dataFmt}</span>
                        {atrasada(p) && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 999, background: '#fee2e2', color: '#b91c1c', fontSize: 10.5, fontWeight: 800, whiteSpace: 'nowrap' }}>Atrasado</span>
                        )}
                        {!atrasada(p) && emRisco(p) && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 999, background: '#fef3c7', color: '#92400e', fontSize: 10.5, fontWeight: 800, whiteSpace: 'nowrap' }}>Vence em breve</span>
                        )}
                      </div>
                    </div>
                    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                      {podeGerar && (() => { const ocupado = gerandoCriativo === p.id || gerandoFoto === p.id; return (
                        <button className="st-btn" onClick={() => abrirGerarModal(p)} disabled={ocupado} title="A IA dirige a arte e gera a imagem da marca"
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: 'transparent', color: '#7a6a2e', border: '1px solid #ece6d3', borderRadius: 10, fontWeight: 500, fontSize: 11.5, cursor: ocupado ? 'wait' : 'pointer', opacity: ocupado ? 0.7 : 1, whiteSpace: 'nowrap' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#b8901f"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61z" /></svg>
                          {gerandoFoto === p.id ? 'Gerando foto…' : gerandoCriativo === p.id ? 'Gerando…' : (capa ? 'Regerar' : 'Criar arte')}
                        </button>
                      ) })()}
                      {podeEnviar && !semMidia && podeEditar && podeEnviarCliente && (
                        <button className="st-btn" onClick={() => enviarAoCliente(p)} style={{ padding: '8px 15px', background: '#ffcb3a', color: '#3d3000', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 11.5, cursor: 'pointer', whiteSpace: 'nowrap' }}>Enviar</button>
                      )}
                      {p.status === 'aguardando_aprovacao' && (
                        <button className="st-btn" onClick={() => copiarLink(p.clienteId, p.clienteNome)} style={{ padding: '8px 13px', background: '#fff', color: '#555', border: '1px solid #ececec', borderRadius: 10, fontWeight: 500, fontSize: 11.5, cursor: 'pointer', whiteSpace: 'nowrap' }}>Compartilhar link</button>
                      )}
                    </div>
                  </div>

                  {/* Painel expandido — edição completa (formato/data viram controles bonitos) */}
                  {aberto && (
                    <div className="st-detail" style={{ display: 'flex', gap: 24, flexWrap: 'wrap', padding: '2px 20px 22px 45px' }}>
                      {/* Régua do pipeline: onde a pauta está e o próximo passo */}
                      <div style={{ flexBasis: '100%' }}><PipelinePauta p={p} /></div>
                      <div style={{ flex: '1 1 400px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {podeEditar && podeGerarIA && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: -8 }}>
                            <button className="st-btn" onClick={() => gerarCopyIA(p)} disabled={gerandoCopy === p.id}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#1f1f22', color: '#ffce4a', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 11.5, cursor: gerandoCopy === p.id ? 'not-allowed' : 'pointer', opacity: gerandoCopy === p.id ? 0.6 : 1 }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61z" /></svg>
                              {gerandoCopy === p.id ? 'Gerando copy…' : 'Gerar copy'}
                            </button>
                          </div>
                        )}
                        <div><CampoLabel>Pauta / briefing</CampoLabel><CelulaEditavel valor={p.briefing} editavel={podeEditar} placeholder="Tema / ângulo da pauta..." onSalvar={v => salvarCampo(p.id, 'briefing', v)} /></div>
                        <div><CampoLabel>Headline (arte / abertura do vídeo)</CampoLabel><CelulaEditavel valor={p.headline} editavel={podeEditar} placeholder="A frase que faz o dedo parar..." onSalvar={v => salvarCampo(p.id, 'headline', v)} /></div>
                        <div><CampoLabel>Sub-headline (opcional)</CampoLabel><CelulaEditavel valor={p.subheadline} editavel={podeEditar} placeholder="Apoio da headline na arte..." onSalvar={v => salvarCampo(p.id, 'subheadline', v)} /></div>
                        <div><CampoLabel>Copy do criativo (texto na arte)</CampoLabel><CelulaEditavel valor={p.textoImagem} editavel={podeEditar} placeholder="Texto que aparece na imagem..." onSalvar={v => salvarCampo(p.id, 'textoImagem', v)} /></div>
                        <div><CampoLabel>CTA (na arte)</CampoLabel><CelulaEditavel valor={p.cta} editavel={podeEditar} placeholder="Chamada curta: Agende agora, Chame no WhatsApp..." onSalvar={v => salvarCampo(p.id, 'cta', v)} /></div>
                        <div><CampoLabel>Legenda</CampoLabel><CelulaEditavel valor={p.legenda} editavel={podeEditar} placeholder="Legenda / copy do post..." onSalvar={v => salvarCampo(p.id, 'legenda', v)} /></div>
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
                        <div>
                          <CampoLabel>Anexos (referências p/ o designer)</CampoLabel>
                          {(p.anexos || []).length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                              {(p.anexos || []).map(a => (
                                <div key={a.url} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fafafa', border: '1px solid #eee', borderRadius: 9, padding: '6px 10px' }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                                  <a href={a.url} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 12, color: '#1d4ed8', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome}</a>
                                  {podeEditar && (
                                    <button onClick={() => salvarAnexos(p.id, (p.anexos || []).filter(x => x.url !== a.url))} title="Remover anexo" style={{ background: 'none', border: 'none', color: '#c0716b', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {podeEditar && (
                            <label className="st-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fff', color: '#555', border: '1px solid #ececec', borderRadius: 10, fontWeight: 600, fontSize: 11.5, cursor: anexando === p.id ? 'wait' : 'pointer' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                              {anexando === p.id ? 'Enviando…' : 'Anexar arquivo'}
                              <input type="file" multiple style={{ display: 'none' }} disabled={anexando !== null}
                                onChange={e => { if (e.target.files?.length) anexarArquivos(p, e.target.files); e.target.value = '' }} />
                            </label>
                          )}
                        </div>
                      </div>
                      <div style={{ flex: '0 0 190px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                          <CampoLabel>Criativo</CampoLabel>
                          {capa ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                              <img className="st-preview" src={capa} alt="" onClick={() => setPreview(p)} title="Ampliar (prévia de post)" style={{ width: 160, height: 200, borderRadius: 16, objectFit: 'cover', border: '1px solid rgba(17,17,17,.06)', boxShadow: '0 14px 34px -18px rgba(0,0,0,.45)', cursor: 'zoom-in' }} />
                              {p.criativoGerado && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 800, color: '#7c3aed' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: '#7c3aed' }} />Gerado pela IA · toque para ampliar</span>}
                              {podeEditar && p.criativoData && <button className="st-btn" onClick={() => abrirEditor(p)} style={{ width: 160, padding: '8px 0', background: '#fff', color: '#7c3aed', border: '1px solid #e6dcf7', borderRadius: 10, fontWeight: 600, fontSize: 11.5, cursor: 'pointer' }}>Editar arte</button>}
                              {podeEditar && <button className="st-btn" onClick={() => removerCriativo(p)} style={{ width: 160, padding: '7px 0', background: '#fff', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 10, fontWeight: 600, fontSize: 11.5, cursor: 'pointer' }}>Remover criativo</button>}
                            </div>
                          ) : <div style={{ width: 160, height: 200, borderRadius: 16, border: '1.5px dashed #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#bbb', textAlign: 'center', padding: 8, background: '#fbfbfc' }}>Sem criativo ainda</div>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, width: 160 }}>
                          {podeEditar && podeEnviar && podeEnviarCliente && (
                            <button className="st-btn st-cta" onClick={() => enviarAoCliente(p)} style={{ padding: '10px 8px', background: '#ffcb3a', color: '#3d3000', border: 'none', borderRadius: 11, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Enviar ao cliente</button>
                          )}
                          {podeEditar && onAbrirComposer && (
                            <button className="st-btn" onClick={() => onAbrirComposer(p)} style={{ padding: '9px 8px', background: '#fff', color: '#555', border: '1px solid #ececec', borderRadius: 11, fontWeight: 500, fontSize: 11.5, cursor: 'pointer' }}>{semMidia ? 'Subir manual' : 'Abrir no editor'}</button>
                          )}
                          {/* Controles manuais: a automação é o caminho fluido, mas quem manda é o responsável */}
                          {podeEditar && p.etapa === 'aprovacao_copy' && (
                            <button className="st-btn" onClick={() => aprovarCopyInterno(p)} disabled={acaoPauta === p.id}
                              style={{ padding: '9px 8px', background: '#fff', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 11, fontWeight: 600, fontSize: 11.5, cursor: acaoPauta === p.id ? 'wait' : 'pointer' }}>
                              Aprovar copy internamente
                            </button>
                          )}
                          {podeEditar && p.etapa && p.etapa !== 'pronto' && (
                            <button className="st-btn" onClick={() => criarTarefaManual(p)} disabled={acaoPauta === p.id}
                              title={p.tarefaId ? 'Já existe tarefa vinculada — clicar atualiza/reabre' : 'Cria a tarefa desta pauta na Gestão de tarefas'}
                              style={{ padding: '9px 8px', background: '#fff', color: '#1d4ed8', border: '1px solid #dbeafe', borderRadius: 11, fontWeight: 600, fontSize: 11.5, cursor: acaoPauta === p.id ? 'wait' : 'pointer' }}>
                              {p.tarefaId ? 'Tarefa vinculada' : 'Criar tarefa desta pauta'}
                            </button>
                          )}
                          {podeExcluir && (
                            <button onClick={() => excluir(p)} style={{ padding: '6px 8px', background: 'transparent', color: '#c0716b', border: 'none', borderRadius: 8, fontWeight: 500, fontSize: 10.5, cursor: 'pointer' }}>Excluir</button>
                          )}
                        </div>
                        {(ajuste || anot.length > 0) && (
                          <div style={{ margin: 0, fontSize: 11, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '8px 10px', width: 160, boxSizing: 'border-box', lineHeight: 1.45 }}>
                            <strong>Cliente pediu:</strong>
                            {ajuste && <div style={{ marginTop: 3, whiteSpace: 'pre-wrap' }}>{String(ajuste)}</div>}
                            {anot.length > 0 && <ol style={{ margin: '4px 0 0', paddingLeft: 15 }}>{anot.map((a: any, i: number) => <li key={i}>{a.text || a.texto}</li>)}</ol>}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Editor de arte (Nível 1) — editar textos/cores/template + refinar por prompt */}
      {editorPost && editorSpec && (() => {
        const s = editorSpec
        const set = (patch: Partial<CriativoSpec>) => setEditorSpec(sp => sp ? { ...sp, ...patch } : sp)
        const inp: any = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 9, border: '1px solid #e6e6e6', fontSize: 12.5, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.4 }
        const ghost: any = { padding: '5px 10px', background: '#f5f5f5', border: 'none', borderRadius: 8, color: '#888', cursor: 'pointer', fontSize: 12, fontWeight: 600 }
        return (
          <div onClick={fecharFora(() => !editorAplicando && setEditorPost(null))} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, maxWidth: editorModo === 'visual' ? 940 : 720, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22, animation: 'stFade .18s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14, gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 17, color: '#111' }}>Editar arte</h3>
                <div style={{ display: 'inline-flex', gap: 3, background: '#f4f4f5', borderRadius: 999, padding: 3, marginLeft: 'auto' }}>
                  {(['simples', 'visual'] as const).map(m => { const on = editorModo === m; return (
                    <button key={m} onClick={() => m === 'visual' ? entrarVisual() : setEditorModo('simples')} style={{ padding: '5px 15px', borderRadius: 999, border: 'none', background: on ? '#1f1f22' : 'transparent', color: on ? '#fff' : '#8a8a8a', fontWeight: on ? 700 : 500, fontSize: 12, cursor: 'pointer' }}>{m === 'simples' ? 'Simples' : 'Visual'}</button>
                  ) })}
                </div>
                <button onClick={() => setEditorPost(null)} aria-label="Fechar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', display: 'flex' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
              </div>
              {editorModo === 'simples' && (
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 220px' }}>
                  {editorImg ? <img src={editorImg} alt="" style={{ width: 220, height: 275, objectFit: 'cover', borderRadius: 14, border: '1px solid #eee', boxShadow: '0 14px 34px -18px rgba(0,0,0,.4)' }} /> : <div style={{ width: 220, height: 275, borderRadius: 14, background: '#f4f4f5' }} />}
                  {editorAplicando && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#7c3aed', fontWeight: 700 }}>Aplicando…</p>}
                </div>
                <div style={{ flex: '1 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <CampoLabel>Template</CampoLabel>
                    <div style={{ display: 'inline-flex', gap: 4, background: '#f4f4f5', borderRadius: 11, padding: 3, flexWrap: 'wrap' }}>
                      {TEMPLATES_ART.map(t => { const on = s.template === t.key; return (
                        <button key={t.key} onClick={() => set({ template: t.key })} style={{ padding: '6px 11px', borderRadius: 8, border: 'none', background: on ? '#fff' : 'transparent', color: on ? '#111' : '#8a8a8a', fontWeight: on ? 700 : 500, fontSize: 12, cursor: 'pointer', boxShadow: on ? '0 1px 4px rgba(0,0,0,.12)' : 'none' }}>{t.label}</button>
                      ) })}
                    </div>
                  </div>
                  <div><CampoLabel>Headline</CampoLabel><textarea value={s.headline || ''} onChange={e => set({ headline: e.target.value })} rows={2} className="st-input" style={inp} /></div>
                  <div><CampoLabel>Subtexto</CampoLabel><textarea value={s.subheadline || ''} onChange={e => set({ subheadline: e.target.value })} rows={2} className="st-input" style={inp} /></div>
                  {s.template === 'dica' && (
                    <div>
                      <CampoLabel>Bullets</CampoLabel>
                      {(s.bullets || []).map((b, i) => (
                        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                          <input value={b} onChange={e => { const bl = [...(s.bullets || [])]; bl[i] = e.target.value; set({ bullets: bl }) }} className="st-input" style={{ ...inp, flex: 1 }} />
                          <button onClick={() => set({ bullets: (s.bullets || []).filter((_, j) => j !== i) })} style={ghost}>×</button>
                        </div>
                      ))}
                      {(s.bullets || []).length < 4 && <button onClick={() => set({ bullets: [...(s.bullets || []), ''] })} style={ghost}>+ bullet</button>}
                    </div>
                  )}
                  <div><CampoLabel>Rodapé / assinatura</CampoLabel><input value={s.rodape || ''} onChange={e => set({ rodape: e.target.value })} className="st-input" style={inp} /></div>
                  <div style={{ display: 'flex', gap: 18 }}>
                    <div><CampoLabel>Cor de fundo</CampoLabel><input type="color" value={s.corFundo || '#141414'} onChange={e => set({ corFundo: e.target.value })} style={{ width: 48, height: 34, borderRadius: 8, border: '1px solid #e6e6e6', cursor: 'pointer', background: '#fff' }} /></div>
                    <div><CampoLabel>Cor de destaque</CampoLabel><input type="color" value={s.corAccent || '#ffc00f'} onChange={e => set({ corAccent: e.target.value })} style={{ width: 48, height: 34, borderRadius: 8, border: '1px solid #e6e6e6', cursor: 'pointer', background: '#fff' }} /></div>
                  </div>
                  <button className="st-btn st-cta" onClick={() => aplicarEditor(false)} disabled={editorAplicando} style={{ padding: '11px 0', background: '#ffcb3a', color: '#3d3000', border: 'none', borderRadius: 11, fontWeight: 700, fontSize: 13, cursor: editorAplicando ? 'wait' : 'pointer', opacity: editorAplicando ? 0.6 : 1 }}>Aplicar mudanças</button>
                  <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                    <CampoLabel>Refinar com IA</CampoLabel>
                    <textarea value={editorPrompt} onChange={e => setEditorPrompt(e.target.value)} placeholder="Ex.: deixa mais minimalista, encurta a headline, tom mais sério…" rows={2} className="st-input" style={inp} />
                    <button className="st-btn" onClick={() => aplicarEditor(true)} disabled={editorAplicando || !editorPrompt.trim()} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: '#1f1f22', color: '#ffce4a', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 12.5, cursor: editorPrompt.trim() && !editorAplicando ? 'pointer' : 'not-allowed', opacity: editorPrompt.trim() && !editorAplicando ? 1 : 0.5 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61z" /></svg>
                      Refinar
                    </button>
                  </div>
                </div>
              </div>
              )}
              {editorModo === 'visual' && (() => {
                const CW = 300, scale = CW / LARGURA, CH = ALTURA * scale
                const sel = camadas.find(c => c.id === selCamada) || null
                const onMove = (e: any) => { const d = dragRef.current; if (!d) return; updCamada(d.id, { x: Math.round(d.ox + (e.clientX - d.sx) / scale), y: Math.round(d.oy + (e.clientY - d.sy) / scale) }) }
                const startDrag = (c: Camada, e: any) => { e.stopPropagation(); setSelCamada(c.id); dragRef.current = { id: c.id, sx: e.clientX, sy: e.clientY, ox: c.x, oy: c.y } }
                const num: any = { width: 62, padding: '5px 7px', borderRadius: 7, border: '1px solid #e6e6e6', fontSize: 12, fontFamily: 'inherit' }
                const mini: any = { padding: '4px 8px', background: '#f5f5f5', border: 'none', borderRadius: 7, color: '#666', cursor: 'pointer', fontSize: 11.5, fontWeight: 600 }
                return (
                  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                    <div style={{ flex: '0 0 auto' }}>
                      <div onPointerDown={e => { if (e.currentTarget === e.target) setSelCamada(null) }} onPointerMove={onMove} onPointerUp={() => { dragRef.current = null }} onPointerLeave={() => { dragRef.current = null }}
                        style={{ position: 'relative', width: CW, height: CH, borderRadius: 12, overflow: 'hidden', background: s.corFundo || '#141414', border: '1px solid #e6e6e6', boxShadow: '0 14px 34px -18px rgba(0,0,0,.4)', touchAction: 'none', userSelect: 'none' }}>
                        {s.fundoUrl && <img src={s.fundoUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />}
                        {camadas.map(c => {
                          const on = c.id === selCamada
                          const common: any = { position: 'absolute', left: c.x * scale, top: c.y * scale, cursor: 'move', outline: on ? '2px solid #7c3aed' : '1px dashed rgba(255,255,255,.22)', outlineOffset: 1 }
                          if (c.tipo === 'texto') return <div key={c.id} onPointerDown={e => startDrag(c, e)} style={{ ...common, width: c.w * scale }}><span style={{ display: 'block', width: '100%', fontSize: c.fontSize * scale, color: c.cor, fontWeight: c.peso, textAlign: c.align, lineHeight: c.lineHeight || 1.15, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.texto}</span></div>
                          if (c.tipo === 'imagem') return <img key={c.id} onPointerDown={e => startDrag(c, e)} src={c.url} alt="" style={{ ...common, width: c.w * scale, height: c.h * scale, objectFit: c.fit, borderRadius: c.radius * scale }} />
                          return <div key={c.id} onPointerDown={e => startDrag(c, e)} style={{ ...common, width: c.w * scale, height: c.h * scale, background: c.cor, borderRadius: c.radius * scale }} />
                        })}
                      </div>
                      <p style={{ margin: '8px 0 0', fontSize: 11, color: '#aaa' }}>Arraste os elementos. Toque para selecionar.</p>
                      {editorAplicando && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#7c3aed', fontWeight: 700 }}>Aplicando…</p>}
                    </div>
                    <div style={{ flex: '1 1 300px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button style={mini} onClick={() => addCamada({ id: rid(), tipo: 'texto', texto: 'Novo texto', x: 120, y: 300, w: 760, fontSize: 56, cor: s.fundoUrl ? '#ffffff' : contraste(s.corFundo || '#141414'), peso: 700, align: 'left', lineHeight: 1.15 })}>+ Texto</button>
                        <button style={mini} onClick={() => addCamada({ id: rid(), tipo: 'forma', x: 120, y: 300, w: 400, h: 120, cor: s.corAccent || '#ffc00f', radius: 16 })}>+ Forma</button>
                      </div>
                      {modalAssets.length > 0 && (
                        <div>
                          <CampoLabel>Adicionar imagem da marca</CampoLabel>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {modalAssets.slice(0, 10).map(a => (
                              <button key={a.url} onClick={() => addCamada({ id: rid(), tipo: 'imagem', url: a.url, x: 120, y: 120, w: 320, h: 320, radius: 0, fit: a.categoria === 'logo' || a.categoria === 'icone' ? 'contain' : 'cover' })} style={{ width: 42, height: 42, borderRadius: 8, overflow: 'hidden', border: '1px solid #e6e6e6', padding: 0, cursor: 'pointer', background: '#fff' }}>
                                <img src={a.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
                        <div><CampoLabel>Cor de fundo</CampoLabel><input type="color" value={s.corFundo || '#141414'} onChange={e => set({ corFundo: e.target.value })} style={{ width: 44, height: 32, borderRadius: 8, border: '1px solid #e6e6e6', cursor: 'pointer', background: '#fff' }} /></div>
                        {s.fundoUrl && <button style={mini} onClick={() => set({ fundoUrl: '' })}>Remover foto de fundo</button>}
                      </div>
                      <div>
                        <CampoLabel>Camadas</CampoLabel>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {[...camadas].reverse().map(c => {
                            const on = c.id === selCamada
                            const nome = c.tipo === 'texto' ? (c.texto || 'Texto').slice(0, 20) : c.tipo === 'imagem' ? 'Imagem' : 'Forma'
                            return (
                              <div key={c.id} onClick={() => setSelCamada(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 8px', borderRadius: 8, background: on ? '#f3ecff' : '#fafafa', border: on ? '1px solid #d9c9f7' : '1px solid #f0f0f0', cursor: 'pointer' }}>
                                <span style={{ flex: 1, fontSize: 12, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
                                <button onClick={e => { e.stopPropagation(); moveCamada(c.id, 1) }} style={mini} title="Trazer para frente">↑</button>
                                <button onClick={e => { e.stopPropagation(); moveCamada(c.id, -1) }} style={mini} title="Enviar para trás">↓</button>
                                <button onClick={e => { e.stopPropagation(); delCamada(c.id) }} style={{ ...mini, color: '#c0392b' }} title="Excluir">×</button>
                              </div>
                            )
                          })}
                          {!camadas.length && <p style={{ margin: 0, fontSize: 12, color: '#bbb' }}>Sem camadas. Adicione texto, forma ou imagem.</p>}
                        </div>
                      </div>
                      {sel && (
                        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <CampoLabel>Selecionado</CampoLabel>
                          {sel.tipo === 'texto' && <>
                            <textarea value={sel.texto} onChange={e => updCamada(sel.id, { texto: e.target.value })} rows={2} className="st-input" style={inp} />
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                              <label style={{ fontSize: 11, color: '#888' }}>Tam. <input type="number" value={sel.fontSize} onChange={e => updCamada(sel.id, { fontSize: Number(e.target.value) || 12 })} style={num} /></label>
                              <label style={{ fontSize: 11, color: '#888' }}>Larg. <input type="number" value={sel.w} onChange={e => updCamada(sel.id, { w: Number(e.target.value) || 40 })} style={num} /></label>
                              <select value={sel.peso} onChange={e => updCamada(sel.id, { peso: Number(e.target.value) })} style={{ ...num, width: 96 }}><option value={400}>Regular</option><option value={600}>Semibold</option><option value={700}>Bold</option></select>
                              <input type="color" value={sel.cor} onChange={e => updCamada(sel.id, { cor: e.target.value })} style={{ width: 40, height: 30, borderRadius: 7, border: '1px solid #e6e6e6', cursor: 'pointer', background: '#fff' }} />
                            </div>
                            <div style={{ display: 'inline-flex', gap: 3, background: '#f4f4f5', borderRadius: 8, padding: 3, alignSelf: 'flex-start' }}>
                              {(['left', 'center', 'right'] as const).map(al => { const ona = sel.align === al; return <button key={al} onClick={() => updCamada(sel.id, { align: al })} style={{ padding: '4px 11px', borderRadius: 6, border: 'none', background: ona ? '#fff' : 'transparent', color: ona ? '#111' : '#999', fontSize: 11, fontWeight: ona ? 700 : 500, cursor: 'pointer', boxShadow: ona ? '0 1px 3px rgba(0,0,0,.12)' : 'none' }}>{al === 'left' ? 'Esq.' : al === 'center' ? 'Centro' : 'Dir.'}</button> })}
                            </div>
                          </>}
                          {sel.tipo === 'imagem' && (
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                              <label style={{ fontSize: 11, color: '#888' }}>Larg. <input type="number" value={sel.w} onChange={e => updCamada(sel.id, { w: Number(e.target.value) || 20 })} style={num} /></label>
                              <label style={{ fontSize: 11, color: '#888' }}>Alt. <input type="number" value={sel.h} onChange={e => updCamada(sel.id, { h: Number(e.target.value) || 20 })} style={num} /></label>
                              <label style={{ fontSize: 11, color: '#888' }}>Raio <input type="number" value={sel.radius} onChange={e => updCamada(sel.id, { radius: Number(e.target.value) || 0 })} style={num} /></label>
                              <select value={sel.fit} onChange={e => updCamada(sel.id, { fit: e.target.value })} style={{ ...num, width: 104 }}><option value="cover">Preencher</option><option value="contain">Conter</option></select>
                            </div>
                          )}
                          {sel.tipo === 'forma' && (
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                              <label style={{ fontSize: 11, color: '#888' }}>Larg. <input type="number" value={sel.w} onChange={e => updCamada(sel.id, { w: Number(e.target.value) || 20 })} style={num} /></label>
                              <label style={{ fontSize: 11, color: '#888' }}>Alt. <input type="number" value={sel.h} onChange={e => updCamada(sel.id, { h: Number(e.target.value) || 20 })} style={num} /></label>
                              <label style={{ fontSize: 11, color: '#888' }}>Raio <input type="number" value={sel.radius} onChange={e => updCamada(sel.id, { radius: Number(e.target.value) || 0 })} style={num} /></label>
                              <input type="color" value={sel.cor} onChange={e => updCamada(sel.id, { cor: e.target.value })} style={{ width: 40, height: 30, borderRadius: 7, border: '1px solid #e6e6e6', cursor: 'pointer', background: '#fff' }} />
                            </div>
                          )}
                        </div>
                      )}
                      <button className="st-btn st-cta" onClick={() => aplicarEditor(false)} disabled={editorAplicando} style={{ padding: '11px 0', background: '#ffcb3a', color: '#3d3000', border: 'none', borderRadius: 11, fontWeight: 700, fontSize: 13, cursor: editorAplicando ? 'wait' : 'pointer', opacity: editorAplicando ? 0.6 : 1 }}>Renderizar arte</button>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )
      })()}

      {/* Quantas pautas gerar e com quais pilares. Entram NO PLANO ATUAL. */}
      {planoModal && (
        <div onClick={fecharFora(() => setPlanoModal(false), { temAlteracoes: () => !!gerarPilares.trim() })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 420, width: '100%', padding: 22 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#111' }}>Gerar pautas com IA</h3>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#999', lineHeight: 1.5 }}>
              Elas entram no plano aberto, a partir de hoje. A IA recebe o que esta marca já publicou e não repete tema usado.
            </p>

            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Quantas pautas</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              {[1, 2, 3, 5, 8, 12].map(n => (
                <button key={n} onClick={() => setGerarQtd(n)} style={{
                  minWidth: 40, padding: '7px 12px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  background: gerarQtd === n ? '#111' : '#fff', color: gerarQtd === n ? '#fff' : '#555',
                  border: gerarQtd === n ? '1px solid #111' : '1px solid #e5e7eb',
                }}>{n}</button>
              ))}
              <input type="number" min={1} max={30} value={gerarQtd}
                onChange={e => setGerarQtd(Math.min(Math.max(Number(e.target.value) || 1, 1), 30))}
                style={{ width: 74, padding: '7px 10px', borderRadius: 9, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
            </div>
            <p style={{ margin: '0 0 14px', fontSize: 11, color: '#bbb' }}>De 1 a 30. O mês fechado costuma ser 12.</p>

            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Pilares (opcional)</label>
            <input value={gerarPilares} onChange={e => setGerarPilares(e.target.value)}
              placeholder="Ex.: bastidor, prova social, educativo"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
            <p style={{ margin: '5px 0 16px', fontSize: 11, color: '#bbb' }}>Em branco, a IA equilibra os pilares da marca sozinha.</p>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setPlanoModal(false)} style={{ padding: '9px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => gerarPlanoIA(gerarQtd, gerarPilares)} style={{ padding: '9px 18px', background: '#1f1f22', color: '#ffce4a', border: 'none', borderRadius: 9, fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>
                Gerar {gerarQtd} {gerarQtd === 1 ? 'pauta' : 'pautas'}
              </button>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 11, color: '#bbb' }}>Consome créditos da IA.</p>
          </div>
        </div>
      )}

      {/* Modal "Gerar arte" — escolher imagem de referência */}
      {gerarModal && (() => {
        const p = gerarModal
        return (
          <div onClick={fecharFora(() => setGerarModal(null))} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, maxWidth: 540, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22, animation: 'stFade .18s ease' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 17, color: '#111', letterSpacing: '-0.01em' }}>Gerar arte com IA</h3>
              <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#888', lineHeight: 1.5 }}>A IA usa a imagem de referência + <strong>logo</strong>, <strong>cores</strong> e <strong>fontes</strong> da marca.</p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 10.5, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Texto principal (headline)</label>
                <textarea value={refHeadline} onChange={e => setRefHeadline(e.target.value)} placeholder="Frase forte que aparece na arte..." rows={2}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.4 }} />
                <p style={{ margin: '5px 0 0', fontSize: 11, color: '#bbb' }}>A IA usa <strong>exatamente</strong> essa frase como título da arte (seguida à risca).</p>
              </div>

              {/* Brief do anúncio (motor novo) — objetivo + campos que entram na arte */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 10.5, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Objetivo do post</label>
                <select value={briefObj} onChange={e => setBriefObj(e.target.value)}
                  style={{ width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', background: '#fff' }}>
                  <option value="">Automático (a IA decide pelo briefing)</option>
                  {OBJETIVOS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
                {(() => {
                  const def = objetivoDef(briefObj)
                  const campos = def?.campos?.length ? def.campos : []
                  if (!campos.length) return def ? <p style={{ margin: '5px 0 0', fontSize: 11, color: '#bbb' }}>{def.dica}</p> : null
                  const rotulo: Record<string, string> = { cta: 'Chamada (CTA)', oferta: 'Oferta', preco: 'Preço', dataEvento: 'Data', horaEvento: 'Hora', localEvento: 'Local', legal: 'Texto legal', whatsapp: 'WhatsApp' }
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, marginTop: 8 }}>
                      {campos.map(c => (
                        <input key={c} value={briefVals[c] || ''} onChange={e => setBriefVals(v => ({ ...v, [c]: e.target.value }))}
                          placeholder={rotulo[c] || c}
                          style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid #e6e6e6', fontSize: 12.5, fontFamily: 'inherit' }} />
                      ))}
                    </div>
                  )
                })()}
              </div>

              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Imagem de referência</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 10 }}>
                <button onClick={() => setRefSel('sem')} style={{ aspectRatio: '1/1', borderRadius: 12, border: refSel === 'sem' ? '2px solid var(--marca, #ffc00f)' : '1.5px solid #e6e6e6', background: '#fafafa', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#888', fontSize: 11, fontWeight: 600 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4l16 16M20 4L4 20" /></svg>
                  Sem imagem
                </button>
                <label style={{ aspectRatio: '1/1', borderRadius: 12, border: '1.5px dashed #d8d8d8', background: '#fbfbfc', cursor: modalEnviando ? 'wait' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#888', fontSize: 11, fontWeight: 600, textAlign: 'center', padding: 6 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  {modalEnviando ? (modalProg != null ? `${modalProg}%` : 'Enviando…') : 'Nova imagem'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} disabled={modalEnviando} onChange={e => { if (e.target.files?.[0]) subirNovaRef(p, e.target.files[0]); e.target.value = '' }} />
                </label>
                {modalAssets.map(a => (
                  <button key={a.url} onClick={() => setRefSel(a.url)} style={{ aspectRatio: '1/1', borderRadius: 12, overflow: 'hidden', border: refSel === a.url ? '2px solid var(--marca, #ffc00f)' : '1.5px solid #e6e6e6', padding: 0, cursor: 'pointer', background: '#eee' }}>
                    <img src={a.url} alt="" style={{ width: '100%', height: '100%', objectFit: a.categoria === 'logo' || a.categoria === 'icone' ? 'contain' : 'cover', background: '#fff' }} />
                  </button>
                ))}
              </div>
              {modalCarregando && <p style={{ margin: '10px 0 0', fontSize: 12, color: '#aaa' }}>Carregando ativos…</p>}
              {!modalCarregando && modalAssets.length === 0 && <p style={{ margin: '10px 0 0', fontSize: 12, color: '#bbb' }}>Nenhum ativo da marca ainda. Use “Nova imagem” ou gere sem imagem.</p>}
              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button className="st-btn st-cta" onClick={() => gerarCriativoHtml(p, { ...(refSel === 'sem' ? { semFoto: true } : { fundoUrl: refSel }), headline: refHeadline.trim() || undefined })} disabled={modalEnviando}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px 0', background: '#1f1f22', color: '#ffce4a', border: 'none', borderRadius: 11, fontWeight: 600, fontSize: 13.5, cursor: modalEnviando ? 'wait' : 'pointer', opacity: modalEnviando ? 0.6 : 1 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61z" /></svg>
                  Gerar arte (IA designer)
                </button>
                <button onClick={() => setGerarModal(null)} style={{ padding: '12px 20px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 11, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              </div>
              <button className="st-btn" onClick={() => gerarCriativo(p, { ...(refSel === 'sem' ? { semFoto: true } : { fundoUrl: refSel }), headline: refHeadline.trim() || undefined })} disabled={modalEnviando}
                style={{ marginTop: 10, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 0', background: '#fff', color: '#111', border: '1px solid #e6e6e6', borderRadius: 11, fontWeight: 600, fontSize: 13, cursor: modalEnviando ? 'wait' : 'pointer', opacity: modalEnviando ? 0.6 : 1 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
                Modo clássico (templates)
              </button>
              {ideogramOn && (
                <button className="st-btn" onClick={() => gerarFotoIA(p)} disabled={modalEnviando}
                  style={{ marginTop: 10, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 0', background: '#fff', color: '#111', border: '1px solid #e6e6e6', borderRadius: 11, fontWeight: 600, fontSize: 13, cursor: modalEnviando ? 'wait' : 'pointer', opacity: modalEnviando ? 0.6 : 1 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.5-3.5L11 18" /></svg>
                  Foto realista (IA) — {motorFoto === 'nano-banana' ? 'Nano Banana' : 'Ideogram'}
                </button>
              )}
              <p style={{ margin: '8px 0 0', fontSize: 11, color: '#bbb', textAlign: 'center' }}>{ideogramOn ? (motorFoto === 'nano-banana' ? 'A foto usa as FOTOS REAIS da marca como referência (Nano Banana).' : 'Arte de marca (template) ou foto realista gerada por IA.') : 'Foto realista por IA disponível ao configurar GEMINI_API_KEY (Nano Banana).'}</p>
            </div>
          </div>
        )
      })()}

      {/* Modal de compartilhamento do link de aprovação */}
      {linkModal && (
        <div onClick={fecharFora(() => setLinkModal(null), { perguntar: false })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 460, width: '100%', padding: 22, animation: 'stFade .18s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              </span>
              <h3 style={{ margin: 0, fontSize: 16.5, color: '#111' }}>Link de aprovação — {linkModal.cliente}</h3>
            </div>
            <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#888', lineHeight: 1.5 }}>Compartilhe este link com o cliente. Ele lista todos os materiais aguardando aprovação, sem precisar de login.</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input readOnly value={linkModal.url} onFocus={e => e.currentTarget.select()} style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 9, border: '1px solid #e6e6e6', fontSize: 12.5, color: '#333', background: '#fafafa', fontFamily: 'inherit' }} />
              <button onClick={() => { if (navigator.clipboard?.writeText) navigator.clipboard.writeText(linkModal.url).then(() => toast('Link copiado!', 'sucesso')).catch(() => {}) }}
                style={{ padding: '10px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap' }}>Copiar</button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent('Olá! Segue o material para sua aprovação:\n' + linkModal.url)}`, '_blank')}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 0', background: '#25d366', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.2-1.8-.9-2-1s-.5-.2-.7.1-.8 1-1 1.2-.4.2-.7.1a8 8 0 0 1-2.4-1.5 9 9 0 0 1-1.6-2c-.2-.3 0-.5.1-.6l.5-.6.3-.5v-.5l-1-2.3c-.2-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.8.4A3.4 3.4 0 0 0 4.5 9c0 2 1.5 4 1.7 4.2s2.9 4.4 7 6c2.4 1 3.4 1 4.6.9.7 0 1.8-.8 2.1-1.5.3-.8.3-1.4.2-1.5l-.6-.3z" /><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.4A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z" /></svg>
                WhatsApp
              </button>
              <button onClick={() => window.open(linkModal.url, '_blank')} style={{ padding: '11px 18px', background: '#fff', color: '#555', border: '1px solid #e6e6e6', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Abrir</button>
              <button onClick={() => setLinkModal(null)} style={{ padding: '11px 18px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox — prévia de post (como no Planner): imagem ampliada + legenda */}
      {preview && (() => {
        const img = (preview.imagens || []).find(u => /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(u)) || (preview.imagens || [])[0]
        const inicial = (preview.clienteNome || '?').trim().charAt(0).toUpperCase()
        return (
          <div onClick={fecharFora(() => setPreview(null), { perguntar: false })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
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
