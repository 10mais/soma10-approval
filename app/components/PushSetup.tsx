'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export default function PushSetup() {
  const { status } = useSession()
  const [canInstall, setCanInstall] = useState(false)
  const [installEvent, setInstallEvent] = useState<any>(null)
  const [pushKey, setPushKey] = useState('')
  const [showAtivarPush, setShowAtivarPush] = useState(false)
  const [showIosDica, setShowIosDica] = useState(false)
  const [dispensado, setDispensado] = useState(false)
  const [mobile, setMobile] = useState(false)

  // No celular o card vira um banner acima da barra de navegacao inferior
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const apply = () => setMobile(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  // Registra o service worker (necessario para PWA e push)
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  // Captura o prompt de instalacao (Android/desktop Chrome)
  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setInstallEvent(e); setCanInstall(true) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Logado: verifica config de push e estado da instalacao
  useEffect(() => {
    if (status !== 'authenticated') return
    if (typeof window === 'undefined') return
    if (localStorage.getItem('pushSetupDispensado') === '1') { setDispensado(true) }

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    if (isIOS && !isStandalone) setShowIosDica(true)

    fetch('/api/push/subscribe').then(r => r.json()).then(async (d) => {
      if (!d?.configurado || !d?.publicKey) return
      setPushKey(d.publicKey)
      if (typeof Notification === 'undefined') return
      if (Notification.permission === 'granted') {
        // ja permitido: garante a inscricao (idempotente)
        await inscrever(d.publicKey)
      } else if (Notification.permission === 'default') {
        setShowAtivarPush(true)
      }
    }).catch(() => {})
  }, [status])

  async function inscrever(key: string) {
    try {
      const reg = await navigator.serviceWorker.ready
      const existente = await reg.pushManager.getSubscription()
      const sub = existente || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) })
      await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub }) })
    } catch { /* silencioso */ }
  }

  async function ativarPush() {
    if (typeof Notification === 'undefined') return
    const perm = await Notification.requestPermission()
    setShowAtivarPush(false)
    if (perm === 'granted' && pushKey) await inscrever(pushKey)
  }

  async function instalar() {
    if (!installEvent) return
    installEvent.prompt()
    await installEvent.userChoice.catch(() => {})
    setInstallEvent(null); setCanInstall(false)
  }

  function dispensar() {
    setDispensado(true)
    try { localStorage.setItem('pushSetupDispensado', '1') } catch {}
  }

  if (status !== 'authenticated' || dispensado) return null
  const temAlgo = canInstall || showAtivarPush || showIosDica
  if (!temAlgo) return null

  // Mobile: banner acima da barra inferior (clear da safe-area). Desktop: card no canto.
  const contStyle: React.CSSProperties = mobile
    ? { position: 'fixed', left: 12, right: 12, bottom: 'calc(84px + env(safe-area-inset-bottom))', zIndex: 4000, background: '#111', color: '#fff', borderRadius: 14, boxShadow: '0 10px 30px rgba(0,0,0,0.3)', padding: 16 }
    : { position: 'fixed', right: 16, bottom: 16, zIndex: 4000, maxWidth: 300, background: '#111', color: '#fff', borderRadius: 14, boxShadow: '0 10px 30px rgba(0,0,0,0.3)', padding: 16 }

  return (
    <div style={contStyle} className="soma10-no-invert">
      <button onClick={dispensar} title="Dispensar" style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', color: '#888', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
      <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: '#ffc00f' }}>Soma10 no seu celular</p>
      {showIosDica && (
        <p style={{ margin: '0 0 10px', fontSize: 12, color: '#ddd', lineHeight: 1.5 }}>
          No iPhone: toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b> para instalar e receber notificações.
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {canInstall && (
          <button onClick={instalar} style={{ padding: '9px 14px', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 9, fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>Instalar app</button>
        )}
        {showAtivarPush && (
          <button onClick={ativarPush} style={{ padding: '9px 14px', background: '#fff', color: '#111', border: 'none', borderRadius: 9, fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>Ativar notificações</button>
        )}
      </div>
    </div>
  )
}
