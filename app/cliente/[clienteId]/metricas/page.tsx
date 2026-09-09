'use client'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import MetricasAds from '@/app/components/MetricasAds'

// MÉTRICAS do cliente (mídia paga) — menu abaixo de Analytics, como o dono pediu (09/09/2026).
// O cliente VÊ (inclusive o investimento); só a equipe cadastra e lança números.
export default function MetricasPage() {
  const { clienteId } = useParams()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const [nome, setNome] = useState('')

  useEffect(() => {
    fetch(`/api/clientes?id=${clienteId}`).then(r => r.ok ? r.json() : null)
      .then(c => { const cli = Array.isArray(c) ? c.find((x: any) => x.id === clienteId) : c; if (cli?.nome) setNome(cli.nome) })
      .catch(() => {})
  }, [clienteId])

  return (
    <MetricasAds
      clienteId={String(clienteId)}
      clienteNome={nome}
      podeEditar={!!role && role !== 'cliente'}
    />
  )
}
