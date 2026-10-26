'use client'
// FILA DE PRODUÇÃO de criativos — dono, 26/10/2026: "Preciso de uma FILA DE PRODUÇÃO de criativos,
// onde os designers recebam os criativos para produzir e preencham qual o status... Essa esteira
// precisa estar visível no dashboard de toda equipe". Plano e decisões: memória proj-fila-producao.
//
// Um quadro para a equipe inteira, uma coluna por estado do criativo. O designer da peça (ou o
// gestor do squad, gerente, admin) move o cartão entre Na fila, Em produção e Aguardando material
// (com o motivo), arrastando no computador ou pelo seletor do cartão; "Entregar" abre a tarefa para
// anexar a arte e concluir. Revisão interna, Com o cliente, Ajuste pedido e Aprovado andam sozinhos
// pelo estado da pauta (lib/filaProducao, testada). Recarrega a cada minuto, ao voltar para a aba e
// quando alguém salva uma tarefa (avisarTarefasMudaram). Ctrl+Z desfaz o último movimento.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useIdioma, useT } from '@/app/components/Idioma'
import LimiteDeErro from '@/app/components/LimiteDeErro'
import { avisarTarefasMudaram } from '@/app/components/BarraProximasTarefas'
import {
  COLUNAS_FILA, diasDesde, destinosDoCartao, destinoAoSoltar, colunaAposMover, destinoDaColuna,
  type ColunaFila, type DestinoFila, type ItemFila,
} from '@/lib/filaProducao'
import { fmtDiaDoInstante } from '@/lib/datas'
import type { Idioma } from '@/lib/i18n'
import { labelFormato, corFormato } from '@/lib/formatoPost'
import { toast, toastErro } from '@/lib/toast'
import { registrarDesfazer } from '@/lib/desfazer'
import { abrirTarefa } from '@/lib/abrirTarefa'
import { fecharFora } from '@/lib/fecharModal'

const CHAVE_FILTROS = 'soma10-fila-producao-filtros'
const EVENTO_TAREFAS = 'soma-tarefas-mudaram' // o mesmo de avisarTarefasMudaram
const DO_DESIGNER: ColunaFila[] = ['ajuste_pedido', 'na_fila', 'em_producao', 'aguardando_material']

const DICA: Record<ColunaFila, string> = {
  ajuste_pedido: 'O cliente ou a equipe pediu ajuste',
  na_fila: 'Copy aprovada, esperando o designer',
  em_producao: 'O designer está produzindo',
  aguardando_material: 'Parado esperando material',
  revisao_interna: 'Entregue, a equipe revisa no Estúdio',
  com_cliente: 'Esperando a aprovação do cliente',
  aprovado: 'Aprovados nos últimos 7 dias',
}
const COR: Record<ColunaFila, string> = {
  ajuste_pedido: 'var(--v2-amber)', na_fila: 'var(--v2-ink3)', em_producao: 'var(--v2-info)', aguardando_material: 'var(--v2-hot)',
  revisao_interna: '#7c3aed', com_cliente: 'var(--v2-amber)', aprovado: 'var(--v2-ok)',
}
const rotulo = (c: ColunaFila) => COLUNAS_FILA.find(x => x.chave === c)?.rotulo || c
const SUGESTOES = ['Foto do cliente', 'Logo ou arquivo da marca', 'Informação do produto', 'Referência aprovada']

type Filtros = { designer: string; cliente: string; formato: string; alerta: '' | 'atrasado' | 'hoje' }
const SEM_FILTRO: Filtros = { designer: '', cliente: '', formato: '', alerta: '' }

class SemQuebrar extends React.Component<{ children: React.ReactNode }, { erro: Error | null }> {
  state = { erro: null as Error | null }
  static getDerivedStateFromError(erro: Error) { return { erro } }
  componentDidCatch(e: Error) { console.error('[FilaProducao]', e) }
  render() {
    if (!this.state.erro) return this.props.children
    return (
      <div style={{ background: 'var(--v2-surface)', borderRadius: 14, padding: 22, color: 'var(--v2-ink2)', fontSize: 13.5, lineHeight: 1.55 }}>
        <strong style={{ color: 'var(--v2-hot)' }}>A fila de produção não abriu.</strong> Recarregue a página; se continuar, mande este texto para o suporte:
        <div style={{ marginTop: 8, fontSize: 11.5, fontFamily: 'ui-monospace, monospace', color: 'var(--v2-ink3)' }}>{String(this.state.erro?.message || this.state.erro).slice(0, 300)}</div>
      </div>
    )
  }
}

type Props = {
  clienteFixo?: string // "ver como cliente": só as peças dele, sem o seletor de cliente
  onAbrirTarefa?: (id: string) => void // no painel: abre o modal da tarefa sem sair da tela
  onAbrirPauta?: (p: { id: string; clienteId: string; planoId?: string }) => void // leva ao Estúdio, na pauta
}

export default function FilaProducao(props: Props) {
  return <SemQuebrar><Fila {...props} /></SemQuebrar>
}

async function enviarMovimento(tarefaId: string, para: DestinoFila, motivo?: string): Promise<{ ok: boolean; erro?: string }> {
  try {
    const r = await fetch('/api/fila-producao', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tarefaId, para, motivo }) })
    if (r.ok) return { ok: true }
    const d = await r.json().catch(() => ({}))
    return { ok: false, erro: d.error || 'Não foi possível mudar o status.' }
  } catch {
    return { ok: false, erro: 'Sem conexão. Tente de novo.' }
  }
}

function Fila({ clienteFixo, onAbrirTarefa, onAbrirPauta }: Props) {
  const tr = useT()
  const { idioma } = useIdioma()
  const router = useRouter()
  const { data: session, status } = useSession()
  const meuEmail = String(session?.user?.email || '').toLowerCase()
  const meuNome = String(session?.user?.name || session?.user?.email || '')

  const [itens, setItens] = useState<ItemFila[] | null>(null)
  const [erro, setErro] = useState('')
  const [filtros, setFiltros] = useState<Filtros | null>(null) // null = ainda não decidido
  const [arrastando, setArrastando] = useState<ItemFila | null>(null)
  const [sobre, setSobre] = useState<ColunaFila | null>(null)
  const [pedindoMotivo, setPedindoMotivo] = useState<ItemFila | null>(null)
  const [movendo, setMovendo] = useState<string | null>(null) // postId gravando
  const [celular, setCelular] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const arrastandoRef = useRef<ItemFila | null>(null)

  const carregar = useCallback(() => {
    if (arrastandoRef.current) return // não reordena o quadro embaixo do cursor
    fetch('/api/fila-producao', { cache: 'no-store' })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Não foi possível carregar a fila.'); return d })
      .then(d => { setItens(Array.isArray(d.itens) ? d.itens : []); setErro('') })
      .catch(e => setErro(String(e?.message || 'Não foi possível carregar a fila.')))
  }, [])

  useEffect(() => {
    carregar()
    const intervalo = setInterval(carregar, 60000)
    const aoVoltar = () => { if (document.visibilityState === 'visible') carregar() }
    window.addEventListener('focus', aoVoltar)
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener(EVENTO_TAREFAS, carregar)
    return () => {
      clearInterval(intervalo)
      window.removeEventListener('focus', aoVoltar)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener(EVENTO_TAREFAS, carregar)
    }
  }, [carregar])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const ver = () => setCelular(mq.matches)
    ver()
    mq.addEventListener('change', ver)
    return () => mq.removeEventListener('change', ver)
  }, [])

  // Filtro guardado no navegador; sem ele, quem é designer abre nas próprias peças.
  useEffect(() => {
    if (filtros || !itens || status === 'loading') return
    let salvo: Filtros | null = null
    try { const s = localStorage.getItem(CHAVE_FILTROS); if (s) salvo = { ...SEM_FILTRO, ...JSON.parse(s) } } catch { /* sem storage: padrão */ }
    const souDesigner = !!meuEmail && itens.some(i => (i.designerEmail || '').toLowerCase() === meuEmail)
    setFiltros(salvo || { ...SEM_FILTRO, designer: souDesigner ? 'eu' : '' })
  }, [itens, filtros, status, meuEmail])

  const f = filtros || SEM_FILTRO
  const mudarFiltro = (parcial: Partial<Filtros>) => setFiltros(atual => {
    const novo = { ...(atual || SEM_FILTRO), ...parcial }
    try { localStorage.setItem(CHAVE_FILTROS, JSON.stringify(novo)) } catch { /* sem storage: vale só agora */ }
    return novo
  })

  const designers = useMemo(() => {
    const m = new Map<string, string>()
    for (const i of itens || []) if (i.designerEmail) m.set(i.designerEmail.toLowerCase(), i.designerNome || i.designerEmail.split('@')[0])
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [itens])
  const clientes = useMemo(() => {
    const m = new Map<string, string>()
    for (const i of itens || []) m.set(i.clienteId, i.clienteNome || 'Cliente')
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [itens])
  const formatos = useMemo(() => Array.from(new Set((itens || []).map(i => (i.formato || 'feed').toLowerCase()))), [itens])

  // Base = filtros de quem/cliente/formato; os chips de alerta contam em cima dela.
  const base = useMemo(() => (itens || []).filter(i => {
    const d = (i.designerEmail || '').toLowerCase()
    if (f.designer === 'eu' && d !== meuEmail) return false
    if (f.designer === 'sem' && !i.semDesigner) return false
    if (f.designer && f.designer !== 'eu' && f.designer !== 'sem' && d !== f.designer) return false
    if (clienteFixo && i.clienteId !== clienteFixo) return false
    if (!clienteFixo && f.cliente && i.clienteId !== f.cliente) return false
    if (f.formato && (i.formato || 'feed').toLowerCase() !== f.formato) return false
    return true
  }), [itens, f.designer, f.cliente, f.formato, meuEmail, clienteFixo])
  const visiveis = useMemo(() => (f.alerta ? base.filter(i => i.alerta === f.alerta) : base), [base, f.alerta])
  const nAtrasadas = base.filter(i => i.alerta === 'atrasado').length
  const nHoje = base.filter(i => i.alerta === 'hoje').length
  const porColuna = useMemo(() => {
    const m = new Map<ColunaFila, ItemFila[]>(COLUNAS_FILA.map(c => [c.chave, [] as ItemFila[]]))
    for (const i of visiveis) m.get(i.coluna)?.push(i)
    return m
  }, [visiveis])
  const temFiltro = !!(f.designer || (!clienteFixo && f.cliente) || f.formato || f.alerta)

  const abrir = (it: ItemFila) => {
    if (DO_DESIGNER.includes(it.coluna) && it.tarefaId) {
      if (onAbrirTarefa) onAbrirTarefa(it.tarefaId)
      else abrirTarefa(it.tarefaId, url => router.push(url))
    } else if (onAbrirPauta) {
      onAbrirPauta({ id: it.postId, clienteId: it.clienteId, planoId: it.planoId })
    }
  }

  async function mover(it: ItemFila, para: DestinoFila, motivo?: string) {
    if (!it.tarefaId || !it.podeMover || movendo) return
    if (para === 'aguardando_material' && !motivo) { setPedindoMotivo(it); return }
    const antes = itens
    const agoraIso = new Date().toISOString()
    setMovendo(it.postId)
    setItens(lista => (lista || []).map(x => x.postId !== it.postId ? x : {
      ...x, coluna: colunaAposMover(para, x.ajuste), desde: agoraIso,
      aguardando: para === 'aguardando_material' ? { motivo: motivo || '', desde: agoraIso, por: meuNome } : undefined,
    }))
    const r = await enviarMovimento(it.tarefaId, para, motivo)
    setMovendo(null)
    if (!r.ok) { setItens(antes); toastErro(r.erro || 'Não foi possível mudar o status.'); carregar(); return }
    avisarTarefasMudaram() // a barra do topo e este quadro recarregam
    const volta = destinoDaColuna(it.coluna)
    if (volta) {
      const tarefaId = it.tarefaId
      const motivoAntes = it.aguardando?.motivo
      registrarDesfazer(`"${it.titulo}" em ${rotulo(colunaAposMover(para, it.ajuste))}`, async () => {
        const d = await enviarMovimento(tarefaId, volta, motivoAntes)
        if (d.ok) avisarTarefasMudaram()
        return d.ok
      })
    }
  }

  const entregar = (it: ItemFila) => {
    toast('Anexe a arte e conclua a tarefa: o criativo vai para a revisão da equipe no Estúdio.', 'info')
    abrir(it)
  }

  const fimDoArrasto = () => { arrastandoRef.current = null; setArrastando(null); setSobre(null) }

  const sel: React.CSSProperties = { padding: '7px 11px', borderRadius: 10, border: '1px solid var(--v2-rule)', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer', background: 'var(--v2-surface)', color: 'var(--v2-ink)', maxWidth: '100%' }
  const chip = (ativo: boolean): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${ativo ? 'var(--v2-ink)' : 'var(--v2-rule)'}`, background: ativo ? 'var(--v2-ink)' : 'var(--v2-surface)', color: ativo ? 'var(--v2-surface)' : 'var(--v2-ink2)' })

  return (
    <div ref={raiz} style={{ color: 'var(--v2-ink)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: 'var(--v2-ink)' }}>{tr('nav.fila')}</h2>
        <span style={{ fontSize: 12.5, color: 'var(--v2-ink3)' }}>Os criativos das pautas do Estúdio, da copy aprovada até a aprovação do cliente.</span>
      </div>

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center', margin: '14px 0' }}>
        <select aria-label="Designer" value={f.designer} onChange={e => mudarFiltro({ designer: e.target.value })} style={sel}>
          <option value="">Toda a equipe</option>
          {meuEmail && <option value="eu">Minhas peças</option>}
          {designers.map(([email, nome]) => <option key={email} value={email}>{nome}</option>)}
          <option value="sem">Sem designer</option>
        </select>
        {!clienteFixo && (
          <select aria-label="Cliente" value={f.cliente} onChange={e => mudarFiltro({ cliente: e.target.value })} style={sel}>
            <option value="">Todos os clientes</option>
            {clientes.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </select>
        )}
        <select aria-label="Formato" value={f.formato} onChange={e => mudarFiltro({ formato: e.target.value })} style={sel}>
          <option value="">Todos os formatos</option>
          {formatos.map(x => <option key={x} value={x}>{labelFormato(x, idioma)}</option>)}
        </select>
        <button onClick={() => mudarFiltro({ alerta: f.alerta === 'atrasado' ? '' : 'atrasado' })} style={chip(f.alerta === 'atrasado')}>
          Atrasadas <span style={{ fontSize: 10.5, fontWeight: 800, color: f.alerta === 'atrasado' ? 'var(--v2-amber-on)' : nAtrasadas ? 'var(--v2-hot)' : 'var(--v2-ink3)' }}>{nAtrasadas}</span>
        </button>
        <button onClick={() => mudarFiltro({ alerta: f.alerta === 'hoje' ? '' : 'hoje' })} style={chip(f.alerta === 'hoje')}>
          Vencem hoje <span style={{ fontSize: 10.5, fontWeight: 800, color: f.alerta === 'hoje' ? 'var(--v2-amber-on)' : nHoje ? 'var(--v2-amber)' : 'var(--v2-ink3)' }}>{nHoje}</span>
        </button>
        {temFiltro && (
          <button onClick={() => mudarFiltro(SEM_FILTRO)} style={{ ...chip(false), border: 0, background: 'transparent', textDecoration: 'underline' }}>Limpar filtros</button>
        )}
        <span style={{ flex: 1 }} />
        <button onClick={carregar} title="Atualizar" aria-label="Atualizar" style={{ ...chip(false), padding: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
        </button>
      </div>

      {erro && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', borderRadius: 10, background: 'var(--v2-hot-bg)', color: 'var(--v2-hot)', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
          {erro}
          <button onClick={carregar} style={{ border: 0, background: 'transparent', color: 'var(--v2-hot)', fontWeight: 800, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Tentar de novo</button>
        </div>
      )}

      {!itens && !erro && (
        <div style={{ padding: '38px 20px', textAlign: 'center', color: 'var(--v2-ink3)', fontSize: 13.5 }}>Carregando a fila de produção…</div>
      )}

      {itens && itens.length === 0 && (
        <div style={{ background: 'var(--v2-surface)', borderRadius: 14, padding: '38px 20px', textAlign: 'center', color: 'var(--v2-ink3)', fontSize: 13.5, lineHeight: 1.6 }}>
          Nenhum criativo em produção agora. As peças entram aqui quando o cliente aprova a copy no Estúdio.
        </div>
      )}

      {itens && itens.length > 0 && (
        <>
          {visiveis.length === 0 && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--v2-surface)', color: 'var(--v2-ink2)', fontSize: 13, marginBottom: 12 }}>
              Nenhuma peça com esses filtros. <button onClick={() => mudarFiltro(SEM_FILTRO)} style={{ border: 0, background: 'transparent', color: 'var(--v2-ink)', fontWeight: 800, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Ver a fila inteira</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', alignItems: 'flex-start', paddingBottom: 12, scrollSnapType: celular ? 'x mandatory' : undefined, WebkitOverflowScrolling: 'touch' }}>
            {COLUNAS_FILA.map(col => {
              const lista = porColuna.get(col.chave) || []
              const destino = arrastando ? destinoAoSoltar(col.chave, arrastando) : null
              const aceita = !!destino
              const realce = aceita && sobre === col.chave
              return (
                <section key={col.chave} aria-label={col.rotulo}
                  onDragOver={e => { if (!aceita) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (sobre !== col.chave) setSobre(col.chave) }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSobre(s => (s === col.chave ? null : s)) }}
                  onDrop={e => { e.preventDefault(); const it = arrastandoRef.current; fimDoArrasto(); if (it && destino) mover(it, destino) }}
                  style={{
                    flex: celular ? '0 0 84%' : '0 0 252px', scrollSnapAlign: celular ? 'start' : undefined,
                    background: realce ? 'var(--v2-surface2)' : 'var(--v2-surface1)', borderRadius: 14, padding: 10,
                    border: `1.5px ${aceita ? 'dashed' : 'solid'} ${aceita ? COR[col.chave] : 'var(--v2-rule)'}`,
                    opacity: arrastando && !aceita && arrastando.coluna !== col.chave ? 0.55 : 1,
                    transition: 'background-color 120ms ease, opacity 120ms ease, border-color 120ms ease',
                  }}>
                  <header style={{ padding: '2px 4px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: COR[col.chave], flexShrink: 0 }} />
                      <strong style={{ fontSize: 13, color: 'var(--v2-ink)' }}>{col.rotulo}</strong>
                      <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--v2-ink3)' }}>{lista.length}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--v2-ink3)', marginTop: 3 }}>{DICA[col.chave]}</div>
                  </header>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 40 }}>
                    {lista.map(it => (
                      <Cartao key={it.postId} it={it} idioma={idioma} celular={celular}
                        ocupado={movendo === it.postId} arrastandoEste={arrastando?.postId === it.postId}
                        onAbrir={() => abrir(it)} onMover={d => mover(it, d)} onEntregar={() => entregar(it)}
                        onDragStart={() => { arrastandoRef.current = it; setArrastando(it) }} onDragEnd={fimDoArrasto} />
                    ))}
                    {lista.length === 0 && (
                      <div style={{ padding: '14px 6px', textAlign: 'center', fontSize: 11.5, color: 'var(--v2-ink3)' }}>{aceita ? 'Solte aqui' : 'Nada aqui'}</div>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        </>
      )}

      {pedindoMotivo && typeof document !== 'undefined' && createPortal(
        <LimiteDeErro onFechar={() => setPedindoMotivo(null)} titulo="Não foi possível abrir">
          <ModalMotivo item={pedindoMotivo} tema={raiz.current?.closest('[data-theme]')?.getAttribute('data-theme') || 'light'}
            onCancelar={() => setPedindoMotivo(null)}
            onConfirmar={m => { const it = pedindoMotivo; setPedindoMotivo(null); mover(it, 'aguardando_material', m) }} />
        </LimiteDeErro>,
        document.body,
      )}
    </div>
  )
}

function Cartao({ it, idioma, celular, ocupado, arrastandoEste, onAbrir, onMover, onEntregar, onDragStart, onDragEnd }: {
  it: ItemFila; idioma: Idioma; celular: boolean; ocupado: boolean; arrastandoEste: boolean
  onAbrir: () => void; onMover: (d: DestinoFila) => void; onEntregar: () => void
  onDragStart: () => void; onDragEnd: () => void
}) {
  const dias = diasDesde(it.desde, Date.now())
  const destinos = it.podeMover && it.tarefaId ? destinosDoCartao(it.coluna) : []
  const arrastavel = destinos.length > 0 && !celular && !ocupado
  const podeEntregar = it.podeMover && !!it.tarefaId && (it.coluna === 'em_producao' || it.coluna === 'ajuste_pedido')
  const corFmt = corFormato(it.formato)
  const prazo = fmtDiaDoInstante(it.prazo, false)
  const posta = fmtDiaDoInstante(it.dataPostagem, false)
  const nomeDesigner = it.designerNome || (it.designerEmail ? it.designerEmail.split('@')[0] : '')
  const iniciais = nomeDesigner.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?'
  const corPrazo = it.alerta === 'atrasado' ? 'var(--v2-hot)' : it.alerta === 'hoje' ? 'var(--v2-amber)' : 'var(--v2-ink2)'
  const selo = (texto: string, cor: string, fundo: string) => (
    <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 999, fontSize: 10.5, fontWeight: 800, color: cor, background: fundo }}>{texto}</span>
  )
  const parar = (e: React.SyntheticEvent) => e.stopPropagation()

  return (
    <div role="button" tabIndex={0} aria-label={`${it.titulo} — ${it.clienteNome}`}
      onClick={onAbrir} onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) onAbrir() }}
      draggable={arrastavel}
      onDragStart={e => { if (!arrastavel) return; e.dataTransfer.setData('text/plain', it.postId); e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
      onDragEnd={onDragEnd}
      style={{
        background: 'var(--v2-surface)', borderRadius: 12, padding: 10, cursor: arrastavel ? 'grab' : 'pointer',
        border: '1px solid var(--v2-rule)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        borderLeft: it.alerta === 'atrasado' ? '3px solid var(--v2-hot)' : it.alerta === 'hoje' ? '3px solid var(--v2-amber)' : '1px solid var(--v2-rule)',
        opacity: arrastandoEste ? 0.45 : ocupado ? 0.7 : 1, transition: 'opacity 120ms ease',
      }}>
      <div style={{ display: 'flex', gap: 10 }}>
        {it.miniatura
          ? <img src={it.miniatura} alt="" loading="lazy" draggable={false} style={{ width: 40, height: 50, objectFit: 'cover', borderRadius: 8, flexShrink: 0, background: 'var(--v2-surface2)' }} />
          : <div style={{ width: 40, height: 50, borderRadius: 8, flexShrink: 0, background: 'var(--v2-surface1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v2-rule2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.5-3.5L11 18" /></svg>
            </div>}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--v2-ink3)', fontWeight: 600 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{it.clienteNome}</span>
            <span style={{ flexShrink: 0, padding: '0 6px', borderRadius: 999, fontSize: 9.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: corFmt, border: `1px solid ${corFmt}` }}>{labelFormato(it.formato, idioma)}</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--v2-ink)', lineHeight: 1.3, marginTop: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>{it.titulo}</div>
        </div>
      </div>

      {(it.alerta || (it.ajuste && it.coluna !== 'ajuste_pedido') || it.prontoParaEnviar) && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
          {it.alerta === 'atrasado' && selo('Atrasada', 'var(--v2-hot)', 'var(--v2-hot-bg)')}
          {it.alerta === 'hoje' && selo('Vence hoje', 'var(--v2-amber)', 'var(--v2-amber-bg)')}
          {it.ajuste && it.coluna !== 'ajuste_pedido' && selo('Ajuste', 'var(--v2-amber)', 'var(--v2-amber-bg)')}
          {it.prontoParaEnviar && selo('Revisado, falta enviar', 'var(--v2-ok)', 'var(--v2-ok-bg)')}
        </div>
      )}

      {it.coluna === 'aguardando_material' && it.aguardando?.motivo && (
        <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 8, background: 'var(--v2-hot-bg)', fontSize: 11.5, color: 'var(--v2-ink2)', lineHeight: 1.4 }}>
          <strong style={{ color: 'var(--v2-hot)' }}>Falta:</strong> {it.aguardando.motivo}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, color: 'var(--v2-ink3)' }}>
        {nomeDesigner ? (
          <>
            <span aria-hidden style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--v2-surface2)', color: 'var(--v2-ink2)', fontSize: 8.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{iniciais}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, fontWeight: 600, color: 'var(--v2-ink2)' }}>{nomeDesigner}</span>
          </>
        ) : <span style={{ fontWeight: 700, color: 'var(--v2-hot)' }} title="Nenhum designer com esta peça: defina no squad do cliente ou na tarefa">Sem designer</span>}
        <span style={{ flex: 1 }} />
        {dias !== undefined && <span style={{ flexShrink: 0 }} title="Tempo nesta coluna">{dias === 0 ? 'hoje' : dias === 1 ? 'há 1 dia' : `há ${dias} dias`}</span>}
      </div>
      {(prazo || posta) && (
        <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 11, color: 'var(--v2-ink3)' }}>
          {prazo && <span>Prazo <strong style={{ color: corPrazo }}>{prazo}</strong></span>}
          {posta && <span>Postagem <strong style={{ color: 'var(--v2-ink2)' }}>{posta}</strong></span>}
        </div>
      )}

      {(destinos.length > 0 || podeEntregar) && (
        <div style={{ display: 'flex', gap: 6, marginTop: 9 }} onClick={parar} onKeyDown={parar}>
          {destinos.length > 0 && (
            <select aria-label="Mudar o status" value="" disabled={ocupado}
              onChange={e => { const d = e.target.value as DestinoFila; if (d) onMover(d) }}
              style={{ flex: 1, minWidth: 0, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--v2-rule)', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', background: 'var(--v2-surface1)', color: 'var(--v2-ink2)' }}>
              <option value="">{ocupado ? 'Salvando…' : 'Mover para…'}</option>
              {destinos.map(d => <option key={d} value={d}>{rotulo(colunaAposMover(d, it.ajuste))}</option>)}
            </select>
          )}
          {podeEntregar && (
            <button onClick={onEntregar} disabled={ocupado}
              style={{ flexShrink: 0, padding: '6px 11px', borderRadius: 8, border: 0, background: 'var(--v2-ink)', color: 'var(--v2-surface)', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              Entregar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// "Aguardando material" pede o motivo: quem coordena precisa saber O QUE falta para destravar.
// Fechar com o motivo escrito marca do mesmo jeito (regra da casa: fechar nunca perde o que foi
// escrito — lib/fecharModal); sem nada escrito, fecha sem mudar.
function ModalMotivo({ item, tema, onConfirmar, onCancelar }: { item: ItemFila; tema: string; onConfirmar: (motivo: string) => void; onCancelar: () => void }) {
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const campo = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { campo.current?.focus() }, [])
  const confirmar = () => { const m = motivo.trim(); if (!m) { setErro('Escreva o que está faltando.'); campo.current?.focus(); return } onConfirmar(m) }
  const fechar = () => { const m = motivo.trim(); if (m) onConfirmar(m); else onCancelar() }
  const fecharRef = useRef(fechar)
  fecharRef.current = fechar
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') fecharRef.current() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  return (
    <div className="soma10-v2 soma10-no-invert" data-theme={tema}>
      <div className="anim-overlay" onClick={fecharFora(fechar)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16 }}>
        <div className="anim-modal" role="dialog" aria-modal="true" aria-label="Aguardando material"
          style={{ background: 'var(--v2-surface)', color: 'var(--v2-ink)', borderRadius: 14, padding: '20px 22px', maxWidth: 420, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', fontFamily: 'var(--v2-font)' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15.5 }}>O que está faltando?</h3>
          <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--v2-ink3)', lineHeight: 1.5 }}>
            "{item.titulo}" — {item.clienteNome}. Quem coordena vê o motivo no cartão.
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {SUGESTOES.map(s => (
              <button key={s} onClick={() => { setMotivo(m => (m.trim() ? `${m.trim()}; ${s}` : s)); setErro(''); campo.current?.focus() }}
                style={{ padding: '5px 10px', borderRadius: 999, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface1)', color: 'var(--v2-ink2)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {s}
              </button>
            ))}
          </div>
          <textarea ref={campo} value={motivo} maxLength={300} rows={3}
            onChange={e => { setMotivo(e.target.value); if (erro) setErro('') }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) confirmar() }}
            placeholder="Ex.: fotos do produto novo, que o cliente ficou de mandar"
            style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: `1px solid ${erro ? 'var(--v2-hot)' : 'var(--v2-rule)'}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', background: 'var(--v2-surface)', color: 'var(--v2-ink)' }} />
          {erro && <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: 'var(--v2-hot)' }}>{erro}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            <button onClick={onCancelar} style={{ padding: '9px 16px', background: 'var(--v2-surface1)', border: 0, borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--v2-ink2)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
            <button onClick={confirmar} style={{ padding: '9px 16px', background: 'var(--v2-ink)', border: 0, borderRadius: 8, fontSize: 13, fontWeight: 700, color: 'var(--v2-surface)', cursor: 'pointer', fontFamily: 'inherit' }}>Marcar como aguardando</button>
          </div>
        </div>
      </div>
    </div>
  )
}
