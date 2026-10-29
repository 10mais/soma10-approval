'use client'
// SUBIR POSTAGENS EM MASSA — dono, 29/10/2026: "Preciso de uma opção de subir postagens em massa
// no programador de postagens. Subir criativos, reels, carrosseis, etc, preencher legendas
// separadas uma a uma, escolher dias e horários, marcar como colab em cada publicação".
//
// Escolhe o cliente e a etapa do Playbook uma vez; arrasta todos os arquivos; cada arquivo vira um
// post (vídeo = Reels). Em cada post: formato, legenda, dia, horário e colab. Junta os marcados
// num carrossel, distribui as datas de uma vez, cola as legendas de um documento (separadas por
// "---"). No fim: agendar, enviar para aprovação do cliente ou salvar como rascunho — cada post
// nasce pela mesma rota do "Novo post" (lib/subirEmMassa.corpoDoPost). A capa de cada vídeo sai
// sozinha de um quadro do vídeo e dá para trocar. O lote fica guardado no navegador enquanto é
// montado: fechar não perde nada (regra da casa: salvar sozinho).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { upload } from '@vercel/blob/client'
import { v4 as uuid } from 'uuid'
import LimiteDeErro from '@/app/components/LimiteDeErro'
import AvatarCliente from '@/app/components/AvatarCliente'
import { toast, toastErro } from '@/lib/toast'
import { registrarDesfazer } from '@/lib/desfazer'
import { fecharFora } from '@/lib/fecharModal'
import { comprimirImagem, capaDoVideoLocal } from '@/lib/midiaPost'
import { opcoesEtapas, separarValor, juntarValor, type MarcoOpcao } from '@/lib/etapaPlaybook'
import { MAX_COLAB, USUARIO_INSTAGRAM, limparUsuario } from '@/lib/colab'
import { type ContaPublica } from '@/lib/contasSociais'
import {
  ordenarPorNome, tipoDoArquivo, novoItem, motivoParaNaoJuntar, juntarEmCarrossel, separarCarrossel, moverMidia,
  moverItem, distribuirDatas, dividirLegendas, aplicarLegendas, contarHashtags, faltasDoItem, corpoDoPost,
  paraRascunho, deRascunho, TEXTO_FALTA, MAX_LEGENDA,
  type ItemLote, type MidiaLote, type Lote, type AcaoLote, type FormatoLote, type Distribuicao,
} from '@/lib/subirEmMassa'

type Cliente = { id: string; nome: string; instagram?: string; logo?: string; contas?: ContaPublica[] }
type Props = {
  clientes: Cliente[]
  clienteFixo?: string                     // "ver como cliente" / hub do cliente: sem trocar de cliente
  onFechar: () => void
  onConcluido?: (posts: any[]) => void     // posts criados, para a lista do Programador
}
type Criacao = { estado: 'criando' | 'criado' | 'erro'; erro?: string; postId?: string }

const CHAVE_RASCUNHO = (clienteId: string) => `soma10-lote-posts:${clienteId}`
const CHAVE_ACAO = 'soma10-lote-acao'
const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime']
const SUBIDAS_AO_MESMO_TEMPO = 3
const ACOES: { chave: AcaoLote; rotulo: string; botao: (n: number) => string; dica: string }[] = [
  { chave: 'agendar', rotulo: 'Agendar', botao: n => `Agendar ${n} ${n === 1 ? 'post' : 'posts'}`, dica: 'Saem sozinhos no dia e horário de cada um.' },
  { chave: 'aprovacao', rotulo: 'Para aprovação', botao: n => `Enviar ${n} para aprovação`, dica: 'Vão para o link de aprovação do cliente; aprovado, agenda no horário marcado.' },
  { chave: 'rascunho', rotulo: 'Rascunho', botao: n => `Salvar ${n} ${n === 1 ? 'rascunho' : 'rascunhos'}`, dica: 'Ficam no Programador para terminar depois. Só a mídia é obrigatória.' },
]
const DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const NOMES_DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

const Svg = ({ d, size = 16, cor = 'currentColor', w = 2 }: { d: string; size?: number; cor?: string; w?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
)
const I = {
  subir: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  fechar: 'M18 6 6 18M6 6l12 12',
  cima: 'M18 15l-6-6-6 6',
  baixo: 'M6 9l6 6 6-6',
  esq: 'M15 18l-6-6 6-6',
  dir: 'M9 18l6-6-6-6',
  lixo: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  carrossel: 'M2 7h14v10H2zM18 9h2v6h-2M22 11v2',
  calendario: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  texto: 'M4 6h16M4 12h16M4 18h10',
  check: 'M20 6 9 17l-5-5',
  play: 'M8 5v14l11-7z',
  separar: 'M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5',
}

export default function SubirEmMassa(props: Props) {
  const ancora = useRef<HTMLSpanElement>(null)
  const [tema, setTema] = useState('light')
  const [pronto, setPronto] = useState(false)
  useEffect(() => {
    setTema(ancora.current?.closest('[data-theme]')?.getAttribute('data-theme') || 'light')
    setPronto(true)
  }, [])
  return (
    <>
      <span ref={ancora} hidden />
      {pronto && createPortal(
        <div className="soma10-v2 soma10-no-invert" data-theme={tema}>
          <LimiteDeErro onFechar={props.onFechar} titulo="A subida em massa não abriu"><Tela {...props} /></LimiteDeErro>
        </div>,
        document.body,
      )}
    </>
  )
}

function Tela({ clientes, clienteFixo, onFechar, onConcluido }: Props) {
  const [clienteId, setClienteId] = useState(clienteFixo || '')
  const [marcos, setMarcos] = useState<MarcoOpcao[]>([])
  const [carregandoMarcos, setCarregandoMarcos] = useState(false)
  const [lote, setLote] = useState<Lote>({ clienteId: clienteFixo || '', marcoId: '', subetapaId: '', redes: ['instagram', 'facebook'], contaIds: [], itens: [] })
  const [acao, setAcao] = useState<AcaoLote>(() => {
    try { const a = localStorage.getItem(CHAVE_ACAO); if (a === 'agendar' || a === 'aprovacao' || a === 'rascunho') return a } catch { /* sem storage */ }
    return 'agendar'
  })
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [recuperado, setRecuperado] = useState(0)
  const [criacao, setCriacao] = useState<Record<string, Criacao>>({})
  const [criando, setCriando] = useState(false)
  const [concluido, setConcluido] = useState<{ criados: number; link?: string } | null>(null)
  const [modal, setModal] = useState<null | 'datas' | 'legendas'>(null)
  const [arrastandoArquivo, setArrastandoArquivo] = useState(false)
  const [agora, setAgora] = useState(() => Date.now())
  const previas = useRef(new Map<string, string>())
  const fila = useRef<{ midiaId: string; arquivo: File }[]>([])
  const ativos = useRef(0)
  const inputArquivos = useRef<HTMLInputElement>(null)
  const montado = useRef(true)

  const cliente = clientes.find(c => c.id === clienteId)
  const contas = cliente?.contas || []
  const multiPerfil = contas.length > 1
  const temMeta = lote.redes.length > 0
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 30000); return () => clearInterval(t) }, [])
  useEffect(() => () => { montado.current = false; previas.current.forEach(u => URL.revokeObjectURL(u)) }, [])

  // Cliente escolhido: carrega as etapas do Playbook e o lote que estava sendo montado para ele.
  useEffect(() => {
    if (!clienteId) { setMarcos([]); return }
    setCarregandoMarcos(true)
    fetch(`/api/playbook?clienteId=${encodeURIComponent(clienteId)}`).then(r => r.json()).then(d => setMarcos(Array.isArray(d) ? d : [])).catch(() => setMarcos([])).finally(() => setCarregandoMarcos(false))
    let salvo: Lote | null = null
    try { salvo = deRascunho(localStorage.getItem(CHAVE_RASCUNHO(clienteId))) } catch { /* sem storage */ }
    if (salvo && salvo.itens.length) { setLote({ ...salvo, clienteId }); setRecuperado(salvo.itens.length) }
    else setLote(l => ({ clienteId, marcoId: '', subetapaId: '', redes: l.redes, contaIds: [], itens: [] }))
    setSelecionados([]); setCriacao({}); setConcluido(null)
  }, [clienteId])

  // Perfis: cliente com mais de um começa com todos marcados (como no "Novo post").
  useEffect(() => {
    if (!multiPerfil) return
    setLote(l => (l.contaIds.some(id => contas.some(c => c.id === id)) ? l : { ...l, contaIds: contas.map(c => c.id) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, contas.length])

  // Guarda o lote no navegador a cada mudança (só o que já subiu).
  useEffect(() => {
    if (!lote.clienteId) return
    const t = setTimeout(() => {
      try {
        if (lote.itens.length) localStorage.setItem(CHAVE_RASCUNHO(lote.clienteId), paraRascunho(lote))
        else localStorage.removeItem(CHAVE_RASCUNHO(lote.clienteId))
      } catch { /* sem storage: vale só enquanto a tela está aberta */ }
    }, 400)
    return () => clearTimeout(t)
  }, [lote])
  useEffect(() => { try { localStorage.setItem(CHAVE_ACAO, acao) } catch { /* sem storage */ } }, [acao])

  const alterarItem = useCallback((id: string, patch: Partial<ItemLote>) => {
    setLote(l => ({ ...l, itens: l.itens.map(i => (i.id === id ? { ...i, ...patch } : i)) }))
  }, [])
  // A mídia pode mudar de post no meio da subida (juntar em carrossel): procura pelo id em todos.
  const alterarMidia = useCallback((midiaId: string, patch: Partial<MidiaLote>) => {
    if (!montado.current) return
    setLote(l => ({ ...l, itens: l.itens.map(i => (i.midias.some(m => m.id === midiaId) ? { ...i, midias: i.midias.map(m => (m.id === midiaId ? { ...m, ...patch } : m)) } : i)) }))
  }, [])

  async function subirArquivo(midiaId: string, original: File) {
    try {
      const arquivo = await comprimirImagem(original)
      if (!TIPOS_ACEITOS.includes(arquivo.type)) {
        alterarMidia(midiaId, { erro: /heic|heif/i.test(arquivo.type || original.name) ? 'HEIC não é aceito pelas redes: exporte como JPG.' : `Tipo de arquivo não aceito (${arquivo.type || 'desconhecido'}).` })
        return
      }
      const ext = (arquivo.name.split('.').pop() || 'bin').toLowerCase()
      const blob = await upload(`midia/${midiaId}.${ext}`, arquivo, {
        access: 'public', handleUploadUrl: '/api/upload', contentType: arquivo.type, clientPayload: arquivo.type,
        onUploadProgress: ({ percentage }) => alterarMidia(midiaId, { progresso: Math.round(percentage) }),
      })
      alterarMidia(midiaId, { url: blob.url, progresso: 100 })
      if (arquivo.type.startsWith('video/')) {
        const quadro = await capaDoVideoLocal(original)
        if (quadro) {
          const capa = await upload(`midia/capa-${midiaId}.jpg`, new File([quadro], `capa-${midiaId}.jpg`, { type: 'image/jpeg' }), { access: 'public', handleUploadUrl: '/api/upload', contentType: 'image/jpeg', clientPayload: 'image/jpeg' })
          alterarMidia(midiaId, { capa: capa.url })
        }
      }
    } catch (e: any) {
      alterarMidia(midiaId, { erro: e?.message || 'Não foi possível enviar o arquivo.' })
    }
  }

  function puxarFila() {
    while (ativos.current < SUBIDAS_AO_MESMO_TEMPO && fila.current.length) {
      const t = fila.current.shift()!
      ativos.current++
      subirArquivo(t.midiaId, t.arquivo).finally(() => { ativos.current--; puxarFila() })
    }
  }

  function adicionarArquivos(lista: FileList | File[]) {
    if (!clienteId) { toastErro('Escolha o cliente antes de subir os arquivos.'); return }
    const arquivos = ordenarPorNome(Array.from(lista))
    const novos: ItemLote[] = []
    let ignorados = 0
    for (const arquivo of arquivos) {
      const tipo = tipoDoArquivo(arquivo.type, arquivo.name)
      if (!tipo) { ignorados++; continue }
      const midia: MidiaLote = { id: uuid(), nome: arquivo.name, tipo, progresso: 0 }
      if (arquivo.size > 500 * 1024 * 1024) midia.erro = `${(arquivo.size / 1024 / 1024).toFixed(0)} MB: o limite é 500 MB.`
      else fila.current.push({ midiaId: midia.id, arquivo })
      try { previas.current.set(midia.id, URL.createObjectURL(arquivo)) } catch { /* sem prévia local */ }
      novos.push(novoItem(uuid(), [midia]))
    }
    if (ignorados) toast(`${ignorados} ${ignorados === 1 ? 'arquivo ficou' : 'arquivos ficaram'} de fora: só imagem e vídeo viram post.`, 'info')
    if (!novos.length) return
    setLote(l => ({ ...l, itens: [...l.itens, ...novos] }))
    setRecuperado(0)
    puxarFila()
  }

  async function trocarCapa(midiaId: string, arquivo: File) {
    alterarMidia(midiaId, { capa: undefined })
    try {
      const img = await comprimirImagem(arquivo)
      const ext = (img.name.split('.').pop() || 'jpg').toLowerCase()
      const up = await upload(`midia/capa-${uuid()}.${ext}`, img, { access: 'public', handleUploadUrl: '/api/upload', contentType: img.type, clientPayload: img.type })
      alterarMidia(midiaId, { capa: up.url })
    } catch (e: any) {
      toastErro(e?.message || 'Não foi possível enviar a capa.')
    }
  }

  function removerItem(id: string) {
    const antes = lote.itens
    setLote(l => ({ ...l, itens: l.itens.filter(i => i.id !== id) }))
    setSelecionados(s => s.filter(x => x !== id))
    registrarDesfazer('post tirado do lote', () => { setLote(l => ({ ...l, itens: antes })); return true })
  }
  function removerSelecionados() {
    if (!selecionados.length) return
    const antes = lote.itens
    const n = selecionados.length
    setLote(l => ({ ...l, itens: l.itens.filter(i => !selecionados.includes(i.id)) }))
    setSelecionados([])
    registrarDesfazer(`${n} ${n === 1 ? 'post tirado' : 'posts tirados'} do lote`, () => { setLote(l => ({ ...l, itens: antes })); return true })
  }
  function juntar() {
    const motivo = motivoParaNaoJuntar(lote.itens, selecionados)
    if (motivo) { toastErro(motivo); return }
    setLote(l => ({ ...l, itens: juntarEmCarrossel(l.itens, selecionados) }))
    setSelecionados([])
  }
  function tirarMidia(itemId: string, midiaId: string) {
    setLote(l => ({ ...l, itens: l.itens.flatMap(i => {
      if (i.id !== itemId) return [i]
      const midias = i.midias.filter(m => m.id !== midiaId)
      return midias.length ? [{ ...i, midias, formato: midias.length > 1 ? 'feed' as const : i.formato }] : []
    }) }))
  }

  const faltas = useMemo(() => {
    const m = new Map<string, ReturnType<typeof faltasDoItem>>()
    for (const i of lote.itens) m.set(i.id, faltasDoItem(i, { acao, temMeta, agora }))
    return m
  }, [lote.itens, acao, temMeta, agora])
  const pendentes = lote.itens.filter(i => criacao[i.id]?.estado !== 'criado')
  const comFalta = pendentes.filter(i => (faltas.get(i.id) || []).length).length
  const subindo = lote.itens.reduce((n, i) => n + i.midias.filter(m => !m.url && !m.erro).length, 0)
  const faltaEtapa = !lote.marcoId
  const faltaPerfil = multiPerfil && !lote.contaIds.length
  const faltaRede = !lote.redes.length
  const bloqueio = !clienteId ? 'Escolha o cliente.'
    : faltaEtapa ? 'Escolha a etapa do Playbook.'
    : faltaPerfil ? 'Marque pelo menos um perfil.'
    : faltaRede ? 'Marque pelo menos uma rede.'
    : !pendentes.length ? 'Suba os arquivos dos posts.'
    : comFalta ? `${comFalta} ${comFalta === 1 ? 'post ainda precisa' : 'posts ainda precisam'} de ajuste (marcados em vermelho).`
    : ''

  async function criarTodos() {
    if (bloqueio || criando) return
    setCriando(true)
    const loteBase = { clienteId, clienteNome: cliente?.nome, marcoId: lote.marcoId, subetapaId: lote.subetapaId, redes: lote.redes, contaIds: multiPerfil ? lote.contaIds : [] }
    const alvos = [...pendentes]
    const criados: { itemId: string; post: any }[] = []
    let proximo = 0
    // Dois de cada vez: rápido sem atropelar a rota (cada post é um POST /api/posts, como no "Novo post").
    const trabalhador = async () => {
      while (proximo < alvos.length) {
        const item = alvos[proximo++]
        setCriacao(c => ({ ...c, [item.id]: { estado: 'criando' } }))
        try {
          const r = await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpoDoPost(item, loteBase, acao)) })
          const d = await r.json().catch(() => ({}))
          if (!r.ok || !d?.post) throw new Error(d?.error === 'sem permissao' ? 'sem permissão para criar posts' : d?.error || 'a rota não respondeu')
          criados.push({ itemId: item.id, post: d.post })
          setCriacao(c => ({ ...c, [item.id]: { estado: 'criado', postId: d.post.id } }))
        } catch (e: any) {
          setCriacao(c => ({ ...c, [item.id]: { estado: 'erro', erro: e?.message || 'falhou' } }))
        }
      }
    }
    await Promise.all([trabalhador(), trabalhador()])
    if (criados.length) onConcluido?.(criados.map(c => c.post))
    setCriando(false)
    const feitos = new Set(criados.map(c => c.itemId))
    if (feitos.size === alvos.length) {
      let link: string | undefined
      if (acao === 'aprovacao') {
        // Link ÚNICO do cliente com tudo o que espera aprovação (o mesmo do "Novo post").
        const tk = await fetch('/api/aprovacao-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId }) }).then(x => x.json()).catch(() => null)
        if (tk?.token) link = `${window.location.origin}/aprovacoes/${tk.token}`
      }
      try { localStorage.removeItem(CHAVE_RASCUNHO(clienteId)) } catch { /* sem storage */ }
      setLote(l => ({ ...l, itens: [] }))
      setCriacao({})
      setSelecionados([])
      setConcluido({ criados: criados.length, link })
    } else {
      // Ficam só os que falharam, com o motivo, prontos para tentar de novo (o rascunho guardado também).
      setLote(l => ({ ...l, itens: l.itens.filter(it => !feitos.has(it.id)) }))
      setCriacao(c => Object.fromEntries(Object.entries(c).filter(([id]) => !feitos.has(id))))
      setSelecionados(s => s.filter(id => !feitos.has(id)))
      toastErro(`${criados.length} ${criados.length === 1 ? 'post criado' : 'posts criados'}; ${alvos.length - criados.length} com erro. Os que falharam continuam aqui para tentar de novo.`)
    }
  }

  const fechar = () => { if (!criando) onFechar() }
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !modal && !criando) onFechar() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [modal, criando, onFechar])

  const todosMarcados = !!pendentes.length && pendentes.every(i => selecionados.includes(i.id))
  const acaoAtual = ACOES.find(a => a.chave === acao)!
  const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink2)', marginBottom: 6 }
  const campo: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13.5, fontFamily: 'inherit', background: 'var(--v2-surface)', color: 'var(--v2-ink)' }
  const botaoLeve: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 9, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-ink2)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }

  return (
    <div className="anim-overlay" style={{ position: 'fixed', inset: 0, zIndex: 1500, background: 'var(--v2-ground)', color: 'var(--v2-ink)', fontFamily: 'var(--v2-font)', display: 'flex', flexDirection: 'column' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', paddingTop: 'max(14px, env(safe-area-inset-top))', borderBottom: '1px solid var(--v2-rule)', background: 'var(--v2-surface)' }}>
        <h2 style={{ margin: 0, fontSize: 17, flex: 1, minWidth: 0 }}>Subir postagens em massa</h2>
        <button onClick={fechar} disabled={criando} aria-label="Fechar" title="Fechar (o lote fica guardado neste navegador)"
          style={{ ...botaoLeve, padding: 8, opacity: criando ? 0.5 : 1 }}><Svg d={I.fechar} /></button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px 120px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {concluido ? (
            <div className="anim-in" style={{ background: 'var(--v2-surface)', borderRadius: 16, padding: 28, textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--v2-ok-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}><Svg d={I.check} size={24} cor="var(--v2-ok)" w={2.6} /></div>
              <h3 style={{ margin: '0 0 6px', fontSize: 17 }}>{concluido.criados} {concluido.criados === 1 ? 'post criado' : 'posts criados'}</h3>
              <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--v2-ink2)' }}>{acaoAtual.dica}</p>
              {concluido.link && (
                <div style={{ display: 'flex', gap: 8, maxWidth: 520, margin: '0 auto 16px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <input readOnly value={concluido.link} onFocus={e => e.currentTarget.select()} style={{ ...campo, flex: 1, minWidth: 220 }} />
                  <button onClick={() => { navigator.clipboard?.writeText(concluido.link!).then(() => toast('Link copiado.', 'sucesso')).catch(() => {}) }} style={{ ...botaoLeve, background: 'var(--v2-ink)', color: 'var(--v2-surface)', border: 0 }}>Copiar link de aprovação</button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => setConcluido(null)} style={botaoLeve}>Subir mais posts</button>
                <button onClick={onFechar} style={{ ...botaoLeve, background: 'var(--v2-amber-on)', color: '#17150E', border: 0 }}>Ver no Programador</button>
              </div>
            </div>
          ) : (
            <>
              {/* Para todos os posts */}
              <section style={{ background: 'var(--v2-surface)', borderRadius: 16, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
                <div>
                  <label style={lbl}>Cliente</label>
                  {clienteFixo ? (
                    <div style={{ ...campo, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', background: 'var(--v2-surface2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}><AvatarCliente logo={cliente?.logo} nome={cliente?.nome} clienteId={cliente?.id} /></span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cliente?.nome || 'Cliente'}</span>
                    </div>
                  ) : (
                    <select value={clienteId} onChange={e => setClienteId(e.target.value)} disabled={criando} style={campo}>
                      <option value="">Escolha o cliente</option>
                      {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label style={lbl}>Etapa do Playbook *</label>
                  <select value={juntarValor(lote.marcoId, lote.subetapaId)} disabled={!clienteId || criando}
                    onChange={e => { const v = separarValor(e.target.value); setLote(l => ({ ...l, marcoId: v.marcoId, subetapaId: v.subetapaId })) }}
                    style={{ ...campo, borderColor: clienteId && faltaEtapa ? 'var(--v2-hot)' : 'var(--v2-rule)' }}>
                    <option value="">{!clienteId ? 'Escolha o cliente primeiro' : carregandoMarcos ? 'Carregando…' : marcos.length ? 'Escolha a etapa' : 'Cliente sem Playbook'}</option>
                    {opcoesEtapas(marcos).map(g => g.opcoes.length > 1 ? (
                      <optgroup key={g.marcoId} label={g.titulo}>
                        {g.opcoes.map(o => <option key={o.valor} value={o.valor}>{o.ehMarco ? o.rotulo : `  └ ${o.rotulo}`}</option>)}
                      </optgroup>
                    ) : <option key={g.marcoId} value={g.marcoId}>{g.titulo}</option>)}
                  </select>
                  {clienteId && !carregandoMarcos && !marcos.length && <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--v2-hot)' }}>Crie uma etapa no Playbook do cliente para vincular os posts.</p>}
                </div>
                <div>
                  <label style={lbl}>Publicar em</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['instagram', 'facebook'] as const).map(r => {
                      const ativo = lote.redes.includes(r)
                      return (
                        <button key={r} type="button" disabled={criando} onClick={() => setLote(l => ({ ...l, redes: ativo ? l.redes.filter(x => x !== r) : [...l.redes, r] }))}
                          style={{ ...botaoLeve, flex: 1, justifyContent: 'center', padding: '10px 12px', borderColor: ativo ? 'var(--v2-ink)' : 'var(--v2-rule)', background: ativo ? 'var(--v2-ink)' : 'var(--v2-surface)', color: ativo ? 'var(--v2-surface)' : 'var(--v2-ink2)' }}>
                          {r === 'instagram' ? 'Instagram' : 'Facebook'}
                        </button>
                      )
                    })}
                  </div>
                  {faltaRede && <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--v2-hot)' }}>Marque pelo menos uma rede.</p>}
                </div>
                {multiPerfil && (
                  <div>
                    <label style={lbl}>Perfis</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {contas.map(c => {
                        const ativo = lote.contaIds.includes(c.id)
                        return (
                          <button key={c.id} type="button" disabled={criando} onClick={() => setLote(l => ({ ...l, contaIds: ativo ? l.contaIds.filter(x => x !== c.id) : [...l.contaIds, c.id] }))}
                            style={{ ...botaoLeve, borderColor: ativo ? 'var(--v2-ink)' : 'var(--v2-rule)', background: ativo ? 'var(--v2-ink)' : 'var(--v2-surface)', color: ativo ? 'var(--v2-surface)' : 'var(--v2-ink2)' }}>
                            {c.nome}
                          </button>
                        )
                      })}
                    </div>
                    {faltaPerfil && <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--v2-hot)' }}>Marque pelo menos um perfil.</p>}
                  </div>
                )}
              </section>

              {recuperado > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', borderRadius: 12, background: 'var(--v2-info-bg)', color: 'var(--v2-info)', fontSize: 13, fontWeight: 600 }}>
                  Recuperamos o lote que você estava montando para este cliente ({recuperado} {recuperado === 1 ? 'post' : 'posts'}).
                  <button onClick={() => { setLote(l => ({ ...l, itens: [] })); setRecuperado(0); setSelecionados([]) }} style={{ border: 0, background: 'transparent', color: 'var(--v2-info)', fontWeight: 800, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Começar do zero</button>
                </div>
              )}

              {/* Arquivos */}
              <div
                onDragOver={e => { if (!clienteId) return; e.preventDefault(); setArrastandoArquivo(true) }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastandoArquivo(false) }}
                onDrop={e => { e.preventDefault(); setArrastandoArquivo(false); if (e.dataTransfer.files?.length) adicionarArquivos(e.dataTransfer.files) }}
                onClick={() => clienteId && inputArquivos.current?.click()}
                role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') inputArquivos.current?.click() }}
                style={{ border: `2px dashed ${arrastandoArquivo ? 'var(--v2-ink)' : 'var(--v2-rule2)'}`, borderRadius: 16, padding: lote.itens.length ? '16px' : '34px 16px', textAlign: 'center', cursor: clienteId ? 'pointer' : 'not-allowed', background: arrastandoArquivo ? 'var(--v2-surface2)' : 'var(--v2-surface)', opacity: clienteId ? 1 : 0.6, transition: 'background-color 120ms ease' }}>
                <input ref={inputArquivos} type="file" multiple accept="image/*,video/mp4,video/quicktime" hidden
                  onChange={e => { if (e.target.files?.length) adicionarArquivos(e.target.files); e.target.value = '' }} />
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--v2-ink2)' }}>
                  <Svg d={I.subir} size={20} />
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{clienteId ? 'Arraste as artes e os vídeos aqui ou clique para escolher' : 'Escolha o cliente para subir os arquivos'}</span>
                </div>
                {!lote.itens.length && <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--v2-ink3)' }}>Cada arquivo vira um post (vídeo vira Reels). Para carrossel, marque os posts e clique em "Juntar em carrossel". A ordem segue o número no nome do arquivo.</p>}
                {subindo > 0 && <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 700, color: 'var(--v2-info)' }}>Subindo {subindo} {subindo === 1 ? 'arquivo' : 'arquivos'}…</p>}
              </div>

              {/* Ferramentas do lote */}
              {pendentes.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', position: 'sticky', top: -16, zIndex: 2, background: 'var(--v2-ground)', padding: '8px 0' }}>
                  <label style={{ ...botaoLeve, cursor: 'pointer' }}>
                    <input type="checkbox" checked={todosMarcados} onChange={() => setSelecionados(todosMarcados ? [] : pendentes.map(i => i.id))} style={{ margin: 0 }} />
                    {selecionados.length ? `${selecionados.length} marcados` : 'Marcar todos'}
                  </label>
                  <button onClick={juntar} disabled={selecionados.length < 2 || criando} title="Junta os posts marcados num carrossel, na ordem da lista"
                    style={{ ...botaoLeve, opacity: selecionados.length < 2 ? 0.5 : 1 }}><Svg d={I.carrossel} size={14} />Juntar em carrossel</button>
                  <button onClick={() => setModal('datas')} disabled={criando} style={botaoLeve}><Svg d={I.calendario} size={14} />Distribuir datas</button>
                  <button onClick={() => setModal('legendas')} disabled={criando} style={botaoLeve}><Svg d={I.texto} size={14} />Colar legendas</button>
                  {selecionados.length > 0 && <button onClick={removerSelecionados} disabled={criando} style={{ ...botaoLeve, color: 'var(--v2-hot)' }}><Svg d={I.lixo} size={14} />Tirar marcados</button>}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 12.5, color: 'var(--v2-ink3)', fontWeight: 600 }}>{pendentes.length} {pendentes.length === 1 ? 'post' : 'posts'}{selecionados.length ? ' · as ferramentas valem para os marcados' : ''}</span>
                </div>
              )}

              {/* Posts */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {lote.itens.map((it, idx) => (
                  <CartaoPost key={it.id} it={it} indice={idx} total={lote.itens.length}
                    faltas={faltas.get(it.id) || []} criacao={criacao[it.id]} acao={acao}
                    marcado={selecionados.includes(it.id)} travado={criando || criacao[it.id]?.estado === 'criado'}
                    previa={id => previas.current.get(id)}
                    onMarcar={() => setSelecionados(s => (s.includes(it.id) ? s.filter(x => x !== it.id) : [...s, it.id]))}
                    onAlterar={patch => alterarItem(it.id, patch)}
                    onMover={d => setLote(l => ({ ...l, itens: moverItem(l.itens, idx, idx + d) }))}
                    onMoverMidia={(de, para) => setLote(l => ({ ...l, itens: l.itens.map(i => (i.id === it.id ? moverMidia(i, de, para) : i)) }))}
                    onTirarMidia={mid => tirarMidia(it.id, mid)}
                    onSeparar={() => setLote(l => ({ ...l, itens: separarCarrossel(l.itens, it.id, uuid) }))}
                    onTrocarCapa={trocarCapa}
                    onRemover={() => removerItem(it.id)} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Rodapé: o que fazer com o lote */}
      {!concluido && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, borderTop: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', padding: '12px 18px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: 'var(--v2-surface2)', borderRadius: 10, padding: 3, flexWrap: 'wrap' }}>
              {ACOES.map(a => (
                <button key={a.chave} onClick={() => setAcao(a.chave)} disabled={criando} title={a.dica}
                  style={{ padding: '7px 12px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', background: acao === a.chave ? 'var(--v2-surface)' : 'transparent', color: acao === a.chave ? 'var(--v2-ink)' : 'var(--v2-ink3)', boxShadow: acao === a.chave ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}>
                  {a.rotulo}
                </button>
              ))}
            </div>
            <span style={{ flex: 1, minWidth: 160, fontSize: 12.5, color: bloqueio ? 'var(--v2-hot)' : 'var(--v2-ink3)', fontWeight: bloqueio ? 700 : 500 }}>
              {criando ? `Criando os posts… ${Object.values(criacao).filter(c => c.estado === 'criado').length} de ${pendentes.length + Object.values(criacao).filter(c => c.estado === 'criado').length}` : bloqueio || acaoAtual.dica}
            </span>
            <button onClick={criarTodos} disabled={!!bloqueio || criando}
              style={{ padding: '11px 20px', borderRadius: 11, border: 0, background: bloqueio ? 'var(--v2-surface2)' : 'var(--v2-amber-on)', color: bloqueio ? 'var(--v2-ink3)' : '#17150E', fontSize: 14, fontWeight: 800, cursor: bloqueio || criando ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {criando ? 'Criando…' : acaoAtual.botao(pendentes.length)}
            </button>
          </div>
        </div>
      )}

      {modal === 'datas' && <ModalDatas alvos={selecionados.length || pendentes.length} marcados={selecionados.length > 0} onFechar={() => setModal(null)}
        onAplicar={d => { setLote(l => ({ ...l, itens: distribuirDatas(l.itens, selecionados.length ? selecionados : pendentes.map(i => i.id), d) })); setModal(null) }} />}
      {modal === 'legendas' && <ModalLegendas itens={pendentes} selecionados={selecionados} onFechar={() => setModal(null)}
        onAplicar={(legendas, pularPreenchidas) => {
          const base = (selecionados.length ? pendentes.filter(i => selecionados.includes(i.id)) : pendentes).filter(i => !pularPreenchidas || !i.legenda.trim())
          const r = aplicarLegendas(lote.itens, legendas, base.map(i => i.id))
          setLote(l => ({ ...l, itens: r.itens }))
          setModal(null)
          toast(`${r.usadas} ${r.usadas === 1 ? 'legenda aplicada' : 'legendas aplicadas'}${legendas.length > r.usadas ? `; ${legendas.length - r.usadas} sobraram (mais legendas que posts)` : ''}.`, 'sucesso')
        }} />}
    </div>
  )
}

function CartaoPost({ it, indice, total, faltas, criacao, acao, marcado, travado, previa, onMarcar, onAlterar, onMover, onMoverMidia, onTirarMidia, onSeparar, onTrocarCapa, onRemover }: {
  it: ItemLote; indice: number; total: number; faltas: ReturnType<typeof faltasDoItem>; criacao?: Criacao; acao: AcaoLote
  marcado: boolean; travado: boolean; previa: (midiaId: string) => string | undefined
  onMarcar: () => void; onAlterar: (p: Partial<ItemLote>) => void; onMover: (d: number) => void
  onMoverMidia: (de: number, para: number) => void; onTirarMidia: (midiaId: string) => void; onSeparar: () => void
  onTrocarCapa: (midiaId: string, f: File) => void; onRemover: () => void
}) {
  const carrossel = it.midias.length > 1
  const story = it.formato === 'story'
  const video = it.midias.length === 1 && it.midias[0].tipo === 'video'
  const opcoesFormato: { chave: FormatoLote; rotulo: string }[] = carrossel ? [{ chave: 'feed', rotulo: `Carrossel (${it.midias.length})` }]
    : video ? [{ chave: 'reel', rotulo: 'Reels' }, { chave: 'story', rotulo: 'Story' }]
    : [{ chave: 'feed', rotulo: 'Feed' }, { chave: 'story', rotulo: 'Story' }]
  const erroCriar = criacao?.estado === 'erro' ? criacao.erro : ''
  const criado = criacao?.estado === 'criado'
  const borda = criado ? 'var(--v2-ok)' : erroCriar || faltas.length ? 'var(--v2-hot)' : marcado ? 'var(--v2-ink)' : 'var(--v2-rule)'
  const campo: React.CSSProperties = { boxSizing: 'border-box', padding: '8px 10px', borderRadius: 9, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', background: 'var(--v2-surface)', color: 'var(--v2-ink)' }
  const mini: React.CSSProperties = { width: 24, height: 24, borderRadius: 7, border: '1px solid var(--v2-rule)', background: 'var(--v2-surface)', color: 'var(--v2-ink2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }
  const capaInput = useRef<HTMLInputElement>(null)
  const [capaDe, setCapaDe] = useState<string | null>(null)
  const hashtags = contarHashtags(it.legenda)

  return (
    <div className="anim-item" style={{ ['--i' as any]: Math.min(indice, 8), background: 'var(--v2-surface)', borderRadius: 14, border: `1.5px solid ${borda}`, padding: 12, opacity: criado ? 0.75 : 1 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {/* Mídias */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 168, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={marcado} onChange={onMarcar} disabled={travado} aria-label="Marcar este post" style={{ margin: 0 }} />
            <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--v2-ink3)' }}>Post {indice + 1}</span>
            <span style={{ flex: 1 }} />
            <button type="button" onClick={() => onMover(-1)} disabled={travado || indice === 0} aria-label="Subir na lista" style={{ ...mini, opacity: indice === 0 ? 0.35 : 1 }}><Svg d={I.cima} size={13} /></button>
            <button type="button" onClick={() => onMover(1)} disabled={travado || indice === total - 1} aria-label="Descer na lista" style={{ ...mini, opacity: indice === total - 1 ? 0.35 : 1 }}><Svg d={I.baixo} size={13} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: carrossel ? 'repeat(3, 1fr)' : '1fr', gap: 4 }}>
            {it.midias.map((m, k) => {
              const src = m.tipo === 'video' ? (m.capa || '') : (m.url || previa(m.id) || '')
              return (
                <div key={m.id} style={{ position: 'relative', aspectRatio: carrossel ? '1' : story || video ? '9/16' : '4/5', maxHeight: carrossel ? undefined : 210, borderRadius: 8, overflow: 'hidden', background: 'var(--v2-surface2)' }}>
                  {src ? <img src={src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : m.tipo === 'video' && previa(m.id) ? <video src={previa(m.id)} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--v2-ink3)' }}><Svg d={m.tipo === 'video' ? I.play : I.subir} /></div>}
                  {m.tipo === 'video' && <span style={{ position: 'absolute', left: 4, top: 4, background: 'rgba(0,0,0,0.55)', borderRadius: 999, padding: 3, display: 'flex' }}><Svg d={I.play} size={10} cor="#fff" /></span>}
                  {!m.url && !m.erro && (
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, background: 'rgba(0,0,0,0.25)' }}>
                      <div style={{ height: '100%', width: `${m.progresso || 0}%`, background: 'var(--v2-amber-on)', transition: 'width 200ms linear' }} />
                    </div>
                  )}
                  {m.erro && <div title={m.erro} style={{ position: 'absolute', inset: 0, background: 'rgba(163,44,34,0.78)', color: '#fff', fontSize: 10, fontWeight: 700, padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>{m.erro}</div>}
                  {carrossel && !travado && (
                    <div style={{ position: 'absolute', right: 2, top: 2, display: 'flex', gap: 2 }}>
                      {k > 0 && <button type="button" onClick={() => onMoverMidia(k, k - 1)} aria-label="Mover para a esquerda" style={{ ...mini, width: 18, height: 18 }}><Svg d={I.esq} size={11} /></button>}
                      {k < it.midias.length - 1 && <button type="button" onClick={() => onMoverMidia(k, k + 1)} aria-label="Mover para a direita" style={{ ...mini, width: 18, height: 18 }}><Svg d={I.dir} size={11} /></button>}
                      <button type="button" onClick={() => onTirarMidia(m.id)} aria-label="Tirar do carrossel" style={{ ...mini, width: 18, height: 18, color: 'var(--v2-hot)' }}><Svg d={I.fechar} size={11} /></button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {it.midias.some(m => m.tipo === 'video') && !story && !travado && (
            <>
              <input ref={capaInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { const f = e.target.files?.[0]; if (f && capaDe) onTrocarCapa(capaDe, f); e.target.value = '' }} />
              {it.midias.filter(m => m.tipo === 'video').map((m, k, arr) => (
                <button key={m.id} type="button" onClick={() => { setCapaDe(m.id); capaInput.current?.click() }} disabled={!m.url}
                  style={{ ...campo, padding: '5px 8px', fontSize: 11.5, fontWeight: 700, cursor: m.url ? 'pointer' : 'default', color: m.url && !m.capa ? 'var(--v2-hot)' : 'var(--v2-ink2)' }}>
                  {m.capa ? 'Trocar capa' : m.url ? 'Escolher capa' : 'Capa: aguardando o vídeo'}{arr.length > 1 ? ` (vídeo ${k + 1})` : ''}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Legenda */}
        <div style={{ flex: '2 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={it.formato} disabled={travado || opcoesFormato.length < 2} onChange={e => onAlterar({ formato: e.target.value as FormatoLote })} aria-label="Formato" style={{ ...campo, padding: '6px 8px', fontWeight: 700 }}>
              {opcoesFormato.map(o => <option key={o.chave} value={o.chave}>{o.rotulo}</option>)}
            </select>
            {carrossel && !travado && <button type="button" onClick={onSeparar} style={{ ...campo, padding: '6px 9px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Svg d={I.separar} size={12} />Separar</button>}
            <span style={{ flex: 1 }} />
            {!story && <span style={{ fontSize: 11, color: it.legenda.length > MAX_LEGENDA ? 'var(--v2-hot)' : 'var(--v2-ink3)' }}>{it.legenda.length}/{MAX_LEGENDA}{hashtags ? ` · ${hashtags} #` : ''}</span>}
          </div>
          {story ? (
            <div style={{ ...campo, flex: 1, minHeight: 90, color: 'var(--v2-ink3)', fontSize: 12.5, display: 'flex', alignItems: 'center' }}>Story não leva legenda nem colab.</div>
          ) : (
            <textarea value={it.legenda} disabled={travado} onChange={e => onAlterar({ legenda: e.target.value })} placeholder="Legenda deste post" rows={5}
              style={{ ...campo, width: '100%', flex: 1, minHeight: 110, resize: 'vertical', lineHeight: 1.45 }} />
          )}
        </div>

        {/* Quando e colab */}
        <div style={{ flex: '1 1 210px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <label style={{ flex: 1.3, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 3 }}>Dia</span>
              <input type="date" value={it.data} disabled={travado} onChange={e => onAlterar({ data: e.target.value })} style={{ ...campo, width: '100%' }} />
            </label>
            <label style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 3 }}>Horário</span>
              <input type="time" value={it.hora} disabled={travado} onChange={e => onAlterar({ hora: e.target.value })} style={{ ...campo, width: '100%' }} />
            </label>
          </div>
          {!story && <CampoColab valor={it.colaboradores} travado={travado} onMudar={colaboradores => onAlterar({ colaboradores })} />}
          <span style={{ flex: 1 }} />
          {(faltas.length > 0 || erroCriar || criado || criacao?.estado === 'criando') && (
            <div style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.4, color: criado ? 'var(--v2-ok)' : criacao?.estado === 'criando' ? 'var(--v2-info)' : 'var(--v2-hot)' }}>
              {criado ? (acao === 'rascunho' ? 'Rascunho salvo.' : acao === 'aprovacao' ? 'Enviado para aprovação.' : 'Agendado.')
                : criacao?.estado === 'criando' ? 'Criando…'
                : erroCriar ? `Não foi criado: ${erroCriar}`
                : `Falta: ${faltas.map(f => TEXTO_FALTA[f]).join(', ')}.`}
            </div>
          )}
          {!travado && (
            <button type="button" onClick={onRemover} style={{ alignSelf: 'flex-end', border: 0, background: 'transparent', color: 'var(--v2-ink3)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit', padding: 4 }}>
              <Svg d={I.lixo} size={13} />Tirar do lote
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Colab por post: digita o @ e Enter (ou vírgula). Até 3 — limite da Meta (lib/colab).
function CampoColab({ valor, travado, onMudar }: { valor: string[]; travado: boolean; onMudar: (v: string[]) => void }) {
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')
  // Vários de uma vez ("ana, bia,") numa mudança só — chamar um a um gravava só o último.
  const adicionar = (bruto: string) => {
    const lista = [...valor]
    const sobra: string[] = []
    let msg = ''
    for (const parte of bruto.split(',')) {
      const u = limparUsuario(parte)
      if (!u) continue
      if (!USUARIO_INSTAGRAM.test(u)) { msg = 'Esse @ não parece um perfil do Instagram.'; sobra.push(parte.trim()); continue }
      if (lista.includes(u)) continue
      if (lista.length >= MAX_COLAB) { msg = `A Meta aceita até ${MAX_COLAB} colabs por post.`; continue }
      lista.push(u)
    }
    if (lista.length !== valor.length) onMudar(lista)
    setTexto(sobra.join(', '))
    setErro(msg)
  }
  return (
    <div>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--v2-ink3)', marginBottom: 3 }}>Colab ({valor.length}/{MAX_COLAB})</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', padding: '5px 6px', borderRadius: 9, border: `1.5px solid ${erro ? 'var(--v2-hot)' : 'var(--v2-rule)'}`, background: 'var(--v2-surface)' }}>
        {valor.map(c => (
          <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--v2-ink)', color: 'var(--v2-amber-on)', borderRadius: 999, padding: '3px 4px 3px 9px', fontSize: 12, fontWeight: 700 }}>
            @{c}
            {!travado && <button type="button" onClick={() => onMudar(valor.filter(x => x !== c))} aria-label={`Tirar @${c}`} style={{ width: 16, height: 16, borderRadius: '50%', border: 0, background: 'rgba(255,255,255,0.2)', color: 'var(--v2-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><Svg d={I.fechar} size={9} w={3} /></button>}
          </span>
        ))}
        {!travado && valor.length < MAX_COLAB && (
          <input value={texto} onChange={e => { const v = e.target.value; if (v.includes(',')) adicionar(v); else { setTexto(v); if (erro) setErro('') } }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionar(texto) } else if (e.key === 'Backspace' && !texto && valor.length) onMudar(valor.slice(0, -1)) }}
            onBlur={() => texto.trim() && adicionar(texto)}
            placeholder={valor.length ? '' : '@perfil e Enter'} aria-label="Adicionar colab"
            style={{ flex: 1, minWidth: 90, border: 0, outline: 'none', background: 'transparent', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--v2-ink)', padding: '3px 2px' }} />
        )}
      </div>
      {erro && <span style={{ display: 'block', marginTop: 3, fontSize: 11, fontWeight: 600, color: 'var(--v2-hot)' }}>{erro}</span>}
    </div>
  )
}

function Janela({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onFechar() } }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [onFechar])
  return (
    <LimiteDeErro onFechar={onFechar}>
      <div className="anim-overlay" onClick={fecharFora(onFechar)} style={{ position: 'fixed', inset: 0, zIndex: 1600, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div className="anim-modal" role="dialog" aria-modal="true" aria-label={titulo} style={{ background: 'var(--v2-surface)', color: 'var(--v2-ink)', borderRadius: 14, padding: '18px 20px', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15.5, flex: 1 }}>{titulo}</h3>
            <button onClick={onFechar} aria-label="Fechar" style={{ border: 0, background: 'transparent', color: 'var(--v2-ink3)', cursor: 'pointer', padding: 4, display: 'flex' }}><Svg d={I.fechar} /></button>
          </div>
          {children}
        </div>
      </div>
    </LimiteDeErro>
  )
}

const amanha = () => { const d = new Date(Date.now() + 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

function ModalDatas({ alvos, marcados, onFechar, onAplicar }: { alvos: number; marcados: boolean; onFechar: () => void; onAplicar: (d: Distribuicao) => void }) {
  const [inicio, setInicio] = useState(amanha())
  const [hora, setHora] = useState('18:00')
  const [modo, setModo] = useState<'dias' | 'semana'>('dias')
  const [cadaDias, setCadaDias] = useState(1)
  const [dias, setDias] = useState<number[]>([1, 3, 5])
  const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--v2-ink2)', marginBottom: 5 }
  const campo: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 9, border: '1.5px solid var(--v2-rule)', fontSize: 13.5, fontFamily: 'inherit', background: 'var(--v2-surface)', color: 'var(--v2-ink)' }
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(inicio) && (modo === 'dias' ? cadaDias >= 1 : dias.length > 0)
  return (
    <Janela titulo="Distribuir datas" onFechar={onFechar}>
      <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--v2-ink3)' }}>Vale para {alvos} {alvos === 1 ? 'post' : 'posts'}{marcados ? ' marcados' : ''}, na ordem da lista. Depois dá para mudar qualquer um.</p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <label style={{ flex: 1 }}><span style={lbl}>A partir de</span><input type="date" value={inicio} onChange={e => setInicio(e.target.value)} style={campo} /></label>
        <label style={{ flex: 1 }}><span style={lbl}>Horário</span><input type="time" value={hora} onChange={e => setHora(e.target.value)} style={campo} /></label>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8, cursor: 'pointer' }}>
        <input type="radio" checked={modo === 'dias'} onChange={() => setModo('dias')} />
        Um post a cada
        <input type="number" min={1} max={30} value={cadaDias} onChange={e => setCadaDias(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} onFocus={() => setModo('dias')} style={{ ...campo, width: 64, padding: '6px 8px' }} />
        {cadaDias === 1 ? 'dia' : 'dias'}
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8, cursor: 'pointer' }}>
        <input type="radio" checked={modo === 'semana'} onChange={() => setModo('semana')} />
        Só nestes dias da semana:
      </label>
      <div style={{ display: 'flex', gap: 5, marginLeft: 26, marginBottom: 16, flexWrap: 'wrap' }}>
        {DIAS.map((d, n) => {
          const ativo = dias.includes(n)
          return (
            <button key={n} type="button" title={NOMES_DIAS[n]} aria-pressed={ativo} onClick={() => { setModo('semana'); setDias(l => (ativo ? l.filter(x => x !== n) : [...l, n].sort())) }}
              style={{ width: 34, height: 34, borderRadius: '50%', border: `1.5px solid ${ativo ? 'var(--v2-ink)' : 'var(--v2-rule)'}`, background: ativo ? 'var(--v2-ink)' : 'var(--v2-surface)', color: ativo ? 'var(--v2-surface)' : 'var(--v2-ink2)', fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{d}</button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onFechar} style={{ padding: '9px 16px', background: 'var(--v2-surface1)', border: 0, borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--v2-ink2)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
        <button disabled={!ok} onClick={() => onAplicar(modo === 'dias' ? { modo, inicio, hora, cadaDias } : { modo, inicio, hora, diasDaSemana: dias })}
          style={{ padding: '9px 16px', background: ok ? 'var(--v2-ink)' : 'var(--v2-surface2)', border: 0, borderRadius: 8, fontSize: 13, fontWeight: 700, color: ok ? 'var(--v2-surface)' : 'var(--v2-ink3)', cursor: ok ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>Aplicar</button>
      </div>
    </Janela>
  )
}

function ModalLegendas({ itens, selecionados, onFechar, onAplicar }: { itens: ItemLote[]; selecionados: string[]; onFechar: () => void; onAplicar: (legendas: string[], pularPreenchidas: boolean) => void }) {
  const [texto, setTexto] = useState('')
  const [pular, setPular] = useState(true)
  const legendas = dividirLegendas(texto)
  const base = (selecionados.length ? itens.filter(i => selecionados.includes(i.id)) : itens).filter(i => i.formato !== 'story' && (!pular || !i.legenda.trim()))
  return (
    <Janela titulo="Colar legendas" onFechar={onFechar}>
      <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--v2-ink3)', lineHeight: 1.5 }}>
        Cole as legendas do documento separando uma da outra com uma linha só com <strong style={{ color: 'var(--v2-ink2)' }}>---</strong>. Elas entram nos posts na ordem da lista{selecionados.length ? ' (só nos marcados)' : ''}. Story fica de fora.
      </p>
      <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={10} autoFocus placeholder={'Legenda do post 1\n---\nLegenda do post 2\n---\nLegenda do post 3'}
        style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1.5px solid var(--v2-rule)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', background: 'var(--v2-surface)', color: 'var(--v2-ink)', lineHeight: 1.45 }} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, margin: '8px 0', cursor: 'pointer', color: 'var(--v2-ink2)' }}>
        <input type="checkbox" checked={pular} onChange={e => setPular(e.target.checked)} /> Pular os posts que já têm legenda
      </label>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, fontWeight: 700, color: legendas.length && legendas.length !== base.length ? 'var(--v2-amber)' : 'var(--v2-ink2)' }}>
        {legendas.length} {legendas.length === 1 ? 'legenda encontrada' : 'legendas encontradas'} para {base.length} {base.length === 1 ? 'post' : 'posts'}.
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onFechar} style={{ padding: '9px 16px', background: 'var(--v2-surface1)', border: 0, borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--v2-ink2)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
        <button disabled={!legendas.length || !base.length} onClick={() => onAplicar(legendas, pular)}
          style={{ padding: '9px 16px', background: legendas.length && base.length ? 'var(--v2-ink)' : 'var(--v2-surface2)', border: 0, borderRadius: 8, fontSize: 13, fontWeight: 700, color: legendas.length && base.length ? 'var(--v2-surface)' : 'var(--v2-ink3)', cursor: legendas.length && base.length ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>Aplicar legendas</button>
      </div>
    </Janela>
  )
}

