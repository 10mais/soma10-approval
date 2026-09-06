'use client'
import { useMemo, useState } from 'react'
import AvatarCliente from './AvatarCliente'
import { atrasada, emRisco, diasDeAtraso } from '@/lib/entregas'

// Visão de PRODUÇÃO transversal — todas as pautas de TODOS os clientes numa
// tela: o que está atrasado, o que vence em breve, o que está travado (e em quê),
// quem é o responsável. Renderizada DENTRO do Studio (é a tela de abertura —
// não é uma aba separada). Clique numa linha abre a pauta no próprio Studio.

type Cliente = { id: string; nome: string; squad?: string[] }
type Post = {
  id: string; clienteId: string; clienteNome: string; imagens?: string[]; legenda?: string
  briefing?: string; status: string; etapa?: string; dataAgendada?: string
  aguardandoDesde?: string; criadoPor?: string; thumbnail?: string; planoId?: string
}
type Usuario = { nome: string; email: string }

// Em que pé está a pauta — e de QUEM é a bola (equipe/cliente/ok).
function travadoEmQue(p: Post): { label: string; cor: string; bg: string; bola: 'equipe' | 'cliente' | 'ok' } {
  if (p.status === 'falha_publicacao') return { label: 'Falha na publicação', cor: 'var(--v2-hot)', bg: 'var(--v2-hot-bg)', bola: 'equipe' }
  if (p.status === 'aguardando_aprovacao') {
    const d = p.aguardandoDesde ? Math.floor((Date.now() - new Date(p.aguardandoDesde).getTime()) / 86400000) : 0
    return { label: d > 0 ? `No cliente há ${d}d` : 'No cliente', cor: 'var(--v2-amber)', bg: 'var(--v2-amber-bg)', bola: 'cliente' }
  }
  if (p.status === 'corrigir') return { label: 'Ajuste pedido — refazer', cor: 'var(--v2-amber)', bg: '#fff3cd', bola: 'equipe' }
  if (p.status === 'reprovado') return { label: 'Reprovado — refazer', cor: 'var(--v2-hot)', bg: 'var(--v2-hot-bg)', bola: 'equipe' }
  if (p.status === 'publicado') return { label: 'Publicado', cor: 'var(--v2-ok)', bg: 'var(--v2-ok-bg)', bola: 'ok' }
  if (p.status === 'publicando') return { label: 'Publicando', cor: 'var(--v2-info)', bg: 'var(--v2-info-bg)', bola: 'ok' }
  if (p.status === 'aprovado' || p.status === 'agendado') return { label: 'Agendado', cor: 'var(--v2-ok)', bg: 'var(--v2-ok-bg)', bola: 'ok' }
  // rascunho
  if ((p.imagens || []).length === 0) return { label: 'Produzir criativo', cor: 'var(--v2-info)', bg: 'var(--v2-info-bg)', bola: 'equipe' }
  return { label: 'Enviar ao cliente', cor: 'var(--v2-info)', bg: 'var(--v2-info-bg)', bola: 'equipe' }
}

type Filtro = 'todos' | 'atrasados' | 'risco' | 'cliente' | 'equipe'

export default function ProducaoBoard({ clientes, posts, usuarios = [], meuEmail, onAbrirPauta }: {
  clientes: Cliente[]
  posts: Post[]
  usuarios?: Usuario[]
  meuEmail?: string
  onAbrirPauta: (post: Post) => void
}) {
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [clienteSel, setClienteSel] = useState('')
  const [soMeus, setSoMeus] = useState(false)

  const squadDe = useMemo(() => new Map(clientes.map(c => [c.id, c.squad || []])), [clientes])
  const nomeDe = useMemo(() => new Map(usuarios.map(u => [u.email, u.nome])), [usuarios])
  const meusClientes = useMemo(() => new Set(clientes.filter(c => meuEmail && (c.squad || []).includes(meuEmail)).map(c => c.id)), [clientes, meuEmail])

  // Só pautas "vivas" da produção (publicado antigo não interessa aqui).
  const vivas = useMemo(() => posts.filter(p => p.status !== 'publicado'), [posts])

  const filtradas = useMemo(() => {
    let lista = vivas
    if (clienteSel) lista = lista.filter(p => p.clienteId === clienteSel)
    if (soMeus) lista = lista.filter(p => meusClientes.has(p.clienteId))
    if (filtro === 'atrasados') lista = lista.filter(p => atrasada(p))
    else if (filtro === 'risco') lista = lista.filter(p => !atrasada(p) && emRisco(p))
    else if (filtro === 'cliente') lista = lista.filter(p => p.status === 'aguardando_aprovacao')
    else if (filtro === 'equipe') lista = lista.filter(p => travadoEmQue(p).bola === 'equipe')
    // Atrasados primeiro; depois por data (sem data por último).
    return [...lista].sort((a, b) => {
      const aa = atrasada(a) ? 0 : 1, ab = atrasada(b) ? 0 : 1
      if (aa !== ab) return aa - ab
      const ta = a.dataAgendada ? new Date(a.dataAgendada).getTime() : Infinity
      const tb = b.dataAgendada ? new Date(b.dataAgendada).getTime() : Infinity
      return ta - tb
    })
  }, [vivas, clienteSel, soMeus, filtro, meusClientes])

  const nAtras = useMemo(() => vivas.filter(p => atrasada(p)).length, [vivas])
  const nRisco = useMemo(() => vivas.filter(p => !atrasada(p) && emRisco(p)).length, [vivas])
  const nCliente = useMemo(() => vivas.filter(p => p.status === 'aguardando_aprovacao').length, [vivas])
  const nEquipe = useMemo(() => vivas.filter(p => travadoEmQue(p).bola === 'equipe').length, [vivas])

  const dataCurta = (iso?: string) => {
    if (!iso) return 'sem data'
    const d = new Date(iso)
    return isNaN(d.getTime()) ? 'sem data' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  const excerto = (p: Post) => {
    const t = (p.briefing || p.legenda || '').replace(/\s+/g, ' ').trim()
    return t.length > 72 ? `${t.slice(0, 72)}…` : (t || 'Pauta sem título')
  }
  const responsavel = (p: Post) => {
    const squad = squadDe.get(p.clienteId) || []
    const email = p.criadoPor && squad.includes(p.criadoPor) ? p.criadoPor : (squad[0] || p.criadoPor || '')
    if (!email) return ''
    return nomeDe.get(email) || email.split('@')[0]
  }

  const CHIPS: { key: Filtro; label: string; n?: number; cor?: string }[] = [
    { key: 'todos', label: 'Tudo em produção' },
    { key: 'atrasados', label: 'Atrasados', n: nAtras, cor: 'var(--v2-hot)' },
    { key: 'risco', label: 'Vencem em 2 dias', n: nRisco, cor: 'var(--v2-amber)' },
    { key: 'equipe', label: 'Com a equipe', n: nEquipe },
    { key: 'cliente', label: 'No cliente', n: nCliente },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: 'var(--v2-ink)' }}>Hoje na produção</h3>
        <span style={{ fontSize: 12.5, color: 'var(--v2-ink3)' }}>todos os clientes — quem está com a bola e o que vence. Clique numa pauta para abrir.</span>
      </div>

      {/* Resumo + filtros */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', margin: '14px 0' }}>
        {CHIPS.map(c => {
          const ativo = filtro === c.key
          return (
            <button key={c.key} onClick={() => setFiltro(c.key)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: `1px solid ${ativo ? 'var(--v2-ink)' : 'var(--v2-surface2)'}`, background: ativo ? 'var(--v2-ink)' : 'var(--v2-surface)', color: ativo ? 'var(--v2-surface)' : 'var(--v2-ink2)' }}>
              {c.label}
              {c.n !== undefined && <span style={{ fontSize: 10.5, fontWeight: 800, color: ativo ? 'var(--v2-amber-on)' : (c.n > 0 ? (c.cor || 'var(--v2-ink3)') : 'var(--v2-ink3)') }}>{c.n}</span>}
            </button>
          )
        })}
        <span style={{ flex: 1 }} />
        {meuEmail && meusClientes.size > 0 && (
          <button onClick={() => setSoMeus(v => !v)}
            style={{ padding: '7px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: `1px solid ${soMeus ? 'var(--v2-ink)' : 'var(--v2-surface2)'}`, background: soMeus ? 'var(--v2-ink)' : 'var(--v2-surface)', color: soMeus ? 'var(--v2-surface)' : 'var(--v2-ink2)' }}>
            Meus clientes
          </button>
        )}
        <select value={clienteSel} onChange={e => setClienteSel(e.target.value)}
          style={{ padding: '7px 11px', borderRadius: 10, border: '1px solid var(--v2-rule)', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer', background: 'var(--v2-surface)' }}>
          <option value="">Todos os clientes</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div style={{ background: 'var(--v2-surface)', borderRadius: 14, padding: '38px 20px', textAlign: 'center', color: 'var(--v2-ink3)', fontSize: 13.5, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          {filtro === 'atrasados' ? 'Nenhuma entrega atrasada. Tudo em dia.' : 'Nada por aqui com esses filtros.'}
        </div>
      ) : (
        <div style={{ background: 'var(--v2-surface)', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {filtradas.map(p => {
            const t = travadoEmQue(p)
            const atras = atrasada(p)
            const capa = p.thumbnail || (p.imagens || []).find(u => /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(u))
            const resp = responsavel(p)
            return (
              <div key={p.id} onClick={() => onAbrirPauta(p)}
                style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--v2-surface1)', cursor: 'pointer', background: atras ? '#fffafa' : undefined }}>
                {capa
                  ? <img src={capa} alt="" style={{ width: 40, height: 50, objectFit: 'cover', borderRadius: 8, flexShrink: 0, background: 'var(--v2-surface2)' }} />
                  : <div style={{ width: 40, height: 50, borderRadius: 8, flexShrink: 0, background: 'var(--v2-surface1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9c9ce" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.5-3.5L11 18" /></svg>
                    </div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, minWidth: 130, maxWidth: 170 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--v2-surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: 'var(--v2-ink3)' }}>
                    <AvatarCliente clienteId={p.clienteId} nome={p.clienteNome} />
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.clienteNome}</span>
                </div>
                <span style={{ flex: '1 1 120px', minWidth: 0, fontSize: 12.5, color: 'var(--v2-ink2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{excerto(p)}</span>
                {/* Responsável + status + prazo AGRUPADOS: no celular o grupo desce
                    inteiro pra 2ª linha — antes a linha não quebrava e o status
                    ficava CORTADO fora da tela (medido em produção a 375px). */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', flexShrink: 0 }}>
                  {resp && <span style={{ flexShrink: 0, fontSize: 11.5, color: 'var(--v2-ink3)', whiteSpace: 'nowrap' }}>{resp}</span>}
                  <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, background: t.bg, color: t.cor, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>{t.label}</span>
                  <span style={{ flexShrink: 0, fontSize: 11.5, fontWeight: atras ? 800 : 600, color: atras ? 'var(--v2-hot)' : '#9a9a9a', whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {atras ? (diasDeAtraso(p) === 0 ? 'venceu hoje' : `atrasado ${diasDeAtraso(p)}d`) : dataCurta(p.dataAgendada)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <p style={{ margin: '10px 2px 0', fontSize: 11.5, color: 'var(--v2-ink3)' }}>Posts publicados saem desta lista.</p>
    </div>
  )
}
