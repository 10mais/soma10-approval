'use client'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import StudioMes from '@/app/components/StudioMes'

// Studio (pautas do mês) DESTE cliente — o mesmo motor da tela geral, preso ao cliente.

export default function StudioDoCliente() {
  const { clienteId } = useParams() as { clienteId: string }
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const [clientes, setClientes] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<{ nome: string; email: string }[]>([])

  useEffect(() => {
    fetch('/api/clientes').then(r => r.json()).then(d => setClientes(Array.isArray(d) ? d : [])).catch(() => {})
    fetch('/api/usuarios').then(r => r.json()).then(d => setUsuarios(Array.isArray(d) ? d.filter((u: any) => u.role !== 'cliente').map((u: any) => ({ nome: u.nome, email: u.email })) : [])).catch(() => {})
  }, [])

  if (role === 'cliente') return <p style={{ color: 'var(--v2-ink3)', fontSize: 13 }}>Esta página é da equipe.</p>
  if (!clientes.length) return <p style={{ color: 'var(--v2-ink3)', fontSize: 13 }}>Carregando…</p>
  return <StudioMes clientes={clientes} clienteFixo={clienteId} usuariosEquipe={usuarios} meuEmail={(session?.user as any)?.email || ''} podeExcluir={role === 'admin'} />
}
