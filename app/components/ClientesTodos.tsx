'use client'
import { useEffect, useMemo, useState } from 'react'

// TODOS OS CLIENTES — vitrine em grade dos mesmos cartões do trilho da Home
// (pedido do dono, 07/09: "Todos" abria Configurações; o certo é uma tela com
// todos os clientes em cards, e cada card abre o cliente normalmente).
//
// Fonte: /api/home (a mesma da Home — bola da vez, dias parado, logo). Nada é
// calculado aqui; a tela só lista e filtra. Clique no card = hub do cliente
// (/cliente/[id]), via onAbrir, como no trilho. "Cadastro e conexões" leva à
// tela de gestão (aba `clientes`), que é onde o "Todos" caía por engano.

type Cartao = { id: string; nome: string; logo?: string; cor?: string; lado: 'cliente' | 'agencia' | 'ninguem'; frase: string; diasParado?: number; totalCliente: number; totalAgencia: number; primeiro?: string }
type Filtro = 'todos' | 'cliente' | 'agencia' | 'ninguem'

function iniciais(nome: string) { return nome.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '?' }
function semAcento(s: string) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() }

const ROTULO: Record<Filtro, string> = { todos: 'Todos', cliente: 'Com o cliente', agencia: 'Com a equipe', ninguem: 'Em dia' }

export default function ClientesTodos({ onAbrir, onIr, podeGerir }: { onAbrir: (id: string) => void; onIr: (aba: string) => void; podeGerir: boolean }) {
  const [clientes, setClientes] = useState<Cartao[] | null>(null)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let vivo = true
    setErro('')
    fetch('/api/home', { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() })
      .then(d => { if (vivo) setClientes(Array.isArray(d?.clientes) ? d.clientes : []) })
      .catch(() => { if (vivo) setErro('Não foi possível carregar os clientes. Verifique a conexão e tente de novo.') })
    return () => { vivo = false }
  }, [tentativa])

  const contagem = useMemo(() => {
    const c: Record<Filtro, number> = { todos: 0, cliente: 0, agencia: 0, ninguem: 0 }
    for (const x of clientes || []) { c.todos++; c[x.lado]++ }
    return c
  }, [clientes])

  const lista = useMemo(() => {
    const q = semAcento(busca.trim())
    return (clientes || []).filter(c => (filtro === 'todos' || c.lado === filtro) && (!q || semAcento(c.nome).includes(q)))
  }, [clientes, busca, filtro])

  return (
    <div className="v2-todos">
      <style>{`
        .v2-todos { font-family: var(--v2-font); color: var(--v2-ink); }
        .v2-todos .topo { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }
        .v2-todos h1 { font-size: 22px; font-weight: 500; letter-spacing: -0.01em; margin: 0; }
        .v2-todos .topo .n { font-size: 13px; color: var(--v2-ink3); }
        .v2-todos .topo .gerir { margin-left: auto; font-size: 13px; color: var(--v2-ink2); background: none; border: 0; cursor: pointer; padding: 0; }
        .v2-todos .topo .gerir:hover { color: var(--v2-amber); }
        .v2-todos .barra { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 18px; }
        .v2-todos .busca { flex: 1 1 220px; min-width: 0; padding: 10px 14px; border-radius: 12px; border: 1px solid var(--v2-rule); background: var(--v2-surface); color: var(--v2-ink); font: inherit; font-size: 14px; outline: none; }
        .v2-todos .busca:focus { border-color: var(--v2-amber); }
        .v2-todos .chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .v2-todos .chip { font-size: 12.5px; padding: 7px 12px; border-radius: 999px; border: 1px solid var(--v2-rule); background: var(--v2-surface); color: var(--v2-ink2); cursor: pointer; font-family: inherit; min-height: 34px; }
        .v2-todos .chip.on { background: var(--v2-amber-bg); border-color: var(--v2-amber); color: var(--v2-amber); }
        .v2-todos .chip small { opacity: 0.7; margin-left: 5px; font-variant-numeric: tabular-nums; }
        .v2-todos .grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(232px, 1fr)); gap: 12px; }
        @media (max-width: 560px) { .v2-todos .grade { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; } .v2-todos h1 { font-size: 20px; } }
        .v2-todos .v2-cli { background: var(--v2-surface); border: 1px solid var(--v2-rule); border-radius: 18px; padding: 16px 16px 14px; cursor: pointer; position: relative; transition: transform 160ms ease, border-color 160ms ease; text-align: left; color: inherit; font-family: inherit; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; }
        .v2-todos .v2-cli:hover { transform: translateY(-3px); border-color: var(--v2-rule2); }
        .v2-todos .v2-cli:active { transform: translateY(0); }
        .v2-todos .v2-cli .logo { width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; font-weight: 600; font-size: 13px; margin-bottom: 14px; color: #17150E; background: var(--v2-amber-on); overflow: hidden; }
        .v2-todos .v2-cli .logo img { width: 100%; height: 100%; object-fit: cover; }
        .v2-todos .v2-cli .nome { font-size: 15.5px; font-weight: 500; margin: 0 0 4px; }
        .v2-todos .v2-cli .estado { font-size: 13px; color: var(--v2-ink2); margin: 0 0 12px; min-height: 38px; flex: 1; }
        .v2-todos .v2-cli .dias { position: absolute; top: 14px; right: 14px; font-size: 22px; font-weight: 300; color: var(--v2-ink3); font-variant-numeric: tabular-nums; line-height: 1; text-align: right; }
        .v2-todos .v2-cli .dias small { display: block; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; }
        .v2-todos .v2-cli.parado .dias { color: var(--v2-hot); }
        .v2-todos .v2-bola { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; padding: 4px 9px; border-radius: 999px; align-self: flex-start; }
        .v2-todos .v2-bola::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
        .v2-todos .v2-bola.cliente { color: var(--v2-amber); background: var(--v2-amber-bg); }
        .v2-todos .v2-bola.cliente.parado { color: var(--v2-hot); background: var(--v2-hot-bg); }
        .v2-todos .v2-bola.agencia { color: var(--v2-ok); background: var(--v2-ok-bg); }
        .v2-todos .v2-bola.ninguem { color: var(--v2-ink3); background: var(--v2-surface2); }
        .v2-todos .vazio { color: var(--v2-ink3); font-size: 13.5px; padding: 24px 0; margin: 0; }
        .v2-todos .erro { background: var(--v2-hot-bg); color: var(--v2-hot); border-radius: 12px; padding: 14px 16px; font-size: 13.5px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
        .v2-todos .erro button { font: inherit; font-weight: 600; background: var(--v2-surface); color: var(--v2-ink); border: 1px solid var(--v2-rule); border-radius: 999px; padding: 7px 14px; cursor: pointer; }
        .v2-todos .esq { border-radius: 18px; border: 1px solid var(--v2-rule); background: var(--v2-surface); height: 168px; position: relative; overflow: hidden; }
        .v2-todos .esq::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, var(--v2-surface2), transparent); animation: v2todos-brilho 1.2s infinite; }
        @keyframes v2todos-brilho { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
        @media (prefers-reduced-motion: reduce) { .v2-todos .esq::after { animation: none; } .v2-todos .v2-cli { transition: none; } }
      `}</style>

      <div className="topo">
        <h1>Clientes</h1>
        {clientes && <span className="n">{contagem.todos} {contagem.todos === 1 ? 'ativo' : 'ativos'} · quem espera há mais tempo vem primeiro</span>}
        {podeGerir && <button type="button" className="gerir" onClick={() => onIr('clientes')}>Cadastro e conexões</button>}
      </div>

      <div className="barra">
        <input className="busca" type="search" placeholder="Buscar cliente" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar cliente" autoComplete="off" />
        <div className="chips" role="tablist" aria-label="Filtrar por situação">
          {(['todos', 'cliente', 'agencia', 'ninguem'] as Filtro[]).map(f => (
            <button key={f} type="button" role="tab" aria-selected={filtro === f} className={`chip${filtro === f ? ' on' : ''}`} onClick={() => setFiltro(f)}>
              {ROTULO[f]}{clientes && <small>{contagem[f]}</small>}
            </button>
          ))}
        </div>
      </div>

      {erro && <div className="erro" role="alert">{erro}<button type="button" onClick={() => setTentativa(n => n + 1)}>Tentar de novo</button></div>}

      {!erro && !clientes && (
        <div className="grade" aria-busy="true" aria-label="Carregando clientes">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="esq" />)}
        </div>
      )}

      {clientes && lista.length === 0 && (
        <p className="vazio">{contagem.todos === 0 ? 'Nenhum cliente ativo.' : busca ? `Nenhum cliente com "${busca.trim()}"${filtro !== 'todos' ? ` em "${ROTULO[filtro]}"` : ''}.` : `Nenhum cliente em "${ROTULO[filtro]}".`}</p>
      )}

      {clientes && lista.length > 0 && (
        <div className="grade">
          {lista.map(c => {
            const parado = c.lado === 'cliente' && (c.diasParado || 0) >= 3
            return (
              <button key={c.id} type="button" className={`v2-cli${parado ? ' parado' : ''}`} onClick={() => onAbrir(c.id)} aria-label={`Abrir ${c.nome}`}>
                {c.lado === 'cliente' && typeof c.diasParado === 'number' && c.diasParado > 0 && <div className="dias">{c.diasParado}<small>{c.diasParado === 1 ? 'dia' : 'dias'}</small></div>}
                <div className="logo" style={c.cor ? { background: c.cor } : undefined}>{c.logo ? <img src={c.logo} alt="" /> : iniciais(c.nome)}</div>
                <p className="nome">{c.nome}</p>
                <p className="estado">{c.lado === 'ninguem' ? 'Nada pendente.' : <>{c.frase}{c.primeiro ? <> — <b style={{ fontWeight: 500 }}>{c.primeiro}</b></> : null}</>}</p>
                <span className={`v2-bola ${c.lado}${parado ? ' parado' : ''}`}>{c.lado === 'cliente' ? 'Com o cliente' : c.lado === 'agencia' ? 'Com a equipe' : 'Em dia'}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
