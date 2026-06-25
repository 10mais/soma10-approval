'use client'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Calendar from '../components/Calendar'
import PostComposer from '../components/PostComposer'
import ConectarRedesModal from '../components/ConectarRedesModal'

const ChatInterno = dynamic(() => import('../components/ChatInterno'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const Esteira = dynamic(() => import('../components/Esteira'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const DashboardHome = dynamic(() => import('../components/DashboardHome'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const GestaoTarefas = dynamic(() => import('../components/GestaoTarefas'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const Playbook = dynamic(() => import('../components/Playbook'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const MinhaConta = dynamic(() => import('../components/MinhaConta'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const Briefings = dynamic(() => import('../components/Briefings'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const Candidaturas = dynamic(() => import('../components/Candidaturas'), { ssr: false, loading: () => <LoadingPlaceholder /> })

function LoadingPlaceholder() {
  return (
    <div style={{ padding: '40px 0' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ width: '35%', height: 22, background: '#f0f0f0', borderRadius: 8, animation: 'shimmer 1.5s infinite' }} />
        <div style={{ display: 'flex', gap: 12 }}>
          {[1,2,3].map(i => <div key={i} style={{ flex: 1, height: 120, background: '#f5f5f5', borderRadius: 12, animation: 'shimmer 1.5s infinite', animationDelay: `${i * 0.2}s` }} />)}
        </div>
        <div style={{ width: '60%', height: 14, background: '#f5f5f5', borderRadius: 6, animation: 'shimmer 1.5s infinite' }} />
        <div style={{ width: '40%', height: 14, background: '#f8f8f8', borderRadius: 6, animation: 'shimmer 1.5s infinite' }} />
      </div>
    </div>
  )
}
import { upload } from '@vercel/blob/client'
import { v4 as uuid } from 'uuid'
import { gerarRelatorioMensal } from '@/lib/relatorioMensal'
import { setViewAsClient } from '@/lib/modoCliente'

type Post = { id: string; clienteId?: string; clienteNome: string; status: string; dataAgendada?: string; legenda: string; imagens: string[]; codigo?: string; formato?: string; erroPublicacao?: string; criadoEm?: string; atualizadoEm?: string; thumbnail?: string }
type Cliente = { id: string; nome: string; instagram: string; metaConectado?: boolean; instagramUsername?: string; instagramConectado?: boolean; instagramUserId?: string; facebookPageId?: string; loginEmail?: string; loginSenha?: string; logo?: string; corPrimaria?: string; corSecundaria?: string; tipo?: 'cliente' | 'interno'; entregaveis?: string[]; postsMensais?: number; contratoValor?: number; contratoInicio?: string; contratoRenovacao?: string; contratoCiclo?: 'mensal' | 'trimestral' | 'semestral' | 'anual'; segmento?: string; palavrasChave?: string; descricao?: string; publicoAlvo?: string; tomDeVoz?: string; preferencias?: string; documentos?: { nome: string; url: string }[] }
type ConfigAgencia = { nomeAgencia: string; emailContato?: string; logo?: string; corPrimaria?: string; corSecundaria?: string }
type MetaPage = { pageId: string; pageName: string; pageToken: string | null; igToken?: string; igUserId?: string; instagram: { id: string; username: string; profilePic?: string } | null }

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  agendado: 'Agendado',
  aguardando_aprovacao: 'Aguardando',
  aprovado: 'Aprovado',
  corrigir: 'Corrigir',
  reprovado: 'Reprovado',
  publicado: 'Publicado',
  falha_publicacao: 'Falha ao publicar',
}

// Cor de fundo (clara) do selo / bolinha
const STATUS_COLOR: Record<string, string> = {
  rascunho: '#eeeeee',
  agendado: '#fef9c3',
  aguardando_aprovacao: '#fef3c7',
  aprovado: '#dcfce7',
  corrigir: '#fff3cd',
  reprovado: '#fee2e2',
  publicado: '#dcfce7',
  falha_publicacao: '#fde2e2',
}

// Cor do texto do selo
const STATUS_TEXT: Record<string, string> = {
  rascunho: '#666666',
  agendado: '#a16207',       // amarelo/âmbar
  aguardando_aprovacao: '#92400e',
  aprovado: '#16a34a',
  corrigir: '#b45309',
  reprovado: '#b91c1c',
  publicado: '#16a34a',      // verde
  falha_publicacao: '#991b1b', // vermelho escuro
}

const ENTREGAVEIS_OPCOES = [
  { key: 'social_media', label: 'Social Media' },
  { key: 'trafego_meta', label: 'Trafego pago Meta Ads' },
  { key: 'trafego_google', label: 'Trafego pago Google Ads' },
  { key: 'landing_page', label: 'Landing Page(s)' },
  { key: 'branding', label: 'Branding / Identidade visual' },
  { key: 'email_marketing', label: 'E-mail marketing' },
  { key: 'consultoria', label: 'Consultoria' },
  { key: 'crm', label: 'Sistema CRM' },
  { key: 'google_meu_negocio', label: 'Google Meu Negocio' },
]

// Ícones de contorno (substituem emojis por um visual mais profissional)
function Icon({ children, size = 16, ...props }: { children: any; size?: number } & Record<string, any>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {children}
    </svg>
  )
}
const IconSearch = (p: any) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></Icon>
const IconCalendar = (p: any) => <Icon {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Icon>
const IconList = (p: any) => <Icon {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></Icon>
const IconFlow = (p: any) => <Icon {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><path d="M10 6.5h4a3 3 0 0 1 3 3V14M14 17.5H8a3 3 0 0 1-3-3V10" /></Icon>
const IconBell = (p: any) => <Icon {...p}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></Icon>
const IconAlert = (p: any) => <Icon {...p}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></Icon>
const IconLock = (p: any) => <Icon {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Icon>
const IconSave = (p: any) => <Icon {...p}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></Icon>
const IconTrash = (p: any) => <Icon {...p}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" /><path d="M10 11v6M14 11v6" /></Icon>
const IconImageOff = (p: any) => <Icon {...p}><path d="M10.5 8.5a2 2 0 1 0 0-.001M3 3l18 18" /><path d="M21 15l-5-5L5 21M3 7v12a2 2 0 0 0 2 2h12M21 17V5a2 2 0 0 0-2-2H9" /></Icon>
const IconChart = (p: any) => <Icon {...p}><path d="M3 3v18h18" /><rect x="7" y="13" width="3" height="5" rx="0.5" /><rect x="12" y="9" width="3" height="9" rx="0.5" /><rect x="17" y="6" width="3" height="12" rx="0.5" /></Icon>
const IconDownload = (p: any) => <Icon {...p}><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M4 19h16" /></Icon>
const IconSun = (p: any) => <Icon {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></Icon>
const IconMoon = (p: any) => <Icon {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></Icon>
const IconEye = (p: any) => <Icon {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></Icon>
const IconEyeOff = (p: any) => <Icon {...p}><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.12 9.12 0 0 0 5.39-1.61" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24M1 1l22 22" /></Icon>
const IconCheck = (p: any) => <Icon {...p}><path d="M20 6 9 17l-5-5" /></Icon>
const IconDoc = (p: any) => <Icon {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" /></Icon>
const IconRefresh = (p: any) => <Icon {...p}><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" /></Icon>
const IconBack = (p: any) => <Icon {...p}><path d="M19 12H5M12 19l-7-7 7-7" /></Icon>
const IconImage = (p: any) => <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.5-3.5L5 21" /></Icon>
const IconFilm = (p: any) => <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 3v18M17 3v18M3 7.5h4M17 7.5h4M3 12h18M3 16.5h4M17 16.5h4" /></Icon>
const IconTrend = (p: any) => <Icon {...p}><path d="m23 6-9.5 9.5-5-5L1 18" /><path d="M17 6h6v6" /></Icon>

// Miniatura de mídia do post — exibe um placeholder profissional quando a imagem não carrega
function PostThumb({ src, size = 60, radius = 10 }: { src?: string; size?: number; radius?: number }) {
  const [erro, setErro] = useState(false)
  if (!src || erro) {
    return (
      <div style={{
        width: size, height: size, borderRadius: radius, background: '#f4f4f4', border: '1px solid #eee',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', flexShrink: 0,
      }}>
        <IconImageOff size={Math.round(size * 0.4)} />
      </div>
    )
  }
  return <img src={src} alt="" onError={() => setErro(true)} style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', flexShrink: 0, display: 'block' }} />
}

// Imagem que ocupa 100% do container, com fallback visual caso a URL não carregue
function ImagemComFallback({ src }: { src: string }) {
  const [erro, setErro] = useState(false)
  if (erro) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 12, gap: 6, flexDirection: 'column' }}>
        <IconImageOff size={22} />
        Imagem indisponível
      </div>
    )
  }
  // Vídeo: renderiza um <video> (mostra o primeiro frame) em vez de tentar carregar como imagem
  if (/\.(mp4|mov|m4v)(\?|$)/i.test(src || '')) {
    return <video src={src} muted playsInline preload="metadata" onError={() => setErro(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
  }
  return <img src={src} alt="" onError={() => setErro(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
}

// Área de aprovações do cliente (fila simples com os 2 portões)
function AprovacoesCli({ posts, clientes, onAtualizado }: { posts: any[]; clientes: any[]; onAtualizado: () => void }) {
  const [enviando, setEnviando] = useState<string | null>(null)
  const [comentario, setComentario] = useState<Record<string, string>>({})
  const [rejeitar, setRejeitar] = useState<{ id: string; ehCopy: boolean } | null>(null)
  const [motivoRejeicao, setMotivoRejeicao] = useState('')
  const pendentes = posts.filter(p => p.etapa === 'aprovacao_copy' || p.etapa === 'aprovacao_criativo')

  async function agir(postId: string, acao: string, comentarioOverride?: string) {
    setEnviando(postId)
    const r = await fetch('/api/esteira/aprovar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, acao, comentario: comentarioOverride ?? (comentario[postId] || '') }),
    }).then(x => x.json()).catch(() => ({ error: 'Erro de conexao' }))
    if (r?.semData) { alert('Defina a data e horario da postagem antes de aprovar o criativo.'); setEnviando(null); return }
    if (r?.error) { alert(r.error); setEnviando(null); return }
    setEnviando(null)
    onAtualizado()
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', fontSize: 18, color: '#111' }}>Minhas aprovações</h2>
      {pendentes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa', background: '#fff', borderRadius: 14, border: '1px solid #eee' }}>
          <p>Nenhuma pendência de aprovação no momento.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {pendentes.map(p => {
            const ehCopy = p.etapa === 'aprovacao_copy'
            const cli = clientes.find((c: any) => c.id === p.clienteId)
            const capa = capaDoPost(p)
            return (
              <div key={p.id} style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  {capa && (
                    <div style={{ width: 80, height: 80, borderRadius: 10, overflow: 'hidden', background: '#eee', flexShrink: 0 }}>
                      {/\.(mp4|mov|m4v)(\?|$)/i.test(capa) ? <video src={capa} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <img src={capa} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      {cli?.logo && <img src={cli.logo} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />}
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{p.clienteNome}</span>
                      <span style={{ background: ehCopy ? '#dbeafe' : '#fef3c7', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: ehCopy ? '#1d4ed8' : '#92400e' }}>
                        {ehCopy ? 'Aprovar copy' : 'Aprovar criativo'}
                      </span>
                    </div>
                    {p.briefing && <p style={{ margin: '0 0 6px', fontSize: 12, color: '#888' }}>Briefing: {p.briefing}</p>}
                    <p style={{ margin: '0 0 6px', fontSize: 13, color: '#333', whiteSpace: 'pre-wrap', maxHeight: 100, overflow: 'auto', lineHeight: 1.5 }}>{p.legenda || '(sem texto)'}</p>
                    {(p.imagens || []).length > 0 && !ehCopy && (
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8, overflowX: 'auto' }}>
                        {p.imagens.map((m: string, i: number) => (
                          <div key={i} style={{ width: 60, height: 60, borderRadius: 8, overflow: 'hidden', background: '#eee', flexShrink: 0 }}>
                            {/\.(mp4|mov|m4v)(\?|$)/i.test(m) ? <video src={m} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <img src={m} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                      <button onClick={() => agir(p.id, ehCopy ? 'aprovar_copy' : 'aprovar_criativo')} disabled={enviando === p.id}
                        style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: enviando === p.id ? 0.6 : 1 }}>
                        Aprovar
                      </button>
                      <button onClick={() => { setComentario(c => ({ ...c, [p.id]: '' })); agir(p.id, ehCopy ? 'ajuste_copy' : 'ajuste_criativo') }} disabled={enviando === p.id}
                        style={{ padding: '8px 16px', background: '#fff', color: '#92400e', border: '1px solid #fde68a', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer', opacity: enviando === p.id ? 0.6 : 1 }}>
                        Pedir ajuste
                      </button>
                      <button onClick={() => { setRejeitar({ id: p.id, ehCopy }); setMotivoRejeicao('') }} disabled={enviando === p.id}
                        style={{ padding: '8px 16px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer', opacity: enviando === p.id ? 0.6 : 1 }}>
                        Rejeitar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de rejeicao */}
      {rejeitar && (
        <div onClick={() => setRejeitar(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 440, width: '100%', padding: 22 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#b91c1c' }}>Rejeitar {rejeitar.ehCopy ? 'copy' : 'criativo'}</h3>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: '#888' }}>Informe o motivo da rejeicao. O criativo voltara para a equipe com esta justificativa.</p>
            <textarea value={motivoRejeicao} onChange={e => setMotivoRejeicao(e.target.value)} placeholder="Motivo da rejeicao..."
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #fca5a5', fontSize: 13, minHeight: 80, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14 }} autoFocus />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setRejeitar(null)} style={{ padding: '9px 16px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
              <button disabled={!motivoRejeicao.trim() || enviando === rejeitar.id} onClick={async () => {
                await agir(rejeitar.id, rejeitar.ehCopy ? 'ajuste_copy' : 'ajuste_criativo', `REJEITADO: ${motivoRejeicao}`)
                setRejeitar(null)
              }} style={{ padding: '9px 20px', background: motivoRejeicao.trim() ? '#b91c1c' : '#f0f0f0', color: motivoRejeicao.trim() ? '#fff' : '#aaa', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: motivoRejeicao.trim() ? 'pointer' : 'not-allowed' }}>
                Confirmar rejeicao
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Escolhe a melhor miniatura do post: thumbnail salva, capa de vídeo, imagem, ou a 1ª mídia
function capaDoPost(post: any): string {
  const ehVideo = (u: string) => /\.(mp4|mov|m4v)(\?|$)/i.test(u || '')
  if (post?.thumbnail) return post.thumbnail
  const caps = post?.capasVideo || {}
  for (const url of (post?.imagens || [])) { if (caps[url]) return caps[url] }
  const img = (post?.imagens || []).find((u: string) => !ehVideo(u))
  if (img) return img
  const anyCap = Object.values(caps)[0] as string | undefined
  if (anyCap) return anyCap
  return (post?.imagens || [])[0] || ''
}

// Selo da rede social (Instagram / Facebook) exibido no card
function RedeBadge({ rede }: { rede: 'instagram' | 'facebook' }) {
  const fb = rede === 'facebook'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 999, padding: '2px 8px 2px 6px', fontSize: 9, fontWeight: 700 }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff">{fb
        ? <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        : <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8z" />}</svg>
      {fb ? 'Facebook' : 'Instagram'}
    </span>
  )
}

// Converte uma data ISO para o formato aceito pelo input datetime-local (YYYY-MM-DDTHH:mm)
function paraDatetimeLocal(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function emailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <Dashboard />
    </Suspense>
  )
}

function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [posts, setPosts] = useState<Post[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [aba, setAbaRaw] = useState<'home' | 'posts' | 'planner' | 'calendario' | 'biblioteca' | 'clientes' | 'usuarios' | 'novo-post' | 'config' | 'analytics' | 'mensagens' | 'marca' | 'listening' | 'esteira' | 'aprovacoes' | 'tarefas' | 'playbook' | 'minha-conta' | 'inbox' | 'campanhas' | 'candidaturas'>(() => {
    if (typeof window !== 'undefined') {
      const salva = sessionStorage.getItem('soma10_aba')
      if (salva) return salva as any
    }
    return 'home'
  })
  const setAba = (a: typeof aba) => { setAbaRaw(a); if (typeof window !== 'undefined') sessionStorage.setItem('soma10_aba', a) }
  const [listeningData, setListeningData] = useState<any>(null)
  const [listeningLoading, setListeningLoading] = useState(false)
  const [plannerView, setPlannerView] = useState<'lista' | 'calendario'>('lista')
  // Tema (claro/escuro) — persistido no navegador, inicializa direto do localStorage
  const [tema, setTema] = useState<'claro' | 'escuro'>(() => {
    if (typeof window !== 'undefined') {
      const salvo = localStorage.getItem('soma10-tema')
      if (salvo === 'escuro') return 'escuro'
    }
    return 'claro'
  })
  function alternarTema() {
    setTema(t => {
      const novo = t === 'claro' ? 'escuro' : 'claro'
      if (typeof window !== 'undefined') localStorage.setItem('soma10-tema', novo)
      return novo
    })
  }

  // Analytics
  const [analyticsClienteId, setAnalyticsClienteId] = useState('')
  const [analyticsDesde, setAnalyticsDesde] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [analyticsAte, setAnalyticsAte] = useState(() => new Date().toISOString().slice(0, 10))
  const [analyticsData, setAnalyticsData] = useState<any | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsErro, setAnalyticsErro] = useState('')
  const [exportandoPdf, setExportandoPdf] = useState(false)
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false)

  const [configAgencia, setConfigAgencia] = useState<ConfigAgencia>({ nomeAgencia: 'Soma10Approval', corPrimaria: '#ffc00f', corSecundaria: '#111111' })
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  const [configMsg, setConfigMsg] = useState('')
  const [enviandoLogoAgencia, setEnviandoLogoAgencia] = useState(false)
  const [saldoIA, setSaldoIA] = useState<{ saldo: number; limite: number; alertado?: boolean }>({ saldo: 0, limite: 1 })
  const [salvandoSaldoIA, setSalvandoSaldoIA] = useState(false)
  const [saldoIAMsg, setSaldoIAMsg] = useState('')
  const [editandoCliente, setEditandoCliente] = useState<string | null>(null)
  const [edicaoCliente, setEdicaoCliente] = useState<Partial<Cliente>>({})
  const [enviandoLogoCliente, setEnviandoLogoCliente] = useState(false)
  const [fotoClienteId, setFotoClienteId] = useState<string | null>(null)
  const [brandForm, setBrandForm] = useState<any>({})
  const [salvandoBrand, setSalvandoBrand] = useState(false)
  const [brandMsg, setBrandMsg] = useState('')
  const [enviandoDoc, setEnviandoDoc] = useState(false)
  const [gerandoDocIA, setGerandoDocIA] = useState(false)
  const [docIAMsg, setDocIAMsg] = useState('')
  const [brandModo, setBrandModo] = useState<'card' | 'editar' | 'ver'>('editar')
  const [editandoUsuario, setEditandoUsuario] = useState<string | null>(null)
  const [edicaoUsuario, setEdicaoUsuario] = useState<{ nome: string; role: string; novaSenha: string; cargo: string; foto: string }>({ nome: '', role: 'gerente', novaSenha: '', cargo: '', foto: '' })
  const [bibBusca, setBibBusca] = useState('')
  const [bibCliente, setBibCliente] = useState('')
  const [bibStatus, setBibStatus] = useState('')
  const [bibSelecionados, setBibSelecionados] = useState<string[]>([])
  const [avisoFalhaOculto, setAvisoFalhaOculto] = useState(false)
  const [postPreview, setPostPreview] = useState<Post | null>(null)
  const [verComoClienteId, setVerComoClienteIdRaw] = useState(() => (typeof window !== 'undefined' ? sessionStorage.getItem('soma10_clienteId') || '' : ''))
  const setVerComoClienteId = (id: string) => { setVerComoClienteIdRaw(id); if (typeof window !== 'undefined') sessionStorage.setItem('soma10_clienteId', id) }
  const [buscaCliente, setBuscaCliente] = useState('')
  const [clientesAberto, setClientesAberto] = useState(false)
  const [composerPrefill, setComposerPrefill] = useState<any>(null)
  const [composerKey, setComposerKey] = useState(0)
  const [criandoPost, setCriandoPost] = useState(false)
  const [salvandoRascunho, setSalvandoRascunho] = useState(false)
  const [rascunhoMsg, setRascunhoMsg] = useState('')
  const [editandoPostId, setEditandoPostId] = useState<string | null>(null)
  const [visualizacaoPosts, setVisualizacaoPosts] = useState<'lista' | 'calendario' | 'fluxo'>('lista')
  const [novoCliente, setNovoCliente] = useState<{ nome: string; instagram: string; loginEmail: string; logo?: string; corPrimaria?: string; corSecundaria?: string; tipo?: string; entregaveis?: string[]; postsMensais?: number; contratoValor?: number; contratoInicio?: string; contratoRenovacao?: string; contratoCiclo?: string }>({ nome: '', instagram: '', loginEmail: '', corPrimaria: '#ffc00f', corSecundaria: '#111111', tipo: 'cliente', entregaveis: [], postsMensais: 12 })
  const [enviandoLogoNovoCliente, setEnviandoLogoNovoCliente] = useState(false)
  const [credenciaisGeradas, setCredenciaisGeradas] = useState<{ nome: string; email: string; senha: string } | null>(null)
  const [erroCliente, setErroCliente] = useState('')
  const [novoUsuario, setNovoUsuario] = useState({ nome: '', email: '', senha: '', role: 'gerente', cargo: '' })
  const [mostrarFormUsuario, setMostrarFormUsuario] = useState(false)
  const [verSenhaNovo, setVerSenhaNovo] = useState(false)
  const [verSenhaEdicao, setVerSenhaEdicao] = useState(false)
  const [erroUsuario, setErroUsuario] = useState('')
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [chatNaoLidas, setChatNaoLidas] = useState(0)
  const [configAberto, setConfigAberto] = useState(true)
  const [perfilAberto, setPerfilAberto] = useState(false)
  const [meuPerfil, setMeuPerfil] = useState<any>(null)
  const [perfilSalvando, setPerfilSalvando] = useState(false)
  const [perfilMsg, setPerfilMsg] = useState('')
  const [linkGerado, setLinkGerado] = useState('')
  const [codigoGerado, setCodigoGerado] = useState('')
  // Conexão manual por ID
  // OAuth Meta
  const [metaPages, setMetaPages] = useState<MetaPage[]>([])
  const [vinculos, setVinculos] = useState<Record<string, string>>({}) // pageId -> clienteId
  const [vinculando, setVinculando] = useState(false)
  const [metaErro, setMetaErro] = useState('')
  const [metaClienteAlvo, setMetaClienteAlvo] = useState('')
  const [vinculandoPagina, setVinculandoPagina] = useState('')
  const [conectarRedesCliente, setConectarRedesCliente] = useState<string | null>(null)
  // Notificações
  const [notificacoes, setNotificacoes] = useState<any[]>([])
  const [inboxAberto, setInboxAberto] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status])

  useEffect(() => {
    if (status !== 'authenticated') return
    const role = (session?.user as any)?.role
    const fetches: Promise<void>[] = [
      fetch('/api/posts').then(r => r.json()).then(setPosts),
      fetch('/api/clientes').then(r => r.json()).then(setClientes),
    ]
    if (role === 'admin' || role === 'gerente') {
      fetches.push(fetch('/api/usuarios').then(r => r.json()).then(setUsuarios).catch(() => {}))
    }
    if (role === 'admin') {
      fetches.push(fetch('/api/config').then(r => r.json()).then(setConfigAgencia))
      fetches.push(fetch('/api/anthropic-saldo').then(r => r.json()).then(d => { if (d && typeof d.saldo === 'number') setSaldoIA(d) }).catch(() => {}))
    }
    Promise.all(fetches).catch(() => {})
  }, [status])

  // Brand Board: ao trocar de cliente, recarrega os dados DAQUELE cliente (evita
  // misturar o documento/identidade de um cliente com outro) e define o modo.
  useEffect(() => {
    setBrandForm({}) // limpa imediatamente ao trocar de cliente (nunca mostra dado do anterior)
    if (!verComoClienteId) return
    const alvo = verComoClienteId
    let cancelado = false
    // Le SEMPRE do endpoint por id (direto do Redis, sem cache). So aceita se for EXATAMENTE este cliente.
    fetch(`/api/clientes?id=${alvo}`).then(r => r.json()).then((c: any) => {
      if (cancelado || !c || c.error || c.id !== alvo) return
      setBrandForm({
        segmento: c.segmento || '', palavrasChave: c.palavrasChave || '', descricao: c.descricao || '',
        publicoAlvo: c.publicoAlvo || '', tomDeVoz: c.tomDeVoz || '', preferencias: c.preferencias || '',
        documentos: c.documentos || [], documentoMarca: c.documentoMarca || '', documentoMarcaGeradoEm: c.documentoMarcaGeradoEm || '',
      })
      const tem = !!(c.segmento || c.palavrasChave || c.descricao || c.publicoAlvo || c.tomDeVoz || c.preferencias)
      setBrandModo(tem ? 'card' : 'editar')
    }).catch(() => {})
    return () => { cancelado = true }
  }, [verComoClienteId])

  // Notificacoes: carrega lista completa uma vez, depois poll so a contagem
  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/notificacoes').then(r => r.json()).then(d => setNotificacoes(Array.isArray(d) ? d : []))
    if ((session?.user as any)?.role !== 'cliente') {
      fetch('/api/mensagens?naoLidas=true').then(r => r.json()).then(d => setChatNaoLidas(d?.naoLidas || 0)).catch(() => {})
    }
    const intervalo = setInterval(() => {
      fetch('/api/notificacoes?contagem=true').then(r => r.json()).then(d => {
        if (d?.naoLidas > 0 && notificacoes.every(n => n.lida)) {
          fetch('/api/notificacoes').then(r => r.json()).then(nd => setNotificacoes(Array.isArray(nd) ? nd : []))
        }
      }).catch(() => {})
      if ((session?.user as any)?.role !== 'cliente') {
        fetch('/api/mensagens?naoLidas=true').then(r => r.json()).then(d => setChatNaoLidas(d?.naoLidas || 0)).catch(() => {})
      }
    }, 30000)
    return () => clearInterval(intervalo)
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  async function marcarNotificacaoLida(id: string) {
    setNotificacoes(ns => ns.map(n => n.id === id ? { ...n, lida: true } : n))
    await fetch('/api/notificacoes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
  }

  async function marcarTodasNotificacoesLidas() {
    setNotificacoes(ns => ns.map(n => ({ ...n, lida: true })))
    await fetch('/api/notificacoes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ todasComoLidas: true }) })
  }

  async function excluirNotificacao(id: string) {
    setNotificacoes(ns => ns.filter(n => n.id !== id))
    await fetch('/api/notificacoes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
  }

  async function limparNotificacoes() {
    setNotificacoes([])
    await fetch('/api/notificacoes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ todas: true }) })
  }

  // Carrega o Social Listening ao abrir a aba (uma vez por cliente)
  useEffect(() => {
    if (aba === 'listening' && verComoClienteId) carregarListening()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, verComoClienteId])

  // Ler páginas do cookie após OAuth
  useEffect(() => {
    const pagesId = searchParams.get('meta_pages')
    if (pagesId) {
      setAba('clientes')
      setMetaClienteAlvo(searchParams.get('meta_cliente') || '')
      fetch(`/api/meta/pages?id=${encodeURIComponent(pagesId)}`)
        .then(r => r.json())
        .then(pages => { if (Array.isArray(pages)) setMetaPages(pages) })
        .catch(() => {})
    }
    if (searchParams.get('meta_error')) {
      setAba('clientes')
      const erros: Record<string, string> = {
        acesso_negado: 'Acesso negado. Você cancelou a autorização.',
        token_falhou: 'Não foi possível obter o token de acesso.',
        sem_paginas: 'Nenhuma Página do Facebook encontrada. Verifique se você é administrador de alguma página.',
        sem_conta_ig: 'Não foi possível identificar a conta do Instagram. Use uma conta Profissional (Business/Criador).',
        ig_nao_configurado: 'Integração do Instagram não configurada (faltam INSTAGRAM_APP_ID/SECRET na Vercel).',
        erro_interno: 'Erro interno. Tente novamente.',
      }
      setMetaErro(erros[searchParams.get('meta_error')!] || 'Erro desconhecido.')
    }
  }, [searchParams])

  const role = (session?.user as any)?.role
  const clienteEmVisualizacao = clientes.find(c => c.id === verComoClienteId)
  const postsPlanner = posts.filter(p => !(p as any).etapa || (p as any).etapa === 'pronto')
  const postsView = verComoClienteId ? postsPlanner.filter(p => p.clienteId === verComoClienteId) : postsPlanner

  // Cliente logado: trava na visao dele, aba padrao aprovacoes
  const ehCliente = role === 'cliente'
  useEffect(() => {
    if (ehCliente && (session?.user as any)?.clienteId) {
      setVerComoClienteId((session?.user as any).clienteId)
      setAba('aprovacoes')
    }
  }, [ehCliente, session])

  // Quando estamos numa area travada de cliente, o Analytics deve sempre se referir a ele
  useEffect(() => {
    if (ehCliente && (session?.user as any)?.clienteId) {
      setAnalyticsClienteId((session?.user as any).clienteId)
    } else if (verComoClienteId) {
      setAnalyticsClienteId(verComoClienteId)
    }
  }, [verComoClienteId, ehCliente, session])

  async function buscarAnalytics() {
    if (!analyticsClienteId) { setAnalyticsErro('Selecione um cliente para ver o desempenho.'); return }
    setAnalyticsLoading(true)
    setAnalyticsErro('')
    setAnalyticsData(null)
    try {
      const params = new URLSearchParams({ clienteId: analyticsClienteId, desde: analyticsDesde, ate: analyticsAte })
      const res = await fetch(`/api/analytics?${params.toString()}`)
      const data = await res.json()
      if (!res.ok || data?.error) {
        setAnalyticsErro(data?.error || 'Não foi possível carregar os dados de desempenho.')
      } else if (data?.conectado === false) {
        setAnalyticsErro(data?.error || 'Este cliente ainda não tem a conta do Instagram conectada via Meta.')
      } else {
        setAnalyticsData(data)
      }
    } catch (e) {
      setAnalyticsErro('Erro de comunicação ao buscar os dados de desempenho.')
    }
    setAnalyticsLoading(false)
  }

  async function exportarAnalyticsPdf() {
    if (!analyticsData) return
    setExportandoPdf(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const cliente = clientes.find(c => c.id === analyticsClienteId)
      const doc = new jsPDF()
      const totais = analyticsData.totais || {}

      doc.setFontSize(16)
      doc.text(`Relatório de desempenho — ${cliente?.nome || analyticsData.instagramUsername || 'Cliente'}`, 14, 18)
      doc.setFontSize(10)
      doc.setTextColor(120)
      doc.text(`Período: ${analyticsDesde} a ${analyticsAte}${analyticsData.instagramUsername ? '  ·  @' + analyticsData.instagramUsername : ''}`, 14, 25)
      doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 30)

      autoTable(doc, {
        startY: 38,
        head: [['Posts', 'Curtidas', 'Comentários', 'Alcance', 'Impressões', 'Salvamentos', 'Compartilhamentos']],
        body: [[
          totais.posts ?? 0, totais.curtidas ?? 0, totais.comentarios ?? 0,
          totais.alcance ?? 0, totais.impressoes ?? 0, totais.salvamentos ?? 0, totais.compartilhamentos ?? 0,
        ]],
        theme: 'grid',
        headStyles: { fillColor: [17, 17, 17], textColor: [255, 192, 15] },
      })

      const posts: any[] = analyticsData.posts || []
      autoTable(doc, {
        startY: ((doc as any).lastAutoTable?.finalY || 38) + 12,
        head: [['Data', 'Tipo', 'Legenda', 'Curtidas', 'Comentários', 'Alcance', 'Impressões']],
        body: posts.map(p => [
          p.publicadoEm ? new Date(p.publicadoEm).toLocaleDateString('pt-BR') : '—',
          p.tipo || '—',
          (p.legenda || '').slice(0, 60) + ((p.legenda || '').length > 60 ? '…' : ''),
          p.curtidas ?? 0, p.comentarios ?? 0, p.alcance ?? 0, p.impressoes ?? 0,
        ]),
        theme: 'striped',
        headStyles: { fillColor: [17, 17, 17], textColor: [255, 192, 15] },
        styles: { fontSize: 8 },
        columnStyles: { 2: { cellWidth: 70 } },
      })

      doc.save(`analytics-${(cliente?.nome || 'cliente').toLowerCase().replace(/\s+/g, '-')}-${analyticsDesde}-a-${analyticsAte}.pdf`)
    } catch (e: any) {
      console.error('[pdf] erro:', e)
      alert(`Não foi possível gerar o PDF: ${e?.message || 'erro desconhecido'}`)
    }
    setExportandoPdf(false)
  }

  async function gerarRelatorioMensalPdf() {
    if (!analyticsData) return
    setGerandoRelatorio(true)
    try {
      const cliente = clientes.find(c => c.id === analyticsClienteId)
      const refDate = analyticsDesde ? new Date(analyticsDesde) : new Date()
      const mes = refDate.getMonth(), ano = refDate.getFullYear()
      const ehDoMes = (iso?: string) => { if (!iso) return false; const d = new Date(iso); return d.getMonth() === mes && d.getFullYear() === ano }
      const entregue = (posts as any[]).filter(p => {
        if (p.clienteId !== analyticsClienteId) return false
        if (p.etapa && p.etapa !== 'pronto') return false
        if (p.status === 'publicado') return ehDoMes(p.atualizadoEm || p.criadoEm)
        if (p.status === 'agendado') return ehDoMes(p.dataAgendada)
        return false
      }).length
      const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
      await gerarRelatorioMensal({ cliente, analyticsData, entregue, mesRef: `${MESES[mes]}/${ano}` })
    } catch (e: any) {
      console.error('[relatorio] erro:', e)
      alert(`Não foi possível gerar o relatório: ${e?.message || 'erro desconhecido'}`)
    }
    setGerandoRelatorio(false)
  }

  async function criarPost(valor: any) {
    const acao = valor.acao || 'publicar'
    if (!valor.clienteId) return
    setCriandoPost(true)
    setRascunhoMsg(acao === 'publicar' ? 'Publicando nas redes selecionadas...' : acao === 'agendar' ? 'Agendando a postagem...' : 'Salvando rascunho...')
    // Fecha o compositor e volta ao Planner enquanto processa/carrega
    setEditandoPostId(null)
    setComposerPrefill(null)
    setComposerKey(k => k + 1)
    setAba('planner')
    const cliente = clientes.find(c => c.id === valor.clienteId)
    // Converte a data local (datetime-local) para ISO absoluto, evitando erro de fuso no servidor
    const dataISO = valor.dataAgendada ? new Date(valor.dataAgendada).toISOString() : ''
    const body: any = { ...valor, dataAgendada: dataISO, clienteNome: cliente?.nome }
    if (acao === 'rascunho') body.rascunhoInterno = true
    if (acao === 'agendar') body.statusInicial = 'agendado'

    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json())

    if (acao === 'publicar') {
      const pub = await fetch('/api/publicar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: res.post.id }),
      }).then(r => r.json()).catch(() => ({ ok: false, error: 'falha de conexão' }))
      setRascunhoMsg(pub.ok ? 'Publicado com sucesso nas redes selecionadas!' : `Falha ao publicar: ${pub.error}`)
    } else if (acao === 'agendar') {
      setRascunhoMsg(`Post agendado para ${new Date(valor.dataAgendada).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.`)
    } else {
      setRascunhoMsg('Rascunho salvo — visível apenas para a equipe.')
    }

    await fetch('/api/posts').then(r => r.json()).then(setPosts).catch(() => {})
    setCriandoPost(false)
    setTimeout(() => setRascunhoMsg(''), 8000)
  }

  function iniciarEdicaoPost(post: Post) {
    const cliente = clientes.find(c => c.id === post.clienteId || c.nome === post.clienteNome)
    setEditandoPostId(post.id)
    setComposerPrefill({
      clienteId: cliente?.id || post.clienteId || '',
      marcoId: (post as any).marcoId || '',
      legenda: post.legenda || '',
      dataAgendada: paraDatetimeLocal(post.dataAgendada),
      imagens: post.imagens || [],
      formato: (post as any).formato || 'feed',
      colaboradores: (post as any).colaboradores || [],
      capasVideo: (post as any).capasVideo || {},
      redes: (post as any).redes || ['instagram', 'facebook'],
    })
    setComposerKey(k => k + 1)
    setPostPreview(null)
    setAba('novo-post')
  }

  function cancelarEdicaoPost() {
    setEditandoPostId(null)
    setComposerPrefill(null)
    setComposerKey(k => k + 1)
  }

  // Calendário → "+" no dia: abre o Novo Post já com a data daquele dia
  function novoPostNoDia(date: Date) {
    const dl = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    setEditandoPostId(null)
    setComposerPrefill({
      clienteId: verComoClienteId || '',
      legenda: '', dataAgendada: dl, imagens: [], formato: 'feed',
      colaboradores: [], capasVideo: {}, redes: ['instagram', 'facebook'],
    })
    setComposerKey(k => k + 1)
    setAba('novo-post')
  }

  // Calendário → arrastar post para outro dia: muda a data (mantém o horário original)
  async function moverPostData(post: Post, date: Date) {
    const nova = new Date(date)
    if (post.dataAgendada) {
      const orig = new Date(post.dataAgendada)
      nova.setHours(orig.getHours(), orig.getMinutes(), 0, 0)
    }
    const novaISO = nova.toISOString()
    const status = post.status === 'publicado' ? post.status : 'agendado'
    setPosts(ps => ps.map(p => p && p.id === post.id ? { ...p, dataAgendada: novaISO, status } : p))
    await fetch('/api/posts', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: post.id, dataAgendada: novaISO, status }),
    })
    fetch('/api/posts').then(r => r.json()).then(setPosts)
  }

  async function salvarEdicaoPost(valor: any) {
    if (!editandoPostId) return
    setCriandoPost(true)
    const cliente = clientes.find(c => c.id === valor.clienteId)
    const postAtual = posts.find(p => p?.id === editandoPostId)
    // Ajusta o status pela data: com data futura = agendado; sem data = rascunho.
    // Posts já publicados mantêm o status (editar não republica).
    let status = postAtual?.status
    if (postAtual?.status !== 'publicado') {
      status = valor.dataAgendada ? 'agendado' : 'rascunho'
    }
    const dataISO = valor.dataAgendada ? new Date(valor.dataAgendada).toISOString() : ''
    await fetch('/api/posts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editandoPostId, ...valor, dataAgendada: dataISO, clienteNome: cliente?.nome, status }),
    })
    setCriandoPost(false)
    setEditandoPostId(null)
    setComposerPrefill(null)
    setComposerKey(k => k + 1)
    setAba('planner')
    fetch('/api/posts').then(r => r.json()).then(setPosts)
  }

  async function excluirPost(post: Post) {
    if (!confirm(`Excluir definitivamente este post${post.clienteNome ? ' de ' + post.clienteNome : ''}? Esta ação não pode ser desfeita.`)) return
    setPosts(ps => ps.filter(p => p!.id !== post.id))
    const res = await fetch(`/api/posts?id=${post.id}`, { method: 'DELETE' })
    if (!res.ok) {
      fetch('/api/posts').then(r => r.json()).then(setPosts)
      alert('Não foi possível excluir o post.')
    }
  }

  const [republicandoId, setRepublicandoId] = useState<string | null>(null)
  async function republicarPost(post: Post) {
    setRepublicandoId(post.id)
    const r = await fetch('/api/publicar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: post.id }),
    }).then(x => x.json()).catch(() => ({ ok: false, error: 'falha de conexão' }))
    setRepublicandoId(null)
    await fetch('/api/posts').then(x => x.json()).then(setPosts).catch(() => {})
    if (!r.ok) alert(`Ainda não foi possível publicar: ${r.error || 'erro desconhecido'}\n\nDica: edite o post e verifique a mídia (imagens com menos de 10 MB, em JPG/PNG) antes de tentar de novo.`)
    else { setPostPreview(null); alert('Publicado com sucesso!') }
  }

  function alternarSelecaoPost(id: string) {
    setBibSelecionados(lista => lista.includes(id) ? lista.filter(x => x !== id) : [...lista, id])
  }

  async function excluirPostDireto(id: string) {
    setPosts(ps => ps.filter(p => p!.id !== id))
    setBibSelecionados(lista => lista.filter(x => x !== id))
    const res = await fetch(`/api/posts?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { fetch('/api/posts').then(r => r.json()).then(setPosts); alert('Não foi possível excluir o post.') }
  }

  async function excluirSelecionados() {
    const ids = [...bibSelecionados]
    if (ids.length === 0) return
    if (!confirm(`Excluir definitivamente ${ids.length} post(s)? Esta ação não pode ser desfeita.`)) return
    setPosts(ps => ps.filter(p => !ids.includes(p!.id)))
    setBibSelecionados([])
    await Promise.all(ids.map(id => fetch(`/api/posts?id=${id}`, { method: 'DELETE' })))
    fetch('/api/posts').then(r => r.json()).then(setPosts)
  }

  async function salvarVinculos() {
    setVinculando(true)
    for (const [pageId, clienteId] of Object.entries(vinculos)) {
      if (!clienteId) continue
      const page = metaPages.find(p => p.pageId === pageId)
      if (!page || !page.instagram) continue
      await fetch('/api/clientes/conectar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId,
          facebookPageId: pageId,
          facebookPageToken: page.pageToken,
          instagramBusinessId: page.instagram.id,
          instagramUsername: page.instagram.username,
          igToken: page.igToken,
          igUserId: page.igUserId,
        }),
      })
    }
    setVinculando(false)
    setMetaPages([])
    setVinculos({})
    setMetaClienteAlvo('')
    fetch('/api/clientes').then(r => r.json()).then(setClientes)
  }

  // Vincula UMA página (Facebook + Instagram) diretamente ao cliente-alvo da conexão
  async function vincularPaginaACliente(page: MetaPage, clienteId: string) {
    if (!page.instagram) return
    setVinculandoPagina(page.pageId)
    await fetch('/api/clientes/conectar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clienteId,
        facebookPageId: page.pageId,
        facebookPageToken: page.pageToken,
        instagramBusinessId: page.instagram.id,
        instagramUsername: page.instagram.username,
        igToken: page.igToken,
        igUserId: page.igUserId,
      }),
    })
    setVinculandoPagina('')
    setMetaPages([])
    setVinculos({})
    setMetaClienteAlvo('')
    fetch('/api/clientes').then(r => r.json()).then(setClientes)
  }

  async function desconectarInstagram(clienteId: string) {
    await fetch('/api/clientes/conectar', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId }),
    })
    fetch('/api/clientes').then(r => r.json()).then(setClientes)
  }

  async function criarCliente() {
    setErroCliente('')
    setCredenciaisGeradas(null)
    if (novoCliente.nome.trim().length < 2) { setErroCliente('Informe o nome do cliente.'); return }
    if (novoCliente.instagram.trim().length < 2) { setErroCliente('Informe o @instagram do cliente.'); return }
    if (novoCliente.loginEmail.trim() && !emailValido(novoCliente.loginEmail)) { setErroCliente('O e-mail de acesso informado não é válido.'); return }
    const res = await fetch('/api/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novoCliente),
    })
    const data = await res.json()
    if (!res.ok) {
      setErroCliente(data?.error || 'Erro ao criar cliente.')
      return
    }
    if (data?.cliente?.loginEmail && data?.cliente?.loginSenha) {
      setCredenciaisGeradas({ nome: data.cliente.nome, email: data.cliente.loginEmail, senha: data.cliente.loginSenha })
    }
    fetch('/api/clientes').then(r => r.json()).then(setClientes)
    setNovoCliente({ nome: '', instagram: '', loginEmail: '', corPrimaria: '#ffc00f', corSecundaria: '#111111' })
  }

  async function uploadLogoNovoCliente(arquivo: File) {
    setEnviandoLogoNovoCliente(true)
    const url = await enviarImagem(arquivo)
    if (url) setNovoCliente(c => ({ ...c, logo: url }))
    setEnviandoLogoNovoCliente(false)
  }

  async function criarUsuario() {
    setErroUsuario('')
    if (novoUsuario.nome.trim().length < 2) { setErroUsuario('Informe o nome do colaborador.'); return }
    if (!emailValido(novoUsuario.email)) { setErroUsuario('Informe um e-mail válido.'); return }
    if (novoUsuario.senha.trim().length < 6) { setErroUsuario('A senha deve ter pelo menos 6 caracteres.'); return }
    if (!novoUsuario.role) { setErroUsuario('Selecione o nível de acesso.'); return }
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novoUsuario),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setErroUsuario(data?.error || 'Erro ao adicionar colaborador.')
      return
    }
    fetch('/api/usuarios').then(r => r.json()).then(setUsuarios)
    setNovoUsuario({ nome: '', email: '', senha: '', role: 'gerente', cargo: '' })
    setMostrarFormUsuario(false)
    setVerSenhaNovo(false)
  }

  async function enviarImagem(arquivo: File): Promise<string | null> {
    try {
      const ext = arquivo.name.split('.').pop() || 'bin'
      const blob = await upload(`midia/${uuid()}.${ext}`, arquivo, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        contentType: arquivo.type,
        clientPayload: arquivo.type,
      })
      return blob.url
    } catch {
      return null
    }
  }

  async function salvarConfigAgencia() {
    setSalvandoConfig(true)
    setConfigMsg('')
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configAgencia),
    })
    setSalvandoConfig(false)
    if (res.ok) {
      setConfigMsg('Configurações salvas com sucesso!')
      setTimeout(() => setConfigMsg(''), 3000)
    } else {
      setConfigMsg('Erro ao salvar configurações.')
    }
  }

  async function salvarSaldoIA() {
    setSalvandoSaldoIA(true); setSaldoIAMsg('')
    const res = await fetch('/api/anthropic-saldo', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saldo: Number(saldoIA.saldo) || 0, limite: Number(saldoIA.limite) || 0 }),
    })
    const d = await res.json().catch(() => null)
    setSalvandoSaldoIA(false)
    if (res.ok && d) { setSaldoIA(d); setSaldoIAMsg('Saldo atualizado!'); setTimeout(() => setSaldoIAMsg(''), 3000) }
    else setSaldoIAMsg('Erro ao salvar.')
  }

  async function uploadLogoAgencia(arquivo: File) {
    setEnviandoLogoAgencia(true)
    const url = await enviarImagem(arquivo)
    if (url) setConfigAgencia(c => ({ ...c, logo: url }))
    setEnviandoLogoAgencia(false)
  }

  function iniciarEdicaoCliente(c: Cliente) {
    setEditandoCliente(c.id)
    setEdicaoCliente({ nome: c.nome, instagram: c.instagram, logo: c.logo, corPrimaria: c.corPrimaria || '#ffc00f', corSecundaria: c.corSecundaria || '#111111', tipo: c.tipo || 'cliente', entregaveis: c.entregaveis || [], postsMensais: c.postsMensais || 0,
      contratoValor: (c as any).contratoValor, contratoInicio: (c as any).contratoInicio, contratoRenovacao: (c as any).contratoRenovacao, contratoCiclo: (c as any).contratoCiclo })
  }

  async function uploadLogoCliente(arquivo: File) {
    setEnviandoLogoCliente(true)
    const url = await enviarImagem(arquivo)
    if (url) setEdicaoCliente(c => ({ ...c, logo: url }))
    setEnviandoLogoCliente(false)
  }

  async function uploadFotoCliente(clienteId: string, arquivo: File) {
    setFotoClienteId(clienteId)
    const url = await enviarImagem(arquivo)
    if (url) {
      await fetch('/api/clientes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: clienteId, logo: url }),
      })
      fetch('/api/clientes').then(r => r.json()).then(setClientes)
    }
    setFotoClienteId(null)
  }

  async function salvarEdicaoCliente(id: string) {
    await fetch('/api/clientes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...edicaoCliente }),
    })
    setEditandoCliente(null)
    fetch('/api/clientes').then(r => r.json()).then(setClientes)
  }

  // ---- Brands Board ----
  async function salvarBrand() {
    if (!verComoClienteId) return
    // Trava anti-sobrescrita: nao deixa gravar um Brand Board totalmente vazio por cima
    // de dados que ja existem (evita perda acidental por form carregado vazio).
    const formVazio = !['segmento', 'palavrasChave', 'descricao', 'publicoAlvo', 'tomDeVoz', 'preferencias'].some(k => (brandForm as any)[k]?.trim?.()) && !(brandForm.documentoMarca || '').trim()
    const clienteAtual: any = clientes.find(c => c.id === verComoClienteId)
    const tinhaDados = !!(clienteAtual && (clienteAtual.segmento || clienteAtual.palavrasChave || clienteAtual.descricao || clienteAtual.publicoAlvo || clienteAtual.tomDeVoz || clienteAtual.preferencias || clienteAtual.documentoMarca))
    if (formVazio && tinhaDados) {
      if (!confirm('O Brand Board está vazio e este cliente já tinha dados salvos. Salvar vai APAGAR o Brand Board. Tem certeza?')) return
    }
    setSalvandoBrand(true); setBrandMsg('')
    const r = await fetch('/api/clientes', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: verComoClienteId, ...brandForm }),
    }).then(x => x.json()).catch(() => null)
    setSalvandoBrand(false)
    if (!r || r.error) { setBrandMsg(r?.error ? `Erro ao salvar: ${r.error}` : 'Erro ao salvar. Tente novamente.'); setTimeout(() => setBrandMsg(''), 6000); return }
    // Atualiza a lista local imediatamente (nao depende do cache) para nao "sumir"
    setClientes(cs => cs.map((c: any) => c.id === verComoClienteId ? { ...c, ...brandForm } : c))
    setBrandMsg('Identidade da marca salva!')
    setBrandModo('card')
    setTimeout(() => setBrandMsg(''), 4000)
  }

  async function excluirBrand() {
    if (!verComoClienteId) return
    if (!confirm('Excluir o Brand Board deste cliente? As informações e o DNA da marca serão apagados.')) return
    const vazio = { segmento: '', palavrasChave: '', descricao: '', publicoAlvo: '', tomDeVoz: '', preferencias: '', documentos: [], documentoMarca: '', documentoMarcaGeradoEm: '' }
    await fetch('/api/clientes', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: verComoClienteId, ...vazio }),
    })
    setBrandForm(vazio)
    await fetch('/api/clientes').then(r => r.json()).then(setClientes)
    setBrandModo('editar')
  }

  async function enviarDocBrand(arquivo: File) {
    setEnviandoDoc(true)
    const url = await enviarImagem(arquivo) // mesmo fluxo de upload (aceita documentos)
    if (url) setBrandForm((b: any) => ({ ...b, documentos: [...(b.documentos || []), { nome: arquivo.name, url }] }))
    setEnviandoDoc(false)
  }

  async function gerarDocumentoIA() {
    if (!verComoClienteId) return
    // Regenerar consome créditos da IA — confirmar antes
    if (brandForm.documentoMarca && !confirm('Regenerar o documento vai consumir créditos da IA e substituir o documento atual. Deseja continuar?')) return
    // Garante que o Brand Board atual está salvo antes de gerar
    await salvarBrand()
    setGerandoDocIA(true); setDocIAMsg('Pesquisando o nicho e gerando o documento... (pode levar até 1 minuto)')
    try {
      const r = await fetch('/api/brand/gerar-documento', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId: verComoClienteId }),
      })
      const data = await r.json()
      if (!r.ok) { setDocIAMsg(data?.error || 'Falha ao gerar o documento.'); return }
      setBrandForm((b: any) => ({ ...b, documentoMarca: data.documentoMarca, documentoMarcaGeradoEm: data.documentoMarcaGeradoEm }))
      await fetch('/api/clientes').then(res => res.json()).then(setClientes)
      setDocIAMsg('Documento de marca gerado!')
      setTimeout(() => setDocIAMsg(''), 5000)
    } catch {
      setDocIAMsg('Erro de conexão ao gerar o documento.')
    } finally {
      setGerandoDocIA(false)
    }
  }

  function removerDocBrand(idx: number) {
    setBrandForm((b: any) => ({ ...b, documentos: (b.documentos || []).filter((_: any, i: number) => i !== idx) }))
  }

  async function carregarListening() {
    if (!verComoClienteId) return
    setListeningLoading(true); setListeningData(null)
    const data = await fetch(`/api/social-listening?clienteId=${verComoClienteId}`).then(r => r.json()).catch(() => null)
    setListeningData(data)
    setListeningLoading(false)
  }

  async function excluirCliente(id: string, nome: string) {
    if (!confirm(`Tem certeza que deseja excluir o cliente "${nome}"? Essa ação não pode ser desfeita.`)) return
    await fetch('/api/clientes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    fetch('/api/clientes').then(r => r.json()).then(setClientes)
  }

  function iniciarEdicaoUsuario(u: any) {
    setEditandoUsuario(u.email)
    setEdicaoUsuario({ nome: u.nome, role: u.role, novaSenha: '', cargo: u.cargo || '', foto: u.foto || '', clienteId: u.clienteId || '' } as any)
    setVerSenhaEdicao(false)
  }

  async function salvarEdicaoUsuario(email: string) {
    await fetch('/api/usuarios', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, nome: edicaoUsuario.nome, role: edicaoUsuario.role, cargo: edicaoUsuario.cargo, foto: edicaoUsuario.foto, clienteId: (edicaoUsuario as any).clienteId || '', novaSenha: edicaoUsuario.novaSenha || undefined }),
    })
    setEditandoUsuario(null)
    fetch('/api/usuarios').then(r => r.json()).then(setUsuarios)
  }

  async function excluirUsuario(email: string, nome: string) {
    if (!confirm(`Tem certeza que deseja excluir o colaborador "${nome}"?`)) return
    await fetch('/api/usuarios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    fetch('/api/usuarios').then(r => r.json()).then(setUsuarios)
  }

  // Validação do formulário de novo cliente — não deixa confirmar com dados incompletos/incorretos
  const clienteNomeValido = novoCliente.nome.trim().length >= 2
  const clienteInstagramValido = novoCliente.instagram.trim().length >= 2
  const clienteEmailValido = !novoCliente.loginEmail.trim() || emailValido(novoCliente.loginEmail)
  const clienteFormValido = clienteNomeValido && clienteInstagramValido && clienteEmailValido

  // Validação do formulário de novo usuário — nome, e-mail, senha e nível de acesso obrigatórios
  const usuarioNomeValido = novoUsuario.nome.trim().length >= 2
  const usuarioEmailValido = emailValido(novoUsuario.email)
  const usuarioSenhaValida = novoUsuario.senha.trim().length >= 6
  const usuarioRoleValido = !!novoUsuario.role
  const usuarioFormValido = usuarioNomeValido && usuarioEmailValido && usuarioSenhaValida && usuarioRoleValido

  if (status === 'loading') return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}><p>Carregando...</p></div>

  return (
    <div className={tema === 'escuro' ? 'soma10-tema-escuro' : ''} style={{ minHeight: '100vh', background: '#f8f8f8', fontFamily: 'Inter, sans-serif', ...(tema === 'escuro' ? { filter: 'invert(1) hue-rotate(180deg)' } : {}) }}>
      {/* Inverte de volta imagens, vídeos e miniaturas para que continuem com cores naturais no modo escuro (técnica de inversão = "cores opostas") */}
      <style jsx global>{`
        .soma10-tema-escuro img, .soma10-tema-escuro video, .soma10-tema-escuro iframe {
          filter: invert(1) hue-rotate(180deg);
        }
        .soma10-tema-escuro .soma10-no-invert {
          filter: invert(1) hue-rotate(180deg);
        }
        @keyframes shimmer {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
      `}</style>
      {/* Header */}
      <div style={{ background: '#111', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, boxShadow: '0 2px 8px rgba(0,0,0,0.25)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div onClick={() => { if (!ehCliente) setVerComoClienteId(''); setAba(ehCliente ? 'aprovacoes' : 'home'); setPostPreview(null); setInboxAberto(false) }} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} title="Ir para o inicio">
          <div style={{ background: '#fff', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <img src="/logo.svg" alt="Soma10" style={{ width: 24, height: 24, objectFit: 'contain' }} />
          </div>
          <span style={{ fontWeight: 800, color: '#fff', fontSize: 15 }}>Soma10Approval</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Alternar modo claro/escuro */}
          <button onClick={alternarTema} title={tema === 'escuro' ? 'Mudar para modo claro' : 'Mudar para modo escuro'} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#fff',
            width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {tema === 'escuro' ? <IconSun size={18} /> : <IconMoon size={18} />}
          </button>

          {/* Sininho de notificações — popup dropdown */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setInboxAberto(v => { const novo = !v; if (novo && notificacoes.some(n => !n.lida)) marcarTodasNotificacoesLidas(); return novo })} title="Notificações" style={{
              position: 'relative', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#fff',
              width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconBell size={18} />
              {notificacoes.some(n => !n.lida) && (
                <span style={{
                  position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 999, background: '#ef4444',
                  color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', border: '2px solid #111',
                }}>
                  {notificacoes.filter(n => !n.lida).length > 9 ? '9+' : notificacoes.filter(n => !n.lida).length}
                </span>
              )}
            </button>

            {inboxAberto && (
              <>
                <div onClick={() => setInboxAberto(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
                <div style={{ position: 'absolute', top: 44, right: 0, width: 360, maxHeight: 460, overflowY: 'auto', background: '#fff', borderRadius: 14, boxShadow: '0 12px 36px rgba(0,0,0,0.18)', border: '1px solid #eee', zIndex: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, background: '#fff' }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: '#111' }}>Notificações</span>
                    <button onClick={() => { setInboxAberto(false); setAba('inbox' as any) }} style={{ background: 'none', border: 'none', color: '#1d4ed8', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Ver todas</button>
                  </div>
                  {notificacoes.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#bbb', fontSize: 13 }}>Nenhuma notificação.</div>
                  ) : (
                    notificacoes.slice(0, 12).map(n => (
                      <div key={n.id} onClick={() => {
                        if (!n.lida) marcarNotificacaoLida(n.id)
                        if (n.postId) { const p = posts.find((x: any) => x.id === n.postId); if (p) { setInboxAberto(false); setPostPreview(p) } }
                        else if (n.tipo?.startsWith('tarefa_')) { setInboxAberto(false); setAba('tarefas' as any) }
                        else if (n.tipo === 'mensagem_privada') { setInboxAberto(false); setAba('mensagens' as any) }
                      }} style={{ padding: '12px 16px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer', background: n.lida ? '#fff' : '#fffbeb', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: n.lida ? 'transparent' : '#f59e0b', marginTop: 5, flexShrink: 0 }} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111' }}>{n.titulo}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888', lineHeight: 1.4 }}>{n.mensagem}</p>
                          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#bbb' }}>{new Date(n.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <button onClick={e => { e.stopPropagation(); excluirNotificacao(n.id) }} title="Excluir" style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2, flexShrink: 0 }}>×</button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {role === 'admin' && (
            <select onChange={e => {
              const v = e.target.value
              if (!v) return
              if (v === '_reset') { setVerComoClienteId(''); setAba('home'); e.target.value = ''; return }
              // Visualizar como (somente leitura): ativa o modo cliente e abre o portal
              if (v.startsWith('cli:')) { setViewAsClient(true); router.push(`/cliente/${v.replace('cli:', '')}`); e.target.value = ''; return }
              const u = usuarios.find((x: any) => x.email === v)
              if (u && (u as any).clienteId) { setViewAsClient(true); router.push(`/cliente/${(u as any).clienteId}`) }
              e.target.value = ''
            }} defaultValue="" style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid #555', background: '#222', color: '#ccc', fontSize: 11, cursor: 'pointer' }}>
              <option value="">Visualizar como...</option>
              <option value="_reset">Voltar a minha visao</option>
              <optgroup label="Clientes (visualizar)">
                {clientes.map(c => <option key={c.id} value={`cli:${c.id}`}>{c.nome}</option>)}
              </optgroup>
            </select>
          )}
          <button onClick={() => setAba('minha-conta' as any)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} title="Minha conta">
            <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: '#888', fontSize: 12, fontWeight: 800 }}>{session?.user?.name?.[0]?.toUpperCase()}</span>
            </div>
            <span style={{ fontSize: 13, color: '#ccc' }}>{session?.user?.name}</span>
          </button>
          <span style={{ background: '#ffc00f', color: '#111', borderRadius: 12, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{role}</span>
          <button onClick={() => signOut()} style={{ background: 'none', border: '1.5px solid #fff', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#fff' }}>Sair</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {/* Sidebar */}
        <aside style={{
          width: 232, flexShrink: 0, background: '#fff', borderRight: '1px solid #f0f0f0',
          minHeight: 'calc(100vh - 56px)', position: 'sticky', top: 56, padding: '20px 14px', boxSizing: 'border-box',
        }}>
          {/* PAINEL DO CLIENTE — nav simplificada */}
          {ehCliente && clienteEmVisualizacao && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', marginBottom: 10 }}>
                {clienteEmVisualizacao.logo && <img src={clienteEmVisualizacao.logo} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />}
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#111' }}>{clienteEmVisualizacao.nome}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#888' }}>Painel do cliente</p>
                </div>
              </div>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {(['aprovacoes', 'esteira', 'playbook'] as const).map(a => (
                  <button key={a} onClick={() => setAba(a as any)} style={{
                    padding: '11px 14px', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    fontWeight: aba === a ? 700 : 500, color: aba === a ? '#111' : '#888',
                    background: aba === a ? '#ffc00f' : 'transparent', fontSize: 14,
                  }}>
                    {a === 'aprovacoes' ? 'Aprovacoes' : a === 'esteira' ? 'Esteira' : 'Playbook'}
                  </button>
                ))}
              </nav>
            </div>
          )}

          {/* Seletor de visualização por cliente — primeira coisa exibida (equipe) */}
          {!ehCliente && <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, padding: '0 4px' }}>
              {verComoClienteId ? 'Acessando sub-account' : 'Acessar sub-account'}
            </label>
            {verComoClienteId ? (
              // Cliente travado: cada cliente é único, sem opção de trocar para outro
              <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  {clienteEmVisualizacao?.logo ? (
                    <img src={clienteEmVisualizacao.logo} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid #fde68a' }} />
                  ) : (
                    <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#ffc00f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: '#111', flexShrink: 0 }}>
                      {(clienteEmVisualizacao?.nome || '?')[0]?.toUpperCase()}
                    </span>
                  )}
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                    {clienteEmVisualizacao?.nome || 'Cliente'}
                  </p>
                </div>
                <button onClick={() => { setVerComoClienteId(''); setAba('home') }} style={{
                  background: 'none', border: 'none', color: '#92400e', fontWeight: 700, fontSize: 11,
                  cursor: 'pointer', textDecoration: 'underline', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
                }}>
                  <IconBack size={13} /> Voltar ao Painel
                </button>
              </div>
            ) : (
              <div>
                {/* Cabecalho colapsavel — clique para abrir a busca/lista */}
                <button onClick={() => setClientesAberto(v => !v)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10,
                  border: '1.5px solid #e0e0e0', background: '#f8f8f8', cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  <span style={{ color: '#bbb', display: 'flex' }}><IconSearch size={14} /></span>
                  <span style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: 600, color: clienteEmVisualizacao ? '#111' : '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {clienteEmVisualizacao ? clienteEmVisualizacao.nome : 'Acessar cliente (sub-account)'}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: clientesAberto ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }}><path d="M6 9l6 6 6-6" /></svg>
                </button>

                {clientesAberto && (
                  <>
                    <div style={{ position: 'relative', marginTop: 6 }}>
                      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#bbb', pointerEvents: 'none', display: 'flex' }}><IconSearch size={14} /></span>
                      <input
                        value={buscaCliente}
                        onChange={e => setBuscaCliente(e.target.value)}
                        placeholder="Buscar cliente..."
                        autoFocus
                        style={{
                          width: '100%', padding: '10px 12px 10px 34px', borderRadius: 10, border: '1.5px solid #e0e0e0',
                          fontSize: 13, fontWeight: 600, background: '#fff', color: '#111', fontFamily: 'inherit', boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 260, overflowY: 'auto' }}>
                      <button onClick={() => { setVerComoClienteId(''); setBuscaCliente(''); setClientesAberto(false) }} style={{
                        textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: 'transparent', color: '#888', fontSize: 12, fontWeight: 700,
                      }}>
                        Visão da agência (todos)
                      </button>
                      {clientes
                        .filter(c => c.nome.toLowerCase().includes(buscaCliente.toLowerCase()))
                        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }))
                        .map(c => (
                          <button key={c.id} onClick={() => {
                            // Acessa a sub-account no portal. O portal carrega o Brand Board do
                            // proprio cliente por id — nao pre-popular aqui (evita misturar clientes).
                            setViewAsClient(false); setBuscaCliente(''); setClientesAberto(false); router.push(`/cliente/${c.id}`)
                          }} style={{
                            textAlign: 'left', padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            background: 'transparent', color: '#111', fontSize: 13, fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: 8,
                          }}>
                            <span style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', background: c.corPrimaria || '#eee', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, color: c.corSecundaria || '#111' }}>
                              {c.logo ? <img src={c.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (c.nome[0]?.toUpperCase())}
                            </span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</span>
                          </button>
                        ))}
                      {buscaCliente && clientes.filter(c => c.nome.toLowerCase().includes(buscaCliente.toLowerCase())).length === 0 && (
                        <p style={{ margin: '4px 10px', fontSize: 12, color: '#bbb' }}>Nenhum cliente encontrado.</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>}

          {!ehCliente && <div style={{ height: 1, background: '#f0f0f0', margin: '0 0 16px' }} />}

          {/* NIVEL AGENCIA — oculto na visao de cliente */}
          {!verComoClienteId && (
            <>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {(['home', 'tarefas', 'playbook', 'esteira', 'campanhas'] as const).map(a => (
                  <button key={a} onClick={() => setAba(a as any)} className={aba === a ? 'soma10-no-invert' : undefined} style={{
                    padding: '11px 14px', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    fontWeight: aba === a ? 700 : 500, color: aba === a ? '#111' : '#888',
                    background: aba === a ? '#ffc00f' : 'transparent',
                    fontSize: 14, transition: 'all 0.15s',
                  }}>
                    {a === 'home' ? 'Painel' : a === 'tarefas' ? 'Tarefas' : a === 'playbook' ? 'Playbook' : a === 'esteira' ? 'Esteira' : 'Campanhas'}
                  </button>
                ))}
              </nav>
              <div style={{ height: 1, background: '#f0f0f0', margin: '12px 0' }} />
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button onClick={() => { setAba('inbox' as any); marcarTodasNotificacoesLidas() }} className={aba === 'inbox' ? 'soma10-no-invert' : undefined} style={{
                  padding: '11px 14px', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  fontWeight: aba === 'inbox' ? 700 : 500, color: aba === 'inbox' ? '#111' : '#888',
                  background: aba === 'inbox' ? '#ffc00f' : 'transparent', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  Inbox
                  {notificacoes.filter(n => !n.lida).length > 0 && (
                    <span style={{ background: '#dc2626', color: '#fff', borderRadius: 999, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, padding: '0 5px' }}>{notificacoes.filter(n => !n.lida).length > 99 ? '99+' : notificacoes.filter(n => !n.lida).length}</span>
                  )}
                </button>
                <button onClick={() => { setAba('mensagens' as any); setChatNaoLidas(0) }} className={aba === 'mensagens' ? 'soma10-no-invert' : undefined} style={{
                  padding: '11px 14px', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  fontWeight: aba === 'mensagens' ? 700 : 500, color: aba === 'mensagens' ? '#111' : '#888',
                  background: aba === 'mensagens' ? '#ffc00f' : 'transparent', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  Mensagens
                  {chatNaoLidas > 0 && (
                    <span style={{ background: '#dc2626', color: '#fff', borderRadius: 999, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, padding: '0 5px' }}>{chatNaoLidas > 99 ? '99+' : chatNaoLidas}</span>
                  )}
                </button>
              </nav>
              {role === 'admin' && (
                <>
                  <div style={{ height: 1, background: '#f0f0f0', margin: '12px 0' }} />
                  <button onClick={() => setConfigAberto(v => !v)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', margin: '0 0 6px',
                    background: 'none', border: 'none', cursor: 'pointer',
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Configuracoes</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: configAberto ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M6 9l6 6 6-6" /></svg>
                  </button>
                  {configAberto && (
                  <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {(['config', 'usuarios', 'clientes', 'candidaturas'] as const).map(a => (
                      <button key={a} onClick={() => setAba(a as any)} className={aba === a ? 'soma10-no-invert' : undefined} style={{
                        padding: '11px 14px', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                        fontWeight: aba === a ? 700 : 500, color: aba === a ? '#111' : '#888',
                        background: aba === a ? '#ffc00f' : 'transparent',
                        fontSize: 13, transition: 'all 0.15s',
                      }}>
                        {a === 'config' ? 'Geral' : a === 'usuarios' ? 'Colaboradores' : a === 'clientes' ? 'Clientes' : 'Trabalhe Conosco'}
                      </button>
                    ))}
                  </nav>
                  )}
                </>
              )}
            </>
          )}

          {/* NIVEL CLIENTE — so na visualizacao como cliente (equipe vendo como) */}
          {verComoClienteId && !ehCliente && (
            <div>
              <p style={{ margin: '0 0 4px', padding: '0 4px', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Cliente
              </p>
              <p style={{ margin: '0 0 8px', padding: '0 4px', fontSize: 11, color: '#16a34a' }}>
                Vendo como: {clienteEmVisualizacao?.nome}
              </p>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {(['planner', 'esteira', 'aprovacoes', 'marca', 'listening', 'analytics'] as const).map(a => {
                  const ativo = aba === a || (a === 'planner' && (aba === 'novo-post' || aba === 'biblioteca' || aba === 'calendario'))
                  return (
                  <button key={a} onClick={() => setAba(a as any)} style={{
                    padding: '11px 14px', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    fontWeight: ativo ? 700 : 500, color: ativo ? '#111' : '#888',
                    background: ativo ? '#ffc00f' : 'transparent',
                    fontSize: 14, transition: 'all 0.15s',
                  }}>
                    {a === 'planner' ? 'Planner' : a === 'esteira' ? 'Esteira' : a === 'aprovacoes' ? 'Aprovações' : a === 'marca' ? 'Marca (Brand Board)' : a === 'listening' ? 'Social Listening' : 'Analytics'}
                  </button>
                )})}
              </nav>
            </div>
          )}
        </aside>

        {/* Conteúdo principal */}
        <div style={{ flex: 1, minWidth: 0, padding: '24px 28px' }}>

        {/* Faixa indicando visualizacao filtrada por cliente (so para equipe, nao para o cliente logado) */}
        {clienteEmVisualizacao && !ehCliente && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, background: '#fffbeb', border: '1px solid #fde68a',
            borderRadius: 12, padding: '10px 16px', marginBottom: 20,
          }}>
            {clienteEmVisualizacao.logo ? (
              <img src={clienteEmVisualizacao.logo} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid #fde68a' }} />
            ) : (
              <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#ffc00f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: '#111', flexShrink: 0 }}>
                {clienteEmVisualizacao.nome[0]?.toUpperCase()}
              </span>
            )}
            <p style={{ margin: 0, fontSize: 13, color: '#92400e' }}>
              Você está visualizando o painel como o cliente <strong>{clienteEmVisualizacao.nome}</strong> (@{clienteEmVisualizacao.instagram?.replace(/^@/, '')}) — somente o conteúdo dele é exibido.
            </p>
            <button onClick={() => { setVerComoClienteId(''); setAba('home') }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#92400e', fontWeight: 700, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <IconBack size={13} /> Voltar ao Painel
            </button>
          </div>
        )}

        {/* POSTS */}
        {aba === 'posts' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>{clienteEmVisualizacao ? `Posts de ${clienteEmVisualizacao.nome}` : 'Todos os Posts'}</h2>
              <div style={{ display: 'flex', gap: 4, background: '#f0f0f0', borderRadius: 10, padding: 4 }}>
                {(['lista', 'calendario', 'fluxo'] as const).map(v => (
                  <button key={v} onClick={() => setVisualizacaoPosts(v)} style={{
                    padding: '7px 16px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    background: visualizacaoPosts === v ? '#111' : 'transparent',
                    color: visualizacaoPosts === v ? '#ffc00f' : '#888',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}>
                    {v === 'lista' ? <IconList size={14} /> : v === 'calendario' ? <IconCalendar size={14} /> : <IconFlow size={14} />}
                    {v === 'lista' ? 'Lista' : v === 'calendario' ? 'Calendário' : 'Fluxo'}
                  </button>
                ))}
              </div>
            </div>

            {/* Aviso de falhas de publicação */}
            {!avisoFalhaOculto && postsView.some(p => p.status === 'falha_publicacao') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
                <span style={{ color: '#b91c1c', display: 'flex' }}><IconAlert size={18} /></span>
                <p style={{ margin: 0, fontSize: 13, color: '#b91c1c', flex: 1 }}>
                  {postsView.filter(p => p.status === 'falha_publicacao').length === 1
                    ? 'Há 1 post que falhou ao publicar. Verifique e tente novamente.'
                    : `Há ${postsView.filter(p => p.status === 'falha_publicacao').length} posts que falharam ao publicar. Verifique e tente novamente.`}
                </p>
                <button onClick={() => setAvisoFalhaOculto(true)} title="Dispensar" style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 2 }}>×</button>
              </div>
            )}

            {postsView.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
                <p>Nenhum post {clienteEmVisualizacao ? 'para este cliente ainda' : 'criado ainda. Clique em "Novo Post" para começar'}.</p>
              </div>
            ) : visualizacaoPosts === 'calendario' ? (
              <Calendar posts={postsView as any} onSelectPost={(p: any) => setPostPreview(p)} onAddPost={novoPostNoDia} onMovePost={moverPostData} />
            ) : visualizacaoPosts === 'fluxo' ? (
              <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
                {(['rascunho', 'aguardando_aprovacao', 'corrigir', 'aprovado', 'reprovado', 'publicado', 'falha_publicacao'] as const).map(st => {
                  const itens = postsView.filter(p => p.status === st)
                  return (
                    <div key={st} style={{ flex: '0 0 240px', background: '#fafafa', borderRadius: 14, border: '1px solid #eee', display: 'flex', flexDirection: 'column', maxHeight: 640 }}>
                      <div style={{ padding: '12px 14px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#333' }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLOR[st] || '#ddd', display: 'inline-block', border: '1px solid rgba(0,0,0,0.08)' }} />
                          {STATUS_LABEL[st]}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#aaa', background: '#fff', borderRadius: 999, padding: '2px 8px', border: '1px solid #eee' }}>{itens.length}</span>
                      </div>
                      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
                        {itens.length === 0 ? (
                          <p style={{ margin: '8px 4px', fontSize: 12, color: '#ccc', textAlign: 'center' }}>Nenhum post</p>
                        ) : itens.map(post => (
                          <div key={post.id} onClick={() => router.push(`/aprovar/${post.id}`)} style={{
                            background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: 10, cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center',
                          }}>
                            <PostThumb src={(post as any).thumbnail || post.imagens?.[0]} size={38} radius={8} />
                            <div style={{ minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.clienteNome}</p>
                              <p style={{ margin: 0, fontSize: 11, color: '#999', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.legenda}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {postsView.map(post => (
                  <div key={post.id} style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', gap: 16, alignItems: 'center' }}>
                    <PostThumb src={(post as any).thumbnail || post.imagens?.[0]} size={60} radius={10} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        {(() => {
                          const cli = clientes.find(c => c.id === post.clienteId || c.nome === post.clienteNome)
                          return cli?.logo ? (
                            <img src={cli.logo} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          ) : (
                            <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#ffc00f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10, color: '#111', flexShrink: 0 }}>
                              {(post.clienteNome || '?')[0]?.toUpperCase()}
                            </span>
                          )
                        })()}
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{post.clienteNome}</span>
                        <span style={{ background: STATUS_COLOR[post.status] || '#eee', borderRadius: 12, padding: '2px 10px', fontSize: 11, fontWeight: 700, color: STATUS_TEXT[post.status] || '#555', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {post.status === 'falha_publicacao' && <IconAlert size={12} />}{STATUS_LABEL[post.status] || post.status}
                        </span>
                        {(post as any).rascunhoInterno && (
                          <span style={{ background: '#eef2ff', color: '#4338ca', borderRadius: 12, padding: '2px 10px', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <IconLock size={12} /> Interno (cliente não vê)
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.legenda}</p>
                      {post.dataAgendada && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#aaa' }}>{new Date(post.dataAgendada).toLocaleDateString('pt-BR')}</p>}
                      {post.status === 'falha_publicacao' && post.erroPublicacao && (
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#b91c1c' }}>Erro: {post.erroPublicacao}</p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      {post.status === 'falha_publicacao' && (
                        <button onClick={() => republicarPost(post)} disabled={republicandoId === post.id} style={{
                          padding: '8px 14px', background: '#ffc00f', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 12, color: '#111', cursor: republicandoId === post.id ? 'not-allowed' : 'pointer',
                        }}>
                          {republicandoId === post.id ? 'Publicando...' : 'Tentar novamente'}
                        </button>
                      )}
                      <button onClick={() => iniciarEdicaoPost(post)} style={{
                        padding: '8px 14px', background: '#f5f5f5', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, color: '#111', cursor: 'pointer',
                      }}>
                        Editar
                      </button>
                      <button onClick={() => router.push(`/aprovar/${post.id}`)} style={{
                        padding: '8px 14px', background: '#111', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, color: '#ffc00f', cursor: 'pointer',
                      }}>
                        Ver
                      </button>
                      {role !== 'cliente' && (
                        <button onClick={() => excluirPost(post)} title="Excluir post" style={{
                          padding: '8px 10px', background: '#fff', border: '1px solid #fca5a5', borderRadius: 8, color: '#b91c1c', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <IconTrash size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PLANNER — cabeçalho (Novo Post + alternância Lista/Calendário) */}
        {aba === 'planner' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
            <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Planner{clienteEmVisualizacao ? ` — ${clienteEmVisualizacao.nome}` : ''}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: 10, padding: 3 }}>
                {(['lista', 'calendario'] as const).map(v => (
                  <button key={v} onClick={() => setPlannerView(v)} style={{
                    padding: '7px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    background: plannerView === v ? '#fff' : 'transparent', color: plannerView === v ? '#111' : '#888',
                    boxShadow: plannerView === v ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                  }}>{v === 'lista' ? 'Lista' : 'Calendário'}</button>
                ))}
              </div>
              <button onClick={() => setAba('novo-post')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ffc00f', color: '#111', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Novo Post
              </button>
            </div>
          </div>
        )}

        {/* Status/barra de progresso ao publicar/agendar/salvar */}
        {aba === 'planner' && (criandoPost || rascunhoMsg) && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '12px 16px', marginBottom: 18, fontSize: 13, color: '#1d4ed8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {criandoPost && <span style={{ width: 14, height: 14, border: '2px solid #bfdbfe', borderTopColor: '#1d4ed8', borderRadius: '50%', display: 'inline-block', animation: 'girar 0.8s linear infinite', flexShrink: 0 }} />}
              <span>{rascunhoMsg || 'Processando...'}</span>
            </div>
            {criandoPost && (
              <div style={{ position: 'relative', height: 4, borderRadius: 999, background: '#dbeafe', overflow: 'hidden', marginTop: 10 }}>
                <div style={{ position: 'absolute', top: 0, bottom: 0, background: '#1d4ed8', borderRadius: 999, animation: 'barraInd 1.2s ease-in-out infinite' }} />
              </div>
            )}
            <style>{`@keyframes girar{to{transform:rotate(360deg)}}@keyframes barraInd{0%{left:-40%;width:40%}50%{left:30%;width:50%}100%{left:100%;width:40%}}`}</style>
          </div>
        )}

        {/* CALENDÁRIO (avulso ou dentro do Planner) */}
        {(aba === 'calendario' || (aba === 'planner' && plannerView === 'calendario')) && (
          <div>
            {aba !== 'planner' && <h2 style={{ margin: '0 0 20px', fontSize: 18, color: '#111' }}>Calendário de Conteúdo</h2>}
            <Calendar posts={postsView as any} onSelectPost={(p: any) => setPostPreview(p)} onAddPost={novoPostNoDia} onMovePost={moverPostData} />
          </div>
        )}

        {/* BIBLIOTECA / LISTA do Planner */}
        {(aba === 'biblioteca' || (aba === 'planner' && plannerView === 'lista')) && (
          <div>
            {aba !== 'planner' && <h2 style={{ margin: '0 0 16px', fontSize: 18, color: '#111' }}>Biblioteca de Conteúdo</h2>}

            {/* Filtros */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
              <input value={bibBusca} onChange={e => setBibBusca(e.target.value)} placeholder="Buscar por legenda..."
                style={{ flex: 1.5, minWidth: 200, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
              <select value={bibCliente} onChange={e => setBibCliente(e.target.value)}
                style={{ flex: 1, minWidth: 160, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }}>
                <option value="">Todos os clientes</option>
                {clientes.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
              </select>
              <select value={bibStatus} onChange={e => setBibStatus(e.target.value)}
                style={{ flex: 1, minWidth: 160, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }}>
                <option value="">Todos os status</option>
                {Object.keys(STATUS_LABEL).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>

            {(() => {
              const fmtData = (iso?: string) => {
                if (!iso) return ''
                const d = new Date(iso)
                if (isNaN(d.getTime())) return ''
                return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
              }
              const quando = (p: any) => p.atualizadoEm || p.dataAgendada || p.criadoEm || ''
              const filtrados = postsView
                .filter(p =>
                  (!bibBusca || p.legenda?.toLowerCase().includes(bibBusca.toLowerCase())) &&
                  (!bibCliente || p.clienteNome === bibCliente) &&
                  (!bibStatus || p.status === bibStatus)
                )
                // Cronológico — mais recente primeiro
                .sort((a, b) => new Date(quando(b)).getTime() - new Date(quando(a)).getTime())
              if (filtrados.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: 60, color: '#aaa', background: '#fff', borderRadius: 14, border: '1px solid #eee' }}>
                    <p>Nenhum conteúdo encontrado com esses filtros.</p>
                  </div>
                )
              }
              return (
                <>
                {bibSelecionados.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '10px 16px', background: '#fff', border: '1px solid #eee', borderRadius: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{bibSelecionados.length} selecionado(s)</span>
                    <button onClick={() => setBibSelecionados(filtrados.map(p => p.id))} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#666', cursor: 'pointer' }}>Selecionar todos</button>
                    <button onClick={() => setBibSelecionados([])} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#666', cursor: 'pointer' }}>Limpar</button>
                    <button onClick={excluirSelecionados} style={{ marginLeft: 'auto', background: '#991b1b', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconTrash size={13} /> Apagar selecionados</button>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                  {filtrados.flatMap(post => {
                    // Uma postagem agendada para 2 redes vira 2 cards (IG + FB)
                    const redesDoPost: ('instagram' | 'facebook' | null)[] = ((post as any).redes && (post as any).redes.length) ? (post as any).redes : [null]
                    const dataMostrar = post.status === 'agendado' ? (post.dataAgendada || post.criadoEm) : (post.atualizadoEm || post.criadoEm)
                    const capa = capaDoPost(post)
                    return redesDoPost.map(rede => (
                    <div key={post.id + (rede || '')} onClick={() => setPostPreview(post)} style={{
                      background: '#fff', borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
                      border: bibSelecionados.includes(post.id) ? '2px solid #1877f2' : '1px solid #eee',
                    }}>
                      <div style={{ width: '100%', aspectRatio: post.formato === 'story' || post.formato === 'reel' ? '9/16' : '4/5', background: '#f4f4f4', position: 'relative', overflow: 'hidden' }}>
                        {capa ? (
                          <ImagemComFallback src={capa} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 11, gap: 4, flexDirection: 'column' }}>
                            <IconImageOff size={18} />
                            Sem imagem
                          </div>
                        )}

                        {/* Caixinha de seleção — canto superior esquerdo */}
                        <span onClick={(e) => { e.stopPropagation(); alternarSelecaoPost(post.id) }}
                          style={{
                            position: 'absolute', top: 6, left: 6, width: 20, height: 20, borderRadius: 5, cursor: 'pointer',
                            background: bibSelecionados.includes(post.id) ? '#1877f2' : 'rgba(255,255,255,0.9)',
                            border: bibSelecionados.includes(post.id) ? '1px solid #1877f2' : '1px solid #ccc',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 800,
                          }}>{bibSelecionados.includes(post.id) ? <IconCheck size={13} /> : null}</span>

                        {/* Lixeira — canto inferior direito */}
                        <button onClick={(e) => { e.stopPropagation(); if (confirm('Excluir este post? Esta ação não pode ser desfeita.')) excluirPostDireto(post.id) }} title="Excluir"
                          style={{
                            position: 'absolute', bottom: 6, right: 6, width: 24, height: 24, borderRadius: '50%', cursor: 'pointer',
                            background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                          }}><IconTrash size={13} /></button>

                        {post.imagens?.length > 1 && (
                          <span style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 10, fontWeight: 600, borderRadius: 999, padding: '1px 7px' }}>
                            {post.imagens.length}
                          </span>
                        )}
                        {rede && (
                          <span style={{ position: 'absolute', bottom: 6, left: 6 }}><RedeBadge rede={rede} /></span>
                        )}
                      </div>
                      <div style={{ padding: 9 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 5 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                            {(() => { const cli = clientes.find(c => c.id === post.clienteId || c.nome === post.clienteNome); return (
                              <span style={{ width: 18, height: 18, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: cli?.corPrimaria || '#ffc00f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 9, color: cli?.corSecundaria || '#111' }}>
                                {cli?.logo ? <img src={cli.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (post.clienteNome?.[0]?.toUpperCase() || '?')}
                              </span>
                            )})()}
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.clienteNome}</span>
                          </span>
                          <span style={{ background: STATUS_COLOR[post.status] || '#eee', color: STATUS_TEXT[post.status] || '#555', borderRadius: 999, padding: '2px 8px', fontSize: 9, fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>
                            {STATUS_LABEL[post.status] || post.status}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 5px', fontSize: 10, color: '#aaa', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {post.status === 'agendado' ? <IconCalendar size={11} /> : null}{fmtData(dataMostrar)}
                        </p>
                        <p style={{
                          margin: 0, fontSize: 11, color: '#888', lineHeight: 1.35,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                          {post.legenda}
                        </p>
                      </div>
                    </div>
                  ))})}
                </div>
                </>
              )
            })()}
          </div>
        )}

        {/* Modal de preview do post (vale para a lista e o calendário) */}
        {postPreview && (
              <div onClick={() => setPostPreview(null)} style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
              }}>
                <div onClick={e => e.stopPropagation()} style={{
                  background: '#fff', borderRadius: 16, maxWidth: 420, width: '100%', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                }}>
                  {/* Cabeçalho estilo Instagram */}
                  {(() => { const clientePreview = clientes.find(c => c.id === postPreview.clienteId || c.nome === postPreview.clienteNome); return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: clientePreview?.corPrimaria || '#ffc00f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: clientePreview?.corSecundaria || '#111', flexShrink: 0 }}>
                      {clientePreview?.logo ? <img src={clientePreview.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (postPreview.clienteNome?.[0]?.toUpperCase() || '?')}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>{postPreview.clienteNome}</span>
                    <span style={{ marginLeft: 'auto', background: STATUS_COLOR[postPreview.status] || '#eee', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 600, color: STATUS_TEXT[postPreview.status] || '#333', cursor: postPreview.erroPublicacao ? 'pointer' : 'default' }}
                      onClick={() => { if (postPreview.erroPublicacao) alert(`Motivo da falha:\n\n${postPreview.erroPublicacao}`) }}
                      title={postPreview.erroPublicacao || ''}>
                      {STATUS_LABEL[postPreview.status] || postPreview.status}
                    </span>
                  </div>
                  ) })()}

                  {/* Motivo da falha */}
                  {postPreview.erroPublicacao && (
                    <div style={{ padding: '10px 16px', background: '#fef2f2', borderBottom: '1px solid #fecaca', fontSize: 12, color: '#991b1b', lineHeight: 1.5 }}>
                      <strong style={{ display: 'block', marginBottom: 4 }}>Motivo da falha:</strong>
                      {postPreview.erroPublicacao}
                    </div>
                  )}

                  {/* Mídia principal (imagem ou vídeo/Reel) */}
                  {postPreview.imagens?.[0] && (
                    <div style={{ width: '100%', aspectRatio: '1', background: '#000', overflow: 'auto', display: 'flex', gap: 2 }}>
                      {postPreview.imagens.map((m, i) => {
                        const estilo = { width: postPreview.imagens.length > 1 ? '90%' : '100%', height: '100%', objectFit: 'cover' as const, flexShrink: 0, scrollSnapAlign: 'start' as const }
                        const capa = (postPreview as any).capasVideo?.[m]
                        return /\.(mp4|mov|m4v)(\?|$)/i.test(m)
                          ? <video key={i} src={m} poster={capa} controls playsInline muted style={estilo} />
                          : <img key={i} src={m} alt="" style={estilo} />
                      })}
                    </div>
                  )}

                  <div style={{ padding: 16, overflowY: 'auto' }}>
                    <p style={{ margin: '0 0 10px', fontSize: 13, color: '#333', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      <strong>{postPreview.clienteNome}</strong>{' '}{postPreview.legenda}
                    </p>
                    {postPreview.dataAgendada && (
                      <p style={{ margin: '0 0 10px', fontSize: 12, color: '#aaa' }}>
                        Agendado para {new Date(postPreview.dataAgendada).toLocaleString('pt-BR')}
                      </p>
                    )}
                    {postPreview.status === 'falha_publicacao' && postPreview.erroPublicacao && (
                      <p style={{ margin: '0 0 10px', fontSize: 12, color: '#b91c1c', background: '#fef2f2', borderRadius: 8, padding: '8px 10px' }}>Erro: {postPreview.erroPublicacao}</p>
                    )}
                    {postPreview.status === 'falha_publicacao' && (
                      <button onClick={() => republicarPost(postPreview)} disabled={republicandoId === postPreview.id} className="soma10-no-invert" style={{ width: '100%', padding: '11px 0', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: republicandoId === postPreview.id ? 'not-allowed' : 'pointer', marginBottom: 8 }}>
                        {republicandoId === postPreview.id ? 'Publicando...' : 'Tentar publicar novamente'}
                      </button>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button onClick={() => iniciarEdicaoPost(postPreview)} style={{ flex: 1, padding: '10px 0', background: '#f5f5f5', color: '#111', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        Editar
                      </button>
                      <button onClick={() => setPostPreview(null)} style={{ padding: '10px 18px', background: '#f5f5f5', color: '#666', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        Fechar
                      </button>
                      {role !== 'cliente' && (
                        <button onClick={() => { excluirPost(postPreview); setPostPreview(null) }} title="Excluir post" style={{
                          padding: '10px 14px', background: '#fff', border: '1px solid #fca5a5', borderRadius: 10, color: '#b91c1c', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <IconTrash size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

        {/* MARCA — Brands Board */}
        {aba === 'marca' && (
          <div style={{ maxWidth: 820 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 18, color: '#111' }}>Marca — Brand Board{clienteEmVisualizacao ? ` · ${clienteEmVisualizacao.nome}` : ''}</h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#999' }}>A identidade e o DNA do cliente. Isso alimenta o Social Listening e dá contexto ao conteúdo.</p>

            {/* BLOCO FECHADO */}
            {brandModo === 'card' && (
              <div style={{ background: '#fff', borderRadius: 16, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ width: 46, height: 46, borderRadius: '50%', overflow: 'hidden', background: clienteEmVisualizacao?.corPrimaria || '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: clienteEmVisualizacao?.corSecundaria || '#111', flexShrink: 0 }}>
                  {clienteEmVisualizacao?.logo ? <img src={clienteEmVisualizacao.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (clienteEmVisualizacao?.nome?.[0]?.toUpperCase() || '?')}
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <h3 style={{ margin: 0, fontSize: 15, color: '#111' }}>Brand Board · {clienteEmVisualizacao?.nome || ''}</h3>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: '#999' }}>
                    {brandForm.segmento || 'Identidade preenchida'}{brandForm.documentoMarca ? ' · Documento gerado' : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => setBrandModo('ver')} style={{ padding: '9px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Abrir</button>
                  <button onClick={() => setBrandModo('editar')} style={{ padding: '9px 16px', background: '#f5f5f5', color: '#111', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Editar</button>
                  <button onClick={excluirBrand} title="Excluir Brand Board" style={{ padding: '9px 14px', background: '#fff', border: '1px solid #fca5a5', borderRadius: 9, color: '#b91c1c', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><IconTrash size={14} /></button>
                </div>
              </div>
            )}

            {/* VISUALIZAÇÃO (somente leitura) */}
            {brandModo === 'ver' && (
              <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: 16, color: '#111', flex: 1 }}>Brand Board · {clienteEmVisualizacao?.nome || ''}</h3>
                  <button onClick={() => setBrandModo('editar')} style={{ padding: '8px 16px', background: '#ffc00f', border: 'none', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>Editar</button>
                  <button onClick={() => setBrandModo('card')} style={{ padding: '8px 16px', background: '#f5f5f5', color: '#666', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Fechar</button>
                </div>
                {([
                  ['Segmento / Nicho', brandForm.segmento],
                  ['Palavras-chave', brandForm.palavrasChave],
                  ['Descrição da empresa', brandForm.descricao],
                  ['Público-alvo', brandForm.publicoAlvo],
                  ['Tom de voz', brandForm.tomDeVoz],
                  ['Preferências / O que evitar', brandForm.preferencias],
                ] as [string, string][]).map(([l, v]) => v ? (
                  <div key={l}>
                    <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 700, color: '#888' }}>{l}</p>
                    <p style={{ margin: 0, fontSize: 14, color: '#222', whiteSpace: 'pre-wrap' }}>{v}</p>
                  </div>
                ) : null)}
                {(brandForm.documentos || []).length > 0 && (
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: '#888' }}>Documentos</p>
                    {(brandForm.documentos || []).map((d: any, i: number) => (
                      <a key={i} href={d.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1d4ed8' }}><IconDoc size={14} /> {d.nome}</a>
                    ))}
                  </div>
                )}
                <div style={{ borderTop: '1px solid #eee', paddingTop: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 15, color: '#111', flex: 1, minWidth: 200 }}>Documento de marca (IA)</h3>
                    <button onClick={gerarDocumentoIA} disabled={gerandoDocIA} style={{ padding: '9px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: gerandoDocIA ? 0.6 : 1 }}>
                      {gerandoDocIA ? 'Gerando...' : (brandForm.documentoMarca ? 'Regenerar documento' : 'Gerar documento completo')}
                    </button>
                  </div>
                  {docIAMsg && <p style={{ fontSize: 13, color: docIAMsg.toLowerCase().includes('erro') || docIAMsg.toLowerCase().includes('falha') ? '#dc2626' : '#16a34a', fontWeight: 600, margin: '0 0 8px' }}>{docIAMsg}</p>}
                  {brandForm.documentoMarca ? (
                    <div>
                      {brandForm.documentoMarcaGeradoEm && <p style={{ fontSize: 12, color: '#999', margin: '0 0 8px' }}>Gerado em {new Date(brandForm.documentoMarcaGeradoEm).toLocaleString('pt-BR')}</p>}
                      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, color: '#333', background: '#fafafa', border: '1px solid #eee', borderRadius: 12, padding: 18, maxHeight: 520, overflow: 'auto', margin: 0 }}>{brandForm.documentoMarca}</pre>
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: '#aaa', margin: 0 }}>Ainda não há documento gerado. Clique em "Gerar documento completo" para a IA estudar o cliente e pesquisar o nicho na internet.</p>
                  )}
                </div>
              </div>
            )}

            {/* FORMULÁRIO (edição) */}
            {brandModo === 'editar' && (
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Segmento / Nicho</label>
                  <input value={brandForm.segmento || ''} onChange={e => setBrandForm((b: any) => ({ ...b, segmento: e.target.value }))} placeholder="Ex.: Cardiologia, Restaurante, Turismo..."
                    style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Palavras-chave (vírgula)</label>
                  <input value={brandForm.palavrasChave || ''} onChange={e => setBrandForm((b: any) => ({ ...b, palavrasChave: e.target.value }))} placeholder="saúde do coração, exames, prevenção..."
                    style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Descrição da empresa</label>
                <textarea value={brandForm.descricao || ''} onChange={e => setBrandForm((b: any) => ({ ...b, descricao: e.target.value }))} placeholder="O que a empresa faz, diferenciais, serviços..."
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, minHeight: 80, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Público-alvo</label>
                  <textarea value={brandForm.publicoAlvo || ''} onChange={e => setBrandForm((b: any) => ({ ...b, publicoAlvo: e.target.value }))} placeholder="Quem é o cliente ideal..."
                    style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, minHeight: 70, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Tom de voz</label>
                  <textarea value={brandForm.tomDeVoz || ''} onChange={e => setBrandForm((b: any) => ({ ...b, tomDeVoz: e.target.value }))} placeholder="Formal, acolhedor, descontraído..."
                    style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, minHeight: 70, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Preferências / O que evitar</label>
                <textarea value={brandForm.preferencias || ''} onChange={e => setBrandForm((b: any) => ({ ...b, preferencias: e.target.value }))} placeholder="Hashtags padrão, temas a evitar, regras da marca..."
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, minHeight: 70, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>

              {/* Documentos */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 6 }}>Documentos (briefing, manual da marca, etc.)</label>
                {(brandForm.documentos || []).length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                    {(brandForm.documentos || []).map((d: any, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fafafa', borderRadius: 8, padding: '8px 12px' }}>
                        <span style={{ display: 'flex', color: '#888' }}><IconDoc size={15} /></span>
                        <a href={d.url} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 13, color: '#1d4ed8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nome}</a>
                        <button onClick={() => removerDocBrand(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 15 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: '#f5f5f5', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#444' }}>
                  {enviandoDoc ? 'Enviando...' : '+ Adicionar documento'}
                  <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,audio/*" style={{ display: 'none' }} disabled={enviandoDoc}
                    onChange={e => { if (e.target.files?.[0]) enviarDocBrand(e.target.files[0]); e.target.value = '' }} />
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <button onClick={salvarBrand} disabled={salvandoBrand}
                  style={{ padding: '12px 28px', background: '#ffc00f', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: salvandoBrand ? 0.6 : 1 }}>
                  {salvandoBrand ? 'Salvando...' : 'Salvar identidade'}
                </button>
                <button onClick={() => setBrandModo('card')}
                  style={{ padding: '12px 22px', background: '#f5f5f5', color: '#666', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  Voltar
                </button>
                {brandMsg && <span style={{ fontSize: 13, color: brandMsg.toLowerCase().includes('erro') ? '#b91c1c' : '#16a34a', fontWeight: 600 }}>{brandMsg}</span>}
              </div>

              {/* Documento de marca gerado por IA */}
              <div style={{ borderTop: '1px solid #eee', paddingTop: 18, marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <h3 style={{ margin: 0, fontSize: 15, color: '#111' }}>Documento de marca (IA)</h3>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>
                      A IA estuda todas as informações e pesquisa o nicho na internet para gerar uma referência editorial completa.
                    </p>
                  </div>
                  <button onClick={gerarDocumentoIA} disabled={gerandoDocIA}
                    style={{ padding: '10px 20px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: gerandoDocIA ? 0.6 : 1 }}>
                    {gerandoDocIA ? 'Gerando...' : (brandForm.documentoMarca ? 'Regenerar documento' : 'Gerar documento completo')}
                  </button>
                </div>
                {docIAMsg && <p style={{ fontSize: 13, color: docIAMsg.toLowerCase().includes('erro') || docIAMsg.toLowerCase().includes('falha') ? '#dc2626' : '#16a34a', fontWeight: 600, margin: '0 0 10px' }}>{docIAMsg}</p>}
                {brandForm.documentoMarca && (
                  <div>
                    {brandForm.documentoMarcaGeradoEm && (
                      <p style={{ fontSize: 12, color: '#999', margin: '0 0 8px' }}>
                        Gerado em {new Date(brandForm.documentoMarcaGeradoEm).toLocaleString('pt-BR')}
                      </p>
                    )}
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, color: '#333', background: '#fafafa', border: '1px solid #eee', borderRadius: 12, padding: 18, maxHeight: 520, overflow: 'auto', margin: 0 }}>{brandForm.documentoMarca}</pre>
                  </div>
                )}
              </div>
            </div>
            )}
          </div>
        )}

        {/* SOCIAL LISTENING */}
        {aba === 'listening' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Social Listening{clienteEmVisualizacao ? ` · ${clienteEmVisualizacao.nome}` : ''}</h2>
              <button onClick={carregarListening} disabled={listeningLoading}
                style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: listeningLoading ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {listeningLoading ? 'Buscando...' : (<><IconRefresh size={14} /> Atualizar</>)}
              </button>
            </div>
            <p style={{ margin: '0 0 18px', fontSize: 13, color: '#999' }}>Tendências e conteúdos em alta sobre o nicho do cliente (definido no Brand Board).</p>

            {listeningLoading && <div style={{ padding: 50, textAlign: 'center', color: '#aaa' }}>Buscando tendências do nicho...</div>}

            {!listeningLoading && listeningData?.semNicho && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 20, color: '#92400e', fontSize: 14 }}>
                {listeningData.mensagem} <button onClick={() => setAba('marca')} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#92400e', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>Ir para o Brand Board</button>
              </div>
            )}

            {!listeningLoading && listeningData && !listeningData.semNicho && (
              <>
                <p style={{ margin: '0 0 16px', fontSize: 12, color: '#aaa' }}>Termos do nicho: <strong style={{ color: '#666' }}>{(listeningData.termos || []).join(', ')}</strong></p>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
                  {/* YouTube */}
                  <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: 15, color: '#111', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="#ff0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                      YouTube Shorts — mais vistos do nicho (5k+ views)
                    </h3>
                    {!listeningData.youtubeConfigurado && (
                      <p style={{ fontSize: 13, color: '#b45309', background: '#fffbeb', borderRadius: 8, padding: 12 }}>A chave do YouTube (YOUTUBE_API_KEY) ainda não está ativa na Vercel.</p>
                    )}
                    {listeningData.youtubeConfigurado && (listeningData.youtube || []).length === 0 && (
                      <p style={{ fontSize: 13, color: '#aaa' }}>Nenhum vídeo encontrado para esses termos.</p>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {(listeningData.youtube || []).map((v: any) => (
                        <a key={v.id} href={v.url} target="_blank" rel="noreferrer" style={{ display: 'flex', gap: 12, textDecoration: 'none', color: 'inherit' }}>
                          <img src={v.thumb} alt="" style={{ width: 120, height: 68, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{v.titulo}</p>
                            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#888' }}>{v.canal}</p>
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#aaa' }}>{v.views.toLocaleString('pt-BR')} views · {v.curtidas.toLocaleString('pt-BR')} curtidas</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>

                  {/* Google Trends */}
                  <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: 15, color: '#111', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800, color: '#4285f4' }}>G</span> Google Trends — em alta (BR, 7 dias)
                    </h3>
                    {(listeningData.trends || []).length === 0 ? (
                      <p style={{ fontSize: 13, color: '#aaa' }}>Sem buscas relacionadas em alta no momento (o Google Trends pode limitar consultas automáticas).</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(listeningData.trends || []).map((t: any, i: number) => (
                          <a key={i} href={t.link} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 12px', background: '#fafafa', borderRadius: 8, textDecoration: 'none' }}>
                            <span style={{ fontSize: 13, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.termo}</span>
                            <span style={{ display: 'flex', alignItems: 'center', color: '#16a34a', flexShrink: 0 }}>{typeof t.valor === 'number' ? <IconTrend size={13} /> : <span style={{ fontSize: 11, fontWeight: 700 }}>{t.valor}</span>}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* TikTok — Creative Center */}
                <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginTop: 18 }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#111"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                    TikTok — hashtags em alta (Brasil)
                    <span style={{ fontSize: 11, color: '#aaa', fontWeight: 500 }}>· Creative Center</span>
                  </h3>
                  <p style={{ margin: '0 0 12px', fontSize: 12, color: '#aaa' }}>Tendências gerais do Brasil. Os <strong style={{ color: '#16a34a' }}>verdes</strong> casam com o nicho do cliente.</p>
                  {!listeningData.tiktokOk ? (
                    <p style={{ fontSize: 13, color: '#aaa' }}>Não foi possível carregar as tendências do TikTok agora (a fonte não-oficial pode estar bloqueando consultas automáticas). O restante do Social Listening segue funcionando.</p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {(listeningData.tiktok || []).map((h: any, i: number) => (
                        <a key={i} href={h.url} target="_blank" rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 20, textDecoration: 'none',
                            background: h.relevante ? '#dcfce7' : '#f4f4f5', border: h.relevante ? '1px solid #86efac' : '1px solid #eee' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: h.relevante ? '#15803d' : '#333' }}>#{h.nome}</span>
                          {h.posts > 0 && <span style={{ fontSize: 11, color: '#999' }}>{h.posts.toLocaleString('pt-BR')} posts</span>}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ANALYTICS */}
        {aba === 'analytics' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <IconChart size={20} />
              <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Desempenho {clienteEmVisualizacao ? `de ${clienteEmVisualizacao.nome}` : ''}</h2>
            </div>

            {/* Filtros */}
            <div style={{ background: '#fff', borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 18, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>
              {!clienteEmVisualizacao && role !== 'cliente' && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Cliente</label>
                  <select value={analyticsClienteId} onChange={e => { setAnalyticsClienteId(e.target.value); setAnalyticsData(null); setAnalyticsErro('') }}
                    style={{ padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', minWidth: 220 }}>
                    <option value="">Selecione...</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>De</label>
                <input type="date" value={analyticsDesde} onChange={e => setAnalyticsDesde(e.target.value)}
                  style={{ padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Até</label>
                <input type="date" value={analyticsAte} onChange={e => setAnalyticsAte(e.target.value)}
                  style={{ padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
              </div>
              <button onClick={buscarAnalytics} disabled={analyticsLoading || !analyticsClienteId} style={{
                padding: '11px 22px', background: '#111', color: '#ffc00f', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13,
                cursor: (analyticsLoading || !analyticsClienteId) ? 'not-allowed' : 'pointer', opacity: (analyticsLoading || !analyticsClienteId) ? 0.5 : 1,
              }}>
                {analyticsLoading ? 'Carregando...' : 'Buscar dados'}
              </button>
              {analyticsData && (
                <button onClick={exportarAnalyticsPdf} disabled={exportandoPdf} style={{
                  padding: '11px 18px', background: '#fff', color: '#111', border: '1.5px solid #e0e0e0', borderRadius: 10, fontWeight: 700, fontSize: 13,
                  cursor: exportandoPdf ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
                }}>
                  <IconDownload size={14} /> {exportandoPdf ? 'Gerando PDF...' : 'Exportar PDF'}
                </button>
              )}
              {analyticsData && (
                <button onClick={gerarRelatorioMensalPdf} disabled={gerandoRelatorio} className="soma10-no-invert" style={{
                  padding: '11px 18px', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13,
                  cursor: gerandoRelatorio ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
                }}>
                  <IconDownload size={14} /> {gerandoRelatorio ? 'Gerando...' : 'Relatório mensal'}
                </button>
              )}
            </div>

            {analyticsErro && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 12, padding: '12px 16px', marginBottom: 18, color: '#b91c1c', fontSize: 13 }}>
                <IconAlert size={16} /> {analyticsErro}
              </div>
            )}

            {!analyticsData && !analyticsErro && !analyticsLoading && (
              <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
                <IconChart size={32} />
                <p style={{ marginTop: 10 }}>Selecione um cliente e um período, depois clique em "Buscar dados" para ver o desempenho real do Instagram (via API do Meta).</p>
              </div>
            )}

            {analyticsData && (
              <>
                {/* Cartões de totais */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14, marginBottom: 20 }}>
                  {(() => {
                    const ant = analyticsData.totaisAnterior || {}
                    return [
                      { label: 'Posts no periodo', valor: analyticsData.totais?.posts, anterior: ant.posts },
                      { label: 'Curtidas', valor: analyticsData.totais?.curtidas, anterior: ant.curtidas },
                      { label: 'Comentarios', valor: analyticsData.totais?.comentarios, anterior: ant.comentarios },
                      { label: 'Alcance', valor: analyticsData.totais?.alcance, anterior: ant.alcance },
                      { label: 'Impressoes', valor: analyticsData.totais?.impressoes, anterior: ant.impressoes },
                      { label: 'Salvamentos', valor: analyticsData.totais?.salvamentos, anterior: ant.salvamentos },
                      { label: 'Compartilhamentos', valor: analyticsData.totais?.compartilhamentos, anterior: ant.compartilhamentos },
                    ].map(card => {
                      const v = card.valor ?? 0
                      const a = card.anterior ?? 0
                      const diff = a > 0 ? Math.round(((v - a) / a) * 100) : (v > 0 ? 100 : 0)
                      return (
                        <div key={card.label} style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</p>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#111' }}>{v.toLocaleString('pt-BR')}</p>
                            {a > 0 && (
                              <span style={{ fontSize: 12, fontWeight: 700, color: diff > 0 ? '#16a34a' : diff < 0 ? '#b91c1c' : '#888' }}>
                                {diff > 0 ? '+' : ''}{diff}%
                              </span>
                            )}
                          </div>
                          {a > 0 && <p style={{ margin: '4px 0 0', fontSize: 10, color: '#bbb' }}>Anterior: {a.toLocaleString('pt-BR')}</p>}
                        </div>
                      )
                    })
                  })()}
                  {analyticsData.perfil?.followers_count != null && (
                    <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                      <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Seguidores</p>
                      <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#111' }}>{Number(analyticsData.perfil.followers_count).toLocaleString('pt-BR')}</p>
                    </div>
                  )}
                </div>

                {/* Série de alcance/visitas ao perfil por dia */}
                {Array.isArray(analyticsData.insightsConta) && analyticsData.insightsConta.length > 0 && (
                  <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 20 }}>
                    <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#111' }}>Evolução diária</p>
                    {analyticsData.insightsConta.map((serie: any) => {
                      const valores = (serie.values || []).map((v: any) => Number(v.value) || 0)
                      const max = Math.max(1, ...valores)
                      return (
                        <div key={serie.name} style={{ marginBottom: 16 }}>
                          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'capitalize' }}>
                            {serie.name === 'reach' ? 'Alcance' : serie.name === 'profile_views' ? 'Visitas ao perfil' : serie.name}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 70 }}>
                            {(serie.values || []).map((v: any, i: number) => (
                              <div key={i} title={`${new Date(v.end_time).toLocaleDateString('pt-BR')}: ${v.value}`} style={{
                                flex: 1, minWidth: 4, borderRadius: '3px 3px 0 0', background: '#ffc00f',
                                height: `${Math.max(4, (Number(v.value) / max) * 100)}%`,
                              }} />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {analyticsData.erroInsightsConta && (
                  <p style={{ fontSize: 12, color: '#bbb', margin: '-12px 0 16px' }}>Série diária indisponível: {analyticsData.erroInsightsConta}</p>
                )}

                {/* Demografia */}
                {(analyticsData.demografia?.genero || analyticsData.demografia?.idade) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
                    {analyticsData.demografia.genero && (
                      <div style={{ flex: '1 1 260px', background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                        <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#111' }}>Gênero dos seguidores</p>
                        {analyticsData.demografia.genero.map((g: any) => {
                          const total = analyticsData.demografia.genero.reduce((a: number, x: any) => a + (Number(x.value) || 0), 0) || 1
                          const pct = Math.round((Number(g.value) / total) * 100)
                          return (
                            <div key={g.dimension_values?.[0]} style={{ marginBottom: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginBottom: 4 }}>
                                <span style={{ textTransform: 'capitalize' }}>{g.dimension_values?.[0]}</span>
                                <span style={{ fontWeight: 700 }}>{pct}%</span>
                              </div>
                              <div style={{ height: 8, background: '#f0f0f0', borderRadius: 999 }}>
                                <div style={{ height: 8, width: `${pct}%`, background: '#ffc00f', borderRadius: 999 }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {analyticsData.demografia.idade && (
                      <div style={{ flex: '1 1 260px', background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                        <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#111' }}>Faixa etária dos seguidores</p>
                        {analyticsData.demografia.idade.map((g: any) => {
                          const total = analyticsData.demografia.idade.reduce((a: number, x: any) => a + (Number(x.value) || 0), 0) || 1
                          const pct = Math.round((Number(g.value) / total) * 100)
                          return (
                            <div key={g.dimension_values?.[0]} style={{ marginBottom: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginBottom: 4 }}>
                                <span>{g.dimension_values?.[0]}</span>
                                <span style={{ fontWeight: 700 }}>{pct}%</span>
                              </div>
                              <div style={{ height: 8, background: '#f0f0f0', borderRadius: 999 }}>
                                <div style={{ height: 8, width: `${pct}%`, background: '#111', borderRadius: 999 }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Tabela de posts no período */}
                <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <p style={{ margin: 0, padding: '16px 20px', fontSize: 13, fontWeight: 700, color: '#111', borderBottom: '1px solid #f0f0f0' }}>
                    Posts por relevancia — melhor desempenho no topo ({analyticsData.posts?.length || 0})
                  </p>
                  {(!analyticsData.posts || analyticsData.posts.length === 0) ? (
                    <p style={{ margin: 0, padding: '30px 20px', textAlign: 'center', color: '#bbb', fontSize: 13 }}>Nenhum post encontrado no período selecionado.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {analyticsData.posts.map((p: any) => (
                        <a key={p.id} href={p.link} target="_blank" rel="noreferrer" style={{
                          display: 'flex', gap: 14, alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid #f5f5f5', textDecoration: 'none', color: 'inherit',
                        }}>
                          <PostThumb src={p.midiaUrl} size={48} radius={8} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 13, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.legenda || '(sem legenda)'}</p>
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#aaa' }}>{p.publicadoEm ? new Date(p.publicadoEm).toLocaleDateString('pt-BR') : ''}</p>
                          </div>
                          <div style={{ display: 'flex', gap: 16, flexShrink: 0, fontSize: 12, color: '#666' }}>
                            <span><strong>{p.curtidas}</strong> curtidas</span>
                            <span><strong>{p.comentarios}</strong> coment.</span>
                            <span><strong>{p.alcance}</strong> alcance</span>
                            <span><strong>{p.impressoes}</strong> impr.</span>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* NOVO POST */}
        {aba === 'novo-post' && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <button onClick={() => { if (editandoPostId) cancelarEdicaoPost(); setAba(verComoClienteId ? 'planner' : 'home') }} style={{ background: 'none', border: 'none', color: '#888', fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <IconBack size={14} /> Voltar
            </button>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>{editandoPostId ? 'Editar post' : 'Criar novo post'}</h2>
              {editandoPostId && (
                <button onClick={cancelarEdicaoPost} style={{ background: 'none', border: 'none', color: '#888', fontWeight: 700, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
                  Cancelar edição
                </button>
              )}
            </div>

            {rascunhoMsg && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#1d4ed8' }}>
                {rascunhoMsg}
              </div>
            )}

            <PostComposer
              key={composerKey}
              clientes={clientes}
              valorInicial={composerPrefill || (verComoClienteId ? { clienteId: verComoClienteId } : undefined)}
              onSubmit={editandoPostId ? salvarEdicaoPost : criarPost}
              salvandoRascunho={salvandoRascunho}
              enviando={criandoPost}
              travarCliente={!!verComoClienteId}
              modoEdicao={!!editandoPostId}
              textoBotao={editandoPostId ? 'Salvar alterações' : 'Salvar'}
            />
          </div>
        )}

        {/* PAINEL HOME */}
        {aba === 'home' && (
          <DashboardHome clientes={clientes as any} posts={posts as any} onVerCliente={(id: string) => router.push(`/cliente/${id}`)} />
        )}

        {/* CLIENTES */}
        {conectarRedesCliente !== null && (
          <ConectarRedesModal
            clienteId={conectarRedesCliente || null}
            clienteNome={clientes.find(c => c.id === conectarRedesCliente)?.nome}
            onClose={() => setConectarRedesCliente(null)}
          />
        )}

        {aba === 'esteira' && (
          <Esteira clientes={clientes} clienteFixo={verComoClienteId || undefined} onAbrirComposer={(pauta: any) => {
            setComposerPrefill({ clienteId: pauta.clienteId, legenda: pauta.legenda || '', imagens: pauta.imagens || [], formato: pauta.formato || 'feed', colaboradores: pauta.colaboradores || [], capasVideo: pauta.capasVideo || {}, redes: pauta.redes || ['instagram', 'facebook'] })
            setEditandoPostId(pauta.id)
            setAba('novo-post')
          }} />
        )}

        {aba === 'aprovacoes' && (
          <AprovacoesCli posts={verComoClienteId ? posts.filter(p => p.clienteId === verComoClienteId) : posts} clientes={clientes} onAtualizado={() => fetch('/api/posts').then(r => r.json()).then(setPosts)} />
        )}

        {aba === 'inbox' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Inbox</h2>
              {notificacoes.length > 0 && (
                <button onClick={limparNotificacoes} style={{ padding: '8px 16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#b91c1c', cursor: 'pointer' }}>Limpar todas</button>
              )}
            </div>
            {notificacoes.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 14, padding: '60px 20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/></svg>
                <p style={{ margin: 0, fontSize: 14, color: '#888', fontWeight: 500 }}>Nenhuma notificacao por enquanto.</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#bbb' }}>Voce sera notificado sobre tarefas, aprovacoes, mensagens e prazos.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {notificacoes.map(n => {
                  const icones: Record<string, { cor: string; path: string }> = {
                    tarefa_atribuida: { cor: '#2563eb', path: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6' },
                    tarefa_alterada: { cor: '#ca8a04', path: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' },
                    tarefa_mencao: { cor: '#7c3aed', path: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 6a4 4 0 1 1 0 8 4 4 0 0 1 0-8z' },
                    tarefa_prazo_proximo: { cor: '#ea580c', path: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 6v4l3 3' },
                    tarefa_vencida: { cor: '#b91c1c', path: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 6v4l3 3' },
                    mensagem_privada: { cor: '#0891b2', path: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
                    post_aprovado: { cor: '#059669', path: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
                    post_corrigir: { cor: '#ca8a04', path: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' },
                    post_publicado: { cor: '#059669', path: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z' },
                    post_falha_publicacao: { cor: '#b91c1c', path: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 6v4m0 4h.01' },
                    aprovacao_atrasada: { cor: '#ea580c', path: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 6v4l3 3' },
                    contrato_renovacao: { cor: '#7c3aed', path: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
                    briefing_solicitado: { cor: '#0891b2', path: 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2zM14 2v6h6M9 13h6M9 17h4' },
                    candidatura: { cor: '#059669', path: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
                    geral: { cor: '#6b7280', path: 'M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0' },
                  }
                  const ic = icones[n.tipo] || icones.geral
                  return (
                    <div key={n.id} onClick={() => {
                      if (!n.lida) marcarNotificacaoLida(n.id)
                      if (n.postId) { const p = posts.find((x: any) => x.id === n.postId); if (p) setPostPreview(p) }
                      if (n.tipo?.startsWith('tarefa_')) setAba('tarefas' as any)
                      if (n.tipo === 'mensagem_privada') setAba('mensagens' as any)
                    }} style={{
                      display: 'flex', gap: 14, padding: '14px 18px', background: n.lida ? '#fff' : '#fffbeb', borderRadius: 12,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer', alignItems: 'flex-start',
                      border: n.lida ? '1px solid #f0f0f0' : '1px solid #fde68a', transition: 'all 0.15s',
                    }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${ic.cor}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ic.cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ic.path} /></svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{n.titulo}</span>
                          {!n.lida && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />}
                        </div>
                        <p style={{ margin: '0 0 4px', fontSize: 12.5, color: '#555', lineHeight: 1.4 }}>{n.mensagem}</p>
                        <span style={{ fontSize: 11, color: '#bbb' }}>{new Date(n.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <button onClick={e => { e.stopPropagation(); excluirNotificacao(n.id) }} title="Excluir" style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4, flexShrink: 0 }}>x</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {aba === 'tarefas' && (
          <GestaoTarefas clientes={clientes as any} usuarios={usuarios as any} />
        )}

        {aba === 'campanhas' && (
          <Briefings clientes={clientes as any} />
        )}

        {aba === 'candidaturas' && role === 'admin' && (
          <Candidaturas />
        )}

        {aba === 'minha-conta' && (
          <MinhaConta />
        )}

        {aba === 'playbook' && (
          <Playbook clientes={clientes as any} />
        )}

        {aba === 'mensagens' && (
          <ChatInterno meuEmail={(session?.user as any)?.email || ''} />
        )}

        {aba === 'clientes' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Clientes</h2>
              {role === 'admin' && (
                <button onClick={() => setConectarRedesCliente('')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
                  Conectar redes sociais
                </button>
              )}
            </div>

            {/* Erro OAuth */}
            {metaErro && (
              <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#dc2626' }}>
                {metaErro}
                <button onClick={() => setMetaErro('')} style={{ marginLeft: 12, background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
              </div>
            )}

            {/* Painel de páginas encontradas via OAuth */}
            {metaPages.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e0e0e0', marginBottom: 20, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
                  {metaClienteAlvo ? (
                    <>
                      <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 14, color: '#111' }}>
                        Vincular ao cliente {clientes.find(c => c.id === metaClienteAlvo)?.nome || ''}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: '#888' }}>Escolha qual Página do Facebook e conta do Instagram pertencem a este cliente.</p>
                    </>
                  ) : (
                    <>
                      <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 14, color: '#111' }}>{metaPages.length} {metaPages.length === 1 ? 'conta encontrada' : 'contas encontradas'}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#888' }}>Selecione a qual cliente cada conta pertence e clique em Salvar.</p>
                    </>
                  )}
                </div>
                <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {metaPages.map(page => (
                    <div key={page.pageId} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid #f5f5f5' }}>
                      {page.instagram?.profilePic && (
                        <img src={page.instagram.profilePic} alt="" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: '#111' }}>{page.pageName}</p>
                        {page.instagram ? (
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>@{page.instagram.username}</p>
                        ) : (
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#f59e0b' }}>Sem Instagram vinculado</p>
                        )}
                      </div>
                      {page.instagram && (
                        metaClienteAlvo ? (
                          <button onClick={() => vincularPaginaACliente(page, metaClienteAlvo)} disabled={!!vinculandoPagina}
                            style={{ padding: '8px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: vinculandoPagina ? 0.6 : 1, flexShrink: 0 }}>
                            {vinculandoPagina === page.pageId ? 'Vinculando...' : 'Vincular'}
                          </button>
                        ) : (
                          <select
                            value={vinculos[page.pageId] || ''}
                            onChange={e => setVinculos(v => ({ ...v, [page.pageId]: e.target.value }))}
                            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, background: '#fff', fontFamily: 'inherit', minWidth: 180 }}
                          >
                            <option value="">Selecionar cliente...</option>
                            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                          </select>
                        )
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ padding: '14px 20px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={() => { setMetaPages([]); setVinculos({}); setMetaClienteAlvo('') }}
                    style={{ padding: '9px 18px', background: '#f5f5f5', border: 'none', borderRadius: 8, fontSize: 13, color: '#666', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  {!metaClienteAlvo && (
                    <button onClick={salvarVinculos} disabled={vinculando || Object.values(vinculos).every(v => !v)}
                      style={{ padding: '9px 20px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: vinculando ? 0.6 : 1 }}>
                      {vinculando ? 'Salvando...' : 'Salvar vínculos'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {role === 'admin' && (
              <div style={{ background: '#fff', borderRadius: 14, padding: 20, marginBottom: 20, border: '1px solid #e8e8e8' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: '#555' }}>Adicionar cliente manualmente</h3>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input value={novoCliente.nome} onChange={e => setNovoCliente(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do cliente"
                    style={{ flex: 1, minWidth: 160, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                  <input value={novoCliente.instagram} onChange={e => setNovoCliente(p => ({ ...p, instagram: e.target.value }))} placeholder="@instagram"
                    style={{ flex: 1, minWidth: 140, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                  <select value={novoCliente.tipo || 'cliente'} onChange={e => setNovoCliente(p => ({ ...p, tipo: e.target.value }))}
                    style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                    <option value="cliente">Cliente</option>
                    <option value="interno">Projeto interno</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 8 }}>Entregaveis</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {ENTREGAVEIS_OPCOES.map(op => {
                      const ativo = (novoCliente.entregaveis || []).includes(op.key)
                      return (
                        <button key={op.key} type="button" onClick={() => setNovoCliente(p => ({ ...p, entregaveis: ativo ? (p.entregaveis || []).filter(e => e !== op.key) : [...(p.entregaveis || []), op.key] }))}
                          style={{ padding: '6px 12px', borderRadius: 8, border: ativo ? '1.5px solid #ffc00f' : '1px solid #e0e0e0', background: ativo ? '#fffbeb' : '#fff', fontSize: 12, fontWeight: ativo ? 700 : 500, color: ativo ? '#92400e' : '#666', cursor: 'pointer' }}>
                          {op.label}
                        </button>
                      )
                    })}
                  </div>
                  {(novoCliente.entregaveis || []).includes('social_media') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#888' }}>Posts mensais:</label>
                      <input type="number" min="0" value={novoCliente.postsMensais || 12} onChange={e => setNovoCliente(p => ({ ...p, postsMensais: Number(e.target.value) }))}
                        style={{ width: 70, padding: '6px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                    </div>
                  )}
                  {/* Contrato */}
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #eee' }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 8 }}>Contrato (opcional)</label>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <input type="number" min="0" placeholder="Valor (R$)" value={novoCliente.contratoValor ?? ''} onChange={e => setNovoCliente(p => ({ ...p, contratoValor: Number(e.target.value) }))}
                        style={{ width: 120, padding: '8px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                      <label style={{ fontSize: 11, color: '#888', display: 'flex', flexDirection: 'column', gap: 2 }}>Início
                        <input type="date" value={novoCliente.contratoInicio || ''} onChange={e => setNovoCliente(p => ({ ...p, contratoInicio: e.target.value }))}
                          style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} /></label>
                      <label style={{ fontSize: 11, color: '#888', display: 'flex', flexDirection: 'column', gap: 2 }}>Renovação
                        <input type="date" value={novoCliente.contratoRenovacao || ''} onChange={e => setNovoCliente(p => ({ ...p, contratoRenovacao: e.target.value }))}
                          style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} /></label>
                      <select value={novoCliente.contratoCiclo || ''} onChange={e => setNovoCliente(p => ({ ...p, contratoCiclo: e.target.value }))}
                        style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                        <option value="">Ciclo...</option>
                        <option value="mensal">Mensal</option>
                        <option value="trimestral">Trimestral</option>
                        <option value="semestral">Semestral</option>
                        <option value="anual">Anual</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Identidade visual do cliente */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: '#f5f5f5', border: '1.5px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {novoCliente.logo ? <img src={novoCliente.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 11, color: '#bbb' }}>Logo</span>}
                    </div>
                    <span style={{ fontSize: 12, color: '#666', textDecoration: 'underline' }}>{enviandoLogoNovoCliente ? 'Enviando...' : 'Enviar logomarca'}</span>
                    <input type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { if (e.target.files?.[0]) uploadLogoNovoCliente(e.target.files[0]); e.target.value = '' }} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#666' }}>
                    Cor primária
                    <input type="color" value={novoCliente.corPrimaria || '#ffc00f'} onChange={e => setNovoCliente(p => ({ ...p, corPrimaria: e.target.value }))}
                      style={{ width: 36, height: 32, border: '1px solid #e0e0e0', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#666' }}>
                    Cor secundária
                    <input type="color" value={novoCliente.corSecundaria || '#111111'} onChange={e => setNovoCliente(p => ({ ...p, corSecundaria: e.target.value }))}
                      style={{ width: 36, height: 32, border: '1px solid #e0e0e0', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                  </label>
                  <button onClick={criarCliente} disabled={!clienteFormValido} style={{
                    marginLeft: 'auto', padding: '10px 18px', background: clienteFormValido ? '#ffc00f' : '#f0f0f0', border: 'none', borderRadius: 8,
                    fontWeight: 700, fontSize: 13, cursor: clienteFormValido ? 'pointer' : 'not-allowed', color: clienteFormValido ? '#111' : '#bbb',
                  }}>Adicionar cliente</button>
                </div>
                <p style={{ margin: '10px 0 0', fontSize: 12, color: '#aaa' }}>
                  Informe o e-mail para gerar automaticamente um login e senha para o cliente acessar o portal de aprovação.
                </p>

                {erroCliente && (
                  <div style={{ marginTop: 14, background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#ef4444' }}>
                    {erroCliente}
                  </div>
                )}

                {credenciaisGeradas && (
                  <div style={{ marginTop: 14, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 16px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                      Acesso criado para {credenciaisGeradas.nome} — copie e envie ao cliente:
                    </p>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
                      <span style={{ color: '#555' }}>Portal: <strong>{typeof window !== 'undefined' ? window.location.origin : ''}/login</strong></span>
                      <span style={{ color: '#555' }}>E-mail: <strong>{credenciaisGeradas.email}</strong></span>
                      <span style={{ color: '#555' }}>Senha: <strong>{credenciaisGeradas.senha}</strong></span>
                    </div>
                    <button onClick={() => {
                      const texto = `Acesso ao portal de aprovação:\n${typeof window !== 'undefined' ? window.location.origin : ''}/login\nE-mail: ${credenciaisGeradas.email}\nSenha: ${credenciaisGeradas.senha}`
                      navigator.clipboard?.writeText(texto)
                    }} style={{ marginTop: 10, padding: '7px 14px', background: '#111', color: '#ffc00f', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      Copiar dados de acesso
                    </button>
                  </div>
                )}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {clientes.map(c => (
                <div key={c.id} style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: c.corPrimaria || '#f5f5f5', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {c.logo ? <img src={c.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontWeight: 800, fontSize: 14, color: c.corSecundaria || '#111' }}>{c.nome[0]?.toUpperCase()}</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {c.nome}
                        <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '1px 8px', background: (c as any).tipo === 'interno' ? '#dbeafe' : '#f0fdf4', color: (c as any).tipo === 'interno' ? '#1d4ed8' : '#16a34a' }}>{(c as any).tipo === 'interno' ? 'Projeto interno' : 'Cliente'}</span>
                        {(() => { const cc = c as any; const temBrand = !!(cc.segmento || cc.palavrasChave || cc.descricao || cc.publicoAlvo || cc.tomDeVoz || cc.preferencias || cc.documentoMarca); return temBrand ? (
                          <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '1px 8px', background: '#f3e8ff', color: '#7c3aed' }}>Brand Board{cc.documentoMarca ? ' + IA' : ''}</span>
                        ) : null })()}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 13, color: '#888' }}>@{c.instagram?.replace(/^@/, '')}</p>
                      {c.loginEmail && (
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#16a34a' }}>Acesso ao portal: {c.loginEmail}</p>
                      )}
                      {(c as any).contratoRenovacao && (() => {
                        const dias = Math.ceil((new Date((c as any).contratoRenovacao).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
                        const venceu = dias < 0
                        const perto = dias >= 0 && dias <= 30
                        return (
                          <p style={{ margin: '4px 0 0', fontSize: 12, fontWeight: perto || venceu ? 700 : 500, color: venceu ? '#b91c1c' : perto ? '#ea580c' : '#888' }}>
                            Renovação: {new Date((c as any).contratoRenovacao).toLocaleDateString('pt-BR')}{venceu ? ' (vencido)' : perto ? ` (em ${dias} dia(s))` : ''}
                          </p>
                        )
                      })()}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {role === 'admin' && (
                        <>
                          <button onClick={() => editandoCliente === c.id ? setEditandoCliente(null) : iniciarEdicaoCliente(c)}
                            style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '5px 12px', fontSize: 12, color: '#666', cursor: 'pointer' }}>
                            {editandoCliente === c.id ? 'Fechar' : 'Editar'}
                          </button>
                          <button onClick={() => excluirCliente(c.id, c.nome)}
                            style={{ background: 'none', border: '1px solid #fecaca', borderRadius: 8, padding: '5px 12px', fontSize: 12, color: '#ef4444', cursor: 'pointer' }}>
                            Excluir
                          </button>
                        </>
                      )}
                      <span style={{ background: '#f5f5f5', borderRadius: 8, padding: '3px 10px', fontSize: 12, color: '#666' }}>
                        {posts.filter(p => p.clienteNome === c.nome).length} posts
                      </span>
                      {(() => {
                        const temFB = !!c.facebookPageId
                        const temIG = !!(c.instagramConectado || c.instagramUserId)
                        const badge = (bg: string, cor: string, icone: React.ReactNode, txt: string) => (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: bg, color: cor, borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>{icone}{txt}</span>
                        )
                        const igIcon = <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8z"/></svg>
                        const fbIcon = <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {temIG && badge('#fdecf3', '#c2185b', igIcon, `Instagram${c.instagramUsername ? ' · @' + c.instagramUsername : ''}`)}
                            {temFB && badge('#e7f0fd', '#1877f2', fbIcon, 'Facebook')}
                            {role === 'admin' ? (
                              <>
                                {!temIG && (
                                  <a href={`/api/instagram/oauth?cliente=${c.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#c2185b', color: '#fff', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                                    {igIcon} Conectar Instagram
                                  </a>
                                )}
                                {!temFB && (
                                  <a href={`/api/meta/oauth?cliente=${c.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#1877f2', color: '#fff', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                                    {fbIcon} Conectar Facebook
                                  </a>
                                )}
                                {(temFB || temIG) && (
                                  <button onClick={() => { if (confirm(`Desconectar as redes sociais de ${c.nome}? O perfil perdera o acesso para publicacao ate ser reconectado.`)) desconectarInstagram(c.id) }}
                                    style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '5px 10px', fontSize: 12, color: '#aaa', cursor: 'pointer' }}>
                                    Desconectar
                                  </button>
                                )}
                              </>
                            ) : (!temFB && !temIG) ? (
                              <span style={{ background: '#fff3cd', color: '#b45309', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>Não conectado</span>
                            ) : null}
                          </div>
                        )
                      })()}
                    </div>
                  </div>

                  {/* Painel de edição */}
                  {editandoCliente === c.id && (
                    <div style={{ borderTop: '1px solid #f0f0f0', padding: '16px 18px', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <input value={edicaoCliente.nome || ''} onChange={e => setEdicaoCliente(p => ({ ...p, nome: e.target.value }))} placeholder="Nome"
                          style={{ flex: 1, minWidth: 160, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                        <input value={edicaoCliente.instagram || ''} onChange={e => setEdicaoCliente(p => ({ ...p, instagram: e.target.value }))} placeholder="@instagram"
                          style={{ flex: 1, minWidth: 140, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                        <select value={(edicaoCliente as any).tipo || 'cliente'} onChange={e => setEdicaoCliente(p => ({ ...p, tipo: e.target.value as 'cliente' | 'interno' }))}
                          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                          <option value="cliente">Cliente</option>
                          <option value="interno">Projeto interno</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 8 }}>Entregaveis</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {ENTREGAVEIS_OPCOES.map(op => {
                            const ativo = ((edicaoCliente as any).entregaveis || []).includes(op.key)
                            return (
                              <button key={op.key} type="button" onClick={() => setEdicaoCliente(p => ({ ...p, entregaveis: ativo ? ((p as any).entregaveis || []).filter((e: string) => e !== op.key) : [...((p as any).entregaveis || []), op.key] }))}
                                style={{ padding: '5px 10px', borderRadius: 8, border: ativo ? '1.5px solid #ffc00f' : '1px solid #e0e0e0', background: ativo ? '#fffbeb' : '#fff', fontSize: 11, fontWeight: ativo ? 700 : 500, color: ativo ? '#92400e' : '#666', cursor: 'pointer' }}>
                                {op.label}
                              </button>
                            )
                          })}
                        </div>
                        {((edicaoCliente as any).entregaveis || []).includes('social_media') && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: '#888' }}>Posts mensais:</label>
                            <input type="number" min="0" value={(edicaoCliente as any).postsMensais || 0} onChange={e => setEdicaoCliente(p => ({ ...p, postsMensais: Number(e.target.value) }))}
                              style={{ width: 70, padding: '5px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                          </div>
                        )}
                        {/* Contrato */}
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #eee' }}>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 8 }}>Contrato</label>
                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <input type="number" min="0" placeholder="Valor (R$)" value={(edicaoCliente as any).contratoValor ?? ''} onChange={e => setEdicaoCliente(p => ({ ...p, contratoValor: Number(e.target.value) }))}
                              style={{ width: 120, padding: '8px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                            <label style={{ fontSize: 11, color: '#888', display: 'flex', flexDirection: 'column', gap: 2 }}>Início
                              <input type="date" value={(edicaoCliente as any).contratoInicio || ''} onChange={e => setEdicaoCliente(p => ({ ...p, contratoInicio: e.target.value }))}
                                style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} /></label>
                            <label style={{ fontSize: 11, color: '#888', display: 'flex', flexDirection: 'column', gap: 2 }}>Renovação
                              <input type="date" value={(edicaoCliente as any).contratoRenovacao || ''} onChange={e => setEdicaoCliente(p => ({ ...p, contratoRenovacao: e.target.value }))}
                                style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} /></label>
                            <select value={(edicaoCliente as any).contratoCiclo || ''} onChange={e => setEdicaoCliente(p => ({ ...p, contratoCiclo: e.target.value as any }))}
                              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                              <option value="">Ciclo...</option>
                              <option value="mensal">Mensal</option>
                              <option value="trimestral">Trimestral</option>
                              <option value="semestral">Semestral</option>
                              <option value="anual">Anual</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                          <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: '#f5f5f5', border: '1.5px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {edicaoCliente.logo ? <img src={edicaoCliente.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 11, color: '#bbb' }}>Logo</span>}
                          </div>
                          <span style={{ fontSize: 12, color: '#666', textDecoration: 'underline' }}>{enviandoLogoCliente ? 'Enviando...' : 'Trocar logomarca'}</span>
                          <input type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={e => { if (e.target.files?.[0]) uploadLogoCliente(e.target.files[0]); e.target.value = '' }} />
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#666' }}>
                          Cor primária
                          <input type="color" value={edicaoCliente.corPrimaria || '#ffc00f'} onChange={e => setEdicaoCliente(p => ({ ...p, corPrimaria: e.target.value }))}
                            style={{ width: 36, height: 32, border: '1px solid #e0e0e0', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#666' }}>
                          Cor secundária
                          <input type="color" value={edicaoCliente.corSecundaria || '#111111'} onChange={e => setEdicaoCliente(p => ({ ...p, corSecundaria: e.target.value }))}
                            style={{ width: 36, height: 32, border: '1px solid #e0e0e0', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                        </label>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                          <button onClick={() => setEditandoCliente(null)} style={{ padding: '9px 16px', background: '#f0f0f0', border: 'none', borderRadius: 8, fontSize: 13, color: '#666', cursor: 'pointer' }}>Cancelar</button>
                          <button onClick={() => salvarEdicaoCliente(c.id)} style={{ padding: '9px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Salvar</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* USUÁRIOS (admin only) */}
        {aba === 'usuarios' && role === 'admin' && (
          <div>
            <h2 style={{ margin: '0 0 20px', fontSize: 18, color: '#111' }}>Colaboradores</h2>
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15 }}>Adicionar colaborador</h3>
                <button onClick={() => { setMostrarFormUsuario(v => !v); setErroUsuario(''); setVerSenhaNovo(false) }} style={{
                  padding: '9px 18px', background: mostrarFormUsuario ? '#f0f0f0' : '#ffc00f', border: 'none', borderRadius: 10,
                  fontWeight: 700, fontSize: 13, cursor: 'pointer', color: '#111',
                }}>{mostrarFormUsuario ? 'Fechar' : '+ Cadastrar usuário'}</button>
              </div>
              {mostrarFormUsuario && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input value={novoUsuario.nome} onChange={e => setNovoUsuario(p => ({ ...p, nome: e.target.value }))} placeholder="Nome"
                      style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, fontFamily: 'inherit' }} />
                    <input value={novoUsuario.email} onChange={e => setNovoUsuario(p => ({ ...p, email: e.target.value }))} placeholder="Email"
                      style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, fontFamily: 'inherit' }} />
                  </div>
                  <input value={novoUsuario.cargo} onChange={e => setNovoUsuario(p => ({ ...p, cargo: e.target.value }))} placeholder="Função / Cargo (ex.: Social Media, Designer, Gestor de Tráfego)"
                    style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, fontFamily: 'inherit' }} />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input type={verSenhaNovo ? 'text' : 'password'} value={novoUsuario.senha} onChange={e => setNovoUsuario(p => ({ ...p, senha: e.target.value }))} placeholder="Senha"
                        style={{ width: '100%', padding: '10px 42px 10px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                      <button type="button" onClick={() => setVerSenhaNovo(v => !v)} title={verSenhaNovo ? 'Ocultar senha' : 'Mostrar senha'}
                        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999', display: 'flex', padding: 0 }}>
                        {verSenhaNovo ? <IconEyeOff size={17} /> : <IconEye size={17} />}
                      </button>
                    </div>
                    <select value={novoUsuario.role} onChange={e => setNovoUsuario(p => ({ ...p, role: e.target.value }))}
                      style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, background: '#fff', fontFamily: 'inherit' }}>
                      <option value="gerente">Gerente</option>
                      <option value="admin">Admin</option>
                      <option value="cliente">Cliente</option>
                    </select>
                    {novoUsuario.role === 'cliente' && (
                      <select value={(novoUsuario as any).clienteId || ''} onChange={e => setNovoUsuario(p => ({ ...p, clienteId: e.target.value }))}
                        style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, background: '#fff', fontFamily: 'inherit' }}>
                        <option value="">Vincular a qual cliente?</option>
                        {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    )}
                    <button onClick={criarUsuario} disabled={!usuarioFormValido} style={{
                      padding: '10px 20px', background: usuarioFormValido ? '#ffc00f' : '#f0f0f0', border: 'none', borderRadius: 10,
                      fontWeight: 700, cursor: usuarioFormValido ? 'pointer' : 'not-allowed', color: usuarioFormValido ? '#111' : '#bbb',
                    }}>Adicionar</button>
                  </div>
                  {erroUsuario && (
                    <p style={{ margin: 0, fontSize: 12, color: '#ef4444' }}>{erroUsuario}</p>
                  )}
                  {!erroUsuario && (novoUsuario.nome || novoUsuario.email || novoUsuario.senha) && !usuarioFormValido && (
                    <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>
                      Preencha nome, e-mail válido, senha (mín. 6 caracteres) e nível de acesso para continuar.
                    </p>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...usuarios].sort((a, b) => {
                const ordem: Record<string, number> = { admin: 0, gerente: 1, cliente: 2 }
                return (ordem[a.role] ?? 9) - (ordem[b.role] ?? 9) || a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' })
              }).map(u => (
                <div key={u.id} style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#888', flexShrink: 0 }}>
                      {(u as any).foto ? <img src={(u as any).foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : u.nome[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, color: '#111' }}>{u.nome}{(u as any).cargo ? <span style={{ fontWeight: 500, fontSize: 13, color: '#888' }}> · {(u as any).cargo}</span> : null}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 13, color: '#888' }}>{u.email}</p>
                      {u.role === 'cliente' && u.clienteId && (() => { const c = clientes.find(x => x.id === u.clienteId); return c ? <p style={{ margin: '2px 0 0', fontSize: 11, color: '#16a34a' }}>Vinculado a: {c.nome}</p> : null })()}
                    </div>
                    <span style={{ background: u.role === 'admin' ? '#fef3c7' : u.role === 'cliente' ? '#dbeafe' : '#f0f0f0', borderRadius: 12, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: u.role === 'cliente' ? '#1d4ed8' : '#333' }}>{u.role}</span>
                    <button onClick={() => editandoUsuario === u.email ? setEditandoUsuario(null) : iniciarEdicaoUsuario(u)}
                      style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '5px 12px', fontSize: 12, color: '#666', cursor: 'pointer' }}>
                      {editandoUsuario === u.email ? 'Fechar' : 'Editar'}
                    </button>
                    <button onClick={() => excluirUsuario(u.email, u.nome)}
                      style={{ background: 'none', border: '1px solid #fecaca', borderRadius: 8, padding: '5px 12px', fontSize: 12, color: '#ef4444', cursor: 'pointer' }}>
                      Excluir
                    </button>
                  </div>
                  {editandoUsuario === u.email && (
                    <div style={{ borderTop: '1px solid #f0f0f0', padding: '16px 18px', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <label style={{ cursor: 'pointer', flexShrink: 0 }}>
                          <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #e0e0e0' }}>
                            {edicaoUsuario.foto ? <img src={edicaoUsuario.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 11, color: '#bbb' }}>Foto</span>}
                          </div>
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                            if (!e.target.files?.[0]) return
                            const url = await enviarImagem(e.target.files[0])
                            if (url) setEdicaoUsuario(p => ({ ...p, foto: url }))
                            e.target.value = ''
                          }} />
                        </label>
                        <span style={{ fontSize: 11, color: '#888' }}>Clique para alterar a foto</span>
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <input value={edicaoUsuario.nome} onChange={e => setEdicaoUsuario(p => ({ ...p, nome: e.target.value }))} placeholder="Nome"
                          style={{ flex: 1, minWidth: 160, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                        <input value={edicaoUsuario.cargo} onChange={e => setEdicaoUsuario(p => ({ ...p, cargo: e.target.value }))} placeholder="Função / Cargo"
                          style={{ flex: 1, minWidth: 160, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                        <select value={edicaoUsuario.role} onChange={e => setEdicaoUsuario(p => ({ ...p, role: e.target.value }))}
                          style={{ flex: 1, minWidth: 140, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, background: '#fff', fontFamily: 'inherit' }}>
                          <option value="gerente">Gerente</option>
                          <option value="admin">Admin</option>
                          <option value="cliente">Cliente</option>
                        </select>
                        {edicaoUsuario.role === 'cliente' && (
                          <select value={(edicaoUsuario as any).clienteId || ''} onChange={e => setEdicaoUsuario(p => ({ ...p, clienteId: e.target.value }))}
                            style={{ flex: 1, minWidth: 140, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, background: '#fff', fontFamily: 'inherit' }}>
                            <option value="">Vincular a qual cliente?</option>
                            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                          </select>
                        )}
                        <div style={{ flex: 1, minWidth: 160, position: 'relative' }}>
                          <input type={verSenhaEdicao ? 'text' : 'password'} value={edicaoUsuario.novaSenha} onChange={e => setEdicaoUsuario(p => ({ ...p, novaSenha: e.target.value }))} placeholder="Redefinir senha (vazio = manter)"
                            style={{ width: '100%', padding: '10px 40px 10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                          <button type="button" onClick={() => setVerSenhaEdicao(v => !v)} title={verSenhaEdicao ? 'Ocultar senha' : 'Mostrar senha'}
                            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#999', display: 'flex', padding: 0 }}>
                            {verSenhaEdicao ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditandoUsuario(null)} style={{ padding: '9px 16px', background: '#f0f0f0', border: 'none', borderRadius: 8, fontSize: 13, color: '#666', cursor: 'pointer' }}>Cancelar</button>
                        <button onClick={() => salvarEdicaoUsuario(u.email)} style={{ padding: '9px 18px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Salvar</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONFIGURAÇÕES (admin only) */}
        {aba === 'config' && role === 'admin' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 760 }}>
            <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Configurações</h2>

            {/* Aparência — modo claro/escuro */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111' }}>Aparência</h3>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: '#999' }}>Escolha como o painel é exibido para você neste navegador.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                {(['claro', 'escuro'] as const).map(opcao => (
                  <button key={opcao} onClick={() => { if (tema !== opcao) alternarTema() }} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '14px 0', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                    border: tema === opcao ? '2px solid #111' : '1.5px solid #e0e0e0',
                    background: tema === opcao ? '#111' : '#fff',
                    color: tema === opcao ? '#ffc00f' : '#888',
                  }}>
                    {opcao === 'claro' ? <IconSun size={16} /> : <IconMoon size={16} />}
                    {opcao === 'claro' ? 'Modo claro' : 'Modo escuro'}
                  </button>
                ))}
              </div>
              <p style={{ margin: '12px 0 0', fontSize: 11, color: '#bbb' }}>
                No modo escuro, as cores da interface são invertidas — fundo escuro e textos claros — enquanto fotos e vídeos continuam exibidos com as cores naturais.
              </p>
            </div>

            {/* Dados gerais da agência */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111' }}>Dados da agência</h3>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: '#999' }}>Informações e identidade visual exibidas no sistema.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input value={configAgencia.nomeAgencia || ''} onChange={e => setConfigAgencia(p => ({ ...p, nomeAgencia: e.target.value }))} placeholder="Nome da agência"
                    style={{ flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                  <input value={configAgencia.emailContato || ''} onChange={e => setConfigAgencia(p => ({ ...p, emailContato: e.target.value }))} placeholder="E-mail de contato" type="email"
                    style={{ flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden', background: '#f5f5f5', border: '1.5px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {configAgencia.logo ? <img src={configAgencia.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 11, color: '#bbb' }}>Logo</span>}
                    </div>
                    <span style={{ fontSize: 12, color: '#666', textDecoration: 'underline' }}>{enviandoLogoAgencia ? 'Enviando...' : 'Enviar logomarca'}</span>
                    <input type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { if (e.target.files?.[0]) uploadLogoAgencia(e.target.files[0]); e.target.value = '' }} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#666' }}>
                    Cor primária
                    <input type="color" value={configAgencia.corPrimaria || '#ffc00f'} onChange={e => setConfigAgencia(p => ({ ...p, corPrimaria: e.target.value }))}
                      style={{ width: 36, height: 32, border: '1px solid #e0e0e0', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#666' }}>
                    Cor secundária
                    <input type="color" value={configAgencia.corSecundaria || '#111111'} onChange={e => setConfigAgencia(p => ({ ...p, corSecundaria: e.target.value }))}
                      style={{ width: 36, height: 32, border: '1px solid #e0e0e0', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                  </label>
                  <button onClick={salvarConfigAgencia} disabled={salvandoConfig}
                    style={{ marginLeft: 'auto', padding: '10px 20px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: salvandoConfig ? 0.6 : 1 }}>
                    {salvandoConfig ? 'Salvando...' : 'Salvar alterações'}
                  </button>
                </div>
                {configMsg && (
                  <p style={{ margin: 0, fontSize: 12, color: configMsg.includes('sucesso') ? '#16a34a' : '#ef4444' }}>{configMsg}</p>
                )}
              </div>
            </div>

            {/* Créditos da IA (Anthropic) */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111' }}>Créditos da IA (Anthropic)</h3>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: '#999' }}>
                Saldo estimado da API usada na geração de documentos. A Anthropic não informa o saldo real — cadastre aqui o valor atual (veja em console.anthropic.com) e o sistema desconta automaticamente a cada documento gerado, avisando só os ADMINs quando estiver acabando.
              </p>
              {saldoIA.saldo <= saldoIA.limite && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#b91c1c', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconAlert size={16} /> Saldo estimado baixo (US$ {Number(saldoIA.saldo).toFixed(2)}). Adicione créditos e atualize o valor abaixo.
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Saldo atual (US$)</label>
                  <input type="number" step="0.01" min="0" value={saldoIA.saldo}
                    onChange={e => setSaldoIA(s => ({ ...s, saldo: parseFloat(e.target.value) }))}
                    style={{ padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, width: 140, fontFamily: 'inherit' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Avisar abaixo de (US$)</label>
                  <input type="number" step="0.01" min="0" value={saldoIA.limite}
                    onChange={e => setSaldoIA(s => ({ ...s, limite: parseFloat(e.target.value) }))}
                    style={{ padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, width: 140, fontFamily: 'inherit' }} />
                </div>
                <button onClick={salvarSaldoIA} disabled={salvandoSaldoIA}
                  style={{ padding: '10px 20px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: salvandoSaldoIA ? 0.6 : 1 }}>
                  {salvandoSaldoIA ? 'Salvando...' : 'Salvar saldo'}
                </button>
                {saldoIAMsg && <span style={{ fontSize: 12, color: saldoIAMsg.includes('Erro') ? '#ef4444' : '#16a34a', fontWeight: 600 }}>{saldoIAMsg}</span>}
              </div>
            </div>

            {/* Imagem de perfil dos clientes */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111' }}>Imagem de perfil dos clientes</h3>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: '#999' }}>Defina a foto de perfil de cada cliente — exibida nas pré-visualizações e listagens.</p>
              {clientes.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: '#aaa' }}>Nenhum cliente cadastrado ainda.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {clientes.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: '#fafafa', borderRadius: 10 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', background: '#eee', border: '1.5px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, color: '#bbb', fontSize: 16 }}>
                        {c.logo ? <img src={c.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (c.nome || '?')[0]?.toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>@{c.instagram?.replace(/^@/, '')}</p>
                      </div>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: '#111', color: '#fff', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, flexShrink: 0, opacity: fotoClienteId === c.id ? 0.6 : 1 }}>
                        {fotoClienteId === c.id ? 'Enviando...' : (c.logo ? 'Trocar imagem' : 'Enviar imagem')}
                        <input type="file" accept="image/*" style={{ display: 'none' }} disabled={fotoClienteId === c.id}
                          onChange={e => { if (e.target.files?.[0]) uploadFotoCliente(c.id, e.target.files[0]); e.target.value = '' }} />
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Integrações */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111' }}>Integrações</h3>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: '#999' }}>Status das conexões usadas pelo sistema.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fafafa', borderRadius: 10 }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: '#111' }}>Meta (Facebook / Instagram)</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>
                      {clientes.filter(c => c.metaConectado).length} de {clientes.length} cliente(s) com Instagram conectado
                    </p>
                  </div>
                  <button onClick={() => setAba('clientes')}
                    style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Gerenciar conexões
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fafafa', borderRadius: 10 }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: '#111' }}>Armazenamento de mídia (Vercel Blob)</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>Usado para upload direto de imagens e vídeos nos posts</p>
                  </div>
                  <span style={{ background: '#dcfce7', color: '#16a34a', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>Ativo</span>
                </div>
              </div>
            </div>

            {/* Contas sociais conectadas */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111' }}>Contas sociais conectadas</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#999' }}>Perfis de Facebook e Instagram vinculados aos clientes.</p>
                </div>
                <button onClick={() => setConectarRedesCliente('')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#111', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                  <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> Conectar redes
                </button>
              </div>

              {clientes.filter(c => c.metaConectado).length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: '#aaa' }}>Nenhuma conta conectada ainda. Use "Conectar redes" para vincular um perfil.</p>
              ) : (
                <div style={{ border: '1px solid #eee', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 44px', gap: 8, padding: '10px 14px', background: '#fafafa', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    <span>Conta social</span><span>Status</span><span>Tipo</span><span></span>
                  </div>
                  {clientes.filter(c => c.metaConectado).flatMap(c => ([
                    ...(c.facebookPageId ? [{ c, rede: 'facebook' as const, label: c.nome, tipo: 'Página', sub: 'Facebook' }] : []),
                    ...((c.instagramConectado || c.instagramUserId || c.instagramUsername) ? [{ c, rede: 'instagram' as const, label: c.instagramUsername ? `@${c.instagramUsername}` : (c.instagram?.replace(/^@/, '') || c.nome), tipo: 'Profissional', sub: 'Instagram' }] : []),
                  ])).map((row, i) => (
                    <div key={row.c.id + row.rede} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 44px', gap: 8, alignItems: 'center', padding: '12px 14px', borderTop: '1px solid #f0f0f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{ position: 'relative', width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: '#eee', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#bbb', fontSize: 13 }}>
                          {row.c.logo ? <img src={row.c.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (row.c.nome[0]?.toUpperCase())}
                          <span style={{ position: 'absolute', bottom: -2, right: -2, width: 15, height: 15, borderRadius: '50%', background: row.rede === 'facebook' ? '#1877f2' : '#dc2743', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
                            <svg width="7" height="7" viewBox="0 0 24 24" fill="#fff">{row.rede === 'facebook'
                              ? <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                              : <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8z"/>}</svg>
                          </span>
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</p>
                          <p style={{ margin: 0, fontSize: 11, color: '#aaa' }}>{row.sub} · {row.c.nome}</p>
                        </div>
                      </div>
                      <span><span style={{ background: '#dcfce7', color: '#16a34a', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>Conectado</span></span>
                      <span style={{ fontSize: 13, color: '#666' }}>{row.tipo}</span>
                      {(row.rede === 'facebook' || !row.c.facebookPageId) ? (
                        <button onClick={() => { if (confirm(`Desconectar as contas de ${row.c.nome}?`)) desconectarInstagram(row.c.id) }} title="Desconectar"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, display: 'flex', alignItems: 'center' }}><IconTrash size={15} /></button>
                      ) : <span />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notificações */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111' }}>Notificações por e-mail</h3>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: '#999' }}>
                Envio automático de e-mails (ex: ao gerar link de aprovação) usa um servidor SMTP configurado nas variáveis de ambiente da Vercel.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fafafa', borderRadius: 10 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: '#111' }}>Servidor SMTP</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>Para alterar host, usuário ou senha, edite as variáveis SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS na Vercel</p>
                </div>
                <span style={{ background: '#dcfce7', color: '#16a34a', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>Configurado</span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: 12, color: '#bbb', textAlign: 'center' }}>
              Para editar ou remover clientes e colaboradores, use as abas <strong>Clientes</strong> e <strong>Usuários</strong> — agora com botões de Editar/Excluir em cada item.
            </p>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
