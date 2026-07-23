'use client'
import { useRef, useState, useEffect } from 'react'
import { upload } from '@vercel/blob/client'
import { v4 as uuid } from 'uuid'
import { confirmar } from '@/lib/toast'
import DriveButton from './DriveButton'
import AvatarCliente from './AvatarCliente'
import { useIsMobile } from '@/lib/useIsMobile'
import { type ContaPublica } from '@/lib/contasSociais'

type Cliente = { id: string; nome: string; instagram: string; logo?: string; contas?: ContaPublica[]; [k: string]: any }
type Midia = { url: string; tipo: 'imagem' | 'video'; capa?: string }
type EmEnvio = { id: string; nome: string; progresso: number }

export type ComposerValue = {
  clienteId: string
  marcoId?: string
  legenda: string
  imagens: string[]
  dataAgendada: string
  formato: 'feed' | 'reel' | 'story'
  colaboradores: string[]
  capasVideo: Record<string, string>
  redes: ('instagram' | 'facebook')[]
  contaIds?: string[] // perfis de destino (cliente com mais de um). Vazio = principal.
  acao?: 'publicar' | 'agendar' | 'rascunho' | 'salvar' | 'aprovacao'
}

type PerfilColab = { username: string; nome: string; foto: string; seguidores: number | null }
const MAX_COLAB = 4

const FORMATOS: { key: ComposerValue['formato']; label: string }[] = [
  { key: 'feed', label: 'Feed' },
  { key: 'reel', label: 'Reel' },
  { key: 'story', label: 'Story' },
]

export default function PostComposer({
  clientes,
  valorInicial,
  onSubmit,
  onSalvarRascunho,
  aoMudar,
  enviando,
  salvandoRascunho,
  textoBotao = 'Salvar',
  travarCliente = false,
  modoEdicao = false,
}: {
  clientes: Cliente[]
  valorInicial?: Partial<ComposerValue>
  onSubmit: (valor: ComposerValue) => void
  onSalvarRascunho?: (valor: ComposerValue) => void
  // Espelha o que está na tela AGORA. Quem hospeda o compositor usa isto para
  // salvar sozinho ao fechar — trabalho começado não se perde por um clique no
  // "Voltar". Só reporta; não salva nada por conta própria.
  aoMudar?: (valor: ComposerValue) => void
  enviando?: boolean
  salvandoRascunho?: boolean
  textoBotao?: string
  travarCliente?: boolean
  modoEdicao?: boolean
}) {
  const [clienteId, setClienteId] = useState(valorInicial?.clienteId || '')
  const mobile = useIsMobile()
  const [marcoId, setMarcoId] = useState(valorInicial?.marcoId || '')
  const [marcos, setMarcos] = useState<{ id: string; titulo: string }[]>([])
  useEffect(() => {
    if (!clienteId) { setMarcos([]); return }
    fetch(`/api/playbook?clienteId=${clienteId}`).then(r => r.json()).then(d => setMarcos(Array.isArray(d) ? d : [])).catch(() => {})
  }, [clienteId])
  const [legenda, setLegenda] = useState(valorInicial?.legenda || '')
  const [midias, setMidias] = useState<Midia[]>(
    (valorInicial?.imagens || []).map(url => ({
      url,
      tipo: /\.(mp4|mov)(\?|$)/i.test(url) ? 'video' as const : 'imagem' as const,
      capa: valorInicial?.capasVideo?.[url],
    }))
  )
  const [enviandoCapa, setEnviandoCapa] = useState<number | null>(null)
  const [frameModal, setFrameModal] = useState<{ idx: number; url: string } | null>(null)
  const [capturandoFrame, setCapturandoFrame] = useState(false)
  const videoFrameRef = useRef<HTMLVideoElement>(null)

  async function capturarFrameDoVideo() {
    if (!frameModal) return
    const video = videoFrameRef.current
    if (!video) return
    setErroUpload('')
    // Precisa de um frame decodificado: o usuário deve dar play e pausar antes
    if (!video.videoWidth || video.readyState < 2) {
      setErroUpload('Dê play e pause no momento desejado do vídeo antes de capturar o frame.')
      return
    }
    setCapturandoFrame(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      let blob: Blob | null = null
      try {
        blob = await new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('frame')), 'image/jpeg', 0.9))
      } catch {
        // canvas "contaminado" por CORS — não é possível extrair a imagem
        throw new Error('Este vídeo não permite captura automática (restrição de origem). Envie uma capa manualmente em "Capa".')
      }
      const file = new File([blob], `frame-${uuid()}.jpg`, { type: 'image/jpeg' })
      const up = await upload(`midia/capa-${uuid()}.jpg`, file, { access: 'public', handleUploadUrl: '/api/upload', contentType: 'image/jpeg', clientPayload: 'image/jpeg' })
      const idx = frameModal.idx
      setMidias(m => m.map((mid, i) => i === idx ? { ...mid, capa: up.url } : mid))
      setFrameModal(null)
    } catch (e: any) {
      // Mantém o modal aberto para o usuário tentar de novo
      setErroUpload(e?.message || 'Não foi possível capturar o frame deste vídeo. Tente enviar uma capa manualmente.')
    } finally {
      setCapturandoFrame(false)
    }
  }
  const [redes, setRedes] = useState<('instagram' | 'facebook')[]>(valorInicial?.redes || ['instagram', 'facebook'])
  const [modoAgendar, setModoAgendar] = useState(false)

  function alternarRede(rede: 'instagram' | 'facebook') {
    setRedes(atual => atual.includes(rede) ? atual.filter(r => r !== rede) : [...atual, rede])
  }

  // Perfis do cliente atual (forma pública do GET: flags, sem token). Só vira
  // escolha quando há MAIS DE UM — cliente com um perfil só (a maioria) não vê
  // nada disso e o post não carrega contaIds.
  const clienteAtual = clientes.find(c => c.id === clienteId)
  const contas: ContaPublica[] = clienteAtual?.contas || []
  const multiPerfil = contas.length > 1
  const [contaIds, setContaIds] = useState<string[]>(valorInicial?.contaIds || [])
  // Ao entrar num cliente multi-perfil sem escolha prévia, marca todos por
  // padrão — o comportamento antigo era "vai para a conta do cliente".
  useEffect(() => {
    if (!multiPerfil) { setContaIds([]); return }
    setContaIds(prev => {
      const validos = prev.filter(id => contas.some(c => c.id === id))
      return validos.length ? validos : contas.map(c => c.id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, contas.length])
  function alternarConta(id: string) {
    setContaIds(atual => atual.includes(id) ? atual.filter(c => c !== id) : [...atual, id])
  }
  const [dataAgendada, setDataAgendada] = useState(valorInicial?.dataAgendada || '')
  const [formato, setFormato] = useState<ComposerValue['formato']>(valorInicial?.formato || 'feed')
  const [previewIdx, setPreviewIdx] = useState(0) // lamina atual no preview (estilo Instagram)
  const [colaboradores, setColaboradores] = useState<string[]>(valorInicial?.colaboradores || [])
  const [colabBusca, setColabBusca] = useState('')
  const [colabResultado, setColabResultado] = useState<PerfilColab | null>(null)
  const [colabBuscando, setColabBuscando] = useState(false)
  const [colabErro, setColabErro] = useState('')
  const colabTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const [emEnvio, setEmEnvio] = useState<EmEnvio[]>([])
  const [erroUpload, setErroUpload] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const cliente = clientes.find(c => c.id === clienteId)

  // Comprime imagens grandes (reduz para máx. 1440px, JPEG) — evita limite do Facebook e economiza armazenamento
  async function comprimirImagem(file: File): Promise<File> {
    if (!file.type.startsWith('image/') || /gif/i.test(file.type)) return file
    // Imagens pequenas ja estao seguras para as redes
    if (file.size < 1.2 * 1024 * 1024) return file
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file)
      })
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = dataUrl
      })
      // Alvo bem abaixo do limite de 10MB das redes (Instagram/Facebook)
      const LIMITE = 8 * 1024 * 1024
      let maxLado = 1920
      let qualidade = 0.9
      let melhor: Blob | null = null
      for (let tentativa = 0; tentativa < 6; tentativa++) {
        let { width, height } = img
        if (Math.max(width, height) > maxLado) {
          const esc = maxLado / Math.max(width, height)
          width = Math.round(width * esc); height = Math.round(height * esc)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d'); if (!ctx) return file
        ctx.drawImage(img, 0, 0, width, height)
        const blob = await new Promise<Blob | null>(r => canvas.toBlob(b => r(b), 'image/jpeg', qualidade))
        if (!blob) break
        melhor = blob
        if (blob.size <= LIMITE) break
        // Ainda grande: reduz qualidade e dimensao e tenta de novo
        qualidade = Math.max(0.5, qualidade - 0.15)
        maxLado = Math.round(maxLado * 0.85)
      }
      if (!melhor || melhor.size >= file.size) return file
      return new File([melhor], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
    } catch { return file }
  }

  async function enviarArquivos(arquivos: FileList | File[]) {
    setErroUpload('')
    // Ordena pelos numeros das laminas no nome (1, 2, 3... 10) — ordenacao natural,
    // para o carrossel seguir a numeracao dos arquivos independente da ordem de selecao.
    const ordenados = Array.from(arquivos).sort((a, b) => a.name.localeCompare(b.name, 'pt', { numeric: true, sensitivity: 'base' }))
    for (const original of ordenados) {
      // Verifica tamanho antes de tentar upload (limite: 200MB)
      if (original.size > 500 * 1024 * 1024) {
        setErroUpload(`O arquivo "${original.name}" tem ${(original.size / 1024 / 1024).toFixed(0)}MB e excede o limite de 500MB. Reduza o tamanho ou comprima o video antes de enviar.`)
        continue
      }
      const arquivo = await comprimirImagem(original)
      const id = uuid()
      const ext = arquivo.name.split('.').pop() || 'bin'
      setEmEnvio(lista => [...lista, { id, nome: arquivo.name, progresso: 0 }])
      try {
        const blob = await upload(`midia/${id}.${ext}`, arquivo, {
          access: 'public',
          handleUploadUrl: '/api/upload',
          contentType: arquivo.type,
          clientPayload: arquivo.type,
          onUploadProgress: ({ percentage }) => {
            setEmEnvio(lista => lista.map(e => e.id === id ? { ...e, progresso: percentage } : e))
          },
        })
        setMidias(m => [...m, { url: blob.url, tipo: arquivo.type.startsWith('video') ? 'video' : 'imagem' }])
      } catch (err: any) {
        setErroUpload(err?.message || 'Erro ao enviar arquivo. Tente novamente.')
        // (capa de vídeo é tratada em enviarCapa)
      } finally {
        setEmEnvio(lista => lista.filter(e => e.id !== id))
      }
    }
  }

  function removerMidia(idx: number) {
    setMidias(m => m.filter((_, i) => i !== idx))
  }

  // Reordenar mídias do carrossel (arrastar e soltar)
  const [dragMidia, setDragMidia] = useState<number | null>(null)
  const [overMidia, setOverMidia] = useState<number | null>(null)
  function moverMidia(de: number, para: number) {
    if (de === para || de < 0 || para < 0) return
    setMidias(arr => {
      const novo = [...arr]
      const [item] = novo.splice(de, 1)
      novo.splice(para, 0, item)
      return novo
    })
  }

  // Envia uma imagem de capa (thumbnail) para um vídeo específico
  async function enviarCapa(idx: number, arquivoOriginal: File) {
    setEnviandoCapa(idx)
    try {
      const arquivo = await comprimirImagem(arquivoOriginal)
      const ext = arquivo.name.split('.').pop() || 'jpg'
      const blob = await upload(`midia/capa-${uuid()}.${ext}`, arquivo, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        contentType: arquivo.type,
        clientPayload: arquivo.type,
      })
      setMidias(m => m.map((mid, i) => i === idx ? { ...mid, capa: blob.url } : mid))
    } catch (err: any) {
      setErroUpload(err?.message || 'Erro ao enviar a capa. Tente novamente.')
    } finally {
      setEnviandoCapa(null)
    }
  }

  function montarCapasVideo(): Record<string, string> {
    const mapa: Record<string, string> = {}
    for (const m of midias) if (m.tipo === 'video' && m.capa) mapa[m.url] = m.capa
    return mapa
  }

  function buscarColab(termo: string) {
    setColabBusca(termo)
    setColabResultado(null)
    setColabErro('')
    if (colabTimer.current) clearTimeout(colabTimer.current)
    const limpo = termo.trim().replace(/^@/, '')
    if (limpo.length < 2) { setColabBuscando(false); return }
    if (!clienteId) { setColabBuscando(false); setColabErro('Selecione um cliente primeiro para buscar perfis.'); return }
    setColabBuscando(true)
    colabTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/colab?clienteId=${encodeURIComponent(clienteId)}&username=${encodeURIComponent(limpo)}`)
        const data = await res.json()
        if (data.encontrado) {
          setColabResultado(data.perfil)
          setColabErro('')
        } else {
          setColabResultado(null)
          setColabErro(data.error || 'Perfil não encontrado.')
        }
      } catch {
        setColabErro('Erro ao buscar perfil. Tente novamente.')
      } finally {
        setColabBuscando(false)
      }
    }, 450)
  }

  function adicionarColab(username: string) {
    const limpo = username.trim().replace(/^@/, '')
    if (!limpo) return
    setColaboradores(lista => {
      if (lista.length >= MAX_COLAB || lista.some(c => c.toLowerCase() === limpo.toLowerCase())) return lista
      return [...lista, limpo]
    })
    setColabBusca('')
    setColabResultado(null)
    setColabErro('')
  }

  function removerColab(username: string) {
    setColaboradores(lista => lista.filter(c => c !== username))
  }

  function onColabKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (colabResultado) adicionarColab(colabResultado.username)
      else {
        const limpo = colabBusca.trim().replace(/^@/, '')
        if (/^[A-Za-z0-9._]{1,30}$/.test(limpo)) adicionarColab(limpo)
      }
    }
  }

  const videosSemCapa = midias.filter(m => m.tipo === 'video' && !m.capa).length
  // Story no IG nao usa legenda, capa nem collab — o backend ja ignora (lib/publicar.ts).
  const ehStory = formato === 'story'

  // Reporta o estado atual a cada mudança (ver prop `aoMudar`).
  useEffect(() => {
    aoMudar?.({ clienteId, marcoId, legenda, imagens: midias.map(m => m.url), dataAgendada, formato, colaboradores, capasVideo: montarCapasVideo(), redes, ...(multiPerfil ? { contaIds } : {}) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, marcoId, legenda, midias, dataAgendada, formato, colaboradores, redes, contaIds, multiPerfil])

  async function submeter(acao: ComposerValue['acao']) {
    // Capa é obrigatória para vídeos ao publicar ou agendar (rascunho pode salvar sem)
    if ((acao === 'publicar' || acao === 'agendar') && !ehStory && videosSemCapa > 0) {
      setErroUpload(`Defina uma capa para ${videosSemCapa > 1 ? 'cada vídeo' : 'o vídeo'} (botão "Frame" ou "Capa") antes de publicar ou agendar.`)
      return
    }
    if (clienteId && !marcoId) {
      setErroUpload('Vincule o post a uma etapa do Playbook do cliente antes de continuar.')
      return
    }
    // TRAVA DE SEGURANCA: se ha um horario FUTURO definido e o usuario clicou "Publicar agora",
    // confirma antes — evita postar imediatamente algo que deveria ser agendado.
    if (acao === 'publicar' && dataAgendada) {
      const dt = new Date(dataAgendada)
      if (!isNaN(dt.getTime()) && dt.getTime() > Date.now() + 60000) {
        const ok = await confirmar(
          `Você definiu o horário ${dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}. "Publicar agora" vai postar IMEDIATAMENTE, ignorando esse horário. Para publicar no horário definido, use "Agendar". Deseja mesmo publicar AGORA?`,
          { titulo: 'Publicar agora?', okLabel: 'Publicar agora', perigo: true }
        )
        if (!ok) return
      }
    }
    onSubmit({ clienteId, marcoId, legenda, imagens: midias.map(m => m.url), dataAgendada, formato, colaboradores, capasVideo: montarCapasVideo(), redes, ...(multiPerfil ? { contaIds } : {}), acao })
  }

  const enviandoArquivo = emEnvio.length > 0
  const marcoOk = !clienteId || !!marcoId
  const perfilOk = !multiPerfil || contaIds.length > 0
  const podePublicar = !!clienteId && marcoOk && perfilOk && (ehStory || !!legenda.trim()) && midias.length > 0 && redes.length > 0 && (ehStory || videosSemCapa === 0) && !enviando && !enviandoArquivo
  const podeRascunho = !!clienteId && marcoOk && !enviando && !enviandoArquivo

  return (
    <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'minmax(0, 1.3fr) minmax(280px, 1fr)', gap: mobile ? 16 : 24, alignItems: 'start' }}>
      {/* Coluna esquerda: formulário/editor */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Cliente — dropdown na agência; travado na visão de cliente */}
        {!travarCliente && (
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Cliente</label>
            <select value={clienteId} onChange={e => { setClienteId(e.target.value); setMarcoId('') }}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, background: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }}>
              <option value="">Selecione o cliente...</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome} (@{c.instagram?.replace(/^@/, '')})</option>)}
            </select>
          </div>
        )}

        {/* Etapa do Playbook — vinculo obrigatorio */}
        {clienteId && (
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Etapa do Playbook *</label>
            <select value={marcoId} onChange={e => setMarcoId(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, background: '#fff', fontFamily: 'inherit', boxSizing: 'border-box' }}>
              <option value="">{marcos.length === 0 ? 'Nenhuma etapa — crie no Playbook' : 'Selecione a etapa...'}</option>
              {marcos.map(m => <option key={m.id} value={m.id}>{m.titulo}</option>)}
            </select>
            {marcos.length === 0 && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ea580c' }}>Este cliente não tem etapas no Playbook. Crie uma etapa antes de publicar/agendar.</p>}
          </div>
        )}

        {/* Perfis de destino — só aparece quando o cliente tem mais de um */}
        {multiPerfil && (
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Perfis</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {contas.map(conta => {
                const ativo = contaIds.includes(conta.id)
                const redesConta = [conta.temInstagram ? 'IG' : null, conta.temFacebook ? 'FB' : null].filter(Boolean).join(' · ')
                return (
                  <button key={conta.id} type="button" onClick={() => alternarConta(conta.id)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 13px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                      border: `1.5px solid ${ativo ? '#1877f2' : '#e0e0e0'}`, background: ativo ? '#1877f210' : '#fff' }}>
                    <span style={{ width: 16, height: 16, borderRadius: 5, border: `1.5px solid ${ativo ? '#1877f2' : '#ccc'}`, background: ativo ? '#1877f2' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {ativo && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                    </span>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--marca, #ffc00f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#111' }}>
                      <AvatarCliente logo={conta.logo} nome={conta.nome} />
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, textAlign: 'left' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{conta.nome}</span>
                      {redesConta && <span style={{ fontSize: 10.5, color: '#999' }}>{redesConta}</span>}
                    </span>
                  </button>
                )
              })}
            </div>
            {contaIds.length === 0 && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444' }}>Selecione ao menos um perfil.</p>}
            <p style={{ margin: '6px 0 0', fontSize: 11.5, color: '#aaa' }}>O mesmo conteúdo vai para os perfis marcados. As redes abaixo valem para cada um.</p>
          </div>
        )}

        {/* Redes onde publicar */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Publicar em</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {([
              { key: 'instagram' as const, nome: 'Instagram', cor: '#dc2743' },
              { key: 'facebook' as const, nome: 'Facebook', cor: '#1877f2' },
            ]).map(r => {
              const ativo = redes.includes(r.key)
              const sel = '#1877f2' // cor azul da seleção, igual para as duas redes
              return (
                <button key={r.key} type="button" onClick={() => alternarRede(r.key)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                    border: `1.5px solid ${ativo ? sel : '#e0e0e0'}`, background: ativo ? `${sel}10` : '#fff', fontFamily: 'inherit',
                  }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${ativo ? sel : '#ccc'}`, background: ativo ? sel : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, flexShrink: 0,
                  }}>{ativo ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg> : null}</span>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: r.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff">{r.key === 'facebook'
                      ? <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      : <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8z"/>}</svg>
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{r.nome}</span>
                </button>
              )
            })}
          </div>
          {redes.length === 0 && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444' }}>Selecione ao menos uma rede.</p>}
        </div>

        {/* Upload de mídia */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Mídia (imagens ou vídeos)</label>
          <div
            onDragOver={e => { e.preventDefault(); setArrastando(true) }}
            onDragLeave={() => setArrastando(false)}
            onDrop={e => {
              e.preventDefault()
              setArrastando(false)
              if (e.dataTransfer.files?.length) enviarArquivos(e.dataTransfer.files)
            }}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `1.5px dashed ${arrastando ? '#ffc00f' : '#e0e0e0'}`,
              borderRadius: 12, padding: '24px 16px', textAlign: 'center', cursor: 'pointer',
              background: arrastando ? '#fffbeb' : '#fafafa', transition: 'all .15s',
            }}
          >
            <input ref={inputRef} type="file" multiple accept="image/*,video/*" style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.length) enviarArquivos(e.target.files); e.target.value = '' }} />
            <p style={{ margin: 0, fontSize: 13, color: '#888' }}>
              {enviandoArquivo ? 'Enviando arquivo...' : 'Arraste arquivos aqui ou clique para selecionar'}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#bbb' }}>JPG, PNG, WEBP, GIF, MP4, MOV — até 500MB</p>
          </div>

          {/* Importar do Google Drive (Picker nativo — navega no Drive da conta) */}
          <div style={{ marginTop: 12, padding: 12, border: '1.5px solid #e0e0e0', borderRadius: 12, background: '#fafafa' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#555' }}>Importar mídias do Google Drive</span>
            </div>
            <DriveButton onArquivos={enviarArquivos} />
            <p style={{ margin: '6px 0 0', fontSize: 10.5, color: '#aaa', lineHeight: 1.4 }}>As lâminas entram na ordem da numeração (1, 2, 3...).</p>
          </div>

          {emEnvio.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {emEnvio.map(e => (
                <div key={e.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginBottom: 4 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{e.nome}</span>
                    <span>{Math.round(e.progresso)}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: '#eee', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${e.progresso}%`, background: '#ffc00f', transition: 'width .2s' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {erroUpload && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#ef4444' }}>{erroUpload}</p>
          )}

          {midias.length > 1 && (
            <p style={{ margin: '12px 0 0', fontSize: 11, color: '#aaa' }}>Arraste as mídias para reordenar o carrossel (a ordem abaixo é a ordem da publicação).</p>
          )}
          {midias.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
              {midias.map((m, i) => (
                <div key={i}
                  draggable={midias.length > 1}
                  onDragStart={() => setDragMidia(i)}
                  onDragOver={(e) => { if (dragMidia !== null) { e.preventDefault(); setOverMidia(i) } }}
                  onDragLeave={() => setOverMidia(o => (o === i ? null : o))}
                  onDrop={(e) => { e.preventDefault(); if (dragMidia !== null) moverMidia(dragMidia, i); setDragMidia(null); setOverMidia(null) }}
                  onDragEnd={() => { setDragMidia(null); setOverMidia(null) }}
                  style={{
                    position: 'relative', width: 84, height: 84, borderRadius: 10, overflow: 'hidden', background: '#eee',
                    cursor: midias.length > 1 ? 'grab' : 'default',
                    opacity: dragMidia === i ? 0.4 : 1,
                    outline: overMidia === i && dragMidia !== i ? '2px solid #ffc00f' : 'none', outlineOffset: -2,
                  }}>
                  {m.tipo === 'video' ? (
                    m.capa
                      ? <img src={m.capa} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      : <video src={m.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                  ) : (
                    <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  )}
                  {midias.length > 1 && (
                    <span style={{ position: 'absolute', top: 4, left: 4, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                  )}
                  {midias.length > 1 && i > 0 && (
                    <button onClick={(e) => { e.stopPropagation(); moverMidia(i, i - 1) }} title="Mover para a esquerda"
                      style={{ position: 'absolute', left: 2, top: '50%', transform: 'translateY(-50%)', width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                    </button>
                  )}
                  {midias.length > 1 && i < midias.length - 1 && (
                    <button onClick={(e) => { e.stopPropagation(); moverMidia(i, i + 1) }} title="Mover para a direita"
                      style={{ position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)', width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                    </button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); removerMidia(i) }} style={{
                    position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, lineHeight: 1,
                  }}>×</button>
                  {m.tipo === 'video' && (
                    <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                      <button onClick={() => { setErroUpload(''); setFrameModal({ idx: i, url: m.url }) }} title="Escolher um frame do vídeo como capa"
                        style={{ flex: 1, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 9, fontWeight: 700, border: 'none', padding: '4px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 3v18M17 3v18M3 12h18" /></svg> Frame
                      </button>
                      <label title="Enviar uma imagem de capa"
                        style={{ flex: 1, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 9, fontWeight: 700, textAlign: 'center', padding: '4px 0', cursor: 'pointer', borderLeft: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        {enviandoCapa === i ? '...' : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.5-3.5L5 21" /></svg> Capa</>}
                        <input type="file" accept="image/*" style={{ display: 'none' }} disabled={enviandoCapa !== null}
                          onChange={e => { if (e.target.files?.[0]) enviarCapa(i, e.target.files[0]); e.target.value = '' }} />
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {!ehStory && videosSemCapa > 0 && (
            <p style={{ margin: '10px 0 0', fontSize: 12, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px' }}>
              {videosSemCapa > 1 ? `${videosSemCapa} vídeos estão` : 'Um vídeo está'} sem capa. Defina a capa pelo botão "Frame" ou "Capa" para poder publicar ou agendar.
            </p>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Legenda{ehStory && <span style={{ fontWeight: 400, color: '#aaa', marginLeft: 6 }}>(opcional no Story)</span>}</label>
          <textarea value={legenda} onChange={e => setLegenda(e.target.value)}
            placeholder="Escreva a legenda do post..."
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, minHeight: 130, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>

        {/* Formato */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Formato</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {FORMATOS.map(f => (
              <button key={f.key} onClick={() => setFormato(f.key)} type="button" style={{
                padding: '8px 18px', borderRadius: 999, border: '1.5px solid', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                borderColor: formato === f.key ? '#111' : '#e0e0e0',
                background: formato === f.key ? '#111' : '#fff',
                color: formato === f.key ? '#ffc00f' : '#888',
              }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Colaboração (collab) — não se aplica a Story (o IG não suporta collab em Stories) */}
        {!ehStory && (
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>
            Marcar em colab com outro perfil
            <span style={{ fontWeight: 400, color: '#aaa', marginLeft: 6 }}>({colaboradores.length}/{MAX_COLAB})</span>
          </label>

          {/* Tags já selecionadas */}
          {colaboradores.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {colaboradores.map(c => (
                <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#111', color: '#ffc00f', borderRadius: 999, padding: '5px 6px 5px 12px', fontSize: 13, fontWeight: 700 }}>
                  @{c}
                  <button type="button" onClick={() => removerColab(c)} style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </span>
              ))}
            </div>
          )}

          {colaboradores.length < MAX_COLAB && (
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #e0e0e0', borderRadius: 10, background: '#fff', padding: '0 14px', boxSizing: 'border-box' }}>
                <span style={{ fontSize: 14, color: '#bbb' }}>@</span>
                <input value={colabBusca} onChange={e => buscarColab(e.target.value)} onKeyDown={onColabKeyDown}
                  placeholder="Buscar perfil no Instagram..."
                  style={{ flex: 1, padding: '12px 8px', border: 'none', outline: 'none', fontSize: 14, fontFamily: 'inherit', background: 'transparent' }} />
                {colabBuscando && <span style={{ fontSize: 11, color: '#bbb' }}>buscando…</span>}
              </div>

              {/* Resultado da busca (Enter ou clique para selecionar) */}
              {colabResultado && (
                <div onClick={() => adicionarColab(colabResultado.username)}
                  style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1.5px solid #e0e0e0', borderRadius: 10, padding: 10, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.08)', zIndex: 5 }}>
                  {colabResultado.foto
                    ? <img src={colabResultado.foto} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#eee', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111' }}>@{colabResultado.username}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {colabResultado.nome}{colabResultado.seguidores != null ? ` · ${colabResultado.seguidores.toLocaleString('pt-BR')} seguidores` : ''}
                    </p>
                  </div>
                  <span style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>Enter</span>
                </div>
              )}

              {/* Fallback: adicionar qualquer @ digitado (inclui contas pessoais, que a API do Meta não valida) */}
              {!colabResultado && !colabBuscando && /^[A-Za-z0-9._]{2,30}$/.test(colabBusca.trim().replace(/^@/, '')) && (
                <div onClick={() => adicionarColab(colabBusca)}
                  style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1.5px solid #e0e0e0', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.08)', zIndex: 5 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#eee', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontWeight: 800 }}>@</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111' }}>Adicionar @{colabBusca.trim().replace(/^@/, '')}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#888' }}>{colabErro ? colabErro : 'Perfil não verificado pela API — será marcado mesmo assim.'}</p>
                  </div>
                  <span style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>Enter</span>
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {/* Data e horario — sempre visivel */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Data e horário da publicação <span style={{ color: '#aaa', fontWeight: 400 }}>(opcional)</span></label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', border: `1.5px solid ${dataAgendada ? '#111' : '#e0e0e0'}`, borderRadius: 10, padding: '0 6px 0 14px', background: '#fff', minWidth: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: 8 }}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              <input type="datetime-local" value={dataAgendada} onChange={e => setDataAgendada(e.target.value)} min={new Date().toISOString().slice(0, 16)}
                style={{ flex: 1, padding: '14px 0', border: 'none', outline: 'none', fontSize: 15, fontFamily: 'inherit', background: 'transparent', minWidth: 0 }} />
            </div>
            {dataAgendada && (
              <button type="button" onClick={() => setDataAgendada('')} title="Remover data e horário"
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, background: 'transparent', color: '#999', border: 'none', cursor: 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            )}
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 11, color: dataAgendada ? '#1d4ed8' : '#aaa' }}>
            {dataAgendada ? 'Com data preenchida, o botão publica no horário escolhido (Agendar).' : 'Em branco, o botão publica imediatamente (Publicar agora).'}
          </p>
        </div>

        {/* Acoes: Rascunho · Enviar para aprovacao · Publicar/Agendar */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => submeter(modoEdicao ? 'salvar' : 'rascunho')} disabled={modoEdicao ? !podePublicar : !podeRascunho} type="button"
            style={{ flex: '1 1 110px', padding: '14px 0', background: '#fff', color: '#111', border: '1.5px solid #e0e0e0', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: (modoEdicao ? podePublicar : podeRascunho) ? 'pointer' : 'not-allowed', opacity: (modoEdicao ? podePublicar : podeRascunho) ? 1 : 0.5 }}>
            {modoEdicao ? (enviando ? 'Salvando...' : 'Salvar alterações') : (salvandoRascunho ? 'Salvando...' : 'Rascunho')}
          </button>
          <button onClick={() => submeter('aprovacao')} disabled={!podePublicar} type="button"
            style={{ flex: '1 1 150px', padding: '14px 0', background: '#111', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: podePublicar ? 'pointer' : 'not-allowed', opacity: podePublicar ? 1 : 0.5 }}>
            {enviando ? 'Enviando...' : 'Enviar para aprovação'}
          </button>
          <button onClick={() => submeter(dataAgendada ? 'agendar' : 'publicar')} disabled={!podePublicar} type="button"
            style={{ flex: '1.3 1 150px', padding: '14px 0', background: 'var(--marca, #ffc00f)', color: 'var(--marca-texto, #111)', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: podePublicar ? 'pointer' : 'not-allowed', opacity: podePublicar ? 1 : 0.5 }}>
            {enviando
              ? (dataAgendada ? 'Agendando...' : 'Publicando...')
              : (dataAgendada ? 'Agendar' : 'Publicar agora')}
          </button>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 11, color: '#999' }}>
          "Enviar para aprovação" gera um link para o cliente. Ao aprovar, {dataAgendada ? 'agenda para a data escolhida' : 'publica na hora'}.
        </p>
      </div>

      {/* Coluna direita: preview ao vivo */}
      <div style={{ position: 'sticky', top: 16 }}>
        <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Pré-visualização
        </p>
        <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#ffc00f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: '#111', flexShrink: 0, overflow: 'hidden' }}>
              <AvatarCliente logo={cliente?.logo} nome={cliente?.nome} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>
              {cliente ? cliente.instagram.replace(/^@/, '') : 'seu_cliente'}
              {colaboradores.length > 0 && (
                <span style={{ fontWeight: 400, color: '#888' }}> e {colaboradores.map(c => c).join(', ')}</span>
              )}
            </span>
            {formato !== 'feed' && (
              <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#888', background: '#f5f5f5', borderRadius: 999, padding: '3px 9px', textTransform: 'uppercase' }}>
                {formato === 'reel' ? 'Reel' : 'Story'}
              </span>
            )}
          </div>

          {(() => {
            const idx = Math.min(previewIdx, Math.max(0, midias.length - 1))
            const m = midias[idx]
            return (
              <div style={{
                position: 'relative', width: '100%', aspectRatio: formato === 'story' || formato === 'reel' ? '9/16' : '4/5', background: '#f4f4f4', overflow: 'hidden',
              }}>
                {midias.length === 0 ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 13, textAlign: 'center', padding: 16 }}>
                    Suas imagens/vídeos aparecerão aqui
                  </div>
                ) : m.tipo === 'video'
                  ? <video src={m.url} poster={m.capa} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted controls />
                  : <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}

                {midias.length > 1 && (
                  <>
                    {/* Seta esquerda */}
                    {idx > 0 && (
                      <button type="button" onClick={() => setPreviewIdx(idx - 1)} aria-label="Lâmina anterior"
                        style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.85)', color: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                      </button>
                    )}
                    {/* Seta direita */}
                    {idx < midias.length - 1 && (
                      <button type="button" onClick={() => setPreviewIdx(idx + 1)} aria-label="Próxima lâmina"
                        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.85)', color: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                      </button>
                    )}
                    {/* Contador 1/N */}
                    <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px' }}>{idx + 1}/{midias.length}</div>
                    {/* Bolinhas */}
                    <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5 }}>
                      {midias.map((_, i) => (
                        <span key={i} onClick={() => setPreviewIdx(i)} style={{ width: 6, height: 6, borderRadius: '50%', background: i === idx ? '#fff' : 'rgba(255,255,255,0.5)', boxShadow: '0 0 2px rgba(0,0,0,0.4)', cursor: 'pointer' }} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )
          })()}

          <div style={{ padding: 14 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#333', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              <strong>{cliente ? cliente.instagram.replace(/^@/, '') : 'seu_cliente'}</strong>{' '}
              {legenda || <span style={{ color: '#ccc' }}>Sua legenda aparecerá aqui...</span>}
            </p>
            {dataAgendada && (
              <p style={{ margin: '10px 0 0', fontSize: 11, color: '#aaa' }}>
                Agendado para {new Date(dataAgendada).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Modal: escolher um frame do vídeo como capa */}
      {frameModal && (
        <div onClick={() => !capturandoFrame && setFrameModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 18, width: '100%', maxWidth: 480 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#111' }}>Escolher capa do vídeo</h3>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#888' }}>Dê play e pause no momento que quiser — depois clique em "Usar este frame".</p>
            <video ref={videoFrameRef} src={`${frameModal.url}${frameModal.url.includes('?') ? '&' : '?'}cors=1`} crossOrigin="anonymous" controls playsInline muted
              style={{ width: '100%', borderRadius: 10, background: '#000', maxHeight: '60vh' }} />
            {erroUpload && <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#dc2626', fontWeight: 600 }}>{erroUpload}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button onClick={() => setFrameModal(null)} disabled={capturandoFrame}
                style={{ flex: 1, padding: '12px 0', background: '#fff', color: '#666', border: '1.5px solid #e0e0e0', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={capturarFrameDoVideo} disabled={capturandoFrame}
                style={{ flex: 1.4, padding: '12px 0', background: '#ffc00f', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: capturandoFrame ? 0.6 : 1 }}>
                {capturandoFrame ? 'Capturando...' : 'Usar este frame'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
