'use client'
import { Piso, Assento, ElementoLayout, elementoInfo, totalLinhas, deslocPoltrona } from '@/lib/layoutVeiculo'

// DESENHO do croqui. Compartilhado pelo editor da Frota e pelo mapa das Reservas —
// os dois desenhavam a própria grade, e era por isso que o croqui saía diferente
// em cada tela.
//
// COMPONENTE PURO: sem fetch, sem server action, sem estado de dado. É essa pureza
// que faz ele servir o painel interno e, depois, a tela pública de venda. Quem
// decide o conteúdo da célula é quem chama, via render-prop.
//
// Usa CSS Grid porque o croqui tem SPAN: o módulo de bar cobre 2 fileiras
// (`rowSpan`) e o frigobar de fundo atravessa o piso (`largura: 'total'`). Com
// flexbox isso viraria célula solta.
//
// O CORREDOR não é coluna: `corredorApos` insere um vão entre as colunas. Por isso
// a coluna do dado (0,1,2) não é a coluna visual da grade.

export const CELULA = 34
export const ALTURA = 32
export const GAP = 5
export const CORREDOR_W = 16

export const IconVolante = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v6M3.5 14.5l5.7-1.8M20.5 14.5l-5.7-1.8" />
  </svg>
)

// Coluna do dado → coluna da grade (1-based), pulando os vãos de corredor.
export function colunaVisual(col: number, corredorApos: number[]): number {
  return col + corredorApos.filter(c => c < col).length + 1
}

// Casco: nariz arredondado na frente, traseira reta. Sem isso ninguém sabe onde é
// a frente do carro — e sem a frente, não dá para conferir contra o croqui real.
export function CorpoVeiculo({ titulo, comVolante, children }: {
  titulo: string
  comVolante?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>{titulo}</div>
      <div style={{
        display: 'inline-block', border: '2px solid #d8dde3',
        borderRadius: '54px 54px 16px 16px', background: '#fff', padding: '10px 14px 16px',
      }}>
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

export const poltronaBase: React.CSSProperties = {
  width: CELULA, height: ALTURA, padding: 0,
  borderRadius: '9px 9px 6px 6px',
  fontSize: 10.5, fontWeight: 800,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}

export const vazioBase: React.CSSProperties = { width: CELULA, height: ALTURA }

// Elemento padrão (bar, banheiro, porta…). Respeita span/rowSpan/largura total.
export function ElementoBox({ el, corredorApos, children, ...resto }: {
  el: ElementoLayout
  corredorApos: number[]
  children?: React.ReactNode
} & React.HTMLAttributes<HTMLDivElement>) {
  const info = elementoInfo(el)
  const c0 = el.col ?? 0
  const grid = el.largura === 'total'
    ? { gridColumn: '1 / -1' }
    : { gridColumn: `${colunaVisual(c0, corredorApos)} / ${colunaVisual(c0 + (el.span || 1) - 1, corredorApos) + 1}` }
  return (
    <div
      title={el.rotulo}
      {...resto}
      style={{
        ...grid,
        gridRow: `${el.linha + 1} / ${el.linha + 1 + (el.rowSpan || 1)}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 8, fontWeight: 700, color: info.cor, background: info.bg,
        borderRadius: 7, padding: '0 4px', textAlign: 'center', lineHeight: 1.15,
        minHeight: ALTURA, overflow: 'hidden',
        ...(resto.style || {}),
      }}
    >{children ?? el.rotulo}</div>
  )
}

// Grade de um piso. `extraLinhas` dá onde crescer (o editor usa; as reservas não —
// lá o croqui é só leitura).
export function CroquiPiso({ piso, extraLinhas = 0, renderAssento, renderVazio, renderElemento }: {
  piso: Piso
  extraLinhas?: number
  renderAssento: (a: Assento) => React.ReactNode
  renderVazio?: (linha: number, col: number) => React.ReactNode
  renderElemento?: (el: ElementoLayout, i: number) => React.ReactNode
}) {
  const linhas = Math.max(totalLinhas(piso) + extraLinhas, 1)
  // Colunas da grade = colunas do dado + um vão estreito por corredor.
  const colunas: string[] = []
  for (let c = 0; c < piso.colunas; c++) {
    colunas.push(`${CELULA}px`)
    if (piso.corredorApos.includes(c)) colunas.push(`${CORREDOR_W}px`)
  }

  const ocupadaPorElemento = (linha: number, col: number) => (piso.elementos || []).some(e => {
    if (linha < e.linha || linha >= e.linha + (e.rowSpan || 1)) return false
    if (e.largura === 'total') return true
    const c0 = e.col ?? 0
    return col >= c0 && col < c0 + (e.span || 1)
  })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: colunas.join(' '), gap: GAP, alignItems: 'stretch' }}>
      {/* Elementos primeiro: eles se posicionam sozinhos pelo grid-column/row */}
      {(piso.elementos || []).map((el, i) => renderElemento
        ? renderElemento(el, i)
        : <ElementoBox key={`el-${i}`} el={el} corredorApos={piso.corredorApos} />)}

      {/* Assentos e vazios, célula a célula */}
      {Array.from({ length: linhas }, (_, l) => l).flatMap(linha =>
        Array.from({ length: piso.colunas }, (_, c) => c).map(col => {
          if (ocupadaPorElemento(linha, col)) return null // o elemento já cobre
          const a = (piso.assentos || []).find(x => x[0] === linha && x[1] === col)
          // Ajuste fino ("mover livre"): o desloc [dx, dy] em frações de célula
          // desloca só o DESENHO — a célula lógica (grid) segue a mesma. É o que
          // faz a poltrona do fundo ficar no meio do corredor, como no carro real.
          const [dx, dy] = a ? deslocPoltrona(a) : [0, 0]
          const estilo: React.CSSProperties = {
            gridColumn: colunaVisual(col, piso.corredorApos), gridRow: linha + 1,
            ...(dx || dy ? { transform: `translate(${dx * (CELULA + GAP)}px, ${dy * (ALTURA + GAP)}px)`, position: 'relative', zIndex: 1 } : {}),
          }
          return (
            <div key={`${linha}-${col}`} style={estilo}>
              {a ? renderAssento(a) : renderVazio?.(linha, col) ?? <span style={vazioBase} />}
            </div>
          )
        }),
      )}
    </div>
  )
}
