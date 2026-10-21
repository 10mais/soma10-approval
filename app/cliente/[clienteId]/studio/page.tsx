'use client'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import StudioMes from '@/app/components/StudioMes'
import { usePermissoes } from '@/app/components/usePermissoes'

// Studio (pautas do mês) DESTE cliente — o mesmo motor da tela geral, preso ao cliente.

export default function StudioDoCliente() {
  const { clienteId } = useParams() as { clienteId: string }
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const { pode, podeAcao, podeExcluir } = usePermissoes()
  const [clientes, setClientes] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<{ nome: string; email: string }[]>([])

  useEffect(() => {
    fetch('/api/clientes').then(r => r.json()).then(d => setClientes(Array.isArray(d) ? d : [])).catch(() => {})
    // /api/equipe: o roster seguro que todo papel da equipe lê (/api/usuarios é só admin/gerente).
    fetch('/api/equipe').then(r => r.json()).then(d => setUsuarios(Array.isArray(d) ? d.filter((u: any) => u.role !== 'cliente').map((u: any) => ({ nome: u.nome, email: u.email })) : [])).catch(() => {})
  }, [])

  if (role === 'cliente') return <p style={{ color: 'var(--v2-ink3)', fontSize: 13 }}>Esta página é da equipe.</p>
  if (!clientes.length) return <p style={{ color: 'var(--v2-ink3)', fontSize: 13 }}>Carregando…</p>
  // Mesma matriz do painel: antes só o admin excluía pauta aqui (dono, 21/10/2026, caso Ana).
  return <StudioMes clientes={clientes} clienteFixo={clienteId} usuariosEquipe={usuarios} meuEmail={(session?.user as any)?.email || ''}
    podeEditar={pode('producao', 'editar')} podeExcluir={podeExcluir('producao')} podeGerarIA={podeAcao('gerar_ia')} podeEnviarCliente={podeAcao('enviar_cliente')} />
}
