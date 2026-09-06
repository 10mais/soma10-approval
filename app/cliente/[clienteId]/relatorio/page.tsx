'use client'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useMemo, useState } from 'react'
import { montarRelatorio, semanaDe, deslocarSemana, textoRelatorio, type Relatorio, type ItemRel, type Semana } from '@/lib/relatorioSemana'
import { toast } from '@/lib/toast'

// RELATÓRIO DA SEMANA — evidência de serviço para o cliente: o que foi entregue,
// o que está em andamento e os próximos passos. Sai dos dados do sistema; a
// equipe só escolhe a semana, revisa e envia (copiar, WhatsApp, PDF). A IA
// escreve, opcionalmente, um texto corrido em cima dos fatos.

function fmtDia(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '')
}

function Bloco({ titulo, itens, vazio, tom }: { titulo: string; itens: ItemRel[]; vazio?: string; tom?: 'ok' | 'hot' | 'amber' }) {
  if (!itens.length && !vazio) return null
  const cor = tom === 'ok' ? 'var(--v2-ok)' : tom === 'hot' ? 'var(--v2-hot)' : tom === 'amber' ? 'var(--v2-amber)' : 'var(--v2-ink3)'
  return (
    <div>
      <p style={{ margin: '0 0 6px', fontSize: 12.5, fontWeight: 500, color: cor }}>{titulo}{itens.length ? ` (${itens.length})` : ''}</p>
      {itens.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: 'var(--v2-ink3)' }}>{vazio}</p> : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {itens.map(i => (
            <li key={i.tipo + i.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 13.5, lineHeight: 1.4 }}>
              <span style={{ flex: 1, minWidth: 0 }}>{i.titulo}{i.detalhe && <span style={{ color: 'var(--v2-ink3)' }}> · {i.detalhe}</span>}</span>
              {i.quando && <span style={{ fontSize: 12, color: 'var(--v2-ink3)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtDia(i.quando)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Coluna({ titulo, numero, children, tom }: { titulo: string; numero: number; children: React.ReactNode; tom: 'ok' | 'amber' | 'ink' }) {
  const cor = tom === 'ok' ? 'var(--v2-ok)' : tom === 'amber' ? 'var(--v2-amber)' : 'var(--v2-ink)'
  return (
    <section style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>{titulo}</h2>
        <span style={{ fontSize: 26, fontWeight: 500, color: cor, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{numero}</span>
      </header>
      {children}
    </section>
  )
}

export default function RelatorioSemana() {
  const { clienteId } = useParams() as { clienteId: string }
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const [cliente, setCliente] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [tarefas, setTarefas] = useState<any[]>([])
  const [marcos, setMarcos] = useState<any[]>([])
  const [semana, setSemana] = useState<Semana>(() => semanaDe())
  const [narrativa, setNarrativa] = useState('')
  const [gerando, setGerando] = useState(false)
  const [carregado, setCarregado] = useState(false)

  useEffect(() => {
    const j = (u: string) => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null)
    Promise.all([j(`/api/clientes?id=${clienteId}`), j(`/api/posts?clienteId=${clienteId}`), j('/api/tarefas'), j(`/api/playbook?clienteId=${clienteId}`)])
      .then(([c, p, t, m]) => {
        setCliente(Array.isArray(c) ? c.find((x: any) => x.id === clienteId) : c)
        setPosts(Array.isArray(p) ? p : [])
        setTarefas(Array.isArray(t) ? t.filter((x: any) => x.clienteId === clienteId) : [])
        setMarcos(Array.isArray(m) ? m : [])
        setCarregado(true)
      })
  }, [clienteId])

  const rel: Relatorio = useMemo(() => montarRelatorio({ posts, tarefas, marcos, semana }), [posts, tarefas, marcos, semana])
  const texto = useMemo(() => textoRelatorio(rel, cliente?.nome || ''), [rel, cliente])
  const ehSemanaAtual = semana.inicio === semanaDe().inicio
  useEffect(() => { setNarrativa('') }, [semana])

  async function copiar(t: string) {
    try { await navigator.clipboard.writeText(t); toast('Copiado.', 'sucesso') } catch { toast('Não foi possível copiar.', 'erro') }
  }
  function whatsapp() { window.open(`https://wa.me/?text=${encodeURIComponent(narrativa || texto)}`, '_blank') }
  async function escreverComIA() {
    setGerando(true)
    const r = await fetch('/api/clientes/relatorio-ia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId, texto }) }).then(x => x.json()).catch(() => null)
    setGerando(false)
    if (!r?.narrativa) { toast(r?.error || 'A IA não respondeu.', 'erro'); return }
    setNarrativa(r.narrativa)
  }

  if (role === 'cliente') return <p style={{ color: 'var(--v2-ink3)', fontSize: 13 }}>Esta página é da equipe.</p>
  if (!carregado) return <p style={{ color: 'var(--v2-ink3)', fontSize: 13 }}>Carregando…</p>

  const btn: React.CSSProperties = { padding: '9px 14px', borderRadius: 10, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-ink)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }
  const seta: React.CSSProperties = { ...btn, padding: '8px 10px' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1240 }}>
      <style>{`@media print { .rel-acoes { display: none !important; } .rel-grade { grid-template-columns: 1fr !important; } }`}</style>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>Relatório da semana · {cliente?.nome}</p>
          <h1 style={{ margin: '4px 0 0', fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 500, letterSpacing: '-0.015em', lineHeight: 1.1 }}>{rel.periodo.rotulo}{ehSemanaAtual ? <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--v2-ink3)', marginLeft: 10 }}>semana atual</span> : ''}</h1>
        </div>
        <div className="rel-acoes" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button style={seta} onClick={() => setSemana(s => deslocarSemana(s, -1))} aria-label="Semana anterior"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
          <button style={seta} onClick={() => setSemana(s => deslocarSemana(s, 1))} aria-label="Próxima semana"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg></button>
          {!ehSemanaAtual && <button style={btn} onClick={() => setSemana(semanaDe())}>Esta semana</button>}
          <button style={btn} onClick={() => copiar(narrativa || texto)}>Copiar texto</button>
          <button style={btn} onClick={whatsapp}>Enviar por WhatsApp</button>
          <button style={btn} onClick={() => window.print()}>Imprimir / PDF</button>
          <button onClick={escreverComIA} disabled={gerando} style={{ ...btn, background: 'var(--v2-amber-on)', color: '#17150E', border: 0, fontWeight: 600, cursor: gerando ? 'wait' : 'pointer' }}>{gerando ? 'Escrevendo…' : 'Escrever com IA'}</button>
        </div>
      </div>

      {narrativa && (
        <section style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-amber-on)', borderRadius: 16, padding: '18px 20px' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--v2-amber)' }}>Texto para o cliente</h2>
            <button className="rel-acoes" onClick={() => copiar(narrativa)} style={{ background: 'none', border: 0, color: 'var(--v2-amber)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>Copiar</button>
          </header>
          <textarea value={narrativa} onChange={e => setNarrativa(e.target.value)} rows={Math.min(24, narrativa.split('\n').length + 2)} style={{ width: '100%', boxSizing: 'border-box', border: 0, background: 'transparent', color: 'var(--v2-ink)', fontSize: 14, lineHeight: 1.6, resize: 'vertical', outline: 'none' }} />
        </section>
      )}

      <div className="rel-grade" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <Coluna titulo="O que foi entregue" numero={rel.numeros.entregues} tom="ok">
          {rel.numeros.entregues === 0 && <p style={{ margin: 0, fontSize: 13, color: 'var(--v2-ink3)' }}>Nenhuma entrega registrada nesta semana.</p>}
          <Bloco titulo="Publicações no ar" itens={rel.entregas.publicados} tom="ok" />
          <Bloco titulo="Materiais aprovados" itens={rel.entregas.aprovados} tom="ok" />
          <Bloco titulo="Tarefas concluídas" itens={rel.entregas.tarefasConcluidas} tom="ok" />
          <Bloco titulo="Etapas do Playbook concluídas" itens={rel.entregas.marcosConcluidos} tom="ok" />
        </Coluna>
        <Coluna titulo="Em andamento" numero={rel.emAndamento.aguardandoCliente.length + rel.emAndamento.emProducao.length + rel.emAndamento.tarefasAbertas.length} tom="amber">
          <Bloco titulo="Aguardando o cliente" itens={rel.emAndamento.aguardandoCliente} vazio="Nada parado com o cliente." tom="hot" />
          <Bloco titulo="Em produção na agência" itens={rel.emAndamento.emProducao} vazio="Nada em produção." tom="amber" />
          <Bloco titulo="Tarefas abertas" itens={rel.emAndamento.tarefasAbertas} vazio="Nenhuma tarefa aberta." />
        </Coluna>
        <Coluna titulo="Próximos passos" numero={rel.numeros.proximos} tom="ink">
          <Bloco titulo="Publicações programadas" itens={rel.proximos.agendados} vazio="Nada programado para os próximos 7 dias." />
          <Bloco titulo="Tarefas com prazo" itens={rel.proximos.tarefasComPrazo} vazio="Nenhuma tarefa com prazo na próxima semana." />
        </Coluna>
      </div>

      <details style={{ fontSize: 12.5, color: 'var(--v2-ink3)' }} className="rel-acoes">
        <summary style={{ cursor: 'pointer' }}>Ver o texto simples (o que "Copiar texto" envia)</summary>
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, color: 'var(--v2-ink2)', background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 12, padding: 16, marginTop: 8 }}>{texto}</pre>
      </details>
    </div>
  )
}
