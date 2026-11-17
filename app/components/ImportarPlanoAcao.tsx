'use client'
// Importar o plano de ação por semanas a partir da planilha (F1 do plano de ação, 17/11/2026).
// A pessoa copia as abas "Progresso" e "Entregas" no Google Sheets e cola aqui; a regra de
// leitura mora em lib/planoAcao (testada com a planilha real do Dr. Angelo). Cada semana vira
// um marco do Plano de entregas com as entregas dentro. Ctrl+Z desfaz a importação inteira.
import { useEffect, useMemo, useState } from 'react'
import { lerProgresso, lerEntregas, inicioPelaPlanilha, montarPlanoImportado, rotuloFrente, type Pessoa } from '@/lib/planoAcao'
import { statusSugerido } from '@/lib/subetapas'
import { fecharFora } from '@/lib/fecharModal'
import { registrarDesfazer } from '@/lib/desfazer'
import { toast } from '@/lib/toast'
import { hojeYmd, fmtDiaMes, fmtDataBR, ehData } from '@/lib/datas'
import LimiteDeErro from './LimiteDeErro'

type Props = { clienteId: string; clienteNome: string; semanasExistentes: number; onClose: () => void; onImportado: () => void }

export default function ImportarPlanoAcao(props: Props) {
  return <LimiteDeErro onFechar={props.onClose} titulo="Não foi possível abrir a importação"><Tela {...props} /></LimiteDeErro>
}

const campo: React.CSSProperties = { width: '100%', boxSizing: 'border-box', minHeight: 92, padding: 10, border: '1px solid var(--v2-rule)', borderRadius: 10, background: 'var(--v2-surface)', color: 'var(--v2-ink)', fontFamily: 'ui-monospace, monospace', fontSize: 11.5, resize: 'vertical' }
const rotulo: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--v2-ink2)', margin: '12px 0 6px' }

function Tela({ clienteId, clienteNome, semanasExistentes, onClose, onImportado }: Props) {
  const [textoProgresso, setTextoProgresso] = useState('')
  const [textoEntregas, setTextoEntregas] = useState('')
  const [inicioManual, setInicioManual] = useState('')
  const [equipe, setEquipe] = useState<Pessoa[]>([])
  const [enviando, setEnviando] = useState(false)

  useEffect(() => { fetch('/api/equipe').then(r => r.json()).then(d => setEquipe(Array.isArray(d) ? d : [])).catch(() => {}) }, [])
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !enviando) onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose, enviando])

  const progresso = useMemo(() => lerProgresso(textoProgresso), [textoProgresso])
  const entregas = useMemo(() => lerEntregas(textoEntregas), [textoEntregas])
  const inicioLido = useMemo(() => inicioPelaPlanilha(progresso, hojeYmd()), [progresso])
  const inicio = ehData(inicioManual) ? inicioManual : inicioLido || ''
  const plano = useMemo(() => (inicio && (progresso.length || entregas.length) ? montarPlanoImportado(progresso, entregas, inicio, equipe) : null), [progresso, entregas, inicio, equipe])
  const totalEntregas = plano ? plano.semanas.reduce((n, s) => n + s.entregas.length, 0) : 0

  async function importar() {
    if (!plano || enviando) return
    setEnviando(true)
    const criados: string[] = []
    try {
      for (const s of plano.semanas) {
        const r = await fetch('/api/playbook', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clienteId, clienteNome, tipo: 'semana', foco: s.foco, recesso: s.recesso,
            titulo: `W${s.numero} · ${s.foco}`, categoria: 'entrega',
            status: statusSugerido('planejado', s.entregas, new Date(hojeYmd() + 'T12:00').getTime()),
            dataInicio: s.dataInicio, dataFim: s.dataFim, subetapas: s.entregas,
          }),
        })
        const d = await r.json().catch(() => ({}))
        if (!r.ok || !d?.marco?.id) throw new Error(d?.error || `A semana W${s.numero} não foi gravada.`)
        criados.push(d.marco.id)
      }
      registrarDesfazer(`Importação do plano de ${clienteNome}`, async () => {
        const rs = await Promise.all(criados.map(id => fetch(`/api/playbook?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).then(r => r.ok).catch(() => false)))
        onImportado()
        return rs.every(Boolean)
      })
      toast(`${criados.length} semanas e ${totalEntregas} entregas criadas no Plano de entregas.`, 'sucesso')
      onImportado()
      onClose()
    } catch (e: any) {
      // Gravou metade? Desfaz o que entrou para não deixar plano pela metade.
      await Promise.all(criados.map(id => fetch(`/api/playbook?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null)))
      toast(e?.message || 'Não foi possível importar.', 'erro')
      setEnviando(false)
    }
  }

  return (
    <div onClick={fecharFora(() => { if (!enviando) onClose() })} className="anim-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label="Importar plano por semanas" onClick={e => e.stopPropagation()} className="anim-modal" style={{ background: 'var(--v2-surface)', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '92vh', overflowY: 'auto', padding: 22, boxSizing: 'border-box' }}>
        <h3 style={{ margin: 0, fontSize: 17, color: 'var(--v2-ink)' }}>Importar plano por semanas</h3>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--v2-ink3)' }}>
          {clienteNome}. No Google Sheets, selecione a aba inteira (Ctrl+A), copie e cole abaixo. Cada semana vira uma linha do Plano de entregas com as entregas dentro.
        </p>

        <label style={rotulo} htmlFor="imp-progresso">Aba "Progresso" (semanas e foco)</label>
        <textarea id="imp-progresso" value={textoProgresso} onChange={e => setTextoProgresso(e.target.value)} placeholder={'Semana\tPeríodo\tFoco da semana\tPrevistas\tConcluídas\nW1\t19/10 a 25/10\tOnboarding…'} style={campo} />
        <label style={rotulo} htmlFor="imp-entregas">Aba "Entregas"</label>
        <textarea id="imp-entregas" value={textoEntregas} onChange={e => setTextoEntregas(e.target.value)} placeholder={'Semana\tEntrega\tFrente\tResponsável\tStatus\tObservação\nW1\tDocumento de kickoff…'} style={campo} />

        {(progresso.length > 0 || entregas.length > 0) && (
          <div style={{ marginTop: 14, padding: 14, borderRadius: 12, background: 'var(--v2-surface2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <label htmlFor="imp-inicio" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--v2-ink2)' }}>A semana 1 começa em</label>
              <input id="imp-inicio" type="date" value={inicio} onChange={e => setInicioManual(e.target.value)} style={{ padding: '6px 8px', border: '1px solid var(--v2-rule)', borderRadius: 8, background: 'var(--v2-surface)', color: 'var(--v2-ink)', fontFamily: 'inherit' }} />
              {!inicio && <span style={{ fontSize: 12, color: 'var(--v2-hot)' }}>Não achei a data da W1: escolha o dia.</span>}
            </div>
            {plano && (<>
              <p style={{ margin: '10px 0 0', fontSize: 14, fontWeight: 800, color: 'var(--v2-ink)' }}>{plano.semanas.length} semanas · {totalEntregas} entregas · de {fmtDataBR(plano.semanas[0]?.dataInicio)} a {fmtDataBR(plano.semanas[plano.semanas.length - 1]?.dataFim)}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--v2-ink3)' }}>Semanas de segunda a domingo. O período escrito na planilha é ignorado; as datas das reuniões semanais confirmam a conta.</p>
              {plano.avisos.length > 0 && (
                <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--v2-amber-on, var(--v2-ink2))' }}>
                  {plano.avisos.map(a => <li key={a} style={{ margin: '2px 0' }}>{a}</li>)}
                </ul>
              )}
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
                {plano.semanas.map(s => {
                  const feitas = s.entregas.filter(e => e.status === 'concluido').length
                  return (
                    <div key={s.numero} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 12.5, color: 'var(--v2-ink2)' }}>
                      <span style={{ fontWeight: 800, color: 'var(--v2-ink)', minWidth: 30 }}>W{s.numero}</span>
                      <span style={{ minWidth: 84, color: 'var(--v2-ink3)' }}>{fmtDiaMes(s.dataInicio)} a {fmtDiaMes(s.dataFim)}</span>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.entregas.map(e => `${e.titulo}${e.frente ? ` (${rotuloFrente(e.frente)})` : ''}`).join('\n')}>{s.recesso && !/recesso/i.test(s.foco) ? 'Recesso · ' : ''}{s.foco}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--v2-ink3)' }}>{feitas}/{s.entregas.length}</span>
                    </div>
                  )
                })}
              </div>
            </>)}
          </div>
        )}

        {semanasExistentes > 0 && plano && (
          <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--v2-hot)', fontWeight: 600 }}>
            {clienteNome} já tem {semanasExistentes} {semanasExistentes === 1 ? 'semana' : 'semanas'} no plano. Importar de novo cria outras ao lado (Ctrl+Z desfaz).
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} disabled={enviando} style={{ padding: '10px 18px', background: 'var(--v2-surface1, var(--v2-surface2))', color: 'var(--v2-ink2)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={importar} disabled={!plano || !plano.semanas.length || enviando} style={{ padding: '10px 18px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13.5, cursor: !plano || enviando ? 'default' : 'pointer', opacity: !plano || !plano.semanas.length ? 0.5 : 1, fontFamily: 'inherit' }}>
            {enviando ? 'Criando…' : plano ? `Criar ${plano.semanas.length} semanas` : 'Criar semanas'}
          </button>
        </div>
      </div>
    </div>
  )
}
