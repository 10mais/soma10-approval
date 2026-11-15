'use client'
import { useEffect, useMemo, useState } from 'react'
import { toast } from '@/lib/toast'

// LIMITADOR DE DEMANDAS — configuração (dono, 15/11/2026). Em Configurações › Operacional.
// Liga/desliga, limite padrão e limite por pessoa (vazio = padrão). Só admin grava (a API confere).
// Regra em lib/limiteDemandas; servidor em /api/limite-demandas.

type Pessoa = { email: string; nome: string; role: string }
type Dados = { ligado: boolean; limitePadrao: number; porPessoaConfig?: Record<string, number>; porPessoa: { email: string; ocupadas: number; limite: number }[] }

const campo: React.CSSProperties = { padding: '9px 11px', borderRadius: 9, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface)', color: 'var(--v2-ink)' }

export default function LimiteDemandasConfig() {
  const [dados, setDados] = useState<Dados | null>(null)
  const [equipe, setEquipe] = useState<Pessoa[]>([])
  const [ligado, setLigado] = useState(true)
  const [limite, setLimite] = useState(3)
  const [proprios, setProprios] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    fetch('/api/limite-demandas').then(r => r.json()).then((d: Dados) => {
      if (!d || (d as any).error) return
      setDados(d); setLigado(d.ligado); setLimite(d.limitePadrao)
      setProprios(Object.fromEntries(Object.entries(d.porPessoaConfig || {}).map(([e, n]) => [e, String(n)])))
    }).catch(() => {})
    fetch('/api/equipe').then(r => r.json()).then(d => { if (Array.isArray(d)) setEquipe(d.filter((p: Pessoa) => p.role !== 'cliente')) }).catch(() => {})
  }, [])

  const ocupadas = useMemo(() => new Map((dados?.porPessoa || []).map(p => [p.email.toLowerCase(), p.ocupadas])), [dados])
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return equipe.filter(p => !q || p.nome.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
  }, [equipe, busca])

  async function salvar() {
    setSalvando(true)
    const porPessoa: Record<string, number> = {}
    for (const [e, v] of Object.entries(proprios)) { const n = Math.round(Number(v)); if (v.trim() && n >= 1) porPessoa[e.toLowerCase()] = n }
    const r = await fetch('/api/limite-demandas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ligado, limite, porPessoa }) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    toast(r?.ok ? 'Limitador de demandas salvo.' : (r?.error || 'Não foi possível salvar.'), r?.ok ? 'sucesso' : 'erro')
  }

  if (!dados) return null
  return (
    <div style={{ marginTop: 28, paddingTop: 22, borderTop: '1px solid var(--v2-rule)' }}>
      <h4 style={{ margin: '0 0 4px', fontSize: 14, color: 'var(--v2-ink)' }}>Limitador de demandas</h4>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--v2-ink3)', maxWidth: 640 }}>
        Cada pessoa da produção criativa (design, vídeo e copy das pautas) trabalha em até este número de peças ao mesmo tempo.
        Ocupam vaga as tarefas Em andamento e Em ajuste; Aguardando material libera. Para pegar outra, a pessoa entrega ou devolve uma para a fila.
        Numa urgência, o gestor de projetos do squad do cliente, o gerente e o admin podem passar do limite escrevendo o motivo, que fica no histórico da tarefa.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-end' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--v2-ink)', cursor: 'pointer' }}>
          <input type="checkbox" checked={ligado} onChange={e => setLigado(e.target.checked)} style={{ width: 16, height: 16 }} />
          Limitador ligado
        </label>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 5 }}>Limite padrão</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="number" min="1" max="20" value={limite} onChange={e => setLimite(Math.max(1, Number(e.target.value) || 1))} style={{ ...campo, width: 80 }} />
            <span style={{ fontSize: 12.5, color: 'var(--v2-ink3)' }}>demandas por pessoa</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)' }}>Limite por pessoa (vazio = padrão)</span>
          {equipe.length > 8 && <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar pessoa" style={{ ...campo, width: 200, padding: '7px 10px' }} />}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
          {lista.map(p => {
            const e = p.email.toLowerCase()
            const em = ocupadas.get(e) || 0
            return (
              <div key={e} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--v2-rule)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--v2-ink3)' }}>{em} em andamento agora</div>
                </div>
                <input type="number" min="1" max="20" placeholder={String(limite)} value={proprios[e] || ''} onChange={ev => setProprios(o => ({ ...o, [e]: ev.target.value }))}
                  aria-label={`Limite de ${p.nome}`} style={{ ...campo, width: 64, padding: '7px 9px' }} />
              </div>
            )
          })}
        </div>
      </div>
      <button onClick={salvar} disabled={salvando} style={{ marginTop: 16, padding: '10px 20px', background: 'var(--v2-amber-on)', color: '#17150E', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>{salvando ? 'Salvando...' : 'Salvar limitador'}</button>
    </div>
  )
}
