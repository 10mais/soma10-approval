'use client'
import { useEffect, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { v4 as uuid } from 'uuid'
import UploadProgress from './UploadProgress'
import NotificacoesConfig from './NotificacoesConfig'

const FUSOS = [
  { value: 'America/Sao_Paulo', label: '(GMT-03:00) Brasilia' },
  { value: 'America/Manaus', label: '(GMT-04:00) Manaus' },
  { value: 'America/Rio_Branco', label: '(GMT-05:00) Rio Branco' },
  { value: 'America/Noronha', label: '(GMT-02:00) Fernando de Noronha' },
  { value: 'America/New_York', label: '(GMT-05:00) Nova York' },
  { value: 'Europe/Lisbon', label: '(GMT+00:00) Lisboa' },
  { value: 'UTC', label: '(GMT+00:00) UTC' },
]

export default function MinhaConta() {
  const [perfil, setPerfil] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [progFoto, setProgFoto] = useState<number | null>(null)

  // Senha
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [senhaMsg, setSenhaMsg] = useState('')
  const [senhaErro, setSenhaErro] = useState('')
  const [salvandoSenha, setSalvandoSenha] = useState(false)

  useEffect(() => {
    fetch('/api/meu-perfil').then(r => r.json()).then(d => setPerfil(d)).catch(() => {})
  }, [])

  async function salvarPerfil() {
    setSalvando(true); setMsg(''); setErro('')
    const r = await fetch('/api/meu-perfil', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: perfil.nome, cargo: perfil.cargo, foto: perfil.foto, telefone: perfil.telefone, bio: perfil.bio, fusoHorario: perfil.fusoHorario }),
    }).then(x => x.json()).catch(() => ({ error: 'Erro de conexao' }))
    setSalvando(false)
    if (r?.ok) { setMsg('Perfil atualizado!'); setTimeout(() => setMsg(''), 4000) }
    else setErro(r?.error || 'Erro ao salvar.')
  }

  async function salvarSenha() {
    setSalvandoSenha(true); setSenhaMsg(''); setSenhaErro('')
    const r = await fetch('/api/meu-perfil', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senhaAtual, novaSenha, confirmarSenha }),
    }).then(x => x.json()).catch(() => ({ error: 'Erro de conexao' }))
    setSalvandoSenha(false)
    if (r?.ok) { setSenhaMsg('Senha alterada!'); setSenhaAtual(''); setNovaSenha(''); setConfirmarSenha(''); setTimeout(() => setSenhaMsg(''), 4000) }
    else setSenhaErro(r?.error || 'Erro ao alterar senha.')
  }

  async function uploadFoto(arquivo: File) {
    setEnviandoFoto(true)
    setProgFoto(0)
    try {
      const ext = arquivo.name.split('.').pop() || 'jpg'
      const blob = await upload(`perfis/${uuid()}.${ext}`, arquivo, { access: 'public', handleUploadUrl: '/api/upload', contentType: arquivo.type, clientPayload: arquivo.type, onUploadProgress: ({ percentage }) => setProgFoto(percentage) })
      setPerfil((p: any) => ({ ...p, foto: blob.url }))
      // Salva imediatamente
      await fetch('/api/meu-perfil', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ foto: blob.url }) })
    } catch {} finally { setEnviandoFoto(false); setProgFoto(null) }
  }

  if (!perfil) return <div style={{ padding: 60, textAlign: 'center', color: '#aaa' }}>Carregando...</div>

  return (
    <div style={{ maxWidth: 760 }}>
      <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Configuracoes da conta</p>
      <h2 style={{ margin: '0 0 24px', fontSize: 20, color: '#111' }}>Minha Conta</h2>

      {/* PERFIL */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 32, flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 220px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111' }}>Meu perfil</h3>
          <p style={{ margin: 0, fontSize: 12, color: '#888', lineHeight: 1.5 }}>Informacoes visiveis para sua equipe e clientes.</p>
        </div>
        <div style={{ flex: 1, minWidth: 300, background: '#fff', borderRadius: 14, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>Nome completo</label>
                <input value={perfil.nome || ''} onChange={e => setPerfil((p: any) => ({ ...p, nome: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>Telefone</label>
                <input value={perfil.telefone || ''} onChange={e => setPerfil((p: any) => ({ ...p, telefone: e.target.value }))} placeholder="+55 99 99999-9999"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 2 }}>Avatar</label>
              <label style={{ cursor: 'pointer', position: 'relative' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #e0e0e0' }}>
                  {perfil.foto ? <img src={perfil.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 24, fontWeight: 800, color: '#ccc' }}>{perfil.nome?.[0]?.toUpperCase()}</span>}
                </div>
                <span style={{ position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: '50%', background: '#ffc00f', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                </span>
                <input type="file" accept="image/*" style={{ display: 'none' }} disabled={enviandoFoto} onChange={e => { if (e.target.files?.[0]) uploadFoto(e.target.files[0]); e.target.value = '' }} />
              </label>
              {progFoto !== null && <div style={{ width: 140 }}><UploadProgress valor={progFoto} rotulo="Enviando foto..." /></div>}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>Funcao / Cargo</label>
            <input value={perfil.cargo || ''} onChange={e => setPerfil((p: any) => ({ ...p, cargo: e.target.value }))} placeholder="Ex.: Social Media, Designer, Gestor..."
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>Biografia</label>
            <textarea value={perfil.bio || ''} onChange={e => setPerfil((p: any) => ({ ...p, bio: e.target.value }))} placeholder="Conte um pouco sobre voce..."
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, minHeight: 70, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={salvarPerfil} disabled={salvando} style={{ padding: '10px 24px', background: 'var(--marca, #ffc00f)', color: 'var(--marca-texto, #111)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', opacity: salvando ? 0.6 : 1 }}>
              {salvando ? 'Salvando...' : 'Salvar perfil'}
            </button>
            {msg && <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>{msg}</span>}
            {erro && <span style={{ fontSize: 12, fontWeight: 600, color: '#dc2626' }}>{erro}</span>}
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: '#f0f0f0', marginBottom: 32 }} />

      {/* FUSO HORARIO */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 32, flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 220px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111' }}>Fuso horario</h3>
          <p style={{ margin: 0, fontSize: 12, color: '#888', lineHeight: 1.5 }}>Ajuste a data e hora da plataforma conforme sua regiao.</p>
        </div>
        <div style={{ flex: 1, minWidth: 300, background: '#fff', borderRadius: 14, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <select value={perfil.fusoHorario || 'America/Sao_Paulo'} onChange={e => { setPerfil((p: any) => ({ ...p, fusoHorario: e.target.value })); fetch('/api/meu-perfil', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fusoHorario: e.target.value }) }) }}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
            {FUSOS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ height: 1, background: '#f0f0f0', marginBottom: 32 }} />

      {/* ALTERAR SENHA */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 32, flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 220px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111' }}>Alterar senha</h3>
          <p style={{ margin: 0, fontSize: 12, color: '#888', lineHeight: 1.5 }}>Deixe em branco caso nao queira altera-la.</p>
        </div>
        <div style={{ flex: 1, minWidth: 300, background: '#fff', borderRadius: 14, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>Senha atual</label>
              <input type="password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>Nova senha</label>
              <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>Confirme sua nova senha</label>
              <input type="password" value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={salvarSenha} disabled={salvandoSenha || !senhaAtual || !novaSenha} style={{ padding: '10px 24px', background: (senhaAtual && novaSenha) ? '#111' : '#f0f0f0', color: (senhaAtual && novaSenha) ? '#fff' : '#aaa', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: (senhaAtual && novaSenha) ? 'pointer' : 'not-allowed' }}>
              {salvandoSenha ? 'Alterando...' : 'Alterar senha'}
            </button>
            {senhaMsg && <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>{senhaMsg}</span>}
            {senhaErro && <span style={{ fontSize: 12, fontWeight: 600, color: '#dc2626' }}>{senhaErro}</span>}
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: '#f0f0f0', marginBottom: 32 }} />

      {/* INFO DA CONTA */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 220px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111' }}>Informacoes da conta</h3>
          <p style={{ margin: 0, fontSize: 12, color: '#888', lineHeight: 1.5 }}>Dados gerenciados pelo administrador.</p>
        </div>
        <div style={{ flex: 1, minWidth: 300, background: '#fff', borderRadius: 14, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#888', width: 100 }}>Email</span>
            <span style={{ fontSize: 13, color: '#111' }}>{perfil.email}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#888', width: 100 }}>Nivel de acesso</span>
            <span style={{ fontSize: 12, fontWeight: 700, background: '#f0f0f0', borderRadius: 999, padding: '2px 10px', color: '#333' }}>{perfil.role}</span>
          </div>
        </div>
      </div>

      {/* MINHAS NOTIFICACOES */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 24 }}>
        <div style={{ flex: '0 0 220px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111' }}>Minhas notificações</h3>
          <p style={{ margin: 0, fontSize: 12, color: '#888', lineHeight: 1.5 }}>Escolha o que você quer receber. Ligado = você recebe.</p>
        </div>
        <div style={{ flex: 1, minWidth: 300, background: '#fff', borderRadius: 14, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <NotificacoesConfig modo="usuario" />
        </div>
      </div>
    </div>
  )
}
