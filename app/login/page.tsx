'use client'
import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import SystemName from '@/app/components/SystemName'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [mostrar2FA, setMostrar2FA] = useState(false)
  const [metodo2FA, setMetodo2FA] = useState<'app' | 'email' | null>(null)
  const [reenviado, setReenviado] = useState(false)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function entrar(cod: string) {
    const res = await signIn('credentials', { email, password: senha, codigo: cod, redirect: false })
    if (res?.ok) {
      const session = await getSession()
      const role = (session?.user as any)?.role
      router.push(role === 'cliente' ? '/portal' : '/dashboard')
    } else {
      setErro(mostrar2FA ? 'Código inválido. Tente de novo.' : 'Email ou senha incorretos.')
      setLoading(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')
    // 2º passo: já mostrando o campo de código → entra com o código.
    if (mostrar2FA) { await entrar(codigo); return }
    // 1º passo: confere e-mail+senha e descobre se a conta exige 2FA.
    const pre = await fetch('/api/2fa/precheck', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, senha }) }).then(r => r.json()).catch(() => null)
    if (!pre?.ok) { setErro('Email ou senha incorretos.'); setLoading(false); return }
    if (pre.needs2FA) { setMetodo2FA(pre.metodo || 'app'); setMostrar2FA(true); setLoading(false); return } // revela o campo de código
    await entrar('') // conta sem 2FA — login normal, inalterado
  }

  async function reenviarCodigo() {
    setReenviado(false); setErro('')
    await fetch('/api/2fa/precheck', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, senha }) }).catch(() => {})
    setReenviado(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f8f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 40, width: '100%', maxWidth: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 16, width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', overflow: 'hidden' }}>
            <img src="/logo.svg" alt="Soma10" style={{ width: 44, height: 44, objectFit: 'contain' }} />
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111' }}><SystemName fallback="Soma10" /></h1>
          <p style={{ margin: '6px 0 0', color: '#999', fontSize: 14 }}>Acesso exclusivo para colaboradores</p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Senha</label>
            <div style={{ position: 'relative' }}>
              <input
                type={verSenha ? 'text' : 'password'}
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="••••••••"
                required
                style={{ width: '100%', padding: '12px 44px 12px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
              />
              <button type="button" onClick={() => setVerSenha(v => !v)} title={verSenha ? 'Ocultar senha' : 'Mostrar senha'} aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999', display: 'flex', padding: 6 }}>
                {verSenha
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.12 9.12 0 0 0 5.39-1.61" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24M1 1l22 22" /></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>}
              </button>
            </div>
          </div>

          {mostrar2FA && (
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Código de verificação</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={codigo}
                onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                autoFocus
                required
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 20, letterSpacing: 6, textAlign: 'center', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
              />
              {metodo2FA === 'email' ? (
                <p style={{ margin: '6px 0 0', fontSize: 11.5, color: '#999' }}>
                  Enviamos um código de 6 dígitos para <b>{email}</b>.{' '}
                  {reenviado ? <span style={{ color: '#16a34a', fontWeight: 700 }}>Reenviado.</span> : <button type="button" onClick={reenviarCodigo} style={{ background: 'none', border: 'none', color: '#1d4ed8', cursor: 'pointer', padding: 0, fontSize: 11.5, fontWeight: 700 }}>Reenviar</button>}
                </p>
              ) : (
                <p style={{ margin: '6px 0 0', fontSize: 11.5, color: '#999' }}>Abra seu app autenticador e digite o código de 6 dígitos.</p>
              )}
            </div>
          )}

          {erro && (
            <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#ef4444' }}>
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '14px 0', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? (mostrar2FA ? 'Verificando...' : 'Entrando...') : (mostrar2FA ? 'Verificar' : 'Entrar')}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#ccc', fontSize: 12, margin: '24px 0 0' }}>
          <SystemName /> · Grupo 10+
        </p>
      </div>
    </div>
  )
}
