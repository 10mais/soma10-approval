'use client'
import { useEffect, useState } from 'react'

// Nome do sistema perfil-aware para telas CLIENT (login, portal, páginas públicas).
// Busca /api/marca uma vez e renderiza o nome (Soma10 App/Clinic/Agency).
// Enquanto carrega mostra o fallback neutro para não piscar nome errado.
export default function SystemName({ fallback = 'Soma10' }: { fallback?: string }) {
  const [nome, setNome] = useState(fallback)
  useEffect(() => {
    fetch('/api/marca').then(r => r.json()).then(d => { if (d?.nome) setNome(d.nome) }).catch(() => {})
  }, [])
  return <>{nome}</>
}
