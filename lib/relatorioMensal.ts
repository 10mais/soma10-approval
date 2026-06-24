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

export async function gerarRelatorioMensal(opts: {
  cliente: any
  analyticsData: any
  entregue: number
  mesRef: string // ex.: "Junho/2026"
}) {
  const { cliente, analyticsData, entregue, mesRef } = opts
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
    try {
      const h = 20, w = Math.min(40, (logo.w / logo.h) * h)
      doc.addImage(logo.data, 'PNG', larguraPg - w - 14, 7, w, h)
    } catch { /* ignora logo invalido */ }
  }

  doc.setTextColor(corTxt[0], corTxt[1], corTxt[2])
  doc.setFontSize(18)
  doc.text(cliente?.nome || analyticsData?.instagramUsername || 'Cliente', 14, 16)
  doc.setFontSize(11)
  doc.text(`Relatório mensal · ${mesRef}`, 14, 25)

  doc.setTextColor(120)
  doc.setFontSize(9)
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 42)

  const totais = analyticsData?.totais || {}
  const ant = analyticsData?.totaisAnterior || {}
  const perfil = analyticsData?.perfil || {}
  const contratado = Number(cliente?.postsMensais) || 0

  // ---- Resumo de entrega ----
  autoTable(doc, {
    startY: 48,
    head: [['Entrega do mês', '']],
    body: [
      ['Posts entregues', contratado > 0 ? `${entregue} de ${contratado}` : `${entregue}`],
      ['Cumprimento', contratado > 0 ? `${Math.round((entregue / contratado) * 100)}%` : '—'],
      ['Seguidores', `${perfil.followers_count ?? '—'}`],
    ],
    theme: 'grid',
    headStyles: { fillColor: corPrim, textColor: corTxt },
    styles: { fontSize: 10 },
  })

  // ---- Desempenho vs periodo anterior ----
  autoTable(doc, {
    startY: ((doc as any).lastAutoTable?.finalY || 48) + 10,
    head: [['Métrica', 'Mês atual', 'Variação']],
    body: [
      ['Alcance', totais.alcance ?? 0, variacao(totais.alcance ?? 0, ant.alcance ?? 0)],
      ['Impressões', totais.impressoes ?? 0, variacao(totais.impressoes ?? 0, ant.impressoes ?? 0)],
      ['Curtidas', totais.curtidas ?? 0, variacao(totais.curtidas ?? 0, ant.curtidas ?? 0)],
      ['Comentários', totais.comentarios ?? 0, variacao(totais.comentarios ?? 0, ant.comentarios ?? 0)],
      ['Salvamentos', totais.salvamentos ?? 0, variacao(totais.salvamentos ?? 0, ant.salvamentos ?? 0)],
      ['Compartilhamentos', totais.compartilhamentos ?? 0, variacao(totais.compartilhamentos ?? 0, ant.compartilhamentos ?? 0)],
    ],
    theme: 'striped',
    headStyles: { fillColor: corPrim, textColor: corTxt },
    styles: { fontSize: 9 },
  })

  // ---- Top posts ----
  const posts: any[] = (analyticsData?.posts || []).slice(0, 10)
  if (posts.length > 0) {
    autoTable(doc, {
      startY: ((doc as any).lastAutoTable?.finalY || 48) + 10,
      head: [['Data', 'Tipo', 'Legenda', 'Curtidas', 'Coment.', 'Alcance']],
      body: posts.map(p => [
        p.publicadoEm ? new Date(p.publicadoEm).toLocaleDateString('pt-BR') : '—',
        p.tipo || '—',
        (p.legenda || '').slice(0, 55) + ((p.legenda || '').length > 55 ? '…' : ''),
        p.curtidas ?? 0, p.comentarios ?? 0, p.alcance ?? 0,
      ]),
      theme: 'striped',
      headStyles: { fillColor: corPrim, textColor: corTxt },
      styles: { fontSize: 8 },
      columnStyles: { 2: { cellWidth: 70 } },
    })
  }

  const nome = (cliente?.nome || 'cliente').toLowerCase().replace(/\s+/g, '-')
  doc.save(`relatorio-mensal-${nome}-${mesRef.toLowerCase().replace(/[\s/]+/g, '-')}.pdf`)
}
