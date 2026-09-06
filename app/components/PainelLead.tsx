'use client'
import { useEffect, useMemo, useState } from 'react'
import { toast } from '@/lib/toast'
import {
  situacaoDaConversa, temperatura, resumoConversa, interessesNaConversa,
  aplicarPlaceholders, MsgRaioX,
} from '@/lib/raioXLead'
import { OrientacaoLead } from '@/lib/orientacaoLead'
import { BibliotecaVendas, FASES, vazia } from '@/lib/bibliotecaVendas'

// PAINEL DO LEAD — a coluna da direita da conversa de WhatsApp.
//
// A pergunta que ele responde é a que o atendente faz com o WhatsApp aberto:
// "quem é essa pessoa, em que pé está e o que eu mando agora?". Antes disso, a
// resposta exigia rolar o histórico, abrir a ficha em outra aba e lembrar do
// script de cor.
//
// Quatro abas, na ordem em que a dúvida aparece: Geral (raio-X) · Follow-up
// (o que mandar) · Paciente (quem é) · Financeiro (quanto já vale).
//
// Nada do que está aqui é digitado à mão: situação e temperatura saem das
// mensagens, os textos prontos saem da Biblioteca de Vendas (o treinamento que o
// dono escreveu, editável na tela) e a orientação da Assistente sai da mesma
// biblioteca. Ver lib/raioXLead.

type ContatoLead = {
  id: string; nome: string; telefone?: string; email?: string; tipo?: string
  nascimento?: string; etiquetas?: string[]; ativo?: boolean
  ultimoProcedimento?: string; observacoes?: string
  proximosPassos?: { id: string; titulo: string; quando: string; nota?: string; feito?: boolean }[]
}
type NegocioLead = { id: string; titulo?: string; valor?: number; status?: string; contatoId?: string; estagioId?: string; origem?: string; fechadoEm?: string; criadoEm?: string }
type Atendimento = { id: string; dataInicio: string; servico?: string; status: string; profissionalNome?: string; valorInvestido?: number; procedimentosRealizados?: string[] }

type Aba = 'geral' | 'followup' | 'paciente' | 'financeiro'

const brl = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const dataHora = (iso?: string) => { if (!iso) return '—'; const d = new Date(iso); return isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) }
const dataBr = (iso?: string) => { if (!iso) return '—'; const d = new Date(iso); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR') }
const hojeYmd = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

const rotulo: React.CSSProperties = { display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--v2-ink3)', textTransform: 'uppercase', letterSpacing: '0.04em' }
const valor: React.CSSProperties = { display: 'block', fontSize: 12.5, color: 'var(--v2-ink)', fontWeight: 600, marginTop: 2 }
const secao: React.CSSProperties = { padding: '12px 14px', borderBottom: '1px solid var(--v2-surface1)' }
const botaoTexto: React.CSSProperties = { width: '100%', textAlign: 'left', background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 10, padding: '8px 10px', cursor: 'pointer', font: 'inherit', marginBottom: 6 }

export default function PainelLead({
  telefone, nome, contato, mensagens, negocios, podeEditar = false, movel = false,
  onInserir, onAgendar, onAbrirFicha, onAbrirOportunidade, onContatoMudou, onFechar,
}: {
  telefone: string
  nome: string
  contato: ContatoLead | null
  mensagens: MsgRaioX[]
  negocios: NegocioLead[]
  podeEditar?: boolean
  movel?: boolean
  onInserir: (texto: string) => void
  onAgendar?: () => void
  onAbrirFicha?: () => void
  onAbrirOportunidade?: () => void
  onContatoMudou?: () => void
  onFechar: () => void
}) {
  const [aba, setAba] = useState<Aba>('geral')
  const agora = new Date()

  // ---- Raio-X (puro, lib/raioXLead) ----
  const sit = useMemo(() => situacaoDaConversa(mensagens, agora), [mensagens])
  const temp = useMemo(() => temperatura(mensagens, agora), [mensagens])
  const resumo = useMemo(() => resumoConversa(mensagens, agora), [mensagens])

  // Catálogo de procedimentos: é o vocabulário que transforma "queria saber do
  // botox" em INTERESSE. Sem ele o raio-X adivinharia por palavra solta.
  const [procedimentos, setProcedimentos] = useState<string[]>([])
  useEffect(() => {
    fetch('/api/procedimentos').then(r => r.json())
      .then(d => setProcedimentos(Array.isArray(d?.procedimentos) ? d.procedimentos.map((p: any) => p.nome).filter(Boolean) : []))
      .catch(() => {})
  }, [])
  const interesses = useMemo(() => interessesNaConversa(mensagens, procedimentos), [mensagens, procedimentos])

  // ---- Assistente ----
  const [foco, setFoco] = useState('')
  const [pensando, setPensando] = useState(false)
  const [orientacao, setOrientacao] = useState<OrientacaoLead | null>(null)
  useEffect(() => { setOrientacao(null); setFoco(''); setAba('geral') }, [telefone])
  async function chamarAssistente() {
    if (pensando) return
    setPensando(true)
    const r = await fetch('/api/crm/assistente-lead', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefone, foco }),
    }).then(x => x.json()).catch(() => null)
    setPensando(false)
    if (r?.ok && r.orientacao) setOrientacao(r.orientacao)
    else toast(r?.error || 'Não foi possível falar com a Assistente.', 'erro')
  }

  // ---- Biblioteca de Vendas (o treinamento da casa) ----
  const [bib, setBib] = useState<BibliotecaVendas>(vazia())
  useEffect(() => {
    fetch('/api/crm/biblioteca').then(r => r.json()).then(d => { if (d && !d.error) setBib(d) }).catch(() => {})
  }, [])
  const inserir = (texto: string) => { onInserir(aplicarPlaceholders(texto, contato?.nome || nome)); toast('Mensagem no compositor — revise antes de enviar.', 'info') }

  // ---- Paciente: histórico de atendimentos ----
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([])
  useEffect(() => {
    if (!contato?.id) { setAtendimentos([]); return }
    fetch(`/api/agenda?contatoId=${encodeURIComponent(contato.id)}`).then(r => r.json())
      .then(d => setAtendimentos(Array.isArray(d?.agendamentos) ? d.agendamentos : []))
      .catch(() => {})
  }, [contato?.id])

  // ---- Financeiro: as oportunidades desta pessoa ----
  const meus = useMemo(() => negocios.filter(n => contato?.id && n.contatoId === contato.id), [negocios, contato?.id])
  const ganhos = meus.filter(n => n.status === 'ganho')
  const abertos = meus.filter(n => n.status === 'aberto')
  const perdidos = meus.filter(n => n.status === 'perdido')
  const totalGanho = ganhos.reduce((s, n) => s + (Number(n.valor) || 0), 0)
  const emAberto = abertos.reduce((s, n) => s + (Number(n.valor) || 0), 0)

  // ---- Próximo passo (lembrete + tarefa do comercial) ----
  const [novoPasso, setNovoPasso] = useState({ titulo: '', quando: hojeYmd() })
  const [salvandoPasso, setSalvandoPasso] = useState(false)
  async function agendarPasso() {
    if (!contato?.id || !novoPasso.titulo.trim() || salvandoPasso) return
    setSalvandoPasso(true)
    const r = await fetch('/api/crm/contatos', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contato.id, novoPasso: { titulo: novoPasso.titulo.trim(), quando: novoPasso.quando } }),
    }).then(x => x.json()).catch(() => null)
    setSalvandoPasso(false)
    if (!r?.ok) { toast(r?.error || 'Não foi possível agendar o follow-up.', 'erro'); return }
    setNovoPasso({ titulo: '', quando: hojeYmd() })
    toast('Follow-up agendado — vira tarefa e lembrete do comercial.', 'sucesso')
    onContatoMudou?.()
  }
  async function concluirPasso(id: string) {
    if (!contato?.id) return
    const r = await fetch('/api/crm/contatos', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contato.id, togglePasso: id }),
    }).then(x => x.json()).catch(() => null)
    if (r?.ok) onContatoMudou?.(); else toast('Não foi possível concluir.', 'erro')
  }

  const Selo = ({ texto, cor, fundo }: { texto: string; cor: string; fundo: string }) => (
    <span style={{ fontSize: 11, fontWeight: 800, color: cor, background: fundo, padding: '4px 10px', borderRadius: 999 }}>{texto}</span>
  )

  const passosAbertos = (contato?.proximosPassos || []).filter(p => !p.feito)

  return (
    <div style={{ width: movel ? '100%' : 330, borderLeft: movel ? 'none' : '1px solid var(--v2-surface2)', display: 'flex', flexDirection: 'column', flexShrink: 0, background: 'var(--v2-surface)', minWidth: 0 }}>
      {/* Cabeçalho + abas */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--v2-rule)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--v2-ink)' }}>Raio-X do lead</span>
        <span style={{ flex: 1 }} />
        <button onClick={onFechar} title="Fechar o painel" style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--v2-ink3)', cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
      </div>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--v2-rule)', flexShrink: 0 }}>
        {([['geral', 'Geral'], ['followup', 'Follow-up'], ['paciente', 'Paciente'], ['financeiro', 'Financeiro']] as [Aba, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setAba(k)}
            style={{ flex: 1, padding: '9px 2px', border: 'none', background: 'none', cursor: 'pointer', font: 'inherit', fontSize: 11.5, fontWeight: aba === k ? 800 : 600, color: aba === k ? 'var(--v2-ink)' : 'var(--v2-ink3)', borderBottom: `2px solid ${aba === k ? 'var(--v2-ink)' : 'transparent'}` }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* ---------------- GERAL (raio-X) ---------------- */}
        {aba === 'geral' && (<>
          <div style={secao}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <Selo texto={sit.label} cor={sit.cor} fundo={sit.fundo} />
              <Selo texto={temp.label} cor={temp.cor} fundo={temp.fundo} />
            </div>
            <p style={{ margin: 0, fontSize: 11.5, color: 'var(--v2-ink3)', lineHeight: 1.5 }}>{sit.detalhe}</p>
            <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'var(--v2-ink3)', lineHeight: 1.5 }}>{temp.motivo}</p>
          </div>

          <div style={{ ...secao, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><span style={rotulo}>Entrou em contato</span><span style={valor}>{dataHora(resumo.primeiroEm)}</span></div>
            <div><span style={rotulo}>Última mensagem</span><span style={valor}>{dataHora(resumo.ultimaEm)}</span></div>
            <div><span style={rotulo}>Quem falou por último</span><span style={valor}>{resumo.ultimaDe === 'cliente' ? (contato?.nome || nome || 'A pessoa') : resumo.ultimaDe === 'agente' ? 'Nós' : '—'}</span></div>
            <div><span style={rotulo}>Mensagens</span><span style={valor}>{resumo.total} <span style={{ fontWeight: 400, color: 'var(--v2-ink3)' }}>({resumo.doCliente} dela)</span></span></div>
          </div>

          <div style={secao}>
            <span style={rotulo}>Interesses (o que ela pediu)</span>
            {interesses.length === 0 ? (
              <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--v2-ink3)' }}>Nenhum procedimento do catálogo foi citado por ela ainda.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                {interesses.map(i => <span key={i} style={{ fontSize: 11.5, fontWeight: 700, color: '#3730a3', background: 'var(--v2-info-bg)', padding: '3px 9px', borderRadius: 999 }}>{i}</span>)}
              </div>
            )}
            {!!contato?.etiquetas?.length && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                {contato.etiquetas.map(e => <span key={e} style={{ fontSize: 11, fontWeight: 700, color: 'var(--v2-ink2)', background: 'var(--v2-surface1)', padding: '3px 9px', borderRadius: 999 }}>{e}</span>)}
              </div>
            )}
          </div>

          {/* ASSISTENTE — o método da casa aplicado a ESTA conversa */}
          <div style={secao}>
            <span style={rotulo}>Assistente</span>
            <p style={{ margin: '5px 0 8px', fontSize: 11.5, color: 'var(--v2-ink3)', lineHeight: 1.5 }}>Ela lê a conversa e responde pelo método da Biblioteca de Vendas — o treinamento que você escreveu.</p>
            <input value={foco} onChange={e => setFoco(e.target.value)} placeholder="Opcional: o que você precisa? (ex.: objeção de preço)"
              style={{ width: '100%', boxSizing: 'border-box', padding: '7px 9px', borderRadius: 8, border: '1px solid var(--v2-rule)', fontSize: 12, fontFamily: 'inherit', outline: 'none', marginBottom: 7 }} />
            <button onClick={chamarAssistente} disabled={pensando}
              style={{ width: '100%', padding: '9px 12px', background: pensando ? 'var(--v2-surface1)' : 'var(--v2-ink)', color: pensando ? 'var(--v2-ink3)' : 'var(--v2-surface)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 12.5, cursor: pensando ? 'wait' : 'pointer' }}>
              {pensando ? 'Lendo a conversa…' : orientacao ? 'Pedir de novo' : 'Pedir orientação'}
            </button>

            {orientacao && (
              <div style={{ marginTop: 10, background: 'var(--v2-surface1)', borderRadius: 12, padding: 11 }}>
                {orientacao.fase && <span style={{ fontSize: 10.5, fontWeight: 800, color: '#7c3aed', background: '#f5f3ff', padding: '2px 8px', borderRadius: 999 }}>{orientacao.fase}</span>}
                {orientacao.leitura && <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--v2-ink)', lineHeight: 1.5 }}>{orientacao.leitura}</p>}
                {orientacao.proximaAcao && (<>
                  <span style={{ ...rotulo, marginTop: 10 }}>Próxima ação</span>
                  <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--v2-ink)', fontWeight: 700, lineHeight: 1.45 }}>{orientacao.proximaAcao}</p>
                </>)}
                {orientacao.alertas.length > 0 && (
                  <ul style={{ margin: '8px 0 0', paddingLeft: 16 }}>
                    {orientacao.alertas.map((a, i) => <li key={i} style={{ fontSize: 11.5, color: 'var(--v2-amber)', lineHeight: 1.45 }}>{a}</li>)}
                  </ul>
                )}
                {orientacao.mensagem && (<>
                  <span style={{ ...rotulo, marginTop: 10 }}>Mensagem sugerida</span>
                  <p style={{ margin: '4px 0 8px', fontSize: 12, color: 'var(--v2-ink)', lineHeight: 1.5, whiteSpace: 'pre-wrap', background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 9, padding: 9 }}>{orientacao.mensagem}</p>
                  <button onClick={() => inserir(orientacao.mensagem)}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--marca, var(--v2-amber-on))', color: 'var(--marca-texto, var(--v2-ink))', border: 'none', borderRadius: 9, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
                    Usar esta mensagem
                  </button>
                  <p style={{ margin: '6px 0 0', fontSize: 10.5, color: 'var(--v2-ink3)', lineHeight: 1.4 }}>Ela vai para o compositor — leia e ajuste antes de enviar. Nada é enviado sozinho.</p>
                </>)}
              </div>
            )}
          </div>
        </>)}

        {/* ---------------- FOLLOW-UP ---------------- */}
        {aba === 'followup' && (<>
          <div style={secao}>
            <span style={rotulo}>Follow-up agendado</span>
            {!contato?.id ? (
              <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--v2-ink3)' }}>Vincule esta conversa a um contato para agendar follow-up.</p>
            ) : (<>
              {passosAbertos.length === 0 && <p style={{ margin: '6px 0 8px', fontSize: 11.5, color: 'var(--v2-ink3)' }}>Nenhum retorno marcado.</p>}
              {passosAbertos.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid var(--v2-surface1)' }}>
                  <button onClick={() => concluirPasso(p.id)} title="Marcar como feito"
                    style={{ width: 16, height: 16, borderRadius: 5, border: '1.5px solid #cbd5e1', background: 'var(--v2-surface)', cursor: 'pointer', flexShrink: 0, padding: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.titulo}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: p.quando <= hojeYmd() ? 'var(--v2-hot)' : 'var(--v2-ink3)' }}>{p.quando.split('-').reverse().slice(0, 2).join('/')}</span>
                </div>
              ))}
              {podeEditar && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <input value={novoPasso.titulo} onChange={e => setNovoPasso({ ...novoPasso, titulo: e.target.value })} placeholder="O que fazer (ex.: chamar de novo)"
                    style={{ flex: 1, minWidth: 0, padding: '7px 9px', borderRadius: 8, border: '1px solid var(--v2-rule)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
                  <input type="date" value={novoPasso.quando} onChange={e => setNovoPasso({ ...novoPasso, quando: e.target.value })}
                    style={{ width: 118, padding: '7px 6px', borderRadius: 8, border: '1px solid var(--v2-rule)', fontSize: 11.5, fontFamily: 'inherit', outline: 'none' }} />
                  <button onClick={agendarPasso} disabled={salvandoPasso || !novoPasso.titulo.trim()}
                    style={{ padding: '7px 11px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: 'pointer', opacity: novoPasso.titulo.trim() ? 1 : 0.4 }}>+</button>
                </div>
              )}
            </>)}
          </div>

          {/* Textos prontos — vêm da Biblioteca de Vendas, não daqui. Mudar o
              script é editar a Biblioteca (aba Playbook), sem deploy. */}
          {bib.cadencias.map(c => (
            <div key={c.id} style={secao}>
              <span style={rotulo}>{c.nome}</span>
              {c.descricao && <p style={{ margin: '3px 0 7px', fontSize: 11, color: 'var(--v2-ink3)' }}>{c.descricao}</p>}
              {c.mensagens.map(m => {
                const fase = FASES.find(f => f.key === m.fase)
                return (
                  <button key={m.id} onClick={() => inserir(m.texto)} title="Colocar no compositor" style={botaoTexto}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {fase && <span style={{ fontSize: 9.5, fontWeight: 800, color: fase.cor }}>{fase.label.toUpperCase()}</span>}
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--v2-ink)' }}>{m.titulo}</span>
                    </span>
                    {m.contexto && <span style={{ display: 'block', fontSize: 10.5, color: 'var(--v2-ink3)', marginTop: 2 }}>{m.contexto}</span>}
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--v2-ink2)', marginTop: 4, lineHeight: 1.45, maxHeight: 46, overflow: 'hidden' }}>{aplicarPlaceholders(m.texto, contato?.nome || nome)}</span>
                  </button>
                )
              })}
            </div>
          ))}

          {[...bib.reaquecimento.leads, ...bib.reaquecimento.clientes].length > 0 && (
            <div style={secao}>
              <span style={rotulo}>Reaquecimento</span>
              {[...bib.reaquecimento.leads, ...bib.reaquecimento.clientes].map(s => (
                <div key={s.id} style={{ marginTop: 7 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--v2-ink)' }}>{s.nome}</span>
                  {s.quando && <span style={{ display: 'block', fontSize: 10.5, color: 'var(--v2-ink3)', margin: '1px 0 5px' }}>{s.quando}</span>}
                  {s.mensagens.map(m => (
                    <button key={m.id} onClick={() => inserir(m.texto)} title="Colocar no compositor" style={botaoTexto}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--v2-ink)' }}>{m.titulo}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--v2-ink2)', marginTop: 3, lineHeight: 1.45, maxHeight: 46, overflow: 'hidden' }}>{aplicarPlaceholders(m.texto, contato?.nome || nome)}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {bib.objecoes.length > 0 && (
            <div style={secao}>
              <span style={rotulo}>Objeções</span>
              {bib.objecoes.map(cat => (
                <details key={cat.id} style={{ marginTop: 7 }}>
                  <summary style={{ fontSize: 12, fontWeight: 700, color: 'var(--v2-ink)', cursor: 'pointer' }}>{cat.nome} <span style={{ color: 'var(--v2-ink3)', fontWeight: 600 }}>({cat.respostas.length})</span></summary>
                  <div style={{ marginTop: 6 }}>
                    {cat.respostas.map(r => (
                      <button key={r.id} onClick={() => inserir(r.texto)} title="Colocar no compositor" style={botaoTexto}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--v2-ink)' }}>{r.titulo}</span>
                        {r.contexto && <span style={{ display: 'block', fontSize: 10.5, color: 'var(--v2-ink3)', marginTop: 2 }}>{r.contexto}</span>}
                        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--v2-ink2)', marginTop: 3, lineHeight: 1.45, maxHeight: 46, overflow: 'hidden' }}>{aplicarPlaceholders(r.texto, contato?.nome || nome)}</span>
                      </button>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}

          {bib.cadencias.length === 0 && bib.objecoes.length === 0 && (
            <div style={secao}>
              <p style={{ margin: 0, fontSize: 11.5, color: 'var(--v2-ink3)', lineHeight: 1.5 }}>A Biblioteca de Vendas ainda está vazia. Preencha em CRM → Playbook e os textos aparecem aqui, prontos para usar na conversa.</p>
            </div>
          )}
        </>)}

        {/* ---------------- PACIENTE ---------------- */}
        {aba === 'paciente' && (<>
          {!contato ? (
            <div style={secao}>
              <p style={{ margin: 0, fontSize: 11.5, color: 'var(--v2-ink3)', lineHeight: 1.5 }}>Esta conversa ainda não está vinculada a um contato. Use “Vincular contato” no topo para abrir a ficha da paciente aqui.</p>
            </div>
          ) : (<>
            <div style={{ ...secao, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><span style={rotulo}>Nome</span><span style={valor}>{contato.nome}</span></div>
              <div><span style={rotulo}>Telefone</span><span style={valor}>{contato.telefone || '—'}</span></div>
              <div><span style={rotulo}>Tipo</span><span style={valor}>{contato.tipo || '—'}</span></div>
              <div><span style={rotulo}>Nascimento</span><span style={valor}>{contato.nascimento ? dataBr(contato.nascimento) : '—'}</span></div>
              <div><span style={rotulo}>Situação</span><span style={valor}>{contato.ativo === false ? 'Inativa' : 'Ativa'}</span></div>
              <div><span style={rotulo}>Último procedimento</span><span style={valor}>{contato.ultimoProcedimento || '—'}</span></div>
            </div>
            {contato.observacoes && (
              <div style={secao}><span style={rotulo}>Observações</span><p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--v2-ink2)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{contato.observacoes}</p></div>
            )}
            <div style={secao}>
              <span style={rotulo}>Atendimentos ({atendimentos.length})</span>
              {atendimentos.length === 0 && <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--v2-ink3)' }}>Nenhum atendimento registrado.</p>}
              {atendimentos.slice(0, 12).map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid var(--v2-surface1)' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--v2-ink3)', flexShrink: 0, minWidth: 42 }}>{dataBr(a.dataInicio).slice(0, 5)}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.servico || 'Atendimento'}{a.profissionalNome ? ` · ${a.profissionalNome}` : ''}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: a.status === 'atendido' ? 'var(--v2-ok)' : a.status === 'cancelado' ? 'var(--v2-hot)' : 'var(--v2-amber)', flexShrink: 0 }}>{a.status}</span>
                </div>
              ))}
            </div>
            <div style={{ ...secao, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {onAbrirFicha && <button onClick={onAbrirFicha} style={{ flex: 1, padding: '9px 10px', background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 9, fontWeight: 700, fontSize: 12, cursor: 'pointer', color: 'var(--v2-ink)' }}>Abrir ficha completa</button>}
              {onAgendar && <button onClick={onAgendar} style={{ flex: 1, padding: '9px 10px', background: 'var(--marca, var(--v2-amber-on))', color: 'var(--marca-texto, var(--v2-ink))', border: 'none', borderRadius: 9, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>Agendar</button>}
            </div>
          </>)}
        </>)}

        {/* ---------------- FINANCEIRO ---------------- */}
        {aba === 'financeiro' && (<>
          {!contato ? (
            <div style={secao}><p style={{ margin: 0, fontSize: 11.5, color: 'var(--v2-ink3)', lineHeight: 1.5 }}>Vincule a conversa a um contato para ver as oportunidades e os valores desta pessoa.</p></div>
          ) : (<>
            <div style={{ ...secao, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><span style={rotulo}>Já fechou</span><span style={{ ...valor, color: 'var(--v2-ok)', fontSize: 15, fontWeight: 800 }}>{brl(totalGanho)}</span></div>
              <div><span style={rotulo}>Em aberto</span><span style={{ ...valor, color: 'var(--v2-ink)', fontSize: 15, fontWeight: 800 }}>{brl(emAberto)}</span></div>
              <div><span style={rotulo}>Oportunidades</span><span style={valor}>{meus.length}</span></div>
              <div><span style={rotulo}>Perdidas</span><span style={valor}>{perdidos.length}</span></div>
            </div>
            <div style={secao}>
              <span style={rotulo}>Oportunidades desta pessoa</span>
              {meus.length === 0 && <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--v2-ink3)' }}>Nenhuma oportunidade ainda.</p>}
              {meus.map(n => (
                <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: '1px solid var(--v2-surface1)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: n.status === 'ganho' ? 'var(--v2-ok)' : n.status === 'perdido' ? 'var(--v2-hot)' : 'var(--v2-amber-on)', flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.titulo || 'Oportunidade'}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--v2-ink)', flexShrink: 0 }}>{brl(Number(n.valor) || 0)}</span>
                </div>
              ))}
            </div>
            {onAbrirOportunidade && (
              <div style={secao}>
                <button onClick={onAbrirOportunidade} style={{ width: '100%', padding: '9px 10px', background: 'var(--marca, var(--v2-amber-on))', color: 'var(--marca-texto, var(--v2-ink))', border: 'none', borderRadius: 9, fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>Nova oportunidade</button>
              </div>
            )}
          </>)}
        </>)}
      </div>
    </div>
  )
}
