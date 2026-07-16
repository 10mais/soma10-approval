'use client'

export type Entregas = {
  tarefas: { id: string; marcoId: string; titulo: string; status: string; tipo?: string; responsavelNome?: string; prazo?: string }[]
  posts: { id: string; marcoId: string; legenda: string; status: string; formato?: string; dataAgendada?: string; thumbnail?: string }[]
  briefings: { id: string; marcoId: string; titulo: string; objetivo?: string }[]
}

const TAREFA_LABEL: Record<string, string> = { a_fazer: 'A fazer', em_andamento: 'Em andamento', em_revisao: 'Em revisao', concluido: 'Concluido' }
const TAREFA_COR: Record<string, string> = { a_fazer: '#9ca3af', em_andamento: '#ca8a04', em_revisao: '#2563eb', concluido: '#16a34a' }
const POST_LABEL: Record<string, string> = { rascunho: 'Rascunho', agendado: 'Agendado', aguardando_aprovacao: 'Aguardando aprovação', aprovado: 'Aprovado', publicado: 'Publicado', falha_publicacao: 'Falha', corrigir: 'Corrigir', reprovado: 'Reprovado' }
const POST_COR: Record<string, string> = { rascunho: '#9ca3af', agendado: '#ca8a04', publicado: '#16a34a', falha_publicacao: '#dc2626', aguardando_aprovacao: '#2563eb', aprovado: '#16a34a' }

function chip(label: string, cor: string) {
  return <span style={{ fontSize: 10, fontWeight: 700, color: cor, background: `${cor}1a`, borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>{label}</span>
}

export default function EntregasMarco({ marcoId, entregas, cor = '#16a34a', ocultarTarefas = false }: { marcoId: string; entregas: Entregas; cor?: string; ocultarTarefas?: boolean }) {
  // ocultarTarefas: view do cliente — esconde as tarefas internas (trabalho da
  // equipe, com responsáveis) e conta o progresso só pelos posts/campanhas.
  const tarefas = ocultarTarefas ? [] : entregas.tarefas.filter(t => t.marcoId === marcoId)
  const posts = entregas.posts.filter(p => p.marcoId === marcoId)
  const briefings = entregas.briefings.filter(b => b.marcoId === marcoId)

  const total = tarefas.length + posts.length
  const done = tarefas.filter(t => t.status === 'concluido').length + posts.filter(p => p.status === 'publicado').length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const vazio = tarefas.length === 0 && posts.length === 0 && briefings.length === 0

  return (
    <div>
      {/* Barra de progresso da entrega */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, height: 8, borderRadius: 999, background: '#eee', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: cor, borderRadius: 999, transition: 'width .3s' }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color: cor, minWidth: 38, textAlign: 'right' }}>{pct}%</span>
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 11, color: '#888' }}>
        {done} de {total} entregue{total === 1 ? '' : 's'}{briefings.length > 0 ? ` · ${briefings.length} campanha(s)` : ''}
      </p>

      {vazio && <p style={{ margin: 0, fontSize: 12, color: '#bbb' }}>Nenhuma entrega vinculada a esta etapa ainda.</p>}

      {tarefas.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: 0.4 }}>Tarefas ({tarefas.length})</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {tarefas.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#fafafa', borderRadius: 8 }}>
                <span style={{ flex: 1, fontSize: 12, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titulo}</span>
                {t.responsavelNome && <span style={{ fontSize: 10, color: '#aaa' }}>{t.responsavelNome}</span>}
                {chip(TAREFA_LABEL[t.status] || t.status, TAREFA_COR[t.status] || '#888')}
              </div>
            ))}
          </div>
        </div>
      )}

      {posts.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: 0.4 }}>Posts ({posts.length})</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {posts.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#fafafa', borderRadius: 8 }}>
                {p.thumbnail ? <img src={p.thumbnail} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: 28, height: 28, borderRadius: 6, background: '#eee', flexShrink: 0 }} />}
                <span style={{ flex: 1, fontSize: 12, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.legenda || '(sem legenda)'}</span>
                {chip(POST_LABEL[p.status] || p.status, POST_COR[p.status] || '#888')}
              </div>
            ))}
          </div>
        </div>
      )}

      {briefings.length > 0 && (
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: 0.4 }}>Campanhas ({briefings.length})</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {briefings.map(b => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#fafafa', borderRadius: 8 }}>
                <span style={{ flex: 1, fontSize: 12, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.titulo}</span>
                {b.objetivo && chip(b.objetivo, '#7c3aed')}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
