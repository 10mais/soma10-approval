'use client'
import { useEffect, useState } from 'react'
import { toast, confirmar } from '@/lib/toast'
import { fecharFora } from '@/lib/fecharModal'
import { removerEtapaDoModelo, moverEtapaDoModelo, moverNaLista, duracaoDaEtapa, atribuirResponsavelNaEtapa, UNIDADES, type EtapaPlanejada, type UnidadeDuracao } from '@/lib/aplicarModelo'
import { sugestoesParaPerfil, type ModeloSugerido } from '@/lib/modelosSugeridos'
import AplicarModal from './AplicarModelo'

type Cliente = { id: string; nome: string; tipo?: string }
type Usuario = { email: string; nome?: string; role?: string }
type TMarco = { titulo: string; categoria: string; descricao?: string; diasDuracao?: number; duracao?: number; unidade?: UnidadeDuracao; responsavelEmail?: string }
type TTarefa = { titulo: string; tipo?: string; prioridade?: string; marcoIndice?: number; responsavelEmail?: string }
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
    color: ativo ? 'var(--v2-ink3)' : 'var(--v2-surface2)', cursor: ativo ? 'pointer' : 'default',
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

export default function Modelos({ clientes, usuarios = [], podeEditar = true, podeExcluir = true, perfil = null }: { clientes: Cliente[]; usuarios?: Usuario[]; podeEditar?: boolean; podeExcluir?: boolean; perfil?: string | null }) {
  const equipe = usuarios.filter(u => u.role !== 'cliente')
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

  const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }
  const card: React.CSSProperties = { background: 'var(--v2-surface)', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }

  return (
    <div style={{ maxWidth: 880 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, color: 'var(--v2-ink)' }}>Modelos de projeto</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--v2-ink3)' }}>Crie um modelo de etapas + tarefas e aplique a vários clientes de uma vez, com prévia antes de gravar.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {podeEditar && sugestoes.length > 0 && templates.length > 0 && (
            <button onClick={() => setMostrarSugestoes(v => !v)} style={{ background: 'none', border: 'none', color: 'var(--v2-info)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', padding: 0 }}>
              {mostrarSugestoes ? 'Ocultar modelos prontos' : 'Modelos prontos'}
            </button>
          )}
          {podeEditar && <button onClick={() => setEditor({ ...vazio })} style={{ padding: '10px 18px', background: 'var(--v2-amber-on)', color: '#17150E', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Novo modelo</button>}
        </div>
      </div>

      {msg && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: 'var(--v2-ok-bg)', border: '1px solid var(--v2-ok-bg)', color: 'var(--v2-ok)', fontSize: 13 }}>{msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {templates.map(t => (
          <div key={t.id} style={card}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--v2-ink)' }}>{t.nome}</p>
            {t.descricao && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--v2-ink3)' }}>{t.descricao}</p>}
            <p style={{ margin: '10px 0 12px', fontSize: 12, color: 'var(--v2-ink3)' }}>{(t.marcos || []).length} etapa(s) · {(t.tarefas || []).length} tarefa(s)</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {podeEditar && <button onClick={() => setAplicar(t)} style={{ flex: 1, padding: '8px 0', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Aplicar a clientes</button>}
              {podeEditar && <button onClick={() => setEditor(JSON.parse(JSON.stringify(t)))} style={{ padding: '8px 12px', background: 'var(--v2-surface1)', color: 'var(--v2-ink2)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Editar</button>}
              {podeExcluir && <button onClick={() => excluir(t.id)} style={{ padding: '8px 10px', background: 'var(--v2-surface)', color: 'var(--v2-hot)', border: '1px solid var(--v2-hot-bg)', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>×</button>}
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
            <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: 'var(--v2-ink)' }}>Comece de um modelo pronto</p>
            <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--v2-ink3)' }}>Abre no editor já preenchido. Ajuste o que quiser — nada é salvo até você clicar em "Salvar modelo".</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {sugestoes.map(s => (
                <button key={s.chave} onClick={() => usarSugestao(s)} style={{ ...card, textAlign: 'left', border: '1.5px dashed var(--v2-rule)', boxShadow: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--v2-ink)' }}>{s.nome}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--v2-ink3)' }}>{s.descricao}</p>
                  <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--v2-ink3)' }}>{s.marcos.length} etapa(s) · {s.tarefas.length} tarefa(s)</p>
                </button>
              ))}
            </div>
          </div>
        ) : templates.length === 0 ? <p style={{ color: 'var(--v2-ink3)', fontSize: 13 }}>Nenhum modelo ainda.{podeEditar ? ' Crie o primeiro.' : ''}</p> : null
      )}

      {/* Editor */}
      {editor && (
        <div onClick={fecharFora(() => setEditor(null))} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: 20, overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v2-surface)', borderRadius: 16, width: '100%', maxWidth: 860, padding: 22, margin: '20px 0' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 16, color: 'var(--v2-ink)' }}>{editor.id ? 'Editar modelo' : 'Novo modelo'}</h3>
            <input value={editor.nome} onChange={e => setEditor({ ...editor, nome: e.target.value })} placeholder="Nome do modelo (ex.: Onboarding Social Media)" style={{ ...inp, width: '100%', marginBottom: 8 }} />
            <input value={editor.descricao || ''} onChange={e => setEditor({ ...editor, descricao: e.target.value })} placeholder="Descrição (opcional)" style={{ ...inp, width: '100%', marginBottom: 16 }} />

            {/* Etapas */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--v2-ink)' }}>Etapas do Playbook</span>
              <button onClick={() => setEditor({ ...editor, marcos: [...editor.marcos, { titulo: '', categoria: 'social_media', duracao: 1, unidade: 'semanas' }] })} style={{ background: 'none', border: 'none', color: 'var(--v2-info)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ Etapa</button>
            </div>
            {editor.marcos.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Reordenar remapeia o vínculo das tarefas (moverEtapaDoModelo):
                    trocar duas etapas de lugar sem isso não deixa tarefa órfã —
                    deixa a tarefa certa embaixo da etapa errada, em silêncio. */}
                <Mover primeiro={i === 0} ultimo={i === editor.marcos.length - 1}
                  onSubir={() => setEditor({ ...editor, ...moverEtapaDoModelo(editor, i, i - 1) })}
                  onDescer={() => setEditor({ ...editor, ...moverEtapaDoModelo(editor, i, i + 1) })} />
                <input value={m.titulo} onChange={e => { const ms = [...editor.marcos]; ms[i] = { ...m, titulo: e.target.value }; setEditor({ ...editor, marcos: ms }) }} placeholder={`Etapa ${i + 1}`} style={{ ...inp, flex: 1 }} />
                <select value={m.categoria} onChange={e => { const ms = [...editor.marcos]; ms[i] = { ...m, categoria: e.target.value }; setEditor({ ...editor, marcos: ms }) }} style={{ ...inp, background: 'var(--v2-surface)' }}>
                  {CATEGORIAS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
                {/* Duração = número + UNIDADE. O campo era só um número, e "7"
                    sozinho não diz se é dia, semana ou mês — o placeholder
                    "dias" sumia no instante em que alguém digitava. Ao salvar
                    grava-se `duracao`+`unidade`; `diasDuracao` fica só na
                    leitura dos modelos antigos (duracaoDaEtapa). */}
                <input type="number" min="0" value={duracaoDaEtapa(m).quantidade || ''} onChange={e => { const ms = [...editor.marcos]; ms[i] = { ...m, duracao: Math.max(0, Number(e.target.value) || 0), unidade: duracaoDaEtapa(m).unidade }; setEditor({ ...editor, marcos: ms }) }} placeholder="0" style={{ ...inp, width: 56 }} />
                <select value={duracaoDaEtapa(m).unidade} onChange={e => { const ms = [...editor.marcos]; ms[i] = { ...m, duracao: duracaoDaEtapa(m).quantidade, unidade: e.target.value as UnidadeDuracao }; setEditor({ ...editor, marcos: ms }) }} style={{ ...inp, background: 'var(--v2-surface)', width: 96 }}>
                  {UNIDADES.map(u => <option key={u.chave} value={u.chave}>{u.label}</option>)}
                </select>
                {/* Responsável da ETAPA: escolher aqui carimba todas as tarefas
                    dela de uma vez (atribuirResponsavelNaEtapa). Quem precisar
                    de exceção troca na própria tarefa depois. */}
                <select value={m.responsavelEmail || ''} onChange={e => setEditor({ ...editor, ...atribuirResponsavelNaEtapa(editor, i, e.target.value) })}
                  title="Responsável da etapa — aplica a todas as tarefas dela" style={{ ...inp, background: 'var(--v2-surface)', width: 150 }}>
                  <option value="">Sem responsável</option>
                  {equipe.map(u => <option key={u.email} value={u.email}>{u.nome || u.email}</option>)}
                </select>
                {/* Remoção com REINDEXAÇÃO (lib/aplicarModelo): desvincular só as
                    tarefas desta etapa deixava as de baixo apontando para a etapa
                    vizinha, calado. Vínculo tarefa->etapa é posicional. */}
                <button onClick={() => setEditor({ ...editor, ...removerEtapaDoModelo(editor, i) })} style={{ background: 'none', border: 'none', color: 'var(--v2-ink3)', cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            ))}

            {/* Tarefas */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 8px' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--v2-ink)' }}>Tarefas</span>
              <button onClick={() => setEditor({ ...editor, tarefas: [...editor.tarefas, { titulo: '', tipo: 'tarefa', prioridade: 'media' }] })} style={{ background: 'none', border: 'none', color: 'var(--v2-info)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ Tarefa</button>
            </div>
            {editor.tarefas.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Tarefa é ordem de exibição pura: nada aponta para a posição
                    dela, então mover é só trocar de lugar na lista. */}
                <Mover primeiro={i === 0} ultimo={i === editor.tarefas.length - 1}
                  onSubir={() => setEditor({ ...editor, tarefas: moverNaLista(editor.tarefas, i, i - 1) })}
                  onDescer={() => setEditor({ ...editor, tarefas: moverNaLista(editor.tarefas, i, i + 1) })} />
                <input value={t.titulo} onChange={e => { const ts = [...editor.tarefas]; ts[i] = { ...t, titulo: e.target.value }; setEditor({ ...editor, tarefas: ts }) }} placeholder={`Tarefa ${i + 1}`} style={{ ...inp, flex: 1 }} />
                <select value={t.tipo} onChange={e => { const ts = [...editor.tarefas]; ts[i] = { ...t, tipo: e.target.value }; setEditor({ ...editor, tarefas: ts }) }} style={{ ...inp, background: 'var(--v2-surface)' }}>
                  {TIPOS.map(tp => <option key={tp} value={tp}>{tp}</option>)}
                </select>
                <select value={t.prioridade} onChange={e => { const ts = [...editor.tarefas]; ts[i] = { ...t, prioridade: e.target.value }; setEditor({ ...editor, tarefas: ts }) }} style={{ ...inp, background: 'var(--v2-surface)' }}>
                  {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={t.marcoIndice ?? ''} onChange={e => { const ts = [...editor.tarefas]; ts[i] = { ...t, marcoIndice: e.target.value === '' ? undefined : Number(e.target.value) }; setEditor({ ...editor, tarefas: ts }) }} style={{ ...inp, background: 'var(--v2-surface)', maxWidth: 130 }}>
                  <option value="">Sem etapa</option>
                  {editor.marcos.map((m, j) => <option key={j} value={j}>{m.titulo || `Etapa ${j + 1}`}</option>)}
                </select>
                {/* Responsável da TAREFA. Vazio não é "ninguém": é "o mesmo da
                    etapa" — por isso a opção vazia mostra de quem ela herda. */}
                {(() => {
                  const herdado = typeof t.marcoIndice === 'number' ? editor.marcos[t.marcoIndice]?.responsavelEmail : ''
                  const nomeHerdado = herdado ? (equipe.find(u => u.email === herdado)?.nome || herdado) : ''
                  return (
                    <select value={t.responsavelEmail || ''} onChange={e => { const ts = [...editor.tarefas]; ts[i] = { ...t, responsavelEmail: e.target.value }; setEditor({ ...editor, tarefas: ts }) }}
                      title={nomeHerdado ? `Sem escolha própria, fica com ${nomeHerdado} (responsável da etapa)` : 'Responsável da tarefa'}
                      style={{ ...inp, background: 'var(--v2-surface)', width: 150, color: t.responsavelEmail ? 'var(--v2-ink)' : 'var(--v2-ink3)' }}>
                      <option value="">{nomeHerdado ? `Herda: ${nomeHerdado}` : 'Sem responsável'}</option>
                      {equipe.map(u => <option key={u.email} value={u.email}>{u.nome || u.email}</option>)}
                    </select>
                  )
                })()}
                <button onClick={() => setEditor({ ...editor, tarefas: editor.tarefas.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', color: 'var(--v2-ink3)', cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button onClick={salvar} disabled={!editor.nome.trim()} style={{ flex: 1, padding: '11px 0', background: editor.nome.trim() ? 'var(--v2-amber-on)' : 'var(--v2-surface2)', color: editor.nome.trim() ? 'var(--v2-ink)' : 'var(--v2-ink3)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Salvar modelo</button>
              <button onClick={() => setEditor(null)} style={{ padding: '11px 18px', background: 'var(--v2-surface1)', color: 'var(--v2-ink2)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Aplicar */}
      {aplicar && <AplicarModal template={aplicar} clientes={clientes} equipe={equipe} onClose={() => setAplicar(null)} onOk={(r) => {
        const nomes = (r.aplicados || []).map(a => a.nome)
        setAplicar(null)
        setMsg(`Modelo "${aplicar.nome}" aplicado a ${nomes.length || 1} cliente(s): ${r.marcos} etapa(s) e ${r.tarefas} tarefa(s) criadas.${nomes.length ? ` (${nomes.join(', ')})` : ''}`)
        setTimeout(() => setMsg(''), 12000)
      }} />}
    </div>
  )
}
