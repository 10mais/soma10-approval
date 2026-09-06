'use client'
import { useParams, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import GestaoTarefas from '@/app/components/GestaoTarefas'

// Tarefas DESTE cliente (hub). O componente é o mesmo da tela geral, preso ao
// cliente: filtro fixo, seletor escondido e tarefa nova já nasce atribuída.

export default function TarefasDoCliente() {
  const { clienteId } = useParams() as { clienteId: string }
  const busca = useSearchParams()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const [clientes, setClientes] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [abrir, setAbrir] = useState<string | null>(busca.get('abrir'))

  useEffect(() => {
    fetch('/api/clientes').then(r => r.json()).then(d => setClientes(Array.isArray(d) ? d : [])).catch(() => {})
    fetch('/api/usuarios').then(r => r.json()).then(d => setUsuarios(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  if (role === 'cliente') return <p style={{ color: 'var(--v2-ink3)', fontSize: 13 }}>Esta página é da equipe.</p>
  const daqui = clientes.filter(c => c.id === clienteId)
  return <GestaoTarefas clientes={daqui} usuarios={usuarios} clienteFixo={clienteId} abrirTarefaId={abrir} onAbriuTarefa={() => setAbrir(null)} podeEditar podeExcluir={role === 'admin'} />
}
