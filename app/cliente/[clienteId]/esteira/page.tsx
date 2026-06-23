'use client'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Esteira from '@/app/components/Esteira'

export default function EsteiraPage() {
  const { clienteId } = useParams()
  const [clientes, setClientes] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/clientes').then(r => r.json()).then(d => setClientes(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  return <Esteira clientes={clientes} clienteFixo={clienteId as string} />
}
