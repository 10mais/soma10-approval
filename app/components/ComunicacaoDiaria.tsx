'use client'
import { useEffect, useMemo, useState } from 'react'
import { toast } from '@/lib/toast'
import { fecharFora } from '@/lib/fecharModal'
import { registrarDesfazer } from '@/lib/desfazer'
import {
  avaliarTexto, candidatosDoDia, semanaUtil, doDia, diasUteisSemComunicar, previstoNaSemana,
  TIPOS, LABEL_TIPO, type Comunicado, type Candidato, type TipoComunicacao,
} from '@/lib/comunicacao'

// COMUNICAÇÃO DIÁRIA (dono, 08/09/2026) — o painel abre POR CIMA do hub do cliente,
// para ninguém perder o lugar onde estava (mesma lição do "editar fases" do onboarding).
//
// Três blocos, na ordem em que a cabeça funciona de manhã:
//   1. a SEMANA (seg a sex): o que já saiu nos dias passados, hoje em destaque, e o
//      que já está previsto nos dias que vêm;
//   2. o que HÁ PARA COMUNICAR hoje, com o texto pronto (regra em lib/comunicacao:
//      não repete o mesmo assunto no mesmo estado, mas volta quando ele evolui);
//   3. escrever algo por fora, passando pela mesma regra do que conta.

type Props = {
  clienteId: string
  clienteNome: string
  telefone?: string
  posts: any[]
  tarefas: any[]
  marcos: any[]
  onFechar: () => void
  onMudou?: (comunicados: Comunicado[]) => void
}

const CHIP: Record<string, { cor: string; bg: string }> = {
  material: { cor: '#8a5b00', bg: 'var(--v2-amber-bg)' },
  questionamento: { cor: 'var(--v2-hot)', bg: 'var(--v2-hot-bg)' },
  reuniao: { cor: '#3f4c9b', bg: '#e6e8f5' },
  vitoria: { cor: '#0e7566', bg: '#dff0ec' },
  ganho: { cor: '#0e7566', bg: '#dff0ec' },
  processo: { cor: 'var(--v2-ink2)', bg: 'var(--v2-surface2)' },
}

function Chip({ tipo }: { tipo: string }) {
  const c = CHIP[tipo] || CHIP.processo
  return (
    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: c.cor, background: c.bg, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      {LABEL_TIPO[tipo] || tipo}
    </span>
  )
}

export default function ComunicacaoDiaria({ clienteId, clienteNome, telefone, posts, tarefas, marcos, onFechar, onMudou }: Props) {
  const [comunicados, setComunicados] = useState<Comunicado[] | null>(null)
  const [textos, setTextos] = useState<Record<string, string>>({})
  const [escondidos, setEscondidos] = useState<string[]>([])
  const [ocupado, setOcupado] = useState('')
  const [livre, setLivre] = useState('')
  const [tipoLivre, setTipoLivre] = useState<TipoComunicacao>('processo')

  const semana = useMemo(() => semanaUtil(), [])
  const [diaSel, setDiaSel] = useState(() => semana.find(d => d.hoje)?.data || semana[0].data)

  useEffect(() => {
    fetch(`/api/comunicados?clienteId=${clienteId}`).then(r => r.ok ? r.json() : []).then(d => setComunicados(Array.isArray(d) ? d : [])).catch(() => setComunicados([]))
  }, [clienteId])

  const feitos = comunicados || []
  const candidatos = useMemo(
    () => candidatosDoDia({ posts, tarefas, marcos, comunicados: feitos }).filter(c => !escondidos.includes(c.assunto + '|' + c.estado)),
    [posts, tarefas, marcos, feitos, escondidos],
  )
  const previstos = useMemo(() => previstoNaSemana({ posts, tarefas, marcos }, semana), [posts, tarefas, marcos, semana])
  const semComunicar = diasUteisSemComunicar(feitos)
  const hojeSel = semana.find(d => d.data === diaSel)?.hoje

  function atualizar(lista: Comunicado[]) {
    setComunicados(lista)
    onMudou?.(lista)
  }

  async function registrar(dados: { tipo: TipoComunicacao; texto: string; assunto: string; estado: string; canal: 'whatsapp' | 'copiado' | 'outro' }) {
    const r = await fetch('/api/comunicados', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId, ...dados }) }).catch(() => null)
    const d = r ? await r.json().catch(() => null) : null
    if (!r?.ok || !d?.comunicado) {
      toast(d?.error || 'Não foi possível registrar.', 'erro', d?.dica ? 'Isso não conta como comunicação' : undefined)
      if (d?.dica) toast(d.dica, 'info')
      return false
    }
    const novo: Comunicado = d.comunicado
    atualizar([novo, ...feitos])
    registrarDesfazer(`Comunicado de ${LABEL_TIPO[novo.tipo]}`, async () => {
      const rr = await fetch(`/api/comunicados?id=${novo.id}`, { method: 'DELETE' }).catch(() => null)
      setComunicados(l => (l || []).filter(x => x.id !== novo.id))
      return !!rr?.ok
    })
    return true
  }

  async function copiarERegistrar(c: Candidato, texto: string) {
    setOcupado(c.assunto + c.estado)
    try { await navigator.clipboard.writeText(texto) } catch { /* sem permissão de área de transferência: segue e registra */ }
    const ok = await registrar({ tipo: c.tipo, texto, assunto: c.assunto, estado: c.estado, canal: 'copiado' })
    setOcupado('')
    if (ok) toast('Texto copiado e registrado no dia de hoje.', 'sucesso')
  }

  async function enviarWhats(c: Candidato, texto: string) {
    if (!telefone) { toast('Este cliente não tem telefone cadastrado.', 'erro'); return }
    setOcupado(c.assunto + c.estado)
    const r = await fetch('/api/crm/mensagens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telefone, texto }) }).catch(() => null)
    const d = r ? await r.json().catch(() => null) : null
    if (!d?.ok) {
      setOcupado('')
      toast(d?.error || 'Não foi possível enviar pelo WhatsApp. Use copiar e registrar.', 'erro')
      return
    }
    const ok = await registrar({ tipo: c.tipo, texto, assunto: c.assunto, estado: c.estado, canal: 'whatsapp' })
    setOcupado('')
    if (ok) toast('Enviado no WhatsApp e registrado.', 'sucesso')
  }

  async function registrarLivre() {
    const v = avaliarTexto(livre, tipoLivre)
    if (!v.ok) { toast(v.motivo || 'Isso não conta como comunicação.', 'erro'); if (v.dica) toast(v.dica, 'info'); return }
    setOcupado('livre')
    const ok = await registrar({ tipo: tipoLivre, texto: livre.trim(), assunto: `livre:${Date.now()}`, estado: 'unico', canal: 'outro' })
    setOcupado('')
    if (ok) { setLivre(''); toast('Comunicação registrada.', 'sucesso') }
  }

  const vereditoLivre = livre.trim().length >= 3 ? avaliarTexto(livre, tipoLivre) : null

  return (
    <div onClick={fecharFora(onFechar)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v2-surface)', borderRadius: 16, maxWidth: 760, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 17, color: 'var(--v2-ink)' }}>Comunicação diária</h3>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--v2-ink3)' }}>
              {clienteNome}
              {/* Sem NENHUM registro, "22 dias úteis" seria um número inventado: o histórico
                  simplesmente não existe ainda. */}
              {feitos.length === 0 && comunicados !== null && <span style={{ color: 'var(--v2-ink3)' }}> · sem registro de comunicação ainda</span>}
              {feitos.length > 0 && semComunicar > 0 && <span style={{ color: semComunicar >= 2 ? 'var(--v2-hot)' : 'var(--v2-ink3)', fontWeight: semComunicar >= 2 ? 700 : 400 }}> · {semComunicar} {semComunicar === 1 ? 'dia útil' : 'dias úteis'} sem comunicar</span>}
            </p>
          </div>
          <button onClick={onFechar} aria-label="Fechar" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-ink2)', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
        </div>

        {/* 1. A SEMANA */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 14 }}>
          {semana.map(d => {
            const n = doDia(feitos, d.data).length
            const prev = previstos.filter(p => p.data === d.data).length
            const sel = d.data === diaSel
            return (
              <button key={d.data} type="button" onClick={() => setDiaSel(d.data)}
                title={d.futuro ? `${prev} item(ns) previsto(s)` : `${n} comunicação(ões)`}
                style={{
                  padding: '8px 4px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                  border: sel ? '1.5px solid var(--v2-amber-on)' : '1px solid var(--v2-rule)',
                  background: sel ? 'var(--v2-amber-bg)' : 'var(--v2-surface)',
                  opacity: d.futuro ? 0.85 : 1,
                }}>
                <span style={{ display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: d.hoje ? 'var(--v2-ink)' : 'var(--v2-ink3)' }}>{d.diaCurto}</span>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--v2-ink2)' }}>{d.rotulo}</span>
                <span style={{ display: 'block', marginTop: 4, fontSize: 10.5, fontWeight: 700, color: n ? 'var(--v2-ok)' : d.futuro ? 'var(--v2-ink3)' : 'var(--v2-ink3)' }}>
                  {n ? `${n} enviada${n > 1 ? 's' : ''}` : d.futuro ? (prev ? `${prev} previsto${prev > 1 ? 's' : ''}` : '—') : d.hoje ? 'hoje' : 'nada'}
                </span>
              </button>
            )
          })}
        </div>

        {/* O DIA SELECIONADO */}
        <div style={{ background: 'var(--v2-surface1)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
          {(() => {
            const doDiaSel = doDia(feitos, diaSel)
            const prevDia = previstos.filter(p => p.data === diaSel)
            if (comunicados === null) return <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink3)' }}>Carregando…</p>
            return (<>
              {doDiaSel.length > 0 && (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {doDiaSel.map(c => (
                    <li key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <Chip tipo={c.tipo} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--v2-ink2)', lineHeight: 1.5 }}>{c.texto}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--v2-ink3)', whiteSpace: 'nowrap' }}>{(c.em || '').slice(11, 16)}{c.canal === 'whatsapp' ? ' · zap' : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
              {doDiaSel.length === 0 && prevDia.length === 0 && (
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--v2-ink3)' }}>{hojeSel ? 'Nada comunicado hoje ainda.' : 'Nada neste dia.'}</p>
              )}
              {prevDia.length > 0 && (
                <div style={{ marginTop: doDiaSel.length ? 10 : 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>Previsto</span>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                    {prevDia.map((p, i) => <li key={i} style={{ fontSize: 12.5, color: 'var(--v2-ink2)' }}>{p.texto}</li>)}
                  </ul>
                </div>
              )}
            </>)
          })()}
        </div>

        {/* 2. PARA COMUNICAR HOJE */}
        <div style={{ marginBottom: 18 }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>
            Para comunicar hoje {candidatos.length > 0 && `· ${candidatos.length}`}
          </span>
          {comunicados !== null && candidatos.length === 0 && (
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--v2-ink3)', lineHeight: 1.5 }}>
              Nada novo para comunicar hoje. Isso é uma resposta legítima: comunicar sem fato novo vira ruído.
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {candidatos.map(c => {
              const chave = c.assunto + c.estado
              const texto = textos[chave] ?? c.texto
              const busy = ocupado === chave
              return (
                <div key={chave} style={{ border: '1px solid var(--v2-rule)', borderRadius: 12, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <Chip tipo={c.tipo} />
                    <span style={{ fontSize: 12.5, color: 'var(--v2-ink)', fontWeight: 600 }}>{c.fato}</span>
                    {c.anteriores > 0 && (
                      <span title="Este assunto já foi comunicado antes; agora ele evoluiu" style={{ fontSize: 10.5, color: 'var(--v2-ink3)', whiteSpace: 'nowrap' }}>
                        {c.anteriores + 1}ª vez sobre este assunto
                      </span>
                    )}
                  </div>
                  <textarea value={texto} onChange={e => setTextos(t => ({ ...t, [chave]: e.target.value }))} rows={3}
                    style={{ width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: 'var(--v2-surface)', color: 'var(--v2-ink)' }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {telefone && (
                      <button type="button" disabled={busy} onClick={() => enviarWhats(c, texto)}
                        style={{ padding: '8px 14px', borderRadius: 9, border: 0, background: 'var(--v2-amber-on)', color: '#17150E', fontSize: 12.5, fontWeight: 800, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                        {busy ? 'Enviando…' : 'Enviar no WhatsApp'}
                      </button>
                    )}
                    <button type="button" disabled={busy} onClick={() => copiarERegistrar(c, texto)}
                      style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-ink)', fontSize: 12.5, fontWeight: 700, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                      Copiar e registrar
                    </button>
                    <button type="button" onClick={() => setEscondidos(e => [...e, chave])} title="Some por hoje; volta amanhã se ainda fizer sentido"
                      style={{ padding: '8px 10px', borderRadius: 9, border: 0, background: 'none', color: 'var(--v2-ink3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Agora não
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 3. ESCREVER ALGO */}
        <div style={{ borderTop: '1px solid var(--v2-rule)', paddingTop: 14 }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>Comunicar outra coisa</span>
          <div style={{ display: 'flex', gap: 8, margin: '8px 0', flexWrap: 'wrap' }}>
            {TIPOS.map(t => (
              <button key={t.key} type="button" onClick={() => setTipoLivre(t.key)} title={t.dica}
                style={{
                  padding: '5px 11px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700,
                  border: tipoLivre === t.key ? '1.5px solid var(--v2-amber-on)' : '1px solid var(--v2-rule)',
                  background: tipoLivre === t.key ? 'var(--v2-amber-bg)' : 'var(--v2-surface)', color: 'var(--v2-ink2)',
                }}>{t.label}</button>
            ))}
          </div>
          <textarea value={livre} onChange={e => setLivre(e.target.value)} rows={3} placeholder="O que aconteceu, por que importa e o que acontece agora."
            style={{ width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: 'var(--v2-surface)', color: 'var(--v2-ink)' }} />
          {vereditoLivre && !vereditoLivre.ok && (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--v2-hot)', lineHeight: 1.5 }}>
              {vereditoLivre.motivo} {vereditoLivre.dica && <span style={{ color: 'var(--v2-ink3)' }}>{vereditoLivre.dica}</span>}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {telefone && (
              <button type="button" disabled={ocupado === 'livre' || !vereditoLivre?.ok}
                onClick={async () => {
                  setOcupado('livre')
                  const r = await fetch('/api/crm/mensagens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telefone, texto: livre.trim() }) }).catch(() => null)
                  const d = r ? await r.json().catch(() => null) : null
                  if (!d?.ok) { setOcupado(''); toast(d?.error || 'Não foi possível enviar pelo WhatsApp.', 'erro'); return }
                  const ok = await registrar({ tipo: tipoLivre, texto: livre.trim(), assunto: `livre:${Date.now()}`, estado: 'unico', canal: 'whatsapp' })
                  setOcupado('')
                  if (ok) { setLivre(''); toast('Enviado no WhatsApp e registrado.', 'sucesso') }
                }}
                style={{ padding: '9px 16px', borderRadius: 9, border: 0, background: vereditoLivre?.ok ? 'var(--v2-amber-on)' : 'var(--v2-surface2)', color: vereditoLivre?.ok ? '#17150E' : 'var(--v2-ink3)', fontSize: 12.5, fontWeight: 800, cursor: vereditoLivre?.ok ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                Enviar no WhatsApp
              </button>
            )}
            <button type="button" disabled={ocupado === 'livre' || !vereditoLivre?.ok} onClick={registrarLivre}
              style={{ padding: '9px 16px', borderRadius: 9, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: vereditoLivre?.ok ? 'var(--v2-ink)' : 'var(--v2-ink3)', fontSize: 12.5, fontWeight: 700, cursor: vereditoLivre?.ok ? 'pointer' : 'default', fontFamily: 'inherit' }}>
              Só registrar
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
