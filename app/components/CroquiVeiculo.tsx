'use client'
import { LayoutVeiculo, ElementoLayout, dimensoesLayout } from '@/lib/layoutVeiculo'

// DESENHO do croqui — o casco do veículo e a grade. Compartilhado pelo editor da
// Frota e pelo mapa de poltronas das Reservas: os dois desenhavam a própria grade,
// e era por isso que o croqui saía diferente em cada tela.
//
// Aqui mora só a MOLDURA (corpo, para-brisa, volante, traseira) e o esqueleto da
// grade. Quem decide o que vai em cada célula é a tela, via `renderCelula` — o
// editor precisa de célula vazia clicável e arrastar; as reservas, de poltrona
// selecionável.
//
// Convenção de colunas: 1,2 = par esquerdo · 3 = corredor · 4,5 = par direito
// (2+2) ou individual + amenidades (2+1, os leitos da Deny).

export const CELULA = 34
export const ALTURA = 32
export const GAP = 5

// Volante — SVG, sem emoji (regra do produto).
export const IconVolante = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v6M3.5 14.5l5.7-1.8M20.5 14.5l-5.7-1.8" />
  </svg>
)

// Corpo do veículo: nariz arredondado (para-brisa) na frente, traseira mais reta.
// Sem isto o croqui é uma grade solta e ninguém sabe onde é a frente do carro.
export function CorpoVeiculo({ titulo, comVolante, children }: {
  titulo: string
  comVolante?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>{titulo}</div>
      <div style={{
        display: 'inline-block',
        border: '2px solid #d8dde3',
        // Frente bem arredondada, traseira só levemente — é o que dá leitura de
        // "este lado é a frente" sem precisar de legenda.
        borderRadius: '54px 54px 16px 16px',
        background: '#fff',
        padding: '10px 14px 16px',
      }}>
        {/* Para-brisa + posto do motorista */}
        <div style={{ height: 34, display: 'flex', alignItems: 'center', gap: 6, padding: '0 2px', marginBottom: 8, borderBottom: '1px dashed #eef1f4' }}>
          {comVolante ? <IconVolante /> : <span style={{ width: 22 }} />}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 9, fontWeight: 800, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '.08em' }}>Frente</span>
        </div>
        {children}
      </div>
    </div>
  )
}

// Estilo base da poltrona — encosto arredondado, como mapa de ônibus de verdade.
export const poltronaBase: React.CSSProperties = {
  width: CELULA, height: ALTURA, padding: 0,
  borderRadius: '9px 9px 6px 6px',
  fontSize: 10.5, fontWeight: 800,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}

// Espaço vazio da grade. O corredor cai aqui: é VÃO, não objeto — desenhar um
// quadradinho rotulado "Corredor" 16 vezes é o que deixava o croqui ilegível.
export const vazioBase: React.CSSProperties = { width: CELULA, height: ALTURA }

// Grade de um andar. `extraFileiras` dá espaço para crescer (o editor usa; as
// reservas, não — lá o croqui é só leitura).
export function GradeAndar({ layout, andar, extraFileiras = 0, minColunas = 5, renderCelula }: {
  layout: LayoutVeiculo
  andar: number
  extraFileiras?: number
  minColunas?: number
  renderCelula: (fileira: number, coluna: number) => React.ReactNode
}) {
  const { maxFileira, maxColuna } = dimensoesLayout(layout, andar)
  const linhas = Math.max(maxFileira + extraFileiras, 1)
  const colunas = Math.max(maxColuna, minColunas)
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: GAP }}>
      {Array.from({ length: linhas }, (_, f) => f + 1).map(fileira => (
        <div key={fileira} style={{ display: 'flex', gap: GAP }}>
          {Array.from({ length: colunas }, (_, c) => c + 1).map(coluna => renderCelula(fileira, coluna))}
        </div>
      ))}
    </div>
  )
}

// Mapa (fileira-coluna) → item, por andar. Os dois lados precisam disso.
export function mapasDoAndar(layout: LayoutVeiculo, andar: number) {
  const poltronas = new Map<string, LayoutVeiculo['poltronas'][number]>()
  layout.poltronas.filter(p => p.andar === andar).forEach(p => poltronas.set(`${p.fileira}-${p.coluna}`, p))
  const elementos = new Map<string, ElementoLayout>()
  ;(layout.elementos || []).filter(e => e.andar === andar).forEach(e => elementos.set(`${e.fileira}-${e.coluna}`, e))
  return { poltronas, elementos }
}

export const nomeAndar = (andar: number, andares: number) =>
  andares > 1 ? (andar === 1 ? 'Inferior' : 'Superior') : 'Poltronas'
