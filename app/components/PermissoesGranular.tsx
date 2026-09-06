'use client'
import { useEffect, useState } from 'react'
import { ABAS_PERM, ACOES_PERM } from '@/lib/permissoesGranular'

// Config de permissões detalhadas por papel (gerente/usuario): por ABA + por AÇÃO.
export default function PermissoesGranular() {
  const [cfg, setCfg] = useState<any>({ gerente: { abas: {}, acoes: {} }, usuario: { abas: {}, acoes: {} } })
  const [papel, setPapel] = useState<'gerente' | 'usuario'>('gerente')
  const [carregado, setCarregado] = useState(false)

  useEffect(() => {
    fetch('/api/permissoes-granular').then(r => r.json()).then(d => {
      setCfg({
        gerente: { abas: d?.gerente?.abas || {}, acoes: d?.gerente?.acoes || {} },
        usuario: { abas: d?.usuario?.abas || {}, acoes: d?.usuario?.acoes || {} },
      })
      setCarregado(true)
    }).catch(() => setCarregado(true))
  }, [])

  function salvar(next: any) {
    fetch('/api/permissoes-granular', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }).catch(() => {})
  }
  const on = (map: any, key: string) => map[key] !== false // default liberado
  function toggle(tipo: 'abas' | 'acoes', key: string) {
    setCfg((c: any) => {
      const atual = on(c[papel][tipo], key)
      const next = { ...c, [papel]: { ...c[papel], [tipo]: { ...c[papel][tipo], [key]: !atual } } }
      salvar(next); return next
    })
  }

  const Switch = ({ ligado, onClick }: { ligado: boolean; onClick: () => void }) => (
    <button onClick={onClick} aria-label={ligado ? 'Liberado' : 'Bloqueado'} style={{ flexShrink: 0, width: 40, height: 23, borderRadius: 999, border: 'none', cursor: 'pointer', background: ligado ? 'var(--v2-ok)' : 'var(--v2-rule)', position: 'relative', transition: 'background .2s' }}>
      <span style={{ position: 'absolute', top: 3, left: ligado ? 20 : 3, width: 17, height: 17, borderRadius: '50%', background: 'var(--v2-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left .2s' }} />
    </button>
  )

  if (!carregado) return <p style={{ fontSize: 13, color: 'var(--v2-ink3)' }}>Carregando...</p>
  const cats = Array.from(new Set(ABAS_PERM.map(a => a.categoria)))
  const mapAbas = cfg[papel].abas, mapAcoes = cfg[papel].acoes

  return (
    <div>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--v2-ink3)', lineHeight: 1.5 }}>
        Controle fino por papel: quais <strong>telas</strong> cada um vê e quais <strong>ações</strong> pode fazer. Vale para <strong>Gerente</strong> e <strong>Usuário</strong> (Admin sempre pode). Complementa as permissões por módulo.
      </p>

      {/* Seletor de papel */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {(['gerente', 'usuario'] as const).map(p => (
          <button key={p} onClick={() => setPapel(p)} style={{ padding: '8px 16px', borderRadius: 999, border: papel === p ? '1px solid var(--v2-ink)' : '1px solid var(--v2-surface2)', background: papel === p ? 'var(--v2-ink)' : 'var(--v2-surface)', color: papel === p ? 'var(--v2-surface)' : 'var(--v2-ink2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>{p}</button>
        ))}
      </div>

      {/* Ações críticas */}
      <div style={{ background: 'var(--v2-surface1)', border: '1px solid var(--v2-rule)', borderRadius: 12, padding: '14px 16px', marginBottom: 18 }}>
        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: 'var(--v2-ink3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ações</p>
        {ACOES_PERM.map(a => (
          <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--v2-ink)' }}>{a.label}</p>
              <p style={{ margin: 0, fontSize: 11.5, color: 'var(--v2-ink3)' }}>{a.dica}</p>
            </div>
            <Switch ligado={on(mapAcoes, a.key)} onClick={() => toggle('acoes', a.key)} />
          </div>
        ))}
      </div>

      {/* Abas por categoria */}
      <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 800, color: 'var(--v2-ink3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Telas (abas)</p>
      {cats.map(cat => (
        <div key={cat} style={{ marginBottom: 12 }}>
          <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: 'var(--v2-ink3)' }}>{cat}</p>
          {ABAS_PERM.filter(a => a.categoria === cat).map(a => (
            <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0' }}>
              <span style={{ flex: 1, fontSize: 13, color: on(mapAbas, a.key) ? 'var(--v2-ink)' : 'var(--v2-ink3)' }}>{a.label}</span>
              <Switch ligado={on(mapAbas, a.key)} onClick={() => toggle('abas', a.key)} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
