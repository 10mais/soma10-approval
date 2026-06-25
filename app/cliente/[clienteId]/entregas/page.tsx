'use client'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import EntregasMarco, { Entregas } from '@/app/components/EntregasMarco'

type Marco = { id: string; titulo: string; descricao?: string; categoria: string; status: string; dataInicio: string; dataFim?: string }

const STATUS_LABEL: Record<string, string> = { planejado: 'Planejado', em_andamento: 'Em andamento', concluido: 'Concluído', atrasado: 'Atrasado', cancelado: 'Cancelado' }
const STATUS_COR: Record<string, string> = { planejado: '#9ca3af', em_andamento: '#ca8a04', concluido: '#16a34a', atrasado: '#dc2626', cancelado: '#aaa' }

function fmt(iso?: string) { return iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '' }

export default function EntregasPage() {
  const { clienteId } = useParams()
  const [marcos, setMarcos] = useState<Marco[]>([])
  const [entregas, setEntregas] = useState<Entregas>({ tarefas: [], posts: [], briefings: [] })
  const [cor, setCor] = useState('#16a34a')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/playbook?clienteId=${clienteId}`).then(r => r.json()).catch(() => []),
      fetch(`/api/playbook/entregas?clienteId=${clienteId}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/clientes?id=${clienteId}`).then(r => r.json()).catch(() => null),
    ]).then(([m, e, c]) => {
      setMarcos(Array.isArray(m) ? m : [])
      setEntregas(e && !e.error ? e : { tarefas: [], posts: [], briefings: [] })
      if (c && c.corPrimaria) setCor(c.corPrimaria)
      setCarregando(false)
    })
  }, [clienteId])

  const ordenados = [...marcos].sort((a, b) => new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime())

  // Progresso geral do cliente
  const totalItens = entregas.tarefas.length + entregas.posts.length
  const feitos = entregas.tarefas.filter(t => t.status === 'concluido').length + entregas.posts.filter(p => p.status === 'publicado').length
  const pctGeral = totalItens > 0 ? Math.round((feitos / totalItens) * 100) : 0

  if (carregando) return <div style={{ padding: 60, textAlign: 'center', color: '#aaa' }}>Carregando...</div>

  return (
    <div style={{ maxWidth: 820 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 18, color: '#111' }}>Entregas</h2>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#999' }}>Acompanhe a evolução do seu projeto — cada etapa e tudo o que está sendo entregue.</p>

      {/* Resumo geral */}
      {totalItens > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Progresso geral</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: cor }}>{pctGeral}%</span>
          </div>
          <div style={{ height: 10, borderRadius: 999, background: '#eee', overflow: 'hidden' }}>
            <div style={{ width: `${pctGeral}%`, height: '100%', background: cor, borderRadius: 999, transition: 'width .3s' }} />
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#888' }}>{feitos} de {totalItens} entregas concluídas · {marcos.length} etapa(s)</p>
        </div>
      )}

      {ordenados.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: '50px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <p style={{ margin: 0, fontSize: 14, color: '#888' }}>Ainda não há etapas cadastradas.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {ordenados.map((m, i) => (
            <div key={m.id} style={{ display: 'flex', gap: 14 }}>
              {/* Linha do tempo */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: STATUS_COR[m.status] || '#ccc', border: '2px solid #fff', boxShadow: '0 0 0 2px #eee', marginTop: 22 }} />
                {i < ordenados.length - 1 && <div style={{ flex: 1, width: 2, background: '#eee', marginTop: 4 }} />}
              </div>
              {/* Card da etapa */}
              <div style={{ flex: 1, background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{m.titulo}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COR[m.status] || '#888', background: `${STATUS_COR[m.status] || '#888'}1a`, borderRadius: 999, padding: '3px 10px' }}>{STATUS_LABEL[m.status] || m.status}</span>
                </div>
                <p style={{ margin: '0 0 12px', fontSize: 12, color: '#aaa' }}>{fmt(m.dataInicio)}{m.dataFim ? ` — ${fmt(m.dataFim)}` : ''}</p>
                {m.descricao && <p style={{ margin: '0 0 12px', fontSize: 13, color: '#555', lineHeight: 1.5 }}>{m.descricao}</p>}
                <EntregasMarco marcoId={m.id} entregas={entregas} cor={cor} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
