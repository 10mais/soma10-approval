'use client'
// APROVAÇÕES no portal do cliente.
//
// FASE 1 da rodada de ajuste (dono, 29/09: "um único formulário de pedido no link e no
// portal"): esta tela mostra os MESMOS componentes do link público — o cartão do criativo (arte
// grande, pontos marcados em cada lâmina, legenda, data, reprovar de verdade) e a tabela de
// copies — e decide pela MESMA rota (/api/decision), com a sessão no lugar do token. Antes o
// portal tinha outro formulário (sem marcar pontos na arte; o "Rejeitar" virava ajuste com
// "REJEITADO:" no texto) e outra rota, sem aplicar sozinho o ajuste só de legenda/data.
// A equipe também decide por aqui, em nome do cliente (fica registrado "pela equipe").
import { useT } from '@/app/components/Idioma'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'
import { podeNivel } from '@/lib/permissoesCatalogo'
import { podeAcaoGranular } from '@/lib/permissoesGranular'
import { ordenarPorDataDePostagem } from '@/lib/ordemAprovacao'
import { esperandoCliente } from '@/lib/bolaDaVez'
import CartaoCriativo from '@/app/components/aprovacao/CartaoCriativo'
import TabelaCopies from '@/app/components/aprovacao/TabelaCopies'
import { postarDecisao, paraCartaoAprovacao as paraCartao, type PostA, type CorpoDecisao } from '@/app/components/aprovacao/comum'

// Retorna { texto, atrasado } da espera em aprovacao (SLA 24h)
function tempoEspera(aguardandoDesde?: string): { texto: string; atrasado: boolean } | null {
  if (!aguardandoDesde) return null
  const ms = Date.now() - new Date(aguardandoDesde).getTime()
  if (ms < 0) return null
  const horas = Math.floor(ms / (60 * 60 * 1000))
  const atrasado = horas >= 24
  const texto = horas < 1 ? 'há poucos minutos' : horas < 24 ? `há ${horas}h` : `há ${Math.floor(horas / 24)} dia(s)`
  return { texto, atrasado }
}

export default function AprovacoesPagina() {
  const tr = useT()
  const { clienteId } = useParams()
  const { data: session } = useSession()
  const [posts, setPosts] = useState<any[]>([])
  const [cliente, setCliente] = useState<any>(null)
  const [enviando, setEnviando] = useState<string | null>(null)
  const [aprovandoTodos, setAprovandoTodos] = useState(false)
  // Config de permissao (papel + granular) para saber se a equipe pode EXCLUIR material.
  const [permPapel, setPermPapel] = useState<Record<string, any>>({})
  const [permGranular, setPermGranular] = useState<Record<string, any>>({})

  function carregar() {
    fetch(`/api/posts?clienteId=${clienteId}`).then(r => r.json()).then(d => setPosts(Array.isArray(d) ? d : [])).catch(() => {})
  }
  useEffect(() => {
    // Troca de cliente: nunca mostrar material do anterior.
    setPosts([]); setCliente(null)
    carregar()
    fetch(`/api/clientes?id=${clienteId}`).then(r => r.json()).then(c => { if (c && !c.error && c.id === clienteId) setCliente(c) }).catch(() => {})
  }, [clienteId])

  const role = (session?.user as any)?.role || ''
  // Permissão de aprovar (Configurações › Clientes): só restringe o próprio cliente; a equipe
  // segue a matriz dela (conferida no servidor).
  const permAprovar = role !== 'cliente' || cliente?.permissoes?.aprovar !== false

  // Só a equipe exclui material — o cliente nem vê o botão (a rota já barraria com 403).
  useEffect(() => {
    if (!role || role === 'cliente') return
    fetch('/api/permissoes-papel').then(r => r.json()).then(d => { if (d && !d.error) setPermPapel(d) }).catch(() => {})
    fetch('/api/permissoes-granular').then(r => r.json()).then(d => { if (d && !d.error) setPermGranular(d) }).catch(() => {})
  }, [role])

  // Mesma regra da rota DELETE /api/posts: matriz do papel + ação granular "excluir".
  const podeExcluir = !!role && role !== 'cliente'
    && podeNivel(role, 'producao', 'excluir', (session?.user as any)?.permissoes, permPapel as any)
    && podeAcaoGranular(role, 'excluir', (session?.user as any)?.permissoesGranular, permGranular as any)

  async function excluirPost(p: { id: string; legenda?: string }) {
    const nome = (p.legenda || '').trim().slice(0, 60)
    const ok = await confirmar(
      tr('portal.dlg-excluir', { nome: nome ? `"${nome}${(p.legenda || '').length > 60 ? '…' : ''}"` : tr('portal.este-material') }),
      { titulo: tr('portal.excluir-material'), okLabel: tr('comum.excluir'), cancelLabel: tr('comum.cancelar'), perigo: true },
    )
    if (!ok) return
    setEnviando(p.id)
    const r = await fetch(`/api/posts?id=${p.id}`, { method: 'DELETE' }).then(x => x.json()).catch(() => ({ error: tr('dash.erro-conexao') }))
    setEnviando(null)
    if (r?.error) { toast(r.error, 'erro'); return }
    setPosts(lista => lista.filter(x => x.id !== p.id))
    toast(tr('portal.material-excluido'), 'sucesso')
  }

  // O MESMO conjunto e a mesma ordem do link público (/api/aprovacao-link): o que espera o
  // cliente (lib/bolaDaVez) + o que está em ajuste; postagem mais próxima primeiro.
  const pendentes = ordenarPorDataDePostagem(posts.filter(p => !p.excluidoEm && (esperandoCliente(p) || p.status === 'corrigir')))
  // "aguardando" = os que precisam da decisão do cliente; em ajuste/reprovado estão com a agência.
  const aguardando = pendentes.filter(p => p.status !== 'corrigir' && p.status !== 'reprovado')
  // espera mais antiga (para o banner "o que está esperando você")
  const maisAntiga = aguardando.reduce<string | undefined>((min, p) => (p.aguardandoDesde && (!min || p.aguardandoDesde < min)) ? p.aguardandoDesde : min, undefined)

  // A decisão sai pela rota única, com a sessão (o link usa a mesma rota com o token).
  const enviarPeloPortal = (corpo: CorpoDecisao) => postarDecisao(corpo)

  async function aprovarTodos() {
    if (!(await confirmar(tr('portal.dlg-aprovar-lote', { n: aguardando.length }), { titulo: tr('portal.aprovar-lote'), okLabel: tr('portal.aprovar-todos') }))) return
    setAprovandoTodos(true)
    const semData: string[] = []
    const falhas: string[] = []
    for (const p of aguardando) {
      // Criativo sem data seria publicado na hora: em lote isso não sai sem alguém olhar um a um.
      if (p.etapa !== 'aprovacao_copy' && !p.dataAgendada) { semData.push((p.legenda || p.id).slice(0, 30)); continue }
      const r = await postarDecisao({ id: p.id, type: 'approved' })
      if (!r?.ok) falhas.push(r?.error || (p.legenda || p.id).slice(0, 30))
    }
    setAprovandoTodos(false)
    carregar()
    if (semData.length) toast(`Estes criativos ainda não têm data e ficaram de fora do lote (aprove um a um ou peça a data à equipe): ${semData.join(', ')}`, 'erro')
    else if (falhas.length) toast(`Não foi possível aprovar: ${falhas.join(' · ')}`, 'erro')
  }

  const copies = pendentes.filter(p => p.etapa === 'aprovacao_copy').map(paraCartao)
  const criativos = pendentes.filter(p => p.etapa !== 'aprovacao_copy').map(paraCartao)
  const handle = String(cliente?.instagram || cliente?.nome || pendentes[0]?.clienteNome || 'perfil').replace(/^@/, '')
  const botaoExcluir = (p: PostA) => podeExcluir ? (
    <button onClick={() => excluirPost(p)} disabled={enviando === p.id} title={tr('portal.excluir-material')}
      style={{ background: 'none', border: 'none', padding: 0, color: 'var(--v2-ink3)', fontSize: 12, fontWeight: 600, cursor: enviando === p.id ? 'default' : 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
      {tr('portal.excluir-material')}
    </button>
  ) : null

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', fontSize: 18, color: 'var(--v2-ink)' }}>{tr('dash.aprovacoes')}</h2>

      {/* O que está esperando você */}
      {aguardando.length > 0 && (() => { const e = tempoEspera(maisAntiga); const urgente = e?.atrasado; return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: urgente ? 'var(--v2-hot-bg)' : 'var(--v2-amber-bg)', border: `1.5px solid ${urgente ? 'var(--v2-hot-bg)' : 'var(--v2-amber-bg)'}`, borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: urgente ? 'var(--v2-hot)' : 'var(--v2-amber)' }}>
              {aguardando.length} {aguardando.length === 1 ? 'item aguardando' : 'itens aguardando'} a sua aprovação{e ? ` — o mais antigo ${e.texto}` : ''}.
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: urgente ? 'var(--v2-hot)' : 'var(--v2-amber)', opacity: 0.85 }}>{tr('portal.aprovar-rapido-mantem-ritmo-su')}</p>
          </div>
          {permAprovar && aguardando.length > 1 && (
            <button onClick={aprovarTodos} disabled={aprovandoTodos}
              style={{ padding: '10px 20px', background: 'var(--v2-ok)', color: 'var(--v2-surface)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: aprovandoTodos ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
              {aprovandoTodos ? tr('portal.aprovando') : tr('portal.aprovar-todos-n', { n: aguardando.length })}
            </button>
          )}
        </div>
      ) })()}

      {pendentes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--v2-ink3)', background: 'var(--v2-surface)', borderRadius: 14, border: '1px solid var(--v2-rule)' }}>
          <p>{tr('dash.nenhuma-pendencia-aprovacao-mo')}</p>
        </div>
      ) : (
        <div style={{ maxWidth: 760 }}>
          {copies.length > 0 && (
            <TabelaCopies posts={copies} enviar={enviarPeloPortal} onDecidido={() => carregar()} somenteLeitura={!permAprovar} extra={podeExcluir ? botaoExcluir : undefined}
              corMarca={cliente?.corPrimaria} fotoUrl={`/api/foto-cliente?clienteId=${encodeURIComponent(String(clienteId))}`} />
          )}
          {criativos.map(p => (
            <CartaoCriativo key={p.id} post={p} handle={handle}
              fotoUrl={`/api/foto-cliente?clienteId=${encodeURIComponent(String(clienteId))}`}
              enviar={enviarPeloPortal} onDecidido={() => carregar()} somenteLeitura={!permAprovar} extra={botaoExcluir(p)} />
          ))}
        </div>
      )}
    </div>
  )
}
