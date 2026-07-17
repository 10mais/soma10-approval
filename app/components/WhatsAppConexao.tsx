'use client'
import { useEffect, useState, useCallback } from 'react'
import { toast } from '@/lib/toast'

// Conexão do WhatsApp (Evolution) dentro do Soma10 — admin. Mostra o status e,
// quando desconectado, o QR pra parear (ou trocar de número) sem abrir o Railway.

type Estado = 'open' | 'connecting' | 'close' | 'nao_configurado' | 'erro' | 'desconhecido'

const INFO: Record<string, { label: string; cor: string; bg: string }> = {
  open: { label: 'Conectado', cor: '#166534', bg: '#dcfce7' },
  connecting: { label: 'Conectando…', cor: '#a16207', bg: '#fef3c7' },
  close: { label: 'Desconectado', cor: '#b91c1c', bg: '#fee2e2' },
  nao_configurado: { label: 'Não configurado', cor: '#6b7280', bg: '#f4f4f5' },
  erro: { label: 'Erro ao consultar', cor: '#b91c1c', bg: '#fee2e2' },
  desconhecido: { label: 'Desconhecido', cor: '#6b7280', bg: '#f4f4f5' },
}

export default function WhatsAppConexao() {
  const [estado, setEstado] = useState<Estado>('desconhecido')
  const [configurado, setConfigurado] = useState(true)
  const [carregando, setCarregando] = useState(true)
  const [qr, setQr] = useState<string | null>(null)
  const [codigo, setCodigo] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  // Pareamento por CÓDIGO: o Evolution só gera o código se souber o número. É a
  // saída quando o celular recusa o QR com "Não foi possível conectar o
  // dispositivo" (aconteceu na Norah e na Deny).
  const [numero, setNumero] = useState('')

  const carregar = useCallback(async () => {
    const d = await fetch('/api/whatsapp/conexao').then(r => r.json()).catch(() => null)
    if (d) { setConfigurado(!!d.configurado); setEstado(d.estado || 'desconhecido') }
    setCarregando(false)
  }, [])
  useEffect(() => { carregar() }, [carregar])

  // Enquanto o QR está na tela (ou conectando), re-checa o status a cada 5s.
  useEffect(() => {
    if (!qr && estado !== 'connecting') return
    const id = setInterval(async () => {
      const d = await fetch('/api/whatsapp/conexao').then(r => r.json()).catch(() => null)
      if (d?.estado) { setEstado(d.estado); if (d.estado === 'open') { setQr(null); setCodigo(null); toast('WhatsApp conectado!', 'sucesso') } }
    }, 5000)
    return () => clearInterval(id)
  }, [qr, estado])

  async function conectar(comNumero = false) {
    if (comNumero && numero.replace(/\D/g, '').length < 12) { toast('Informe o número com DDI e DDD (ex.: 55 55 99999-9999).', 'erro'); return }
    setOcupado(true); setQr(null); setCodigo(null)
    const d = await fetch('/api/whatsapp/conexao', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'conectar', ...(comNumero ? { numero } : {}) }),
    }).then(r => r.json()).catch(() => null)
    setOcupado(false)
    if (d?.base64) setQr(d.base64.startsWith('data:') ? d.base64 : `data:image/png;base64,${d.base64}`)
    if (d?.codigo) setCodigo(d.codigo)
    if (!d?.base64 && !d?.codigo) toast(d?.error || 'Não foi possível gerar o QR. Tente de novo.', 'erro')
    if (comNumero && d?.base64 && !d?.codigo) toast('O Evolution não devolveu o código — veio só QR. Confira o número (com DDI) e tente de novo.', 'erro')
    carregar()
  }

  async function desconectar() {
    setOcupado(true)
    await fetch('/api/whatsapp/conexao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'desconectar' }) }).catch(() => {})
    setOcupado(false); setQr(null); setCodigo(null); carregar()
  }

  const info = INFO[estado] || INFO.desconhecido

  if (carregando) return <p style={{ fontSize: 13, color: '#aaa' }}>Verificando conexão…</p>

  if (!configurado) {
    return (
      <p style={{ margin: 0, fontSize: 12.5, color: '#888', lineHeight: 1.6 }}>
        Conector não configurado. Suba um host do Evolution e adicione as variáveis
        <b> EVOLUTION_API_URL</b>, <b>EVOLUTION_INSTANCE</b> e <b>EVOLUTION_API_KEY</b> na Vercel <b>desta</b> instância. O número atual é mantido — pareia por QR.
        <br />
        Cada instância precisa da <b>sua própria</b> instância do Evolution (<b>EVOLUTION_INSTANCE</b> diferente): o mesmo nome em duas faria as conversas de uma cair na outra.
      </p>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: info.cor, background: info.bg, borderRadius: 999, padding: '5px 12px' }}>{info.label}</span>
        <button onClick={carregar} style={{ padding: '6px 12px', background: '#f2f2f2', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#444', cursor: 'pointer' }}>Atualizar</button>
        <span style={{ flex: 1 }} />
        {estado === 'open'
          ? <button onClick={desconectar} disabled={ocupado} style={{ padding: '8px 14px', background: '#fff', border: '1px solid #fca5a5', borderRadius: 9, color: '#b91c1c', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Desconectar</button>
          : <button onClick={() => conectar()} disabled={ocupado} style={{ padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 9, fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>{ocupado ? 'Gerando…' : 'Conectar / gerar QR'}</button>}
      </div>

      {/* Pareamento por CÓDIGO — a saída quando o celular recusa o QR com "Não
          foi possível conectar o dispositivo". Precisa do número porque o
          Evolution só gera o código sabendo para quem é. */}
      {estado !== 'open' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, padding: '10px 12px', background: '#f8fafc', border: '1px solid #eee', borderRadius: 10 }}>
          <span style={{ fontSize: 12, color: '#555', fontWeight: 600 }}>QR deu &quot;Não foi possível conectar&quot;? Pareie por código:</span>
          <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="Número com DDI (ex.: 5555999999999)" inputMode="tel"
            style={{ flex: 1, minWidth: 200, padding: '8px 11px', borderRadius: 8, border: '1px solid #e6e6e6', fontSize: 12.5, fontFamily: 'inherit' }} />
          <button onClick={() => conectar(true)} disabled={ocupado}
            style={{ padding: '8px 14px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>{ocupado ? 'Gerando…' : 'Gerar código'}</button>
        </div>
      )}

      {estado === 'open' && !qr && (
        <p style={{ margin: 0, fontSize: 12.5, color: '#166534' }}>WhatsApp conectado e recebendo mensagens no CRM (aba Mensagens). Para trocar de número, clique em Desconectar e conecte o novo pelo QR.</p>
      )}

      {(qr || codigo) && (
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
          {qr && <img src={qr} alt="QR Code do WhatsApp" style={{ width: 220, height: 220, borderRadius: 12, border: '1px solid #eee' }} />}
          <div style={{ fontSize: 12.5, color: '#555', lineHeight: 1.7, maxWidth: 320 }}>
            <b>Como parear:</b><br />
            No celular: WhatsApp → <b>Aparelhos conectados</b> → <b>Conectar um aparelho</b>{qr ? <> → escaneie o QR.</> : <>.</>}
            {codigo && <><br /><br />Por <b>código</b>: na mesma tela, toque em <b>&quot;Conectar com número de telefone&quot;</b> e digite: <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 15, letterSpacing: 1 }}>{codigo}</span></>}
            <br /><br /><span style={{ color: '#999' }}>O status atualiza sozinho quando conectar. O número segue normal no celular. O código expira rápido — se passar de ~1 min, gere outro.</span>
          </div>
        </div>
      )}
    </div>
  )
}
