'use client'
import { useEffect, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'
import { fecharFora } from '@/lib/fecharModal'
import { removerEtapaDoModelo, moverEtapaDoModelo, moverNaLista, duracaoDaEtapa, UNIDADES, type EtapaPlanejada, type UnidadeDuracao } from '@/lib/aplicarModelo'
import { sugestoesParaPerfil, type ModeloSugerido } from '@/lib/modelosSugeridos'

type Cliente = { id: string; nome: string; tipo?: string }
type TMarco = { titulo: string; categoria: string; descricao?: string; diasDuracao?: number; duracao?: number; unidade?: UnidadeDuracao }
type TTarefa = { titulo: string; tipo?: string; prioridade?: string; marcoIndice?: number }
type Template = { id: string; nome: string; descricao?: string; marcos: TMarco[]; tarefas: TTarefa[] }

const CATEGORIAS = [
  { key: 'social_media', label: 'Social Media' }, { key: 'trafego', label: 'Tráfego pago' }, { key: 'branding', label: 'Branding' },
  { key: 'landing_page', label: 'Landing Page' }, { key: 'estrategia', label: 'Estratégia' }, { key: 'reuniao', label: 'Reunião' },
  { key: 'entrega', label: 'Entrega' }, { key: 'outro', label: 'Outro' },
]
const TIPOS = ['tarefa', 'carrossel', 'criativo', 'video', 'reel', 'story', 'post', 'estrategia', 'planejamento']
const PRIORIDADES = ['baixa', 'media', 'alta', 'urgente']
const vazio: Template = { id: '', nome: '', descricao: '', marcos: [], tarefas: [] }

// Setas de reordenar. SVG, não caractere — a régua da casa é ícone, não emoji.
function Mover({ onSubir, onDescer, primeiro, ultimo }: { onSubir: () => void; onDescer: () => void; primeiro: boolean; ultimo: boolean }) {
  const bt = (ativo: boolean): React.CSSProperties => ({
    background: 'none', border: 'none', padding: '1px 2px', lineHeight: 0,
    color: ativo ? '#999' : '#e8e8e8', cursor: ativo ? 'pointer' : 'default',
  })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <button type="button" onClick={onSubir} disabled={primeiro} title="Subir" style={bt(!primeiro)}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
      </button>
      <button type="button" onClick={onDescer} disabled={ultimo} title="Descer" style={bt(!ultimo)}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
    </div>
  )
}

export default function Modelos({ clientes, podeEditar = true, podeExcluir = true, perfil = null }: { clientes: Cliente[]; podeEditar?: boolean; podeExcluir?: boolean; perfil?: string | null }) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [editor, setEditor] = useState<Template | null>(null)
  const [aplicar, setAplicar] = useState<Template | null>(null)
  const [msg, setMsg] = useState('')
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)
  const sugestoes = sugestoesParaPerfil(perfil)

  // Sugestão vai para o EDITOR, não para o banco: id vazio = ainda não existe,
  // e só o "Salvar modelo" grava. Assim o ponto de partida é ajustável antes de
  // virar dado — seed é começo de conversa, não decisão tomada por ninguém.
  const usarSugestao = (s: ModeloSugerido) => setEditor({
    id: '', nome: s.nome, descricao: s.descricao,
    marcos: s.marcos.map(m => ({ ...m, categoria: m.categoria || 'outro' })),
    tarefas: s.tarefas.map(t => ({ ...t })),
  })

  function carregar() { fetch('/api/templates').then(r => r.json()).then(d => setTemplates(Array.isArray(d) ? d : [])).catch(() => {}) }
  useEffect(() => { carregar() }, [])

  async function salvar() {
    if (!editor || !editor.nome.trim()) return
    const metodo = editor.id ? 'PUT' : 'POST'
    const r = await fetch('/api/templates', { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editor) }).then(x => x.json()).catch(() => null)
    if (r?.ok) { setEditor(null); carregar() } else toast('Não foi possível salvar o modelo.', 'erro')
  }
  async function excluir(id: string) {
    if (!(await confirmar('Excluir este modelo?', { titulo: 'Excluir modelo', okLabel: 'Excluir', perigo: true }))) return
    await fetch(`/api/templates?id=${id}`, { method: 'DELETE' }).catch(() => {})
    carregar()
  }

  const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }
  const card: React.CSSProperties = { background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }

  return (
    <div style={{ maxWidth: 880 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Modelos de projeto</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#999' }}>Crie um modelo de etapas + tarefas e aplique a vários clientes de uma vez, com prévia antes de gravar.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {podeEditar && sugestoes.length > 0 && templates.length > 0 && (
            <button onClick={() => setMostrarSugestoes(v => !v)} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', padding: 0 }}>
              {mostrarSugestoes ? 'Ocultar modelos prontos' : 'Modelos prontos'}
            </button>
          )}
          {podeEditar && <button onClick={() => setEditor({ ...vazio })} style={{ padding: '10px 18px', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Novo modelo</button>}
        </div>
      </div>

      {msg && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', fontSize: 13 }}>{msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {templates.map(t => (
          <div key={t.id} style={card}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111' }}>{t.nome}</p>
            {t.descricao && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>{t.descricao}</p>}
            <p style={{ margin: '10px 0 12px', fontSize: 12, color: '#aaa' }}>{(t.marcos || []).length} etapa(s) · {(t.tarefas || []).length} tarefa(s)</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {podeEditar && <button onClick={() => setAplicar(t)} style={{ flex: 1, padding: '8px 0', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Aplicar a clientes</button>}
              {podeEditar && <button onClick={() => setEditor(JSON.parse(JSON.stringify(t)))} style={{ padding: '8px 12px', background: '#f5f5f5', color: '#444', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Editar</button>}
              {podeExcluir && <button onClick={() => excluir(t.id)} style={{ padding: '8px 10px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>×</button>}
            </div>
          </div>
        ))}
      </div>

      {/* Tela vazia: em vez de "crie o primeiro" e um editor em branco, os
          pontos de partida prontos. Montar 6 etapas na mão é justamente o
          trabalho que o modelo existe para evitar. */}
      {(templates.length === 0 || mostrarSugestoes) && (
        podeEditar && sugestoes.length > 0 ? (
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#111' }}>Comece de um modelo pronto</p>
            <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#999' }}>Abre no editor já preenchido. Ajuste o que quiser — nada é salvo até você clicar em "Salvar modelo".</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {sugestoes.map(s => (
                <button key={s.chave} onClick={() => usarSugestao(s)} style={{ ...card, textAlign: 'left', border: '1.5px dashed #e0e0e0', boxShadow: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111' }}>{s.nome}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>{s.descricao}</p>
                  <p style={{ margin: '10px 0 0', fontSize: 12, color: '#aaa' }}>{s.marcos.length} etapa(s) · {s.tarefas.length} tarefa(s)</p>
                </button>
              ))}
            </div>
          </div>
        ) : templates.length === 0 ? <p style={{ color: '#bbb', fontSize: 13 }}>Nenhum modelo ainda.{podeEditar ? ' Crie o primeiro.' : ''}</p> : null
      )}

      {/* Editor */}
      {editor && (
        <div onClick={fecharFora(() => setEditor(null))} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: 20, overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680, padding: 22, margin: '20px 0' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, color: '#111' }}>{editor.id ? 'Editar modelo' : 'Novo modelo'}</h3>
            <input value={editor.nome} onChange={e => setEditor({ ...editor, nome: e.target.value })} placeholder="Nome do modelo (ex.: Onboarding Social Media)" style={{ ...inp, width: '100%', marginBottom: 8 }} />
            <input value={editor.descricao || ''} onChange={e => setEditor({ ...editor, descricao: e.target.value })} placeholder="Descrição (opcional)" style={{ ...inp, width: '100%', marginBottom: 16 }} />

            {/* Etapas */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Etapas do Playbook</span>
              <button onClick={() => setEditor({ ...editor, marcos: [...editor.marcos, { titulo: '', categoria: 'social_media', duracao: 1, unidade: 'semanas' }] })} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ Etapa</button>
            </div>
            {editor.marcos.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                {/* Reordenar remapeia o vínculo das tarefas (moverEtapaDoModelo):
                    trocar duas etapas de lugar sem isso não deixa tarefa órfã —
                    deixa a tarefa certa embaixo da etapa errada, em silêncio. */}
                <Mover primeiro={i === 0} ultimo={i === editor.marcos.length - 1}
                  onSubir={() => setEditor({ ...editor, ...moverEtapaDoModelo(editor, i, i - 1) })}
                  onDescer={() => setEditor({ ...editor, ...moverEtapaDoModelo(editor, i, i + 1) })} />
                <input value={m.titulo} onChange={e => { const ms = [...editor.marcos]; ms[i] = { ...m, titulo: e.target.value }; setEditor({ ...editor, marcos: ms }) }} placeholder={`Etapa ${i + 1}`} style={{ ...inp, flex: 1 }} />
                <select value={m.categoria} onChange={e => { const ms = [...editor.marcos]; ms[i] = { ...m, categoria: e.target.value }; setEditor({ ...editor, marcos: ms }) }} style={{ ...inp, background: '#fff' }}>
                  {CATEGORIAS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
                {/* Duração = número + UNIDADE. O campo era só um número, e "7"
                    sozinho não diz se é dia, semana ou mês — o placeholder
                    "dias" sumia no instante em que alguém digitava. Ao salvar
                    grava-se `duracao`+`unidade`; `diasDuracao` fica só na
                    leitura dos modelos antigos (duracaoDaEtapa). */}
                <input type="number" min="0" value={duracaoDaEtapa(m).quantidade || ''} onChange={e => { const ms = [...editor.marcos]; ms[i] = { ...m, duracao: Math.max(0, Number(e.target.value) || 0), unidade: duracaoDaEtapa(m).unidade }; setEditor({ ...editor, marcos: ms }) }} placeholder="0" style={{ ...inp, width: 56 }} />
                <select value={duracaoDaEtapa(m).unidade} onChange={e => { const ms = [...editor.marcos]; ms[i] = { ...m, duracao: duracaoDaEtapa(m).quantidade, unidade: e.target.value as UnidadeDuracao }; setEditor({ ...editor, marcos: ms }) }} style={{ ...inp, background: '#fff', width: 96 }}>
                  {UNIDADES.map(u => <option key={u.chave} value={u.chave}>{u.label}</option>)}
                </select>
                {/* Remoção com REINDEXAÇÃO (lib/aplicarModelo): desvincular só as
                    tarefas desta etapa deixava as de baixo apontando para a etapa
                    vizinha, calado. Vínculo tarefa->etapa é posicional. */}
                <button onClick={() => setEditor({ ...editor, ...removerEtapaDoModelo(editor, i) })} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            ))}

            {/* Tarefas */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 8px' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Tarefas</span>
              <button onClick={() => setEditor({ ...editor, tarefas: [...editor.tarefas, { titulo: '', tipo: 'tarefa', prioridade: 'media' }] })} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ Tarefa</button>
            </div>
            {editor.tarefas.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                {/* Tarefa é ordem de exibição pura: nada aponta para a posição
                    dela, então mover é só trocar de lugar na lista. */}
                <Mover primeiro={i === 0} ultimo={i === editor.tarefas.length - 1}
                  onSubir={() => setEditor({ ...editor, tarefas: moverNaLista(editor.tarefas, i, i - 1) })}
                  onDescer={() => setEditor({ ...editor, tarefas: moverNaLista(editor.tarefas, i, i + 1) })} />
                <input value={t.titulo} onChange={e => { const ts = [...editor.tarefas]; ts[i] = { ...t, titulo: e.target.value }; setEditor({ ...editor, tarefas: ts }) }} placeholder={`Tarefa ${i + 1}`} style={{ ...inp, flex: 1 }} />
                <select value={t.tipo} onChange={e => { const ts = [...editor.tarefas]; ts[i] = { ...t, tipo: e.target.value }; setEditor({ ...editor, tarefas: ts }) }} style={{ ...inp, background: '#fff' }}>
                  {TIPOS.map(tp => <option key={tp} value={tp}>{tp}</option>)}
                </select>
                <select value={t.prioridade} onChange={e => { const ts = [...editor.tarefas]; ts[i] = { ...t, prioridade: e.target.value }; setEditor({ ...editor, tarefas: ts }) }} style={{ ...inp, background: '#fff' }}>
                  {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={t.marcoIndice ?? ''} onChange={e => { const ts = [...editor.tarefas]; ts[i] = { ...t, marcoIndice: e.target.value === '' ? undefined : Number(e.target.value) }; setEditor({ ...editor, tarefas: ts }) }} style={{ ...inp, background: '#fff', maxWidth: 130 }}>
                  <option value="">Sem etapa</option>
                  {editor.marcos.map((m, j) => <option key={j} value={j}>{m.titulo || `Etapa ${j + 1}`}</option>)}
                </select>
                <button onClick={() => setEditor({ ...editor, tarefas: editor.tarefas.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button onClick={salvar} disabled={!editor.nome.trim()} style={{ flex: 1, padding: '11px 0', background: editor.nome.trim() ? '#ffc00f' : '#f0f0f0', color: editor.nome.trim() ? '#111' : '#aaa', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Salvar modelo</button>
              <button onClick={() => setEditor(null)} style={{ padding: '11px 18px', background: '#f5f5f5', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Aplicar */}
      {aplicar && <AplicarModal template={aplicar} clientes={clientes} onClose={() => setAplicar(null)} onOk={(r) => {
        const nomes = (r.aplicados || []).map(a => a.nome)
        setAplicar(null)
        setMsg(`Modelo "${aplicar.nome}" aplicado a ${nomes.length || 1} cliente(s): ${r.marcos} etapa(s) e ${r.tarefas} tarefa(s) criadas.${nomes.length ? ` (${nomes.join(', ')})` : ''}`)
        setTimeout(() => setMsg(''), 12000)
      }} />}
    </div>
  )
}

type Alvo = { id: string; nome: string; etapasAtuais: number }
type Previa = { modelo: string; etapas: EtapaPlanejada[]; tarefas: { titulo: string }[]; alvos: Alvo[] }

const dataBR = (iso: string) => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : ''

// MUTIRÃO: aplica o modelo a VÁRIOS clientes, com prévia obrigatória antes de gravar.
// A prévia não é enfeite — aplicar num cliente que já tem etapas DUPLICA o Playbook
// dele, e etapa duplicada só aparece depois, no Gantt. Por isso o alerta é na cara.
function AplicarModal({ template, clientes, onClose, onOk }: { template: Template; clientes: Cliente[]; onClose: () => void; onOk: (r: { marcos: number; tarefas: number; aplicados?: { nome: string }[] }) => void }) {
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10))
  const [etapasPorCliente, setEtapasPorCliente] = useState<Record<string, number>>({})
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const elegiveis = [...clientes].filter(c => c.tipo !== 'interno').sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))

  // Quem já tem Playbook. Um GET traz os marcos da base inteira (não há índice
  // por cliente) — é a mesma chamada que a home do dashboard já faz.
  useEffect(() => {
    fetch('/api/playbook').then(r => r.json()).then((ms: any[]) => {
      if (!Array.isArray(ms)) return
      const cont: Record<string, number> = {}
      for (const m of ms) if (m?.clienteId) cont[m.clienteId] = (cont[m.clienteId] || 0) + 1
      setEtapasPorCliente(cont)
    }).catch(() => {})
  }, [])

  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const semEtapas = elegiveis.filter(c => !etapasPorCliente[c.id])
  const selecionarSemEtapas = () => setSel(new Set(semEtapas.map(c => c.id)))
  const comEtapasSelecionados = Array.from(sel).filter(id => etapasPorCliente[id]).length

  async function pedir(preview: boolean) {
    if (!sel.size || ocupado) return
    setOcupado(true)
    const r = await fetch('/api/templates/aplicar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: template.id, clienteIds: Array.from(sel), dataInicio, preview }),
    }).then(x => x.json()).catch(() => null)
    setOcupado(false)
    if (!r?.ok) { toast('Não foi possível ' + (preview ? 'gerar a prévia' : 'aplicar') + ': ' + (r?.error || 'erro'), 'erro'); return }
    if (preview) setPrevia(r); else onOk(r)
  }

  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff' }
  const linkBt: React.CSSProperties = { background: 'none', border: 'none', color: '#2563eb', fontWeight: 700, fontSize: 12, cursor: 'pointer', padding: 0 }

  return (
    <div onClick={fecharFora(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1100, padding: 20, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, padding: 22, margin: '20px 0' }}>

        {!previa ? (<>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#111' }}>Aplicar modelo</h3>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#888' }}>"{template.nome}" — {(template.marcos || []).length} etapa(s) e {(template.tarefas || []).length} tarefa(s) por cliente.</p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#888' }}>Clientes {sel.size > 0 && <span style={{ color: '#111' }}>· {sel.size} selecionado(s)</span>}</label>
            <div style={{ display: 'flex', gap: 12 }}>
              {semEtapas.length > 0 && <button onClick={selecionarSemEtapas} style={linkBt}>Todos sem etapas ({semEtapas.length})</button>}
              {sel.size > 0 && <button onClick={() => setSel(new Set())} style={{ ...linkBt, color: '#999' }}>Limpar</button>}
            </div>
          </div>

          <div style={{ maxHeight: 260, overflowY: 'auto', border: '1.5px solid #eee', borderRadius: 10, marginBottom: 12 }}>
            {elegiveis.map(c => {
              const n = etapasPorCliente[c.id] || 0
              return (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} style={{ cursor: 'pointer' }} />
                  <span style={{ flex: 1, color: '#111' }}>{c.nome}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap', color: n ? '#166534' : '#b45309', background: n ? '#f0fdf4' : '#fffbeb' }}>
                    {n ? `${n} etapa${n > 1 ? 's' : ''}` : 'Sem etapas'}
                  </span>
                </label>
              )
            })}
            {elegiveis.length === 0 && <p style={{ margin: 0, padding: 16, fontSize: 13, color: '#bbb' }}>Nenhum cliente.</p>}
          </div>

          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Data de início</label>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={{ ...inp, marginBottom: 18 }} />

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => pedir(true)} disabled={!sel.size || ocupado} style={{ flex: 1, padding: '11px 0', background: sel.size ? '#111' : '#f0f0f0', color: sel.size ? '#fff' : '#aaa', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: sel.size ? 'pointer' : 'default' }}>{ocupado ? 'Gerando prévia...' : 'Ver prévia'}</button>
            <button onClick={onClose} style={{ padding: '11px 18px', background: '#f5f5f5', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </>) : (<>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#111' }}>Confira antes de aplicar</h3>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: '#888' }}>Nada foi criado ainda. Isto é o que vai ser gravado em cada um dos {previa.alvos.length} cliente(s).</p>

          {comEtapasSelecionados > 0 && (
            <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: 12.5 }}>
              <strong>{comEtapasSelecionados} cliente(s) já têm etapas no Playbook.</strong> Aplicar de novo SOMA as etapas do modelo às que já existem — não substitui. Desmarque quem não deve receber.
            </div>
          )}

          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#888' }}>Etapas que serão criadas</p>
          <div style={{ border: '1.5px solid #eee', borderRadius: 10, marginBottom: 14 }}>
            {previa.etapas.map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: i < previa.etapas.length - 1 ? '1px solid #f5f5f5' : 'none', fontSize: 13 }}>
                <span style={{ color: '#ccc', fontSize: 11, fontWeight: 800, width: 16 }}>{i + 1}</span>
                <span style={{ flex: 1, color: '#111' }}>{e.titulo || <em style={{ color: '#c00' }}>sem título</em>}</span>
                <span style={{ fontSize: 11.5, color: '#888', whiteSpace: 'nowrap' }}>
                  {dataBR(e.dataInicio)}{e.dataFim ? ` — ${dataBR(e.dataFim)}` : ' · marco pontual'}
                </span>
              </div>
            ))}
            {previa.etapas.length === 0 && <p style={{ margin: 0, padding: 14, fontSize: 12.5, color: '#c00' }}>Este modelo não tem nenhuma etapa. Termine o rascunho antes de aplicar.</p>}
          </div>

          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#888' }}>Vai para</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
            {previa.alvos.map(a => (
              <span key={a.id} style={{ fontSize: 12, borderRadius: 999, padding: '4px 11px', background: a.etapasAtuais ? '#fffbeb' : '#f5f5f5', border: a.etapasAtuais ? '1px solid #fde68a' : '1px solid #eee', color: '#333' }}>
                {a.nome}{a.etapasAtuais ? ` · já tem ${a.etapasAtuais}` : ''}
              </span>
            ))}
          </div>

          <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#666' }}>
            Total: <strong>{previa.etapas.length * previa.alvos.length} etapa(s)</strong> e <strong>{previa.tarefas.length * previa.alvos.length} tarefa(s)</strong>.
          </p>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => pedir(false)} disabled={ocupado || previa.etapas.length === 0} style={{ flex: 1, padding: '11px 0', background: previa.etapas.length ? '#111' : '#f0f0f0', color: previa.etapas.length ? '#fff' : '#aaa', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: previa.etapas.length ? 'pointer' : 'default' }}>{ocupado ? 'Aplicando...' : `Aplicar a ${previa.alvos.length} cliente(s)`}</button>
            <button onClick={() => setPrevia(null)} style={{ padding: '11px 18px', background: '#f5f5f5', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Voltar</button>
          </div>
        </>)}
      </div>
    </div>
  )
}
