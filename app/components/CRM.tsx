'use client'
import { useEffect, useRef, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'

type Estagio = { id: string; nome: string; ordem: number; ganho?: boolean; perdido?: boolean; pipelineId?: string }
type Empresa = { id: string; nome: string; segmento?: string; site?: string; instagram?: string; telefone?: string; observacoes?: string }
type Contato = { id: string; nome: string; telefone?: string; email?: string; empresa?: string; empresaId?: string; cargo?: string; areaAtuacao?: string; profissionalAutonomo?: boolean; observacoes?: string; tipo?: string; nascimento?: string; etiquetas?: string[]; ativo?: boolean }
type Atividade = { id: string; tipo: string; texto: string; autor: string; criadoEm: string }
type Negocio = {
  id: string; titulo: string; valor?: number; estagioId: string; pipelineId?: string; status: string
  dono?: string; donoNome?: string; contatoId?: string; origem?: string; previsaoFechamento?: string; proximoFollowUp?: string
  descricao?: string; atividades?: Atividade[]; criadoEm: string; atualizadoEm: string
  empresa?: string; segmento?: string; faturamentoEstimado?: string; instagram?: string; dores?: string; solucoes?: string
  clienteId?: string; handoff?: { escopoVendido?: string; expectativas?: string; detalhes?: string; observacoes?: string }
  empresaId?: string
  agendamentos?: { id: string; quando: string; canal: string; titulo: string; nota?: string; feito?: boolean }[]
}

const fmtR$ = (v?: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const TIPOS_ATIV: [string, string][] = [['nota', 'Nota'], ['ligacao', 'Ligação'], ['whatsapp', 'WhatsApp'], ['email', 'E-mail'], ['reuniao', 'Reunião']]

export default function CRM({ usuarios = [], onClienteCriado, podeEditar = false, podeExcluir = false, perfilClinica = false }: { usuarios?: any[]; onClienteCriado?: () => void; podeEditar?: boolean; podeExcluir?: boolean; perfilClinica?: boolean }) {
  const [estagios, setEstagios] = useState<Estagio[]>([])
  const [negocios, setNegocios] = useState<Negocio[]>([])
  const [contatos, setContatos] = useState<Contato[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [novoModal, setNovoModal] = useState(false)
  const [aberto, setAberto] = useState<Negocio | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const [vista, setVista] = useState<'painel' | 'funil' | 'contatos' | 'empresas' | 'mensagens' | 'playbook'>(() => (typeof window !== 'undefined' && (sessionStorage.getItem('crm_vista') as any)) || 'funil')
  useEffect(() => { try { sessionStorage.setItem('crm_vista', vista) } catch {} }, [vista])

  // Auto-scroll do funil ao arrastar um card para perto da borda (facilita chegar
  // em Ganho/Perdido). Só rola quando o card está perto da borda; no meio, não rola.
  const funilRef = useRef<HTMLDivElement>(null)
  const scrollTimer = useRef<any>(null)
  function autoScrollDrag(e: React.DragEvent) {
    e.preventDefault()
    const el = funilRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const EDGE = 90, VEL = 18
    const dir = e.clientX > rect.right - EDGE ? 1 : e.clientX < rect.left + EDGE ? -1 : 0
    if (scrollTimer.current) { clearInterval(scrollTimer.current); scrollTimer.current = null }
    if (dir !== 0) scrollTimer.current = setInterval(() => { el.scrollLeft += dir * VEL }, 16)
  }
  function pararAutoScroll() {
    if (scrollTimer.current) { clearInterval(scrollTimer.current); scrollTimer.current = null }
  }
  const [contatoModal, setContatoModal] = useState<Contato | null | 'novo'>(null)
  const [empresaModal, setEmpresaModal] = useState<Empresa | null | 'novo'>(null)
  const [bulkModal, setBulkModal] = useState(false)
  // Pipelines (múltiplos funis)
  const [pipelines, setPipelines] = useState<{ id: string; nome: string; ordem: number }[]>([])
  const [pipelineSel, setPipelineSel] = useState('')
  const [pipelinesModal, setPipelinesModal] = useState(false)
  const [etapasModal, setEtapasModal] = useState(false)

  function csvEscape(v: any) { const s = String(v ?? ''); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  function exportarCSV() {
    const linhas = [['Nome', 'Telefone', 'Email', 'Empresa', 'Cargo', 'Observações'].join(';')]
    contatos.forEach((c: any) => linhas.push([c.nome, c.telefone, c.email, c.empresa, c.cargo, c.observacoes].map(csvEscape).join(';')))
    const blob = new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `contatos-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url)
  }
  async function importarCSV(file: File) {
    const txt = await file.text()
    const linhas = txt.replace(/\r/g, '').split('\n').filter(l => l.trim())
    if (!linhas.length) return
    const sep = (linhas[0].match(/;/g) || []).length >= (linhas[0].match(/,/g) || []).length ? ';' : ','
    let inicio = 0
    if (/nome/i.test(linhas[0]) && /(email|telefone|empresa)/i.test(linhas[0])) inicio = 1 // pula cabeçalho
    const lote = linhas.slice(inicio).map(l => {
      const cols = l.split(sep).map(s => s.trim().replace(/^"|"$/g, ''))
      return { nome: cols[0] || '', telefone: cols[1] || '', email: cols[2] || '', empresa: cols[3] || '', cargo: cols[4] || '' }
    }).filter(c => c.nome)
    if (!lote.length) { toast('Nenhum contato válido encontrado no arquivo.', 'erro'); return }
    const r = await fetch('/api/crm/contatos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lote }) }).then(x => x.json()).catch(() => null)
    if (r?.ok) { toast(`${r.criados} contato(s) importado(s).`, 'sucesso'); carregar() }
    else toast('Falha ao importar.', 'erro')
  }

  function carregar() {
    Promise.all([
      fetch('/api/crm/estagios').then(r => r.json()),
      fetch('/api/crm/negocios').then(r => r.json()),
      fetch('/api/crm/contatos').then(r => r.json()),
      fetch('/api/crm/empresas').then(r => r.json()),
      fetch('/api/crm/pipelines').then(r => r.json()),
    ]).then(([e, n, c, emp, pl]) => {
      setEstagios(Array.isArray(e) ? e : [])
      setNegocios(Array.isArray(n) ? n : [])
      setContatos(Array.isArray(c) ? c : [])
      setEmpresas(Array.isArray(emp) ? emp : [])
      const pls = Array.isArray(pl) ? pl : []
      setPipelines(pls)
      setPipelineSel(prev => (prev && pls.some((p: any) => p.id === prev)) ? prev : (pls[0]?.id || ''))
      setCarregando(false)
    }).catch(() => setCarregando(false))
  }
  useEffect(() => { carregar() }, [])

  async function moverEstagio(neg: Negocio, estagioId: string) {
    if (neg.estagioId === estagioId) return
    setNegocios(ns => ns.map(n => n.id === neg.id ? { ...n, estagioId } : n))
    await fetch('/api/crm/negocios', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: neg.id, estagioId }) }).catch(() => {})
    carregar()
  }

  const contatoDe = (id?: string) => contatos.find(c => c.id === id)
  const totalPorEstagio = (eid: string) => negocios.filter(n => n.estagioId === eid).reduce((s, n) => s + (Number(n.valor) || 0), 0)
  // Filtros por pipeline (negócio/etapa sem pipelineId caem no pipeline padrão = o primeiro)
  const padraoId = pipelines[0]?.id || ''
  const estagiosDoPipeline = (pid: string) => estagios.filter(e => (e.pipelineId || padraoId) === pid)
  const negociosDoPipeline = (pid: string) => negocios.filter(n => (n.pipelineId || padraoId) === pid)
  // Origens conhecidas (dropdown editável): padrões + as já usadas nos negócios
  const origensConhecidas = Array.from(new Set(['Indicação', 'Instagram', 'Ex-paciente', 'Tráfego pago', 'Tráfego orgânico', 'Prospecção ativa', 'Site', 'Google', 'Evento', ...negocios.map(n => (n.origem || '').trim()).filter(Boolean)])).sort((a, b) => a.localeCompare(b, 'pt'))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>CRM</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#999' }}>{vista === 'funil' ? 'Arraste os negócios entre as etapas. Clique para ver detalhes e a timeline.' : vista === 'contatos' ? 'Contatos de prospects e clientes.' : 'Roteiro de qualificação e cadência de mensagens para SDR/closer.'}</p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: '#f0f0f0', borderRadius: 10, padding: 3 }}>
          {([['painel', 'Painel'], ['funil', 'Funil'], ['contatos', perfilClinica ? 'Pacientes' : 'Contatos'], ['empresas', 'Empresas'], ['mensagens', 'Mensagens'], ['playbook', 'Playbook']] as ['painel' | 'funil' | 'contatos' | 'empresas' | 'mensagens' | 'playbook', string][]).map(([v, l]) => (
            <button key={v} onClick={() => setVista(v)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12.5, background: vista === v ? '#fff' : 'transparent', color: vista === v ? '#111' : '#888', boxShadow: vista === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{l}</button>
          ))}
        </div>
        {vista === 'funil' && podeEditar && (
          <button onClick={() => setNovoModal(true)} style={{ marginLeft: 'auto', padding: '10px 18px', background: 'var(--marca, #ffc00f)', color: 'var(--marca-texto, #111)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Novo negócio</button>
        )}
        {vista === 'contatos' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={exportarCSV} style={{ padding: '9px 14px', background: '#f5f5f5', color: '#444', border: '1px solid #e0e0e0', borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Exportar CSV</button>
            <label style={{ padding: '9px 14px', background: '#f5f5f5', color: '#444', border: '1px solid #e0e0e0', borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
              Importar CSV
              <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) importarCSV(e.target.files[0]); e.target.value = '' }} />
            </label>
            {podeEditar && <button onClick={() => setBulkModal(true)} style={{ padding: '9px 14px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Adicionar vários</button>}
            {podeEditar && <button onClick={() => setContatoModal('novo')} style={{ padding: '9px 16px', background: 'var(--marca, #ffc00f)', color: 'var(--marca-texto, #111)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Novo</button>}
          </div>
        )}
        {vista === 'empresas' && podeEditar && (
          <button onClick={() => setEmpresaModal('novo')} style={{ marginLeft: 'auto', padding: '10px 18px', background: 'var(--marca, #ffc00f)', color: 'var(--marca-texto, #111)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Nova empresa</button>
        )}
      </div>

      {/* Seletor de pipeline (funil e painel) */}
      {(vista === 'funil' || vista === 'painel') && pipelines.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pipeline</span>
          <div style={{ display: 'flex', gap: 4, background: '#f0f0f0', borderRadius: 9, padding: 3, flexWrap: 'wrap' }}>
            {pipelines.map(p => (
              <button key={p.id} onClick={() => setPipelineSel(p.id)} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: pipelineSel === p.id ? '#111' : 'transparent', color: pipelineSel === p.id ? '#fff' : '#666' }}>{p.nome}</button>
            ))}
          </div>
          {podeEditar && <button onClick={() => setEtapasModal(true)} style={{ padding: '6px 12px', background: '#fff', color: '#444', border: '1px solid #e0e0e0', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Editar etapas</button>}
          {podeEditar && <button onClick={() => setPipelinesModal(true)} style={{ padding: '6px 12px', background: '#fff', color: '#444', border: '1px solid #e0e0e0', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Gerenciar pipelines</button>}
        </div>
      )}

      {carregando ? <p style={{ color: '#aaa' }}>Carregando...</p> : vista === 'painel' ? (
        <PainelVendas negocios={negociosDoPipeline(pipelineSel)} estagios={estagiosDoPipeline(pipelineSel)} usuarios={usuarios} />
      ) : vista === 'contatos' ? (
        <ContatosLista contatos={contatos} negocios={negocios} onAbrir={c => setContatoModal(c)} podeExcluir={podeExcluir} onRecarregar={carregar} />
      ) : vista === 'empresas' ? (
        <EmpresasLista empresas={empresas} contatos={contatos} negocios={negocios} onAbrir={e => setEmpresaModal(e)} />
      ) : vista === 'mensagens' ? (
        <MensagensInbox contatos={contatos} />
      ) : vista === 'playbook' ? (
        <PlaybookVendas podeEditar={podeEditar} />
      ) : (
        <div ref={funilRef} className="crm-kanban" onDragOver={autoScrollDrag} onDrop={pararAutoScroll} onDragEnd={pararAutoScroll}
          style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12, alignItems: 'stretch', minHeight: 'calc(100vh - 220px)' }}>
          {estagiosDoPipeline(pipelineSel).map(est => {
            const cards = negocios.filter(n => n.estagioId === est.id)
            const cor = est.ganho ? '#16a34a' : est.perdido ? '#b91c1c' : '#111'
            return (
              <div key={est.id}
                onDragOver={e => { e.preventDefault(); setOverCol(est.id) }}
                onDrop={() => { const n = negocios.find(x => x.id === dragId); if (n) moverEstagio(n, est.id); setDragId(null); setOverCol(null); pararAutoScroll() }}
                style={{ flex: '0 0 270px', width: 270, background: overCol === est.id ? '#fff8e1' : '#f6f6f6', borderRadius: 12, padding: 10, minHeight: 120, border: overCol === est.id ? '1.5px dashed #ffc00f' : '1.5px solid transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 10px' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: cor }}>{est.nome}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#999' }}>{cards.length}</span>
                </div>
                {cards.length > 0 && <p style={{ margin: '0 6px 8px', fontSize: 11, color: '#999' }}>{fmtR$(totalPorEstagio(est.id))}</p>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {cards.map(n => {
                    const ct = contatoDe(n.contatoId)
                    return (
                      <div key={n.id} draggable onDragStart={() => setDragId(n.id)} onDragEnd={() => { setDragId(null); setOverCol(null); pararAutoScroll() }}
                        onClick={() => setAberto(n)}
                        style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer', border: '1px solid #eee' }}>
                        <p style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 700, color: '#111' }}>{n.titulo}</p>
                        {!!n.valor && <p style={{ margin: '0 0 4px', fontSize: 12.5, fontWeight: 700, color: '#16a34a' }}>{fmtR$(n.valor)}</p>}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <span style={{ fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ct?.nome || 'Sem contato'}</span>
                          {n.donoNome && <span style={{ fontSize: 10, color: '#aaa', flexShrink: 0 }}>{n.donoNome.split(' ')[0]}</span>}
                        </div>
                        {n.proximoFollowUp && (() => { const atrasado = new Date(new Date(n.proximoFollowUp).setHours(23, 59, 59, 999)).getTime() < Date.now(); return (
                          <span style={{ display: 'inline-block', marginTop: 6, fontSize: 10, fontWeight: 700, color: atrasado ? '#b91c1c' : '#888', background: atrasado ? '#fee2e2' : '#f0f0f0', borderRadius: 999, padding: '2px 8px' }}>
                            {atrasado ? 'Follow-up atrasado' : 'Follow-up'} · {new Date(n.proximoFollowUp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </span>
                        ) })()}
                        {(() => {
                          const prox = [...(n.agendamentos || [])].filter(a => !a.feito).sort((a, b) => a.quando.localeCompare(b.quando))[0]
                          if (!prox) return null
                          const atrasado = new Date(prox.quando + 'T23:59:59').getTime() < Date.now()
                          return (
                            <span style={{ display: 'inline-block', marginTop: 6, marginLeft: 6, fontSize: 10, fontWeight: 700, color: atrasado ? '#b91c1c' : '#1d4ed8', background: atrasado ? '#fee2e2' : '#eff6ff', borderRadius: 999, padding: '2px 8px' }}>
                              {prox.canal} · {new Date(prox.quando + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                            </span>
                          )
                        })()}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {novoModal && <NovoNegocioModal estagios={estagiosDoPipeline(pipelineSel)} pipelineId={pipelineSel} usuarios={usuarios} contatos={contatos} origens={origensConhecidas} onClose={() => setNovoModal(false)} onSalvo={() => { setNovoModal(false); carregar() }} />}
      {aberto && <NegocioModal negocio={aberto} estagios={estagios} pipelines={pipelines} padraoId={padraoId} contato={contatoDe(aberto.contatoId)} usuarios={usuarios} podeExcluir={podeExcluir} onClose={() => setAberto(null)} onMudou={() => carregar()} onFechar={() => { setAberto(null); carregar() }} onClienteCriado={onClienteCriado} />}
      {contatoModal && <ContatoModal contato={contatoModal === 'novo' ? null : contatoModal} podeExcluir={podeExcluir} perfilClinica={perfilClinica} onClose={() => setContatoModal(null)} onSalvo={() => { setContatoModal(null); carregar() }} />}
      {bulkModal && <BulkContatosModal onClose={() => setBulkModal(false)} onSalvo={() => { setBulkModal(false); carregar() }} />}
      {empresaModal && <EmpresaModal empresa={empresaModal === 'novo' ? null : empresaModal} contatos={contatos} negocios={negocios} podeExcluir={podeExcluir} onClose={() => setEmpresaModal(null)} onSalvo={() => { setEmpresaModal(null); carregar() }} />}
      {pipelinesModal && <PipelinesModal pipelines={pipelines} podeExcluir={podeExcluir} onClose={() => setPipelinesModal(false)} onMudou={carregar} />}
      {etapasModal && <EtapasModal pipelineId={pipelineSel} pipelineNome={pipelines.find(p => p.id === pipelineSel)?.nome || ''} estagios={estagiosDoPipeline(pipelineSel)} onClose={() => setEtapasModal(false)} onMudou={carregar} />}
    </div>
  )
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }

function PainelVendas({ negocios, estagios, usuarios }: { negocios: Negocio[]; estagios: Estagio[]; usuarios: any[] }) {
  const agora = new Date(), m = agora.getMonth(), y = agora.getFullYear()
  const noMes = (iso?: string) => { if (!iso) return false; const d = new Date(iso); return d.getMonth() === m && d.getFullYear() === y }
  const abertos = negocios.filter(n => n.status === 'aberto')
  const ganhos = negocios.filter(n => n.status === 'ganho')
  const perdidos = negocios.filter(n => n.status === 'perdido')
  const ganhosMes = ganhos.filter(n => noMes(n.atualizadoEm))
  const perdidosMes = perdidos.filter(n => noMes(n.atualizadoEm))
  const valorAberto = abertos.reduce((s, n) => s + (Number(n.valor) || 0), 0)
  const valorGanhoMes = ganhosMes.reduce((s, n) => s + (Number(n.valor) || 0), 0)
  const fechados = ganhosMes.length + perdidosMes.length
  const winRate = fechados > 0 ? Math.round((ganhosMes.length / fechados) * 100) : 0
  const ticket = ganhos.length > 0 ? ganhos.reduce((s, n) => s + (Number(n.valor) || 0), 0) / ganhos.length : 0
  const colsAbertas = estagios.filter(e => !e.ganho && !e.perdido)
  const porVendedor = Object.values(abertos.reduce((acc: any, n) => {
    const k = n.donoNome || '—'; acc[k] = acc[k] || { nome: k, qtd: 0, valor: 0 }; acc[k].qtd++; acc[k].valor += Number(n.valor) || 0; return acc
  }, {})).sort((a: any, b: any) => b.valor - a.valor)
  // De onde vêm os negócios (todas as situações — mede o canal, não o resultado)
  const porOrigem = (Object.values(negocios.reduce((acc: any, n) => {
    const k = (n.origem || '').trim(); if (!k) return acc
    acc[k] = acc[k] || { nome: k, qtd: 0 }; acc[k].qtd++; return acc
  }, {})) as { nome: string; qtd: number }[]).sort((a, b) => b.qtd - a.qtd).slice(0, 8)

  const Card = ({ titulo, valor, sub, cor }: { titulo: string; valor: string; sub?: string; cor?: string }) => (
    <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <p style={{ margin: 0, fontSize: 12, color: '#999', fontWeight: 600 }}>{titulo}</p>
      <p style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 800, color: cor || '#111' }}>{valor}</p>
      {sub && <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#aaa' }}>{sub}</p>}
    </div>
  )

  return (
    <div style={{ maxWidth: 920 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
        <Card titulo="Em aberto" valor={fmtR$(valorAberto)} sub={`${abertos.length} negócio(s)`} />
        <Card titulo="Ganho no mês" valor={fmtR$(valorGanhoMes)} sub={`${ganhosMes.length} venda(s)`} cor="#16a34a" />
        <Card titulo="Win rate (mês)" valor={`${winRate}%`} sub={`${ganhosMes.length} ganho / ${perdidosMes.length} perdido`} />
        <Card titulo="Ticket médio" valor={fmtR$(ticket)} sub="negócios ganhos" />
      </div>

      <span style={{ fontSize: 13, fontWeight: 800, color: '#111', display: 'block', marginBottom: 10 }}>Funil (em aberto por etapa)</span>
      <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 18 }}>
        {colsAbertas.map(e => {
          const ns = abertos.filter(n => n.estagioId === e.id)
          const val = ns.reduce((s, n) => s + (Number(n.valor) || 0), 0)
          const maxQtd = Math.max(1, ...colsAbertas.map(c => abertos.filter(n => n.estagioId === c.id).length))
          return (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{ width: 120, fontSize: 12.5, fontWeight: 700, color: '#444', flexShrink: 0 }}>{e.nome}</span>
              <div style={{ flex: 1, height: 22, background: '#f4f4f4', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ width: `${(ns.length / maxQtd) * 100}%`, height: '100%', background: '#ffc00f', minWidth: ns.length ? 6 : 0 }} />
              </div>
              <span style={{ width: 130, textAlign: 'right', fontSize: 12, color: '#888', flexShrink: 0 }}>{ns.length} · {fmtR$(val)}</span>
            </div>
          )
        })}
      </div>

      <span style={{ fontSize: 13, fontWeight: 800, color: '#111', display: 'block', marginBottom: 10 }}>Origem dos negócios</span>
      <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 18 }}>
        {porOrigem.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: '#aaa' }}>Nenhum negócio com origem preenchida ainda.</p> : porOrigem.map(o => (
          <div key={o.nome} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ width: 120, fontSize: 12.5, fontWeight: 700, color: '#444', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.nome}</span>
            <div style={{ flex: 1, height: 18, background: '#f4f4f4', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: `${(o.qtd / porOrigem[0].qtd) * 100}%`, height: '100%', background: '#111', minWidth: 6, borderRadius: 6 }} />
            </div>
            <span style={{ width: 40, textAlign: 'right', fontSize: 12.5, fontWeight: 800, color: '#111', flexShrink: 0 }}>{o.qtd}</span>
          </div>
        ))}
      </div>

      <span style={{ fontSize: 13, fontWeight: 800, color: '#111', display: 'block', marginBottom: 10 }}>Pipeline por vendedor</span>
      <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        {porVendedor.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: '#aaa' }}>Sem negócios em aberto.</p> : porVendedor.map((v: any) => (
          <div key={v.nome} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
            <span style={{ fontSize: 13, color: '#333' }}>{v.nome}</span>
            <span style={{ fontSize: 12.5, color: '#888' }}>{v.qtd} negócio(s) · <b style={{ color: '#111' }}>{fmtR$(v.valor)}</b></span>
          </div>
        ))}
      </div>
    </div>
  )
}

const CANAL: Record<string, { label: string; cor: string }> = {
  whatsapp: { label: 'WhatsApp', cor: '#16a34a' }, ligacao: { label: 'Ligação', cor: '#1d4ed8' }, email: { label: 'E-mail', cor: '#7c3aed' },
}
type Passo = { id: string; dia: number; canal: string; titulo: string; script: string }

function PlaybookVendas({ podeEditar }: { podeEditar: boolean }) {
  const [roteiro, setRoteiro] = useState('')
  const [cadencia, setCadencia] = useState<Passo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)

  function carregar() {
    return fetch('/api/crm/playbook').then(r => r.json()).then(d => { if (d && !d.error) { setRoteiro(d.roteiro || ''); setCadencia(Array.isArray(d.cadencia) ? d.cadencia : []) } setCarregando(false) }).catch(() => setCarregando(false))
  }
  useEffect(() => { carregar() }, [])

  function copiar(p: Passo) { navigator.clipboard?.writeText(p.script).then(() => { setCopiado(p.id); setTimeout(() => setCopiado(null), 1500) }).catch(() => {}) }
  async function salvar() {
    setSalvando(true)
    const r = await fetch('/api/crm/playbook', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roteiro, cadencia }) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (r?.ok) { setCadencia(r.playbook.cadencia); setEditando(false) }
  }

  if (carregando) return <p style={{ color: '#aaa' }}>Carregando...</p>

  return (
    <div style={{ maxWidth: 820 }}>
      {podeEditar && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
          {editando ? (
            <>
              <button onClick={() => setCadencia(c => [...c, { id: Math.random().toString(36).slice(2), dia: (c[c.length - 1]?.dia || 0) + 2, canal: 'whatsapp', titulo: '', script: '' }])} style={{ padding: '8px 14px', background: '#f5f5f5', color: '#444', border: '1px solid #e0e0e0', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ Passo</button>
              <button onClick={salvar} disabled={salvando} style={{ padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>{salvando ? 'Salvando...' : 'Salvar'}</button>
              <button onClick={() => { carregar(); setEditando(false) }} style={{ padding: '8px 16px', background: '#fff', color: '#666', border: '1px solid #e0e0e0', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
            </>
          ) : (
            <button onClick={() => setEditando(true)} style={{ padding: '8px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Editar playbook</button>
          )}
        </div>
      )}

      {/* Roteiro de qualificação */}
      <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#111', display: 'block', marginBottom: 10 }}>Roteiro de qualificação</span>
        {editando
          ? <textarea value={roteiro} onChange={e => setRoteiro(e.target.value)} style={{ ...inputStyle, minHeight: 140, resize: 'vertical', lineHeight: 1.6 }} />
          : <p style={{ margin: 0, fontSize: 13.5, color: '#333', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{roteiro || '—'}</p>}
      </div>

      {/* Cadência */}
      <span style={{ fontSize: 13, fontWeight: 800, color: '#111', display: 'block', marginBottom: 10 }}>Cadência de contato</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cadencia.map((p, i) => {
          const c = CANAL[p.canal] || CANAL.whatsapp
          return (
            <div key={p.id} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #eee' }}>
              {editando ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ fontSize: 11, color: '#888' }}>Dia<input type="number" value={p.dia} onChange={e => setCadencia(arr => arr.map((x, j) => j === i ? { ...x, dia: Number(e.target.value) } : x))} style={{ width: 56, marginLeft: 6, padding: '6px 8px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 12 }} /></label>
                    <select value={p.canal} onChange={e => setCadencia(arr => arr.map((x, j) => j === i ? { ...x, canal: e.target.value } : x))} style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 12, background: '#fff' }}>
                      {Object.entries(CANAL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <input value={p.titulo} onChange={e => setCadencia(arr => arr.map((x, j) => j === i ? { ...x, titulo: e.target.value } : x))} placeholder="Título do passo" style={{ flex: 1, minWidth: 140, padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 12.5, fontWeight: 700 }} />
                    <button onClick={() => setCadencia(arr => arr.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 18 }}>×</button>
                  </div>
                  <textarea value={p.script} onChange={e => setCadencia(arr => arr.map((x, j) => j === i ? { ...x, script: e.target.value } : x))} placeholder="Script / mensagem..." style={{ ...inputStyle, minHeight: 64, resize: 'vertical', fontSize: 12.5 }} />
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: '#111', borderRadius: 999, padding: '3px 10px' }}>D{p.dia}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: c.cor, background: `${c.cor}18`, borderRadius: 999, padding: '3px 10px' }}>{c.label}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: '#111' }}>{p.titulo}</span>
                    <button onClick={() => copiar(p)} style={{ marginLeft: 'auto', padding: '6px 12px', background: copiado === p.id ? '#16a34a' : '#f5f5f5', color: copiado === p.id ? '#fff' : '#444', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}>{copiado === p.id ? 'Copiado!' : 'Copiar script'}</button>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: '#444', whiteSpace: 'pre-wrap', lineHeight: 1.6, background: '#fafafa', borderRadius: 8, padding: '10px 12px' }}>{p.script}</p>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BulkContatosModal({ onClose, onSalvo }: { onClose: () => void; onSalvo: () => void }) {
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const linhas = texto.split('\n').filter(l => l.trim())
  async function salvar() {
    const lote = linhas.map(l => {
      const sep = (l.match(/;/g) || []).length >= (l.match(/,/g) || []).length ? ';' : ','
      const c = l.split(sep).map(s => s.trim())
      return { nome: c[0] || '', telefone: c[1] || '', email: c[2] || '', empresa: c[3] || '' }
    }).filter(c => c.nome)
    if (!lote.length) return
    setSalvando(true)
    const r = await fetch('/api/crm/contatos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lote }) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (r?.ok) { toast(`${r.criados} contato(s) adicionado(s).`, 'sucesso'); onSalvo() } else toast('Falha ao adicionar.', 'erro')
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 16, color: '#111' }}>Adicionar vários contatos</h3>
        <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#999' }}>Um contato por linha, separando por <b>;</b> (ou vírgula): <code style={{ background: '#f5f5f5', padding: '1px 5px', borderRadius: 4 }}>Nome ; Telefone ; Email ; Empresa</code></p>
        <textarea value={texto} onChange={e => setTexto(e.target.value)} autoFocus placeholder={'João Silva ; +5511999990000 ; joao@empresa.com ; Clínica X\nMaria Souza ; +5511988887777 ; maria@loja.com ; Loja Y'}
          style={{ width: '100%', minHeight: 200, padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
          <button onClick={salvar} disabled={salvando || linhas.length === 0} style={{ flex: 1, padding: '11px 0', background: linhas.length ? '#ffc00f' : '#f0f0f0', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: linhas.length ? 'pointer' : 'not-allowed' }}>{salvando ? 'Adicionando...' : `Adicionar ${linhas.length || ''} contato(s)`}</button>
          <button onClick={onClose} style={{ padding: '11px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// Vincula contato/negócio a uma empresa por empresaId OU pelo nome (texto) batendo
function ligadosEmpresa(emp: Empresa, contatos: Contato[], negocios: Negocio[]) {
  const nome = (emp.nome || '').toLowerCase()
  const cts = contatos.filter(c => c.empresaId === emp.id || (c.empresa && c.empresa.toLowerCase() === nome))
  const negs = negocios.filter(n => n.empresaId === emp.id || ((n as any).empresa && (n as any).empresa.toLowerCase() === nome))
  return { cts, negs }
}

function EmpresasLista({ empresas, contatos, negocios, onAbrir }: { empresas: Empresa[]; contatos: Contato[]; negocios: Negocio[]; onAbrir: (e: Empresa) => void }) {
  if (empresas.length === 0) return <div style={{ background: '#fff', borderRadius: 14, padding: '50px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}><p style={{ margin: 0, fontSize: 14, color: '#888' }}>Nenhuma empresa ainda.</p></div>
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
      {empresas.map(e => {
        const { cts, negs } = ligadosEmpresa(e, contatos, negocios)
        const aberto = negs.filter(n => n.status === 'aberto').reduce((s, n) => s + (Number(n.valor) || 0), 0)
        return (
          <div key={e.id} onClick={() => onAbrir(e)} style={{ background: '#fff', borderRadius: 12, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #eee', cursor: 'pointer' }}>
            <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#111' }}>{e.nome}</p>
            {e.segmento && <p style={{ margin: '0 0 8px', fontSize: 12, color: '#888' }}>{e.segmento}</p>}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#555', background: '#f0f0f0', borderRadius: 999, padding: '2px 8px' }}>{cts.length} contato(s)</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', borderRadius: 999, padding: '2px 8px' }}>{negs.length} negócio(s)</span>
              {aberto > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', borderRadius: 999, padding: '2px 8px' }}>{fmtR$(aberto)} em aberto</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EmpresaModal({ empresa, contatos, negocios, onClose, onSalvo, podeExcluir = false }: { empresa: Empresa | null; contatos: Contato[]; negocios: Negocio[]; onClose: () => void; onSalvo: () => void; podeExcluir?: boolean }) {
  const [f, setF] = useState<any>({ nome: empresa?.nome || '', segmento: empresa?.segmento || '', site: empresa?.site || '', instagram: empresa?.instagram || '', telefone: empresa?.telefone || '', observacoes: empresa?.observacoes || '' })
  const [salvando, setSalvando] = useState(false)
  const lig = empresa ? ligadosEmpresa(empresa, contatos, negocios) : { cts: [], negs: [] }
  async function salvar() {
    if (!f.nome.trim()) return
    setSalvando(true)
    if (empresa?.id) await fetch('/api/crm/empresas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: empresa.id, ...f }) }).catch(() => {})
    else await fetch('/api/crm/empresas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) }).catch(() => {})
    setSalvando(false); onSalvo()
  }
  async function excluir() {
    if (!empresa?.id || !(await confirmar('Excluir esta empresa? Os contatos e negócios não são apagados.', { titulo: 'Excluir empresa', okLabel: 'Excluir', perigo: true }))) return
    await fetch(`/api/crm/empresas?id=${empresa.id}`, { method: 'DELETE' }).catch(() => {})
    onSalvo()
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#111' }}>{empresa ? 'Editar empresa' : 'Nova empresa'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label style={labelStyle}>Nome *</label><input value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} style={inputStyle} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={labelStyle}>Segmento</label><input value={f.segmento} onChange={e => setF({ ...f, segmento: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Telefone</label><input value={f.telefone} onChange={e => setF({ ...f, telefone: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Site</label><input value={f.site} onChange={e => setF({ ...f, site: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Instagram</label><input value={f.instagram} onChange={e => setF({ ...f, instagram: e.target.value })} style={inputStyle} /></div>
          </div>
          <div><label style={labelStyle}>Observações</label><textarea value={f.observacoes} onChange={e => setF({ ...f, observacoes: e.target.value })} style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} /></div>
        </div>
        {empresa && (lig.cts.length > 0 || lig.negs.length > 0) && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
            {lig.cts.length > 0 && <p style={{ margin: '0 0 6px', fontSize: 12, color: '#888' }}><b>Contatos:</b> {lig.cts.map(c => c.nome).join(', ')}</p>}
            {lig.negs.length > 0 && <p style={{ margin: 0, fontSize: 12, color: '#888' }}><b>Negócios:</b> {lig.negs.map(n => n.titulo).join(', ')}</p>}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={salvar} disabled={salvando || !f.nome.trim()} style={{ flex: 1, padding: '11px 0', background: f.nome.trim() ? '#ffc00f' : '#f0f0f0', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: f.nome.trim() ? 'pointer' : 'not-allowed' }}>{salvando ? 'Salvando...' : empresa ? 'Salvar' : 'Criar empresa'}</button>
          {empresa && podeExcluir && <button onClick={excluir} style={{ padding: '11px 16px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Excluir</button>}
          <button onClick={onClose} style={{ padding: '11px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function ContatosLista({ contatos, negocios, onAbrir, podeExcluir = false, onRecarregar }: { contatos: Contato[]; negocios: Negocio[]; onAbrir: (c: Contato) => void; podeExcluir?: boolean; onRecarregar: () => void }) {
  const [vista, setVista] = useState<'lista' | 'cards'>('lista')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [excluindo, setExcluindo] = useState(false)

  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const todos = contatos.length > 0 && sel.size === contatos.length
  const toggleTodos = () => setSel(todos ? new Set() : new Set(contatos.map(c => c.id)))
  const empresaLabel = (c: Contato) => c.profissionalAutonomo ? 'Autônomo' : (c.empresa || '—')

  async function excluirSelecionados() {
    if (sel.size === 0) return
    if (!(await confirmar(`Excluir ${sel.size} contato(s) selecionado(s)? Esta ação não pode ser desfeita.`, { titulo: 'Excluir contatos', okLabel: `Excluir ${sel.size}`, perigo: true }))) return
    setExcluindo(true)
    const r = await fetch(`/api/crm/contatos?ids=${Array.from(sel).join(',')}`, { method: 'DELETE' }).then(x => x.json()).catch(() => null)
    setExcluindo(false)
    if (r?.ok) { toast(`${r.excluidos} contato(s) excluído(s).`, 'sucesso'); setSel(new Set()); onRecarregar() }
    else toast('Falha ao excluir.', 'erro')
  }

  if (contatos.length === 0) return <div style={{ background: '#fff', borderRadius: 14, padding: '50px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}><p style={{ margin: 0, fontSize: 14, color: '#888' }}>Nenhum contato ainda.</p></div>

  const barraSel = sel.size > 0 && (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: '#111', color: '#fff', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 700 }}>{sel.size} selecionado(s)</span>
      {podeExcluir && <button onClick={excluirSelecionados} disabled={excluindo} style={{ padding: '7px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: excluindo ? 'default' : 'pointer' }}>{excluindo ? 'Excluindo...' : 'Excluir selecionados'}</button>}
      <button onClick={() => setSel(new Set())} style={{ padding: '7px 12px', background: 'transparent', color: '#ddd', border: '1px solid #555', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Limpar seleção</button>
    </div>
  )

  const toggleVista = (
    <div style={{ display: 'flex', gap: 4, background: '#f0f0f0', borderRadius: 9, padding: 3, marginBottom: 12, width: 'fit-content' }}>
      {([['lista', 'Lista'], ['cards', 'Cards']] as const).map(([v, l]) => (
        <button key={v} onClick={() => setVista(v)} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: vista === v ? '#fff' : 'transparent', color: vista === v ? '#111' : '#888', boxShadow: vista === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{l}</button>
      ))}
    </div>
  )

  if (vista === 'cards') {
    return (
      <div>
        {toggleVista}
        {barraSel}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {contatos.map(c => {
            const nNeg = negocios.filter(n => n.contatoId === c.id).length
            const marcado = sel.has(c.id)
            return (
              <div key={c.id} style={{ position: 'relative', background: '#fff', borderRadius: 12, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: `1px solid ${marcado ? '#111' : '#eee'}`, cursor: 'pointer' }} onClick={() => onAbrir(c)}>
                <input type="checkbox" checked={marcado} onClick={e => e.stopPropagation()} onChange={() => toggle(c.id)} style={{ position: 'absolute', top: 12, right: 12, width: 16, height: 16, cursor: 'pointer' }} />
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#111', paddingRight: 22 }}>{c.nome}</p>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: '#888' }}>{empresaLabel(c)}</p>
                {c.areaAtuacao && <p style={{ margin: '0 0 4px', fontSize: 11.5, color: '#7c3aed', fontWeight: 600 }}>{c.areaAtuacao}</p>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {c.telefone && <span style={{ fontSize: 12, color: '#555' }}>{c.telefone}</span>}
                  {c.email && <span style={{ fontSize: 12, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</span>}
                </div>
                {nNeg > 0 && <span style={{ display: 'inline-block', marginTop: 8, fontSize: 10.5, fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', borderRadius: 999, padding: '2px 8px' }}>{nNeg} negócio(s)</span>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Vista LISTA (tabela) com seleção
  const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.03em', padding: '10px 12px', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { fontSize: 13, color: '#333', padding: '10px 12px', borderTop: '1px solid #f2f2f2' }
  return (
    <div>
      {toggleVista}
      {barraSel}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #eee', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 40 }}><input type="checkbox" checked={todos} onChange={toggleTodos} style={{ width: 16, height: 16, cursor: 'pointer' }} title="Selecionar todos" /></th>
              <th style={th}>Nome</th>
              <th style={th}>Empresa</th>
              <th style={th}>Área de atuação</th>
              <th style={th}>Telefone</th>
              <th style={th}>E-mail</th>
              <th style={{ ...th, textAlign: 'center' }}>Neg.</th>
            </tr>
          </thead>
          <tbody>
            {contatos.map(c => {
              const nNeg = negocios.filter(n => n.contatoId === c.id).length
              const marcado = sel.has(c.id)
              return (
                <tr key={c.id} style={{ background: marcado ? '#fffbeb' : '#fff', cursor: 'pointer' }} onClick={() => onAbrir(c)}>
                  <td style={td} onClick={e => e.stopPropagation()}><input type="checkbox" checked={marcado} onChange={() => toggle(c.id)} style={{ width: 16, height: 16, cursor: 'pointer' }} /></td>
                  <td style={{ ...td, fontWeight: 700, color: '#111' }}>{c.nome}</td>
                  <td style={td}>{empresaLabel(c)}</td>
                  <td style={{ ...td, color: c.areaAtuacao ? '#7c3aed' : '#bbb' }}>{c.areaAtuacao || '—'}</td>
                  <td style={td}>{c.telefone || '—'}</td>
                  <td style={{ ...td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email || '—'}</td>
                  <td style={{ ...td, textAlign: 'center' }}>{nNeg > 0 ? <span style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', borderRadius: 999, padding: '2px 8px' }}>{nNeg}</span> : <span style={{ color: '#ccc' }}>—</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const STATUS_AG: Record<string, { label: string; cor: string }> = {
  agendado: { label: 'Agendado', cor: '#1d4ed8' }, confirmado: { label: 'Confirmado', cor: '#166534' },
  atendido: { label: 'Atendido', cor: '#374151' }, faltou: { label: 'Faltou', cor: '#b91c1c' }, cancelado: { label: 'Cancelado', cor: '#9ca3af' },
}

function ContatoModal({ contato, onClose, onSalvo, podeExcluir = false, perfilClinica = false }: { contato: Contato | null; onClose: () => void; onSalvo: () => void; podeExcluir?: boolean; perfilClinica?: boolean }) {
  const [f, setF] = useState<any>({ nome: contato?.nome || '', empresa: (contato as any)?.empresa || '', profissionalAutonomo: !!(contato as any)?.profissionalAutonomo, areaAtuacao: (contato as any)?.areaAtuacao || '', telefone: contato?.telefone || '', email: contato?.email || '', cargo: (contato as any)?.cargo || '', observacoes: (contato as any)?.observacoes || '', tipo: contato?.tipo || (perfilClinica ? 'paciente' : ''), nascimento: contato?.nascimento || '', etiquetasTxt: (contato?.etiquetas || []).join(', '), ativo: contato?.ativo !== false })
  const [salvando, setSalvando] = useState(false)
  // Histórico de atendimentos do paciente (perfil clínica, só ao editar)
  const [historico, setHistorico] = useState<{ id: string; dataInicio: string; servico?: string; status: string; profissionalNome: string; registroAtendimento?: string }[] | null>(null)
  useEffect(() => {
    if (!perfilClinica || !contato?.id) return
    fetch(`/api/agenda?contatoId=${contato.id}`).then(r => r.json())
      .then(d => setHistorico(Array.isArray(d?.agendamentos) ? d.agendamentos : []))
      .catch(() => setHistorico([]))
  }, [perfilClinica, contato?.id])

  async function salvar() {
    if (!f.nome.trim()) return
    setSalvando(true)
    const { etiquetasTxt, ...resto } = f
    const corpo = { ...resto, etiquetas: String(etiquetasTxt || '').split(',').map((s: string) => s.trim()).filter(Boolean), tipo: f.tipo || undefined }
    if (contato?.id) await fetch('/api/crm/contatos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: contato.id, ...corpo }) }).catch(() => {})
    else await fetch('/api/crm/contatos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }).catch(() => {})
    setSalvando(false); onSalvo()
  }
  async function excluir() {
    if (!contato?.id || !(await confirmar('Excluir este contato?', { titulo: 'Excluir contato', okLabel: 'Excluir', perigo: true }))) return
    await fetch(`/api/crm/contatos?id=${contato.id}`, { method: 'DELETE' }).catch(() => {})
    onSalvo()
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 440, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#111' }}>{contato ? (perfilClinica ? 'Editar paciente' : 'Editar contato') : (perfilClinica ? 'Novo paciente' : 'Novo contato')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label style={labelStyle}>Nome *</label><input value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} style={inputStyle} /></div>
          {perfilClinica && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={labelStyle}>Tipo</label>
                <select value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })} style={{ ...inputStyle, background: '#fff' }}>
                  <option value="paciente">Paciente</option><option value="lead">Lead</option><option value="profissional">Profissional</option><option value="fornecedor">Fornecedor</option><option value="outro">Outro</option>
                </select>
              </div>
              <div><label style={labelStyle}>Nascimento</label><input type="date" value={f.nascimento} onChange={e => setF({ ...f, nascimento: e.target.value })} style={inputStyle} /></div>
            </div>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#333', fontWeight: 600 }}>
            <input type="checkbox" checked={f.profissionalAutonomo} onChange={e => setF({ ...f, profissionalAutonomo: e.target.checked, empresa: e.target.checked ? '' : f.empresa })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            Profissional Autônomo (sem empresa)
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={labelStyle}>Empresa</label><input value={f.empresa} disabled={f.profissionalAutonomo} onChange={e => setF({ ...f, empresa: e.target.value })} placeholder={f.profissionalAutonomo ? 'Autônomo' : ''} style={{ ...inputStyle, background: f.profissionalAutonomo ? '#f5f5f5' : '#fff', color: f.profissionalAutonomo ? '#aaa' : '#111' }} /></div>
            <div><label style={labelStyle}>Área de atuação</label><input value={f.areaAtuacao} onChange={e => setF({ ...f, areaAtuacao: e.target.value })} placeholder="Ex: Odontologia, Advocacia..." style={inputStyle} /></div>
            <div><label style={labelStyle}>Cargo</label><input value={f.cargo} onChange={e => setF({ ...f, cargo: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>WhatsApp / telefone</label><input value={f.telefone} onChange={e => setF({ ...f, telefone: e.target.value })} placeholder="+55..." style={inputStyle} /></div>
            <div><label style={labelStyle}>E-mail</label><input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} style={inputStyle} /></div>
          </div>
          {perfilClinica && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
              <div><label style={labelStyle}>Etiquetas (separadas por vírgula)</label><input value={f.etiquetasTxt} onChange={e => setF({ ...f, etiquetasTxt: e.target.value })} placeholder="Ex: botox, avaliação, VIP" style={inputStyle} /></div>
              {contato && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#333', fontWeight: 600, paddingBottom: 10 }}>
                  <input type="checkbox" checked={f.ativo} onChange={e => setF({ ...f, ativo: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                  Ativo
                </label>
              )}
            </div>
          )}
          <div><label style={labelStyle}>Observações</label><textarea value={f.observacoes} onChange={e => setF({ ...f, observacoes: e.target.value })} style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} /></div>
          {perfilClinica && contato?.id && (
            <div>
              <label style={labelStyle}>Histórico de atendimentos</label>
              {historico === null ? <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>Carregando...</p>
                : historico.length === 0 ? <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>Nenhum agendamento deste paciente ainda.</p>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 180, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 10 }}>
                    {historico.map(h => {
                      const st = STATUS_AG[h.status] || STATUS_AG.agendado
                      return (
                        <div key={h.id} style={{ padding: '7px 10px', borderBottom: '1px solid #f6f6f6' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#111', flexShrink: 0 }}>{new Date(h.dataInicio).toLocaleDateString('pt-BR')} {new Date(h.dataInicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                            <span style={{ flex: 1, fontSize: 12, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.servico || '—'} · {(h.profissionalNome || '').split(' ')[0]}</span>
                            <span style={{ fontSize: 10.5, fontWeight: 800, color: st.cor, flexShrink: 0 }}>{st.label}</span>
                          </div>
                          {h.registroAtendimento && (
                            <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#555', background: '#fafafa', borderRadius: 6, padding: '5px 8px', whiteSpace: 'pre-wrap' }}>{h.registroAtendimento}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={salvar} disabled={salvando || !f.nome.trim()} style={{ flex: 1, padding: '11px 0', background: f.nome.trim() ? '#ffc00f' : '#f0f0f0', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: f.nome.trim() ? 'pointer' : 'not-allowed' }}>{salvando ? 'Salvando...' : contato ? 'Salvar' : 'Criar contato'}</button>
          {contato && podeExcluir && <button onClick={excluir} style={{ padding: '11px 16px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Excluir</button>}
          <button onClick={onClose} style={{ padding: '11px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function PipelinesModal({ pipelines, podeExcluir = false, onClose, onMudou }: { pipelines: { id: string; nome: string; ordem: number }[]; podeExcluir?: boolean; onClose: () => void; onMudou: () => void }) {
  const [novo, setNovo] = useState('')
  const [editId, setEditId] = useState('')
  const [editNome, setEditNome] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function criar() {
    if (!novo.trim()) return
    setSalvando(true)
    const r = await fetch('/api/crm/pipelines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: novo.trim() }) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (r?.ok) { setNovo(''); toast('Pipeline criado.', 'sucesso'); onMudou() } else toast(r?.error || 'Falha ao criar.', 'erro')
  }
  async function renomear(id: string) {
    if (!editNome.trim()) return
    const r = await fetch('/api/crm/pipelines', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, nome: editNome.trim() }) }).then(x => x.json()).catch(() => null)
    if (r?.ok) { setEditId(''); onMudou() } else toast(r?.error || 'Falha ao renomear.', 'erro')
  }
  async function excluir(id: string, nome: string) {
    if (!(await confirmar(`Excluir o pipeline "${nome}"? As oportunidades dele serão movidas para outro pipeline.`, { titulo: 'Excluir pipeline', okLabel: 'Excluir', perigo: true }))) return
    const r = await fetch(`/api/crm/pipelines?id=${id}`, { method: 'DELETE' }).then(x => x.json()).catch(() => null)
    if (r?.ok) { toast('Pipeline excluído.', 'sucesso'); onMudou() } else toast(r?.error || 'Falha ao excluir.', 'erro')
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#111' }}>Pipelines</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#999' }}>Crie funis separados (ex.: Marketing, +Clínicas, Mentoria). Cada um tem suas etapas.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {pipelines.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f7f7f7', borderRadius: 10, padding: '8px 12px' }}>
              {editId === p.id ? (
                <>
                  <input value={editNome} onChange={e => setEditNome(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') renomear(p.id) }} style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={() => renomear(p.id)} style={{ padding: '7px 12px', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Salvar</button>
                  <button onClick={() => setEditId('')} style={{ padding: '7px 10px', background: 'none', color: '#888', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: '#111' }}>{p.nome}</span>
                  <button onClick={() => { setEditId(p.id); setEditNome(p.nome) }} style={{ padding: '6px 10px', background: '#fff', color: '#444', border: '1px solid #e0e0e0', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Renomear</button>
                  {podeExcluir && pipelines.length > 1 && <button onClick={() => excluir(p.id, p.nome)} style={{ padding: '6px 10px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Excluir</button>}
                </>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={novo} onChange={e => setNovo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') criar() }} placeholder="Nome do novo pipeline (ex.: Marketing)" style={{ ...inputStyle, flex: 1 }} />
          <button onClick={criar} disabled={!novo.trim() || salvando} style={{ padding: '10px 16px', background: novo.trim() ? 'var(--marca, #ffc00f)' : '#f0f0f0', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: novo.trim() ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>{salvando ? '...' : '+ Criar'}</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '10px 18px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

function EtapasModal({ pipelineId, pipelineNome, estagios, onClose, onMudou }: { pipelineId: string; pipelineNome: string; estagios: Estagio[]; onClose: () => void; onMudou: () => void }) {
  type Item = { id: string; nome: string; ganho?: boolean; perdido?: boolean }
  const [lista, setLista] = useState<Item[]>(() => estagios.map(e => ({ id: e.id, nome: e.nome, ganho: e.ganho, perdido: e.perdido })))
  const [salvando, setSalvando] = useState(false)
  const novoId = () => (typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`)

  const setNome = (i: number, nome: string) => setLista(l => l.map((e, idx) => idx === i ? { ...e, nome } : e))
  const remover = (i: number) => setLista(l => l.filter((_, idx) => idx !== i))
  const mover = (i: number, dir: -1 | 1) => setLista(l => { const j = i + dir; if (j < 0 || j >= l.length) return l; const n = [...l]; const tmp = n[i]; n[i] = n[j]; n[j] = tmp; return n })
  function adicionar() {
    setLista(l => {
      const idxTerminal = l.findIndex(e => e.ganho || e.perdido)
      const nova: Item = { id: novoId(), nome: '' }
      return idxTerminal < 0 ? [...l, nova] : [...l.slice(0, idxTerminal), nova, ...l.slice(idxTerminal)]
    })
  }
  async function salvar() {
    if (lista.some(e => !e.nome.trim())) { toast('Dê um nome a todas as etapas.', 'erro'); return }
    setSalvando(true)
    const payload = lista.map((e, idx) => ({ id: e.id, nome: e.nome.trim(), ordem: idx, ...(e.ganho ? { ganho: true } : {}), ...(e.perdido ? { perdido: true } : {}) }))
    const r = await fetch('/api/crm/estagios', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pipelineId, estagios: payload }) }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (r?.ok) { toast('Etapas salvas.', 'sucesso'); onMudou(); onClose() } else toast(r?.error || 'Falha ao salvar.', 'erro')
  }

  const arrow = (d: string) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#111' }}>Etapas — {pipelineNome}</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#999' }}>Renomeie, adicione, reordene ou remova as fases deste pipeline. Ganho e Perdido são obrigatórios e não podem ser removidos.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {lista.map((e, i) => {
            const terminal = e.ganho || e.perdido
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f7f7f7', borderRadius: 10, padding: '6px 10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', color: '#999' }}>
                  <button onClick={() => mover(i, -1)} disabled={i === 0} title="Subir" style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? '#ddd' : '#888', padding: 0, lineHeight: 0 }}>{arrow('m18 15-6-6-6 6')}</button>
                  <button onClick={() => mover(i, 1)} disabled={i === lista.length - 1} title="Descer" style={{ background: 'none', border: 'none', cursor: i === lista.length - 1 ? 'default' : 'pointer', color: i === lista.length - 1 ? '#ddd' : '#888', padding: 0, lineHeight: 0 }}>{arrow('m6 9 6 6 6-6')}</button>
                </div>
                <input value={e.nome} onChange={ev => setNome(i, ev.target.value)} placeholder="Nome da etapa" style={{ ...inputStyle, flex: 1 }} />
                {terminal
                  ? <span style={{ fontSize: 10.5, fontWeight: 800, color: e.ganho ? '#16a34a' : '#b91c1c', background: e.ganho ? '#f0fdf4' : '#fef2f2', borderRadius: 999, padding: '3px 9px', flexShrink: 0 }}>{e.ganho ? 'Ganho' : 'Perdido'}</span>
                  : <button onClick={() => remover(i)} title="Remover etapa" style={{ background: 'none', border: 'none', color: '#c00', cursor: 'pointer', fontSize: 18, lineHeight: 1, flexShrink: 0, padding: '0 4px' }}>×</button>}
              </div>
            )
          })}
        </div>
        <button onClick={adicionar} style={{ padding: '9px 14px', background: '#f0f0f0', color: '#333', border: '1px dashed #ccc', borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', width: '100%' }}>+ Adicionar etapa</button>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={salvar} disabled={salvando} style={{ flex: 1, padding: '11px 0', background: 'var(--marca, #ffc00f)', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>{salvando ? 'Salvando...' : 'Salvar etapas'}</button>
          <button onClick={onClose} style={{ padding: '11px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function NovoNegocioModal({ estagios, pipelineId, usuarios, contatos, origens = [], onClose, onSalvo }: { estagios: Estagio[]; pipelineId?: string; usuarios: any[]; contatos: Contato[]; origens?: string[]; onClose: () => void; onSalvo: () => void }) {
  const [f, setF] = useState({ titulo: '', valor: '', contatoNome: '', contatoTelefone: '', dono: '', origem: '', previsaoFechamento: '', estagioId: '', empresa: '', profissionalAutonomo: false, segmento: '', faturamentoEstimado: '', instagram: '', dores: '', solucoes: '' })
  // #5 — toda oportunidade precisa de um contato: existente ou novo
  const [modoContato, setModoContato] = useState<'existente' | 'novo'>((contatos || []).length ? 'existente' : 'novo')
  const [contatoId, setContatoId] = useState('')
  const [buscaContato, setBuscaContato] = useState('') // pesquisa do contato pelo nome
  const [salvando, setSalvando] = useState(false)
  // #3 — responsavel: somente admins ou quem tem funcao de vendas
  const equipe = (usuarios || []).filter(u => u.role === 'admin' || u.role === 'vendas')

  const contatoSel = (contatos || []).find(c => c.id === contatoId)
  const buscaLc = buscaContato.trim().toLowerCase()
  const contatosFiltrados = buscaLc
    ? (contatos || []).filter(c => c.nome.toLowerCase().includes(buscaLc) || (c.empresa || '').toLowerCase().includes(buscaLc))
    : (contatos || [])
  // #2 — empresa obrigatoria na criacao da oportunidade, exceto profissional autonomo (alem do contato)
  const valido = (modoContato === 'existente' ? !!contatoId : !!f.contatoNome.trim()) && (!!f.empresa.trim() || f.profissionalAutonomo)

  async function salvar() {
    if (!valido) { toast('Preencha o contato e a empresa (ou marque Profissional Autônomo).', 'erro'); return }
    setSalvando(true)
    // Define o contato: usa o existente ou cria um novo. O nome do contato é o nome da oportunidade.
    let idContato = contatoId
    let nomeNegocio = contatoSel?.nome || ''
    if (modoContato === 'novo') {
      const c = await fetch('/api/crm/contatos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: f.contatoNome, telefone: f.contatoTelefone, empresa: f.profissionalAutonomo ? '' : f.empresa, profissionalAutonomo: f.profissionalAutonomo }) }).then(r => r.json()).catch(() => null)
      idContato = c?.contato?.id || ''
      nomeNegocio = f.contatoNome.trim()
    }
    if (!idContato) { setSalvando(false); toast('Não foi possível vincular o contato. Tente novamente.', 'erro'); return }
    const dono = equipe.find(u => u.email === f.dono)
    const r = await fetch('/api/crm/negocios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: nomeNegocio || 'Oportunidade', valor: Number(f.valor) || 0, contatoId: idContato, pipelineId: pipelineId || '', profissionalAutonomo: f.profissionalAutonomo, dono: f.dono, donoNome: dono?.nome || '', origem: f.origem, previsaoFechamento: f.previsaoFechamento, estagioId: f.estagioId, empresa: f.empresa, segmento: f.segmento, faturamentoEstimado: f.faturamentoEstimado, instagram: f.instagram, dores: f.dores, solucoes: f.solucoes }),
    }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (!r?.ok) { toast(r?.error || 'Não foi possível criar o negócio.', 'erro'); return }
    onSalvo()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#111' }}>Novo negócio</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* #5 — contato obrigatorio: existente ou novo */}
          <div>
            <label style={labelStyle}>Contato da oportunidade *</label>
            <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: 9, padding: 3, marginBottom: 8 }}>
              {([['existente', 'Contato existente'], ['novo', 'Novo contato']] as const).map(([k, lab]) => (
                <button key={k} type="button" onClick={() => setModoContato(k)} disabled={k === 'existente' && !(contatos || []).length}
                  style={{ flex: 1, padding: '7px 10px', border: 'none', borderRadius: 7, cursor: (k === 'existente' && !(contatos || []).length) ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700, background: modoContato === k ? '#fff' : 'transparent', color: modoContato === k ? '#111' : '#888', boxShadow: modoContato === k ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}>{lab}</button>
              ))}
            </div>
            {modoContato === 'existente' ? (
              contatoSel ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 9, padding: '9px 12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111' }}>{contatoSel.nome}</p>
                    {(contatoSel.empresa || contatoSel.profissionalAutonomo) && <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#888' }}>{contatoSel.empresa || 'Autônomo'}</p>}
                  </div>
                  <button type="button" onClick={() => { setContatoId(''); setBuscaContato('') }} style={{ background: 'none', border: 'none', color: '#16a34a', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Trocar</button>
                </div>
              ) : (
                <div>
                  <input value={buscaContato} onChange={e => setBuscaContato(e.target.value)} autoFocus placeholder="Pesquisar contato pelo nome..." style={inputStyle} />
                  <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #eee', borderRadius: 9, marginTop: 6 }}>
                    {contatosFiltrados.length === 0 ? (
                      <p style={{ margin: 0, padding: 12, fontSize: 12.5, color: '#888' }}>Nenhum contato encontrado.{buscaContato.trim() ? ' Use "Novo contato" para criar.' : ''}</p>
                    ) : contatosFiltrados.slice(0, 50).map(c => (
                      <button key={c.id} type="button" onClick={() => { setContatoId(c.id); setF(prev => ({ ...prev, empresa: c.empresa || '', profissionalAutonomo: !!c.profissionalAutonomo })) }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: '#fff', border: 'none', borderBottom: '1px solid #f5f5f5', cursor: 'pointer', fontSize: 13 }}>
                        <span style={{ fontWeight: 700, color: '#111' }}>{c.nome}</span>{c.empresa ? <span style={{ color: '#888' }}> — {c.empresa}</span> : c.profissionalAutonomo ? <span style={{ color: '#888' }}> — Autônomo</span> : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input value={f.contatoNome} onChange={e => setF({ ...f, contatoNome: e.target.value })} placeholder="Nome do responsável" style={inputStyle} />
                <input value={f.contatoTelefone} onChange={e => setF({ ...f, contatoTelefone: e.target.value })} placeholder="WhatsApp / telefone" style={inputStyle} />
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={labelStyle}>Valor (R$)</label><input type="number" min="0" value={f.valor} onChange={e => setF({ ...f, valor: e.target.value })} placeholder="0" style={inputStyle} /></div>
            <div><label style={labelStyle}>Etapa</label>
              <select value={f.estagioId} onChange={e => setF({ ...f, estagioId: e.target.value })} style={{ ...inputStyle, background: '#fff' }}>
                <option value="">Primeira (Lead)</option>
                {estagios.filter(e => !e.ganho && !e.perdido).map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={labelStyle}>Vendedor responsável</label>
              <select value={f.dono} onChange={e => setF({ ...f, dono: e.target.value })} style={{ ...inputStyle, background: '#fff' }}>
                <option value="">Eu</option>
                {equipe.map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Previsão</label><input type="date" value={f.previsaoFechamento} onChange={e => setF({ ...f, previsaoFechamento: e.target.value })} style={inputStyle} /></div>
          </div>
          <div><label style={labelStyle}>Origem</label>
            <input value={f.origem} onChange={e => setF({ ...f, origem: e.target.value })} list="crm-origens" placeholder="Selecione ou digite..." style={inputStyle} />
            <datalist id="crm-origens">{origens.map(o => <option key={o} value={o} />)}</datalist>
          </div>

          <div style={{ height: 1, background: '#f0f0f0', margin: '2px 0' }} />
          <span style={{ fontSize: 12.5, fontWeight: 800, color: '#111' }}>Qualificação da oportunidade</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#333', fontWeight: 600 }}>
            <input type="checkbox" checked={f.profissionalAutonomo} onChange={e => setF({ ...f, profissionalAutonomo: e.target.checked, empresa: e.target.checked ? '' : f.empresa })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            Profissional Autônomo (sem empresa)
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={labelStyle}>Empresa {f.profissionalAutonomo ? '' : '*'}</label><input value={f.empresa} disabled={f.profissionalAutonomo} onChange={e => setF({ ...f, empresa: e.target.value })} placeholder={f.profissionalAutonomo ? 'Autônomo' : 'Nome da empresa'} style={{ ...inputStyle, background: f.profissionalAutonomo ? '#f5f5f5' : '#fff', color: f.profissionalAutonomo ? '#aaa' : '#111' }} /></div>
            <div><label style={labelStyle}>Segmento / nicho</label><input value={f.segmento} onChange={e => setF({ ...f, segmento: e.target.value })} placeholder="Ex: Odontologia" style={inputStyle} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={labelStyle}>Faturamento estimado</label><input value={f.faturamentoEstimado} onChange={e => setF({ ...f, faturamentoEstimado: e.target.value })} placeholder="Ex: R$ 50-100k/mês" style={inputStyle} /></div>
            <div><label style={labelStyle}>Instagram / site</label><input value={f.instagram} onChange={e => setF({ ...f, instagram: e.target.value })} placeholder="@empresa ou site" style={inputStyle} /></div>
          </div>
          <div><label style={labelStyle}>Principais dores / desafios</label><textarea value={f.dores} onChange={e => setF({ ...f, dores: e.target.value })} placeholder="O que mais incomoda o prospect hoje..." style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} /></div>
          <div><label style={labelStyle}>Possíveis soluções</label><textarea value={f.solucoes} onChange={e => setF({ ...f, solucoes: e.target.value })} placeholder="O que podemos oferecer / proposta de valor..." style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={salvar} disabled={salvando || !valido} style={{ flex: 1, padding: '11px 0', background: valido ? '#ffc00f' : '#f0f0f0', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: valido ? 'pointer' : 'not-allowed' }}>{salvando ? 'Salvando...' : 'Criar negócio'}</button>
          <button onClick={onClose} style={{ padding: '11px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function NegocioModal({ negocio, estagios, pipelines = [], padraoId = '', contato, usuarios, onClose, onMudou, onFechar, onClienteCriado, podeExcluir = false }: { negocio: Negocio; estagios: Estagio[]; pipelines?: { id: string; nome: string; ordem: number }[]; padraoId?: string; contato?: Contato; usuarios: any[]; onClose: () => void; onMudou: () => void; onFechar: () => void; onClienteCriado?: () => void; podeExcluir?: boolean }) {
  const [neg, setNeg] = useState<Negocio>(negocio)
  const pipeAtual = neg.pipelineId || padraoId
  const estagiosPipe = estagios.filter(e => (e.pipelineId || padraoId) === pipeAtual)
  // Move o negócio para outro pipeline: entra na primeira etapa do destino
  function moverPipeline(destinoId: string) {
    if (destinoId === pipeAtual) return
    const estDest = estagios.filter(e => (e.pipelineId || padraoId) === destinoId)
    const primeira = (estDest.find(e => !e.ganho && !e.perdido) || estDest[0])?.id || ''
    patch({ pipelineId: destinoId, estagioId: primeira })
  }
  const [tipoAtiv, setTipoAtiv] = useState('nota')
  const [textoAtiv, setTextoAtiv] = useState('')
  const [converter, setConverter] = useState(false)
  // Cadência / agendamentos (Fase 2)
  const [agQuando, setAgQuando] = useState('')
  const [agCanal, setAgCanal] = useState('whatsapp')
  const [agTitulo, setAgTitulo] = useState('')
  const estagio = estagios.find(e => e.id === neg.estagioId)

  async function patch(updates: any) {
    const r = await fetch('/api/crm/negocios', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: neg.id, ...updates }) }).then(x => x.json()).catch(() => null)
    if (r?.negocio) setNeg(r.negocio)
    onMudou()
  }
  async function addAtividade() {
    if (!textoAtiv.trim()) return
    await patch({ novaAtividade: { tipo: tipoAtiv, texto: textoAtiv.trim() } })
    setTextoAtiv('')
  }
  async function addAgendamento() {
    if (!agQuando || !agTitulo.trim()) return
    await patch({ novoAgendamento: { quando: agQuando, canal: agCanal, titulo: agTitulo.trim() } })
    setAgQuando(''); setAgTitulo('')
  }
  async function excluir() {
    if (!(await confirmar('Excluir este negócio?', { titulo: 'Excluir negócio', okLabel: 'Excluir', perigo: true }))) return
    await fetch(`/api/crm/negocios?id=${neg.id}`, { method: 'DELETE' }).catch(() => {})
    onFechar()
  }

  const tl = [...(neg.atividades || [])].reverse()

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 560, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <input value={neg.titulo} onChange={e => setNeg({ ...neg, titulo: e.target.value })} onBlur={() => patch({ titulo: neg.titulo })}
            style={{ flex: 1, fontSize: 17, fontWeight: 800, color: '#111', border: 'none', outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', borderRadius: 999, padding: '4px 12px' }}>{fmtR$(neg.valor)}</span>
          <select value={neg.estagioId} onChange={e => patch({ estagioId: e.target.value })} style={{ fontSize: 12, fontWeight: 700, borderRadius: 999, padding: '4px 12px', border: '1.5px solid #e0e0e0', background: '#fff', cursor: 'pointer' }}>
            {estagiosPipe.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
          {pipelines.length > 1 && (
            <select value={pipeAtual} onChange={e => moverPipeline(e.target.value)} title="Mover para outro pipeline" style={{ fontSize: 12, fontWeight: 700, borderRadius: 999, padding: '4px 12px', border: '1.5px solid #c7d2fe', background: '#eef2ff', color: '#3730a3', cursor: 'pointer' }}>
              {pipelines.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          )}
          {neg.status === 'ganho' && <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: '#16a34a', borderRadius: 999, padding: '4px 12px' }}>GANHO</span>}
          {neg.status === 'perdido' && <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: '#b91c1c', borderRadius: 999, padding: '4px 12px' }}>PERDIDO</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Valor (R$)</label>
            <input type="number" min="0" value={neg.valor || 0} onChange={e => setNeg({ ...neg, valor: Number(e.target.value) })} onBlur={() => patch({ valor: neg.valor })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Responsável</label>
            <select value={neg.dono || ''} onChange={e => { const u = (usuarios || []).find((x: any) => x.email === e.target.value); patch({ dono: e.target.value, donoNome: u?.nome || '' }) }} style={{ ...inputStyle, background: '#fff' }}>
              <option value="">—</option>
              {(usuarios || []).filter(u => u.role === 'admin' || u.role === 'vendas').map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Próximo follow-up</label>
          <input type="date" value={(neg.proximoFollowUp || '').slice(0, 10)} onChange={e => setNeg({ ...neg, proximoFollowUp: e.target.value })} onBlur={() => patch({ proximoFollowUp: neg.proximoFollowUp })} style={inputStyle} />
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#bbb' }}>No dia, o responsável recebe um lembrete (push + inbox).</p>
        </div>

        {/* Cadência / agendamentos */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
            <label style={{ ...labelStyle, margin: 0 }}>Cadência / agendamentos</label>
            <button type="button" onClick={() => patch({ aplicarCadencia: true })} title="Gera os toques a partir da cadência do Playbook (a contar de hoje)"
              style={{ background: 'none', border: 'none', color: '#1d4ed8', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>+ Aplicar cadência do Playbook</button>
          </div>
          {(neg.agendamentos || []).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {[...(neg.agendamentos || [])].sort((a, b) => a.quando.localeCompare(b.quando)).map(a => {
                const venceu = !a.feito && new Date(a.quando + 'T23:59:59').getTime() < Date.now()
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: a.feito ? '#f5f5f5' : venceu ? '#fef2f2' : '#fafafa', borderRadius: 8, fontSize: 12.5 }}>
                    <input type="checkbox" checked={!!a.feito} onChange={() => patch({ toggleAgendamento: a.id })} style={{ cursor: 'pointer', flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, color: venceu ? '#b91c1c' : '#444', flexShrink: 0 }}>{new Date(a.quando + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#888', background: '#fff', border: '1px solid #eee', borderRadius: 999, padding: '1px 7px', flexShrink: 0 }}>{a.canal}</span>
                    <span style={{ flex: 1, color: '#333', textDecoration: a.feito ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titulo}</span>
                    <button type="button" onClick={() => patch({ removerAgendamento: a.id })} title="Remover" style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 15, lineHeight: 1, flexShrink: 0 }}>×</button>
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="date" value={agQuando} onChange={e => setAgQuando(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, fontFamily: 'inherit' }} />
            <select value={agCanal} onChange={e => setAgCanal(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, background: '#fff', fontFamily: 'inherit' }}>
              {(['whatsapp', 'ligacao', 'email', 'reuniao', 'outro'] as const).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={agTitulo} onChange={e => setAgTitulo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addAgendamento() }} placeholder="O que fazer (ex.: enviar proposta)" style={{ flex: 1, minWidth: 130, padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, fontFamily: 'inherit' }} />
            <button type="button" onClick={addAgendamento} disabled={!agQuando || !agTitulo.trim()} style={{ padding: '7px 12px', background: (agQuando && agTitulo.trim()) ? '#111' : '#f0f0f0', color: (agQuando && agTitulo.trim()) ? '#fff' : '#aaa', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Agendar</button>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#bbb' }}>Cada toque vira lembrete (push + inbox) para o responsável no dia agendado.</p>
        </div>

        {contato && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#fafafa', borderRadius: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111' }}>{contato.nome}</p>
              {contato.telefone && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>{contato.telefone}</p>}
            </div>
            {contato.telefone && (
              <a href={`https://wa.me/${(contato.telefone || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: '#25D366', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>WhatsApp</a>
            )}
          </div>
        )}

        {/* Qualificação */}
        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12, marginBottom: 14 }}>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: '#111', display: 'block', marginBottom: 10 }}>Qualificação</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div><label style={labelStyle}>Empresa</label><input value={neg.empresa || ''} onChange={e => setNeg({ ...neg, empresa: e.target.value })} onBlur={() => patch({ empresa: neg.empresa })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Segmento</label><input value={neg.segmento || ''} onChange={e => setNeg({ ...neg, segmento: e.target.value })} onBlur={() => patch({ segmento: neg.segmento })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Faturamento estimado</label><input value={neg.faturamentoEstimado || ''} onChange={e => setNeg({ ...neg, faturamentoEstimado: e.target.value })} onBlur={() => patch({ faturamentoEstimado: neg.faturamentoEstimado })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Instagram / site</label><input value={neg.instagram || ''} onChange={e => setNeg({ ...neg, instagram: e.target.value })} onBlur={() => patch({ instagram: neg.instagram })} style={inputStyle} /></div>
          </div>
          <div style={{ marginBottom: 10 }}><label style={labelStyle}>Principais dores</label><textarea value={neg.dores || ''} onChange={e => setNeg({ ...neg, dores: e.target.value })} onBlur={() => patch({ dores: neg.dores })} style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} /></div>
          <div><label style={labelStyle}>Possíveis soluções</label><textarea value={neg.solucoes || ''} onChange={e => setNeg({ ...neg, solucoes: e.target.value })} onBlur={() => patch({ solucoes: neg.solucoes })} style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} /></div>
        </div>

        {/* Timeline */}
        <label style={labelStyle}>Atividades</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <select value={tipoAtiv} onChange={e => setTipoAtiv(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 12, fontFamily: 'inherit', background: '#fff' }}>
            {TIPOS_ATIV.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <input value={textoAtiv} onChange={e => setTextoAtiv(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addAtividade() }} placeholder="Registrar interação / nota..." style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 12.5, fontFamily: 'inherit' }} />
          <button onClick={addAtividade} disabled={!textoAtiv.trim()} style={{ padding: '8px 14px', background: textoAtiv.trim() ? '#111' : '#f0f0f0', color: textoAtiv.trim() ? '#fff' : '#aaa', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Add</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto', marginBottom: 16 }}>
          {tl.length === 0 && <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>Nenhuma atividade ainda.</p>}
          {tl.map(a => (
            <div key={a.id} style={{ display: 'flex', gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: a.tipo === 'ganho' ? '#16a34a' : a.tipo === 'perdido' ? '#b91c1c' : a.tipo === 'estagio' ? '#ffc00f' : '#1d4ed8', marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12.5, color: '#333' }}>{a.texto}</p>
                <p style={{ margin: '1px 0 0', fontSize: 10.5, color: '#aaa' }}>{a.autor} · {new Date(a.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Concretizar venda (Ganho -> Cliente) */}
        {neg.clienteId ? (
          <div style={{ padding: '11px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, marginBottom: 12, fontSize: 12.5, color: '#166534', fontWeight: 700 }}>✓ Venda concretizada — cliente criado e entregas aplicadas.</div>
        ) : (
          <button onClick={() => setConverter(true)} style={{ width: '100%', padding: '12px 0', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer', marginBottom: 12 }}>
            Concretizar venda → criar cliente
          </button>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Fechar</button>
          {podeExcluir && <button onClick={excluir} style={{ padding: '11px 16px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Excluir</button>}
        </div>
      </div>
      {converter && <ConversaoModal negocio={neg} contato={contato} onClose={() => setConverter(false)} onConvertido={(clienteId) => { setNeg({ ...neg, clienteId, status: 'ganho' }); setConverter(false); onMudou(); onClienteCriado?.() }} />}
    </div>
  )
}

function ConversaoModal({ negocio, contato, onClose, onConvertido }: { negocio: Negocio; contato?: Contato; onClose: () => void; onConvertido: (clienteId: string) => void }) {
  const [c, setC] = useState({
    nome: negocio.empresa || contato?.nome || negocio.titulo || '',
    instagram: negocio.instagram || '',
    loginEmail: contato?.email || '',
    contratoValor: String(negocio.valor || ''),
  })
  const [h, setH] = useState({ escopoVendido: negocio.solucoes || '', expectativas: '', detalhes: negocio.dores || '', observacoes: '' })
  const [templates, setTemplates] = useState<{ id: string; nome: string }[]>([])
  const [templateId, setTemplateId] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [resultado, setResultado] = useState<{ clienteId: string; marcos: number; tarefas: number; loginSenha?: string } | null>(null)

  useEffect(() => { fetch('/api/templates').then(r => r.json()).then(d => setTemplates(Array.isArray(d) ? d : [])).catch(() => {}) }, [])

  async function concretizar() {
    if (!c.nome.trim()) { setErro('Informe o nome do cliente.'); return }
    setSalvando(true); setErro('')
    const r = await fetch('/api/crm/converter', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ negocioId: negocio.id, cliente: { nome: c.nome, instagram: c.instagram, loginEmail: c.loginEmail || '', contratoValor: Number(c.contratoValor) || 0 }, handoff: h, templateId }),
    }).then(x => x.json()).catch(() => null)
    setSalvando(false)
    if (!r || r.error) { setErro(r?.error || 'Falha ao converter.'); return }
    setResultado(r)
  }

  if (resultado) {
    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
        <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 440, width: '100%', padding: 24, textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#111' }}>Venda concretizada! 🎉</h3>
          <p style={{ margin: '0 0 6px', fontSize: 13.5, color: '#555' }}>Cliente <b>{c.nome}</b> criado, com <b>{resultado.marcos}</b> etapas e <b>{resultado.tarefas}</b> tarefas no Playbook.</p>
          {resultado.loginSenha && (
            <div style={{ margin: '10px 0', padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, fontSize: 12.5, color: '#92400e' }}>
              Acesso do cliente criado. Senha: <b style={{ userSelect: 'all' }}>{resultado.loginSenha}</b> — anote/envie ao cliente.
            </div>
          )}
          <button onClick={() => onConvertido(resultado.clienteId)} style={{ marginTop: 10, width: '100%', padding: '12px 0', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Concluir</button>
        </div>
      </div>
    )
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 520, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 17, color: '#111' }}>Passagem de bastão → Onboarding</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#999' }}>Quanto mais detalhe o closer passar, melhor o onboarding do cliente pelo Gestor.</p>

        <span style={{ fontSize: 12.5, fontWeight: 800, color: '#111' }}>Cliente</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '8px 0 16px' }}>
          <div><label style={labelStyle}>Nome *</label><input value={c.nome} onChange={e => setC({ ...c, nome: e.target.value })} style={inputStyle} /></div>
          <div><label style={labelStyle}>Instagram</label><input value={c.instagram} onChange={e => setC({ ...c, instagram: e.target.value })} placeholder="@cliente" style={inputStyle} /></div>
          <div><label style={labelStyle}>E-mail de acesso (opcional)</label><input value={c.loginEmail} onChange={e => setC({ ...c, loginEmail: e.target.value })} placeholder="cria login do portal" style={inputStyle} /></div>
          <div><label style={labelStyle}>Valor do contrato (R$)</label><input type="number" min="0" value={c.contratoValor} onChange={e => setC({ ...c, contratoValor: e.target.value })} style={inputStyle} /></div>
        </div>

        <span style={{ fontSize: 12.5, fontWeight: 800, color: '#111' }}>Handoff (Closer → Gestor)</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '8px 0 16px' }}>
          <div><label style={labelStyle}>Escopo vendido / entregáveis</label><textarea value={h.escopoVendido} onChange={e => setH({ ...h, escopoVendido: e.target.value })} style={{ ...inputStyle, minHeight: 54, resize: 'vertical' }} /></div>
          <div><label style={labelStyle}>Expectativas e objetivos do cliente</label><textarea value={h.expectativas} onChange={e => setH({ ...h, expectativas: e.target.value })} style={{ ...inputStyle, minHeight: 54, resize: 'vertical' }} /></div>
          <div><label style={labelStyle}>Detalhes importantes (decisor, prazos prometidos, sensibilidades)</label><textarea value={h.detalhes} onChange={e => setH({ ...h, detalhes: e.target.value })} style={{ ...inputStyle, minHeight: 54, resize: 'vertical' }} /></div>
          <div><label style={labelStyle}>Observações</label><textarea value={h.observacoes} onChange={e => setH({ ...h, observacoes: e.target.value })} style={{ ...inputStyle, minHeight: 44, resize: 'vertical' }} /></div>
        </div>

        <span style={{ fontSize: 12.5, fontWeight: 800, color: '#111' }}>Entregas (onboarding)</span>
        <div style={{ margin: '8px 0 16px' }}>
          <label style={labelStyle}>Modelo de projeto a aplicar (gera marcos + tarefas)</label>
          <select value={templateId} onChange={e => setTemplateId(e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
            <option value="">Não aplicar modelo agora</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
          {templates.length === 0 && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#ea580c' }}>Nenhum modelo cadastrado. Crie em Modelos para montar o escopo automaticamente.</p>}
        </div>

        {erro && <p style={{ margin: '0 0 10px', fontSize: 12.5, color: '#b91c1c', fontWeight: 700 }}>{erro}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={concretizar} disabled={salvando || !c.nome.trim()} style={{ flex: 1, padding: '12px 0', background: c.nome.trim() ? '#16a34a' : '#f0f0f0', color: c.nome.trim() ? '#fff' : '#aaa', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: c.nome.trim() ? 'pointer' : 'not-allowed' }}>{salvando ? 'Concretizando...' : 'Concretizar venda'}</button>
          <button onClick={onClose} style={{ padding: '12px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// Central de mensagens — conversa com leads pelo sistema (WhatsApp e Instagram Direct)
type MsgConversa = { id: string; telefone?: string; nome?: string; username?: string; foto?: string; contatoId?: string; ultimaMsg?: string; ultimaEm?: string; naoLidas?: number }

// Avatar da conversa: foto do perfil (com fallback para a inicial se faltar/quebrar)
function AvatarConv({ foto, nome, cor }: { foto?: string; nome: string; cor: string }) {
  const [erro, setErro] = useState(false)
  const inicial = (nome || '?').replace('@', '').charAt(0).toUpperCase()
  return (
    <span style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: cor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13 }}>
      {foto && !erro ? <img src={foto} alt="" onError={() => setErro(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : inicial}
    </span>
  )
}
type MsgItem = { id: string; de: 'cliente' | 'agente'; texto: string; em: string; autor?: string }
type CanalMsg = 'whatsapp' | 'instagram'

// Cada canal abstrai o endpoint, os nomes dos campos e a apresentação. A UI é a mesma.
const CANAL_CFG: Record<CanalMsg, {
  cor: string
  bolha: string
  aviso: string
  listar: () => Promise<any>
  historico: (id: string) => Promise<any>
  enviar: (id: string, texto: string) => Promise<any>
  vincular: (id: string, contatoId: string) => Promise<any>
  norm: (c: any) => MsgConversa
  subId: (c: MsgConversa | undefined, id: string) => string
  matchContato: (c: MsgConversa, contatos: Contato[]) => string | undefined
  conectarUrl?: string
}> = {
  whatsapp: {
    cor: '#16a34a', bolha: '#dcf8c6',
    aviso: 'WhatsApp ainda não conectado. As conversas aparecem aqui assim que as credenciais (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN) forem adicionadas na Vercel e o webhook configurado na Meta.',
    listar: () => fetch('/api/crm/mensagens').then(r => r.json()).catch(() => null),
    historico: id => fetch(`/api/crm/mensagens?tel=${id}`).then(r => r.json()).catch(() => null),
    enviar: (id, texto) => fetch('/api/crm/mensagens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telefone: id, texto }) }).then(x => x.json()).catch(() => null),
    vincular: (id, contatoId) => fetch('/api/crm/mensagens', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telefone: id, contatoId }) }).catch(() => {}),
    norm: c => ({ ...c, id: c.telefone }),
    subId: (_c, id) => `+${id}`,
    matchContato: (c, contatos) => contatos.find(ct => (ct.telefone || '').replace(/\D/g, '') === c.id)?.nome,
  },
  instagram: {
    cor: '#d6249f', bolha: '#fce7f3',
    aviso: 'Instagram Direct ainda não conectado. As conversas aparecem aqui após a aprovação da permissão instagram_business_manage_messages no App Review, a conexão da conta do cliente e o webhook (INSTAGRAM_VERIFY_TOKEN) configurado na Meta.',
    listar: () => fetch('/api/crm/mensagens-instagram').then(r => r.json()).catch(() => null),
    historico: id => fetch(`/api/crm/mensagens-instagram?id=${id}`).then(r => r.json()).catch(() => null),
    enviar: (id, texto) => fetch('/api/crm/mensagens-instagram', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, texto }) }).then(x => x.json()).catch(() => null),
    vincular: (id, contatoId) => fetch('/api/crm/mensagens-instagram', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, contatoId }) }).catch(() => {}),
    norm: c => ({ ...c }),
    subId: (c, id) => c?.username ? `@${c.username}` : id,
    matchContato: () => undefined,
    conectarUrl: '/api/instagram/oauth?messaging=1',
  },
}

function MensagensInbox({ contatos }: { contatos: Contato[] }) {
  const [canal, setCanal] = useState<CanalMsg>(() => (typeof window !== 'undefined' && (sessionStorage.getItem('crm_canal') as CanalMsg)) || 'whatsapp')
  const cfg = CANAL_CFG[canal]
  const [conversas, setConversas] = useState<MsgConversa[]>([])
  const [configurado, setConfigurado] = useState(true)
  const [contas, setContas] = useState<any[]>([])
  const [sel, setSel] = useState<string>('')
  const [mensagens, setMensagens] = useState<MsgItem[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [carregando, setCarregando] = useState(true)

  const nomeDe = (c: MsgConversa) => c.nome || contatos.find(ct => ct.id === c.contatoId)?.nome || cfg.matchContato(c, contatos) || cfg.subId(c, c.id)

  async function carregarConversas() {
    const d = await cfg.listar()
    if (d) { setConversas(Array.isArray(d.conversas) ? d.conversas.map(cfg.norm) : []); setConfigurado(!!d.configurado); setContas(Array.isArray(d.contas) ? d.contas : []) }
    setCarregando(false)
  }
  async function abrir(id: string) {
    setSel(id)
    const d = await cfg.historico(id)
    if (d) setMensagens(Array.isArray(d.mensagens) ? d.mensagens : [])
    setConversas(cs => cs.map(c => c.id === id ? { ...c, naoLidas: 0 } : c))
  }
  async function enviar() {
    const t = texto.trim()
    if (!t || !sel || enviando) return
    setEnviando(true); setTexto('')
    const r = await cfg.enviar(sel, t)
    setEnviando(false)
    if (!r?.ok) toast(r?.error || 'Não foi possível enviar.', r?.registrado ? 'info' : 'erro')
    abrir(sel); carregarConversas()
  }
  async function vincular(contatoId: string) {
    if (!sel) return
    await cfg.vincular(sel, contatoId)
    carregarConversas()
  }

  // Troca de canal (e carga inicial): reseta a seleção e recarrega
  useEffect(() => { try { sessionStorage.setItem('crm_canal', canal) } catch {}; setSel(''); setMensagens([]); setCarregando(true); carregarConversas() }, [canal])
  // Atualiza a conversa aberta periodicamente (recebe respostas do lead)
  useEffect(() => {
    if (!sel) return
    const id = setInterval(() => { abrir(sel) }, 15000)
    return () => clearInterval(id)
  }, [sel])

  const conversaSel = conversas.find(c => c.id === sel)

  return (
    <div>
      {/* Seletor de canal */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['whatsapp', 'instagram'] as CanalMsg[]).map(c => (
          <button key={c} onClick={() => setCanal(c)} style={{ padding: '7px 16px', borderRadius: 999, border: `1.5px solid ${canal === c ? CANAL_CFG[c].cor : '#e5e5e5'}`, background: canal === c ? CANAL_CFG[c].cor : '#fff', color: canal === c ? '#fff' : '#666', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
            {c === 'whatsapp' ? 'WhatsApp' : 'Instagram'}
          </button>
        ))}
      </div>
      {cfg.conectarUrl && (
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {contas.length > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#166534', background: '#dcfce7', borderRadius: 999, padding: '5px 12px' }}>
              ✓ Conectada: {contas.map((c: any) => `@${c.username || c.userId}`).join(', ')}
            </span>
          )}
          <button onClick={() => { window.location.href = cfg.conectarUrl! }}
            style={{ padding: '8px 16px', background: contas.length > 0 ? '#fff' : cfg.cor, color: contas.length > 0 ? cfg.cor : '#fff', border: contas.length > 0 ? `1.5px solid ${cfg.cor}` : 'none', borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
            {contas.length > 0 ? 'Reconectar / adicionar conta' : 'Conectar conta do Instagram (mensagens)'}
          </button>
          <span style={{ fontSize: 11, color: '#888' }}>Conta de mensagens da própria agência (login de admin, conta profissional/testador).</span>
        </div>
      )}
      {!configurado && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '11px 14px', marginBottom: 14, fontSize: 12.5, color: '#92400e' }}>
          {cfg.aviso}
        </div>
      )}
      <div style={{ display: 'flex', gap: 14, height: 'min(620px, 70vh)', border: '1px solid #eee', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
        {/* Lista de conversas */}
        <div style={{ width: 280, borderRight: '1px solid #f0f0f0', overflowY: 'auto', flexShrink: 0 }}>
          {carregando ? <p style={{ padding: 16, color: '#aaa', fontSize: 13 }}>Carregando...</p>
            : conversas.length === 0 ? <p style={{ padding: 16, color: '#bbb', fontSize: 13 }}>Nenhuma conversa ainda.</p>
            : conversas.map(c => (
              <button key={c.id} onClick={() => abrir(c.id)} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', borderBottom: '1px solid #f5f5f5', background: sel === c.id ? '#f0f9ff' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                <AvatarConv foto={c.foto} nome={nomeDe(c)} cor={cfg.cor} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomeDe(c)}</span>
                    {!!c.naoLidas && <span style={{ background: cfg.cor, color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 800, padding: '1px 7px', flexShrink: 0 }}>{c.naoLidas}</span>}
                  </span>
                  <span style={{ fontSize: 11.5, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.ultimaMsg || '—'}</span>
                </span>
              </button>
            ))}
        </div>
        {/* Conversa */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {!sel ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 13 }}>Selecione uma conversa</div>
          ) : (<>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                {conversaSel && <AvatarConv foto={conversaSel.foto} nome={nomeDe(conversaSel)} cor={cfg.cor} />}
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conversaSel ? nomeDe(conversaSel) : sel}</p>
                  <p style={{ margin: 0, fontSize: 11.5, color: '#999' }}>{cfg.subId(conversaSel, sel)}</p>
                </div>
              </div>
              <select value={conversaSel?.contatoId || ''} onChange={e => vincular(e.target.value)} title="Vincular a um contato do CRM"
                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, background: '#fff', maxWidth: 180 }}>
                <option value="">Vincular contato...</option>
                {contatos.map(ct => <option key={ct.id} value={ct.id}>{ct.nome}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8, background: '#fafafa' }}>
              {mensagens.length === 0 ? <p style={{ color: '#bbb', fontSize: 13, textAlign: 'center', margin: 'auto' }}>Sem mensagens.</p>
                : mensagens.map(m => (
                  <div key={m.id} style={{ alignSelf: m.de === 'agente' ? 'flex-end' : 'flex-start', maxWidth: '78%', padding: '8px 12px', borderRadius: 12, fontSize: 13, lineHeight: 1.45, background: m.de === 'agente' ? cfg.bolha : '#fff', border: m.de === 'agente' ? 'none' : '1px solid #ececec', color: '#222', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {m.texto}
                    <span style={{ display: 'block', fontSize: 9.5, color: '#999', marginTop: 3, textAlign: 'right' }}>{m.autor ? `${m.autor} · ` : ''}{new Date(m.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
            </div>
            <div style={{ borderTop: '1px solid #f0f0f0', padding: 10, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                placeholder="Escreva uma mensagem..." rows={1} style={{ flex: 1, resize: 'none', maxHeight: 110, border: '1px solid #e2e2e2', borderRadius: 10, padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
              <button onClick={enviar} disabled={!texto.trim() || enviando} style={{ padding: '9px 18px', background: texto.trim() && !enviando ? '#111' : '#eee', color: texto.trim() && !enviando ? '#fff' : '#aaa', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: texto.trim() && !enviando ? 'pointer' : 'not-allowed' }}>{enviando ? '...' : 'Enviar'}</button>
            </div>
          </>)}
        </div>
      </div>
    </div>
  )
}
