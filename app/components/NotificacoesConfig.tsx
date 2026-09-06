'use client'
import { useEffect, useState } from 'react'
import { NOTIF_TIPOS, NOTIF_OBRIGATORIOS } from '@/lib/notificacoesCatalogo'

// modo 'admin' = liga/desliga tipos p/ TODO o sistema (config:notificacoes.desabilitados)
// modo 'usuario' = cada um silencia os SEUS tipos + canal push (notif:prefs:{email})
export default function NotificacoesConfig({ modo }: { modo: 'admin' | 'usuario' }) {
  const [off, setOff] = useState<string[]>([]) // desligados/silenciados
  const [pushOff, setPushOff] = useState(false)
  const [carregado, setCarregado] = useState(false)

  const url = modo === 'admin' ? '/api/notificacoes-config' : '/api/notif-prefs'
  useEffect(() => {
    fetch(url).then(r => r.json()).then(d => {
      if (d && !d.error) {
        // Obrigatórios nunca ficam desligados (sempre recebe).
        const semObrig = (l: string[]) => (l || []).filter(t => !NOTIF_OBRIGATORIOS.includes(t))
        if (modo === 'admin') setOff(semObrig(d.desabilitados))
        else { setOff(semObrig(d.mutados)); setPushOff(!!d.pushDesligado) }
      }
      setCarregado(true)
    }).catch(() => setCarregado(true))
  }, [])

  async function salvar(novoOff: string[], novoPush: boolean) {
    const body = modo === 'admin' ? { desabilitados: novoOff } : { mutados: novoOff, pushDesligado: novoPush }
    await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {})
  }
  function toggleTipo(tipo: string) {
    if (NOTIF_OBRIGATORIOS.includes(tipo)) return // obrigatória: não desliga
    const novo = off.includes(tipo) ? off.filter(t => t !== tipo) : [...off, tipo]
    setOff(novo); salvar(novo, pushOff)
  }
  function togglePush() { const n = !pushOff; setPushOff(n); salvar(off, n) }

  const categorias = Array.from(new Set(NOTIF_TIPOS.map(t => t.categoria)))
  const Switch = ({ on, onClick, disabled }: { on: boolean; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={disabled ? undefined : onClick} aria-label={on ? 'Ligado' : 'Desligado'} disabled={disabled}
      style={{ flexShrink: 0, width: 40, height: 23, borderRadius: 999, border: 'none', cursor: disabled ? 'default' : 'pointer', background: on ? 'var(--v2-ok)' : 'var(--v2-rule)', opacity: disabled ? 0.65 : 1, position: 'relative', transition: 'background .2s' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 20 : 3, width: 17, height: 17, borderRadius: '50%', background: 'var(--v2-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left .2s' }} />
    </button>
  )

  if (!carregado) return <p style={{ fontSize: 13, color: 'var(--v2-ink3)' }}>Carregando...</p>
  return (
    <div>
      {modo === 'usuario' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--v2-rule)', marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--v2-ink)' }}>Notificações push (celular/navegador)</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--v2-ink3)' }}>Você continua vendo tudo no Inbox; isto liga/desliga só o push. Se várias chegarem juntas, você é avisado <strong>uma vez só</strong>.</p>
          </div>
          <Switch on={!pushOff} onClick={togglePush} />
        </div>
      )}
      {categorias.map(cat => (
        <div key={cat} style={{ marginBottom: 14 }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--v2-ink3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NOTIF_TIPOS.filter(t => t.categoria === cat).map(t => {
              const obrig = NOTIF_OBRIGATORIOS.includes(t.tipo)
              const on = obrig || !off.includes(t.tipo)
              return (
                <div key={t.tipo} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                  <span style={{ flex: 1, fontSize: 13, color: on ? 'var(--v2-ink)' : 'var(--v2-ink3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {t.label}
                    {obrig && <span title="Sempre ativa — não pode ser desligada" style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--v2-ink3)', background: '#f1f1f3', borderRadius: 999, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>obrigatória</span>}
                  </span>
                  <Switch on={on} disabled={obrig} onClick={() => toggleTipo(t.tipo)} />
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--v2-ink3)' }}>{modo === 'admin' ? 'Desligado = o sistema não envia esse tipo para ninguém.' : 'Desligado = você não recebe esse tipo (nem no Inbox nem no push).'}</p>
    </div>
  )
}
