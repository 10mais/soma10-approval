'use client'
import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { ehRotaPublica } from '@/lib/rotasPublicas'
import { comprimirImagemChat } from '@/lib/comprimirImagem'

type Proposta = { id: string; acao: string; params: any; resumo: string; agenteId?: string; agenteNome?: string; estado?: 'pendente' | 'executando' | 'feito' | 'erro' | 'cancelado'; msg?: string }
type Msg = { role: 'user' | 'assistant'; content: string; imagens?: string[]; propostas?: Proposta[] }

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
  const pathname = usePathname()
  const rotaPublica = ehRotaPublica(pathname)
  // Perfil da instância — troca as sugestões iniciais pelo nicho (ex.: varejo telefonia)
  const [perfil, setPerfil] = useState<string | null>(null)
  useEffect(() => { fetch('/api/marca').then(r => r.json()).then(d => setPerfil(d?.perfil || null)).catch(() => {}) }, [])

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
  // Espelho de msgs/agentes para o salvamento: no finally do streaming o state
  // ainda não propagou, e salvaríamos a conversa sem a última resposta.
  const msgsRef = useRef<Msg[]>([])
  const agentesRef = useRef<any[]>([])
  const [input, setInput] = useState('')
  const [carregando, setCarregando] = useState(false)
  const fimRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // Prints anexados (ex.: screenshot de conversa) — sobem comprimidos ao Blob e
  // vão como blocos de imagem para a IA "ler" e ajudar no atendimento.
  const [pendImgs, setPendImgs] = useState<string[]>([])
  const [subindoImg, setSubindoImg] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  async function anexarImagens(files: FileList | null) {
    if (!files || !files.length || subindoImg) return
    setSubindoImg(true)
    try {
      const { upload } = await import('@vercel/blob/client')
      for (const file of Array.from(files).slice(0, 4 - pendImgs.length)) {
        if (!file.type.startsWith('image/')) continue
        const leve = await comprimirImagemChat(file)
        const blob = await upload(`assistente/${Date.now()}-${leve.name}`, leve, { access: 'public', handleUploadUrl: '/api/upload' })
        setPendImgs(p => [...p, blob.url].slice(0, 4))
      }
    } catch { /* upload falhou — usuário tenta de novo */ }
    setSubindoImg(false)
    if (fileRef.current) fileRef.current.value = ''
  }
  // HISTÓRICO: cada conversa fica salva no servidor (pedido do dono, 16/07 —
  // "podemos reaproveitar a qualquer momento"). O sessionStorage segue como
  // cache da conversa ABERTA (recarregar a aba não recomeça); a fonte de
  // verdade é /api/assistente/conversas.
  const [convId, setConvId] = useState('')
  const [historico, setHistorico] = useState<{ id: string; titulo: string; agenteNome?: string; atualizadoEm: string }[]>([])
  const [histAberto, setHistAberto] = useState(false)
  const carregarHistorico = () => {
    fetch('/api/assistente/conversas').then(r => r.json())
      .then(d => setHistorico(Array.isArray(d?.conversas) ? d.conversas : [])).catch(() => {})
  }
  useEffect(() => { if (aberto && status === 'authenticated' && role !== 'cliente') carregarHistorico() }, [aberto, status, role])

  async function abrirConversa(id: string) {
    const d = await fetch(`/api/assistente/conversas?id=${id}`).then(r => r.json()).catch(() => null)
    if (!d?.conversa) return
    setConvId(d.conversa.id)
    setAgenteId(d.conversa.agenteId || '')
    setMsgs(d.conversa.mensagens || [])
    setHistAberto(false)
  }
  async function excluirConversa(id: string) {
    await fetch(`/api/assistente/conversas?id=${id}`, { method: 'DELETE' }).catch(() => {})
    if (id === convId) { setConvId(''); setMsgs([]) }
    carregarHistorico()
  }
  function novaConversa() {
    setConvId(''); setMsgs([]); setHistAberto(false)
    try { sessionStorage.removeItem(STORAGE_KEY) } catch {}
  }

  // Agentes treinados: quando um é escolhido, a persona dele assume a conversa
  const [agentes, setAgentes] = useState<any[]>([])
  const [agenteId, setAgenteId] = useState('')
  useEffect(() => {
    if (status !== 'authenticated' || role === 'cliente') return
    // Rebusca ao autenticar E ao abrir o assistente, para refletir agentes recem-criados
    if (!aberto) return
    fetch('/api/agentes').then(r => r.json()).then(d => { const lista = Array.isArray(d) ? d.filter((a: any) => a.ativo !== false) : []; setAgentes(lista); agentesRef.current = lista }).catch(() => {})
  }, [status, aberto])
  const agenteAtivo = agentes.find(a => a.id === agenteId)
  function trocarAgente(id: string) {
    if (id === agenteId) return
    setAgenteId(id)
    // Nova conversa ao trocar de agente (evita mistura de personas). A anterior
    // NÃO se perde: já está salva no histórico.
    setMsgs([])
    setConvId('')
  }

  // Fase 2: confirmar/descartar uma ação proposta pelo agente
  async function confirmarAcao(mi: number, propId: string) {
    const prop = msgs[mi]?.propostas?.find(p => p.id === propId)
    if (!prop || prop.estado === 'executando' || prop.estado === 'feito') return
    setMsgs(m => m.map((mm, i) => i === mi ? { ...mm, propostas: mm.propostas?.map(p => p.id === propId ? { ...p, estado: 'executando' } : p) } : mm))
    const r = await fetch('/api/agentes/executar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: prop.acao, params: prop.params, agenteId: prop.agenteId, agenteNome: prop.agenteNome }) }).then(x => x.json()).catch(() => null)
    setMsgs(m => m.map((mm, i) => i === mi ? { ...mm, propostas: mm.propostas?.map(p => p.id === propId ? (r?.ok ? { ...p, estado: 'feito', msg: r.resumo } : { ...p, estado: 'erro', msg: r?.error || 'Falha ao executar' }) : p) } : mm))
  }
  function descartarAcao(mi: number, propId: string) {
    setMsgs(m => m.map((mm, i) => i === mi ? { ...mm, propostas: mm.propostas?.map(p => p.id === propId ? { ...p, estado: 'cancelado' } : p) } : mm))
  }

  // Restaura a conversa (persiste durante a sessao do navegador)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) setMsgs(JSON.parse(raw))
    } catch {}
  }, [])

  useEffect(() => {
    msgsRef.current = msgs
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
    if ((!texto && !pendImgs.length) || carregando || subindoImg) return
    setInput('')
    const imagens = pendImgs
    setPendImgs([])
    const novas: Msg[] = [...msgs, { role: 'user', content: texto, ...(imagens.length ? { imagens } : {}) }]
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
        const corte = acumulado.indexOf('␞')
        const texto = corte >= 0 ? acumulado.slice(0, corte) : acumulado
        setMsgs(m => {
          const c = [...m]
          c[c.length - 1] = { ...c[c.length - 1], role: 'assistant', content: texto }
          return c
        })
      }
      // Ações propostas pelo agente (após a sentinela ␞) → viram cartões de confirmação
      const corte = acumulado.indexOf('␞')
      if (corte >= 0) {
        try {
          const props = JSON.parse(acumulado.slice(corte + 1))
          if (Array.isArray(props) && props.length) {
            setMsgs(m => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], propostas: props.map((p: any) => ({ ...p, estado: 'pendente' as const })) }; return c })
          }
        } catch { /* sentinela incompleta — ignora */ }
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
      salvarConversa()
    }
  }

  // Salva depois de CADA resposta. Não é debounce nem "ao fechar": fechar a aba,
  // cair a rede ou a pessoa mudar de tela não pode levar a conversa junto.
  // Usa o ref (msgsRef) porque o setMsgs do streaming não terminou de propagar
  // quando o finally roda — o state aqui ainda seria o de antes da resposta.
  async function salvarConversa() {
    const mensagens = msgsRef.current
    if (!mensagens.some(m => (m.content || '').trim() || m.imagens?.length)) return
    const d = await fetch('/api/assistente/conversas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: convId || undefined, agenteId: agenteId || undefined, agenteNome: agentesRef.current.find(a => a.id === agenteId)?.nome, mensagens }),
    }).then(r => r.json()).catch(() => null)
    if (d?.conversa?.id) { setConvId(d.conversa.id); carregarHistorico() }
  }

  // "Limpar" some com a conversa da TELA, não do histórico: ela continua salva
  // (é isso que o dono pediu). Para apagar de vez, o × na lista do histórico.
  function limpar() {
    novaConversa()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar()
    }
  }

  // So aparece para a equipe autenticada (nao para o portal do cliente nem em paginas publicas)
  if (rotaPublica || status !== 'authenticated' || role === 'cliente') return null

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
            background: 'var(--v2-amber-on)', color: '#17150E',
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
            background: 'var(--v2-surface)', borderRadius: 16, boxShadow: '0 16px 48px rgba(0,0,0,0.26)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            border: '1px solid var(--v2-rule)',
          }}
        >
          {/* Cabecalho */}
          <div style={{ background: 'var(--v2-ink)', color: 'var(--v2-surface)', padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,192,15,0.16)', color: 'var(--v2-amber-on)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agenteAtivo ? agenteAtivo.nome : (ehVendas ? 'Assistente de Vendas' : 'Assistente de IA')}</p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--v2-ink3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agenteAtivo ? (agenteAtivo.funcao || 'Agente treinado') : (ehVendas ? 'Funil, prospecção e fechamento' : 'Copy, ideias e dados do sistema')}</p>
            </div>
            <button onClick={() => setHistAberto(v => !v)} title="Conversas salvas" style={{ background: 'none', border: 'none', color: histAberto ? 'var(--v2-amber-on)' : 'var(--v2-ink3)', cursor: 'pointer', padding: 4, display: 'flex' }}>
              <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8v4l3 2" /><circle cx="12" cy="12" r="9" />
              </svg>
            </button>
            {msgs.length > 0 && (
              <button onClick={limpar} title="Nova conversa (esta fica salva no histórico)" style={{ background: 'none', border: 'none', color: 'var(--v2-ink3)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            )}
            <button onClick={() => setAberto(false)} title="Fechar" aria-label="Fechar assistente" style={{ background: 'none', border: 'none', color: 'var(--v2-surface)', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: '0 2px' }}>×</button>
          </div>

          {/* Conversas salvas — cada uma fica no servidor, não no navegador */}
          {histAberto && (
            <div style={{ borderBottom: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', maxHeight: 240, overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--v2-surface1)' }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--v2-ink3)', flex: 1 }}>CONVERSAS SALVAS</span>
                <button onClick={novaConversa} style={{ padding: '4px 10px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 999, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>+ Nova</button>
              </div>
              {historico.length === 0 && <p style={{ margin: 0, padding: '12px', fontSize: 12, color: 'var(--v2-ink3)' }}>Nenhuma conversa salva ainda.</p>}
              {historico.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: '1px solid var(--v2-surface1)', background: c.id === convId ? 'var(--v2-amber-bg)' : 'transparent' }}>
                  <button onClick={() => abrirConversa(c.id)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, color: 'var(--v2-ink)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.titulo}</span>
                    <span style={{ display: 'block', fontSize: 10.5, color: 'var(--v2-ink3)' }}>
                      {c.agenteNome ? `${c.agenteNome} · ` : ''}{new Date(c.atualizadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </button>
                  <button onClick={() => excluirConversa(c.id)} title="Excluir esta conversa" style={{ background: 'none', border: 'none', color: 'var(--v2-ink3)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 2px' }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* Seletor de agente treinado */}
          {agentes.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--v2-rule)', background: 'var(--v2-surface)' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--v2-ink3)', flexShrink: 0 }}>Falar com</span>
              <select value={agenteId} onChange={e => trocarAgente(e.target.value)} style={{ flex: 1, minWidth: 0, padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--v2-rule)', fontSize: 12.5, fontFamily: 'inherit', background: 'var(--v2-surface)', cursor: 'pointer' }}>
                <option value="">Assistente padrão</option>
                {agentes.map(a => <option key={a.id} value={a.id}>{a.nome}{a.funcao ? ` — ${a.funcao}` : ''}</option>)}
              </select>
            </div>
          )}

          {/* Mensagens */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: 'var(--v2-surface1)' }}>
            {msgs.length === 0 && (
              <div style={{ color: 'var(--v2-ink3)', fontSize: 13, lineHeight: 1.6 }}>
                <p style={{ margin: '0 0 10px', fontWeight: 700, color: 'var(--v2-ink2)' }}>{agenteAtivo ? `Olá! Sou ${agenteAtivo.nome}.${agenteAtivo.descricao ? ` ${agenteAtivo.descricao}` : ''}` : 'Olá! Como posso ajudar?'}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {[
                    ...(ehVendas ? [
                      'Como está meu funil? O que priorizar?',
                      'Quebre esta objeção do cliente:',
                      'Escreva um script de follow-up para...',
                    ] : perfil === 'telefonia' ? [
                      'Quais produtos estão abaixo do estoque mínimo?',
                      'Resuma as vendas de hoje por loja',
                      'Escreva um anúncio de WhatsApp para o [produto]',
                      'Sugira um combo de acessórios para quem comprou um celular',
                    ] : [
                      'Quantas tarefas atrasadas temos?',
                      'Como está o funil de vendas?',
                      'Escreva uma legenda de Reels para...',
                    ]),
                  ].map((s, i) => (
                    <button key={i} onClick={() => { setInput(s); setTimeout(() => inputRef.current?.focus(), 30) }}
                      style={{ textAlign: 'left', background: 'var(--v2-surface)', border: '1px solid #eaeaea', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, color: 'var(--v2-ink2)', cursor: 'pointer' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12, gap: 8 }}>
                <div style={{
                  maxWidth: '88%', padding: '9px 13px', borderRadius: 13, fontSize: 13, lineHeight: 1.55,
                  background: m.role === 'user' ? 'var(--v2-ink)' : 'var(--v2-surface)',
                  color: m.role === 'user' ? 'var(--v2-surface)' : 'var(--v2-ink)',
                  border: m.role === 'user' ? 'none' : '1px solid var(--v2-surface2)',
                  borderBottomRightRadius: m.role === 'user' ? 4 : 13,
                  borderBottomLeftRadius: m.role === 'user' ? 13 : 4,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {m.imagens && m.imagens.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: m.content ? 6 : 0 }}>
                      {m.imagens.map((u, k) => (
                        <a key={k} href={u} target="_blank" rel="noreferrer">
                          <img src={u} alt="" style={{ width: 92, height: 92, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)' }} />
                        </a>
                      ))}
                    </div>
                  )}
                  {m.role === 'assistant'
                    ? (m.content
                        ? <div>{renderMarkdown(m.content)}</div>
                        : <span style={{ display: 'inline-flex', gap: 4 }}><Dot /><Dot d={0.2} /><Dot d={0.4} /></span>)
                    : m.content}
                </div>
                {/* Cartões de ação proposta (Fase 2) */}
                {m.propostas && m.propostas.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '88%' }}>
                    {m.propostas.map(p => (
                      <div key={p.id} style={{ border: `1.5px solid ${p.estado === 'feito' ? 'var(--v2-ok-bg)' : p.estado === 'erro' ? 'var(--v2-hot-bg)' : 'var(--v2-surface2)'}`, borderRadius: 12, padding: '10px 12px', background: 'var(--v2-surface)' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: p.estado === 'pendente' ? 9 : 4 }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" /></svg>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--v2-ink)', lineHeight: 1.4 }}>{p.resumo}</span>
                        </div>
                        {p.estado === 'pendente' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => confirmarAcao(i, p.id)} style={{ padding: '7px 14px', background: 'var(--v2-ok)', color: 'var(--v2-surface)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Confirmar</button>
                            <button onClick={() => descartarAcao(i, p.id)} style={{ padding: '7px 12px', background: 'var(--v2-surface)', color: 'var(--v2-ink3)', border: '1px solid var(--v2-rule)', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Descartar</button>
                          </div>
                        )}
                        {p.estado === 'executando' && <span style={{ fontSize: 12, color: 'var(--v2-ink3)', fontWeight: 600 }}>Executando…</span>}
                        {p.estado === 'feito' && <span style={{ fontSize: 12, color: 'var(--v2-ok)', fontWeight: 700 }}>✓ {p.msg || 'Feito.'}</span>}
                        {p.estado === 'erro' && <span style={{ fontSize: 12, color: 'var(--v2-hot)', fontWeight: 700 }}>{p.msg || 'Falha.'}</span>}
                        {p.estado === 'cancelado' && <span style={{ fontSize: 12, color: 'var(--v2-ink3)', fontWeight: 600 }}>Descartado</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={fimRef} />
          </div>

          {/* Prints anexados aguardando envio */}
          {(pendImgs.length > 0 || subindoImg) && (
            <div style={{ borderTop: '1px solid var(--v2-rule)', padding: '8px 10px 0', background: 'var(--v2-surface)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {pendImgs.map((u, k) => (
                <div key={k} style={{ position: 'relative' }}>
                  <img src={u} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--v2-rule)' }} />
                  <button onClick={() => setPendImgs(p => p.filter((_, j) => j !== k))} title="Remover"
                    style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'var(--v2-ink)', color: 'var(--v2-surface)', fontSize: 11, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>
                </div>
              ))}
              {subindoImg && <span style={{ fontSize: 11.5, color: 'var(--v2-ink3)', fontWeight: 600 }}>Enviando print…</span>}
            </div>
          )}
          {/* Entrada */}
          <div style={{ borderTop: pendImgs.length || subindoImg ? 'none' : '1px solid var(--v2-surface2)', padding: 10, background: 'var(--v2-surface)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => anexarImagens(e.target.files)} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={subindoImg || pendImgs.length >= 4}
              title="Anexar print (a IA lê a imagem)"
              aria-label="Anexar imagem"
              style={{ width: 40, height: 40, borderRadius: 11, border: '1px solid var(--v2-rule)', flexShrink: 0, background: 'var(--v2-surface)', color: subindoImg || pendImgs.length >= 4 ? 'var(--v2-ink3)' : 'var(--v2-ink2)', cursor: subindoImg || pendImgs.length >= 4 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <textarea lang="pt-BR"
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Escreva sua mensagem..."
              rows={1}
              style={{ flex: 1, resize: 'none', maxHeight: 120, border: '1px solid var(--v2-rule)', borderRadius: 11, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none', lineHeight: 1.4 }}
            />
            <button
              onClick={enviar}
              disabled={(!input.trim() && !pendImgs.length) || carregando || subindoImg}
              title="Enviar"
              aria-label="Enviar mensagem"
              style={{
                width: 40, height: 40, borderRadius: 11, border: 'none', flexShrink: 0,
                background: (!input.trim() && !pendImgs.length) || carregando || subindoImg ? 'var(--v2-surface2)' : 'var(--v2-ink)',
                color: (!input.trim() && !pendImgs.length) || carregando || subindoImg ? 'var(--v2-ink3)' : 'var(--v2-amber-on)',
                cursor: (!input.trim() && !pendImgs.length) || carregando || subindoImg ? 'not-allowed' : 'pointer',
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
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--v2-rule2)', display: 'inline-block', animation: 'shimmer 1s infinite', animationDelay: `${d}s` }} />
}
