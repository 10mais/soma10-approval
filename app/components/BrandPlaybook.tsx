'use client'
import { useEffect, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'

// Playbook operacional da marca (camada de conhecimento IA-First, por cliente).
// Humano cura as regras; a IA pode DESTILAR um rascunho do contexto da marca —
// mas o rascunho SEMPRE passa por aprovacao humana antes de virar oficial.

type Playbook = {
  posicionamento?: string; padraoCopy?: string; criativosQueFuncionam?: string
  fazer?: string; naoFazer?: string; restricoes?: string; observacoes?: string
  aprovado?: boolean; origemUltimaEdicao?: 'manual' | 'ia'; atualizadoEm?: string; atualizadoPor?: string
}

const CAMPOS: { key: keyof Playbook; label: string; ph: string }[] = [
  { key: 'posicionamento', label: 'Posicionamento', ph: 'Promessa central / como a marca se posiciona.' },
  { key: 'padraoCopy', label: 'Padrão de copy', ph: 'Estrutura que funciona: gancho, corpo, CTA, tamanho, emojis, hashtags.' },
  { key: 'criativosQueFuncionam', label: 'Criativos que funcionam', ph: 'Formatos/criativos que performam (carrossel, reels, antes/depois...).' },
  { key: 'fazer', label: "Fazer (do's)", ph: '- Sempre...\n- Sempre...' },
  { key: 'naoFazer', label: "Não fazer (don'ts)", ph: '- Nunca...\n- Nunca...' },
  { key: 'restricoes', label: 'Restrições', ph: 'Restrições legais, de marca e compliance.' },
  { key: 'observacoes', label: 'Observações', ph: 'Outras notas úteis para a produção.' },
]

export default function PlaybookBotao({ clienteId, clienteNome }: { clienteId: string; clienteNome?: string }) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button onClick={() => setAberto(true)}
        style={{ padding: '10px 20px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
        Playbook da marca
      </button>
      {aberto && <PlaybookModal clienteId={clienteId} clienteNome={clienteNome} onClose={() => setAberto(false)} />}
    </>
  )
}

function PlaybookModal({ clienteId, clienteNome, onClose }: { clienteId: string; clienteNome?: string; onClose: () => void }) {
  const [pb, setPb] = useState<Playbook>({})
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [destilando, setDestilando] = useState(false)
  const [ehRascunhoIA, setEhRascunhoIA] = useState(false)

  useEffect(() => {
    fetch(`/api/brand/playbook?clienteId=${clienteId}`).then(r => r.json()).then(d => {
      if (d?.playbook) setPb(d.playbook)
    }).catch(() => {}).finally(() => setCarregando(false))
  }, [clienteId])

  const set = (k: keyof Playbook, v: string) => setPb(p => ({ ...p, [k]: v }))

  async function destilar() {
    if (!(await confirmar('A IA vai analisar o Brand Board e propor um rascunho de Playbook (consome créditos). Você revisa e aprova antes de salvar. Continuar?', { titulo: 'Destilar com IA', okLabel: 'Destilar' }))) return
    setDestilando(true)
    const r = await fetch('/api/brand/playbook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId }) }).then(x => x.json()).catch(() => null)
    setDestilando(false)
    if (!r?.ok) { toast(r?.error || 'Falha ao destilar.', 'erro'); return }
    setPb(p => ({ ...r.rascunho, atualizadoEm: p.atualizadoEm, atualizadoPor: p.atualizadoPor }))
    setEhRascunhoIA(true)
    toast('Rascunho gerado pela IA. Revise e aprove antes de salvar.', 'info')
  }

  async function salvar(aprovar: boolean) {
    setSalvando(true)
    const body = { clienteId, playbook: { ...pb, aprovado: aprovar, origemUltimaEdicao: ehRascunhoIA ? 'ia' : 'manual' } }
    const r = await fetch('/api/brand/playbook', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (!r?.ok) { toast(r?.error || 'Falha ao salvar.', 'erro'); return }
    toast(aprovar ? 'Playbook aprovado e salvo.' : 'Rascunho salvo.', 'sucesso')
    onClose()
  }

  const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 5 }
  const ta: React.CSSProperties = { width: '100%', padding: '9px 11px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', minHeight: 64, resize: 'vertical', lineHeight: 1.5 }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 640, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: '#111' }}>Playbook da marca{clienteNome ? ` · ${clienteNome}` : ''}</h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>Regras de operação que os agentes de IA seguem ao produzir para este cliente.</p>
          </div>
          {pb.aprovado && !ehRascunhoIA && <span style={{ fontSize: 10.5, fontWeight: 800, color: '#166534', background: '#dcfce7', borderRadius: 999, padding: '3px 10px', flexShrink: 0 }}>Aprovado</span>}
        </div>

        {ehRascunhoIA && (
          <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: '10px 12px', margin: '10px 0', fontSize: 12.5, color: '#6b21a8' }}>
            <b>Rascunho da IA.</b> Revise cada campo, ajuste com seu conhecimento real da marca e clique em <b>Aprovar e salvar</b> — nada vira oficial sem sua aprovação.
          </div>
        )}

        {carregando ? <p style={{ color: '#aaa', fontSize: 13 }}>Carregando...</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            {CAMPOS.map(f => (
              <div key={f.key}>
                <label style={label}>{f.label}</label>
                <textarea value={(pb[f.key] as string) || ''} onChange={e => set(f.key, e.target.value)} placeholder={f.ph} style={ta} />
              </div>
            ))}
            {pb.atualizadoEm && (
              <p style={{ margin: 0, fontSize: 11, color: '#bbb' }}>
                Última edição: {new Date(pb.atualizadoEm).toLocaleString('pt-BR')}{pb.atualizadoPor ? ` por ${pb.atualizadoPor}` : ''}{pb.origemUltimaEdicao === 'ia' ? ' (rascunho de IA)' : ''}
              </p>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
          <button onClick={destilar} disabled={destilando || carregando}
            style={{ padding: '11px 16px', background: '#fff', color: '#7c3aed', border: '1.5px solid #d8b4fe', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: destilando ? 'wait' : 'pointer' }}>
            {destilando ? 'Destilando...' : 'Destilar com IA'}
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={() => salvar(false)} disabled={salvando || carregando}
            style={{ padding: '11px 16px', background: '#f0f0f0', color: '#555', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Salvar rascunho
          </button>
          <button onClick={() => salvar(true)} disabled={salvando || carregando}
            style={{ padding: '11px 18px', background: 'var(--marca, #ffc00f)', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
            {salvando ? 'Salvando...' : 'Aprovar e salvar'}
          </button>
          <button onClick={onClose} style={{ padding: '11px 16px', background: '#fff', color: '#666', border: '1px solid #e0e0e0', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Fechar</button>
        </div>
      </div>
    </div>
  )
}
