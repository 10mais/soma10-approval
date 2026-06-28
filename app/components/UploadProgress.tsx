'use client'

// Barra de progresso de upload/processamento, reutilizada em todos os pontos de
// envio (anexos, midias, documentos, CV, logo, avatar...). Renderiza nada quando
// `valor` e null; mostra a barra (0-100) enquanto o upload acontece.
export default function UploadProgress({ valor, cor = '#1d4ed8', rotulo }: { valor: number | null; cor?: string; rotulo?: string }) {
  if (valor === null || valor === undefined) return null
  const pct = Math.max(0, Math.min(100, Math.round(valor)))
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginBottom: 4 }}>
        <span>{rotulo || 'Enviando...'}</span>
        <span>{pct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: '#eee', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: 999, transition: 'width .2s' }} />
      </div>
    </div>
  )
}
