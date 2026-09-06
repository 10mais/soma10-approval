'use client'
import { useEffect, useState } from 'react'
import { toast } from '@/lib/toast'
import { MESES_PT, configVazia, type ConfigRegras } from '@/lib/regrasDoMes'

// Editor das REGRAS INEGOCIÁVEIS DO MÊS (Configurações → Regras do mês).
// 12 espaços, um por mês: janeiro a outubro são as 10 regras; novembro e
// dezembro recebem "outras frases" (decisão do dono, 04/09). Cada mês tem um
// nome curto e uma lista de frases de inspiração, uma por linha — a Home e o
// splash de abertura escolhem a frase pelo dia do mês.

export default function RegrasDoMes() {
  const [cfg, setCfg] = useState<ConfigRegras>(configVazia())
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [aberto, setAberto] = useState<number>(new Date().getMonth())

  useEffect(() => {
    fetch('/api/config/regras').then(r => r.json()).then(d => { if (d && Array.isArray(d.meses)) setCfg({ meses: d.meses }) }).catch(() => {}).finally(() => setCarregando(false))
  }, [])

  function mudar(i: number, campo: 'nome' | 'frases', valor: string) {
    setCfg(c => {
      const meses = [...c.meses]
      const atual = meses[i] || { nome: '', frases: [] }
      meses[i] = campo === 'nome'
        ? { ...atual, nome: valor }
        : { ...atual, frases: valor.split('\n') } // mantém linhas vazias enquanto digita; o servidor limpa
      return { meses }
    })
  }

  async function salvar() {
    setSalvando(true)
    const r = await fetch('/api/config/regras', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (!r?.ok) { toast(r?.error || 'Não foi possível salvar.', 'erro'); return }
    setCfg({ meses: r.meses })
    toast('Regras salvas. A Home mostra a mudança no próximo minuto.', 'sucesso')
  }

  const preenchidos = cfg.meses.filter(m => m && m.nome).length
  const campo: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-ink)', fontFamily: 'inherit', fontSize: 14 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>Regras inegociáveis do mês</p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--v2-ink3)', lineHeight: 1.5 }}>
          Uma regra por mês, de janeiro a outubro; novembro e dezembro recebem outras frases. Cada mês tem um nome curto e frases de inspiração — <strong style={{ fontWeight: 500, color: 'var(--v2-ink2)' }}>uma por linha</strong>. A Home e a tela de abertura mostram a frase do dia (gira pelo dia do mês). Mês sem nome não aparece.
        </p>
      </div>

      {carregando ? <p style={{ color: 'var(--v2-ink3)', fontSize: 13 }}>Carregando…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {cfg.meses.map((m, i) => {
            const on = aberto === i
            const temNome = !!(m && m.nome.trim())
            return (
              <div key={i} style={{ border: '1px solid var(--v2-rule)', borderRadius: 12, background: 'var(--v2-surface)', overflow: 'hidden' }}>
                <button onClick={() => setAberto(on ? -1 : i)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: 'none', border: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: 'var(--v2-ink)' }}>
                  <span style={{ width: 30, fontSize: 10.5, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: i === new Date().getMonth() ? 'var(--v2-amber)' : 'var(--v2-ink3)' }}>{MESES_PT[i].slice(0, 3)}</span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: temNome ? 500 : 400, color: temNome ? 'var(--v2-ink)' : 'var(--v2-ink3)' }}>{temNome ? m!.nome : (i >= 10 ? 'Outras frases — a definir' : 'Regra ainda não cadastrada')}</span>
                  {temNome && <span style={{ fontSize: 12, color: 'var(--v2-ink3)', fontVariantNumeric: 'tabular-nums' }}>{m!.frases.filter(f => f.trim()).length} {m!.frases.filter(f => f.trim()).length === 1 ? 'frase' : 'frases'}</span>}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--v2-ink3)', transform: on ? 'rotate(90deg)' : 'none', transition: 'transform 140ms' }}><path d="M9 18l6-6-6-6" /></svg>
                </button>
                {on && (
                  <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--v2-rule)' }}>
                    <label style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--v2-ink3)', marginTop: 12 }}>{i >= 10 ? 'Tema' : 'Regra'}</label>
                    <input value={m?.nome || ''} onChange={e => mudar(i, 'nome', e.target.value)} placeholder={i >= 10 ? 'Ex.: Gratidão' : 'Ex.: Entregar antes do prazo'} style={campo} />
                    <label style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>Frases de inspiração — uma por linha</label>
                    <textarea value={(m?.frases || []).join('\n')} onChange={e => mudar(i, 'frases', e.target.value)} rows={5} placeholder={'Quem entrega cedo escolhe o próximo passo.\nO prazo é o começo da confiança.'} style={{ ...campo, resize: 'vertical', lineHeight: 1.5 }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={salvar} disabled={salvando || carregando} className="soma10-no-invert" style={{ padding: '10px 18px', background: 'var(--v2-amber-on)', color: '#17150E', border: 0, borderRadius: 10, fontWeight: 600, fontSize: 13.5, cursor: salvando ? 'wait' : 'pointer', fontFamily: 'inherit' }}>{salvando ? 'Salvando…' : 'Salvar regras'}</button>
        <span style={{ fontSize: 12.5, color: 'var(--v2-ink3)' }}>{preenchidos} de 12 meses preenchidos</span>
      </div>
    </div>
  )
}
