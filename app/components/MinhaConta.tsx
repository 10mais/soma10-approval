'use client'
import { useEffect, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { v4 as uuid } from 'uuid'
import UploadProgress from './UploadProgress'
import NotificacoesConfig from './NotificacoesConfig'
import { ortografiaLigada, definirOrtografia } from '@/lib/ortografia'

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
  // Corretor do navegador: preferência DESTE navegador (localStorage), não do
  // usuário no banco — quem tem o dicionário pt-BR num computador e não no
  // outro precisa da escolha em cada um. Ver lib/ortografia.
  const [corretor, setCorretor] = useState(true)
  useEffect(() => { setCorretor(ortografiaLigada()) }, [])
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

  // Verificação em 2 fatores (2FA) — método 'app' (TOTP) ou 'email'
  const [tfaAtivo, setTfaAtivo] = useState(false)
  const [tfaMetodoAtivo, setTfaMetodoAtivo] = useState<'app' | 'email' | null>(null)
  const [tfaGlobalAtivo, setTfaGlobalAtivo] = useState(true) // exigência global do 2FA no login
  const [tfaConfig, setTfaConfig] = useState<'app' | 'email' | null>(null) // setup em andamento
  const [tfaQr, setTfaQr] = useState('')
  const [tfaSegredo, setTfaSegredo] = useState('')
  const [tfaCodigo, setTfaCodigo] = useState('')
  const [tfaMsg, setTfaMsg] = useState('')
  const [tfaErro, setTfaErro] = useState('')
  const [tfaBusy, setTfaBusy] = useState(false)

  useEffect(() => {
    fetch('/api/meu-perfil').then(r => r.json()).then(d => setPerfil(d)).catch(() => {})
    fetch('/api/2fa').then(r => r.json()).then(d => { if (d && !d.error) { setTfaAtivo(!!d.ativo); setTfaMetodoAtivo(d.metodo || null); setTfaGlobalAtivo(!!d.globalAtivo) } }).catch(() => {})
  }, [])

  async function iniciar2FA(metodo: 'app' | 'email') {
    setTfaBusy(true); setTfaErro(''); setTfaMsg(''); setTfaCodigo('')
    const r = await fetch('/api/2fa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'setup', metodo }) }).then(x => x.json()).catch(() => null)
    setTfaBusy(false)
    if (r?.ok) { setTfaConfig(metodo); if (metodo === 'app') { setTfaQr(r.qr); setTfaSegredo(r.segredo) } }
    else setTfaErro(r?.error || 'Não foi possível iniciar a configuração.')
  }
  async function ativar2FA() {
    setTfaBusy(true); setTfaErro(''); setTfaMsg('')
    const r = await fetch('/api/2fa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'ativar', codigo: tfaCodigo }) }).then(x => x.json()).catch(() => null)
    setTfaBusy(false)
    if (r?.ok) { setTfaAtivo(true); setTfaMetodoAtivo(tfaConfig); setTfaConfig(null); setTfaQr(''); setTfaSegredo(''); setTfaCodigo(''); setTfaMsg('Verificação em 2 fatores ativada!'); setTimeout(() => setTfaMsg(''), 5000) }
    else setTfaErro(r?.error || 'Código inválido.')
  }
  async function reenviarEmail2FA() {
    setTfaErro('')
    await fetch('/api/2fa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'reenviar-email' }) }).catch(() => {})
    setTfaMsg('Código reenviado ao seu e-mail.'); setTimeout(() => setTfaMsg(''), 4000)
  }
  function cancelar2FA() { setTfaConfig(null); setTfaQr(''); setTfaSegredo(''); setTfaCodigo(''); setTfaErro('') }
  async function desativar2FA() {
    setTfaBusy(true); setTfaErro(''); setTfaMsg('')
    const r = await fetch('/api/2fa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'desativar' }) }).then(x => x.json()).catch(() => null)
    setTfaBusy(false)
    if (r?.ok) { setTfaAtivo(false); setTfaMetodoAtivo(null); setTfaMsg('2FA desativado.'); setTimeout(() => setTfaMsg(''), 5000) } else setTfaErro(r?.error || 'Não foi possível desativar.')
  }

  async function salvarPerfil() {
    setSalvando(true); setMsg(''); setErro('')
    const r = await fetch('/api/meu-perfil', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: perfil.nome, cargo: perfil.cargo, foto: perfil.foto, telefone: perfil.telefone, bio: perfil.bio, fusoHorario: perfil.fusoHorario }),
    }).then(x => x.json()).catch(() => ({ error: 'Erro de conexão' }))
    setSalvando(false)
    if (r?.ok) { setMsg('Perfil atualizado!'); setTimeout(() => setMsg(''), 4000) }
    else setErro(r?.error || 'Erro ao salvar.')
  }

  async function salvarSenha() {
    setSalvandoSenha(true); setSenhaMsg(''); setSenhaErro('')
    const r = await fetch('/api/meu-perfil', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senhaAtual, novaSenha, confirmarSenha }),
    }).then(x => x.json()).catch(() => ({ error: 'Erro de conexão' }))
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

  if (!perfil) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--v2-ink3)' }}>Carregando...</div>

  // Cliente ve uma conta enxuta (sem campos internos da equipe: cargo, bio, nivel de acesso).
  const ehCliente = perfil.role === 'cliente'

  return (
    <div style={{ maxWidth: 760 }}>
      <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: 'var(--v2-ink3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Configurações da conta</p>
      <h2 style={{ margin: '0 0 24px', fontSize: 20, color: 'var(--v2-ink)' }}>Minha Conta</h2>

      {/* PERFIL */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 32, flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 220px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, color: 'var(--v2-ink)' }}>Meu perfil</h3>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--v2-ink3)', lineHeight: 1.5 }}>{ehCliente ? 'Seus dados de acesso ao portal.' : 'Informações visíveis para sua equipe e clientes.'}</p>
        </div>
        <div style={{ flex: 1, minWidth: 300, background: 'var(--v2-surface)', borderRadius: 14, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink2)', marginBottom: 6 }}>Nome completo</label>
                <input value={perfil.nome || ''} onChange={e => setPerfil((p: any) => ({ ...p, nome: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink2)', marginBottom: 6 }}>Telefone</label>
                <input value={perfil.telefone || ''} onChange={e => setPerfil((p: any) => ({ ...p, telefone: e.target.value }))} placeholder="+55 99 99999-9999"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink2)', marginBottom: 2 }}>Avatar</label>
              <label style={{ cursor: 'pointer', position: 'relative' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', background: 'var(--v2-surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--v2-rule)' }}>
                  {perfil.foto ? <img src={perfil.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--v2-ink3)' }}>{perfil.nome?.[0]?.toUpperCase()}</span>}
                </div>
                <span style={{ position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: '50%', background: 'var(--v2-amber-on)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--v2-surface)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--v2-ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                </span>
                <input type="file" accept="image/*" style={{ display: 'none' }} disabled={enviandoFoto} onChange={e => { if (e.target.files?.[0]) uploadFoto(e.target.files[0]); e.target.value = '' }} />
              </label>
              {progFoto !== null && <div style={{ width: 140 }}><UploadProgress valor={progFoto} rotulo="Enviando foto..." /></div>}
            </div>
          </div>
          {!ehCliente && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink2)', marginBottom: 6 }}>Funcao / Cargo</label>
              <input value={perfil.cargo || ''} onChange={e => setPerfil((p: any) => ({ ...p, cargo: e.target.value }))} placeholder="Ex.: Social Media, Designer, Gestor..."
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          )}
          {!ehCliente && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink2)', marginBottom: 6 }}>Biografia</label>
              <textarea lang="pt-BR" value={perfil.bio || ''} onChange={e => setPerfil((p: any) => ({ ...p, bio: e.target.value }))} placeholder="Conte um pouco sobre você..."
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, minHeight: 70, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={salvarPerfil} disabled={salvando} style={{ padding: '10px 24px', background: 'var(--marca, var(--v2-amber-on))', color: 'var(--marca-texto, var(--v2-ink))', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', opacity: salvando ? 0.6 : 1 }}>
              {salvando ? 'Salvando...' : 'Salvar perfil'}
            </button>
            {msg && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--v2-ok)' }}>{msg}</span>}
            {erro && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--v2-hot)' }}>{erro}</span>}
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--v2-surface2)', marginBottom: 32 }} />

      {/* FUSO HORARIO */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 32, flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 220px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, color: 'var(--v2-ink)' }}>Fuso horario</h3>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--v2-ink3)', lineHeight: 1.5 }}>Ajuste a data e hora da plataforma conforme sua regiao.</p>
        </div>
        <div style={{ flex: 1, minWidth: 300, background: 'var(--v2-surface)', borderRadius: 14, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <select value={perfil.fusoHorario || 'America/Sao_Paulo'} onChange={e => { setPerfil((p: any) => ({ ...p, fusoHorario: e.target.value })); fetch('/api/meu-perfil', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fusoHorario: e.target.value }) }) }}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface)' }}>
            {FUSOS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--v2-surface2)', marginBottom: 32 }} />

      {/* ALTERAR SENHA */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 32, flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 220px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, color: 'var(--v2-ink)' }}>Alterar senha</h3>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--v2-ink3)', lineHeight: 1.5 }}>Deixe em branco caso não queira alterá-la.</p>
        </div>
        <div style={{ flex: 1, minWidth: 300, background: 'var(--v2-surface)', borderRadius: 14, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink2)', marginBottom: 6 }}>Senha atual</label>
              <input type="password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink2)', marginBottom: 6 }}>Nova senha</label>
              <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink2)', marginBottom: 6 }}>Confirme sua nova senha</label>
              <input type="password" value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={salvarSenha} disabled={salvandoSenha || !senhaAtual || !novaSenha} style={{ padding: '10px 24px', background: (senhaAtual && novaSenha) ? 'var(--v2-ink)' : 'var(--v2-surface2)', color: (senhaAtual && novaSenha) ? 'var(--v2-surface)' : 'var(--v2-ink3)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: (senhaAtual && novaSenha) ? 'pointer' : 'not-allowed' }}>
              {salvandoSenha ? 'Alterando...' : 'Alterar senha'}
            </button>
            {senhaMsg && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--v2-ok)' }}>{senhaMsg}</span>}
            {senhaErro && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--v2-hot)' }}>{senhaErro}</span>}
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--v2-surface2)', marginBottom: 32 }} />

      {/* VERIFICAÇÃO EM 2 FATORES */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 32, flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 220px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, color: 'var(--v2-ink)' }}>Verificação em 2 fatores</h3>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--v2-ink3)', lineHeight: 1.5 }}>Camada extra de segurança: além da senha, pede um código ao entrar — por <b>e-mail</b> (sem app) ou por <b>app autenticador</b>.</p>
        </div>
        <div style={{ flex: 1, minWidth: 300, background: 'var(--v2-surface)', borderRadius: 14, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          {tfaAtivo ? (
            <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#eafaf0', color: '#1a7d4b', padding: '6px 12px', borderRadius: 999, fontWeight: 800, fontSize: 12.5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#27ae60' }} /> Ativado{tfaMetodoAtivo === 'email' ? ' · por e-mail' : tfaMetodoAtivo === 'app' ? ' · por app' : ''}
              </span>
              <button onClick={desativar2FA} disabled={tfaBusy} style={{ padding: '9px 16px', background: 'var(--v2-surface)', color: 'var(--v2-hot)', border: '1.5px solid var(--v2-hot-bg)', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Desativar</button>
            </div>
            {!tfaGlobalAtivo && <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--v2-amber)', lineHeight: 1.5 }}>Preparado, mas o login ainda <b>não exige</b> o código — a exigência é ligada globalmente pelo admin (Configurações → Saúde do sistema), previsto para <b>depois da liberação da Meta/Facebook</b>.</p>}
            </>
          ) : tfaConfig ? (
            <div>
              {tfaConfig === 'app' && (
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 12 }}>
                  <img src={tfaQr} alt="QR Code 2FA" className="soma10-no-invert" style={{ width: 150, height: 150, borderRadius: 10, border: '1px solid var(--v2-rule)' }} />
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--v2-ink2)', lineHeight: 1.5 }}>Escaneie o QR no seu app (Google Authenticator, Authy, 1Password, ou o gerenciador de senhas do seu celular) — ou digite a chave:</p>
                    <code style={{ display: 'inline-block', fontSize: 12, background: 'var(--v2-surface1)', padding: '6px 10px', borderRadius: 8, color: 'var(--v2-ink)', wordBreak: 'break-all' }}>{tfaSegredo}</code>
                  </div>
                </div>
              )}
              {tfaConfig === 'email' && (
                <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--v2-ink2)', lineHeight: 1.5 }}>
                  Enviamos um código de 6 dígitos para <b>{perfil.email}</b>. Digite abaixo para confirmar.{' '}
                  <button type="button" onClick={reenviarEmail2FA} style={{ background: 'none', border: 'none', color: 'var(--v2-info)', cursor: 'pointer', padding: 0, fontSize: 12.5, fontWeight: 700 }}>Reenviar</button>
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input value={tfaCodigo} onChange={e => setTfaCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="000000" autoFocus style={{ width: 120, padding: '9px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 16, letterSpacing: 4, textAlign: 'center', fontFamily: 'inherit' }} />
                <button onClick={ativar2FA} disabled={tfaBusy || tfaCodigo.length < 6} style={{ padding: '9px 18px', background: tfaCodigo.length >= 6 ? 'var(--v2-ink)' : 'var(--v2-surface2)', color: tfaCodigo.length >= 6 ? 'var(--v2-surface)' : 'var(--v2-ink3)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: tfaCodigo.length >= 6 ? 'pointer' : 'not-allowed' }}>{tfaBusy ? 'Ativando…' : 'Confirmar e ativar'}</button>
                <button onClick={cancelar2FA} style={{ padding: '9px 14px', background: 'none', color: 'var(--v2-ink3)', border: 'none', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>Cancelar</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => iniciar2FA('email')} disabled={tfaBusy} style={{ padding: '10px 18px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{tfaBusy ? 'Preparando…' : 'Ativar por e-mail (sem app)'}</button>
              <button onClick={() => iniciar2FA('app')} disabled={tfaBusy} style={{ padding: '10px 18px', background: 'var(--v2-surface)', color: 'var(--v2-ink2)', border: '1.5px solid var(--v2-rule)', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Por app autenticador</button>
            </div>
          )}
          {tfaMsg && <p style={{ margin: '12px 0 0', fontSize: 12.5, fontWeight: 600, color: 'var(--v2-ok)' }}>{tfaMsg}</p>}
          {tfaErro && <p style={{ margin: '12px 0 0', fontSize: 12.5, fontWeight: 600, color: 'var(--v2-hot)' }}>{tfaErro}</p>}
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--v2-surface2)', marginBottom: 32 }} />

      {/* INFO DA CONTA */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 220px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, color: 'var(--v2-ink)' }}>Informações da conta</h3>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--v2-ink3)', lineHeight: 1.5 }}>Dados gerenciados pelo administrador.</p>
        </div>
        <div style={{ flex: 1, minWidth: 300, background: 'var(--v2-surface)', borderRadius: 14, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', width: 100 }}>Email</span>
            <span style={{ fontSize: 13, color: 'var(--v2-ink)' }}>{perfil.email}</span>
          </div>
          {!ehCliente && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', width: 100 }}>Nivel de acesso</span>
              <span style={{ fontSize: 12, fontWeight: 700, background: 'var(--v2-surface2)', borderRadius: 999, padding: '2px 10px', color: 'var(--v2-ink)' }}>{perfil.role}</span>
            </div>
          )}
        </div>
      </div>

      {/* CORRETOR ORTOGRAFICO (deste navegador) */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 24 }}>
        <div style={{ flex: '0 0 220px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, color: 'var(--v2-ink)' }}>Corretor ortográfico</h3>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--v2-ink3)', lineHeight: 1.5 }}>Vale só neste navegador.</p>
        </div>
        <div style={{ flex: 1, minWidth: 300, background: 'var(--v2-surface)', borderRadius: 14, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={corretor} onChange={e => { setCorretor(e.target.checked); definirOrtografia(e.target.checked) }} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--v2-ink)' }}>Sublinhar palavras que o navegador acha erradas</span>
          </label>
          <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--v2-ink3)', lineHeight: 1.6 }}>
            O sistema já declara <b>português do Brasil</b> em todos os campos de texto. Quem corrige, porém, é o
            navegador — e ele só corrige nos idiomas que você habilitou nele. Se as palavras certas aparecem
            sublinhadas de vermelho, é sinal de que ele está corrigindo pelo dicionário de <b>inglês</b>:
            adicione <b>Português (Brasil)</b> em <code style={{ fontSize: 11.5 }}>chrome://settings/languages</code> e
            ligue a verificação ortográfica nesse idioma. Extensões de escrita (Grammarly e parecidas) também
            sublinham por conta própria, só em inglês.
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--v2-ink3)', lineHeight: 1.6 }}>
            Enquanto isso não estiver resolvido, desmarque a caixa acima: melhor sem correção do que com um mar de
            vermelho embaixo de texto certo.
          </p>
        </div>
      </div>

      {/* MINHAS NOTIFICACOES */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 24 }}>
        <div style={{ flex: '0 0 220px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, color: 'var(--v2-ink)' }}>Minhas notificações</h3>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--v2-ink3)', lineHeight: 1.5 }}>Escolha o que você quer receber. Ligado = você recebe.</p>
        </div>
        <div style={{ flex: 1, minWidth: 300, background: 'var(--v2-surface)', borderRadius: 14, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <NotificacoesConfig modo="usuario" />
        </div>
      </div>
    </div>
  )
}
