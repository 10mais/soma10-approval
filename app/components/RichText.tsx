'use client'
import { useEffect, useRef, useState } from 'react'

// Editor de texto rico leve (sem dependências): negrito, itálico, sublinhado,
// cores e links clicáveis. Guarda HTML. Usa document.execCommand (suportado em
// todos os navegadores atuais). Colar texto vira link clicável automaticamente.

const CORES = ['#111111', '#dc2626', '#ea580c', '#16a34a', '#1d4ed8', '#7c3aed', '#888888']

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function linkify(s: string) {
  return s.replace(/(https?:\/\/[^\s<]+)/g, u => `<a href="${u}" target="_blank" rel="noreferrer">${u}</a>`)
}
// Conteúdo já é HTML se tiver uma tag OU uma entidade (&nbsp; &amp; etc.).
// Sem checar entidades, um espaço (&nbsp;) fazia re-escapar e virar literal na tela.
const ehHtml = (s: string) => /<[a-z!/][\s\S]*>/i.test(s) || /&(nbsp|amp|lt|gt|quot|#\d+);/i.test(s)

export default function RichText({ value, onChange, placeholder = '', minHeight = 80, completo = false }: { value: string; onChange: (html: string) => void; placeholder?: string; minHeight?: number; completo?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [corAberta, setCorAberta] = useState(false)

  // Sincroniza só quando o valor muda de fora (não a cada tecla, p/ não resetar o cursor)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Conteúdo vindo do app: HTML é usado direto; texto puro antigo é convertido (quebras + links)
    const desejado = value ? (ehHtml(value) ? value : linkify(escapeHtml(value)).replace(/\n/g, '<br>')) : ''
    if (el.innerHTML !== desejado) el.innerHTML = desejado
  }, [value])

  const emit = () => onChange(ref.current?.innerHTML || '')
  const cmd = (c: string, arg?: string) => { ref.current?.focus(); document.execCommand(c, false, arg); emit() }

  function onPaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const texto = e.clipboardData.getData('text/plain')
    const html = linkify(escapeHtml(texto)).replace(/\n/g, '<br>')
    document.execCommand('insertHTML', false, html)
    emit()
  }

  function inserirLink() {
    const selecao = window.getSelection()?.toString() || ''
    const url = window.prompt('URL do link:', 'https://')
    if (!url || url === 'https://') return
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
    ref.current?.focus()
    if (selecao) document.execCommand('createLink', false, href)
    else document.execCommand('insertHTML', false, `<a href="${href}" target="_blank" rel="noreferrer">${escapeHtml(href)}</a>`)
    emit()
  }

  // Clique num link abre em nova aba (dentro do editor o navegador não navega sozinho)
  function onClick(e: React.MouseEvent) {
    const a = (e.target as HTMLElement).closest('a')
    if (a) { e.preventDefault(); window.open(a.getAttribute('href') || '', '_blank', 'noopener,noreferrer') }
  }

  const Btn = ({ onClick: oc, title, children, ativo }: any) => (
    <button type="button" title={title} onMouseDown={e => { e.preventDefault(); oc() }}
      style={{ width: 28, height: 28, border: 'none', borderRadius: 6, background: ativo ? '#eee' : 'transparent', cursor: 'pointer', fontSize: 14, color: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</button>
  )

  return (
    <div style={{ border: '1.5px solid #e0e0e0', borderRadius: 10, overflow: 'visible', position: 'relative' }}>
      <style>{`.rt-edit:empty:before{content:attr(data-ph);color:#aaa}.rt-edit a{color:#1d4ed8;text-decoration:underline}
        .rt-edit h1{font-size:1.5em;font-weight:800;margin:.5em 0 .3em}.rt-edit h2{font-size:1.25em;font-weight:800;margin:.5em 0 .3em}.rt-edit h3{font-size:1.08em;font-weight:700;margin:.4em 0 .2em}
        .rt-edit ul,.rt-edit ol{padding-left:1.4em;margin:.3em 0}.rt-edit li{margin:.15em 0}
        .rt-edit blockquote{border-left:3px solid #e0e0e0;margin:.4em 0;padding:.1em 0 .1em .8em;color:#666}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 4, borderBottom: '1px solid #f0f0f0', background: '#fafafa', borderRadius: '8px 8px 0 0', flexWrap: 'wrap' }}>
        <Btn title="Negrito" onClick={() => cmd('bold')}><b>B</b></Btn>
        <Btn title="Itálico" onClick={() => cmd('italic')}><i>I</i></Btn>
        <Btn title="Sublinhado" onClick={() => cmd('underline')}><u>U</u></Btn>
        <div style={{ width: 1, height: 18, background: '#e5e5e5', margin: '0 3px' }} />
        <div style={{ position: 'relative' }}>
          <Btn title="Cor do texto" onClick={() => setCorAberta(v => !v)}><span style={{ borderBottom: '3px solid #dc2626', lineHeight: 0.9 }}>A</span></Btn>
          {corAberta && (
            <div style={{ position: 'absolute', top: 30, left: 0, zIndex: 20, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 6, display: 'flex', gap: 5, boxShadow: '0 4px 14px rgba(0,0,0,0.12)' }}>
              {CORES.map(c => (
                <button key={c} type="button" title={c} onMouseDown={e => { e.preventDefault(); cmd('foreColor', c); setCorAberta(false) }}
                  style={{ width: 18, height: 18, borderRadius: '50%', border: '1px solid rgba(0,0,0,0.1)', background: c, cursor: 'pointer' }} />
              ))}
            </div>
          )}
        </div>
        <Btn title="Inserir link" onClick={inserirLink}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></svg>
        </Btn>
        {completo && <>
          <div style={{ width: 1, height: 18, background: '#e5e5e5', margin: '0 3px' }} />
          <Btn title="Título" onClick={() => cmd('formatBlock', 'H2')}><b style={{ fontSize: 13 }}>H1</b></Btn>
          <Btn title="Subtítulo" onClick={() => cmd('formatBlock', 'H3')}><b style={{ fontSize: 11 }}>H2</b></Btn>
          <Btn title="Texto normal" onClick={() => cmd('formatBlock', 'P')}><span style={{ fontSize: 11 }}>¶</span></Btn>
          <Btn title="Lista com marcadores" onClick={() => cmd('insertUnorderedList')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
          </Btn>
          <Btn title="Lista numerada" onClick={() => cmd('insertOrderedList')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4l2-2.5V15a1 1 0 0 0-2 0" /></svg>
          </Btn>
          <Btn title="Citação" onClick={() => cmd('formatBlock', 'BLOCKQUOTE')}><span style={{ fontSize: 15, fontWeight: 800, lineHeight: 0.6 }}>&rdquo;</span></Btn>
          <div style={{ width: 1, height: 18, background: '#e5e5e5', margin: '0 3px' }} />
          <Btn title="Alinhar à esquerda" onClick={() => cmd('justifyLeft')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h12M3 18h15" /></svg>
          </Btn>
          <Btn title="Centralizar" onClick={() => cmd('justifyCenter')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M6 12h12M5 18h14" /></svg>
          </Btn>
          <Btn title="Alinhar à direita" onClick={() => cmd('justifyRight')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M9 12h12M6 18h15" /></svg>
          </Btn>
        </>}
      </div>
      <div
        ref={ref}
        className="rt-edit"
        data-ph={placeholder}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onPaste={onPaste}
        onClick={onClick}
        title="Clique num link para abrir em nova aba"
        style={{ minHeight, padding: '10px 12px', fontSize: 13, lineHeight: 1.5, outline: 'none', color: '#222', fontFamily: 'inherit', wordBreak: 'break-word' }}
      />
    </div>
  )
}
