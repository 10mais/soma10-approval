'use client'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function ClienteHome() {
  const { clienteId } = useParams()
  const [cliente, setCliente] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    fetch(`/api/clientes?id=${clienteId}`).then(r => r.json()).then(d => {
      if (d && !d.error) setCliente(Array.isArray(d) ? d.find((x: any) => x.id === clienteId) : d)
    }).catch(() => {})
    fetch(`/api/posts?clienteId=${clienteId}`).then(r => r.json()).then(posts => {
      if (!Array.isArray(posts)) return
      const agora = new Date()
      const mes = agora.getMonth(), ano = agora.getFullYear()
      const doMes = posts.filter((p: any) => {
        const d = new Date(p.dataAgendada || p.atualizadoEm || p.criadoEm)
        return d.getMonth() === mes && d.getFullYear() === ano && (p.status === 'publicado' || p.status === 'agendado')
      })
      const pendentes = posts.filter((p: any) => p.etapa === 'aprovacao_copy' || p.etapa === 'aprovacao_criativo')
      setStats({ total: posts.length, mes: doMes.length, pendentes: pendentes.length })
    })
  }, [clienteId])

  if (!cliente) return <div style={{ padding: 60, textAlign: 'center', color: '#aaa' }}>Carregando...</div>

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', fontSize: 20, color: '#111' }}>Bem-vindo, {cliente.nome}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Posts no mês', valor: stats?.mes ?? 0, cor: '#16a34a' },
          { label: 'Pendências de aprovação', valor: stats?.pendentes ?? 0, cor: stats?.pendentes > 0 ? '#b91c1c' : '#16a34a' },
          { label: 'Total de posts', valor: stats?.total ?? 0, cor: '#111' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#888' }}>{k.label}</p>
            <p style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 800, color: k.cor }}>{k.valor}</p>
          </div>
        ))}
      </div>
      {cliente.segmento && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 15, color: '#111' }}>Sobre o projeto</h3>
          <p style={{ margin: '0 0 4px', fontSize: 13, color: '#555' }}><strong>Segmento:</strong> {cliente.segmento}</p>
          {cliente.descricao && <p style={{ margin: '0 0 4px', fontSize: 13, color: '#555' }}><strong>Descricao:</strong> {cliente.descricao}</p>}
          {cliente.publicoAlvo && <p style={{ margin: 0, fontSize: 13, color: '#555' }}><strong>Publico-alvo:</strong> {cliente.publicoAlvo}</p>}
        </div>
      )}
    </div>
  )
}
