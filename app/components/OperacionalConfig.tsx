'use client'
import { useEffect, useState } from 'react'
import { toast } from '@/lib/toast'

type Op = { slaAprovacaoHoras: number; lixeiraDias: number; saudeDias: number; prioridadePadrao: 'baixa' | 'media' | 'alta' }
const PADRAO: Op = { slaAprovacaoHoras: 24, lixeiraDias: 30, saudeDias: 60, prioridadePadrao: 'media' }

export default function OperacionalConfig() {
  const [op, setOp] = useState<Op>(PADRAO)
  const [salvando, setSalvando] = useState(false)
  const [carregado, setCarregado] = useState(false)

  useEffect(() => { fetch('/api/operacional').then(r => r.json()).then(d => { if (d && !d.error) setOp({ ...PADRAO, ...d }); setCarregado(true) }).catch(() => setCarregado(true)) }, [])

  async function salvar() {
    setSalvando(true)
    const r = await fetch('/api/operacional', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(op) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    toast(r?.ok ? 'Configurações operacionais salvas.' : 'Não foi possível salvar.', r?.ok ? 'sucesso' : 'erro')
  }

  const num = (k: keyof Op, label: string, sufixo: string, dica: string) => (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 5 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="number" min="1" value={op[k] as number} onChange={e => setOp(o => ({ ...o, [k]: Number(e.target.value) || 0 }))}
          style={{ width: 90, padding: '9px 11px', borderRadius: 9, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit' }} />
        <span style={{ fontSize: 12.5, color: 'var(--v2-ink3)' }}>{sufixo}</span>
      </div>
      <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--v2-ink3)' }}>{dica}</p>
    </div>
  )

  if (!carregado) return <p style={{ fontSize: 13, color: 'var(--v2-ink3)' }}>Carregando...</p>
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {num('slaAprovacaoHoras', 'SLA de aprovação', 'horas', 'Após esse tempo em aprovação, o sistema alerta a equipe e o cliente.')}
        {num('lixeiraDias', 'Prazo da lixeira', 'dias', 'Quanto tempo itens excluídos ficam disponíveis para restaurar.')}
        {num('saudeDias', 'Meta da Saúde do Caixa', 'dias', 'Reserva-alvo em dias de operação (o termômetro usa isto como 100%).')}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 5 }}>Prioridade padrão de tarefa</label>
          <select value={op.prioridadePadrao} onChange={e => setOp(o => ({ ...o, prioridadePadrao: e.target.value as any }))}
            style={{ width: '100%', maxWidth: 160, padding: '9px 11px', borderRadius: 9, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface)' }}>
            <option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option>
          </select>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--v2-ink3)' }}>Aplicada a tarefas criadas sem prioridade (quick-add, automações).</p>
        </div>
      </div>
      <button onClick={salvar} disabled={salvando} style={{ marginTop: 16, padding: '10px 20px', background: 'var(--v2-amber-on)', color: '#17150E', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>{salvando ? 'Salvando...' : 'Salvar operacional'}</button>
    </div>
  )
}
