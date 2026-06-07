'use client'
import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')

    const res = await signIn('credentials', { email, password: senha, redirect: false })
    if (res?.ok) {
      const session = await getSession()
      const role = (session?.user as any)?.role
      router.push(role === 'cliente' ? '/portal' : '/dashboard')
    } else {
      setErro('Email ou senha incorretos.')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f8f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 40, width: '100%', maxWidth: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 16, width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', overflow: 'hidden' }}>
            <img src="/logo.svg" alt="Soma10" style={{ width: 44, height: 44, objectFit: 'contain' }} />
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111' }}>Soma10Approval</h1>
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
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="••••••••"
              required
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
            />
          </div>

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
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#ccc', fontSize: 12, margin: '24px 0 0' }}>
          Soma10Approval · Grupo 10+
        </p>
      </div>
    </div>
  )
}
