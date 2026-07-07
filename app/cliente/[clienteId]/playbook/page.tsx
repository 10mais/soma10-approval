'use client'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { isViewAsClient } from '@/lib/modoCliente'
import Playbook from '@/app/components/Playbook'

export default function PlaybookPage() {
  const { clienteId } = useParams()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const [clientes, setClientes] = useState<any[]>([])
  const [viewAs, setViewAs] = useState(false)
  useEffect(() => { setViewAs(isViewAsClient()) }, [])
  // Cliente (ou equipe em "visualizar como cliente") ve o Playbook em modo leitura.
  const ehEquipe = (role === 'admin' || role === 'gerente') && !viewAs

  useEffect(() => {
    fetch('/api/clientes').then(r => r.json()).then(d => setClientes(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  return <Playbook clientes={clientes.filter(c => c.id === clienteId)} clienteFixo={clienteId as string} somenteLeitura={!ehEquipe} />
}
