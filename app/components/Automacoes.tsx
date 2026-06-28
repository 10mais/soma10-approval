'use client'
import { useEffect, useState } from 'react'

type Automacoes = { postAprovadoCriaTarefa?: boolean; etapaConcluidaNotifica?: boolean; clienteNovoNotifica?: boolean }

const REGRAS: { chave: keyof Automacoes; titulo: string; descricao: string }[] = [
  { chave: 'postAprovadoCriaTarefa', titulo: 'Post aprovado → cria tarefa', descricao: 'Quando o cliente aprovar um post, cria automaticamente uma tarefa de publicação (prioridade alta) para a equipe.' },
  { chave: 'etapaConcluidaNotifica', titulo: 'Etapa concluída → notifica a equipe', descricao: 'Quando uma etapa do Playbook for marcada como concluída, a equipe recebe uma notificação.' },
  { chave: 'clienteNovoNotifica', titulo: 'Cliente novo → notifica a equipe', descricao: 'Quando um novo cliente for cadastrado, a equipe recebe uma notificação.' },
]

export default function Automacoes() {
  const [aut, setAut] = useState<Automacoes>({})
  const [salvando, setSalvando] = useState<string | null>(null)

  useEffect(() => { fetch('/api/automacoes').then(r => r.json()).then(d => { if (d && !d.error) setAut(d) }).catch(() => {}) }, [])

  async function alternar(chave: keyof Automacoes) {
    const novo = { ...aut, [chave]: !aut[chave] }
    setAut(novo); setSalvando(chave)
    await fetch('/api/automacoes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [chave]: novo[chave] }) }).catch(() => {})
    setSalvando(null)
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Automações</h2>
      <p style={{ margin: '4px 0 20px', fontSize: 13, color: '#999' }}>Regras automáticas (gatilho → ação). Ative as que fizerem sentido para o seu fluxo.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {REGRAS.map(r => {
          const ativo = !!aut[r.chave]
          return (
            <div key={r.chave} style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111' }}>{r.titulo}</p>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#888', lineHeight: 1.5 }}>{r.descricao}</p>
              </div>
              <button onClick={() => alternar(r.chave)} disabled={salvando === r.chave} aria-label={ativo ? 'Desativar' : 'Ativar'}
                style={{ flexShrink: 0, width: 46, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer', background: ativo ? '#16a34a' : '#e0e0e0', position: 'relative', transition: 'background .2s' }}>
                <span style={{ position: 'absolute', top: 3, left: ativo ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left .2s' }} />
              </button>
            </div>
          )
        })}
      </div>

      <p style={{ margin: '16px 0 0', fontSize: 11.5, color: '#bbb' }}>Mais automações virão (ex.: prazo próximo, etapa atrasada). Me avise quais regras quer adicionar.</p>
    </div>
  )
}
