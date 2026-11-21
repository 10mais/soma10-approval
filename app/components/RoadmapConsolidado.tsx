'use client'
// TODOS OS CLIENTES na Linha do tempo (Mudança 3, dono 21/11/2026): o Plano de entregas sem
// cliente escolhido mostra a agência inteira no período — uma linha por cliente com % entregue,
// os quatro números, a próxima entrega e os marcos na faixa. Quem tem atraso vem primeiro.
// Clicar abre o cliente. Contas em lib/roadmapEntregas.resumoDosClientes.
import { useMemo, useState } from 'react'
import { janelaDoPeriodo, moverPeriodo, resumoDosClientes, ROTULO_STATUS, type Periodo, type MarcoRoad, type StatusEntrega } from '@/lib/roadmapEntregas'
import { hojeYmd, fmtDiaMes } from '@/lib/datas'
import { useIsMobile } from '@/lib/useIsMobile'
import { SeletorPeriodo, COR_STATUS } from './RoadmapEntregas'

export default function RoadmapConsolidado({ marcos, nomes, onAbrirCliente, carregando }: { marcos: MarcoRoad[]; nomes: Record<string, string>; onAbrirCliente: (id: string) => void; carregando?: boolean }) {
  const mobile = useIsMobile()
  const hoje = hojeYmd()
  const [periodo, setPeriodo] = useState<Periodo>('trimestre')
  const [ref, setRef] = useState(hoje)
  const j = useMemo(() => janelaDoPeriodo(periodo, ref), [periodo, ref])
  const linhas = useMemo(() => resumoDosClientes(marcos, j, hoje, nomes), [marcos, j, hoje, nomes])
  const hojePos = hoje >= j.inicio && hoje <= j.fim ? ((new Date(hoje).getTime() - new Date(j.inicio).getTime()) / 86400000 / j.dias) * 100 : null
  const totais = linhas.reduce((t, l) => ({ concluido: t.concluido + l.contadores.concluido, andamento: t.andamento + l.contadores.andamento, atrasado: t.atrasado + l.contadores.atrasado, a_fazer: t.a_fazer + l.contadores.a_fazer }), { concluido: 0, andamento: 0, atrasado: 0, a_fazer: 0 })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SeletorPeriodo periodo={periodo} setPeriodo={setPeriodo} rotulo={j.rotulo} onMover={d => setRef(moverPeriodo(periodo, ref, d))} onHoje={() => setRef(hoje)} />
      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--v2-ink2)' }}>
        {carregando ? 'Carregando os planos…' : linhas.length
          ? <>{linhas.length} {linhas.length === 1 ? 'cliente' : 'clientes'} com entregas no período · <span style={{ color: COR_STATUS.concluido.forte, fontWeight: 700 }}>{totais.concluido} entregues</span> · <span style={{ color: COR_STATUS.andamento.forte, fontWeight: 700 }}>{totais.andamento} em andamento</span> · <span style={{ color: COR_STATUS.atrasado.forte, fontWeight: 700 }}>{totais.atrasado} atrasadas</span> · {totais.a_fazer} a seguir</>
          : 'Nenhum cliente com entregas neste período.'}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {linhas.map((l, i) => (
          <button key={l.clienteId} type="button" onClick={() => onAbrirCliente(l.clienteId)} className="anim-item"
            style={{ ['--i' as any]: i, display: 'grid', gridTemplateColumns: mobile ? 'minmax(0, 1fr)' : 'minmax(0, 1.1fr) minmax(0, 1.6fr)', gap: mobile ? 8 : 18, alignItems: 'center', textAlign: 'left', padding: '12px 16px', borderRadius: 14, border: '1px solid var(--v2-rule)', borderLeft: `4px solid ${l.contadores.atrasado ? COR_STATUS.atrasado.forte : l.pctEntregue === 100 ? COR_STATUS.concluido.forte : COR_STATUS.andamento.forte}`, background: 'var(--v2-surface)', cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 800, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.clienteNome}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--v2-ink)', fontVariantNumeric: 'tabular-nums' }}>{l.pctEntregue}%</span>
              </span>
              <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(['atrasado', 'andamento', 'a_fazer', 'concluido'] as StatusEntrega[]).filter(s => l.contadores[s]).map(s => (
                  <span key={s} style={{ fontSize: 11.5, fontWeight: 700, color: COR_STATUS[s].forte, background: COR_STATUS[s].fundo, borderRadius: 999, padding: '2px 8px' }}>{l.contadores[s]} {ROTULO_STATUS[s].toLowerCase()}</span>
                ))}
              </span>
              {l.proximo && <span style={{ fontSize: 12.5, color: l.proximo.status === 'atrasado' ? COR_STATUS.atrasado.forte : 'var(--v2-ink3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Próxima: {l.proximo.titulo} · {fmtDiaMes(l.proximo.dia)}</span>}
            </span>
            <span aria-hidden style={{ position: 'relative', height: 28, borderRadius: 8, background: 'var(--v2-surface2)' }}>
              <span className="anim-barra" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${l.pctEntregue}%`, borderRadius: 8, background: COR_STATUS.concluido.fundo }} />
              {hojePos !== null && <span style={{ position: 'absolute', left: `${hojePos}%`, top: -3, bottom: -3, borderLeft: '2px solid var(--v2-hot)', opacity: 0.6 }} />}
              {l.marcos.map((m, k) => (
                <span key={k} title={`${m.titulo} · ${ROTULO_STATUS[m.status]}`} style={{ position: 'absolute', top: 8, left: `calc(${m.esquerda}% - 6px)`, width: 12, height: 12, transform: 'rotate(45deg)', borderRadius: 2, background: COR_STATUS[m.status].forte, border: '1.5px solid var(--v2-surface)', boxSizing: 'border-box' }} />
              ))}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
