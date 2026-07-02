'use client'
import { useEffect, useState } from 'react'
import { NOTIF_TIPOS } from '@/lib/notificacoesCatalogo'

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
        if (modo === 'admin') setOff(d.desabilitados || [])
        else { setOff(d.mutados || []); setPushOff(!!d.pushDesligado) }
      }
      setCarregado(true)
    }).catch(() => setCarregado(true))
  }, [])

  async function salvar(novoOff: string[], novoPush: boolean) {
    const body = modo === 'admin' ? { desabilitados: novoOff } : { mutados: novoOff, pushDesligado: novoPush }
    await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {})
  }
  function toggleTipo(tipo: string) {
    const novo = off.includes(tipo) ? off.filter(t => t !== tipo) : [...off, tipo]
    setOff(novo); salvar(novo, pushOff)
  }
  function togglePush() { const n = !pushOff; setPushOff(n); salvar(off, n) }

  const categorias = Array.from(new Set(NOTIF_TIPOS.map(t => t.categoria)))
  const Switch = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button onClick={onClick} aria-label={on ? 'Ligado' : 'Desligado'} style={{ flexShrink: 0, width: 40, height: 23, borderRadius: 999, border: 'none', cursor: 'pointer', background: on ? '#16a34a' : '#e0e0e0', position: 'relative', transition: 'background .2s' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 20 : 3, width: 17, height: 17, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left .2s' }} />
    </button>
  )

  if (!carregado) return <p style={{ fontSize: 13, color: '#aaa' }}>Carregando...</p>
  return (
    <div>
      {modo === 'usuario' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f0f0f0', marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#111' }}>Notificações push (celular/navegador)</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>Você continua vendo tudo no Inbox; isto liga/desliga só o push.</p>
          </div>
          <Switch on={!pushOff} onClick={togglePush} />
        </div>
      )}
      {categorias.map(cat => (
        <div key={cat} style={{ marginBottom: 14 }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NOTIF_TIPOS.filter(t => t.categoria === cat).map(t => {
              const on = !off.includes(t.tipo)
              return (
                <div key={t.tipo} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                  <span style={{ flex: 1, fontSize: 13, color: on ? '#111' : '#aaa' }}>{t.label}</span>
                  <Switch on={on} onClick={() => toggleTipo(t.tipo)} />
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <p style={{ margin: '8px 0 0', fontSize: 11, color: '#bbb' }}>{modo === 'admin' ? 'Desligado = o sistema não envia esse tipo para ninguém.' : 'Desligado = você não recebe esse tipo (nem no Inbox nem no push).'}</p>
    </div>
  )
}
