'use client'
import { useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { progressoMarco, fimEfetivoDoMarco, statusSugerido, kpiPct, SUBETAPA_STATUS, type SubEtapa } from '@/lib/subetapas'
import EntregasMarco, { Entregas } from './EntregasMarco'
import AvatarCliente from './AvatarCliente'
import { confirmar } from '@/lib/toast'
import { fecharFora } from '@/lib/fecharModal'
import { fraseDaBola, type BolaDaVez } from '@/lib/bolaDaVez'
import AplicarModal, { type Template } from './AplicarModelo'
import { TarefaModal } from './GestaoTarefas'
import { responsavelPorTipo } from '@/lib/responsavelPorTipo'
import type { SquadPapeis } from '@/lib/squadPapeis'
import { toast } from '@/lib/toast'

type Cliente = { id: string; nome: string; logo?: string; corPrimaria?: string }
type Marco = {
  subetapas?: SubEtapa[]
  cor?: string
  id: string; clienteId: string; clienteNome: string; titulo: string; descricao?: string
  categoria: string; status: string; dataInicio: string; dataFim?: string; responsavelNome?: string
}

const PERIODOS = [
  { key: 'semanal', label: 'Semanal', dias: 7 },
  { key: 'mensal', label: 'Mensal', dias: 30 },
  { key: 'trimestral', label: 'Trimestral', dias: 90 },
  { key: 'semestral', label: 'Semestral', dias: 180 },
  { key: 'anual', label: 'Anual', dias: 365 },
]

const CATEGORIAS: { key: string; label: string; cor: string }[] = [
  { key: 'social_media', label: 'Social Media', cor: 'var(--v2-info)' },
  { key: 'trafego', label: 'Trafego pago', cor: '#ea580c' },
  { key: 'branding', label: 'Branding', cor: '#7c3aed' },
  { key: 'landing_page', label: 'Landing Page', cor: '#0891b2' },
  { key: 'estrategia', label: 'Estrategia', cor: 'var(--v2-ok)' },
  { key: 'reuniao', label: 'Reuniao', cor: 'var(--v2-amber)' },
  { key: 'entrega', label: 'Entrega', cor: 'var(--v2-hot)' },
  { key: 'outro', label: 'Outro', cor: 'var(--v2-ink3)' },
]

const STATUS_COR: Record<string, string> = {
  planejado: 'var(--v2-rule)', em_andamento: 'var(--v2-amber-on)', concluido: 'var(--v2-ok)', atrasado: 'var(--v2-hot)', cancelado: 'var(--v2-ink3)',
}
const STATUS_LABEL: Record<string, string> = {
  planejado: 'Planejado', em_andamento: 'Em andamento', concluido: 'Concluido', atrasado: 'Atrasado', cancelado: 'Cancelado',
}

function corCategoria(cat: string) { return CATEGORIAS.find(c => c.key === cat)?.cor || 'var(--v2-ink3)' }
// Cor propria do marco (dono, 07/09: "troca de cor a cada marco ou etapa para ficar muito visual") ou a da categoria.
function corDoMarco(m: { cor?: string; categoria: string }) { return m.cor || corCategoria(m.categoria) }
const PALETA = ['#0f766e', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#dc2626', '#475569']
type TarefaLeve = { id: string; titulo: string; status: string; tipo?: string; prioridade?: string; responsavelNome?: string; responsavelEmail?: string; prazo?: string; marcoId?: string; clienteId?: string; excluidoEm?: string }
const STATUS_TAREFA: Record<string, { label: string; cor: string }> = { a_fazer: { label: 'A fazer', cor: 'var(--v2-ink3)' }, em_andamento: { label: 'Em andamento', cor: 'var(--v2-amber)' }, em_revisao: { label: 'Em revisão', cor: 'var(--v2-info)' }, concluido: { label: 'Concluída', cor: 'var(--v2-ok)' }, descartado: { label: 'Descartada', cor: 'var(--v2-ink3)' } }
function ColorPicker({ valor, onChange, titulo }: { valor?: string; onChange: (cor?: string) => void; titulo?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }} title={titulo}>
      {PALETA.map(c => <button key={c} type="button" onClick={() => onChange(valor === c ? undefined : c)} aria-label={`Cor ${c}`} style={{ width: 22, height: 22, borderRadius: 7, border: valor === c ? '2px solid var(--v2-ink)' : '2px solid transparent', background: c, cursor: 'pointer', padding: 0 }} />)}
      <label title="Qualquer cor" style={{ width: 22, height: 22, borderRadius: 7, border: '1px solid var(--v2-rule)', background: 'conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
        <input type="color" value={valor && /^#[0-9a-f]{6}$/i.test(valor) ? valor : '#888888'} onChange={e => onChange(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} aria-label="Escolher qualquer cor" />
      </label>
      {valor && <button type="button" onClick={() => onChange(undefined)} style={{ background: 'none', border: 0, color: 'var(--v2-ink3)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', padding: '0 4px' }}>cor da categoria</button>}
    </div>
  )
}
function fmtData(iso: string) { return iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '' }

export default function Playbook({ clientes, clienteFixo, podeEditar = true, podeExcluir = true, somenteLeitura = false }: { clientes: Cliente[]; clienteFixo?: string; podeEditar?: boolean; podeExcluir?: boolean; somenteLeitura?: boolean }) {
  const [marcos, setMarcos] = useState<Marco[]>([])
  // Ball-in-court: de quem é a bola AGORA. Derivado no servidor a partir dos
  // posts e tarefas que já existem — nada digitado, nada gravado.
  const [bola, setBola] = useState<BolaDaVez | null>(null)
  const [periodo, setPeriodo] = useState('mensal')
  // Janela CONTÍNUA em dias (zoom livre): os botões de período são atalhos para escalas fixas.
  const [dias, setDias] = useState(30)
  const diasRef = useRef(dias); diasRef.current = dias
  // ZOOM LIVRE PELO SCROLL (dono, 07/09: "zoom in e zoom out livre com scroll do mouse"):
  // cada notch multiplica a janela por um fator suave (para cima aproxima, para baixo
  // afasta), entre 3 dias e 2 anos, e a DATA SOB O CURSOR fica parada — como num mapa.
  // Pinça no trackpad chega como wheel com ctrlKey e cai no mesmo caminho. Listener
  // nativo com passive:false — o onWheel do React é passivo e não seguraria a página.
  const ganttRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ganttRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 1) return
      e.preventDefault()
      const atual = diasRef.current
      // deltaMode 1 = linhas (Firefox); normaliza para pixels.
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      const fator = Math.exp(Math.max(-300, Math.min(300, delta)) * 0.0022)
      const novo = Math.max(3, Math.min(730, atual * fator))
      if (Math.abs(novo - atual) < 0.01) return
      // Âncora: a data sob o ponteiro não se move.
      const r = el.getBoundingClientRect()
      const frac = r.width > 0 ? Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) : 0
      const ms = 24 * 60 * 60 * 1000
      setDias(novo)
      setRefDate(d => {
        const ini = new Date(d); ini.setHours(0, 0, 0, 0)
        const dataSobCursor = ini.getTime() + frac * atual * ms
        return new Date(dataSobCursor - frac * novo * ms)
      })
      // Destaque do botão acompanha a escala mais próxima.
      const perto = PERIODOS.reduce((a, b) => Math.abs(Math.log(b.dias / novo)) < Math.abs(Math.log(a.dias / novo)) ? b : a)
      setPeriodo(perto.key)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])
  const [filtroCliente, setFiltroCliente] = useState('')
  const [editModal, setEditModal] = useState<Marco | null>(null)
  const [detalheModal, setDetalheModal] = useState<Marco | null>(null)
  const [novoModal, setNovoModal] = useState(false)
  // Gantt: as sub-etapas aparecem como linhas ABAIXO do marco, cada uma no seu período
  // (dono, 07/09: "tudo acontece simultaneamente"). Abertas por padrão; o chevron recolhe.
  // NIVEL de cada marco no Gantt (dono, 07/09: "expandir/arrastar canto para baixo para
  // expandir ou resumir"): 0 = so a barra, 1 = + etapas (padrao), 2 = + tarefas do marco.
  // Chevron alterna 0/1; a alca no rodape do marco arrasta para baixo (expande) ou para cima (resume).
  const [nivelGantt, setNivelGantt] = useState<Map<string, number>>(new Map())
  const nivelDe = (id: string) => nivelGantt.has(id) ? nivelGantt.get(id)! : 1
  const setNivel = (id: string, n: number) => setNivelGantt(prev => { const m = new Map(prev); m.set(id, Math.max(0, Math.min(2, n))); return m })
  const alternarGantt = (id: string) => setNivel(id, nivelDe(id) > 0 ? 0 : 1)
  function iniciarArraste(e: React.PointerEvent, id: string) {
    e.preventDefault(); e.stopPropagation()
    const y0 = e.clientY, n0 = nivelDe(id)
    const mover = (ev: PointerEvent) => setNivel(id, n0 + Math.round((ev.clientY - y0) / 28))
    const soltar = () => { window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar) }
    window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar)
  }
  // TAREFAS do cliente (equipe): listadas por marco no Gantt e no formulario; criadas daqui
  // ja com cliente + marco + responsavel do squad por tipo (lib/responsavelPorTipo).
  const [tarefas, setTarefas] = useState<TarefaLeve[]>([])
  const [usuarios, setUsuarios] = useState<{ email: string; nome?: string }[]>([])
  const [squadPapeis, setSquadPapeis] = useState<SquadPapeis | undefined>(undefined)
  const [tarefaAberta, setTarefaAberta] = useState<TarefaLeve | null>(null)
  const [novaTarefaPara, setNovaTarefaPara] = useState<Marco | null>(null)
  const tarefasDoMarco = (id: string) => tarefas.filter(t => t.marcoId === id && !t.excluidoEm)
  function carregarTarefas() {
    if (somenteLeitura) return
    fetch('/api/tarefas').then(r => r.ok ? r.json() : []).then(d => setTarefas(Array.isArray(d) ? d : [])).catch(() => {})
  }
  const alturaTarefas = (n: number) => 30 + 26 * Math.max(1, n)
  const alturaMarco = (m: Marco) => { const nv = nivelDe(m.id); return 34 + (nv >= 1 ? 24 * (m.subetapas?.length || 0) : 0) + (nv >= 2 ? alturaTarefas(tarefasDoMarco(m.id).length) : 0) }
  // Aplicar modelo direto daqui (pedido do dono, 07/09: "sem clareza de como
  // lançar etapas") — lista os modelos e reaproveita o modal com prévia.
  const [escolhendoModelo, setEscolhendoModelo] = useState(false)
  const [templates, setTemplates] = useState<Template[] | null>(null)
  const [templateSel, setTemplateSel] = useState<Template | null>(null)
  const [equipe, setEquipe] = useState<{ email: string; nome?: string }[]>([])
  function abrirModelos() {
    setEscolhendoModelo(true)
    if (templates === null) fetch('/api/templates').then(r => r.json()).then(d => setTemplates(Array.isArray(d) ? d : [])).catch(() => setTemplates([]))
    if (!equipe.length) fetch('/api/usuarios').then(r => r.json()).then(d => setEquipe(Array.isArray(d) ? d : [])).catch(() => {})
  }
  const [refDate, setRefDate] = useState(new Date())

  // Modo cliente (portal): read-only — sem criar/editar/excluir; o clique no
  // marco abre um DETALHE, nunca o formulario de edicao da equipe.
  const editavel = podeEditar && !somenteLeitura
  const excluivel = podeExcluir && !somenteLeitura

  // Playbook e sempre escopado a UM cliente. No portal vem fixo; na agencia, escolhido.
  const clienteAtivo = clienteFixo || filtroCliente

  // Cor dos botoes primarios: cor do cliente no portal (clienteFixo), amarelo na agencia.
  const corMarca = clienteFixo ? (clientes.find(c => c.id === clienteFixo)?.corPrimaria || '#ffc00f') : '#ffc00f'
  const corMarcaTexto = (() => {
    const h = corMarca.replace('#', '')
    if (h.length < 6) return 'var(--v2-ink)'
    const r = parseInt(h.substring(0, 2), 16) || 0
    const g = parseInt(h.substring(2, 4), 16) || 0
    const b = parseInt(h.substring(4, 6), 16) || 0
    return (r * 299 + g * 587 + b * 114) / 1000 < 140 ? 'var(--v2-surface)' : 'var(--v2-ink)'
  })()

  function carregar() {
    if (!clienteAtivo) { setMarcos([]); setBola(null); return }
    fetch(`/api/playbook?clienteId=${clienteAtivo}`).then(r => r.json()).then(d => setMarcos(Array.isArray(d) ? d : [])).catch(() => {})
    // Falha aqui não pode derrubar o Playbook: sem a bola, a tela segue como era.
    fetch(`/api/playbook/bola?clienteId=${clienteAtivo}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setBola(d && d.lado ? d : null))
      .catch(() => setBola(null))
  }
  useEffect(() => { carregar() }, [clienteAtivo])
  useEffect(() => {
    if (somenteLeitura) return
    carregarTarefas()
    if (!usuarios.length) fetch('/api/usuarios').then(r => r.ok ? r.json() : []).then(d => setUsuarios(Array.isArray(d) ? d : [])).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteAtivo, somenteLeitura])
  useEffect(() => {
    if (!clienteAtivo || somenteLeitura) { setSquadPapeis(undefined); return }
    fetch(`/api/clientes?id=${clienteAtivo}`).then(r => r.ok ? r.json() : null).then(c => { const cli = Array.isArray(c) ? c.find((x: any) => x.id === clienteAtivo) : c; setSquadPapeis(cli?.squadPapeis) }).catch(() => {})
  }, [clienteAtivo, somenteLeitura])

  const inicio = new Date(refDate)
  inicio.setHours(0, 0, 0, 0)
  const fim = new Date(inicio.getTime() + dias * 24 * 60 * 60 * 1000)

  // Agrupa marcos do cliente ativo (nunca generico)
  const clientesComMarcos = clienteAtivo ? clientes.filter(c => c.id === clienteAtivo).filter(c => marcos.some(m => m.clienteId === c.id)) : []
  const clientesSemMarcos = clienteAtivo ? clientes.filter(c => c.id === clienteAtivo).filter(c => !marcos.some(m => m.clienteId === c.id)) : []

  const totalDias = dias
  function posicaoPct(data: string): number {
    const d = new Date(data).getTime()
    const i = inicio.getTime()
    return Math.max(0, Math.min(100, ((d - i) / (fim.getTime() - i)) * 100))
  }
  function larguraPct(di: string, df?: string): number {
    const a = posicaoPct(di)
    const b = df ? posicaoPct(df) : Math.min(a + 3, 100)
    return Math.max(2, b - a)
  }

  // Gera labels de datas no eixo
  const labels: { pct: number; txt: string }[] = []
  const step = dias <= 12 ? 1 : dias <= 45 ? 7 : dias <= 120 ? 15 : dias <= 240 ? 30 : 60
  for (let d = 0; d <= totalDias; d += step) {
    const dt = new Date(inicio.getTime() + d * 24 * 60 * 60 * 1000)
    labels.push({ pct: (d / totalDias) * 100, txt: dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: 'var(--v2-ink)' }}>Playbook</h2>
        <div style={{ display: 'flex', background: 'var(--v2-surface2)', borderRadius: 10, padding: 3 }}>
          {PERIODOS.map(p => (
            <button key={p.key} onClick={() => { setPeriodo(p.key); setDias(p.dias) }} style={{
              padding: '6px 12px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
              background: periodo === p.key ? 'var(--v2-surface)' : 'transparent', color: periodo === p.key ? 'var(--v2-ink)' : 'var(--v2-ink3)',
              boxShadow: periodo === p.key ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            }}>{p.label}</button>
          ))}
        </div>
        {!clienteFixo && (
          <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--v2-rule)', fontSize: 12, fontFamily: 'inherit', background: 'var(--v2-surface)' }}>
            <option value="">Selecione um cliente...</option>
            {[...clientes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt')).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        )}
        {clienteAtivo && <>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setRefDate(d => new Date(d.getTime() - dias * 24 * 60 * 60 * 1000))} style={{ width: 30, height: 30, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', borderRadius: 8, cursor: 'pointer', color: 'var(--v2-ink2)', fontSize: 14 }}>&#8249;</button>
            <button onClick={() => setRefDate(new Date())} style={{ padding: '0 12px', height: 30, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', borderRadius: 8, cursor: 'pointer', color: 'var(--v2-ink2)', fontSize: 11, fontWeight: 600 }}>Hoje</button>
            <button onClick={() => setRefDate(d => new Date(d.getTime() + dias * 24 * 60 * 60 * 1000))} style={{ width: 30, height: 30, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', borderRadius: 8, cursor: 'pointer', color: 'var(--v2-ink2)', fontSize: 14 }}>&#8250;</button>
          </div>
          {editavel && <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={abrirModelos} style={{ padding: '9px 16px', background: 'var(--v2-surface)', color: 'var(--v2-ink)', border: '1px solid var(--v2-rule)', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Aplicar modelo</button>
            <button onClick={() => setNovoModal(true)} style={{ padding: '9px 16px', background: corMarca, color: corMarcaTexto, border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Novo marco</button>
          </div>}
        </>}
      </div>

      {/* Sem cliente selecionado (agencia): exige escolher um cliente */}
      {!clienteAtivo && (
        <div style={{ background: 'var(--v2-surface)', borderRadius: 14, padding: '50px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--v2-ink3)' }}>Selecione um cliente para ver o Playbook.</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--v2-ink3)' }}>Cada cliente tem seu próprio Playbook — escolha um acima para ver, criar ou editar as etapas.</p>
        </div>
      )}

      {clienteAtivo && <>
      {/* DE QUEM É A BOLA (Ball-in-court) — a resposta vem antes do instrumento.
          O Gantt diz QUANDO; isto diz o que falta agora e com quem está. Tudo
          derivado: nenhum status digitado, nenhuma escrita. */}
      {bola && bola.lado !== 'ninguem' && (() => {
        const doCliente = bola.lado === 'cliente'
        // No portal (somenteLeitura) quem lê é o cliente: "sua vez".
        const cor = doCliente ? '#0e7566' : '#3f4c9b'
        const fundo = doCliente ? '#dff0ec' : '#e6e8f5'
        const atrasado = doCliente && (bola.diasParado || 0) >= 3
        return (
          <div style={{ background: 'var(--v2-surface)', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '16px 18px', marginBottom: 14, borderLeft: `4px solid ${atrasado ? 'var(--v2-hot)' : cor}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: cor, background: fundo, padding: '4px 11px', borderRadius: 999 }}>
                {doCliente ? (somenteLeitura ? 'Sua vez' : 'Com o cliente') : (somenteLeitura ? 'Com a agência' : 'Com a equipe')}
              </span>
              <span style={{ fontSize: 14.5, color: 'var(--v2-ink)', fontWeight: 600 }}>{fraseDaBola(bola, somenteLeitura)}</span>
              {atrasado && <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--v2-hot)', background: 'var(--v2-hot-bg)', padding: '3px 9px', borderRadius: 999 }}>parado</span>}
            </div>
            {bola.itens.length > 0 && (
              <ul style={{ margin: '10px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {bola.itens.map((i, n) => (
                  <li key={n} style={{ fontSize: 13, color: 'var(--v2-ink2)' }}>
                    {i.titulo}
                    {typeof i.desde === 'string' && <span style={{ color: 'var(--v2-ink3)' }}> · desde {fmtData(i.desde)}</span>}
                  </li>
                ))}
              </ul>
            )}
            {!doCliente && !somenteLeitura && bola.totalCliente > 0 && (
              <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--v2-ink3)' }}>
                E há {bola.totalCliente} {bola.totalCliente > 1 ? 'materiais' : 'material'} esperando o cliente.
              </p>
            )}
          </div>
        )
      })()}

      {/* Legenda de categorias */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        {CATEGORIAS.map(c => (
          <span key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--v2-ink3)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: c.cor }} />{c.label}
          </span>
        ))}
      </div>

      {/* Timeline — scroll do mouse aqui = zoom (semanal … anual) */}
      <div ref={ganttRef} title="Scroll do mouse (ou pinça no trackpad) aproxima e afasta a linha do tempo; a data sob o cursor fica parada" style={{ background: 'var(--v2-surface)', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        {/* Eixo de datas */}
        <div style={{ position: 'relative', height: 28, borderBottom: '1px solid var(--v2-rule)', background: 'var(--v2-surface1)' }}>
          {labels.map((l, i) => (
            <span key={i} style={{ position: 'absolute', left: `${l.pct}%`, top: 6, fontSize: 9, color: 'var(--v2-ink3)', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>{l.txt}</span>
          ))}
          {/* Linha de hoje */}
          {(() => {
            const hojePct = posicaoPct(new Date().toISOString())
            return hojePct > 0 && hojePct < 100 ? <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${hojePct}%`, width: 2, background: 'var(--v2-amber-on)', zIndex: 2 }} /> : null
          })()}
        </div>

        {clientesComMarcos.length === 0 && clientesSemMarcos.length > 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--v2-ink3)', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <p style={{ margin: 0 }}>{somenteLeitura ? 'Nenhum marco cadastrado ainda. Assim que a estratégia for montada, ela aparece aqui.' : 'Nenhum marco ainda. Comece de um modelo pronto (onboarding, ciclo mensal…) ou crie os marcos um a um. Cada marco pode ter etapas dentro dele.'}</p>
            {editavel && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button onClick={abrirModelos} style={{ padding: '10px 18px', background: corMarca, color: corMarcaTexto, border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>Aplicar modelo</button>
                <button onClick={() => setNovoModal(true)} style={{ padding: '10px 18px', background: 'var(--v2-surface)', color: 'var(--v2-ink)', border: '1px solid var(--v2-rule)', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>+ Novo marco</button>
              </div>
            )}
          </div>
        )}

        {clientesComMarcos.map(c => {
          const marcosCliente = marcos.filter(m => m.clienteId === c.id)
          return (
            <div key={c.id} style={{ borderBottom: '1px solid var(--v2-surface1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--v2-surface1)' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', background: c.corPrimaria || '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10, flexShrink: 0 }}>
                  <AvatarCliente logo={c.logo} nome={c.nome} clienteId={c.id} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--v2-ink)' }}>{c.nome}</span>
                <span style={{ fontSize: 10, color: 'var(--v2-ink3)' }}>{marcosCliente.length} marco(s)</span>
              </div>
              <div style={{ position: 'relative', minHeight: (marcosCliente.reduce((h, m) => h + alturaMarco(m), 0) + 4) || 36, padding: '4px 0' }}>
                {/* Linha de hoje */}
                {(() => {
                  const hojePct = posicaoPct(new Date().toISOString())
                  return hojePct > 0 && hojePct < 100 ? <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${hojePct}%`, width: 1, background: '#ffc00f33' }} /> : null
                })()}
                {(() => {
                  // Posição vertical acumulada: cada marco ocupa 34px + 24px por sub-etapa aberta.
                  let topo = 4
                  return marcosCliente.map(m => {
                    const left = posicaoPct(m.dataInicio)
                    const pg = progressoMarco(m.subetapas)
                    const fimEf = fimEfetivoDoMarco(m, m.subetapas)
                    const width = larguraPct(m.dataInicio, fimEf || m.dataFim)
                    const subs = m.subetapas || []
                    const nivel = nivelDe(m.id)
                    const aberto = subs.length > 0 && nivel >= 1
                    const tarefasM = tarefasDoMarco(m.id)
                    const mostraTarefas = nivel >= 2 && !somenteLeitura
                    const altura = alturaMarco(m)
                    const topMarco = topo
                    topo += altura
                    return (
                      <div key={m.id}>
                        <div onClick={() => somenteLeitura ? setDetalheModal(m) : setEditModal(m)} title={`${m.titulo} (${fmtData(m.dataInicio)}${fimEf ? ' - ' + fmtData(fimEf) : ''})${pg.total ? ` · ${pg.concluidas}/${pg.total} etapas` : ''}${pg.atrasadas.length ? ` · ${pg.atrasadas.length} atrasada(s)` : ''}`}
                          style={{
                            position: 'absolute', top: topMarco, left: `${left}%`, width: `${width}%`, height: 28,
                            background: corDoMarco(m), borderRadius: 6, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', padding: '0 8px', minWidth: 30, opacity: m.status === 'cancelado' ? 0.4 : m.status === 'concluido' ? 0.7 : 1,
                            border: m.status === 'atrasado' ? '2px solid var(--v2-hot)' : 'none',
                          }}>
                          {pg.total > 0 && <div aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pg.pct}%`, background: 'rgba(255,255,255,0.28)', borderRadius: 6, pointerEvents: 'none' }} />}
                          {subs.length > 0 && (
                            <button type="button" onClick={e => { e.stopPropagation(); alternarGantt(m.id) }} title={aberto ? 'Recolher as etapas' : 'Mostrar as etapas'} aria-label={aberto ? 'Recolher as etapas' : 'Mostrar as etapas'}
                              style={{ position: 'relative', width: 18, height: 18, marginRight: 6, marginLeft: -4, borderRadius: 5, border: 0, background: 'rgba(0,0,0,0.22)', color: 'var(--v2-surface)', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0, padding: 0 }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: aberto ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }}><path d="M9 18l6-6-6-6" /></svg>
                            </button>
                          )}
                          <span style={{ position: 'relative', fontSize: 10, fontWeight: 700, color: 'var(--v2-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.titulo}</span>
                          {pg.total > 0 && <span style={{ position: 'relative', marginLeft: 'auto', fontSize: 10, fontWeight: 800, color: 'var(--v2-surface)', background: pg.atrasadas.length ? 'var(--v2-hot)' : 'rgba(0,0,0,0.28)', borderRadius: 999, padding: '1px 7px', flexShrink: 0 }}>{pg.concluidas}/{pg.total}</span>}
                        </div>
                        {/* SUB-ETAPAS como linhas próprias, cada uma no seu período (simultâneas ao marco) */}
                        {aberto && subs.map((se, j) => {
                          const ini = se.dataInicio || m.dataInicio
                          const fim = se.dataFim || se.dataInicio || m.dataFim || m.dataInicio
                          const l = posicaoPct(ini)
                          const w = Math.max(larguraPct(ini, fim), 1.2)
                          const atrasada = pg.atrasadas.some(a => a.id === se.id)
                          const corStatus = se.status === 'concluido' ? 'var(--v2-ok)' : atrasada ? 'var(--v2-hot)' : se.status === 'em_andamento' ? 'var(--v2-amber-on)' : 'var(--v2-rule2)'
                          const k = kpiPct(se)
                          return (
                            <div key={se.id} onClick={() => somenteLeitura ? setDetalheModal(m) : setEditModal(m)}
                              title={`${m.titulo} › ${se.titulo}${se.dataInicio || se.dataFim ? ` (${fmtData(ini)}${se.dataFim ? ' - ' + fmtData(se.dataFim) : ''})` : ''}${se.kpi ? ` · ${se.kpi}: ${se.kpiAtual ?? 0}${se.kpiMeta ? '/' + se.kpiMeta : ''}` : ''}${atrasada ? ' · atrasada' : ''}`}
                              style={{
                                position: 'absolute', top: topMarco + 34 + j * 24, left: `${l}%`, width: `${w}%`, height: 18, minWidth: 22,
                                background: se.cor || corDoMarco(m), opacity: se.status === 'concluido' ? 0.45 : 0.7, borderRadius: 5, cursor: 'pointer',
                                borderLeft: `4px solid ${corStatus}`, display: 'flex', alignItems: 'center', gap: 6, padding: '0 7px', boxSizing: 'border-box',
                              }}>
                              {k !== null && <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${k}%`, background: 'rgba(255,255,255,0.22)', pointerEvents: 'none' }} />}
                              <span style={{ position: 'relative', fontSize: 9.5, fontWeight: 600, color: 'var(--v2-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: se.status === 'concluido' ? 'line-through' : 'none' }}>{se.titulo}</span>
                              {se.kpi && se.kpiMeta ? <span style={{ position: 'relative', marginLeft: 'auto', fontSize: 9, fontWeight: 700, color: 'var(--v2-surface)', whiteSpace: 'nowrap', flexShrink: 0 }}>{se.kpiAtual ?? 0}/{se.kpiMeta}</span> : null}
                            </div>
                          )
                        })}
                        {/* TAREFAS DO MARCO (nivel 2): abrir qualquer uma, ou criar ja com cliente + marco + responsavel do squad */}
                        {mostraTarefas && (
                          <div style={{ position: 'absolute', top: topMarco + 34 + (aberto ? 24 * subs.length : 0), left: 0, right: 0, height: alturaTarefas(tarefasM.length), background: 'var(--v2-surface1)', borderTop: `2px solid ${corDoMarco(m)}`, boxSizing: 'border-box', padding: '4px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 22 }}>
                              <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>Tarefas · {tarefasM.length}</span>
                              {editavel && <button type="button" onClick={e => { e.stopPropagation(); setNovaTarefaPara(m) }} title={squadPapeis && Object.keys(squadPapeis).length ? 'Nova tarefa neste marco — já no cliente, com o responsável do squad pelo tipo' : 'Nova tarefa neste marco — já no cliente (defina o squad do cliente para atribuir sozinho)'} style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 999, border: '1px dashed var(--v2-rule2)', background: 'var(--v2-surface)', color: 'var(--v2-ink)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Tarefa</button>}
                            </div>
                            {tarefasM.length === 0 && <p style={{ margin: 0, fontSize: 11.5, color: 'var(--v2-ink3)', lineHeight: '26px' }}>Nenhuma tarefa neste marco.</p>}
                            {tarefasM.map(t => { const st = STATUS_TAREFA[t.status] || STATUS_TAREFA.a_fazer; return (
                              <button key={t.id} type="button" onClick={e => { e.stopPropagation(); setTarefaAberta(t) }} title="Abrir a tarefa" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: 26, background: 'none', border: 0, borderBottom: '1px solid var(--v2-rule)', padding: 0, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--v2-ink)', textAlign: 'left' }}>
                                <span style={{ width: 7, height: 7, borderRadius: 999, background: st.cor, flexShrink: 0 }} />
                                <span style={{ flex: 1, minWidth: 0, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: t.status === 'concluido' ? 'line-through' : 'none', opacity: t.status === 'concluido' ? 0.6 : 1 }}>{t.titulo}</span>
                                <span style={{ fontSize: 10.5, color: st.cor, whiteSpace: 'nowrap' }}>{st.label}</span>
                                {t.responsavelNome && <span style={{ fontSize: 10.5, color: 'var(--v2-ink3)', whiteSpace: 'nowrap' }}>{t.responsavelNome.split(' ')[0]}</span>}
                                {t.prazo && <span style={{ fontSize: 10.5, color: 'var(--v2-ink3)', whiteSpace: 'nowrap' }}>{fmtData(t.prazo)}</span>}
                              </button>
                            ) })}
                          </div>
                        )}
                        {/* ALCA: arrastar para baixo expande (etapas -> tarefas), para cima resume */}
                        {!somenteLeitura && (
                          <div onPointerDown={e => iniciarArraste(e, m.id)} onClick={e => e.stopPropagation()} title="Arraste para baixo para expandir (etapas, tarefas) ou para cima para resumir" aria-label="Expandir ou resumir o marco"
                            style={{ position: 'absolute', top: topMarco + altura - 6, left: 0, right: 0, height: 10, cursor: 'ns-resize', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3 }}>
                            <span style={{ width: 34, height: 4, borderRadius: 999, background: 'var(--v2-rule2)', opacity: 0.8 }} />
                          </div>
                        )}
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          )
        })}
      </div>
      </>}

      {/* Modal novo/editar marco (equipe) */}
      {(novoModal || editModal) && (
        <MarcoModal marco={editModal} clientes={clientes} clientePadrao={clienteAtivo} corMarca={corMarca} corMarcaTexto={corMarcaTexto}
          tarefasDoMarcoModal={editModal && !somenteLeitura ? tarefasDoMarco(editModal.id) : undefined} onAbrirTarefa={t => setTarefaAberta(t)} onNovaTarefa={editModal ? () => setNovaTarefaPara(editModal) : undefined}
          onClose={() => { setNovoModal(false); setEditModal(null) }}
          onSalvo={() => { setNovoModal(false); setEditModal(null); carregar() }}
          onExcluir={editModal && excluivel ? async () => { await fetch(`/api/playbook?id=${editModal.id}`, { method: 'DELETE' }); setEditModal(null); carregar() } : undefined}
        />
      )}

      {/* Modal DETALHE (cliente, read-only) */}
      {detalheModal && <MarcoDetalhe marco={detalheModal} onClose={() => setDetalheModal(null)} />}

      {/* TAREFA aberta/criada a partir do Playbook: mesmo modal da Gestao de tarefas. Nova tarefa nasce
          com o cliente e o marco preenchidos e o responsavel do squad pelo tipo (lib/responsavelPorTipo). */}
      {(tarefaAberta || novaTarefaPara) && (
        <TarefaModal
          key={tarefaAberta?.id || `nova-${novaTarefaPara?.id}`}
          tarefa={(tarefaAberta || { clienteId: novaTarefaPara!.clienteId, clienteNome: novaTarefaPara!.clienteNome, marcoId: novaTarefaPara!.id, tipo: 'tarefa', status: 'a_fazer', prioridade: 'media' }) as any}
          clientes={clientes as any}
          usuarios={usuarios as any}
          responsavelPorTipo={tipo => responsavelPorTipo(squadPapeis, tipo)}
          onClose={() => { setTarefaAberta(null); setNovaTarefaPara(null) }}
          onSalvo={() => { setTarefaAberta(null); setNovaTarefaPara(null); carregarTarefas() }}
          onRecarregar={(t: any) => { setTarefaAberta(t); carregarTarefas() }}
        />
      )}
      {/* Escolher o modelo (lista vem de /api/templates; o de onboarding é semeado pelo servidor) */}
      {escolhendoModelo && !templateSel && (
        <div onClick={fecharFora(() => setEscolhendoModelo(false), { perguntar: false })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v2-surface)', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: 22, boxSizing: 'border-box' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, color: 'var(--v2-ink)' }}>Aplicar modelo</h3>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--v2-ink3)' }}>Um modelo cria todos os marcos (e as tarefas) de uma vez, encadeados a partir da data de início. Você confere a prévia antes de gravar.</p>
            {templates === null && <p style={{ margin: 0, fontSize: 13, color: 'var(--v2-ink3)' }}>Carregando modelos…</p>}
            {templates && templates.length === 0 && <p style={{ margin: 0, fontSize: 13, color: 'var(--v2-ink3)' }}>Nenhum modelo cadastrado. Crie um em Estratégia → Modelos.</p>}
            {templates && templates.map(t => (
              <button key={t.id} onClick={() => setTemplateSel(t)} style={{ width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 3, padding: '12px 14px', marginBottom: 8, background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--v2-ink)' }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{t.nome}</span>
                {t.descricao && <span style={{ fontSize: 12.5, color: 'var(--v2-ink3)' }}>{t.descricao}</span>}
                <span style={{ fontSize: 12, color: 'var(--v2-ink3)' }}>{(t.marcos || []).length} marco(s) · {(t.tarefas || []).length} tarefa(s)</span>
              </button>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => setEscolhendoModelo(false)} style={{ padding: '10px 18px', background: 'var(--v2-surface1)', color: 'var(--v2-ink2)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
      {templateSel && (
        <AplicarModal template={templateSel} clientes={clientes as any} equipe={equipe} preSelecionados={clienteAtivo ? [clienteAtivo] : []}
          onClose={() => { setTemplateSel(null); setEscolhendoModelo(false) }}
          onOk={(r) => { setTemplateSel(null); setEscolhendoModelo(false); carregar(); toast(`Modelo "${templateSel.nome}" aplicado: ${r.marcos} marco(s) e ${r.tarefas} tarefa(s) criadas.`, 'sucesso') }} />
      )}
    </div>
  )
}

// Detalhe de um marco em modo somente-leitura (portal do cliente): sem edicao,
// so a informacao da etapa (titulo, categoria, status, periodo, responsavel, descricao).
function MarcoDetalhe({ marco, onClose }: { marco: Marco; onClose: () => void }) {
  // Entregas (posts/campanhas) vinculadas a esta etapa. O endpoint força o
  // cliente a ver só o próprio; tarefas internas ficam ocultas (ocultarTarefas).
  const [entregas, setEntregas] = useState<Entregas>({ tarefas: [], posts: [], briefings: [] })
  useEffect(() => {
    if (!marco.clienteId) return
    fetch(`/api/playbook/entregas?clienteId=${marco.clienteId}`).then(r => r.json()).then(d => { if (d && !d.error) setEntregas(d) }).catch(() => {})
  }, [marco.clienteId])
  const cat = CATEGORIAS.find(c => c.key === marco.categoria)
  const statusCor = STATUS_COR[marco.status] === 'var(--v2-rule)' ? 'var(--v2-ink3)' : (STATUS_COR[marco.status] || 'var(--v2-ink3)')
  const lbl: React.CSSProperties = { margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: 'var(--v2-ink3)', textTransform: 'uppercase', letterSpacing: '0.04em' }
  const val: React.CSSProperties = { margin: 0, fontSize: 14, color: 'var(--v2-ink)' }
  return (
    <div onClick={fecharFora(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v2-surface)', borderRadius: 16, maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: cat?.cor || 'var(--v2-ink3)' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--v2-ink3)' }}>{cat?.label || 'Outro'}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: 'var(--v2-surface)', background: statusCor, padding: '3px 10px', borderRadius: 999 }}>{STATUS_LABEL[marco.status] || marco.status}</span>
        </div>
        <h3 style={{ margin: '0 0 16px', fontSize: 17, color: 'var(--v2-ink)' }}>{marco.titulo}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <p style={lbl}>Período</p>
              <p style={val}>{fmtData(marco.dataInicio)}{marco.dataFim ? ' — ' + fmtData(marco.dataFim) : ''}</p>
            </div>
            {marco.responsavelNome && (
              <div>
                <p style={lbl}>Responsável</p>
                <p style={val}>{marco.responsavelNome}</p>
              </div>
            )}
          </div>
          {marco.descricao && (
            <div>
              <p style={lbl}>Descrição</p>
              <p style={{ ...val, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{marco.descricao}</p>
            </div>
          )}
          <div>
            {(marco.subetapas?.length || 0) > 0 && (() => { const pg = progressoMarco(marco.subetapas); return (
              <div style={{ marginBottom: 14 }}>
                <p style={lbl}>Etapas deste marco · {pg.concluidas} de {pg.total}</p>
                <div style={{ height: 6, background: 'var(--v2-surface2)', borderRadius: 999, overflow: 'hidden', margin: '6px 0 10px' }}><div style={{ width: `${pg.pct}%`, height: '100%', background: 'var(--v2-ok)' }} /></div>
                {marco.subetapas!.map(se => { const k = kpiPct(se); const atrasada = pg.atrasadas.some(a => a.id === se.id); return (
                  <div key={se.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--v2-surface1)', fontSize: 13 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 999, flexShrink: 0, background: se.status === 'concluido' ? 'var(--v2-ok)' : atrasada ? 'var(--v2-hot)' : se.status === 'em_andamento' ? 'var(--v2-amber)' : 'var(--v2-rule2)' }} />
                    <span style={{ flex: 1, minWidth: 0, color: se.status === 'concluido' ? 'var(--v2-ink3)' : 'var(--v2-ink)', textDecoration: se.status === 'concluido' ? 'line-through' : 'none' }}>{se.titulo}</span>
                    {se.kpi && <span style={{ fontSize: 12, color: 'var(--v2-ink2)', whiteSpace: 'nowrap' }}>{se.kpi}: {se.kpiAtual ?? 0}{se.kpiMeta ? ` / ${se.kpiMeta}` : ''}{k !== null ? ` (${k}%)` : ''}</span>}
                    {se.dataFim && <span style={{ fontSize: 12, color: atrasada ? 'var(--v2-hot)' : 'var(--v2-ink3)', whiteSpace: 'nowrap' }}>{fmtData(se.dataFim)}</span>}
                  </div>
                ) })}
              </div>
            ) })()}
            <p style={lbl}>Entregas deste marco</p>
            <EntregasMarco marcoId={marco.id} entregas={entregas} ocultarTarefas cor="var(--v2-ok)" />
          </div>
        </div>
        <button onClick={onClose} style={{ marginTop: 22, width: '100%', padding: '11px 0', background: 'var(--v2-surface2)', color: 'var(--v2-ink2)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Fechar</button>
      </div>
    </div>
  )
}

function MarcoModal({ marco, clientes, clientePadrao, corMarca = 'var(--v2-amber-on)', corMarcaTexto = 'var(--v2-ink)', onClose, onSalvo, onExcluir, tarefasDoMarcoModal, onAbrirTarefa, onNovaTarefa }: {
  marco: Marco | null; clientes: { id: string; nome: string }[]; clientePadrao?: string
  tarefasDoMarcoModal?: TarefaLeve[]; onAbrirTarefa?: (t: TarefaLeve) => void; onNovaTarefa?: () => void
  corMarca?: string; corMarcaTexto?: string
  onClose: () => void; onSalvo: () => void; onExcluir?: () => void
}) {
  const [form, setForm] = useState({
    titulo: marco?.titulo || '', descricao: marco?.descricao || '',
    categoria: marco?.categoria || 'outro', status: marco?.status || 'planejado',
    clienteId: marco?.clienteId || clientePadrao || '', responsavelNome: marco?.responsavelNome || '',
    dataInicio: marco?.dataInicio ? marco.dataInicio.split('T')[0] : new Date().toISOString().split('T')[0],
    dataFim: marco?.dataFim ? marco.dataFim.split('T')[0] : '',
    cor: marco?.cor as string | undefined,
  })
  const [salvando, setSalvando] = useState(false)
  // Sub-etapas do marco (prazo + KPI próprios). Vão no mesmo PUT/POST do marco.
  const [subs, setSubs] = useState<SubEtapa[]>(marco?.subetapas || [])
  const patchSub = (id: string, patch: Partial<SubEtapa>) => setSubs(a => a.map(x => x.id === id ? { ...x, ...patch } : x))
  const moverSub = (i: number, d: number) => setSubs(a => { const j = i + d; if (j < 0 || j >= a.length) return a; const c = [...a]; const [x] = c.splice(i, 1); c.splice(j, 0, x); return c })
  const pgSubs = progressoMarco(subs)
  const sugerido = statusSugerido(form.status, subs)
  const [entregas, setEntregas] = useState<Entregas>({ tarefas: [], posts: [], briefings: [] })
  useEffect(() => {
    if (!marco?.clienteId) return
    fetch(`/api/playbook/entregas?clienteId=${marco.clienteId}`).then(r => r.json()).then(d => { if (d && !d.error) setEntregas(d) }).catch(() => {})
  }, [marco?.clienteId])

  async function salvar() {
    setSalvando(true)
    const cli = clientes.find(c => c.id === form.clienteId)
    const body = { ...form, cor: form.cor || '', subetapas: subs.filter(x => x.titulo.trim()), clienteNome: cli?.nome || '', dataInicio: form.dataInicio ? new Date(form.dataInicio).toISOString() : '', dataFim: form.dataFim ? new Date(form.dataFim).toISOString() : '' }
    if (marco) {
      await fetch('/api/playbook', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: marco.id, ...body }) })
    } else {
      await fetch('/api/playbook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
    setSalvando(false)
    onSalvo()
  }

  return (
    <div onClick={fecharFora(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v2-surface)', borderRadius: 16, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, color: 'var(--v2-ink)' }}>{marco ? 'Editar marco' : 'Novo marco'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Titulo *</label>
            <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex.: Lancamento campanha de inverno"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Descrição</label>
            <textarea lang="pt-BR" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Detalhes, objetivos, KPIs..."
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, minHeight: 60, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Cliente *</label>
              <select value={form.clienteId} onChange={e => setForm(f => ({ ...f, clienteId: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface)' }}>
                <option value="">Selecione...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Categoria</label>
              <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface)' }}>
                {CATEGORIAS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Data início</label>
              <input type="date" value={form.dataInicio} onChange={e => setForm(f => ({ ...f, dataInicio: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Data fim (opcional)</label>
              <input type="date" value={form.dataFim} onChange={e => setForm(f => ({ ...f, dataFim: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface)' }}>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Responsável</label>
            <input value={form.responsavelNome} onChange={e => setForm(f => ({ ...f, responsavelNome: e.target.value }))} placeholder="Nome do responsável"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Cor do marco <span style={{ fontWeight: 400 }}>— sem escolher, vale a da categoria</span></label>
            <ColorPicker valor={form.cor} onChange={cor => setForm(f => ({ ...f, cor }))} />
          </div>
        </div>

        {/* SUB-ETAPAS: passos dentro do marco, cada um com prazo e KPI próprios (dono, 07/09).
            Contam no progresso (n/m na barra do Gantt), no prazo efetivo e nos KPIs — tudo no mesmo marco. */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--v2-rule)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--v2-ink)' }}>Etapas deste marco</h4>
            {pgSubs.total > 0 && <span style={{ fontSize: 12, color: pgSubs.atrasadas.length ? 'var(--v2-hot)' : 'var(--v2-ink3)' }}>{pgSubs.concluidas} de {pgSubs.total} concluídas{pgSubs.atrasadas.length ? ` · ${pgSubs.atrasadas.length} atrasada(s)` : ''}{pgSubs.kpis.total ? ` · KPIs ${pgSubs.kpis.atingidos}/${pgSubs.kpis.total}` : ''}{pgSubs.fimEfetivo && (!form.dataFim || pgSubs.fimEfetivo > form.dataFim) ? ` · prazo efetivo ${fmtData(pgSubs.fimEfetivo)}` : ''}</span>}
            <button type="button" onClick={() => setSubs(a => [...a, { id: uuid(), titulo: '', status: 'pendente' }])} style={{ marginLeft: 'auto', padding: '7px 12px', background: 'var(--v2-surface)', color: 'var(--v2-ink)', border: '1px dashed var(--v2-rule2)', borderRadius: 9, fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>+ Etapa</button>
          </div>
          {subs.length === 0 && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink3)' }}>Nenhuma etapa dentro deste marco. Use quando o marco tem passos com prazo e KPI próprios (ex.: "Auditoria", "Setup da campanha", "Primeiros 30 dias").</p>}
          {subs.map((se, i) => { const k = kpiPct(se); const atrasada = pgSubs.atrasadas.some(a => a.id === se.id); const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 9, border: '1.5px solid var(--v2-rule)', fontSize: 12.5, fontFamily: 'inherit', boxSizing: 'border-box', background: 'var(--v2-surface)', color: 'var(--v2-ink)', minWidth: 0 }; return (
            <div key={se.id} style={{ border: `1px solid ${atrasada ? 'var(--v2-hot)' : 'var(--v2-rule)'}`, borderRadius: 12, padding: 10, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ width: 20, fontSize: 11, fontWeight: 800, color: 'var(--v2-ink3)', textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                <label title="Cor da etapa (vazio = cor do marco)" style={{ width: 22, height: 22, borderRadius: 7, border: '1px solid var(--v2-rule)', background: se.cor || form.cor || 'var(--v2-surface2)', cursor: 'pointer', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                  <input type="color" value={se.cor || form.cor || '#888888'} onChange={e => patchSub(se.id, { cor: e.target.value })} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} aria-label="Cor da etapa" />
                </label>
                <input value={se.titulo} onChange={e => patchSub(se.id, { titulo: e.target.value })} placeholder="Etapa (ex.: Auditoria dos perfis)" style={{ ...inp, flex: 1 }} aria-label="Título da etapa" />
                <select value={se.status} onChange={e => patchSub(se.id, { status: e.target.value as SubEtapa['status'] })} style={{ ...inp, width: 140, flexShrink: 0 }} aria-label="Status da etapa">
                  {SUBETAPA_STATUS.map(st => <option key={st.key} value={st.key}>{st.label}</option>)}
                </select>
                <button type="button" title="Subir" onClick={() => moverSub(i, -1)} disabled={i === 0} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-ink2)', cursor: 'pointer', opacity: i === 0 ? 0.35 : 1, flexShrink: 0 }}>↑</button>
                <button type="button" title="Descer" onClick={() => moverSub(i, 1)} disabled={i === subs.length - 1} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-ink2)', cursor: 'pointer', opacity: i === subs.length - 1 ? 0.35 : 1, flexShrink: 0 }}>↓</button>
                <button type="button" title="Remover etapa" onClick={() => setSubs(a => a.filter(x => x.id !== se.id))} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-hot)', cursor: 'pointer', flexShrink: 0 }}>×</button>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--v2-ink3)' }}>Início<input type="date" value={se.dataInicio || ''} onChange={e => patchSub(se.id, { dataInicio: e.target.value || undefined })} style={{ ...inp, width: 140 }} /></label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: atrasada ? 'var(--v2-hot)' : 'var(--v2-ink3)' }}>Prazo<input type="date" value={se.dataFim || ''} onChange={e => patchSub(se.id, { dataFim: e.target.value || undefined })} style={{ ...inp, width: 140, borderColor: atrasada ? 'var(--v2-hot)' : undefined }} /></label>
                <input value={se.kpi || ''} onChange={e => patchSub(se.id, { kpi: e.target.value })} placeholder="KPI (ex.: Leads)" style={{ ...inp, width: 150 }} aria-label="Nome do KPI" />
                <input type="number" value={se.kpiMeta ?? ''} onChange={e => patchSub(se.id, { kpiMeta: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="Meta" style={{ ...inp, width: 90 }} aria-label="Meta do KPI" />
                <input type="number" value={se.kpiAtual ?? ''} onChange={e => patchSub(se.id, { kpiAtual: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="Atual" style={{ ...inp, width: 90 }} aria-label="Valor atual do KPI" />
                {k !== null && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: k >= 100 ? 'var(--v2-ok)' : 'var(--v2-ink3)' }}><span style={{ width: 70, height: 5, background: 'var(--v2-surface2)', borderRadius: 999, overflow: 'hidden', display: 'inline-block' }}><span style={{ display: 'block', width: `${k}%`, height: '100%', background: k >= 100 ? 'var(--v2-ok)' : 'var(--v2-amber-on)' }} /></span>{k}%</span>}
              </div>
            </div>
          ) })}
          {subs.length > 0 && sugerido !== form.status && (
            <button type="button" onClick={() => setForm(f => ({ ...f, status: sugerido as any }))} style={{ marginTop: 4, padding: '8px 12px', background: 'var(--v2-amber-bg)', color: 'var(--v2-amber)', border: '1px solid var(--v2-amber)', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Pelas etapas, o marco está "{STATUS_LABEL[sugerido] || sugerido}" — aplicar ao status
            </button>
          )}
        </div>

        {/* TAREFAS DESTE MARCO (dono, 07/09): abrir uma etapa do Playbook e ja criar/abrir tarefas dela */}
        {marco && tarefasDoMarcoModal && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--v2-rule)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--v2-ink)' }}>Tarefas deste marco</h4>
              <span style={{ fontSize: 12, color: 'var(--v2-ink3)' }}>{tarefasDoMarcoModal.length} · nascem ja no cliente, neste marco e com o responsavel do squad pelo tipo</span>
              {onNovaTarefa && <button type="button" onClick={onNovaTarefa} style={{ marginLeft: 'auto', padding: '7px 12px', background: 'var(--v2-surface)', color: 'var(--v2-ink)', border: '1px dashed var(--v2-rule2)', borderRadius: 9, fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>+ Nova tarefa</button>}
            </div>
            {tarefasDoMarcoModal.length === 0 && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink3)' }}>Nenhuma tarefa ainda.</p>}
            {tarefasDoMarcoModal.map(t => { const st = STATUS_TAREFA[t.status] || STATUS_TAREFA.a_fazer; return (
              <button key={t.id} type="button" onClick={() => onAbrirTarefa?.(t)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 4px', background: 'none', border: 0, borderBottom: '1px solid var(--v2-surface1)', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--v2-ink)', textAlign: 'left' }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: st.cor, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, textDecoration: t.status === 'concluido' ? 'line-through' : 'none' }}>{t.titulo}</span>
                <span style={{ fontSize: 11.5, color: st.cor }}>{st.label}</span>
                {t.responsavelNome && <span style={{ fontSize: 11.5, color: 'var(--v2-ink3)' }}>{t.responsavelNome}</span>}
                {t.prazo && <span style={{ fontSize: 11.5, color: 'var(--v2-ink3)' }}>{fmtData(t.prazo)}</span>}
              </button>
            ) })}
          </div>
        )}

        {/* Entregas vinculadas a esta etapa */}
        {marco && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--v2-rule)' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: 'var(--v2-ink)' }}>Entregas deste marco</h4>
            <EntregasMarco marcoId={marco.id} entregas={entregas} cor={STATUS_COR[form.status] === 'var(--v2-amber-on)' ? 'var(--v2-amber)' : 'var(--v2-ok)'} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
          <button onClick={salvar} disabled={salvando || !form.titulo.trim() || !form.clienteId} style={{ flex: 1, padding: '11px 0', background: (form.titulo.trim() && form.clienteId) ? corMarca : 'var(--v2-surface2)', color: (form.titulo.trim() && form.clienteId) ? corMarcaTexto : 'var(--v2-ink3)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: (form.titulo.trim() && form.clienteId) ? 'pointer' : 'not-allowed' }}>
            {salvando ? 'Salvando...' : (marco ? 'Salvar' : 'Criar marco')}
          </button>
          <button onClick={onClose} style={{ padding: '11px 16px', background: 'var(--v2-surface2)', color: 'var(--v2-ink2)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Fechar</button>
          {onExcluir && (
            <button onClick={async () => { if (await confirmar('Excluir este marco?', { titulo: 'Excluir marco', okLabel: 'Excluir', perigo: true })) onExcluir() }} style={{ padding: '11px 16px', background: 'var(--v2-surface)', color: 'var(--v2-hot)', border: '1px solid var(--v2-hot-bg)', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Excluir</button>
          )}
        </div>
      </div>
    </div>
  )
}
