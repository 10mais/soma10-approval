'use client'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { isViewAsClient } from '@/lib/modoCliente'
import Playbook from '@/app/components/Playbook'
import { usePermissoes } from '@/app/components/usePermissoes'

export default function PlaybookPage() {
  const { clienteId } = useParams()
  const { ehEquipe: daEquipe, pode, podeExcluir } = usePermissoes()
  const [clientes, setClientes] = useState<any[]>([])
  const [viewAs, setViewAs] = useState(false)
  useEffect(() => { setViewAs(isViewAsClient()) }, [])
  // Cliente (ou equipe em "visualizar como cliente") ve o Playbook em modo leitura. Na equipe,
  // editar e excluir seguem a matriz (Estratégia), como no painel.
  const ehEquipe = daEquipe && !viewAs

  useEffect(() => {
    fetch('/api/clientes').then(r => r.json()).then(d => setClientes(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  return <Playbook clientes={clientes.filter(c => c.id === clienteId)} clienteFixo={clienteId as string} somenteLeitura={!ehEquipe || !pode('estrategia', 'editar')} podeEditar={pode('estrategia', 'editar')} podeExcluir={podeExcluir('estrategia')} />
}
