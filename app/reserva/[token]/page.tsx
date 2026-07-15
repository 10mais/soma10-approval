'use client'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

// Página PÚBLICA (sem login): o cliente escolhe sua(s) poltrona(s) pelo link.

type Poltrona = { numero: string; tipo: string; andar: number; fileira: number; coluna: number }
type ElementoLayout = { label: string; andar: number; fileira: number; coluna: number }
type Layout = { id: string; nome: string; andares: number; poltronas: Poltrona[]; elementos?: ElementoLayout[] }
type Dados = {
  contratanteNome: string; status: string
  viagem: { titulo: string; dataIda: string; dataVolta?: string } | null
  layout: Layout | null; ocupadas: string[]
  passageiros: { nome: string; poltrona?: string }[]
}

const fmtData = (s?: string) => s ? new Date(s + 'T00:00').toLocaleDateString('pt-BR') : ''

function gradeAndar(layout: Layout, andar: number) {
  const ps = layout.poltronas.filter(p => p.andar === andar)
  const els = (layout.elementos || []).filter(e => e.andar === andar)
  const todos = [...ps.map(p => ({ f: p.fileira, c: p.coluna })), ...els.map(e => ({ f: e.fileira, c: e.coluna }))]
  const maxF = todos.length ? Math.max(...todos.map(x => x.f)) : 0
  const maxC = todos.length ? Math.max(...todos.map(x => x.c)) : 0
  const mapa = new Map<string, Poltrona>()
  ps.forEach(p => mapa.set(`${p.fileira}-${p.coluna}`, p))
  const elMapa = new Map<string, string>()
  els.forEach(e => elMapa.set(`${e.fileira}-${e.coluna}`, e.label))
  return { maxF, maxC, mapa, elMapa }
}

export default function ReservaPublica() {
  const params = useParams()
  const token = String((params as any)?.token || '')
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [selecoes, setSelecoes] = useState<Record<number, string>>({}) // passageiroIndex -> poltrona
  const [enviando, setEnviando] = useState(false)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch(`/api/reserva-publica?token=${token}`).then(r => r.json()).then(d => {
      if (d?.error) setErro(d.error)
      else { setDados(d); const s: Record<number, string> = {}; (d.passageiros || []).forEach((p: any, i: number) => { if (p.poltrona) s[i] = p.poltrona }); setSelecoes(s) }
    }).catch(() => setErro('Não foi possível carregar. Tente novamente.')).finally(() => setCarregando(false))
  }, [token])

  const ocupadasSet = useMemo(() => new Set(dados?.ocupadas || []), [dados])
  const escolhidas = useMemo(() => new Set(Object.values(selecoes)), [selecoes])
  // Próximo passageiro sem poltrona (o clique preenche esse)
  const ativo = useMemo(() => (dados?.passageiros || []).findIndex((_, i) => !selecoes[i]), [dados, selecoes])
  const todosOk = dados ? Object.keys(selecoes).length === dados.passageiros.length && dados.passageiros.every((_, i) => selecoes[i]) : false

  function clicarPoltrona(n: string) {
    if (ocupadasSet.has(n)) return
    setSelecoes(prev => {
      // Se já escolhida por um passageiro, desmarca
      const idx = Object.entries(prev).find(([, v]) => v === n)?.[0]
      if (idx !== undefined) { const c = { ...prev }; delete c[Number(idx)]; return c }
      // Senão, atribui ao passageiro ativo
      if (ativo < 0) return prev
      return { ...prev, [ativo]: n }
    })
  }

  async function enviar() {
    if (!dados || !todosOk || enviando) return
    setEnviando(true)
    const poltronas = dados.passageiros.map((_, i) => selecoes[i])
    const r = await fetch('/api/reserva-publica', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, poltronas }) }).then(x => x.json()).catch(() => null)
    setEnviando(false)
    if (r?.ok) setOk(true)
    else { setErro(r?.error || 'Não foi possível confirmar. Alguém pode ter escolhido a mesma poltrona.'); fetch(`/api/reserva-publica?token=${token}`).then(x => x.json()).then(d => { if (!d?.error) setDados(d) }) }
  }

  const wrap: React.CSSProperties = { minHeight: '100vh', background: '#f6f7f9', padding: 20, display: 'flex', justifyContent: 'center', fontFamily: 'system-ui, -apple-system, sans-serif' }
  const card: React.CSSProperties = { background: '#fff', borderRadius: 16, maxWidth: 560, width: '100%', padding: 22, boxShadow: '0 2px 16px rgba(0,0,0,0.08)', height: 'fit-content' }

  if (carregando) return <div style={wrap}><div style={card}><p style={{ color: '#888' }}>Carregando…</p></div></div>
  if (erro && !dados) return <div style={wrap}><div style={card}><h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Link indisponível</h2><p style={{ color: '#888', fontSize: 14 }}>{erro}</p></div></div>
  if (ok) return <div style={wrap}><div style={{ ...card, textAlign: 'center' }}><div style={{ fontSize: 40 }}>✓</div><h2 style={{ margin: '8px 0', fontSize: 20, color: '#166534' }}>Poltronas confirmadas!</h2><p style={{ color: '#666', fontSize: 14 }}>Suas poltronas foram reservadas. Qualquer ajuste, fale com a agência.</p></div></div>
  if (!dados) return null

  return (
    <div style={wrap}>
      <div style={card}>
        <h2 style={{ margin: '0 0 2px', fontSize: 19, color: '#111' }}>{dados.viagem?.titulo || 'Sua viagem'}</h2>
        <p style={{ margin: '0 0 4px', fontSize: 13, color: '#888' }}>{fmtData(dados.viagem?.dataIda)}{dados.viagem?.dataVolta ? ` → ${fmtData(dados.viagem?.dataVolta)}` : ''}</p>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#555' }}>Olá, <b>{dados.contratanteNome}</b>! Escolha {dados.passageiros.length === 1 ? 'sua poltrona' : `as ${dados.passageiros.length} poltronas`} tocando no mapa abaixo.</p>

        {!dados.layout ? <p style={{ color: '#b45309', fontSize: 14 }}>O mapa de poltronas ainda não está disponível. Fale com a agência.</p> : (
          <>
            {/* Passageiros e suas poltronas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {dados.passageiros.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${i === ativo ? '#111' : '#eee'}`, background: i === ativo ? '#fafafa' : '#fff' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: '#111', flex: 1 }}>{p.nome || `Passageiro ${i + 1}`}</span>
                  {selecoes[i] ? <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: '#111', borderRadius: 6, padding: '4px 10px' }}>Poltrona {selecoes[i]}</span>
                    : <span style={{ fontSize: 12, color: i === ativo ? '#111' : '#bbb', fontWeight: 600 }}>{i === ativo ? 'escolha agora' : 'aguardando'}</span>}
                </div>
              ))}
            </div>

            {/* Mapa */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 }}>
              {Array.from({ length: dados.layout.andares }, (_, a) => a + 1).map(andar => {
                const { maxF, maxC, mapa, elMapa } = gradeAndar(dados.layout!, andar)
                if (!maxF) return null
                return (
                  <div key={andar}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#888', marginBottom: 6, textAlign: 'center' }}>{dados.layout!.andares > 1 ? (andar === 1 ? 'INFERIOR' : 'SUPERIOR') : ''}</div>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, background: '#fafafa', border: '1px solid #eee', borderRadius: 10, padding: 8 }}>
                      {Array.from({ length: maxF }, (_, f) => f + 1).map(fileira => (
                        <div key={fileira} style={{ display: 'flex', gap: 4 }}>
                          {Array.from({ length: maxC }, (_, c) => c + 1).map(coluna => {
                            const p = mapa.get(`${fileira}-${coluna}`)
                            if (!p) {
                              const el = elMapa.get(`${fileira}-${coluna}`)
                              if (el) return <span key={coluna} title={el} style={{ minWidth: 34, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 8.5, fontWeight: 700, color: '#94a3b8', background: '#f1f5f9', borderRadius: 6, padding: '0 4px', whiteSpace: 'nowrap' }}>{el}</span>
                              return <span key={coluna} style={{ width: 34, height: 30 }} />
                            }
                            const ocupada = ocupadasSet.has(p.numero)
                            const minha = escolhidas.has(p.numero)
                            const cor = ocupada ? { bg: '#e5e7eb', bd: '#d1d5db', tx: '#9ca3af' } : minha ? { bg: '#111', bd: '#111', tx: '#fff' } : { bg: '#fff', bd: '#94a3b8', tx: '#334155' }
                            return <button key={coluna} type="button" disabled={ocupada} onClick={() => clicarPoltrona(p.numero)} style={{ width: 34, height: 30, borderRadius: 7, border: `1.5px solid ${cor.bd}`, background: cor.bg, color: cor.tx, fontSize: 11, fontWeight: 800, cursor: ocupada ? 'not-allowed' : 'pointer', padding: 0 }}>{p.numero}</button>
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legenda */}
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginBottom: 16, fontSize: 11.5, color: '#666' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 14, borderRadius: 4, border: '1.5px solid #94a3b8', background: '#fff' }} /> Livre</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 14, borderRadius: 4, background: '#111' }} /> Sua escolha</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 14, borderRadius: 4, background: '#e5e7eb' }} /> Ocupada</span>
            </div>

            {erro && <p style={{ color: '#b91c1c', fontSize: 13, textAlign: 'center', marginBottom: 10 }}>{erro}</p>}
            <button onClick={enviar} disabled={!todosOk || enviando} style={{ width: '100%', padding: '13px', background: todosOk && !enviando ? '#111' : '#e5e7eb', color: todosOk && !enviando ? '#fff' : '#9ca3af', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: todosOk && !enviando ? 'pointer' : 'not-allowed' }}>
              {enviando ? 'Confirmando…' : todosOk ? 'Confirmar poltronas' : `Faltam ${dados.passageiros.length - Object.keys(selecoes).length} poltrona(s)`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
