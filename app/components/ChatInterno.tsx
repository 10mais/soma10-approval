'use client'
import { useEffect, useRef, useState } from 'react'

type Contato = { email: string; nome: string; role: string; ultimaMensagem: string; ultimaEm: string; naoLidas: number }
type Mensagem = { id: string; de: string; deNome: string; para: string; texto: string; criadoEm: string }

function horaCurta(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const hoje = new Date()
  const mesmaData = d.toDateString() === hoje.toDateString()
  return mesmaData
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function ChatInterno({ meuEmail }: { meuEmail: string }) {
  const [contatos, setContatos] = useState<Contato[]>([])
  const [ativo, setAtivo] = useState<Contato | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const fimRef = useRef<HTMLDivElement>(null)
  const ativoRef = useRef<Contato | null>(null)
  ativoRef.current = ativo

  async function carregarContatos() {
    const res = await fetch('/api/mensagens?contatos=1').then(r => r.json()).catch(() => [])
    if (Array.isArray(res)) setContatos(res)
  }

  async function carregarThread(c: Contato, rolar = true) {
    const res = await fetch(`/api/mensagens?com=${encodeURIComponent(c.email)}`).then(r => r.json()).catch(() => [])
    if (Array.isArray(res)) {
      setMensagens(res)
      if (rolar) setTimeout(() => fimRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  useEffect(() => { carregarContatos() }, [])

  // Polling: atualiza contatos e a conversa aberta a cada 4s
  useEffect(() => {
    const t = setInterval(() => {
      carregarContatos()
      if (ativoRef.current) carregarThread(ativoRef.current, false)
    }, 4000)
    return () => clearInterval(t)
  }, [])

  function abrir(c: Contato) {
    setAtivo(c)
    setMensagens([])
    carregarThread(c)
    setContatos(lista => lista.map(x => x.email === c.email ? { ...x, naoLidas: 0 } : x))
  }

  async function enviar() {
    const t = texto.trim()
    if (!t || !ativo || enviando) return
    setEnviando(true)
    setTexto('')
    const res = await fetch('/api/mensagens', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ para: ativo.email, texto: t }),
    }).then(r => r.json()).catch(() => null)
    if (res?.mensagem) {
      setMensagens(m => [...m, res.mensagem])
      setTimeout(() => fimRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      carregarContatos()
    }
    setEnviando(false)
  }

  const inicial = (n: string) => (n || '?')[0]?.toUpperCase()

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 0, height: 'calc(100vh - 180px)', minHeight: 420, background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      {/* Lista de contatos */}
      <div style={{ borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #f0f0f0' }}>
          {/* "Chat interno" e não "Mensagens": Mensagens é a caixa de entrada do
              CLIENTE no CRM (WhatsApp/Instagram). Aqui é a conversa da EQUIPE. */}
          <h3 style={{ margin: 0, fontSize: 15, color: '#111' }}>Chat interno</h3>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {contatos.map(c => (
            <button key={c.email} onClick={() => abrir(c)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', border: 'none', cursor: 'pointer', textAlign: 'left',
              background: ativo?.email === c.email ? '#fffbeb' : 'transparent', borderBottom: '1px solid #f7f7f7',
            }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: c.email === 'equipe' ? '#111' : '#ffc00f', color: c.email === 'equipe' ? '#ffc00f' : '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                {c.email === 'equipe' ? '#' : inicial(c.nome)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</span>
                  <span style={{ fontSize: 10, color: '#bbb', flexShrink: 0 }}>{horaCurta(c.ultimaEm)}</span>
                </div>
                <span style={{ fontSize: 12, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{c.ultimaMensagem || 'Sem mensagens'}</span>
              </div>
              {c.naoLidas > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 }}>{c.naoLidas}</span>
              )}
            </button>
          ))}
          {contatos.length === 0 && <p style={{ padding: 16, fontSize: 13, color: '#aaa' }}>Nenhum colega na equipe ainda.</p>}
        </div>
      </div>

      {/* Conversa */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!ativo ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 14 }}>
            Selecione uma conversa para começar.
          </div>
        ) : (
          <>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: ativo.email === 'equipe' ? '#111' : '#ffc00f', color: ativo.email === 'equipe' ? '#ffc00f' : '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>
                {ativo.email === 'equipe' ? '#' : inicial(ativo.nome)}
              </div>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{ativo.nome}</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 10, background: '#fafafa' }}>
              {mensagens.map(m => {
                const meu = m.de === meuEmail
                return (
                  <div key={m.id} style={{ alignSelf: meu ? 'flex-end' : 'flex-start', maxWidth: '72%' }}>
                    {ativo.email === 'equipe' && !meu && (
                      <span style={{ fontSize: 10, color: '#aaa', marginLeft: 6 }}>{m.deNome}</span>
                    )}
                    <div style={{
                      background: meu ? '#ffc00f' : '#fff', color: '#111', borderRadius: 14, padding: '9px 13px', fontSize: 13, lineHeight: 1.45,
                      border: meu ? 'none' : '1px solid #eee', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>{m.texto}</div>
                    <div style={{ fontSize: 9, color: '#bbb', textAlign: meu ? 'right' : 'left', marginTop: 2 }}>{horaCurta(m.criadoEm)}</div>
                  </div>
                )
              })}
              {mensagens.length === 0 && <p style={{ color: '#bbb', fontSize: 13, textAlign: 'center', margin: 'auto' }}>Nenhuma mensagem ainda. Diga olá!</p>}
              <div ref={fimRef} />
            </div>

            <div style={{ padding: 14, borderTop: '1px solid #f0f0f0', display: 'flex', gap: 10 }}>
              <input value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                placeholder="Escreva uma mensagem..."
                style={{ flex: 1, padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
              <button onClick={enviar} disabled={enviando || !texto.trim()}
                style={{ padding: '0 22px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: enviando || !texto.trim() ? 0.5 : 1 }}>
                Enviar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
