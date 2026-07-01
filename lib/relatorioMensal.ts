// Gerador de relatorio mensal branded (PDF, client-side com jsPDF).
// Reaproveita o payload de /api/analytics + dados de entrega.

type RGB = [number, number, number]

function hexToRgb(hex?: string): RGB {
  const h = (hex || '#111111').replace('#', '')
  const r = parseInt(h.substring(0, 2), 16) || 17
  const g = parseInt(h.substring(2, 4), 16) || 17
  const b = parseInt(h.substring(4, 6), 16) || 17
  return [r, g, b]
}

function corContraste([r, g, b]: RGB): RGB {
  // texto branco em fundo escuro, preto em fundo claro
  return (r * 299 + g * 587 + b * 114) / 1000 < 140 ? [255, 255, 255] : [17, 17, 17]
}

function variacao(atual: number, anterior: number): string {
  if (!anterior) return atual > 0 ? '+100%' : '—'
  const pct = Math.round(((atual - anterior) / anterior) * 100)
  return `${pct >= 0 ? '+' : ''}${pct}%`
}

async function carregarLogoBase64(url?: string): Promise<{ data: string; w: number; h: number } | null> {
  if (!url) return null
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const data = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result as string)
      fr.onerror = reject
      fr.readAsDataURL(blob)
    })
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image()
      img.onload = () => resolve({ w: img.width, h: img.height })
      img.onerror = () => resolve({ w: 1, h: 1 })
      img.src = data
    })
    return { data, w: dims.w, h: dims.h }
  } catch {
    return null
  }
}

// Modelo EDITÁVEL do relatório (o usuário ajusta antes de exportar).
export type RelatorioMensalModelo = {
  tituloRelatorio: string           // "Relatório mensal"
  mesRef: string                    // "Junho/2026"
  entrega: { label: string; valor: string }[]
  observacoes: string               // texto livre (destaques do mês)
  metricas: { label: string; atual: string; variacao: string }[]
  topPosts: { data: string; tipo: string; legenda: string; curtidas: string; comentarios: string; alcance: string }[]
  incluir: { entrega: boolean; observacoes: boolean; desempenho: boolean; topPosts: boolean }
}

// Constrói o modelo inicial a partir do payload de /api/analytics + entrega.
export function montarModeloRelatorio(cliente: any, analyticsData: any, entregue: number, mesRef: string): RelatorioMensalModelo {
  const totais = analyticsData?.totais || {}
  const ant = analyticsData?.totaisAnterior || {}
  const perfil = analyticsData?.perfil || {}
  const contratado = Number(cliente?.postsMensais) || 0
  const metrica = (label: string, key: string) => ({ label, atual: String(totais[key] ?? 0), variacao: variacao(totais[key] ?? 0, ant[key] ?? 0) })
  return {
    tituloRelatorio: 'Relatório mensal',
    mesRef,
    entrega: [
      { label: 'Posts entregues', valor: contratado > 0 ? `${entregue} de ${contratado}` : `${entregue}` },
      { label: 'Cumprimento', valor: contratado > 0 ? `${Math.round((entregue / contratado) * 100)}%` : '—' },
      { label: 'Seguidores', valor: `${perfil.followers_count ?? '—'}` },
    ],
    observacoes: '',
    metricas: [
      metrica('Alcance', 'alcance'), metrica('Impressões', 'impressoes'), metrica('Curtidas', 'curtidas'),
      metrica('Comentários', 'comentarios'), metrica('Salvamentos', 'salvamentos'), metrica('Compartilhamentos', 'compartilhamentos'),
    ],
    topPosts: (analyticsData?.posts || []).slice(0, 10).map((p: any) => ({
      data: p.publicadoEm ? new Date(p.publicadoEm).toLocaleDateString('pt-BR') : '—',
      tipo: p.tipo || '—',
      legenda: (p.legenda || '').slice(0, 60),
      curtidas: String(p.curtidas ?? 0), comentarios: String(p.comentarios ?? 0), alcance: String(p.alcance ?? 0),
    })),
    incluir: { entrega: true, observacoes: false, desempenho: true, topPosts: true },
  }
}

// Gera o PDF a partir do modelo (já editado pelo usuário).
export async function gerarRelatorioMensal(opts: { cliente: any; modelo: RelatorioMensalModelo }) {
  const { cliente, modelo } = opts
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF()
  const larguraPg = doc.internal.pageSize.getWidth()
  const corPrim = hexToRgb(cliente?.corPrimaria)
  const corTxt = corContraste(corPrim)

  // ---- Cabecalho branded ----
  doc.setFillColor(corPrim[0], corPrim[1], corPrim[2])
  doc.rect(0, 0, larguraPg, 34, 'F')
  const logo = await carregarLogoBase64(cliente?.logo)
  if (logo) {
    try { const h = 20, w = Math.min(40, (logo.w / logo.h) * h); doc.addImage(logo.data, 'PNG', larguraPg - w - 14, 7, w, h) } catch {}
  }
  doc.setTextColor(corTxt[0], corTxt[1], corTxt[2])
  doc.setFontSize(18); doc.text(cliente?.nome || 'Cliente', 14, 16)
  doc.setFontSize(11); doc.text(`${modelo.tituloRelatorio} · ${modelo.mesRef}`, 14, 25)
  doc.setTextColor(120); doc.setFontSize(9); doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 42)

  let y = 48
  const nextY = () => ((doc as any).lastAutoTable?.finalY || y) + 10

  if (modelo.incluir.entrega) {
    autoTable(doc, { startY: y, head: [['Entrega do mês', '']], body: modelo.entrega.map(e => [e.label, e.valor]), theme: 'grid', headStyles: { fillColor: corPrim, textColor: corTxt }, styles: { fontSize: 10 } })
    y = nextY()
  }
  if (modelo.incluir.observacoes && modelo.observacoes.trim()) {
    autoTable(doc, { startY: y, head: [['Destaques do mês']], body: [[modelo.observacoes.trim()]], theme: 'grid', headStyles: { fillColor: corPrim, textColor: corTxt }, styles: { fontSize: 10, cellPadding: 4 } })
    y = nextY()
  }
  if (modelo.incluir.desempenho) {
    autoTable(doc, { startY: y, head: [['Métrica', 'Mês atual', 'Variação']], body: modelo.metricas.map(m => [m.label, m.atual, m.variacao]), theme: 'striped', headStyles: { fillColor: corPrim, textColor: corTxt }, styles: { fontSize: 9 } })
    y = nextY()
  }
  if (modelo.incluir.topPosts && modelo.topPosts.length > 0) {
    autoTable(doc, {
      startY: y, head: [['Data', 'Tipo', 'Legenda', 'Curtidas', 'Coment.', 'Alcance']],
      body: modelo.topPosts.map(p => [p.data, p.tipo, p.legenda, p.curtidas, p.comentarios, p.alcance]),
      theme: 'striped', headStyles: { fillColor: corPrim, textColor: corTxt }, styles: { fontSize: 8 }, columnStyles: { 2: { cellWidth: 70 } },
    })
  }

  const nome = (cliente?.nome || 'cliente').toLowerCase().replace(/\s+/g, '-')
  doc.save(`relatorio-mensal-${nome}-${modelo.mesRef.toLowerCase().replace(/[\s/]+/g, '-')}.pdf`)
}
