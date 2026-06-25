'use client'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Playbook from '@/app/components/Playbook'

export default function PlaybookPage() {
  const { clienteId } = useParams()
  const [clientes, setClientes] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/clientes').then(r => r.json()).then(d => setClientes(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  return <Playbook clientes={clientes.filter(c => c.id === clienteId)} clienteFixo={clienteId as string} />
}
