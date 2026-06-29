import { redis, Post, Cliente } from './redis'

function dataPost(p: Post) { return new Date((p as any).dataAgendada || p.atualizadoEm || p.criadoEm || 0) }
function fmtDia(d: Date) { return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) }
function tituloPost(p: Post) { const l = (p.legenda || '').replace(/\s+/g, ' ').trim(); return l ? l.slice(0, 50) + (l.length > 50 ? '…' : '') : `Post ${(p as any).codigo || ''}`.trim() }

export type Resumo = { cliente: Cliente; texto: string; html: string; publicados: number; aguardando: number; proximos: number }

// Predefinicao (template) das partes editaveis do resumo. {cliente} e {periodo} sao substituidos.
export type ResumoTemplate = { intro?: string; fechamento?: string }

function aplicar(txt: string, cliente: string, periodo: string) {
  return txt.replace(/\{cliente\}/g, cliente).replace(/\{periodo\}/g, periodo)
}

// Monta o resumo da semana de um cliente a partir dos posts no Redis.
// tpl: predefinicao opcional (saudacao/fechamento personalizados). Sem tpl => texto padrao.
export async function gerarResumoSemanal(clienteId: string, tpl?: ResumoTemplate): Promise<Resumo | null> {
  const cliente = await redis.get<Cliente>(`cliente:${clienteId}`)
  if (!cliente) return null

  const ids = await redis.smembers('posts')
  const posts = ids.length ? ((await redis.mget<(Post | null)[]>(...ids.map(i => `post:${i}`))).filter(Boolean) as Post[]) : []
  const meus = posts.filter(p => p.clienteId === clienteId)

  const agora = Date.now()
  const SEMANA = 7 * 24 * 60 * 60 * 1000

  const publicados = meus.filter(p => p.status === 'publicado' && dataPost(p).getTime() >= agora - SEMANA)
    .sort((a, b) => dataPost(b).getTime() - dataPost(a).getTime())
  const aguardando = meus.filter(p => (p as any).etapa === 'aprovacao_copy' || (p as any).etapa === 'aprovacao_criativo' || p.status === 'aguardando_aprovacao')
  const proximos = meus.filter(p => p.status === 'agendado' && (p as any).dataAgendada && new Date((p as any).dataAgendada).getTime() >= agora && new Date((p as any).dataAgendada).getTime() <= agora + SEMANA)
    .sort((a, b) => new Date((a as any).dataAgendada).getTime() - new Date((b as any).dataAgendada).getTime())

  const hoje = new Date()
  const inicio = new Date(agora - SEMANA)
  const periodo = `${fmtDia(inicio)} a ${fmtDia(hoje)}`

  // Partes personalizaveis (com placeholders) — default reproduz o texto atual
  const introTxt = tpl?.intro && tpl.intro.trim()
    ? aplicar(tpl.intro, cliente.nome, periodo)
    : `*Resumo da semana — ${cliente.nome}*\n${periodo}`
  const fechamentoTxt = tpl?.fechamento && tpl.fechamento.trim()
    ? aplicar(tpl.fechamento, cliente.nome, periodo)
    : 'Qualquer dúvida, é só chamar! 💛 — Grupo 10+'

  // Texto plano (WhatsApp)
  const linhas: string[] = []
  linhas.push(introTxt)
  linhas.push('')
  linhas.push(`✅ Publicados nesta semana: ${publicados.length}`)
  publicados.slice(0, 8).forEach(p => linhas.push(`• ${tituloPost(p)}`))
  linhas.push('')
  if (aguardando.length > 0) {
    linhas.push(`⏳ Aguardando a sua aprovação: ${aguardando.length}`)
    aguardando.slice(0, 8).forEach(p => linhas.push(`• ${tituloPost(p)}`))
    linhas.push('👉 Aprove para mantermos o ritmo das entregas.')
    linhas.push('')
  }
  if (proximos.length > 0) {
    linhas.push(`📅 Próximas publicações:`)
    proximos.slice(0, 8).forEach(p => linhas.push(`• ${fmtDia(new Date((p as any).dataAgendada))} — ${tituloPost(p)}`))
    linhas.push('')
  }
  linhas.push(fechamentoTxt)
  const texto = linhas.join('\n')

  // HTML (e-mail)
  const li = (arr: Post[], prefixo?: (p: Post) => string) => arr.length
    ? `<ul style="margin:6px 0 0;padding-left:18px;color:#444">${arr.slice(0, 8).map(p => `<li>${prefixo ? prefixo(p) : ''}${tituloPost(p)}</li>`).join('')}</ul>` : '<p style="margin:6px 0 0;color:#999">—</p>'
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:${cliente.corPrimaria || '#ffc00f'};padding:22px;border-radius:12px 12px 0 0">
        <h1 style="color:#111;margin:0;font-size:20px">Resumo da semana</h1>
        <p style="color:#111;margin:4px 0 0;opacity:.8">${cliente.nome} · ${periodo}</p>
      </div>
      <div style="background:#fff;padding:22px;border-radius:0 0 12px 12px;border:1px solid #eee">
        ${tpl?.intro && tpl.intro.trim() ? `<p style="margin:0 0 14px;color:#444;white-space:pre-wrap">${aplicar(tpl.intro, cliente.nome, periodo)}</p>` : ''}
        <h3 style="margin:0;color:#16a34a">✅ Publicados: ${publicados.length}</h3>${li(publicados)}
        <h3 style="margin:18px 0 0;color:#ca8a04">⏳ Aguardando sua aprovação: ${aguardando.length}</h3>${li(aguardando)}
        <h3 style="margin:18px 0 0;color:#111">📅 Próximas publicações</h3>${li(proximos, p => `${fmtDia(new Date((p as any).dataAgendada))} — `)}
        ${tpl?.fechamento && tpl.fechamento.trim() ? `<p style="margin:16px 0 0;color:#444;white-space:pre-wrap">${aplicar(tpl.fechamento, cliente.nome, periodo)}</p>` : ''}
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
        <p style="color:#aaa;font-size:12px;text-align:center">Soma10 Approval · Grupo 10+</p>
      </div>
    </div>`

  return { cliente, texto, html, publicados: publicados.length, aguardando: aguardando.length, proximos: proximos.length }
}
