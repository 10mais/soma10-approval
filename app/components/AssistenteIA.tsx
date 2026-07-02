'use client'
import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'

type Msg = { role: 'user' | 'assistant'; content: string }

const STORAGE_KEY = 'soma10_assistente_conversa'

// Markdown leve: negrito, codigo inline, titulos e listas. Sem dependencias.
function renderMarkdown(texto: string) {
  const linhas = texto.split('\n')
  const out: any[] = []
  let lista: string[] = []

  const inline = (s: string, key: string) => {
    // Escapa e aplica **negrito** e `codigo`
    const partes: any[] = []
    let resto = s
    let i = 0
    const regex = /\*\*(.+?)\*\*|`(.+?)`/g
    let m: RegExpExecArray | null
    let last = 0
    while ((m = regex.exec(s))) {
      if (m.index > last) partes.push(s.slice(last, m.index))
      if (m[1] != null) partes.push(<strong key={`${key}-b-${i++}`}>{m[1]}</strong>)
      else if (m[2] != null) partes.push(<code key={`${key}-c-${i++}`} style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 5px', borderRadius: 4, fontSize: 12.5 }}>{m[2]}</code>)
      last = m.index + m[0].length
    }
    if (last < s.length) partes.push(s.slice(last))
    return partes.length ? partes : resto
  }

  const flushLista = (key: string) => {
    if (!lista.length) return
    out.push(
      <ul key={`ul-${key}`} style={{ margin: '4px 0', paddingLeft: 18 }}>
        {lista.map((li, idx) => <li key={idx} style={{ marginBottom: 2 }}>{inline(li, `${key}-li-${idx}`)}</li>)}
      </ul>
    )
    lista = []
  }

  linhas.forEach((linha, idx) => {
    const l = linha.trimEnd()
    const liMatch = l.match(/^\s*[-*]\s+(.*)$/)
    const hMatch = l.match(/^(#{1,3})\s+(.*)$/)
    if (liMatch) {
      lista.push(liMatch[1])
      return
    }
    flushLista(`${idx}`)
    if (hMatch) {
      out.push(<p key={idx} style={{ margin: '8px 0 4px', fontWeight: 800, fontSize: 13.5 }}>{inline(hMatch[2], `h-${idx}`)}</p>)
    } else if (l.trim() === '') {
      out.push(<div key={idx} style={{ height: 6 }} />)
    } else {
      out.push(<p key={idx} style={{ margin: '2px 0' }}>{inline(l, `p-${idx}`)}</p>)
    }
  })
  flushLista('fim')
  return out
}

export default function AssistenteIA() {
  const { data: session, status } = useSession()
  const role = (session?.user as any)?.role
  const ehVendas = role === 'vendas'

  const [aberto, setAberto] = useState(false)
  // No mobile o botao sobe acima da barra de navegacao inferior
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const apply = () => setMobile(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  const fabBottom = mobile ? 'calc(76px + env(safe-area-inset-bottom) + 12px)' : 20
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [carregando, setCarregando] = useState(false)
  const fimRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // Agentes treinados: quando um é escolhido, a persona dele assume a conversa
  const [agentes, setAgentes] = useState<any[]>([])
  const [agenteId, setAgenteId] = useState('')
  useEffect(() => {
    if (status !== 'authenticated' || role === 'cliente') return
    fetch('/api/agentes').then(r => r.json()).then(d => setAgentes(Array.isArray(d) ? d.filter((a: any) => a.ativo !== false) : [])).catch(() => {})
  }, [status])
  const agenteAtivo = agentes.find(a => a.id === agenteId)
  function trocarAgente(id: string) {
    if (id === agenteId) return
    setAgenteId(id)
    setMsgs([]) // nova conversa ao trocar de agente (evita mistura de personas)
  }

  // Restaura a conversa (persiste durante a sessao do navegador)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) setMsgs(JSON.parse(raw))
    } catch {}
  }, [])

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-30))) } catch {}
  }, [msgs])

  // Auto-scroll para a ultima mensagem
  useEffect(() => {
    if (aberto) fimRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, aberto, carregando])

  useEffect(() => {
    if (aberto) setTimeout(() => inputRef.current?.focus(), 80)
  }, [aberto])

  async function enviar() {
    const texto = input.trim()
    if (!texto || carregando) return
    setInput('')
    const novas: Msg[] = [...msgs, { role: 'user', content: texto }]
    setMsgs([...novas, { role: 'assistant', content: '' }])
    setCarregando(true)

    try {
      const resp = await fetch('/api/assistente/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: novas, agenteId }),
      })

      if (!resp.ok || !resp.body) {
        const erro = await resp.text().catch(() => '')
        setMsgs(m => {
          const c = [...m]
          c[c.length - 1] = { role: 'assistant', content: `Não consegui responder agora. ${erro || 'Tente novamente.'}` }
          return c
        })
        setCarregando(false)
        return
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let acumulado = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acumulado += decoder.decode(value, { stream: true })
        setMsgs(m => {
          const c = [...m]
          c[c.length - 1] = { role: 'assistant', content: acumulado }
          return c
        })
      }
    } catch {
      setMsgs(m => {
        const c = [...m]
        c[c.length - 1] = { role: 'assistant', content: 'Falha de conexão. Tente novamente.' }
        return c
      })
    } finally {
      setCarregando(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function limpar() {
    setMsgs([])
    try { sessionStorage.removeItem(STORAGE_KEY) } catch {}
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar()
    }
  }

  // So aparece para a equipe autenticada (nao para o portal do cliente)
  if (status !== 'authenticated' || role === 'cliente') return null

  return (
    <>
      {/* Botao flutuante */}
      {!aberto && (
        <button
          onClick={() => setAberto(true)}
          title="Assistente de IA"
          aria-label="Abrir assistente de IA"
          style={{
            position: 'fixed', right: 20, bottom: fabBottom, zIndex: 3500,
            width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: '#ffc00f', color: '#111',
            boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
            <path d="M19 14l.7 1.9L21.6 17l-1.9.7L19 19.6l-.7-1.9L16.4 17l1.9-.7L19 14z" />
          </svg>
        </button>
      )}

      {/* Painel de chat */}
      {aberto && (
        <div
          style={{
            position: 'fixed', right: 20, bottom: 20, zIndex: 3500,
            width: 'min(400px, calc(100vw - 40px))', height: 'min(620px, calc(100vh - 40px))',
            background: '#fff', borderRadius: 16, boxShadow: '0 16px 48px rgba(0,0,0,0.26)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            border: '1px solid #ececec',
          }}
        >
          {/* Cabecalho */}
          <div style={{ background: '#111', color: '#fff', padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,192,15,0.16)', color: '#ffc00f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agenteAtivo ? agenteAtivo.nome : (ehVendas ? 'Assistente de Vendas' : 'Assistente de IA')}</p>
              <p style={{ margin: 0, fontSize: 11, color: '#bbb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agenteAtivo ? (agenteAtivo.funcao || 'Agente treinado') : (ehVendas ? 'Funil, prospecção e fechamento' : 'Copy, ideias e dados do sistema')}</p>
            </div>
            {msgs.length > 0 && (
              <button onClick={limpar} title="Limpar conversa" style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: 4, display: 'flex' }}>
                <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
                </svg>
              </button>
            )}
            <button onClick={() => setAberto(false)} title="Fechar" aria-label="Fechar assistente" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: '0 2px' }}>×</button>
          </div>

          {/* Seletor de agente treinado */}
          {agentes.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid #f0f0f0', background: '#fff' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#888', flexShrink: 0 }}>Falar com</span>
              <select value={agenteId} onChange={e => trocarAgente(e.target.value)} style={{ flex: 1, minWidth: 0, padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 12.5, fontFamily: 'inherit', background: '#fff', cursor: 'pointer' }}>
                <option value="">Assistente padrão</option>
                {agentes.map(a => <option key={a.id} value={a.id}>{a.nome}{a.funcao ? ` — ${a.funcao}` : ''}</option>)}
              </select>
            </div>
          )}

          {/* Mensagens */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: '#fafafa' }}>
            {msgs.length === 0 && (
              <div style={{ color: '#888', fontSize: 13, lineHeight: 1.6 }}>
                <p style={{ margin: '0 0 10px', fontWeight: 700, color: '#555' }}>{agenteAtivo ? `Olá! Sou ${agenteAtivo.nome}.${agenteAtivo.descricao ? ` ${agenteAtivo.descricao}` : ''}` : 'Olá! Como posso ajudar?'}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {[
                    ...(ehVendas ? [
                      'Como está meu funil? O que priorizar?',
                      'Quebre esta objeção do cliente:',
                      'Escreva um script de follow-up para...',
                    ] : [
                      'Quantas tarefas atrasadas temos?',
                      'Como está o funil de vendas?',
                      'Escreva uma legenda de Reels para...',
                    ]),
                  ].map((s, i) => (
                    <button key={i} onClick={() => { setInput(s); setTimeout(() => inputRef.current?.focus(), 30) }}
                      style={{ textAlign: 'left', background: '#fff', border: '1px solid #eaeaea', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, color: '#444', cursor: 'pointer' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                <div style={{
                  maxWidth: '88%', padding: '9px 13px', borderRadius: 13, fontSize: 13, lineHeight: 1.55,
                  background: m.role === 'user' ? '#111' : '#fff',
                  color: m.role === 'user' ? '#fff' : '#222',
                  border: m.role === 'user' ? 'none' : '1px solid #ececec',
                  borderBottomRightRadius: m.role === 'user' ? 4 : 13,
                  borderBottomLeftRadius: m.role === 'user' ? 13 : 4,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {m.role === 'assistant'
                    ? (m.content
                        ? <div>{renderMarkdown(m.content)}</div>
                        : <span style={{ display: 'inline-flex', gap: 4 }}><Dot /><Dot d={0.2} /><Dot d={0.4} /></span>)
                    : m.content}
                </div>
              </div>
            ))}
            <div ref={fimRef} />
          </div>

          {/* Entrada */}
          <div style={{ borderTop: '1px solid #eee', padding: 10, background: '#fff', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Escreva sua mensagem..."
              rows={1}
              style={{ flex: 1, resize: 'none', maxHeight: 120, border: '1px solid #e2e2e2', borderRadius: 11, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none', lineHeight: 1.4 }}
            />
            <button
              onClick={enviar}
              disabled={!input.trim() || carregando}
              title="Enviar"
              aria-label="Enviar mensagem"
              style={{
                width: 40, height: 40, borderRadius: 11, border: 'none', flexShrink: 0,
                background: !input.trim() || carregando ? '#eee' : '#111',
                color: !input.trim() || carregando ? '#aaa' : '#ffc00f',
                cursor: !input.trim() || carregando ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function Dot({ d = 0 }: { d?: number }) {
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#bbb', display: 'inline-block', animation: 'shimmer 1s infinite', animationDelay: `${d}s` }} />
}
