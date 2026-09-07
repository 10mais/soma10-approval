'use client'

// Avatar do colaborador: foto ou iniciais sobre âmbar. Usado nos cards da equipe.
export default function AvatarPessoa({ p, tam = 36 }: { p: { nome?: string; foto?: string }; tam?: number }) {
  const ini = (p.nome || '?').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase()
  return (
    <span style={{ width: tam, height: tam, borderRadius: Math.round(tam * 0.3), overflow: 'hidden', flexShrink: 0, display: 'grid', placeItems: 'center', background: p.foto ? 'var(--v2-surface2)' : 'var(--v2-amber-on)', color: '#17150E', fontSize: Math.round(tam * 0.36), fontWeight: 600 }}>
      {p.foto ? <img src={p.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : ini}
    </span>
  )
}
