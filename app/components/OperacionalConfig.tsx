'use client'
import { useEffect, useState } from 'react'
import { toast } from '@/lib/toast'
import { useT } from '@/app/components/Idioma'
import LimiteDemandasConfig from '@/app/components/LimiteDemandasConfig'
import { SLA_PADRAO, combinados, type Sla } from '@/lib/planoAcao'

type Op = { slaAprovacaoHoras: number; lixeiraDias: number; saudeDias: number; prioridadePadrao: 'baixa' | 'media' | 'alta'; sla: Sla }
const PADRAO: Op = { slaAprovacaoHoras: 24, lixeiraDias: 30, saudeDias: 60, prioridadePadrao: 'media', sla: SLA_PADRAO }

export default function OperacionalConfig() {
  const tr = useT()
  const [op, setOp] = useState<Op>(PADRAO)
  const [salvando, setSalvando] = useState(false)
  const [carregado, setCarregado] = useState(false)

  useEffect(() => { fetch('/api/operacional').then(r => r.json()).then(d => { if (d && !d.error) setOp({ ...PADRAO, ...d, sla: { ...SLA_PADRAO, ...(d.sla || {}) } }); setCarregado(true) }).catch(() => setCarregado(true)) }, [])

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

  const slaNum = (k: keyof Sla, label: string, sufixo: string, dica: string) => (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 5 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="number" min="0" value={op.sla[k]} onChange={e => setOp(o => ({ ...o, sla: { ...o.sla, [k]: Number(e.target.value) || 0 } }))}
          style={{ width: 90, padding: '9px 11px', borderRadius: 9, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit' }} />
        <span style={{ fontSize: 12.5, color: 'var(--v2-ink3)' }}>{sufixo}</span>
      </div>
      {dica && <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--v2-ink3)' }}>{dica}</p>}
    </div>
  )

  if (!carregado) return <p style={{ fontSize: 13, color: 'var(--v2-ink3)' }}>{tr('conta.carregando')}</p>
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {num('slaAprovacaoHoras', 'SLA de aprovação', 'horas', 'Após esse tempo em aprovação, o sistema alerta a equipe e o cliente.')}
        {num('lixeiraDias', 'Prazo da lixeira', 'dias', 'Quanto tempo itens excluídos ficam disponíveis para restaurar.')}
        {num('saudeDias', 'Meta da Saúde do Caixa', 'dias', 'Reserva-alvo em dias de operação (o termômetro usa isto como 100%).')}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 5 }}>{tr('cfg.prioridade-padrao')}</label>
          <select value={op.prioridadePadrao} onChange={e => setOp(o => ({ ...o, prioridadePadrao: e.target.value as any }))}
            style={{ width: '100%', maxWidth: 160, padding: '9px 11px', borderRadius: 9, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface)' }}>
            <option value="baixa">{tr('prioridade.baixa')}</option><option value="media">{tr('prioridade.media')}</option><option value="alta">{tr('prioridade.alta')}</option>
          </select>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--v2-ink3)' }}>{tr('cfg.prioridade-ajuda')}</p>
        </div>
      </div>
      <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--v2-rule)' }}>
        <h4 style={{ margin: 0, fontSize: 14, color: 'var(--v2-ink)' }}>Combinados do plano de ação (SLAs)</h4>
        <p style={{ margin: '4px 0 12px', fontSize: 12, color: 'var(--v2-ink3)' }}>O cliente e a equipe veem os mesmos combinados no Plano de entregas. O SLA de aprovação acima entra na lista do cliente.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {slaNum('clienteMaterialDiasUteis', 'Cliente envia material ou acesso', 'dias úteis', '')}
          {slaNum('clienteIndicadoresDiaUtil', 'Cliente informa os números do mês', 'º dia útil', 'Até o N-ésimo dia útil do mês seguinte.')}
          {slaNum('equipeAjusteDiasUteis', 'Equipe devolve o ajuste', 'dias úteis', '')}
          {slaNum('relatorioDiaUtil', 'Relatório do mês', 'º dia útil', 'Até o N-ésimo dia útil do mês seguinte.')}
          {slaNum('ataReuniaoHoras', 'Ata da reunião semanal', 'horas', '')}
          {slaNum('avisoVesperaDias', 'Aviso antes do prazo', 'dias antes', '0 desliga o aviso de véspera; o de atraso continua.')}
        </div>
        <details style={{ marginTop: 12 }}>
          <summary style={{ fontSize: 12.5, color: 'var(--v2-ink2)', cursor: 'pointer', fontWeight: 600 }}>Ver como o cliente lê</summary>
          {(() => { const c = combinados(op.sla, op.slaAprovacaoHoras); return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginTop: 8, fontSize: 12.5, color: 'var(--v2-ink2)' }}>
              <div><strong>Você (cliente)</strong><ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{c.cliente.map(t => <li key={t}>{t}</li>)}</ul></div>
              <div><strong>Nós (equipe)</strong><ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{c.equipe.map(t => <li key={t}>{t}</li>)}</ul></div>
            </div>) })()}
        </details>
      </div>
      <button onClick={salvar} disabled={salvando} style={{ marginTop: 16, padding: '10px 20px', background: 'var(--v2-amber-on)', color: '#17150E', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>{salvando ? 'Salvando...' : 'Salvar operacional'}</button>
      <LimiteDemandasConfig />
    </div>
  )
}
