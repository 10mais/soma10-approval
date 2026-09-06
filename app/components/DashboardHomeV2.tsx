'use client'
import { useEffect, useMemo, useRef, useState } from 'react'

// HOME NOVA (Soma10 Noturno) — perfil agência.
//
// A Home abre com UMA FRASE, pessoal e derivada (lib/manchete), e os números
// dentro dela são a interface: cada destaque leva ao bloco correspondente.
// Tudo vem de /api/home numa chamada; nada aqui grava.
//
// Convivência com o tema antigo: a raiz do dashboard aplica filter:invert no
// escuro. Este container leva .soma10-no-invert (cancela o invert) e pinta o
// escuro com tokens de verdade (globals.css, escopo .v2-home).

type Parte = { texto: string; destaque?: boolean; quente?: boolean; alvo?: 'tarefas' | 'clientes' | 'hoje' | 'reunioes' }
type Evento = { id: string; hora: string; minuto: number; tipo: 'post' | 'reuniao' | 'agenda'; titulo: string; detalhe?: string; feito?: boolean }
type Cartao = { id: string; nome: string; logo?: string; cor?: string; lado: 'cliente' | 'agencia' | 'ninguem'; frase: string; diasParado?: number; totalCliente: number; totalAgencia: number; primeiro?: string }
type ItemFila = { id: string; titulo: string; tipo?: string; status: string; prazo?: string; clienteNome?: string; anexos: number }
type Chegou = { id: string; ts: number; clienteId: string; clienteNome: string; tipo: string; acao: string; resumo?: string; postId?: string }
type Dados = {
  pessoa: { nome: string; email: string }; vendoComo: { nome: string; email: string } | null; ehAdmin: boolean
  equipe: { nome: string; email: string }[]
  manchete: { partes: Parte[]; subtitulo: string; tom: 'urgente' | 'normal' | 'tranquilo' }
  regra: { mes: string; nome: string; frase?: string } | null
  regua: Evento[]; agenda: { configurada: boolean; erro?: string }
  clientes: Cartao[]; fila: ItemFila[]; chegou: Chegou[]; geradoEm: number
}

const ALVO_ID: Record<string, string> = { tarefas: 'v2-fila', clientes: 'v2-clientes', hoje: 'v2-hoje', reunioes: 'v2-hoje' }
const TIPO_ROTULO: Record<string, string> = { carrossel: 'Carrossel', reel: 'Reel', story: 'Story', post: 'Post', criativo: 'Criativo', copy: 'Copy', briefing: 'Briefing', landing_page: 'Landing', campanha: 'Campanha', video: 'Vídeo', tarefa: 'Tarefa', planejamento: 'Plano', estrategia: 'Estratégia' }
const ACAO_CHEGOU: Record<string, string> = { aprovacao: 'Ver', ajuste_layout: 'Corrigir', ajuste_copy: 'Abrir no Studio', reprovacao: 'Abrir', corrigir_legenda: 'Ver', ajuste_aplicado: 'Ver', solicitacao_conteudo: 'Abrir' }

function iniciais(nome: string) { return nome.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '?' }
function pctRegua(min: number) { return Math.max(0, Math.min(100, ((min - 8 * 60) / (12 * 60)) * 100)) }
function haQuanto(ts: number) { const m = Math.floor((Date.now() - ts) / 60000); if (m < 1) return 'agora'; if (m < 60) return `há ${m} min`; const h = Math.floor(m / 60); return h < 24 ? `há ${h}h` : 'ontem' }
function prazoCurto(iso?: string) {
  if (!iso) return { t: '—', hoje: false, atrasada: false }
  const d = new Date(iso), h = new Date(); h.setHours(0, 0, 0, 0)
  const diff = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - h.getTime()) / 86400000)
  if (diff < 0) return { t: `${-diff}d atrás`, hoje: false, atrasada: true }
  if (diff === 0) return { t: 'hoje', hoje: true, atrasada: false }
  if (diff === 1) return { t: 'amanhã', hoje: false, atrasada: false }
  return { t: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), hoje: false, atrasada: false }
}

export default function DashboardHomeV2({ tema, onIr, onVerCliente }: { tema: 'claro' | 'escuro'; onIr: (aba: string) => void; onVerCliente: (id: string) => void }) {
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const [como, setComo] = useState('')
  const [paleta, setPaleta] = useState(false)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  function carregar(c = como) {
    setErro('')
    fetch(`/api/home${c ? `?como=${encodeURIComponent(c)}` : ''}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((d: Dados) => setDados(d))
      .catch(e => setErro(e?.message || 'Não foi possível carregar a Home.'))
  }
  useEffect(() => { carregar() }, [como]) // eslint-disable-line react-hooks/exhaustive-deps

  // ⌘K / Ctrl+K enquanto a Home está montada
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaleta(p => !p); setQ(''); setSel(0) }
      else if (e.key === 'Escape') setPaleta(false)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])
  useEffect(() => { if (paleta) setTimeout(() => inputRef.current?.focus(), 20) }, [paleta])

  const itensPaleta = useMemo(() => {
    if (!dados) return [] as { k: string; t: string; d?: string; ir: () => void }[]
    const lista: { k: string; t: string; d?: string; ir: () => void }[] = []
    for (const c of dados.clientes) lista.push({ k: 'cliente', t: c.nome, d: c.lado === 'ninguem' ? 'em dia' : c.frase, ir: () => onVerCliente(c.id) })
    const abas: [string, string][] = [['planner', 'Planner'], ['studio', 'Studio'], ['tarefas', 'Tarefas'], ['solicitacoes', 'Solicitações do cliente'], ['crm', 'CRM'], ['playbook', 'Playbook'], ['reunioes', 'Reuniões internas'], ['rentabilidade', 'Financeiro'], ['analytics', 'Analytics'], ['clientes', 'Clientes'], ['config', 'Configurações'], ['novo-post', 'Novo post']]
    for (const [a, l] of abas) lista.push({ k: 'ir para', t: l, ir: () => onIr(a) })
    for (const t of dados.fila) lista.push({ k: 'tarefa', t: t.titulo, d: t.clienteNome, ir: () => onIr('tarefas') })
    return lista
  }, [dados, onIr, onVerCliente])
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const filtrados = useMemo(() => { const t = norm(q.trim()); return t ? itensPaleta.filter(i => norm(`${i.t} ${i.k} ${i.d || ''}`).includes(t)) : itensPaleta }, [q, itensPaleta])

  function irPara(alvo?: string) {
    const el = alvo && document.getElementById(ALVO_ID[alvo] || '')
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.remove('v2-flash'); void (el as HTMLElement).offsetWidth; el.classList.add('v2-flash')
    setTimeout(() => el.classList.remove('v2-flash'), 1000)
  }

  const agoraMin = (() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() })()
  const hojeTxt = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="soma10-v2 soma10-no-invert v2-home" data-theme={tema === 'escuro' ? 'dark' : 'light'}>
      <style>{`
        .v2-home { background: var(--v2-ground); color: var(--v2-ink); font-family: var(--v2-font); margin: -20px; padding: 26px 36px 90px; min-height: calc(100vh - 60px); border-radius: 0; }
        .v2-home *, .v2-home *::before, .v2-home *::after { box-sizing: border-box; }
        .v2-home button { font-family: inherit; }
        .v2-home :focus-visible { outline: 2px solid var(--v2-amber); outline-offset: 3px; border-radius: 6px; }
        .v2-wrap { max-width: 1180px; }
        .v2-top { display: flex; align-items: center; gap: 12px; margin-bottom: 30px; flex-wrap: wrap; }
        .v2-busca { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 240px; max-width: 460px; background: var(--v2-surface); border: 1px solid var(--v2-rule); border-radius: 12px; padding: 10px 14px; color: var(--v2-ink3); cursor: text; font-size: 14px; text-align: left; }
        .v2-busca:hover { border-color: var(--v2-rule2); }
        .v2-busca kbd { margin-left: auto; font-family: inherit; font-size: 11px; color: var(--v2-ink3); border: 1px solid var(--v2-rule2); border-radius: 5px; padding: 1px 6px; }
        .v2-data { margin-left: auto; font-size: 13.5px; color: var(--v2-ink2); text-transform: capitalize; }
        .v2-como { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--v2-ink3); }
        .v2-como select { font-family: inherit; font-size: 13px; padding: 7px 10px; border-radius: 9px; border: 1px solid var(--v2-rule); background: var(--v2-surface); color: var(--v2-ink); cursor: pointer; }
        .v2-regra { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; margin: 0 0 16px; }
        .v2-regra .mes { font-size: 11px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: var(--v2-amber); white-space: nowrap; }
        .v2-regra .nome { font-size: 15px; font-weight: 500; }
        .v2-regra .frase { flex-basis: 100%; font-size: 15px; font-weight: 300; color: var(--v2-ink2); margin: 0; max-width: 62ch; }
        .v2-regra .frase::before, .v2-regra .frase::after { content: "\\201C"; color: var(--v2-ink3); }
        .v2-regra .frase::after { content: "\\201D"; }
        .v2-manchete { font-weight: 300; font-size: clamp(28px, 3.9vw, 52px); line-height: 1.12; letter-spacing: -0.022em; margin: 0 0 10px; max-width: 26ch; color: var(--v2-ink2); text-wrap: balance; }
        .v2-manchete b { font-weight: 500; color: var(--v2-ink); cursor: pointer; border-bottom: 2px solid transparent; transition: border-color 140ms; font-variant-numeric: tabular-nums; }
        .v2-manchete b:hover { border-color: var(--v2-ink); }
        .v2-manchete b.hot { color: var(--v2-amber); }
        .v2-manchete b.hot:hover { border-color: var(--v2-amber); }
        .v2-sub { color: var(--v2-ink2); font-size: 15.5px; margin: 0 0 40px; font-weight: 300; }
        .v2-sec { margin-bottom: 40px; scroll-margin-top: 20px; }
        .v2-sec-h { display: flex; align-items: baseline; gap: 14px; margin-bottom: 12px; }
        .v2-sec-h h2 { font-size: 12.5px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: var(--v2-ink3); margin: 0; }
        .v2-sec-h .mais { margin-left: auto; font-size: 13px; color: var(--v2-ink2); background: none; border: 0; cursor: pointer; }
        .v2-sec-h .mais:hover { color: var(--v2-amber); }
        .v2-sec-h .dica { font-size: 12.5px; color: var(--v2-ink3); }
        @keyframes v2flash { 0% { box-shadow: 0 0 0 0 rgba(248,179,17,0);} 30% { box-shadow: 0 0 0 3px rgba(248,179,17,0.45);} 100% { box-shadow: 0 0 0 0 rgba(248,179,17,0);} }
        .v2-flash .v2-card, .v2-flash .v2-cli, .v2-flash .v2-dia { animation: v2flash 900ms ease-out 1; }
        .v2-card, .v2-dia { background: var(--v2-surface); border: 1px solid var(--v2-rule); border-radius: 18px; padding: 18px 20px; }
        .v2-card h3 { font-size: 12.5px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: var(--v2-ink3); margin: 0 0 12px; display: flex; gap: 10px; align-items: baseline; }
        .v2-card h3 span { margin-left: auto; font-size: 12px; letter-spacing: 0; text-transform: none; color: var(--v2-ink2); }
        .v2-regua { position: relative; height: 70px; margin: 6px 6px 0; }
        .v2-regua .linha { position: absolute; left: 0; right: 0; top: 30px; height: 1px; background: var(--v2-rule2); }
        .v2-regua .h { position: absolute; top: 40px; transform: translateX(-50%); font-size: 11px; color: var(--v2-ink3); font-variant-numeric: tabular-nums; }
        .v2-regua .agora { position: absolute; top: 12px; bottom: 8px; width: 2px; background: var(--v2-amber-on); transform: translateX(-50%); border-radius: 2px; }
        .v2-regua .agora::after { content: "agora"; position: absolute; top: -14px; left: 50%; transform: translateX(-50%); font-size: 10.5px; color: var(--v2-amber); letter-spacing: 0.06em; text-transform: uppercase; }
        .v2-ev { position: absolute; top: 30px; transform: translate(-50%, -50%); width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--v2-ground); background: var(--v2-ink2); cursor: default; transition: transform 140ms; }
        .v2-ev:hover { transform: translate(-50%, -50%) scale(1.35); z-index: 3; }
        .v2-ev.post { background: var(--v2-amber-on); }
        .v2-ev.reuniao { background: var(--v2-ok); border-radius: 4px; }
        .v2-ev.agenda { background: var(--v2-ink2); border-radius: 4px; transform: translate(-50%, -50%) rotate(45deg); }
        .v2-ev.agenda:hover { transform: translate(-50%, -50%) rotate(45deg) scale(1.3); }
        .v2-ev.feito { background: var(--v2-ink3); opacity: 0.6; }
        .v2-ev .tip { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: var(--v2-surface2); border: 1px solid var(--v2-rule2); border-radius: 8px; padding: 6px 10px; font-size: 12px; white-space: nowrap; color: var(--v2-ink); opacity: 0; pointer-events: none; transition: opacity 120ms; z-index: 4; }
        .v2-ev.agenda .tip { transform: translateX(-50%) rotate(-45deg); transform-origin: 0 100%; }
        .v2-ev:hover .tip { opacity: 1; }
        .v2-ev .tip small { display: block; color: var(--v2-ink3); font-size: 11px; }
        .v2-leg { display: flex; gap: 18px; margin-top: 6px; font-size: 12px; color: var(--v2-ink3); flex-wrap: wrap; }
        .v2-leg i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
        .v2-trilho { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(212px, 1fr); gap: 12px; overflow-x: auto; padding-bottom: 6px; scroll-snap-type: x mandatory; scrollbar-width: none; }
        .v2-trilho::-webkit-scrollbar { display: none; }
        .v2-cli { background: var(--v2-surface); border: 1px solid var(--v2-rule); border-radius: 18px; padding: 16px 16px 14px; scroll-snap-align: start; cursor: pointer; position: relative; transition: transform 160ms, border-color 160ms; text-align: left; }
        .v2-cli:hover { transform: translateY(-3px); border-color: var(--v2-rule2); }
        .v2-cli .logo { width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; font-weight: 600; font-size: 13px; margin-bottom: 14px; color: #17150E; background: var(--v2-amber-on); overflow: hidden; }
        .v2-cli .logo img { width: 100%; height: 100%; object-fit: cover; }
        .v2-cli .nome { font-size: 15.5px; font-weight: 500; margin: 0 0 4px; }
        .v2-cli .estado { font-size: 13px; color: var(--v2-ink2); margin: 0 0 12px; min-height: 38px; }
        .v2-bola { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; padding: 4px 9px; border-radius: 999px; }
        .v2-bola::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
        .v2-bola.cliente { color: var(--v2-amber); background: var(--v2-amber-bg); }
        .v2-bola.cliente.parado { color: var(--v2-hot); background: var(--v2-hot-bg); }
        .v2-bola.agencia { color: var(--v2-ok); background: var(--v2-ok-bg); }
        .v2-bola.ninguem { color: var(--v2-ink3); background: var(--v2-surface2); }
        .v2-cli .dias { position: absolute; top: 14px; right: 14px; font-size: 22px; font-weight: 300; color: var(--v2-ink3); font-variant-numeric: tabular-nums; line-height: 1; text-align: right; }
        .v2-cli .dias small { display: block; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; }
        .v2-cli.parado .dias { color: var(--v2-hot); }
        .v2-duas { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 16px; }
        @media (max-width: 900px) { .v2-duas { grid-template-columns: 1fr; } .v2-home { padding: 18px 16px 80px; } }
        .v2-t { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid var(--v2-rule); }
        .v2-t:first-of-type { border-top: 0; }
        .v2-t .tx { flex: 1; min-width: 0; }
        .v2-t .tx p { margin: 0; font-size: 14.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .v2-t .tx small { color: var(--v2-ink3); font-size: 12px; }
        .v2-tipo { font-size: 10.5px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 8px; border-radius: 6px; background: var(--v2-surface2); color: var(--v2-ink2); flex: 0 0 auto; }
        .v2-prazo { font-size: 12px; color: var(--v2-ink3); flex: 0 0 auto; font-variant-numeric: tabular-nums; }
        .v2-prazo.hoje { color: var(--v2-amber); }
        .v2-prazo.atrasada { color: var(--v2-hot); }
        .v2-sol { padding: 10px 0; border-top: 1px solid var(--v2-rule); display: flex; gap: 12px; align-items: flex-start; }
        .v2-sol:first-of-type { border-top: 0; }
        .v2-sol .av { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; font-size: 12px; font-weight: 600; color: #17150E; background: var(--v2-amber-on); flex: 0 0 auto; }
        .v2-sol p { margin: 0; font-size: 14px; }
        .v2-sol p b { font-weight: 500; }
        .v2-sol small { color: var(--v2-ink3); font-size: 12px; }
        .v2-sol .acao { margin-left: auto; font-size: 12px; color: var(--v2-amber); white-space: nowrap; background: none; border: 0; cursor: pointer; padding: 0; }
        .v2-vazio { color: var(--v2-ink3); font-size: 13.5px; padding: 8px 0; margin: 0; }
        .v2-erro { background: var(--v2-hot-bg); border: 1px solid var(--v2-hot); color: var(--v2-hot); border-radius: 12px; padding: 12px 16px; font-size: 14px; }
        .v2-skel { height: 14px; border-radius: 6px; background: var(--v2-surface2); }
        .v2-veu { position: fixed; inset: 0; background: rgba(8,7,4,0.62); backdrop-filter: blur(6px); display: flex; align-items: flex-start; justify-content: center; padding-top: 14vh; z-index: 3000; }
        .v2-pal { width: min(640px, 92vw); background: var(--v2-surface); border: 1px solid var(--v2-rule2); border-radius: 18px; overflow: hidden; box-shadow: 0 30px 80px rgba(0,0,0,0.45); }
        .v2-pal input { width: 100%; background: transparent; border: 0; border-bottom: 1px solid var(--v2-rule); color: var(--v2-ink); font-family: inherit; font-size: 18px; font-weight: 300; padding: 18px 20px; outline: none; }
        .v2-pal input::placeholder { color: var(--v2-ink3); }
        .v2-pal ul { list-style: none; margin: 0; padding: 8px; max-height: 50vh; overflow-y: auto; }
        .v2-pal li { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; cursor: pointer; font-size: 14.5px; }
        .v2-pal li:hover, .v2-pal li.sel { background: var(--v2-amber-bg); }
        .v2-pal li .k { font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--v2-ink3); width: 74px; flex: 0 0 auto; }
        .v2-pal li .d { margin-left: auto; font-size: 12px; color: var(--v2-ink3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 45%; }
        .v2-pal .rod { display: flex; gap: 16px; padding: 10px 16px; border-top: 1px solid var(--v2-rule); font-size: 11.5px; color: var(--v2-ink3); }
        .v2-pal .rod kbd { font-family: inherit; border: 1px solid var(--v2-rule2); border-radius: 4px; padding: 0 5px; margin-right: 4px; }
        .v2-nota { margin-top: 26px; font-size: 12.5px; color: var(--v2-ink3); }
        @keyframes v2sobe { from { opacity: 0; transform: translateY(10px);} to { opacity: 1; transform: none;} }
        .v2-a { animation: v2sobe 480ms cubic-bezier(.2,.7,.2,1) both; }
        .v2-a.d1 { animation-delay: 60ms; } .v2-a.d2 { animation-delay: 140ms; } .v2-a.d3 { animation-delay: 220ms; } .v2-a.d4 { animation-delay: 300ms; }
      `}</style>

      <div className="v2-wrap">
        <div className="v2-top v2-a">
          <button className="v2-busca" type="button" onClick={() => { setPaleta(true); setQ(''); setSel(0) }} aria-label="Buscar ou executar um comando">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            Buscar cliente, tarefa… ou digitar um comando
            <kbd>Ctrl K</kbd>
          </button>
          {dados?.ehAdmin && dados.equipe.length > 0 && (
            <label className="v2-como">Ver como
              <select value={como} onChange={e => setComo(e.target.value)}>
                <option value="">{dados.pessoa.email === (dados.vendoComo?.email || dados.pessoa.email) && !como ? 'eu mesmo' : 'eu mesmo'}</option>
                {dados.equipe.filter(u => u.email.toLowerCase() !== (dados.vendoComo ? '' : dados.pessoa.email.toLowerCase())).map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}
              </select>
            </label>
          )}
          <span className="v2-data">{hojeTxt}</span>
        </div>

        {erro && <p className="v2-erro">{erro} <button onClick={() => carregar()} style={{ marginLeft: 10, background: 'none', border: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}>tentar de novo</button></p>}

        {!dados && !erro && (
          <div aria-busy="true">
            <div className="v2-skel" style={{ width: '60%', height: 44, marginBottom: 14 }} />
            <div className="v2-skel" style={{ width: '40%', marginBottom: 40 }} />
            <div className="v2-skel" style={{ height: 120, borderRadius: 18 }} />
          </div>
        )}

        {dados && (
          <>
            {dados.regra && (
              <div className="v2-regra v2-a d1">
                <span className="mes">Regra de {dados.regra.mes}</span>
                <span className="nome">{dados.regra.nome}</span>
                {dados.regra.frase && <p className="frase">{dados.regra.frase}</p>}
              </div>
            )}

            <h1 className="v2-manchete v2-a d1">
              {dados.manchete.partes.map((p, i) => p.destaque
                ? <b key={i} className={p.quente ? 'hot' : ''} onClick={() => irPara(p.alvo)}>{p.texto}</b>
                : <span key={i}>{p.texto}</span>)}
            </h1>
            {dados.manchete.subtitulo && <p className="v2-sub v2-a d2">{dados.manchete.subtitulo}{dados.vendoComo ? ` · vendo como ${dados.vendoComo.nome}` : ''}</p>}

            {/* HOJE */}
            <section id="v2-hoje" className="v2-sec v2-a d3">
              <div className="v2-sec-h"><h2>Hoje</h2>{!dados.agenda.configurada && dados.ehAdmin && <span className="dica">Google Agenda ainda não conectada — só reuniões e publicações</span>}<button className="mais" onClick={() => onIr('planner')}>Abrir o Planner</button></div>
              <div className="v2-dia">
                {dados.regua.length === 0 && <p className="v2-vazio">Nada programado para hoje.</p>}
                <div className="v2-regua" aria-label="Linha do tempo de hoje">
                  <div className="linha" />
                  {[8, 10, 12, 14, 16, 18, 20].map(h => <span key={h} className="h" style={{ left: `${pctRegua(h * 60)}%` }}>{String(h).padStart(2, '0')}h</span>)}
                  {agoraMin >= 8 * 60 && agoraMin <= 20 * 60 && <div className="agora" style={{ left: `${pctRegua(agoraMin)}%` }} />}
                  {dados.regua.map(e => (
                    <span key={e.id} className={`v2-ev ${e.tipo}${e.feito ? ' feito' : ''}`} style={{ left: `${pctRegua(e.minuto)}%` }} tabIndex={0} aria-label={`${e.hora} ${e.titulo}`}>
                      <span className="tip">{e.titulo}<small>{e.hora}{e.detalhe ? ` · ${e.detalhe}` : ''}{e.feito ? ' · feito' : ''}</small></span>
                    </span>
                  ))}
                </div>
                <div className="v2-leg"><span><i style={{ background: 'var(--v2-amber-on)' }} />Publicação</span><span><i style={{ background: 'var(--v2-ok)', borderRadius: 2 }} />Reunião</span><span><i style={{ background: 'var(--v2-ink2)', borderRadius: 2, transform: 'rotate(45deg)' }} />Agenda Google</span><span><i style={{ background: 'var(--v2-ink3)' }} />Já passou</span></div>
              </div>
            </section>

            {/* CLIENTES */}
            <section id="v2-clientes" className="v2-sec v2-a d4">
              <div className="v2-sec-h"><h2>Clientes</h2><span className="dica">quem espera há mais tempo vem primeiro</span><button className="mais" onClick={() => onIr('clientes')}>Todos</button></div>
              {dados.clientes.length === 0 && <p className="v2-vazio">Nenhum cliente ativo.</p>}
              <div className="v2-trilho">
                {dados.clientes.map(c => {
                  const parado = c.lado === 'cliente' && (c.diasParado || 0) >= 3
                  return (
                    <button key={c.id} className={`v2-cli${parado ? ' parado' : ''}`} onClick={() => onVerCliente(c.id)} type="button">
                      {c.lado === 'cliente' && typeof c.diasParado === 'number' && c.diasParado > 0 && <div className="dias">{c.diasParado}<small>{c.diasParado === 1 ? 'dia' : 'dias'}</small></div>}
                      <div className="logo" style={c.cor ? { background: c.cor } : undefined}>{c.logo ? <img src={c.logo} alt="" /> : iniciais(c.nome)}</div>
                      <p className="nome">{c.nome}</p>
                      <p className="estado">{c.lado === 'ninguem' ? 'Nada pendente.' : <>{c.frase}{c.primeiro ? <> — <b style={{ fontWeight: 500 }}>{c.primeiro}</b></> : null}</>}</p>
                      <span className={`v2-bola ${c.lado}${parado ? ' parado' : ''}`}>{c.lado === 'cliente' ? 'Com o cliente' : c.lado === 'agencia' ? 'Com a equipe' : 'Em dia'}</span>
                    </button>
                  )
                })}
              </div>
            </section>

            <div className="v2-duas v2-a d4">
              <section id="v2-fila" className="v2-card" style={{ margin: 0 }}>
                <h3>{dados.vendoComo ? `Fila de ${dados.vendoComo.nome.split(' ')[0]}` : 'Sua fila'} <span>{dados.fila.length} {dados.fila.length === 1 ? 'tarefa' : 'tarefas'}</span></h3>
                {dados.fila.length === 0 && <p className="v2-vazio">Nenhuma tarefa aberta.</p>}
                {dados.fila.map(t => { const pz = prazoCurto(t.prazo); return (
                  <div key={t.id} className="v2-t" role="button" tabIndex={0} onClick={() => onIr('tarefas')} onKeyDown={e => { if (e.key === 'Enter') onIr('tarefas') }} style={{ cursor: 'pointer' }}>
                    <div className="tx"><p>{t.titulo}</p><small>{[t.clienteNome, t.status === 'em_revisao' ? 'Em revisão' : t.status === 'em_andamento' ? 'Em andamento' : 'A fazer', t.anexos ? `${t.anexos} anexo${t.anexos > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')}</small></div>
                    {t.tipo && <span className="v2-tipo">{TIPO_ROTULO[t.tipo] || t.tipo}</span>}
                    <span className={`v2-prazo${pz.hoje ? ' hoje' : ''}${pz.atrasada ? ' atrasada' : ''}`}>{pz.t}</span>
                  </div>
                ) })}
              </section>

              <section id="v2-chegou" className="v2-card" style={{ margin: 0 }}>
                <h3>Chegou do cliente <span>últimas 24h</span></h3>
                {dados.chegou.length === 0 && <p className="v2-vazio">Nada nas últimas 24 horas.</p>}
                {dados.chegou.map(l => (
                  <div key={l.id} className="v2-sol">
                    <span className="av">{iniciais(l.clienteNome)}</span>
                    <div style={{ minWidth: 0 }}><p><b>{l.clienteNome}</b> {l.acao.charAt(0).toLowerCase() + l.acao.slice(1)}</p><small>{haQuanto(l.ts)}{l.resumo ? ` · ${l.resumo.slice(0, 60)}${l.resumo.length > 60 ? '…' : ''}` : ''}</small></div>
                    <button className="acao" onClick={() => onIr('solicitacoes')}>{ACAO_CHEGOU[l.tipo] || 'Ver'}</button>
                  </div>
                ))}
              </section>
            </div>

            {dados.agenda.erro && dados.ehAdmin && <p className="v2-nota">Google Agenda: {dados.agenda.erro}</p>}
          </>
        )}
      </div>

      {paleta && (
        <div className="v2-veu" role="dialog" aria-modal="true" aria-label="Buscar ou executar comando" onClick={e => { if (e.target === e.currentTarget) setPaleta(false) }}>
          <div className="v2-pal">
            <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setSel(0) }} placeholder="Digite um cliente, uma tarefa ou um comando…" autoComplete="off"
              onKeyDown={e => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => (s + 1) % Math.max(filtrados.length, 1)) }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => (s - 1 + Math.max(filtrados.length, 1)) % Math.max(filtrados.length, 1)) }
                else if (e.key === 'Enter') { e.preventDefault(); const it = filtrados[sel]; if (it) { setPaleta(false); it.ir() } }
              }} />
            <ul>
              {filtrados.length === 0 && <li style={{ color: 'var(--v2-ink3)', cursor: 'default', justifyContent: 'center' }}>Nada com “{q}”.</li>}
              {filtrados.slice(0, 40).map((it, n) => (
                <li key={`${it.k}-${it.t}-${n}`} className={n === sel ? 'sel' : ''} onMouseEnter={() => setSel(n)} onClick={() => { setPaleta(false); it.ir() }}>
                  <span className="k">{it.k}</span>{it.t}{it.d && <span className="d">{it.d}</span>}
                </li>
              ))}
            </ul>
            <div className="rod"><span><kbd>↑</kbd><kbd>↓</kbd>navegar</span><span><kbd>↵</kbd>abrir</span><span><kbd>esc</kbd>fechar</span></div>
          </div>
        </div>
      )}
    </div>
  )
}
