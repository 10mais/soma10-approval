'use client'
// FILA DE PROGRAMAÇÃO (dono, 13/11/2026): "quando a tarefa for concluída (anexado o criativo
// pronto) ele já se vira uma postagem em rascunho como Fila de programação. Aí o colaborador
// abre, revisa e finaliza a programação." É um recorte do Programador: o que a produção
// entregou e ainda depende da equipe. A regra de quem entra mora em lib/plannerFiltro
// (estadoNaFila, com teste); esta tela só mostra e age.
//
// Ações: Enviar ao cliente (registra a revisão interna, manda para aprovação e entrega o link),
// Pedir ajuste ao designer (a tarefa vai para Em ajuste), Abrir (prévia/editor para revisar
// legenda e data). Peça com versão nova depois de ajuste é revisada em Solicitações do cliente.

import { useMemo, useState } from 'react'
import { estadoNaFila, type EstadoNaFila } from '@/lib/plannerFiltro'
import { toast } from '@/lib/toast'

type PostFila = {
  id: string; clienteId?: string; clienteNome?: string; legenda?: string; briefing?: string; headline?: string
  imagens?: string[]; formato?: string; dataAgendada?: string; criadoEm?: string; atualizadoEm?: string
  etapa?: string; status?: string; filaProgramacaoDesde?: string; versaoNova?: unknown; excluidoEm?: string
}

const ROTULO: Record<EstadoNaFila, { texto: string; cor: string; bg: string }> = {
  nova: { texto: 'Para revisar e enviar', cor: 'var(--v2-amber)', bg: 'var(--v2-amber-bg)' },
  nova_versao: { texto: 'Nova versão para revisar', cor: 'var(--v2-info)', bg: 'var(--v2-info-bg)' },
  em_ajuste: { texto: 'Em ajuste com o designer', cor: 'var(--v2-hot)', bg: 'var(--v2-hot-bg)' },
}

function quandoPostar(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function haQuanto(iso?: string): string {
  if (!iso) return ''
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  return dias <= 0 ? 'hoje' : dias === 1 ? 'há 1 dia' : `há ${dias} dias`
}

export default function FilaProgramacao({ posts, filtroCliente, onAbrir, onIrSolicitacoes, onMudou }: {
  posts: PostFila[]
  filtroCliente?: string
  onAbrir: (p: PostFila) => void
  onIrSolicitacoes: () => void
  onMudou: () => void
}) {
  const [agindo, setAgindo] = useState<string | null>(null)
  const [ajuste, setAjuste] = useState<{ id: string; texto: string } | null>(null)
  const [link, setLink] = useState<{ url: string; cliente: string } | null>(null)

  // Ordem da FILA: a postagem mais próxima primeiro (é a mais urgente de revisar); sem data no
  // fim, porque precisa de data antes de ir ao cliente.
  const itens = useMemo(() => (posts
    .filter(p => !filtroCliente || p.clienteNome === filtroCliente)
    .map(p => ({ ...p, _estado: estadoNaFila(p as any) }))
    .filter(p => !!p._estado) as (PostFila & { _estado: EstadoNaFila })[])
    .sort((a, b) => (a.dataAgendada ? Date.parse(a.dataAgendada) : Infinity) - (b.dataAgendada ? Date.parse(b.dataAgendada) : Infinity)),
  [posts, filtroCliente])

  async function enviarAoCliente(p: PostFila) {
    if (!p.dataAgendada) { toast('Defina a data e o horário da postagem antes de enviar (Abrir).', 'erro'); return }
    setAgindo(p.id)
    try {
      // Revisão interna registrada (quem revisou e quando) e envio ao cliente.
      await fetch('/api/esteira/aprovar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: p.id, acao: 'revisar_criativo' }) }).catch(() => null)
      const r = await fetch('/api/posts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, status: 'aguardando_aprovacao', etapa: 'aprovacao_criativo' }) })
      if (!r.ok) { toast('Não foi possível enviar ao cliente.', 'erro'); return }
      const tk = await fetch('/api/aprovacao-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId: p.clienteId }) }).then(x => x.json()).catch(() => null)
      const url = tk?.token ? `${window.location.origin}/aprovacoes/${tk.token}` : ''
      if (url) {
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).catch(() => {})
        setLink({ url, cliente: p.clienteNome || 'cliente' })
      }
      toast(url ? 'Enviado ao cliente. Link copiado.' : 'Enviado ao cliente.', 'sucesso')
      onMudou()
    } finally { setAgindo(null) }
  }

  async function pedirAjuste() {
    if (!ajuste) return
    const texto = ajuste.texto.trim()
    if (!texto) { toast('Escreva o que precisa mudar.', 'erro'); return }
    setAgindo(ajuste.id)
    try {
      const r = await fetch('/api/esteira/aprovar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: ajuste.id, acao: 'ajuste_interno', comentario: texto }) })
      if (!r.ok) { toast('Não foi possível pedir o ajuste.', 'erro'); return }
      toast('Ajuste pedido. A tarefa voltou ao designer em "Em ajuste".', 'sucesso')
      setAjuste(null)
      onMudou()
    } finally { setAgindo(null) }
  }

  const btn = (primario = false): React.CSSProperties => ({
    padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    border: primario ? 'none' : '1px solid var(--v2-rule)',
    background: primario ? 'var(--v2-amber-on)' : 'var(--v2-surface)',
    color: primario ? '#17150E' : 'var(--v2-ink)',
  })

  return (
    <div>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--v2-ink2)', lineHeight: 1.5 }}>
        Peças que a produção entregou. Revise a arte, a legenda e a data, e envie ao cliente. Quando o cliente aprova, o post fica agendado e a tarefa conclui sozinha.
      </p>

      {link && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 14px', marginBottom: 16, borderRadius: 12, background: 'var(--v2-ok-bg)', color: 'var(--v2-ok)', fontSize: 13 }}>
          <span style={{ flex: 1, minWidth: 200 }}>Link de aprovação de {link.cliente} copiado: <span style={{ wordBreak: 'break-all' }}>{link.url}</span></span>
          <button type="button" onClick={() => setLink(null)} style={{ ...btn(), padding: '6px 10px' }}>Fechar</button>
        </div>
      )}

      {itens.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--v2-ink3)', background: 'var(--v2-surface)', borderRadius: 14, border: '1px solid var(--v2-rule)', fontSize: 14 }}>
          Nada na fila. Quando o designer entregar um criativo, a peça aparece aqui para revisão.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {itens.map(p => {
            const est = ROTULO[p._estado]
            const titulo = (p.headline || p.briefing || p.legenda || 'Peça sem título').slice(0, 90)
            const capa = (p.imagens || [])[0]
            const ehVideo = capa && /\.(mp4|mov|webm)(\?|$)/i.test(capa)
            return (
              <article key={p.id} style={{ display: 'flex', flexDirection: 'column', background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 14, overflow: 'hidden' }}>
                <button type="button" onClick={() => onAbrir(p)} aria-label={`Abrir ${titulo}`} style={{ display: 'block', width: '100%', aspectRatio: '4 / 5', maxHeight: 260, padding: 0, border: 'none', cursor: 'pointer', background: 'var(--v2-surface2)' }}>
                  {capa ? (ehVideo
                    ? <video src={capa} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <img src={capa} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)
                    : <span style={{ fontSize: 13, color: 'var(--v2-ink3)' }}>Sem mídia</span>}
                </button>
                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 999, color: est.cor, background: est.bg }}>{est.texto}</span>
                    {p._estado === 'nova' && p.filaProgramacaoDesde && <span style={{ fontSize: 12, color: 'var(--v2-ink3)' }}>entregue {haQuanto(p.filaProgramacaoDesde)}</span>}
                  </div>
                  <strong style={{ fontSize: 14, fontWeight: 600, color: 'var(--v2-ink)', lineHeight: 1.35 }}>{titulo}</strong>
                  <span style={{ fontSize: 13, color: 'var(--v2-ink2)' }}>{p.clienteNome || 'Cliente'}{p.formato ? ` · ${p.formato}` : ''}</span>
                  <span style={{ fontSize: 13, color: p.dataAgendada ? 'var(--v2-ink2)' : 'var(--v2-hot)' }}>{p.dataAgendada ? `Postagem sugerida: ${quandoPostar(p.dataAgendada)}` : 'Sem data de postagem'}</span>
                  {p.legenda && <p style={{ margin: 0, fontSize: 13, color: 'var(--v2-ink3)', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.legenda}</p>}

                  {ajuste?.id === p.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                      <label htmlFor={`ajuste-${p.id}`} style={{ fontSize: 12, color: 'var(--v2-ink3)' }}>O que o designer precisa mudar</label>
                      <textarea id={`ajuste-${p.id}`} autoFocus rows={3} value={ajuste.texto} onChange={e => setAjuste({ id: p.id, texto: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Escape') setAjuste(null) }}
                        style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface)', color: 'var(--v2-ink)', resize: 'vertical' }} />
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" disabled={agindo === p.id} onClick={pedirAjuste} style={btn(true)}>Pedir ajuste</button>
                        <button type="button" onClick={() => setAjuste(null)} style={btn()}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto', paddingTop: 6 }}>
                      {p._estado === 'nova' && <>
                        <button type="button" disabled={agindo === p.id} onClick={() => enviarAoCliente(p)} style={{ ...btn(true), cursor: agindo === p.id ? 'wait' : 'pointer' }}>Enviar ao cliente</button>
                        <button type="button" onClick={() => setAjuste({ id: p.id, texto: '' })} style={btn()}>Pedir ajuste ao designer</button>
                      </>}
                      {p._estado === 'nova_versao' && <button type="button" onClick={onIrSolicitacoes} style={btn(true)}>Revisar em Solicitações</button>}
                      <button type="button" onClick={() => onAbrir(p)} style={btn()}>Abrir</button>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
