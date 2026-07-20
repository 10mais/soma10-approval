'use client'
import { ordenarLinhagem, ascendenteLinhagem, geracoesFaltando, type PessoaLinhagem } from '@/lib/linhagem'

// Desenho PURO da linhagem (sem fetch/estado): cadeia vertical do ascendente
// estrangeiro (topo) até o requerente (base), com o elo entre as gerações.
// Reutilizável — o checklist de documentos (Fase 3) e o portal (Fase 5) leem daqui.

const fmtVida = (p: PessoaLinhagem) => {
  const nasc = p.nascimento ? `n. ${p.nascimento}` : ''
  const obito = p.obito ? `f. ${p.obito}` : ''
  return [nasc, obito].filter(Boolean).join('  ·  ')
}

export default function ArvoreLinhagem({ pessoas, compacta = false }: { pessoas: PessoaLinhagem[]; compacta?: boolean }) {
  if (!pessoas.length) {
    return <p style={{ margin: 0, fontSize: 12.5, color: '#9ca3af' }}>Nenhuma pessoa na linhagem ainda.</p>
  }
  // Topo (maior geração / ascendente) primeiro, base por último.
  const ordenada = ordenarLinhagem(pessoas).slice().reverse()
  const asc = ascendenteLinhagem(pessoas)
  const lacunas = geracoesFaltando(pessoas)

  return (
    <div>
      {lacunas.length > 0 && (
        <div style={{ marginBottom: 10, padding: '7px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 11.5, color: '#92400e' }}>
          Elo faltando na prova de descendência: {lacunas.length === 1 ? 'a geração' : 'as gerações'} {lacunas.join(', ')} (contando a partir do requerente = 0).
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {ordenada.map((p, idx) => {
          const ehAsc = asc?.id === p.id
          return (
            <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 360 }}>
              <div style={{ width: '100%', background: ehAsc ? '#eef2ff' : '#fff', border: '1px solid ' + (ehAsc ? '#c7d2fe' : '#eef0f2'), borderRadius: 10, padding: compacta ? '7px 10px' : '9px 12px', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 13, color: '#111' }}>{p.nome}</strong>
                  {ehAsc && <span style={{ fontSize: 9.5, fontWeight: 700, color: '#3730a3', background: '#e0e7ff', borderRadius: 999, padding: '1px 7px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ascendente</span>}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                  {p.papel || `Geração ${p.geracao}`}{p.nascimentoLocal ? `  ·  ${p.nascimentoLocal}` : ''}
                </div>
                {!compacta && fmtVida(p) && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{fmtVida(p)}</div>}
              </div>
              {idx < ordenada.length - 1 && <div style={{ width: 2, height: 16, background: '#d1d5db' }} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
