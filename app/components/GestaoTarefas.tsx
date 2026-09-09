'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { upload } from '@vercel/blob/client'
import { v4 as uuid } from 'uuid'
import { toast, confirmar } from '@/lib/toast'
import { registrarDesfazer } from '@/lib/desfazer'
import { podeSerFilha, camposAoVincular, progressoDaMae, validarEmMassa } from '@/lib/hierarquiaTarefas'
import RichText from './RichText'
import OptImg from './OptImg'
import UploadProgress from './UploadProgress'
import { fecharFora } from '@/lib/fecharModal'
import { ehTarefaDeProducao, anexosCriativoPronto, avisoAoConcluir } from '@/lib/producaoVinculo'

type Cliente = { id: string; nome: string; logo?: string; corPrimaria?: string; squad?: string[] }
type Usuario = { id: string; nome: string; email: string; role: string; foto?: string }
type Anotacao = { id: string; x: number; y: number; texto: string; autor: string; autorNome: string; criadoEm: string }
type Anexo = { nome: string; url: string; tipo: string; anotacoes?: Anotacao[]; papel?: 'referencia' | 'criativo' } // papel 'criativo' = arte pronta (lib/producaoVinculo)
type Tarefa = {
  id: string; titulo: string; descricao?: string; tipo?: string; status: string; prioridade: string
  responsavelEmail?: string; responsavelNome?: string; clienteId?: string; clienteNome?: string
  marcoId?: string; tarefaPaiId?: string
  prazo?: string; anexos?: Anexo[]
  atividades?: any[]; comentarios?: any[]
  criadoPor: string; criadoEm: string; atualizadoEm: string; concluidoEm?: string
  excluidoEm?: string; excluidoPor?: string
}

const TIPOS: { key: string; label: string; cor: string; icone: string }[] = [
  { key: 'briefing', label: 'Briefing', cor: '#0891b2', icone: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2zM14 2v6h6M9 13h6M9 17h4' },
  { key: 'copy', label: 'Copy', cor: 'var(--v2-amber)', icone: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' },
  { key: 'campanha', label: 'Campanha', cor: '#7c3aed', icone: 'M3 11l18-5v12L3 14v-3zM11.6 16.8a3 3 0 1 1-5.8-1.6' },
  { key: 'carrossel', label: 'Carrossel', cor: '#7c3aed', icone: 'M4 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5zm10 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5z' },
  { key: 'criativo', label: 'Criativo', cor: '#ea580c', icone: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
  { key: 'ecommerce', label: 'E-commerce', cor: '#0891b2', icone: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0' },
  { key: 'estrategia', label: 'Estrategia', cor: '#0d9488', icone: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z' },
  { key: 'landing_page', label: 'Landing Page', cor: 'var(--v2-info)', icone: 'M3 3h18v18H3zM3 9h18M9 21V9' },
  { key: 'planejamento', label: 'Planejamento', cor: '#4f46e5', icone: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
  { key: 'post', label: 'Post', cor: '#059669', icone: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { key: 'reel', label: 'Reel', cor: 'var(--v2-hot)', icone: 'M23 7l-7 5 7 5V7zM14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z' },
  { key: 'story', label: 'Story', cor: '#c026d3', icone: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12z' },
  { key: 'tarefa', label: 'Tarefa', cor: 'var(--v2-ink3)', icone: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
  { key: 'video', label: 'Video', cor: 'var(--v2-hot)', icone: 'M5 3l14 9-14 9V3z' },
]

// Tipos do dia a dia de uma CLÍNICA (perfil clinica troca o catálogo de agência por este)
const TIPOS_CLINICA: { key: string; label: string; cor: string; icone: string }[] = [
  { key: 'confirmacao_agenda', label: 'Confirmação de agenda', cor: 'var(--v2-info)', icone: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' },
  { key: 'retorno_paciente', label: 'Retorno pós-atendimento', cor: '#059669', icone: 'M3 12a9 9 0 1 0 9-9M3 12l4-4M3 12l4 4' },
  { key: 'followup_orcamento', label: 'Follow-up de orçamento', cor: 'var(--v2-amber)', icone: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
  { key: 'compras_estoque', label: 'Compras / Estoque', cor: '#7c3aed', icone: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0' },
  { key: 'administrativo', label: 'Administrativo', cor: '#0d9488', icone: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2zM14 2v6h6' },
  { key: 'financeiro_clinica', label: 'Financeiro', cor: '#0891b2', icone: 'M2 7h20v10H2zM6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2' },
  { key: 'reuniao_interna', label: 'Reunião', cor: '#4f46e5', icone: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
  { key: 'tarefa', label: 'Tarefa geral', cor: 'var(--v2-ink3)', icone: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
]

// Tipos do dia a dia de uma OPERADORA DE TURISMO (perfil turismo troca o catálogo)
const TIPOS_TURISMO: { key: string; label: string; cor: string; icone: string }[] = [
  { key: 'reserva', label: 'Reserva', cor: 'var(--v2-info)', icone: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' },
  { key: 'emissao', label: 'Emissão de voucher', cor: '#059669', icone: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2zM14 2v6h6' },
  { key: 'cobranca', label: 'Cobrança', cor: '#0891b2', icone: 'M2 7h20v10H2zM6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2' },
  { key: 'onibus_manutencao', label: 'Ônibus / manutenção', cor: '#7c3aed', icone: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0' },
  { key: 'roteiro_logistica', label: 'Roteiro / logística', cor: '#4f46e5', icone: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
  { key: 'atendimento', label: 'Atendimento', cor: 'var(--v2-amber)', icone: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
  { key: 'tarefa', label: 'Tarefa geral', cor: 'var(--v2-ink3)', icone: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
]

// Tipos do dia a dia de uma ASSESSORIA DE CIDADANIA (perfil cidadania). O
// trabalho aqui é correr atrás de papel: pedir certidão em cartório, apostilar,
// traduzir e protocolar — nada disso cabia no catálogo de agência.
const TIPOS_CIDADANIA: { key: string; label: string; cor: string; icone: string }[] = [
  { key: 'pesquisa_genealogica', label: 'Pesquisa genealógica', cor: '#4f46e5', icone: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z' },
  { key: 'solicitar_certidao', label: 'Solicitar certidão', cor: 'var(--v2-info)', icone: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2zM14 2v6h6' },
  { key: 'apostilamento', label: 'Apostilamento', cor: '#7c3aed', icone: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1' },
  { key: 'traducao', label: 'Tradução juramentada', cor: '#0891b2', icone: 'M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6' },
  { key: 'protocolo', label: 'Protocolo / consulado', cor: '#059669', icone: 'M3 21h18M5 21V7l8-4v18M19 21V11l-6-4' },
  { key: 'acompanhamento', label: 'Acompanhamento', cor: 'var(--v2-amber)', icone: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2' },
  { key: 'atendimento', label: 'Atendimento ao cliente', cor: 'var(--v2-amber)', icone: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
  { key: 'financeiro_cidadania', label: 'Financeiro / cobrança', cor: '#0d9488', icone: 'M2 7h20v10H2zM6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2' },
  { key: 'tarefa', label: 'Tarefa geral', cor: 'var(--v2-ink3)', icone: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
]

// Tipos do dia a dia de uma LOJA DE VAREJO (perfil telefonia — eletrônicos e acessórios)
const TIPOS_TELEFONIA: { key: string; label: string; cor: string; icone: string }[] = [
  { key: 'venda', label: 'Venda (PDV)', cor: '#059669', icone: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0' },
  { key: 'orcamento', label: 'Orçamento', cor: 'var(--v2-info)', icone: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2zM14 2v6h6' },
  { key: 'pos_venda', label: 'Pós-venda / troca / garantia', cor: 'var(--v2-amber)', icone: 'M3 12a9 9 0 1 0 9-9M3 12l4-4M3 12l4 4' },
  { key: 'compras_estoque', label: 'Compras / Estoque', cor: '#7c3aed', icone: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' },
  { key: 'financeiro', label: 'Financeiro', cor: '#0891b2', icone: 'M2 7h20v10H2zM6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2' },
  { key: 'atendimento', label: 'Atendimento', cor: 'var(--v2-amber)', icone: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
  { key: 'reuniao_interna', label: 'Reunião', cor: '#4f46e5', icone: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' },
  { key: 'tarefa', label: 'Tarefa geral', cor: 'var(--v2-ink3)', icone: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
]

// Tipos personalizados criados pela equipe (persistidos no servidor). Mantidos em
// modulo para que os badges dos cards (que usam tipoInfo) resolvam tipos custom.
let TIPOS_CUSTOM: { key: string; label: string; cor: string; icone: string }[] = []
// Perfil da instância (setado pelo GestaoTarefas via prop) — decide o catálogo dos selects
let PERFIL_CLINICA_TAREFAS = false
let PERFIL_TURISMO_TAREFAS = false
let PERFIL_CIDADANIA_TAREFAS = false
let PERFIL_TELEFONIA_TAREFAS = false
function tiposBase() { return PERFIL_CIDADANIA_TAREFAS ? TIPOS_CIDADANIA : PERFIL_TURISMO_TAREFAS ? TIPOS_TURISMO : PERFIL_CLINICA_TAREFAS ? TIPOS_CLINICA : PERFIL_TELEFONIA_TAREFAS ? TIPOS_TELEFONIA : TIPOS }
// Resolver de badge inclui TODOS os catálogos: tarefas antigas mantêm o rótulo mesmo trocando o perfil
function todosTipos() { return [...TIPOS, ...TIPOS_CLINICA, ...TIPOS_TURISMO, ...TIPOS_CIDADANIA, ...TIPOS_TELEFONIA, ...TIPOS_CUSTOM] }
function tipoInfo(key?: string) { return todosTipos().find(t => t.key === key) || TIPOS.find(t => t.key === 'tarefa')! }
function fmtRelogio(ms: number) { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), seg = s % 60; const mm = String(m).padStart(2, '0'), ss = String(seg).padStart(2, '0'); return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}` }
// Definition of Done — checklist padrão por tipo de tarefa
const DOD_POR_TIPO: Record<string, string[]> = {
  reel: ['Roteiro', 'Gravação', 'Edição', 'Capa', 'Legenda', 'Hashtags', 'Revisão final'],
  video: ['Roteiro', 'Gravação', 'Edição', 'Capa', 'Legenda', 'Revisão final'],
  carrossel: ['Estrutura/roteiro', 'Design das lâminas', 'Capa', 'Legenda', 'Revisão final'],
  criativo: ['Briefing', 'Arte/design', 'Copy', 'Revisão final'],
  story: ['Arte/vídeo', 'Texto/CTA', 'Sticker/link', 'Revisão'],
  post: ['Imagem', 'Legenda', 'Hashtags', 'Revisão'],
  ecommerce: ['Foto do produto', 'Descrição', 'Preço/CTA', 'Revisão'],
  landing_page: ['Wireframe', 'Copy', 'Design', 'Revisão'],
}
function slug() { return Math.random().toString(36).slice(2) }

function forcarDownload(url: string, nome: string) {
  fetch(url).then(r => r.blob()).then(blob => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = nome
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 100)
  }).catch(() => { window.open(url, '_blank') })
}

function TextoComMencoes({ texto }: { texto: string }) {
  const ehUrl = (s: string) => /^https?:\/\//i.test(s)
  const renderMencoes = (t: string, base: string) => {
    const partes = t.split(/(@[a-zA-ZÀ-ÿ\s]+?)(?=\s@|\s*$|[.,!?;:\])])/g)
    return partes.map((p, i) => p.startsWith('@')
      ? <span key={`${base}-m${i}`} style={{ color: 'var(--v2-info)', fontWeight: 600 }}>{p}</span>
      : <span key={`${base}-t${i}`}>{p}</span>)
  }
  // Quebra em URLs (viram links) e trata @mencoes no restante
  const segmentos = String(texto || '').split(/(https?:\/\/[^\s]+)/gi)
  return <>{segmentos.map((seg, i) => ehUrl(seg)
    ? <a key={`u${i}`} href={seg} target="_blank" rel="noreferrer" style={{ color: 'var(--v2-info)', textDecoration: 'underline', wordBreak: 'break-all' }}>{seg}</a>
    : <span key={`s${i}`}>{renderMencoes(seg, `s${i}`)}</span>
  )}</>
}

function ConfirmPopup({ mensagem, onConfirm, onCancel }: { mensagem: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div onClick={fecharFora(onCancel)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: 'var(--v2-surface)', borderRadius: 14, padding: '24px 28px', maxWidth: 400, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--v2-hot-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--v2-hot)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--v2-ink)', lineHeight: 1.4 }}>{mensagem}</p>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 12, color: 'var(--v2-ink3)' }}>A tarefa será movida para a lixeira e poderá ser restaurada em até 30 dias.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '9px 20px', background: 'var(--v2-surface1)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--v2-ink2)', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={onConfirm} style={{ padding: '9px 20px', background: 'var(--v2-hot)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, color: 'var(--v2-surface)', cursor: 'pointer' }}>Excluir</button>
        </div>
      </div>
    </div>
  )
}

function AnexoViewer({ anexo, anexoIndex, onClose, onAddAnotacao, onRemoveAnotacao }: {
  anexo: Anexo; anexoIndex: number
  onClose: () => void
  onAddAnotacao: (idx: number, anotacao: Anotacao) => void
  onRemoveAnotacao: (idx: number, anotacaoId: string) => void
}) {
  const [pendente, setPendente] = useState<{ x: number; y: number } | null>(null)
  const [textoAnotacao, setTextoAnotacao] = useState('')
  const [anotacaoHover, setAnotacaoHover] = useState<string | null>(null)
  const ehImagem = anexo.tipo.startsWith('image')
  const ehVideo = anexo.tipo.startsWith('video')
  const anotacoes = anexo.anotacoes || []

  function handleClickImagem(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setPendente({ x, y })
    setTextoAnotacao('')
  }

  function confirmarAnotacao() {
    if (!pendente || !textoAnotacao.trim()) return
    onAddAnotacao(anexoIndex, {
      id: uuid(), x: pendente.x, y: pendente.y, texto: textoAnotacao.trim(),
      autor: '', autorNome: '', criadoEm: new Date().toISOString(),
    })
    setPendente(null)
    setTextoAnotacao('')
  }

  return (
    <div onClick={fecharFora(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 0, maxWidth: 1200, width: '100%', maxHeight: '92vh', background: 'var(--v2-ink)', borderRadius: 16, overflow: 'hidden' }}>
        {/* Lado esquerdo — midia */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', minWidth: 0, background: 'var(--v2-ink)' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v2-surface)" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
          <button onClick={() => forcarDownload(anexo.url, anexo.nome)} style={{ position: 'absolute', top: 12, right: 52, width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}
            title="Baixar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v2-surface)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          {ehImagem && (
            <div onClick={handleClickImagem} style={{ position: 'relative', cursor: 'crosshair', maxWidth: '100%', maxHeight: '92vh' }}>
              <img src={anexo.url} alt={anexo.nome} style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', display: 'block' }} />
              {anotacoes.map((an, idx) => (
                <div key={an.id}
                  onMouseEnter={() => setAnotacaoHover(an.id)}
                  onMouseLeave={() => setAnotacaoHover(null)}
                  style={{ position: 'absolute', left: `${an.x}%`, top: `${an.y}%`, transform: 'translate(-50%, -50%)', zIndex: 5 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--v2-hot)', color: 'var(--v2-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, border: '2px solid var(--v2-surface)', boxShadow: '0 2px 8px rgba(0,0,0,0.4)', cursor: 'pointer' }}>
                    {idx + 1}
                  </div>
                  {anotacaoHover === an.id && (
                    <div style={{ position: 'absolute', top: 30, left: '50%', transform: 'translateX(-50%)', background: 'var(--v2-surface)', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', minWidth: 160, maxWidth: 260, zIndex: 10 }}>
                      <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: 'var(--v2-ink)' }}>{an.texto}</p>
                      <p style={{ margin: 0, fontSize: 10, color: 'var(--v2-ink3)' }}>{an.autorNome} · {new Date(an.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                      <button onClick={e => { e.stopPropagation(); onRemoveAnotacao(anexoIndex, an.id) }}
                        style={{ marginTop: 6, padding: '3px 8px', background: 'var(--v2-hot-bg)', border: '1px solid var(--v2-hot-bg)', borderRadius: 4, fontSize: 10, color: 'var(--v2-hot)', cursor: 'pointer', fontWeight: 600 }}>Remover</button>
                    </div>
                  )}
                </div>
              ))}
              {pendente && (
                <div style={{ position: 'absolute', left: `${pendente.x}%`, top: `${pendente.y}%`, transform: 'translate(-50%, -50%)', zIndex: 10 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--v2-amber-on)', color: '#17150E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, border: '2px solid var(--v2-surface)', boxShadow: '0 2px 8px rgba(0,0,0,0.4)', animation: 'soma-pulse 1.2s ease-in-out infinite' }}>?</div>
                  <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 30, left: '50%', transform: 'translateX(-50%)', background: 'var(--v2-surface)', borderRadius: 10, padding: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', minWidth: 220, zIndex: 10 }}>
                    <textarea lang="pt-BR" value={textoAnotacao} onChange={e => setTextoAnotacao(e.target.value)} placeholder="Descreva a correcao..."
                      autoFocus style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--v2-rule)', fontSize: 12, minHeight: 50, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmarAnotacao() } }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setPendente(null)} style={{ flex: 1, padding: '6px 0', background: 'var(--v2-surface1)', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, color: 'var(--v2-ink2)', cursor: 'pointer' }}>Cancelar</button>
                      <button onClick={confirmarAnotacao} disabled={!textoAnotacao.trim()} style={{ flex: 1, padding: '6px 0', background: textoAnotacao.trim() ? 'var(--v2-hot)' : 'var(--v2-surface2)', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, color: textoAnotacao.trim() ? 'var(--v2-surface)' : 'var(--v2-ink3)', cursor: textoAnotacao.trim() ? 'pointer' : 'not-allowed' }}>Marcar</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {ehVideo && <video src={anexo.url} controls style={{ maxWidth: '100%', maxHeight: '85vh' }} />}
          {!ehImagem && !ehVideo && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 40 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--v2-ink3)" strokeWidth="1.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--v2-ink3)', fontWeight: 600 }}>{anexo.nome}</p>
              <a href={anexo.url} target="_blank" rel="noreferrer" style={{ padding: '8px 20px', background: 'var(--v2-amber-on)', color: '#17150E', borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>Abrir arquivo</a>
            </div>
          )}
          {ehImagem && <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--v2-ink3)', textAlign: 'center' }}>Clique na imagem para marcar uma correcao</p>}
        </div>

        {/* Lado direito — lista de anotacoes */}
        {ehImagem && (
          <div style={{ width: 280, background: '#1e1e1e', borderLeft: '1px solid var(--v2-ink)', padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 800, color: 'var(--v2-surface)' }}>Correcoes ({anotacoes.length})</h4>
            {anotacoes.length === 0 && <p style={{ margin: 0, fontSize: 12, color: 'var(--v2-ink2)' }}>Nenhuma correcao marcada. Clique na imagem para adicionar.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {anotacoes.map((an, idx) => (
                <div key={an.id}
                  onMouseEnter={() => setAnotacaoHover(an.id)}
                  onMouseLeave={() => setAnotacaoHover(null)}
                  style={{ display: 'flex', gap: 10, padding: '10px 12px', background: anotacaoHover === an.id ? '#2a2a2a' : '#252525', borderRadius: 8, border: anotacaoHover === an.id ? '1px solid var(--v2-ink2)' : '1px solid var(--v2-ink)', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--v2-hot)', color: 'var(--v2-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{idx + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 2px', fontSize: 12, color: 'var(--v2-rule2)', lineHeight: 1.4 }}>{an.texto}</p>
                    <p style={{ margin: 0, fontSize: 10, color: 'var(--v2-ink3)' }}>{an.autorNome || 'Voce'} · {new Date(an.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); onRemoveAnotacao(anexoIndex, an.id) }} title="Remover"
                    style={{ width: 20, height: 20, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: 0.5 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const COLUNAS: { key: string; label: string }[] = [
  { key: 'a_fazer', label: 'A fazer' },
  { key: 'em_andamento', label: 'Em andamento' },
  { key: 'em_revisao', label: 'Em revisao' },
  { key: 'concluido', label: 'Concluido' },
  { key: 'descartado', label: 'Descartado' },
]

const PRIORIDADES: { key: string; label: string; cor: string }[] = [
  { key: 'urgente', label: 'Urgente', cor: 'var(--v2-hot)' },
  { key: 'alta', label: 'Alta', cor: '#ea580c' },
  { key: 'media', label: 'Media', cor: 'var(--v2-amber)' },
  { key: 'baixa', label: 'Baixa', cor: 'var(--v2-ink3)' },
]

function corPrioridade(p: string) { return PRIORIDADES.find(x => x.key === p)?.cor || 'var(--v2-ink3)' }

function prazoFormatado(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function ehAtrasado(prazo?: string, status?: string) {
  if (!prazo || status === 'concluido' || status === 'descartado') return false
  return new Date(prazo).getTime() < Date.now()
}

export default function GestaoTarefas({ clientes, usuarios, clienteFixo, responsavelFixo, abrirTarefaId, onAbriuTarefa, podeEditar = true, podeExcluir = true, perfilClinica = false, perfilTurismo = false, perfilCidadania = false, perfilTelefonia = false }: { clientes: Cliente[]; usuarios: Usuario[]; clienteFixo?: string; responsavelFixo?: string; abrirTarefaId?: string | null; onAbriuTarefa?: () => void; podeEditar?: boolean; podeExcluir?: boolean; perfilClinica?: boolean; perfilTurismo?: boolean; perfilCidadania?: boolean; perfilTelefonia?: boolean }) {
  // Propaga o perfil para o catálogo de tipos (módulo — TarefaModal também usa)
  PERFIL_CLINICA_TAREFAS = perfilClinica
  PERFIL_TURISMO_TAREFAS = perfilTurismo
  PERFIL_CIDADANIA_TAREFAS = perfilCidadania
  PERFIL_TELEFONIA_TAREFAS = perfilTelefonia
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [excluidas, setExcluidas] = useState<Tarefa[]>([])
  const [view, setView] = useState<'kanban' | 'lista'>('kanban')
  const [mostrarLixeira, setMostrarLixeira] = useState(false)
  const [lixeiraDias, setLixeiraDias] = useState(30)
  useEffect(() => { fetch('/api/operacional').then(r => r.json()).then(d => { if (d?.lixeiraDias) setLixeiraDias(Number(d.lixeiraDias)) }).catch(() => {}) }, [])
  // clienteFixo: hub do cliente — filtro preso, seletor escondido, tarefa nova já atribuída.
  const [filtroCliente, setFiltroCliente] = useState(clienteFixo || '')
  // responsavelFixo: card do colaborador — filtro preso à pessoa, seletor escondido.
  const [filtroResponsavel, setFiltroResponsavel] = useState(responsavelFixo || '')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroPrioridade, setFiltroPrioridade] = useState('')
  const [busca, setBusca] = useState('')
  const [quickSubId, setQuickSubId] = useState<string | null>(null)
  const [quickSubTexto, setQuickSubTexto] = useState('')
  const [subsRecolhidas, setSubsRecolhidas] = useState<Record<string, boolean>>({})
  async function criarSubtarefa(pai: any, titulo: string) {
    const t = titulo.trim(); if (!t) return
    await fetch('/api/tarefas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titulo: t, tarefaPaiId: pai.id, clienteId: pai.clienteId || '', clienteNome: pai.clienteNome || '', marcoId: pai.marcoId || '' }) }).catch(() => {})
    setQuickSubTexto(''); carregar()
  }
  const [novaModal, setNovaModal] = useState(false)
  const [editModal, setEditModal] = useState<Tarefa | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  // SUBTAREFAS "PUXADAS" (ClickUp): arrastar uma linha sobre outra na Lista, menu na
  // linha, barra em massa e modal — tudo passa por vincular()/desvincular().
  const [overRow, setOverRow] = useState<string | null>(null)
  const [escolherMae, setEscolherMae] = useState<{ ids: string[] } | null>(null)
  const [buscaMae, setBuscaMae] = useState('')
  // Concluir a mãe com filhas abertas: pergunta (decisão do dono: "Concluir subtarefas? Revisar subtarefas?")
  const [perguntaMae, setPerguntaMae] = useState<{ ids: string[]; abertas: any[]; depois: (idsFilhasTambem: string[]) => void } | null>(null)

  async function vincular(ids: string[], maeId: string) {
    const mae = tarefas.find(t => t.id === maeId)
    if (!mae) return
    const { podem, recusadas } = validarEmMassa(ids, maeId, tarefas as any)
    if (recusadas.length && podem.length === 0) { toast(recusadas[0].motivo, 'erro'); return }
    const mudam = podem.map(id => tarefas.find(t => t.id === id)!).filter(t => camposAoVincular(t as any, mae as any).clienteMudou)
    if (mudam.length) {
      const nomes = mudam.slice(0, 3).map(t => `"${t.titulo}"`).join(', ') + (mudam.length > 3 ? ` e mais ${mudam.length - 3}` : '')
      const ok = await confirmar(`${nomes} ${mudam.length === 1 ? 'é de outro cliente e passa' : 'são de outro cliente e passam'} a ser de ${mae.clienteNome || 'sem cliente'}, o cliente de "${mae.titulo}". Continuar?`, { titulo: 'Trocar o cliente da subtarefa', okLabel: 'Continuar' })
      if (!ok) return
    }
    // Otimista: a Lista reorganiza na hora; a rede confirma e ressincroniza.
    setTarefas(ts => ts.map(t => podem.includes(t.id) ? { ...t, ...camposAoVincular(t as any, mae as any) } as any : t))
    const res = await Promise.all(podem.map(id => fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, tarefaPaiId: maeId }) }).then(r => r.ok).catch(() => false)))
    const falhas = res.filter(x => !x).length
    if (falhas) toast(`${falhas} tarefa(s) não foram movidas.`, 'erro')
    else toast(podem.length === 1 ? `Agora é subtarefa de "${mae.titulo}".` : `${podem.length} tarefas viraram subtarefas de "${mae.titulo}".`, 'sucesso')
    if (recusadas.length) toast(`${recusadas.length} não puderam: ${recusadas[0].motivo}`, 'info')
    setSubsRecolhidas(r => ({ ...r, [maeId]: false }))
    setSelecionadas([])
    carregar()
  }
  async function desvincular(id: string) {
    setTarefas(ts => ts.map(t => t.id === id ? { ...t, tarefaPaiId: undefined } as any : t))
    const ok = await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, tarefaPaiId: null }) }).then(r => r.ok).catch(() => false)
    toast(ok ? 'Voltou a ser uma tarefa.' : 'Não foi possível tirar de dentro.', ok ? 'sucesso' : 'erro')
    carregar()
  }
  // Concluir com pergunta: se alguma das tarefas é mãe com filhas abertas, pergunta antes.
  function concluirComPergunta(ids: string[], aplicar: (idsFilhasTambem: string[]) => void) {
    const abertas = ids.flatMap(id => progressoDaMae(id, tarefas as any).abertas)
    if (abertas.length === 0) { aplicar([]); return }
    setPerguntaMae({ ids, abertas, depois: aplicar })
  }
  const [tarefaViewMode, setTarefaViewMode] = useState<'modal' | 'fullscreen' | 'sidebar'>('modal')
  const [confirmPopup, setConfirmPopup] = useState<{ mensagem: string; onConfirm: () => void } | null>(null)
  // Tipos de tarefa personalizados (criados pela equipe, aplicam-se a tudo)
  const [tiposCustom, setTiposCustom] = useState<{ key: string; label: string; cor: string; icone: string }[]>(TIPOS_CUSTOM)
  function aplicarTiposCustom(lista: { key: string; label: string; cor: string; icone: string }[]) {
    TIPOS_CUSTOM = Array.isArray(lista) ? lista : []
    setTiposCustom(TIPOS_CUSTOM)
  }
  useEffect(() => { fetch('/api/tipos-tarefa').then(r => r.json()).then(d => { if (Array.isArray(d)) aplicarTiposCustom(d) }).catch(() => {}) }, [])
  // Abrir uma tarefa especifica (ex.: vindo de "Meu dia")
  useEffect(() => {
    if (!abrirTarefaId) return
    const t = tarefas.find(x => x.id === abrirTarefaId)
    if (t) { setEditModal(t); setTarefaViewMode('modal'); onAbriuTarefa?.() }
  }, [abrirTarefaId, tarefas])

  function carregar() {
    fetch('/api/tarefas').then(r => r.json()).then(d => setTarefas(Array.isArray(d) ? d : [])).catch(() => {})
  }
  function carregarLixeira() {
    fetch('/api/tarefas?lixeira=true').then(r => r.json()).then(d => setExcluidas(Array.isArray(d) ? d : [])).catch(() => {})
  }
  useEffect(() => { carregar() }, [])
  useEffect(() => { if (mostrarLixeira) carregarLixeira() }, [mostrarLixeira])

  async function moverStatus(id: string, status: string) {
    if (status === 'concluido') {
      concluirComPergunta([id], async (filhas) => {
        const todos = [id, ...filhas]
        setTarefas(ts => ts.map(t => todos.includes(t.id) ? { ...t, status } : t))
        await Promise.all(todos.map(x => fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: x, status }) }).catch(() => {})))
        carregar()
      })
      return
    }
    const antes = tarefas.find(t => t.id === id)
    setTarefas(ts => ts.map(t => t.id === id ? { ...t, status } : t))
    await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) }).catch(() => {})
    if (antes) registrarDesfazer(`Status de "${antes.titulo}"`, async () => {
      const r = await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: antes.status }) }).catch(() => null)
      carregar()
      return !!r?.ok
    })
    carregar()
  }

  async function restaurarTarefa(id: string) {
    await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, restaurar: true }) })
    carregarLixeira()
    carregar()
  }

  async function excluirPermanente(id: string) {
    await fetch(`/api/tarefas?id=${id}&permanente=true`, { method: 'DELETE' })
    carregarLixeira()
  }

  // Concluídas ficam ocultas por padrão; o toggle (✓) na barra as revela
  const [mostrarConcluidas, setMostrarConcluidas] = useState(false)
  const filtradas = tarefas.filter(t => {
    if (filtroCliente && t.clienteId !== filtroCliente) return false
    if (filtroResponsavel && t.responsavelEmail !== filtroResponsavel) return false
    if (filtroTipo && (t.tipo || 'tarefa') !== filtroTipo) return false
    // Tarefa antiga sem prioridade conta como "Media" — é o padrão de quem cria hoje.
    if (filtroPrioridade && (t.prioridade || 'media') !== filtroPrioridade) return false
    if (busca.trim() && !((t.titulo || '') + ' ' + (t.descricao || '').replace(/<[^>]+>/g, ' ')).toLowerCase().includes(busca.toLowerCase())) return false
    if (!mostrarConcluidas && (t.status === 'concluido' || t.status === 'descartado')) return false
    return true
  })
  const qtdConcluidas = tarefas.filter(t => t.status === 'concluido'
    && (!filtroCliente || t.clienteId === filtroCliente)
    && (!filtroResponsavel || t.responsavelEmail === filtroResponsavel)).length

  const [selecionadas, setSelecionadas] = useState<string[]>([])
  function alternarSelecao(id: string) { setSelecionadas(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]) }
  // EDIÇÃO EM MASSA: aplica o MESMO campo em todas as selecionadas. Antes só
  // dava para excluir em lote — mudar 6 tarefas de coluna exigia arrastar 6
  // vezes, uma a uma.
  //
  // Vai pelo PUT normal, tarefa a tarefa, de propósito: é ele que grava a
  // atividade no histórico ("Status alterado para...", "Responsável alterado
  // para..."). Um endpoint em lote seria mais rápido e apagaria o rastro de
  // quem mudou o que — em tarefa de equipe isso é o que resolve discussão.
  const [aplicandoMassa, setAplicandoMassa] = useState(false)
  async function aplicarEmMassa(campos: Record<string, any>, rotulo: string, idsExplicitos?: string[]) {
    const alvo = idsExplicitos || selecionadas
    if (!alvo.length || aplicandoMassa) return
    setAplicandoMassa(true)
    const ids = [...alvo]
    // Otimista: a tela responde na hora; a lista e ressincronizada no fim.
    setTarefas(ts => ts.map(t => ids.includes(t.id) ? { ...t, ...campos } as any : t))
    const res = await Promise.all(ids.map(id =>
      fetch('/api/tarefas', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...campos }),
      }).then(r => r.ok).catch(() => false)
    ))
    const falhas = res.filter(ok => !ok).length
    setAplicandoMassa(false)
    carregar()
    if (falhas) toast(`${ids.length - falhas} de ${ids.length} atualizadas — ${falhas} falharam. Tente de novo nas que sobraram.`, 'erro')
    else { toast(`${ids.length} ${ids.length > 1 ? 'tarefas' : 'tarefa'} · ${rotulo}`, 'sucesso'); setSelecionadas([]) }
  }

  function excluirSelecionadas() {
    setConfirmPopup({
      mensagem: `Excluir ${selecionadas.length} tarefa(s)?`,
      onConfirm: async () => {
        const ids = [...selecionadas]
        await Promise.all(ids.map(id => fetch(`/api/tarefas?id=${id}`, { method: 'DELETE' })))
        registrarDesfazer(`Exclusão de ${ids.length} tarefa(s)`, async () => {
          const rs = await Promise.all(ids.map(id => fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, restaurar: true }) }).then(r => r.ok).catch(() => false)))
          carregar()
          return rs.every(Boolean)
        })
        setSelecionadas([])
        carregar()
        setConfirmPopup(null)
      }
    })
  }
  // Exclusao individual a partir do "X" na linha da lista (tarefa ou subtarefa)
  function excluirUma(id: string, titulo: string) {
    setConfirmPopup({
      mensagem: `Excluir "${titulo}"?`,
      onConfirm: async () => {
        setConfirmPopup(null)
        setTarefas(ts => ts.filter(t => t.id !== id)) // remocao otimista
        await fetch(`/api/tarefas?id=${id}`, { method: 'DELETE' }).catch(() => {})
        registrarDesfazer(`Exclusão de "${titulo}"`, async () => {
          const r = await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, restaurar: true }) }).catch(() => null)
          carregar()
          return !!r?.ok
        })
        carregar()
      }
    })
  }

  function diasRestantes(excluidoEm?: string) {
    if (!excluidoEm) return lixeiraDias
    const diff = lixeiraDias - Math.floor((Date.now() - new Date(excluidoEm).getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, diff)
  }

  return (
    <div>
      {confirmPopup && <ConfirmPopup mensagem={confirmPopup.mensagem} onConfirm={confirmPopup.onConfirm} onCancel={() => setConfirmPopup(null)} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: 'var(--v2-ink)' }}>Tarefas</h2>
        {!mostrarLixeira && (
          <div style={{ display: 'flex', background: 'var(--v2-surface2)', borderRadius: 10, padding: 3 }}>
            {(['kanban', 'lista'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '7px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                background: view === v ? 'var(--v2-surface)' : 'transparent', color: view === v ? 'var(--v2-ink)' : 'var(--v2-ink3)',
                boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
              }}>{v === 'kanban' ? 'Kanban' : 'Lista'}</button>
            ))}
          </div>
        )}
        {!mostrarLixeira && (
          <>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 10, color: 'var(--v2-ink3)', pointerEvents: 'none', display: 'flex' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg></span>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Pesquisar tarefas..." style={{ padding: '8px 12px 8px 30px', borderRadius: 8, border: '1px solid var(--v2-rule)', fontSize: 12, fontFamily: 'inherit', width: 180 }} />
            </div>
            {!clienteFixo && !perfilClinica && !perfilTurismo && !perfilCidadania && !perfilTelefonia && (
              <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--v2-rule)', fontSize: 12, fontFamily: 'inherit' }}>
                <option value="">Todos os clientes</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            )}
            {!responsavelFixo && <select value={filtroResponsavel} onChange={e => setFiltroResponsavel(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--v2-rule)', fontSize: 12, fontFamily: 'inherit' }}>
              <option value="">Todos os responsáveis</option>
              {(usuarios || []).filter(u => u.role !== 'cliente').map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}
            </select>}
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--v2-rule)', fontSize: 12, fontFamily: 'inherit' }}>
              <option value="">Todos os tipos</option>
              {[...tiposBase(), ...tiposCustom].map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <select value={filtroPrioridade} onChange={e => setFiltroPrioridade(e.target.value)} title="Filtrar por urgência"
              style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', fontWeight: filtroPrioridade ? 700 : 400, color: filtroPrioridade ? corPrioridade(filtroPrioridade) : 'var(--v2-ink)', border: `1px solid ${filtroPrioridade ? corPrioridade(filtroPrioridade) : 'var(--v2-rule)'}` }}>
              <option value="">Todas as urgências</option>
              {PRIORIDADES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            {(filtroCliente || filtroResponsavel || filtroTipo || filtroPrioridade || busca) && (
              <button onClick={() => { setFiltroCliente(''); setFiltroResponsavel(''); setFiltroTipo(''); setFiltroPrioridade(''); setBusca('') }} style={{ padding: '8px 14px', background: 'var(--v2-surface2)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'var(--v2-ink2)', cursor: 'pointer' }}>Limpar filtros</button>
            )}
            {/* Mostrar/ocultar concluídas */}
            <button onClick={() => setMostrarConcluidas(v => !v)} title={mostrarConcluidas ? 'Ocultar concluídas' : 'Mostrar concluídas'} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
              background: mostrarConcluidas ? 'var(--v2-ok)' : 'var(--v2-surface1)', color: mostrarConcluidas ? 'var(--v2-surface)' : 'var(--v2-ink2)', border: mostrarConcluidas ? 'none' : '1px solid var(--v2-rule)',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              Concluídas{qtdConcluidas > 0 ? ` (${qtdConcluidas})` : ''}
            </button>
            {/* Recolher/expandir todas as subtarefas (só na lista, só se houver subtarefas) */}
            {view === 'lista' && (() => {
              const maesComSubs = Array.from(new Set(tarefas.filter((s: any) => s.tarefaPaiId).map((s: any) => s.tarefaPaiId))) as string[]
              if (maesComSubs.length === 0) return null
              const todasRecolhidas = maesComSubs.every(id => subsRecolhidas[id])
              return (
                <button onClick={() => setSubsRecolhidas(todasRecolhidas ? {} : Object.fromEntries(maesComSubs.map(id => [id, true])))}
                  title={todasRecolhidas ? 'Expandir todas as subtarefas' : 'Recolher todas as subtarefas'}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, background: 'var(--v2-surface1)', color: 'var(--v2-ink2)', border: '1px solid var(--v2-rule)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: todasRecolhidas ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }}><path d="M6 9l6 6 6-6" /></svg>
                  {todasRecolhidas ? 'Expandir subtarefas' : 'Recolher subtarefas'}
                </button>
              )
            })()}
          </>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setMostrarLixeira(!mostrarLixeira)} style={{
            padding: '9px 14px', background: mostrarLixeira ? 'var(--v2-hot-bg)' : 'var(--v2-surface1)', border: mostrarLixeira ? '1px solid var(--v2-hot-bg)' : '1px solid var(--v2-rule)',
            borderRadius: 10, fontSize: 12, fontWeight: 600, color: mostrarLixeira ? 'var(--v2-hot)' : 'var(--v2-ink2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            {mostrarLixeira ? 'Voltar' : 'Lixeira'}
            {!mostrarLixeira && excluidas.length > 0 && <span style={{ background: 'var(--v2-hot)', color: 'var(--v2-surface)', borderRadius: 999, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>{excluidas.length}</span>}
          </button>
          {!mostrarLixeira && podeEditar && (
            <button onClick={() => setNovaModal(true)} className="soma10-no-invert" style={{ padding: '9px 16px', background: 'var(--v2-amber-on)', color: '#17150E', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>+ Nova tarefa</button>
          )}
        </div>
      </div>

      {selecionadas.length > 0 && !mostrarLixeira && (() => {
        const selEstilo: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--v2-rule)', fontSize: 12, fontFamily: 'inherit', background: 'var(--v2-surface)', color: 'var(--v2-ink)', cursor: aplicandoMassa ? 'wait' : 'pointer', maxWidth: 190 }
        return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '10px 16px', background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--v2-ink)' }}>{selecionadas.length} selecionada(s)</span>
          <button onClick={() => setSelecionadas([])} style={{ background: 'none', border: '1px solid var(--v2-rule)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--v2-ink2)', cursor: 'pointer' }}>Limpar</button>

          {podeEditar && <>
            <span style={{ width: 1, height: 22, background: 'var(--v2-surface2)' }} />
            {/* Cada select volta para o placeholder depois de aplicar (value fixo):
                ele é um COMANDO, não o estado atual das tarefas — que podem ter
                seis status diferentes entre si. */}
            <select value="" disabled={aplicandoMassa} onChange={e => { const v = e.target.value; if (!v) return; if (v === 'concluido') { concluirComPergunta(selecionadas, (filhas) => aplicarEmMassa({ status: v }, 'concluídas', Array.from(new Set([...selecionadas, ...filhas])))); return } aplicarEmMassa({ status: v }, `movidas para ${COLUNAS.find(c => c.key === v)?.label || v}`) }} style={selEstilo} title="Mover as selecionadas de coluna">
              <option value="">Mover para...</option>
              {COLUNAS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>

            <select value="" disabled={aplicandoMassa} onChange={e => { const v = e.target.value; if (!v) return; const u = (usuarios || []).find(x => x.email === v); aplicarEmMassa({ responsavelEmail: v, responsavelNome: u?.nome || '' }, `atribuídas a ${u?.nome || v}`) }} style={selEstilo} title="Definir o responsável das selecionadas">
              <option value="">Responsável...</option>
              {(usuarios || []).filter(u => u.role !== 'cliente').map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}
            </select>

            <select value="" disabled={aplicandoMassa} onChange={e => { const v = e.target.value; if (v) aplicarEmMassa({ prioridade: v }, `prioridade ${PRIORIDADES.find(p => p.key === v)?.label || v}`) }} style={selEstilo} title="Definir a prioridade das selecionadas">
              <option value="">Prioridade...</option>
              {PRIORIDADES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>

            <input type="date" disabled={aplicandoMassa} onChange={e => { const v = e.target.value; if (v) aplicarEmMassa({ prazo: new Date(v + 'T12:00:00').toISOString() }, `prazo ${new Date(v + 'T12:00:00').toLocaleDateString('pt-BR')}`) }} title="Definir o prazo das selecionadas" style={{ ...selEstilo, maxWidth: 150 }} />
            <button onClick={() => { setBuscaMae(''); setEscolherMae({ ids: selecionadas }) }} disabled={aplicandoMassa} title="As selecionadas viram subtarefas de uma tarefa-mãe"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-ink)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4v6a4 4 0 0 0 4 4h7M16 10l4 4-4 4" /></svg>
              Mover para dentro de…
            </button>
          </>}

          {aplicandoMassa && <span style={{ fontSize: 12, color: 'var(--v2-ink3)' }}>aplicando...</span>}
          {podeExcluir && <button onClick={excluirSelecionadas} disabled={aplicandoMassa} style={{ marginLeft: 'auto', background: 'var(--v2-hot)', color: 'var(--v2-surface)', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Excluir selecionadas</button>}
        </div>
        )
      })()}

      {/* KANBAN */}
      {view === 'kanban' && (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, height: 'calc(100vh - 200px)', alignItems: 'stretch' }}>
          {COLUNAS.filter(col => mostrarConcluidas || col.key !== 'descartado').map(col => {
            const cards = filtradas.filter(t => t.status === col.key && !t.tarefaPaiId)
            return (
              <div key={col.key}
                onDragOver={e => { if (dragId) { e.preventDefault(); setOverCol(col.key) } }}
                onDragLeave={() => setOverCol(o => o === col.key ? null : o)}
                onDrop={() => { if (dragId) moverStatus(dragId, col.key); setDragId(null); setOverCol(null) }}
                style={{
                  flex: '0 0 240px', width: 240, background: overCol === col.key ? 'var(--v2-amber-bg)' : 'var(--v2-surface2)', borderRadius: 12, padding: 10,
                  outline: overCol === col.key ? '2px dashed var(--v2-amber-on)' : 'none', outlineOffset: -2,
                  display: 'flex', flexDirection: 'column', minHeight: 0,
                }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 4px' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--v2-ink2)' }}>{col.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--v2-ink3)', background: 'var(--v2-surface)', borderRadius: 999, padding: '1px 8px' }}>{cards.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto', minHeight: 60 }}>
                  {cards.map(t => (
                    <div key={t.id} draggable={quickSubId !== t.id} onDragStart={() => setDragId(t.id)} onDragEnd={() => { setDragId(null); setOverCol(null) }}
                      onClick={() => setEditModal(t)}
                      style={{ background: 'var(--v2-surface)', borderRadius: 10, padding: '26px 10px 10px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', cursor: 'grab', opacity: dragId === t.id ? 0.4 : 1, borderLeft: `3px solid ${corPrioridade(t.prioridade)}`, position: 'relative' }}>
                      {(() => { const tp = tipoInfo(t.tipo); return (
                        <span style={{ position: 'absolute', top: 6, left: 8, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, color: tp.cor, background: `${tp.cor}15`, borderRadius: 4, padding: '1px 5px', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={tp.cor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d={tp.icone} /></svg>
                          {tp.label}
                        </span>
                      )})()}
                      <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.titulo}</p>
                      {(() => { const pg = progressoDaMae(t.id, tarefas as any); const ns = pg.total; const nsTxt = `${pg.concluidas}/${ns}`; return ns > 0 ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: 'var(--v2-info)', background: 'var(--v2-info-bg)', borderRadius: 999, padding: '1px 7px', marginBottom: 4 }}>{ns} subtarefa(s)</span> : null })()}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {t.responsavelNome && (() => { const u = (usuarios || []).find(x => x.email === t.responsavelEmail); return (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--v2-ink2)', background: 'var(--v2-surface2)', borderRadius: 999, padding: '1px 6px' }}>
                            {u?.foto ? <OptImg src={u.foto} size={14} /> : null}
                            {t.responsavelNome}
                          </span>
                        )})()}
                        {t.clienteNome && (() => { const c = (clientes || []).find(x => x.id === t.clienteId); return (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--v2-ink3)' }}>
                            {c?.logo ? <OptImg src={c.logo} size={14} /> : null}
                            {t.clienteNome}
                          </span>
                        )})()}
                        {t.prazo && <span style={{ fontSize: 10, color: ehAtrasado(t.prazo, t.status) ? 'var(--v2-hot)' : 'var(--v2-ink3)', fontWeight: ehAtrasado(t.prazo, t.status) ? 700 : 500 }}>{prazoFormatado(t.prazo)}{ehAtrasado(t.prazo, t.status) ? ' (atrasado)' : ''}</span>}
                        {(t.anexos || []).length > 0 && <span style={{ fontSize: 10, color: 'var(--v2-info)', background: 'var(--v2-info-bg)', borderRadius: 999, padding: '1px 6px' }}>{t.anexos!.length} anexo(s)</span>}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <button onClick={e => { e.stopPropagation(); setQuickSubTexto(''); setQuickSubId(quickSubId === t.id ? null : t.id) }} title="Adicionar subtarefa"
                          style={{ width: 18, height: 18, borderRadius: 5, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-ink3)', cursor: 'pointer', fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>+</button>
                        <span onClick={e => { e.stopPropagation(); alternarSelecao(t.id) }}
                          style={{ width: 16, height: 16, borderRadius: 4, border: selecionadas.includes(t.id) ? '1.5px solid #1877f2' : '1px solid var(--v2-rule2)',
                            background: selecionadas.includes(t.id) ? '#1877f2' : 'var(--v2-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {selecionadas.includes(t.id) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--v2-surface)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                        </span>
                      </div>
                      {/* Input rápido de subtarefa — mesmo atalho da Lista; o card sai do
                          draggable enquanto digita (drag roubaria a seleção do texto). */}
                      {quickSubId === t.id && (
                        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                          <input autoFocus value={quickSubTexto} onChange={e => setQuickSubTexto(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && quickSubTexto.trim()) criarSubtarefa(t, quickSubTexto); if (e.key === 'Escape') setQuickSubId(null) }}
                            placeholder="Subtarefa — Enter adiciona"
                            style={{ flex: 1, minWidth: 0, padding: '6px 8px', borderRadius: 7, border: '1.5px solid var(--v2-rule)', fontSize: 11.5, fontFamily: 'inherit' }} />
                          <button onClick={() => criarSubtarefa(t, quickSubTexto)} disabled={!quickSubTexto.trim()}
                            style={{ padding: '6px 9px', background: quickSubTexto.trim() ? 'var(--v2-ink)' : 'var(--v2-surface2)', color: quickSubTexto.trim() ? 'var(--v2-surface)' : 'var(--v2-ink3)', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>Ok</button>
                        </div>
                      )}
                    </div>
                  ))}
                  {cards.length === 0 && <p style={{ margin: 0, fontSize: 11, color: 'var(--v2-ink3)', textAlign: 'center', padding: '14px 0' }}>--</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* LISTA */}
      {/* Escolher a tarefa-mãe (menu da linha / em massa) */}
      {escolherMae && (() => {
        const q = buscaMae.trim().toLowerCase()
        const origem = tarefas.filter(t => escolherMae.ids.includes(t.id))
        const clientesOrigem = new Set(origem.map(t => t.clienteId || ''))
        const candidatas = tarefas
          .filter(t => !t.tarefaPaiId && !escolherMae.ids.includes(t.id) && t.status !== 'descartado')
          .filter(t => !q || (t.titulo || '').toLowerCase().includes(q) || (t.clienteNome || '').toLowerCase().includes(q))
          .sort((a, b) => Number(clientesOrigem.has(b.clienteId || '')) - Number(clientesOrigem.has(a.clienteId || '')) || (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR'))
          .slice(0, 40)
        if (typeof document === 'undefined') return null
        return createPortal(
          <div onClick={fecharFora(() => setEscolherMae(null), { perguntar: false })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '16px 18px 10px' }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--v2-ink3)' }}>Mover para dentro de</p>
                <p style={{ margin: '4px 0 10px', fontSize: 15, fontWeight: 500, color: 'var(--v2-ink)' }}>{origem.length === 1 ? `"${origem[0]?.titulo}"` : `${origem.length} tarefas`} {origem.length === 1 ? 'vira' : 'viram'} subtarefa de…</p>
                <input autoFocus value={buscaMae} onChange={e => setBuscaMae(e.target.value)} placeholder="Buscar tarefa-mãe pelo título ou cliente" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-ink)', fontSize: 13.5, fontFamily: 'inherit' }} />
              </div>
              <div style={{ overflowY: 'auto', padding: '0 8px 8px' }}>
                {candidatas.length === 0 && <p style={{ margin: 0, padding: 16, fontSize: 13, color: 'var(--v2-ink3)' }}>Nenhuma tarefa pode ser a mãe (só tarefas de primeiro nível).</p>}
                {candidatas.map(c => {
                  const pg = progressoDaMae(c.id, tarefas as any)
                  const outroCliente = origem.some(o => (o.clienteId || '') !== (c.clienteId || ''))
                  return (
                    <button key={c.id} onClick={() => { const ids = escolherMae.ids; setEscolherMae(null); vincular(ids, c.id) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 10, border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--v2-ink)', fontFamily: 'inherit' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--v2-surface2)' }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.titulo}</span>
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--v2-ink3)' }}>{c.clienteNome || 'Interno'}{pg.total ? ` · ${pg.concluidas}/${pg.total} subtarefas` : ''}{outroCliente ? ' · outro cliente' : ''}</span>
                      </span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v2-ink3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4v6a4 4 0 0 0 4 4h7M16 10l4 4-4 4" /></svg>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        , document.body)
      })()}

      {/* Concluir a mãe com filhas abertas */}
      {perguntaMae && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
          <div style={{ background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 16, width: '100%', maxWidth: 460, padding: '20px 22px' }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--v2-amber)' }}>Subtarefas em aberto</p>
            <p style={{ margin: '6px 0 4px', fontSize: 16, fontWeight: 500, color: 'var(--v2-ink)' }}>{perguntaMae.abertas.length === 1 ? 'Ainda há 1 subtarefa aberta.' : `Ainda há ${perguntaMae.abertas.length} subtarefas abertas.`}</p>
            <ul style={{ margin: '0 0 14px', padding: 0, listStyle: 'none', fontSize: 13, color: 'var(--v2-ink2)', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {perguntaMae.abertas.slice(0, 5).map((a: any) => <li key={a.id}>· {a.titulo}</li>)}
              {perguntaMae.abertas.length > 5 && <li>· e mais {perguntaMae.abertas.length - 5}</li>}
            </ul>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => { const f = perguntaMae.depois; const filhas = perguntaMae.abertas.map((a: any) => a.id); setPerguntaMae(null); f(filhas) }} style={{ padding: '9px 14px', background: 'var(--v2-amber-on)', color: '#17150E', border: 0, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Concluir subtarefas também</button>
              <button onClick={() => { const ids = perguntaMae.ids; setPerguntaMae(null); setView('lista'); setSubsRecolhidas(r => ({ ...r, ...Object.fromEntries(ids.map(i => [i, false])) })); toast('A tarefa-mãe continua aberta. Revise as subtarefas.', 'info') }} style={{ padding: '9px 14px', background: 'var(--v2-surface)', color: 'var(--v2-ink)', border: '1px solid var(--v2-rule)', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Revisar subtarefas</button>
              <button onClick={() => setPerguntaMae(null)} style={{ padding: '9px 12px', background: 'none', color: 'var(--v2-ink3)', border: 0, borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
            </div>
          </div>
        </div>
      , document.body)}

      {view === 'lista' && (
        <div style={{ background: 'var(--v2-surface)', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
          {/* Arrastando uma subtarefa: soltar aqui devolve o primeiro nível */}
          {dragId && tarefas.find(t => t.id === dragId)?.tarefaPaiId && (
            <div onDragOver={e => { e.preventDefault(); setOverRow('__topo') }} onDragLeave={() => setOverRow(null)} onDrop={() => { const id = dragId; setDragId(null); setOverRow(null); if (id) desvincular(id) }}
              style={{ margin: 10, padding: '12px 16px', borderRadius: 10, border: `2px dashed ${overRow === '__topo' ? 'var(--v2-amber-on)' : 'var(--v2-rule2)'}`, background: overRow === '__topo' ? 'var(--v2-amber-bg)' : 'var(--v2-surface1)', fontSize: 12.5, color: 'var(--v2-ink2)', textAlign: 'center' }}>
              Soltar aqui para voltar a ser uma tarefa de primeiro nível
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 120px 120px 100px 90px 90px 32px', minWidth: 720, gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--v2-rule)', fontSize: 11, fontWeight: 700, color: 'var(--v2-ink3)' }}>
            <span>Tipo</span><span>Tarefa</span><span>Responsável</span><span>Cliente</span><span>Prazo</span><span>Prioridade</span><span>Status</span><span></span>
          </div>
          {filtradas.length === 0 && <p style={{ margin: 0, padding: 30, textAlign: 'center', color: 'var(--v2-ink3)', fontSize: 13 }}>Nenhuma tarefa encontrada.</p>}
          {filtradas.filter(t => !t.tarefaPaiId || !tarefas.some((p: any) => p.id === t.tarefaPaiId)).map(t => {
            const tp = tipoInfo(t.tipo)
            const subs = tarefas.filter((s: any) => s.tarefaPaiId === t.id && (mostrarConcluidas || (s.status !== 'concluido' && s.status !== 'descartado')))
            const linha = (x: any, ehSub: boolean) => {
              const xp = tipoInfo(x.tipo)
              return (
                <div key={x.id} onClick={() => setEditModal(x)}
                  draggable={podeEditar && quickSubId !== x.id}
                  onDragStart={e => { setDragId(x.id); e.dataTransfer.effectAllowed = 'move' }}
                  onDragEnd={() => { setDragId(null); setOverRow(null) }}
                  onDragOver={e => { if (dragId && dragId !== x.id) { e.preventDefault(); setOverRow(x.id) } }}
                  onDragLeave={() => { if (overRow === x.id) setOverRow(null) }}
                  onDrop={e => { e.preventDefault(); const id = dragId; setDragId(null); setOverRow(null); if (!id || id === x.id) return; vincular([id], ehSub ? (x.tarefaPaiId as string) : x.id) }}
                  title={podeEditar ? 'Arraste sobre outra tarefa para torná-la subtarefa' : undefined}
                  style={{ display: 'grid', gridTemplateColumns: '100px 1fr 120px 120px 100px 90px 90px 32px', minWidth: 720, gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--v2-rule)', cursor: 'pointer', alignItems: 'center', fontSize: 12, background: overRow === x.id || editModal?.id === x.id ? 'var(--v2-amber-bg)' : ehSub ? 'var(--v2-surface1)' : 'var(--v2-surface)', boxShadow: overRow === x.id ? 'inset 0 0 0 2px var(--v2-amber-on)' : editModal?.id === x.id ? 'inset 3px 0 0 var(--v2-amber-on)' : 'none', opacity: dragId === x.id ? 0.5 : 1, transition: 'background 100ms' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: xp.cor, fontWeight: 600 }}>
                    <span onClick={e => { e.stopPropagation(); alternarSelecao(x.id) }} title="Selecionar" style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${selecionadas.includes(x.id) ? 'var(--v2-amber-on)' : 'var(--v2-rule2)'}`, background: selecionadas.includes(x.id) ? 'var(--v2-amber-on)' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
                      {selecionadas.includes(x.id) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#17150E" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                    </span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={xp.cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={xp.icone} /></svg>
                    {xp.label}
                  </span>
                  <span style={{ fontWeight: ehSub ? 500 : 600, color: ehSub ? 'var(--v2-ink2)' : 'var(--v2-ink)', display: 'flex', alignItems: 'center', gap: 8, paddingLeft: ehSub ? 22 : 0, minWidth: 0 }}>
                    {ehSub && <span style={{ color: 'var(--v2-ink3)', flexShrink: 0 }}>↳</span>}
                    {!ehSub && subs.length > 0 && (
                      <button onClick={e => { e.stopPropagation(); setSubsRecolhidas(r => ({ ...r, [x.id]: !r[x.id] })) }} title={subsRecolhidas[x.id] ? 'Expandir subtarefas' : 'Recolher subtarefas'} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--v2-ink3)', display: 'flex' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: subsRecolhidas[x.id] ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }}><path d="M6 9l6 6 6-6" /></svg>
                      </button>
                    )}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.titulo}</span>
                    {!ehSub && subs.length > 0 && (() => { const pg = progressoDaMae(x.id, tarefas as any); return (
                      <span title={`${pg.concluidas} de ${pg.total} subtarefas concluídas`} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, color: pg.concluidas === pg.total ? 'var(--v2-ok)' : 'var(--v2-info)', background: pg.concluidas === pg.total ? 'var(--v2-ok-bg)' : 'var(--v2-info-bg)', borderRadius: 999, padding: '1px 8px' }}>
                        {pg.concluidas}/{pg.total}
                        <span style={{ width: 34, height: 3, borderRadius: 2, background: 'rgba(0,0,0,0.12)', overflow: 'hidden', display: 'inline-block' }}><span style={{ display: 'block', width: `${pg.total ? Math.round((pg.concluidas / pg.total) * 100) : 0}%`, height: '100%', background: 'currentColor' }} /></span>
                      </span>
                    ) })()}
                    {podeEditar && subs.length === 0 && <button onClick={e => { e.stopPropagation(); setBuscaMae(''); setEscolherMae({ ids: [x.id] }) }} title={ehSub ? 'Mover para dentro de outra tarefa' : 'Mover para dentro de uma tarefa (vira subtarefa)'} className="gt-acao-linha"
                      style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 5, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-ink3)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4v6a4 4 0 0 0 4 4h7M16 10l4 4-4 4" /></svg>
                    </button>}
                    {podeEditar && ehSub && <button onClick={e => { e.stopPropagation(); desvincular(x.id) }} title="Tirar de dentro (volta a ser tarefa)" className="gt-acao-linha"
                      style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 5, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-ink3)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 20v-6a4 4 0 0 0-4-4H4M8 14l-4-4 4-4" /></svg>
                    </button>}
                    {!ehSub && <button onClick={e => { e.stopPropagation(); setQuickSubTexto(''); setQuickSubId(quickSubId === x.id ? null : x.id) }} title="Adicionar subtarefa" style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 5, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-ink3)', cursor: 'pointer', fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>+</button>}
                  </span>
                  <span style={{ color: 'var(--v2-ink2)' }}>{x.responsavelNome || '--'}</span>
                  <span style={{ color: 'var(--v2-ink3)' }}>{x.clienteNome || '--'}</span>
                  <span style={{ color: ehAtrasado(x.prazo, x.status) ? 'var(--v2-hot)' : 'var(--v2-ink3)', fontWeight: ehAtrasado(x.prazo, x.status) ? 700 : 500 }}>{prazoFormatado(x.prazo) || '--'}{ehAtrasado(x.prazo, x.status) ? ' (atrasado)' : ''}</span>
                  <span style={{ color: corPrioridade(x.prioridade), fontWeight: 700 }}>{PRIORIDADES.find(p => p.key === x.prioridade)?.label || x.prioridade}</span>
                  <span style={{ fontSize: 11 }}>{COLUNAS.find(c => c.key === x.status)?.label || x.status}</span>
                  {podeExcluir && <button onClick={e => { e.stopPropagation(); excluirUma(x.id, x.titulo) }} title={ehSub ? 'Excluir subtarefa' : 'Excluir tarefa'}
                    style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'none', color: 'var(--v2-ink3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, lineHeight: 1, padding: 0 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--v2-hot)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--v2-hot-bg)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--v2-rule2)'; (e.currentTarget as HTMLButtonElement).style.background = 'none' }}>×</button>}
                </div>
              )
            }
            return (
              <div key={t.id}>
                {linha(t, false)}
                {!subsRecolhidas[t.id] && subs.map(s => linha(s, true))}
                {quickSubId === t.id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px 8px 138px', borderBottom: '1px solid var(--v2-rule)', background: 'var(--v2-surface)' }}>
                    <input autoFocus value={quickSubTexto} onChange={e => setQuickSubTexto(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && quickSubTexto.trim()) { criarSubtarefa(t, quickSubTexto) } if (e.key === 'Escape') setQuickSubId(null) }}
                      placeholder="Nome da subtarefa — Enter para adicionar, Esc para fechar"
                      style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--v2-rule)', fontSize: 12.5, fontFamily: 'inherit' }} />
                    <button onClick={() => criarSubtarefa(t, quickSubTexto)} disabled={!quickSubTexto.trim()} style={{ padding: '7px 12px', background: quickSubTexto.trim() ? 'var(--v2-ink)' : 'var(--v2-surface2)', color: quickSubTexto.trim() ? 'var(--v2-surface)' : 'var(--v2-ink3)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Adicionar</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* LIXEIRA */}
      {mostrarLixeira && (
        <div style={{ background: 'var(--v2-surface)', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--v2-rule)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v2-hot)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--v2-ink)' }}>Tarefas excluidas</span>
            <span style={{ fontSize: 11, color: 'var(--v2-ink3)' }}>Removidas automaticamente apos 30 dias</span>
          </div>
          {excluidas.length === 0 && <p style={{ margin: 0, padding: 40, textAlign: 'center', color: 'var(--v2-ink3)', fontSize: 13 }}>Nenhuma tarefa na lixeira.</p>}
          {excluidas.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--v2-rule)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: 'var(--v2-ink2)', textDecoration: 'line-through' }}>{t.titulo}</p>
                <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--v2-ink3)' }}>
                  {t.clienteNome && <span>{t.clienteNome}</span>}
                  {t.excluidoPor && <span>Excluida por {t.excluidoPor}</span>}
                  <span>{diasRestantes(t.excluidoEm)} dia(s) restante(s)</span>
                </div>
              </div>
              <button onClick={() => restaurarTarefa(t.id)} style={{ padding: '6px 14px', background: 'var(--v2-ok-bg)', border: '1px solid var(--v2-ok-bg)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'var(--v2-ok)', cursor: 'pointer' }}>Restaurar</button>
              {podeExcluir && <button onClick={() => setConfirmPopup({ mensagem: `Excluir "${t.titulo}" permanentemente? Esta acao nao pode ser desfeita.`, onConfirm: () => { excluirPermanente(t.id); setConfirmPopup(null) } })}
                style={{ padding: '6px 14px', background: 'var(--v2-hot-bg)', border: '1px solid var(--v2-hot-bg)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'var(--v2-hot)', cursor: 'pointer' }}>Excluir</button>}
            </div>
          ))}
        </div>
      )}

      {/* Modal nova/editar tarefa */}
      {(novaModal || editModal) && (
        <TarefaModal responsavelPadrao={responsavelFixo} key={editModal?.id || 'novo'} tarefa={editModal} clientes={clientes} usuarios={usuarios}
          tiposCustom={tiposCustom} onTiposCustom={aplicarTiposCustom}
          viewMode={editModal ? tarefaViewMode : 'modal'}
          onChangeViewMode={setTarefaViewMode}
          onClose={() => { setNovaModal(false); setEditModal(null) }}
          onSalvo={() => { if (tarefaViewMode !== 'sidebar') { setNovaModal(false); setEditModal(null) }; carregar() }}
          onRecarregar={(t) => { setEditModal(t); carregar() }}
          onExcluir={editModal && podeExcluir ? () => {
            const id = editModal.id
            const titulo = editModal.titulo
            setConfirmPopup({
              mensagem: `Excluir a tarefa "${editModal.titulo}"?`,
              onConfirm: async () => {
                await fetch(`/api/tarefas?id=${id}`, { method: 'DELETE' })
                registrarDesfazer(`Exclusão de "${titulo}"`, async () => {
                  const r = await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, restaurar: true }) }).catch(() => null)
                  carregar()
                  return !!r?.ok
                })
                setEditModal(null); setConfirmPopup(null); carregar()
              }
            })
          } : undefined}
        />
      )}
    </div>
  )
}

export function TarefaModal({ tarefa: tarefaEntrada, clientes, usuarios, responsavelPadrao, responsavelPorTipo, tiposCustom = [], onTiposCustom, onClose, onSalvo, onExcluir, onRecarregar, viewMode = 'modal', onChangeViewMode }: {
  tarefa: Tarefa | null; clientes: Cliente[]; usuarios: Usuario[]; responsavelPadrao?: string
  // Playbook: quem recebe a tarefa segundo o squad do cliente, por tipo (lib/responsavelPorTipo). So em tarefa NOVA.
  responsavelPorTipo?: (tipo: string) => string
  tiposCustom?: { key: string; label: string; cor: string; icone: string }[]
  onTiposCustom?: (lista: { key: string; label: string; cor: string; icone: string }[]) => void
  onClose: () => void; onSalvo: () => void; onExcluir?: () => void; onRecarregar?: (tarefaAtualizada: Tarefa) => void
  viewMode?: 'modal' | 'fullscreen' | 'sidebar'; onChangeViewMode?: (m: 'modal' | 'fullscreen' | 'sidebar') => void
}) {
  // `tarefa` = edição (existe no banco). O Playbook passa um objeto SEM id só para
  // pré-preencher (cliente, marco, tipo): isso é criação — POST, sem atividade/comentários.
  const tarefa: Tarefa | null = tarefaEntrada && tarefaEntrada.id ? tarefaEntrada : null
  const [form, setForm] = useState({
    titulo: tarefaEntrada?.titulo || '', descricao: tarefaEntrada?.descricao || '',
    tipo: tarefaEntrada?.tipo || 'tarefa',
    status: tarefaEntrada?.status || 'a_fazer', prioridade: tarefaEntrada?.prioridade || 'media',
    responsavelEmail: tarefaEntrada?.responsavelEmail || responsavelPadrao || '', clienteId: tarefaEntrada?.clienteId || (clientes.length === 1 ? clientes[0].id : ''),
    marcoId: (tarefaEntrada as any)?.marcoId || '',
    subetapaId: (tarefaEntrada as any)?.subetapaId || '',
    prazo: tarefaEntrada?.prazo ? tarefaEntrada.prazo.split('T')[0] : '',
    recorrencia: (tarefaEntrada as any)?.recorrencia || '',
    origemPostId: (tarefaEntrada as any)?.origemPostId || '',
  })
  const [marcos, setMarcos] = useState<{ id: string; titulo: string; subetapas?: { id: string; titulo: string }[] }[]>([])
  // Responsavel automatico por tipo (squad do cliente): tarefa nova segue o tipo escolhido.
  useEffect(() => {
    if (tarefa?.id || !responsavelPorTipo) return
    const sugerido = responsavelPorTipo(form.tipo)
    if (sugerido) setForm(f => ({ ...f, responsavelEmail: sugerido }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.tipo])
  // Vincular PAUTA do Studio: ao escolher o cliente, lista as pautas dele (da
  // esteira) para criar a tarefa de produção já com briefing + copy + anexos.
  const [pautasCliente, setPautasCliente] = useState<any[]>([])
  useEffect(() => {
    if (!form.clienteId) { setPautasCliente([]); return }
    let vivo = true
    // `esteira=1`: as pautas EM PRODUÇÃO (briefing/copy/criativo) só saem da rota com isso.
    // Sem esse parâmetro a lista vinha praticamente vazia e não dava para vincular a pauta
    // que estava justamente em produção — a raiz do "anexei o criativo e nada foi ao Studio".
    fetch(`/api/posts?clienteId=${form.clienteId}&esteira=1`).then(r => r.json()).then(d => {
      if (!vivo) return
      const arr = Array.isArray(d) ? d : []
      // Em produção OU já vinculada a esta tarefa (para o select mostrar o vínculo atual).
      setPautasCliente(arr.filter((p: any) => (p.etapa && p.etapa !== 'pronto') || p.id === form.origemPostId))
    }).catch(() => { if (vivo) setPautasCliente([]) })
    return () => { vivo = false }
  }, [form.clienteId, form.origemPostId])
  const ROTULO_ETAPA: Record<string, string> = { briefing: 'Briefing', copy: 'Copy', aprovacao_copy: 'Aprovação de copy', criativo: 'Criativo', aprovacao_criativo: 'Aprovação de criativo' }
  function vincularPauta(id: string) {
    const p = pautasCliente.find((x: any) => x.id === id)
    if (!p) { setForm(f => ({ ...f, origemPostId: '' })); return }
    const anx = [
      ...(p.anexos || []),
      ...((p.laminas || []).map((l: any, i: number) => l?.anexo ? { ...l.anexo, nome: `Lâmina ${i + 1} — ${l.anexo.nome}` } : null).filter(Boolean)),
    ]
    setAnexos(anx)
    const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const linhas = [
      p.briefing && `<strong>Briefing:</strong> ${esc(p.briefing)}`,
      p.headline && `<strong>Headline:</strong> ${esc(p.headline)}`,
      p.subheadline && `<strong>Sub-headline:</strong> ${esc(p.subheadline)}`,
      p.textoImagem && `<strong>Copy do criativo:</strong> ${esc(p.textoImagem)}`,
      p.cta && `<strong>CTA:</strong> ${esc(p.cta)}`,
      p.legenda && `<strong>Legenda:</strong> ${esc(p.legenda)}`,
    ].filter(Boolean).map(l => `<p>${l}</p>`).join('')
    const vazia = (v: string) => !v || v === '<p></p>' || v === '<br>'
    // Tarefa que já existe só GANHA o vínculo: título e descrição de quem está tocando
    // o trabalho não são reescritos (só preenchem se estiverem vazios).
    setForm(f => ({
      ...f, origemPostId: id,
      titulo: f.titulo.trim() || (p.briefing || p.headline || p.legenda || 'Pauta').slice(0, 80),
      tipo: f.tipo === 'tarefa' ? 'criativo' : f.tipo,
      descricao: vazia(f.descricao) ? linhas : f.descricao,
    }))
  }
  // Criar novo tipo de tarefa (padrao) direto daqui — fica fixo no dropdown e vale para tudo
  const [criandoTipo, setCriandoTipo] = useState(false)
  const [novoTipoLabel, setNovoTipoLabel] = useState('')
  const [novoTipoCor, setNovoTipoCor] = useState('var(--v2-ink3)')
  const [salvandoTipo, setSalvandoTipo] = useState(false)
  async function criarTipo() {
    const label = novoTipoLabel.trim()
    if (!label || salvandoTipo) return
    setSalvandoTipo(true)
    try {
      const r = await fetch('/api/tipos-tarefa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label, cor: novoTipoCor }) })
      const d = await r.json()
      if (r.ok && d?.tipo?.key) {
        onTiposCustom?.(d.tipos)
        setForm(f => ({ ...f, tipo: d.tipo.key }))
        setNovoTipoLabel(''); setNovoTipoCor('var(--v2-ink3)'); setCriandoTipo(false)
      } else {
        toast('Não foi possível criar o tipo: ' + (d?.error || 'erro desconhecido'), 'erro')
      }
    } catch { toast('Não foi possível criar o tipo.', 'erro') } finally { setSalvandoTipo(false) }
  }
  useEffect(() => {
    if (!form.clienteId) { setMarcos([]); return }
    fetch(`/api/playbook?clienteId=${form.clienteId}`).then(r => r.json()).then(d => setMarcos(Array.isArray(d) ? d : [])).catch(() => {})
  }, [form.clienteId])
  // Criar etapa do Playbook direto daqui (quando o cliente nao tem a fase desejada)
  const [criandoEtapa, setCriandoEtapa] = useState(false)
  const [novaEtapaTitulo, setNovaEtapaTitulo] = useState('')
  const [salvandoEtapa, setSalvandoEtapa] = useState(false)
  async function criarEtapaRapida() {
    const titulo = novaEtapaTitulo.trim()
    if (!titulo || !form.clienteId || salvandoEtapa) return
    setSalvandoEtapa(true)
    try {
      const cli = (clientes || []).find(c => c.id === form.clienteId)
      const r = await fetch('/api/playbook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId: form.clienteId, clienteNome: cli?.nome || '', titulo }) })
      const d = await r.json()
      if (r.ok && d?.marco?.id) {
        setMarcos(m => [...m, { id: d.marco.id, titulo: d.marco.titulo }])
        setForm(f => ({ ...f, marcoId: d.marco.id }))
        setNovaEtapaTitulo(''); setCriandoEtapa(false)
      } else {
        toast('Não foi possível criar a etapa: ' + (d?.error || 'erro desconhecido'), 'erro')
      }
    } catch { toast('Não foi possível criar a etapa.', 'erro') } finally { setSalvandoEtapa(false) }
  }
  const [anexos, setAnexos] = useState<Anexo[]>(tarefa?.anexos || [])
  const [enviandoAnexo, setEnviandoAnexo] = useState(false)
  const [progAnexo, setProgAnexo] = useState<number | null>(null)
  // Checklist (Definition of Done) — usa o salvo, senão o padrão do tipo
  const [checklist, setChecklist] = useState<{ id: string; texto: string; feito: boolean }[]>(
    ((tarefa as any)?.checklist?.length ? (tarefa as any).checklist : (DOD_POR_TIPO[tarefa?.tipo || 'tarefa'] || []).map((t: string) => ({ id: slug(), texto: t, feito: false })))
  )
  const [novoItemCheck, setNovoItemCheck] = useState('')
  function salvarChecklist(novo: { id: string; texto: string; feito: boolean }[]) {
    setChecklist(novo)
    if (tarefa?.id) fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tarefa.id, checklist: novo }) }).catch(() => {})
  }
  // Tarefas relacionadas (vinculo bidirecional manual)
  const [relacionadas, setRelacionadas] = useState<string[]>((tarefa as any)?.relacionadas || [])
  const [todasTarefas, setTodasTarefas] = useState<any[]>([])
  const [novoSub, setNovoSub] = useState('')
  function recarregarTodas() { fetch('/api/tarefas').then(r => r.json()).then(d => setTodasTarefas(Array.isArray(d) ? d : [])).catch(() => {}) }
  const subtarefas = todasTarefas.filter(s => s.tarefaPaiId === tarefa?.id)
  // Concluir a mãe com filhas abertas: pergunta antes de gravar (decisão do dono).
  const [perguntaConcluir, setPerguntaConcluir] = useState(false)
  const subsAbertas = subtarefas.filter(s => ['a_fazer', 'em_andamento', 'em_revisao'].includes(s.status))
  async function tirarDeDentro() {
    if (!tarefa) return
    const ok = await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tarefa.id, tarefaPaiId: null }) }).then(r => r.ok).catch(() => false)
    toast(ok ? 'Voltou a ser uma tarefa.' : 'Não foi possível tirar de dentro.', ok ? 'sucesso' : 'erro')
    if (ok) onSalvo()
  }
  const [buscaPuxar, setBuscaPuxar] = useState('')
  async function puxarExistente(id: string) {
    if (!tarefa) return
    const v = podeSerFilha(id, tarefa.id, todasTarefas as any)
    if (!v.ok) { toast(v.motivo || 'Vínculo não permitido.', 'erro'); return }
    const alvo = todasTarefas.find(t => t.id === id)!
    const c = camposAoVincular(alvo as any, tarefa as any)
    if (c.clienteMudou) {
      const ok = await confirmar(`"${alvo.titulo}" é de outro cliente e passa a ser de ${tarefa.clienteNome || 'sem cliente'}. Continuar?`, { titulo: 'Trocar o cliente da subtarefa', okLabel: 'Continuar' })
      if (!ok) return
    }
    const ok = await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, tarefaPaiId: tarefa.id }) }).then(r => r.ok).catch(() => false)
    if (!ok) { toast('Não foi possível puxar a tarefa.', 'erro'); return }
    setBuscaPuxar('')
    setTodasTarefas(ts => ts.map(t => t.id === id ? { ...t, ...c } : t))
    toast(`"${alvo.titulo}" agora é subtarefa daqui.`, 'sucesso')
  }
  async function addSubtarefa() {
    const t = novoSub.trim(); if (!t || !tarefa?.id) return
    setNovoSub('')
    await fetch('/api/tarefas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titulo: t, tarefaPaiId: tarefa.id, clienteId: tarefa.clienteId || '', clienteNome: tarefa.clienteNome || '', marcoId: (tarefa as any).marcoId || '' }) }).catch(() => {})
    recarregarTodas()
  }
  async function toggleSubtarefa(s: any) {
    await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, status: s.status === 'concluido' ? 'a_fazer' : 'concluido' }) }).catch(() => {})
    recarregarTodas()
  }
  const [buscaRel, setBuscaRel] = useState('')
  const [pickerRel, setPickerRel] = useState(false)
  useEffect(() => { if (tarefa?.id) fetch('/api/tarefas').then(r => r.json()).then(d => setTodasTarefas(Array.isArray(d) ? d : [])).catch(() => {}) }, [tarefa?.id])
  async function relacionarTarefa(outroId: string) {
    setRelacionadas(arr => Array.from(new Set([...arr, outroId])))
    setPickerRel(false); setBuscaRel('')
    if (tarefa?.id) await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tarefa.id, relacionarTarefa: outroId }) }).catch(() => {})
  }
  async function desrelacionarTarefa(outroId: string) {
    setRelacionadas(arr => arr.filter(x => x !== outroId))
    if (tarefa?.id) await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tarefa.id, desrelacionarTarefa: outroId }) }).catch(() => {})
  }
  // Documento e Mapa mental vinculados à tarefa
  const [documentoId, setDocumentoId] = useState<string>((tarefa as any)?.documentoId || '')
  const [mapaId, setMapaId] = useState<string>((tarefa as any)?.mapaId || '')
  const [docsList, setDocsList] = useState<{ id: string; titulo: string }[]>([])
  const [mapasList, setMapasList] = useState<{ id: string; titulo: string }[]>([])
  useEffect(() => {
    if (!tarefa?.id) return
    fetch('/api/documentos').then(r => r.json()).then(d => setDocsList(Array.isArray(d) ? d.map((x: any) => ({ id: x.id, titulo: x.titulo })) : [])).catch(() => {})
    fetch('/api/mapas').then(r => r.json()).then(d => setMapasList(Array.isArray(d) ? d.map((x: any) => ({ id: x.id, titulo: x.titulo })) : [])).catch(() => {})
  }, [tarefa?.id])
  async function vincularDoc(v: string) {
    setDocumentoId(v)
    if (tarefa?.id) await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tarefa.id, documentoId: v }) }).catch(() => {})
  }
  async function vincularMapa(v: string) {
    setMapaId(v)
    if (tarefa?.id) await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tarefa.id, mapaId: v }) }).catch(() => {})
  }
  // Apontamento de horas
  const [apontamentos, setApontamentos] = useState<any[]>((tarefa as any)?.apontamentos || [])
  const [apontH, setApontH] = useState('')
  const [apontM, setApontM] = useState('')
  const [apontDesc, setApontDesc] = useState('')
  const [salvandoApont, setSalvandoApont] = useState(false)
  const [timerInicio, setTimerInicio] = useState<number | null>(null)
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!tarefa?.id) return
    const s = localStorage.getItem(`apont:${tarefa.id}`)
    if (s) setTimerInicio(Number(s) || null)
  }, [tarefa?.id])
  useEffect(() => {
    if (timerInicio === null) return
    const t = setInterval(() => setTick(x => x + 1), 1000)
    return () => clearInterval(t)
  }, [timerInicio])
  const totalMin = apontamentos.reduce((s, a) => s + (Number(a.minutos) || 0), 0)
  function fmtMin(min: number) { return `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}` }
  async function registrarApont(minutos: number, descricao: string) {
    if (!tarefa?.id || minutos <= 0) return
    setSalvandoApont(true)
    const r = await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tarefa.id, apontarHoras: { minutos, descricao, data: new Date().toISOString() } }) }).then(x => x.json()).catch(() => null)
    setSalvandoApont(false)
    if (r?.tarefa) { setApontamentos(r.tarefa.apontamentos || []); setApontH(''); setApontM(''); setApontDesc(''); onRecarregar?.(r.tarefa) }
  }
  function iniciarTimer() { const t = Date.now(); setTimerInicio(t); if (tarefa?.id) localStorage.setItem(`apont:${tarefa.id}`, String(t)) }
  async function pararTimer() {
    if (timerInicio === null) return
    const min = Math.max(1, Math.round((Date.now() - timerInicio) / 60000))
    if (tarefa?.id) localStorage.removeItem(`apont:${tarefa.id}`)
    setTimerInicio(null)
    await registrarApont(min, 'Timer')
  }
  async function removerApont(apId: string) {
    if (!tarefa?.id) return
    const r = await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tarefa.id, removerApontamento: apId }) }).then(x => x.json()).catch(() => null)
    if (r?.tarefa) { setApontamentos(r.tarefa.apontamentos || []); onRecarregar?.(r.tarefa) }
  }
  const [salvando, setSalvando] = useState(false)
  const [abaInterna, setAbaInterna] = useState<'detalhes' | 'activity'>('detalhes')
  const [novoComentario, setNovoComentario] = useState('')
  const [enviandoComentario, setEnviandoComentario] = useState(false)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [mencaoQuery, setMencaoQuery] = useState('')
  const [mencaoAberta, setMencaoAberta] = useState(false)
  const [mencaoPos, setMencaoPos] = useState(0)
  const [editandoComentarioId, setEditandoComentarioId] = useState<string | null>(null)
  const [editandoComentarioTexto, setEditandoComentarioTexto] = useState('')

  function addAnotacao(idx: number, anotacao: Anotacao) {
    setAnexos(arr => arr.map((a, i) => i === idx ? { ...a, anotacoes: [...(a.anotacoes || []), anotacao] } : a))
  }
  function removeAnotacao(idx: number, anotacaoId: string) {
    setAnexos(arr => arr.map((a, i) => i === idx ? { ...a, anotacoes: (a.anotacoes || []).filter(an => an.id !== anotacaoId) } : a))
  }

  async function enviarAnexos(arquivos: File[], papel: 'referencia' | 'criativo' = 'referencia') {
    if (!arquivos.length) return
    setEnviandoAnexo(true)
    for (const arquivo of arquivos) {
      setProgAnexo(0)
      try {
        const ext = arquivo.name.split('.').pop() || 'bin'
        const blob = await upload(`tarefas/${uuid()}.${ext}`, arquivo, {
          access: 'public', handleUploadUrl: '/api/upload', contentType: arquivo.type, clientPayload: arquivo.type,
          onUploadProgress: ({ percentage }) => setProgAnexo(percentage),
        })
        setAnexos(a => [...a, { nome: arquivo.name, url: blob.url, tipo: arquivo.type, papel }])
      } catch { /* erro silencioso — segue para o próximo */ }
    }
    setEnviandoAnexo(false)
    setProgAnexo(null)
  }

  async function enviarComentario() {
    if (!tarefa || !novoComentario.trim()) return
    setEnviandoComentario(true)
    const res = await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tarefa.id, novoComentario: novoComentario.trim() }) }).catch(() => null)
    setNovoComentario('')
    setEnviandoComentario(false)
    if (res) {
      const data = await res.json().catch(() => null)
      if (data?.tarefa && onRecarregar) onRecarregar(data.tarefa)
    }
  }

  async function editarComentario(comentarioId: string, novoTexto: string) {
    if (!tarefa) return
    const res = await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tarefa.id, editarComentario: { id: comentarioId, texto: novoTexto } }) }).catch(() => null)
    if (res) {
      const data = await res.json().catch(() => null)
      if (data?.tarefa && onRecarregar) onRecarregar(data.tarefa)
    }
  }

  async function excluirComentario(comentarioId: string) {
    if (!tarefa) return
    const res = await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tarefa.id, excluirComentario: comentarioId }) }).catch(() => null)
    if (res) {
      const data = await res.json().catch(() => null)
      if (data?.tarefa && onRecarregar) onRecarregar(data.tarefa)
    }
  }

  // Snapshot inicial para detectar alterações não salvas (guarda ao fechar)
  const snapshotInicial = useRef<string | null>(null)
  useEffect(() => { snapshotInicial.current = JSON.stringify({ ...form, anexos }) }, [])
  // REGRA DO SISTEMA (dono, 08/09): alteração pendente ao fechar = SALVA sozinho; nunca "sair sem salvar".
  // salvar() valida (título, vínculo…), grava e chama onSalvo (que fecha); inválido = toast e segue aberto.
  async function fechar() {
    if (snapshotInicial.current !== null && JSON.stringify({ ...form, anexos }) !== snapshotInicial.current) { await salvar(); return }
    onClose()
  }

  async function salvar(concluirFilhasArg?: unknown) {
    const concluirFilhas = concluirFilhasArg === true // o botão Salvar passa o evento do clique
    // Mãe indo para "concluído" com filhas abertas: pergunta antes (Concluir subtarefas? Revisar?).
    if (tarefa && form.status === 'concluido' && tarefa.status !== 'concluido' && subsAbertas.length > 0 && !concluirFilhas && !perguntaConcluir) { setPerguntaConcluir(true); return }
    if (concluirFilhas && subsAbertas.length) {
      await Promise.all(subsAbertas.map(sub => fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sub.id, status: 'concluido' }) }).catch(() => {})))
    }
    setPerguntaConcluir(false)
    // Tarefa de PRODUÇÃO vinculada a pauta indo para "concluído" sem criativo pronto: avisa (a pauta voltaria ao Studio sem arte).
    if (tarefa && form.status === 'concluido' && tarefa.status !== 'concluido') {
      const aviso = avisoAoConcluir({ tipo: form.tipo, origemPostId: form.origemPostId, anexos })
      if (aviso && !(await confirmar(aviso, { titulo: 'Concluir sem criativo pronto?', okLabel: 'Concluir mesmo assim', cancelLabel: 'Voltar e anexar' }))) return
    }
    // Vinculo obrigatorio: tarefa de um cliente precisa de uma etapa do Playbook
    // Pauta vinculada dispensa a etapa do Playbook: a tarefa de produção nasce da esteira.
    if (!PERFIL_CLINICA_TAREFAS && form.clienteId && !form.marcoId && !form.origemPostId) { toast('Vincule a tarefa a um marco ou etapa do Playbook do cliente (campo "Marco ou etapa do Playbook").', 'erro'); return }
    setSalvando(true)
    const resp = (usuarios || []).find(u => u.email === form.responsavelEmail)
    const cli = (clientes || []).find(c => c.id === form.clienteId)
    const body = { ...form, anexos, responsavelNome: resp?.nome || '', clienteNome: cli?.nome || '', prazo: form.prazo ? new Date(form.prazo + 'T23:59:59').toISOString() : '' }
    if (tarefa) {
      // DESFAZER: guarda o valor ANTERIOR de cada campo que o formulário mexe.
      const antes: Record<string, any> = { id: tarefa.id }
      for (const k of Object.keys(body)) antes[k] = (tarefa as any)[k] ?? (Array.isArray((body as any)[k]) ? [] : '')
      await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tarefa.id, ...body }) })
      registrarDesfazer(`Edição de "${tarefa.titulo}"`, async () => {
        const r = await fetch('/api/tarefas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(antes) }).catch(() => null)
        onSalvo() // recarrega a lista de trás (o modal já fechou quando o Ctrl+Z acontece)
        return !!r?.ok
      })
    } else {
      await fetch('/api/tarefas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
    setSalvando(false)
    onSalvo()
  }

  const showActivitySide = tarefa && viewMode !== 'sidebar'

  const wrapperStyle: Record<string, any> = {
    modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
    fullscreen: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
    sidebar: { position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, background: 'var(--v2-surface)', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', zIndex: 1000, overflow: 'auto' },
  }
  const outerPanelStyle: Record<string, any> = {
    modal: { background: 'var(--v2-surface)', borderRadius: 16, maxWidth: showActivitySide ? 960 : 640, width: '100%', maxHeight: '90vh', display: 'flex', overflow: 'hidden' },
    fullscreen: { background: 'var(--v2-surface)', borderRadius: 16, maxWidth: 1100, width: '100%', maxHeight: '94vh', display: 'flex', overflow: 'hidden' },
    sidebar: { display: 'flex', flexDirection: 'column' as const },
  }

  const anexosComAnotacoes = anexos.filter(a => (a.anotacoes || []).length > 0)

  const activityPanel = tarefa && (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <h4 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: 'var(--v2-ink)' }}>Activity</h4>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 14 }}>
        {/* Anexos com miniatura clicavel */}
        {anexos.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Anexos</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {anexos.map((a, i) => (
                <div key={i} onClick={() => setViewerIndex(i)} style={{ position: 'relative', width: 56, height: 56, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--v2-rule)', cursor: 'pointer' }}>
                  {a.tipo.startsWith('image') ? (
                    <img src={a.url} alt={a.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : a.tipo.startsWith('video') ? (
                    <video src={a.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted preload="metadata" />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: 'var(--v2-surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v2-ink3)" strokeWidth="1.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/></svg>
                    </div>
                  )}
                  {(a.anotacoes || []).length > 0 && (
                    <span style={{ position: 'absolute', top: 1, left: 1, background: 'var(--v2-hot)', color: 'var(--v2-surface)', borderRadius: 999, minWidth: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, padding: '0 3px' }}>{a.anotacoes!.length}</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Correcoes marcadas */}
        {anexosComAnotacoes.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--v2-hot)', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Correcoes marcadas</div>
            {anexosComAnotacoes.map((a, ai) => {
              const realIdx = anexos.indexOf(a)
              return (
              <div key={ai} style={{ marginBottom: 12 }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: 'var(--v2-ink2)' }}>{a.nome}</p>
                {(a.anotacoes || []).map((an, idx) => (
                  <div key={an.id} onClick={() => setViewerIndex(realIdx)} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--v2-surface1)', cursor: 'pointer' }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--v2-hot)', color: 'var(--v2-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>{idx + 1}</div>
                    <div>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--v2-ink2)', lineHeight: 1.3 }}>{an.texto}</p>
                      <p style={{ margin: '1px 0 0', fontSize: 9, color: 'var(--v2-ink3)' }}>{an.autorNome || 'Voce'} · {new Date(an.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            )})}
          </>
        )}

        {/* Historico */}
        {(tarefa.atividades || []).length > 0 && (
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--v2-ink3)', margin: '4px 0 8px', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Histórico</div>
        )}
        {(tarefa.atividades || []).map((a: any) => (
          <div key={a.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--v2-surface1)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: a.tipo === 'comentario' ? 'var(--v2-info)' : a.tipo === 'status' ? 'var(--v2-amber-on)' : 'var(--v2-rule2)', marginTop: 5, flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--v2-ink2)', whiteSpace: 'pre-wrap' }}><TextoComMencoes texto={a.descricao || ''} /></p>
              <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--v2-ink3)' }}>{a.autor} · {new Date(a.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        ))}
        {anexos.length === 0 && (tarefa.comentarios || []).length === 0 && (tarefa.atividades || []).length === 0 && <p style={{ margin: 0, fontSize: 12, color: 'var(--v2-ink3)' }}>Nenhuma atividade ainda.</p>}

        {(tarefa.comentarios || []).length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--v2-ink3)', margin: '14px 0 8px', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>Comentários</div>
            {(tarefa.comentarios || []).map((c: any) => (
              <div key={c.id} style={{ background: 'var(--v2-surface1)', borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--v2-ink)' }}>{c.autorNome}</span>
                  <span style={{ fontSize: 10, color: 'var(--v2-ink3)' }}>{new Date(c.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    <button onClick={() => { setEditandoComentarioId(c.id); setEditandoComentarioTexto(c.texto) }} title="Editar" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: 0.4 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v2-ink2)" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={() => excluirComentario(c.id)} title="Excluir" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: 0.4 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v2-hot)" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>
                {editandoComentarioId === c.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <textarea lang="pt-BR" value={editandoComentarioTexto} onChange={e => setEditandoComentarioTexto(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--v2-rule)', fontSize: 12, minHeight: 40, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} autoFocus />
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditandoComentarioId(null)} style={{ padding: '4px 10px', background: 'var(--v2-surface1)', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, color: 'var(--v2-ink2)', cursor: 'pointer' }}>Cancelar</button>
                      <button onClick={() => { editarComentario(c.id, editandoComentarioTexto); setEditandoComentarioId(null) }} disabled={!editandoComentarioTexto.trim()}
                        style={{ padding: '4px 10px', background: 'var(--v2-ink)', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, color: 'var(--v2-surface)', cursor: 'pointer' }}>Salvar</button>
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--v2-ink)', whiteSpace: 'pre-wrap' }}><TextoComMencoes texto={c.texto} /></p>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--v2-rule)', paddingTop: 12, position: 'relative' }}>
        {mencaoAberta && (() => {
          const filtrados = (usuarios || []).filter(u => u.role !== 'cliente' && u.nome.toLowerCase().includes(mencaoQuery.toLowerCase()))
          return filtrados.length > 0 ? (
            <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: 160, overflowY: 'auto', zIndex: 10, marginBottom: 4 }}>
              {filtrados.map(u => (
                <button key={u.email} onClick={() => {
                  const antes = novoComentario.slice(0, mencaoPos)
                  const depois = novoComentario.slice(mencaoPos + mencaoQuery.length + 1)
                  setNovoComentario(antes + '@' + u.nome + ' ' + depois)
                  setMencaoAberta(false)
                }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12 }}>
                  {u.foto ? <img src={u.foto} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--v2-surface2)' }} />}
                  <span style={{ fontWeight: 600, color: 'var(--v2-ink)' }}>{u.nome}</span>
                  <span style={{ color: 'var(--v2-ink3)', fontSize: 10 }}>{u.role}</span>
                </button>
              ))}
            </div>
          ) : null
        })()}
        <textarea lang="pt-BR" value={novoComentario} onChange={e => {
          const v = e.target.value
          setNovoComentario(v)
          const pos = e.target.selectionStart || 0
          const textoBefore = v.slice(0, pos)
          const arroba = textoBefore.lastIndexOf('@')
          if (arroba >= 0 && (arroba === 0 || v[arroba - 1] === ' ' || v[arroba - 1] === '\n')) {
            const query = textoBefore.slice(arroba + 1)
            if (!query.includes(' ') || query.length < 30) { setMencaoAberta(true); setMencaoQuery(query); setMencaoPos(arroba) }
            else setMencaoAberta(false)
          } else setMencaoAberta(false)
        }} placeholder="Escreva um comentário... Use @ para mencionar"
          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--v2-rule)', fontSize: 12, minHeight: 50, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !mencaoAberta) { e.preventDefault(); enviarComentario() } }} />
        <button onClick={enviarComentario} disabled={enviandoComentario || !novoComentario.trim()}
          style={{ width: '100%', padding: '8px 0', background: novoComentario.trim() ? 'var(--v2-ink)' : 'var(--v2-surface2)', color: novoComentario.trim() ? 'var(--v2-surface)' : 'var(--v2-ink3)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: novoComentario.trim() ? 'pointer' : 'not-allowed' }}>
          Enviar
        </button>
      </div>
    </div>
  )

  // Portal: fora do painel, acima dos controles flutuantes (fixed z=120) e de qualquer
  // contexto de empilhamento das telas animadas. Tokens vivem em :root, então o tema vale.
  if (typeof document === 'undefined') return null
  return createPortal(
    <div onClick={viewMode !== 'sidebar' ? fechar : undefined} style={wrapperStyle[viewMode]}>
      <div onClick={e => e.stopPropagation()} style={outerPanelStyle[viewMode]}>
        {/* Lado esquerdo — Detalhes */}
        <div style={{ flex: 1, overflowY: 'auto', padding: viewMode === 'sidebar' ? 22 : 24, display: 'flex', flexDirection: 'column' }}>
          {/* Cabecalho com titulo + botoes de modo */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--v2-ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {tarefa ? (<>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tipoInfo(form.tipo).cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={tipoInfo(form.tipo).icone} /></svg>
                Editar {tipoInfo(form.tipo).label.toLowerCase()}
              </>) : 'Nova tarefa'}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {tarefa && onChangeViewMode && (['modal', 'fullscreen', 'sidebar'] as const).map(m => (
                <button key={m} onClick={() => onChangeViewMode(m)} title={m === 'modal' ? 'Modal' : m === 'fullscreen' ? 'Tela cheia' : 'Sidebar'}
                  style={{ width: 28, height: 28, borderRadius: 6, border: viewMode === m ? '1.5px solid var(--v2-amber-on)' : '1px solid var(--v2-rule)', background: viewMode === m ? 'var(--v2-amber-bg)' : 'var(--v2-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {m === 'modal' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={viewMode === m ? 'var(--v2-ink)' : 'var(--v2-ink3)'} strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2" /></svg>}
                  {m === 'fullscreen' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={viewMode === m ? 'var(--v2-ink)' : 'var(--v2-ink3)'} strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="2" /></svg>}
                  {m === 'sidebar' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={viewMode === m ? 'var(--v2-ink)' : 'var(--v2-ink3)'} strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="2" /><path d="M14 2v20" /></svg>}
                </button>
              ))}
              <button onClick={fechar} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', cursor: 'pointer', fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--v2-ink3)' }}>x</button>
            </div>
          </div>

          {/* Breadcrumb de subtarefa — identifica que esta tarefa e filha e de quem (estilo ClickUp) */}
          {tarefa?.tarefaPaiId && (() => {
            const mae = todasTarefas.find(t => t.id === tarefa.tarefaPaiId)
            return (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, alignSelf: 'flex-start', margin: '-6px 0 16px', padding: '6px 12px', background: 'var(--v2-info-bg)', border: '1px solid var(--v2-info-bg)', borderRadius: 8, fontSize: 12, color: 'var(--v2-info)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4v6a4 4 0 0 0 4 4h7" /><path d="M16 10l4 4-4 4" /></svg>
                <span style={{ color: '#60a5fa', fontWeight: 600 }}>Subtarefa de</span>
                <button type="button" onClick={() => mae && onRecarregar?.(mae)} disabled={!mae}
                  style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 800, color: 'var(--v2-info)', cursor: mae ? 'pointer' : 'default', textDecoration: mae ? 'underline' : 'none', fontFamily: 'inherit' }}>
                  {mae?.titulo || 'tarefa-mãe'}
                </button>
                <button type="button" onClick={tirarDeDentro} title="Tirar de dentro (volta a ser tarefa de primeiro nível)"
                  style={{ marginLeft: 6, background: 'none', border: '1px solid var(--v2-rule)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: 'var(--v2-ink2)', cursor: 'pointer', fontFamily: 'inherit' }}>Tirar de dentro</button>
              </div>
            )
          })()}

          {/* Abas internas — so no sidebar (sem espaco lateral pra activity) */}
          {tarefa && viewMode === 'sidebar' && (
            <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid var(--v2-rule)' }}>
              {(['detalhes', 'activity'] as const).map(a => (
                <button key={a} onClick={() => setAbaInterna(a)} style={{
                  padding: '8px 18px', border: 'none', borderBottom: abaInterna === a ? '2px solid var(--v2-amber-on)' : '2px solid transparent',
                  background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: abaInterna === a ? 700 : 500, color: abaInterna === a ? 'var(--v2-ink)' : 'var(--v2-ink3)',
                }}>{a === 'detalhes' ? 'Detalhes' : 'Activity'}</button>
              ))}
            </div>
          )}

          {/* DETALHES */}
          {(!tarefa || viewMode !== 'sidebar' || abaInterna === 'detalhes') && (<>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Titulo *</label>
                <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="O que precisa ser feito?"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div style={{ width: 160 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Tipo</label>
                <div style={{ position: 'relative' }}>
                  <select value={form.tipo} onChange={e => { if (e.target.value === '__novo__') { setCriandoTipo(true) } else { setForm(f => ({ ...f, tipo: e.target.value })) } }}
                    style={{ width: '100%', padding: '10px 12px 10px 32px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface)', appearance: 'none', boxSizing: 'border-box' }}>
                    {[...tiposBase(), ...tiposCustom].map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                    <option value="__novo__">+ Criar novo tipo...</option>
                  </select>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tipoInfo(form.tipo).cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <path d={tipoInfo(form.tipo).icone} />
                  </svg>
                  {criandoTipo && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 30, width: 250, background: 'var(--v2-surface)', border: '1.5px solid var(--v2-rule)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.14)', padding: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--v2-ink)', marginBottom: 8 }}>Novo tipo de tarefa</div>
                      <input autoFocus value={novoTipoLabel} onChange={e => setNovoTipoLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); criarTipo() } }} placeholder="Ex: Newsletter, Podcast..."
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 12, color: 'var(--v2-ink3)', fontWeight: 600 }}>Cor</span>
                        <input type="color" value={novoTipoCor} onChange={e => setNovoTipoCor(e.target.value)}
                          style={{ width: 34, height: 28, border: '1px solid var(--v2-rule)', borderRadius: 6, padding: 0, cursor: 'pointer', background: 'var(--v2-surface)' }} />
                        <span style={{ fontSize: 11, color: 'var(--v2-ink3)' }}>{novoTipoCor}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={criarTipo} disabled={!novoTipoLabel.trim() || salvandoTipo}
                          style={{ flex: 1, padding: '8px 0', background: novoTipoLabel.trim() ? 'var(--v2-ink)' : 'var(--v2-surface2)', color: novoTipoLabel.trim() ? 'var(--v2-surface)' : 'var(--v2-ink3)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: novoTipoLabel.trim() && !salvandoTipo ? 'pointer' : 'not-allowed' }}>{salvandoTipo ? 'Criando...' : 'Criar tipo'}</button>
                        <button type="button" onClick={() => { setCriandoTipo(false); setNovoTipoLabel('') }}
                          style={{ padding: '8px 12px', background: 'var(--v2-surface)', color: 'var(--v2-ink2)', border: '1.5px solid var(--v2-rule)', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                      </div>
                      <p style={{ margin: '8px 0 0', fontSize: 10.5, color: 'var(--v2-ink3)', lineHeight: 1.4 }}>Fica fixo no dropdown e disponível em todas as tarefas.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: PERFIL_CLINICA_TAREFAS ? '1fr' : '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Responsável</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {(() => { const u = (usuarios || []).find(x => x.email === form.responsavelEmail); return u?.foto ? <OptImg src={u.foto} size={28} style={{ flexShrink: 0 }} /> : null })()}
                  <select value={form.responsavelEmail} onChange={e => setForm(f => ({ ...f, responsavelEmail: e.target.value }))}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface)' }}>
                    <option value="">Sem responsável</option>
                    {(() => {
                      const squadEmails = ((clientes || []).find(c => c.id === form.clienteId)?.squad || [])
                      const time = (usuarios || []).filter(u => u.role !== 'cliente')
                      const naSquad = time.filter(u => squadEmails.includes(u.email))
                      const resto = time.filter(u => !squadEmails.includes(u.email))
                      if (!naSquad.length) return time.map(u => <option key={u.email} value={u.email}>{u.nome}</option>)
                      return <>
                        <optgroup label="Squad do cliente">{naSquad.map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}</optgroup>
                        <optgroup label="Outros">{resto.map(u => <option key={u.email} value={u.email}>{u.nome}</option>)}</optgroup>
                      </>
                    })()}
                  </select>
                </div>
              </div>
              {!PERFIL_CLINICA_TAREFAS && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Cliente vinculado</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {(() => { const c = (clientes || []).find(x => x.id === form.clienteId); return c?.logo ? <OptImg src={c.logo} size={28} style={{ flexShrink: 0 }} /> : null })()}
                  <select value={form.clienteId} onChange={e => {
                    const cid = e.target.value
                    const sq = ((clientes || []).find(c => c.id === cid)?.squad || []).filter(em => (usuarios || []).some(u => u.email === em && u.role !== 'cliente'))
                    // Ao escolher o cliente, sugere o 1º membro do squad como responsável (só se ainda vazio).
                    setForm(f => ({ ...f, clienteId: cid, marcoId: '', subetapaId: '', responsavelEmail: (!f.responsavelEmail && sq.length) ? sq[0] : f.responsavelEmail }))
                  }}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface)' }}>
                    <option value="">Nenhum</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              </div>
              )}
            </div>
            {!PERFIL_CLINICA_TAREFAS && form.clienteId && (pautasCliente.length > 0 || !!form.origemPostId) && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Pauta do Studio <span style={{ fontWeight: 400, color: 'var(--v2-ink3)' }}>{tarefa?.id ? '(o criativo pronto volta para ela)' : '(traz briefing, copy e anexos)'}</span></label>
                <select value={form.origemPostId} onChange={e => vincularPauta(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${form.origemPostId ? 'var(--v2-info)' : 'var(--v2-rule)'}`, fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface)' }}>
                  <option value="">Nenhuma — tarefa avulsa</option>
                  {pautasCliente.map((p: any) => (
                    <option key={p.id} value={p.id}>{(p.briefing || p.headline || p.legenda || 'Pauta sem título').slice(0, 60)} · {ROTULO_ETAPA[p.etapa] || p.etapa}{p.tarefaId ? ' (já tem tarefa)' : ''}</option>
                  ))}
                </select>
                {form.origemPostId && <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--v2-info)' }}>Pauta vinculada — anexe o criativo pronto; ao concluir, a pauta volta ao Studio com ele para revisão interna e envio.</p>}
              </div>
            )}
            {!PERFIL_CLINICA_TAREFAS && (
            <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)' }}>Marco ou etapa do Playbook {form.origemPostId ? '' : '*'}</label>
                  {form.clienteId && !criandoEtapa && <button type="button" onClick={() => setCriandoEtapa(true)} style={{ background: 'none', border: 'none', color: 'var(--v2-info)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: 0 }}>+ Criar marco</button>}
                </div>
                {!form.clienteId && (
                  <select disabled value="" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface1)', color: 'var(--v2-ink3)' }}>
                    <option value="">Selecione um &quot;Cliente vinculado&quot; primeiro...</option>
                  </select>
                )}
                {form.clienteId && !criandoEtapa && (<>
                  {/* MARCO > ETAPA (dono, 08/09): a tarefa pode apontar para o marco inteiro ou para uma etapa dentro dele.
                      Valor composto "marcoId::subetapaId" para a etapa; a tarefa guarda os dois campos. */}
                  <select value={form.subetapaId ? `${form.marcoId}::${form.subetapaId}` : form.marcoId}
                    onChange={e => { const v = e.target.value; if (v === '__nova__') { setCriandoEtapa(true) } else { const [mid, sid] = v.split('::'); setForm(f => ({ ...f, marcoId: mid || '', subetapaId: sid || '' })) } }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface)' }}>
                    <option value="">{marcos.length === 0 ? 'Nenhum marco — crie um abaixo' : 'Selecione o marco ou a etapa...'}</option>
                    {marcos.map(m => (m.subetapas && m.subetapas.length) ? (
                      <optgroup key={m.id} label={m.titulo}>
                        <option value={m.id}>{m.titulo} (o marco inteiro)</option>
                        {m.subetapas.map(se => <option key={se.id} value={`${m.id}::${se.id}`}>{'\u00a0\u00a0\u2514 '}{se.titulo}</option>)}
                      </optgroup>
                    ) : <option key={m.id} value={m.id}>{m.titulo}</option>)}
                    <option value="__nova__">+ Criar novo marco...</option>
                  </select>
                  {marcos.length === 0 && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#ea580c' }}>Este cliente não tem marcos no Playbook. Clique em "+ Criar marco".</p>}
                </>)}
                {form.clienteId && criandoEtapa && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input autoFocus value={novaEtapaTitulo} onChange={e => setNovaEtapaTitulo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); criarEtapaRapida() } }} placeholder="Nome da etapa (ex: Conteudos Julho)"
                      style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    <button type="button" onClick={criarEtapaRapida} disabled={!novaEtapaTitulo.trim() || salvandoEtapa}
                      style={{ padding: '10px 14px', background: novaEtapaTitulo.trim() ? 'var(--v2-ink)' : 'var(--v2-surface2)', color: novaEtapaTitulo.trim() ? 'var(--v2-surface)' : 'var(--v2-ink3)', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: novaEtapaTitulo.trim() && !salvandoEtapa ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>{salvandoEtapa ? '...' : 'Criar'}</button>
                    <button type="button" onClick={() => { setCriandoEtapa(false); setNovaEtapaTitulo('') }}
                      style={{ padding: '10px 12px', background: 'var(--v2-surface)', color: 'var(--v2-ink2)', border: '1.5px solid var(--v2-rule)', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                  </div>
                )}
            </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Prazo</label>
                <input type="date" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Prioridade</label>
                <select value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface)' }}>
                  {PRIORIDADES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface)' }}>
                  {COLUNAS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Recorrência</label>
              <select value={(form as any).recorrencia} onChange={e => setForm(f => ({ ...f, recorrencia: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface)' }}>
                <option value="">Não repete</option>
                <option value="diaria">Diária</option>
                <option value="semanal">Semanal</option>
                <option value="quinzenal">Quinzenal</option>
                <option value="mensal">Mensal</option>
              </select>
              {(form as any).recorrencia && <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--v2-ink3)' }}>Ao concluir, uma nova ocorrência é criada com o prazo avançado.</p>}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Descrição</label>
              <RichText value={form.descricao} onChange={d => setForm(f => ({ ...f, descricao: d }))} placeholder="Detalhes, contexto, links..." minHeight={80} />
            </div>
          </div>
          {/* Checklist (Definition of Done) */}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)' }}>Checklist {checklist.length > 0 && <span style={{ color: 'var(--v2-ok)' }}>({checklist.filter(c => c.feito).length}/{checklist.length})</span>}</label>
              {checklist.length === 0 && (DOD_POR_TIPO[form.tipo] || []).length > 0 && (
                <button type="button" onClick={() => salvarChecklist((DOD_POR_TIPO[form.tipo] || []).map(t => ({ id: slug(), texto: t, feito: false })))} style={{ background: 'none', border: 'none', color: 'var(--v2-info)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: 0 }}>Usar checklist de {tipoInfo(form.tipo).label}</button>
              )}
            </div>
            {checklist.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                {checklist.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button type="button" onClick={() => salvarChecklist(checklist.map(c => c.id === item.id ? { ...c, feito: !c.feito } : c))}
                      style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${item.feito ? 'var(--v2-ok)' : 'var(--v2-rule2)'}`, background: item.feito ? 'var(--v2-ok)' : 'var(--v2-surface)', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      {item.feito && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--v2-surface)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                    </button>
                    <span style={{ flex: 1, fontSize: 13, color: item.feito ? 'var(--v2-ink3)' : 'var(--v2-ink)', textDecoration: item.feito ? 'line-through' : 'none' }}>{item.texto}</span>
                    <button type="button" onClick={() => salvarChecklist(checklist.filter(c => c.id !== item.id))} style={{ background: 'none', border: 'none', color: 'var(--v2-ink3)', cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={novoItemCheck} onChange={e => setNovoItemCheck(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && novoItemCheck.trim()) { e.preventDefault(); salvarChecklist([...checklist, { id: slug(), texto: novoItemCheck.trim(), feito: false }]); setNovoItemCheck('') } }} placeholder="+ item do checklist"
                style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--v2-rule)', fontSize: 12.5, fontFamily: 'inherit' }} />
              <button type="button" disabled={!novoItemCheck.trim()} onClick={() => { salvarChecklist([...checklist, { id: slug(), texto: novoItemCheck.trim(), feito: false }]); setNovoItemCheck('') }} style={{ padding: '7px 12px', background: novoItemCheck.trim() ? 'var(--v2-ink)' : 'var(--v2-surface2)', color: novoItemCheck.trim() ? 'var(--v2-surface)' : 'var(--v2-ink3)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Add</button>
            </div>
          </div>

          {/* Subtarefas */}
          {tarefa?.id && perguntaConcluir && (
            <div style={{ marginTop: 14, padding: '14px 16px', border: '1px solid var(--v2-amber-on)', background: 'var(--v2-amber-bg)', borderRadius: 12 }}>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--v2-ink)' }}>{subsAbertas.length === 1 ? 'Ainda há 1 subtarefa aberta.' : `Ainda há ${subsAbertas.length} subtarefas abertas.`} Concluir a tarefa-mãe assim mesmo?</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <button type="button" onClick={() => salvar(true)} style={{ padding: '8px 14px', background: 'var(--v2-amber-on)', color: '#17150E', border: 0, borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Concluir subtarefas também</button>
                <button type="button" onClick={() => { setPerguntaConcluir(false); setForm(f => ({ ...f, status: tarefa.status })); toast('Status mantido. Revise as subtarefas abaixo.', 'info') }} style={{ padding: '8px 14px', background: 'var(--v2-surface)', color: 'var(--v2-ink)', border: '1px solid var(--v2-rule)', borderRadius: 9, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Revisar subtarefas</button>
                <button type="button" onClick={() => setPerguntaConcluir(false)} style={{ padding: '8px 10px', background: 'none', color: 'var(--v2-ink3)', border: 0, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              </div>
            </div>
          )}
          {tarefa?.id && (
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', display: 'block', marginBottom: 6 }}>Subtarefas {subtarefas.length > 0 && <span style={{ color: 'var(--v2-info)' }}>({subtarefas.filter(s => s.status === 'concluido').length}/{subtarefas.length})</span>}</label>
              {subtarefas.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                  {subtarefas.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--v2-surface1)', borderRadius: 8 }}>
                      <button type="button" onClick={() => toggleSubtarefa(s)} title={s.status === 'concluido' ? 'Reabrir' : 'Concluir'}
                        style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${s.status === 'concluido' ? 'var(--v2-ok)' : 'var(--v2-rule2)'}`, background: s.status === 'concluido' ? 'var(--v2-ok)' : 'var(--v2-surface)', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                        {s.status === 'concluido' && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--v2-surface)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                      </button>
                      <span style={{ flex: 1, fontSize: 13, color: s.status === 'concluido' ? 'var(--v2-ink3)' : 'var(--v2-ink)', textDecoration: s.status === 'concluido' ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.titulo}</span>
                      {onRecarregar && <button type="button" onClick={() => onRecarregar(s)} title="Abrir subtarefa" style={{ background: 'none', border: 'none', color: 'var(--v2-info)', cursor: 'pointer', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>abrir</button>}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={novoSub} onChange={e => setNovoSub(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtarefa() } }} placeholder="+ Nova subtarefa"
                  style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--v2-rule)', fontSize: 12.5, fontFamily: 'inherit' }} />
                <button type="button" disabled={!novoSub.trim()} onClick={addSubtarefa} style={{ padding: '7px 12px', background: novoSub.trim() ? 'var(--v2-ink)' : 'var(--v2-surface2)', color: novoSub.trim() ? 'var(--v2-surface)' : 'var(--v2-ink3)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Add</button>
              </div>
              {/* Puxar uma tarefa que já existe para dentro desta (ClickUp: "add existing task") */}
              {!tarefa.tarefaPaiId && (() => {
                const q = buscaPuxar.trim().toLowerCase()
                const cands = q.length < 2 ? [] : todasTarefas
                  .filter(t => t.id !== tarefa.id && !t.tarefaPaiId && !todasTarefas.some(o => o.tarefaPaiId === t.id) && t.status !== 'descartado' && (t.titulo || '').toLowerCase().includes(q))
                  .slice(0, 8)
                return (
                  <div style={{ marginTop: 6, position: 'relative' }}>
                    <input value={buscaPuxar} onChange={e => setBuscaPuxar(e.target.value)} placeholder="Puxar tarefa existente para dentro desta — digite para buscar"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8, border: '1.5px dashed var(--v2-rule)', fontSize: 12.5, fontFamily: 'inherit', background: 'var(--v2-surface)', color: 'var(--v2-ink)' }} />
                    {cands.length > 0 && (
                      <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 5, background: 'var(--v2-surface)', border: '1px solid var(--v2-rule)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
                        {cands.map(c => (
                          <button key={c.id} type="button" onClick={() => puxarExistente(c.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 0, background: 'transparent', cursor: 'pointer', fontSize: 12.5, color: 'var(--v2-ink)', fontFamily: 'inherit' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--v2-surface2)' }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
                            {c.titulo} <span style={{ color: 'var(--v2-ink3)' }}>· {c.clienteNome || 'Interno'}{(c.clienteId || '') !== (tarefa.clienteId || '') ? ' · outro cliente' : ''}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          {/* Tarefas relacionadas */}
          {tarefa?.id && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)' }}>Relacionadas {relacionadas.length > 0 && <span style={{ color: 'var(--v2-info)' }}>({relacionadas.length})</span>}</label>
                <button type="button" onClick={() => setPickerRel(v => !v)} style={{ background: 'none', border: 'none', color: 'var(--v2-info)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: 0 }}>{pickerRel ? 'Fechar' : '+ Relacionar tarefa'}</button>
              </div>
              {(() => {
                const COR_STATUS: Record<string, string> = { a_fazer: 'var(--v2-ink3)', em_andamento: 'var(--v2-info)', em_revisao: 'var(--v2-amber)', concluido: 'var(--v2-ok)', descartado: 'var(--v2-ink2)' }
                const relTarefas = relacionadas.map(rid => todasTarefas.find(t => t.id === rid)).filter(Boolean)
                return (
                  <>
                    {relTarefas.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: pickerRel ? 8 : 0 }}>
                        {relTarefas.map((t: any) => (
                          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--v2-surface1)', borderRadius: 8, border: '1px solid var(--v2-rule)' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: COR_STATUS[t.status] || 'var(--v2-rule)', flexShrink: 0 }} title={t.status} />
                            <span style={{ flex: 1, fontSize: 13, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titulo}</span>
                            {t.clienteNome && <span style={{ fontSize: 10.5, color: 'var(--v2-ink3)', flexShrink: 0 }}>{t.clienteNome}</span>}
                            <button type="button" onClick={() => desrelacionarTarefa(t.id)} title="Desvincular" style={{ background: 'none', border: 'none', color: 'var(--v2-ink3)', cursor: 'pointer', fontSize: 15, padding: 0, flexShrink: 0 }}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {pickerRel && (
                      <div>
                        <input autoFocus value={buscaRel} onChange={e => setBuscaRel(e.target.value)} placeholder="Buscar tarefa pelo título..."
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--v2-rule)', fontSize: 12.5, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 4 }} />
                        <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--v2-rule)', borderRadius: 8 }}>
                          {todasTarefas
                            .filter(t => t.id !== tarefa.id && !relacionadas.includes(t.id) && (!buscaRel.trim() || (t.titulo || '').toLowerCase().includes(buscaRel.toLowerCase())))
                            .slice(0, 30)
                            .map(t => (
                              <button key={t.id} type="button" onClick={() => relacionarTarefa(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', borderBottom: '1px solid var(--v2-surface1)', cursor: 'pointer' }}>
                                <span style={{ fontSize: 12.5, color: 'var(--v2-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{t.titulo}</span>
                                {t.clienteNome && <span style={{ fontSize: 10.5, color: 'var(--v2-ink3)' }}>{t.clienteNome}</span>}
                              </button>
                            ))}
                          {todasTarefas.filter(t => t.id !== tarefa.id && !relacionadas.includes(t.id) && (!buscaRel.trim() || (t.titulo || '').toLowerCase().includes(buscaRel.toLowerCase()))).length === 0 && (
                            <p style={{ margin: 0, padding: '10px', fontSize: 12, color: 'var(--v2-ink3)', textAlign: 'center' }}>Nenhuma tarefa encontrada.</p>
                          )}
                        </div>
                      </div>
                    )}
                    {relTarefas.length === 0 && !pickerRel && <p style={{ margin: 0, fontSize: 12, color: 'var(--v2-ink3)' }}>Nenhuma tarefa relacionada.</p>}
                  </>
                )
              })()}
            </div>
          )}

          {/* Documento e Mapa mental vinculados */}
          {tarefa?.id && (
            <div style={{ marginTop: 14, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Documento vinculado</label>
                <select value={documentoId} onChange={e => vincularDoc(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--v2-rule)', fontSize: 12.5, fontFamily: 'inherit', background: 'var(--v2-surface)', boxSizing: 'border-box', color: documentoId ? 'var(--v2-ink)' : 'var(--v2-ink3)' }}>
                  <option value="">Nenhum</option>
                  {docsList.map(d => <option key={d.id} value={d.id}>{d.titulo?.trim() || 'Sem título'}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Mapa mental vinculado</label>
                <select value={mapaId} onChange={e => vincularMapa(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--v2-rule)', fontSize: 12.5, fontFamily: 'inherit', background: 'var(--v2-surface)', boxSizing: 'border-box', color: mapaId ? 'var(--v2-ink)' : 'var(--v2-ink3)' }}>
                  <option value="">Nenhum</option>
                  {mapasList.map(m => <option key={m.id} value={m.id}>{m.titulo?.trim() || 'Sem título'}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* CRIATIVO PRONTO (dono, 07/09): em tarefa de produção, a arte entregue tem lugar próprio.
              É o que vira a mídia da pauta quando a tarefa é concluída — referências ficam em "Anexos". */}
          {(ehTarefaDeProducao({ tipo: form.tipo }) || !!form.origemPostId) && (() => {
            const prontos = anexos.map((a, i) => ({ a, i })).filter(x => x.a.papel === 'criativo')
            const validos = anexosCriativoPronto(anexos).length
            return (
              <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: `1.5px solid ${prontos.length ? 'var(--v2-ok)' : 'var(--v2-amber-on)'}`, background: prontos.length ? 'var(--v2-ok-bg)' : 'var(--v2-amber-bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--v2-ink)' }}>Criativo pronto</label>
                  <span style={{ fontSize: 11.5, color: 'var(--v2-ink2)' }}>{prontos.length ? `${validos} arquivo${validos > 1 ? 's' : ''} — vira a mídia da pauta ao concluir` : form.origemPostId ? 'Anexe a arte final aqui. Ao concluir, a pauta volta ao Studio com ela.' : 'Anexe a arte final aqui.'}</span>
                  <label style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: enviandoAnexo ? 'wait' : 'pointer', background: 'var(--v2-ink)', color: 'var(--v2-surface)', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700 }}>
                    {enviandoAnexo ? 'Enviando...' : '+ Anexar criativo pronto'}
                    <input type="file" multiple accept="image/*,video/*" style={{ display: 'none' }} disabled={enviandoAnexo}
                      onChange={e => { enviarAnexos(Array.from(e.target.files || []), 'criativo'); e.target.value = '' }} />
                  </label>
                </div>
                {!form.origemPostId && (
                  <p style={{ margin: '0 0 8px', fontSize: 11.5, color: 'var(--v2-ink2)', lineHeight: 1.5 }}>
                    <strong>Sem pauta vinculada.</strong> O criativo fica só nesta tarefa: não volta ao Studio nem chega ao cliente.
                    {pautasCliente.length > 0 ? ' Escolha a pauta no campo "Pauta do Studio", acima.' : form.clienteId ? ' Este cliente não tem pauta em produção no Studio.' : ' Escolha o cliente para listar as pautas.'}
                  </p>
                )}
                {prontos.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {prontos.map(({ a, i }) => (
                      <div key={i} onClick={() => setViewerIndex(i)} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '2px solid var(--v2-ok)', cursor: 'pointer' }}>
                        {a.tipo.startsWith('video')
                          ? <video src={a.url} style={{ width: 96, height: 96, objectFit: 'cover' }} muted preload="metadata" />
                          : <img src={a.url} alt={a.nome} style={{ width: 96, height: 96, objectFit: 'cover' }} />}
                        <button onClick={e => { e.stopPropagation(); setAnexos(arr => arr.filter((_, j) => j !== i)) }} title="Remover" style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: 'var(--v2-surface)', border: 'none', cursor: 'pointer', fontSize: 11, lineHeight: 1 }}>×</button>
                        <button onClick={e => { e.stopPropagation(); setAnexos(arr => arr.map((x, j) => j === i ? { ...x, papel: 'referencia' } : x)) }} title="Mover para referências" style={{ position: 'absolute', bottom: 2, left: 2, height: 18, borderRadius: 4, background: 'rgba(0,0,0,0.55)', color: 'var(--v2-surface)', border: 'none', cursor: 'pointer', fontSize: 9, padding: '0 5px' }}>ref.</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Anexos (referências) */}
          <div style={{ marginTop: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 6 }}>Anexos{anexos.some(a => a.papel === 'criativo') ? ' (referências)' : ''}</label>
            {anexos.some(a => a.papel !== 'criativo') && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {anexos.map((a, i) => a.papel === 'criativo' ? null : (
                  <div key={i} onClick={() => setViewerIndex(i)} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--v2-rule)', cursor: 'pointer' }}>
                    {a.tipo.startsWith('video') ? (
                      <video src={a.url} style={{ width: 80, height: 80, objectFit: 'cover' }} muted preload="metadata" />
                    ) : a.tipo.startsWith('image') ? (
                      <img src={a.url} alt={a.nome} style={{ width: 80, height: 80, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, background: 'var(--v2-surface1)', fontSize: 10, color: 'var(--v2-ink2)', padding: 4, textAlign: 'center', wordBreak: 'break-all' }}>{a.nome}</div>
                    )}
                    {(a.anotacoes || []).length > 0 && (
                      <span style={{ position: 'absolute', top: 2, left: 2, background: 'var(--v2-hot)', color: 'var(--v2-surface)', borderRadius: 999, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, padding: '0 4px' }}>{a.anotacoes!.length}</span>
                    )}
                    <button onClick={e => { e.stopPropagation(); setAnexos(arr => arr.filter((_, j) => j !== i)) }} style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: 'var(--v2-surface)', border: 'none', cursor: 'pointer', fontSize: 12, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>x</button>
                    <button onClick={e => { e.stopPropagation(); forcarDownload(a.url, a.nome) }}
                      style={{ position: 'absolute', bottom: 2, right: 2, width: 20, height: 20, borderRadius: 4, background: 'rgba(0,0,0,0.55)', border: 'none', color: 'var(--v2-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      title={`Baixar ${a.nome}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v2-surface)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                    {(ehTarefaDeProducao({ tipo: form.tipo }) || !!form.origemPostId) && (a.tipo.startsWith('image') || a.tipo.startsWith('video')) && (
                      <button onClick={e => { e.stopPropagation(); setAnexos(arr => arr.map((x, j) => j === i ? { ...x, papel: 'criativo' } : x)) }} title="Marcar como criativo pronto" style={{ position: 'absolute', bottom: 2, left: 2, height: 18, borderRadius: 4, background: 'rgba(0,0,0,0.55)', color: 'var(--v2-surface)', border: 'none', cursor: 'pointer', fontSize: 9, padding: '0 5px' }}>é a arte</button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: 'var(--v2-surface1)', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, color: 'var(--v2-ink2)' }}>
              {enviandoAnexo ? 'Enviando...' : '+ Adicionar anexo(s)'}
              <input type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx" style={{ display: 'none' }} disabled={enviandoAnexo}
                onChange={e => { enviarAnexos(Array.from(e.target.files || [])); e.target.value = '' }} />
            </label>
            <UploadProgress valor={progAnexo} rotulo="Enviando anexo..." />
            {/* Anexos das subtarefas — somente leitura, visíveis também aqui na tarefa-mãe */}
            {(() => {
              const anexosSubs = subtarefas.flatMap((s: any) => (s.anexos || []).map((a: any) => ({ ...a, subNome: s.titulo })))
              if (anexosSubs.length === 0) return null
              return (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--v2-rule)' }}>
                  <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: 'var(--v2-ink3)' }}>Anexos das subtarefas ({anexosSubs.length})</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {anexosSubs.map((a: any, i: number) => (
                      <a key={i} href={a.url} target="_blank" rel="noreferrer" title={`${a.nome} — subtarefa: ${a.subNome}`} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--v2-rule)', display: 'block', textDecoration: 'none' }}>
                        {(a.tipo || '').startsWith('video') ? <video src={a.url} style={{ width: 72, height: 72, objectFit: 'cover' }} muted preload="metadata" />
                          : (a.tipo || '').startsWith('image') ? <img src={a.url} alt={a.nome} style={{ width: 72, height: 72, objectFit: 'cover' }} />
                          : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, background: 'var(--v2-surface1)', fontSize: 9, color: 'var(--v2-ink2)', padding: 4, textAlign: 'center', wordBreak: 'break-all' }}>{a.nome}</div>}
                        <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'var(--v2-surface)', fontSize: 8, padding: '1px 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.subNome}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Apontamento de horas (só em tarefa já criada) */}
          {tarefa?.id && (
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--v2-ink3)' }}>Tempo trabalhado</label>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--v2-ink)' }}>{fmtMin(totalMin)}</span>
              </div>
              {/* Timer + lançamento manual */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                {timerInicio === null ? (
                  <button type="button" onClick={iniciarTimer} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg> Iniciar timer
                  </button>
                ) : (
                  <button type="button" onClick={pararTimer} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--v2-hot)', color: 'var(--v2-surface)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg> Parar ({fmtRelogio(Date.now() - timerInicio)})
                  </button>
                )}
                <span style={{ fontSize: 11, color: 'var(--v2-ink3)' }}>ou lançar manual:</span>
                <input type="number" min="0" value={apontH} onChange={e => setApontH(e.target.value)} placeholder="h" style={{ width: 48, padding: '7px 8px', borderRadius: 8, border: '1.5px solid var(--v2-rule)', fontSize: 12, fontFamily: 'inherit' }} />
                <input type="number" min="0" max="59" value={apontM} onChange={e => setApontM(e.target.value)} placeholder="min" style={{ width: 54, padding: '7px 8px', borderRadius: 8, border: '1.5px solid var(--v2-rule)', fontSize: 12, fontFamily: 'inherit' }} />
                <input value={apontDesc} onChange={e => setApontDesc(e.target.value)} placeholder="o que foi feito (opcional)" style={{ flex: 1, minWidth: 120, padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--v2-rule)', fontSize: 12, fontFamily: 'inherit' }} />
                <button type="button" disabled={salvandoApont || (Number(apontH) || 0) * 60 + (Number(apontM) || 0) <= 0} onClick={() => registrarApont((Number(apontH) || 0) * 60 + (Number(apontM) || 0), apontDesc)}
                  style={{ padding: '8px 14px', background: ((Number(apontH) || 0) * 60 + (Number(apontM) || 0) > 0) ? 'var(--v2-ok)' : 'var(--v2-surface2)', color: ((Number(apontH) || 0) * 60 + (Number(apontM) || 0) > 0) ? 'var(--v2-surface)' : 'var(--v2-ink3)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Registrar</button>
              </div>
              {apontamentos.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[...apontamentos].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).map((a: any) => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--v2-ink2)', padding: '4px 0', borderBottom: '1px solid var(--v2-surface1)' }}>
                      <span style={{ fontWeight: 700, color: 'var(--v2-ink)', width: 52 }}>{fmtMin(a.minutos)}</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.usuarioNome}{a.descricao ? ` · ${a.descricao}` : ''}</span>
                      <span style={{ color: 'var(--v2-ink3)' }}>{new Date(a.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                      <button onClick={() => removerApont(a.id)} title="Remover" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--v2-ink3)', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
            <button onClick={salvar} disabled={salvando || !form.titulo.trim()} className="soma10-no-invert" style={{ flex: 1, padding: '11px 0', background: form.titulo.trim() ? 'var(--v2-amber-on)' : 'var(--v2-surface2)', color: 'var(--v2-ink)', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: form.titulo.trim() ? 'pointer' : 'not-allowed' }}>
              {salvando ? 'Salvando...' : (tarefa ? 'Salvar' : 'Criar tarefa')}
            </button>
            {onExcluir && (
              <button onClick={onExcluir} style={{ padding: '11px 16px', background: 'var(--v2-surface)', color: 'var(--v2-hot)', border: '1px solid var(--v2-hot-bg)', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Excluir</button>
            )}
          </div>
          </>)}

          {/* Activity em aba — so no sidebar */}
          {tarefa && viewMode === 'sidebar' && abaInterna === 'activity' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{activityPanel}</div>
          )}
        </div>

        {/* Lado direito — Activity (modal e fullscreen) */}
        {showActivitySide && (
          <div style={{ width: 320, borderLeft: '1px solid var(--v2-rule)', background: 'var(--v2-surface1)', padding: 20, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {activityPanel}
          </div>
        )}
      </div>

      {/* Viewer de anexo */}
      {viewerIndex !== null && anexos[viewerIndex] && (
        <AnexoViewer anexo={anexos[viewerIndex]} anexoIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onAddAnotacao={addAnotacao}
          onRemoveAnotacao={removeAnotacao}
        />
      )}

    </div>
  , document.body)
}
