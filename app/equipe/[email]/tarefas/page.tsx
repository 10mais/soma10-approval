'use client'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import GestaoTarefas from '@/app/components/GestaoTarefas'

// Quadro de tarefas DESTA pessoa: o mesmo componente da tela geral, preso ao
// responsável (filtro fixo, seletor escondido, tarefa nova já nasce com ela).

export default function TarefasDaPessoa() {
  const params = useParams() as { email: string }
  const router = useRouter()
  const { data: session, status } = useSession()
  const role = (session?.user as any)?.role
  const meuEmail = String((session?.user as any)?.email || '').toLowerCase()
  const seg = decodeURIComponent(params.email || '').toLowerCase()
  const email = seg === 'me' ? meuEmail : seg
  const [clientes, setClientes] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])

  useEffect(() => {
    if (status !== 'authenticated') return
    if (role !== 'admin' && email !== meuEmail) { router.replace(`/equipe/${encodeURIComponent(meuEmail)}/tarefas`); return }
    fetch('/api/clientes').then(r => r.json()).then(d => setClientes(Array.isArray(d) ? d : [])).catch(() => {})
    fetch('/api/equipe').then(r => r.json()).then(d => setUsuarios(Array.isArray(d) ? d : [])).catch(() => {})
  }, [status, role, email, meuEmail, router])

  if (status !== 'authenticated' || !email) return <p style={{ color: 'var(--v2-ink3)', fontSize: 13 }}>Carregando…</p>
  return <GestaoTarefas clientes={clientes} usuarios={usuarios} responsavelFixo={email} podeEditar podeExcluir={role === 'admin'} />
}
