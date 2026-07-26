'use client'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ABAS_PERM, ACOES_PERM, podeAbaGranular, podeAcaoGranular } from '@/lib/permissoesGranular'
// Abas escondidas de TODOS os papéis conforme o perfil da instância (nav + guarda).
// A regra vive em lib/perfisInstanciaCatalogo.ts, com testes.
import { abasOcultasDoPerfil as abasOcultas, PERFIS as PERFIS_INSTANCIA } from '@/lib/perfisInstanciaCatalogo'
import { MODULOS, MODULOS_PAGOS, totalMensalModulos } from '@/lib/modulos'
import { apareceNoPlanner } from '@/lib/plannerFiltro'
import { PAPEIS_SQUAD } from '@/lib/squadPapeis'
import Calendar from '../components/Calendar'
import PostComposer from '../components/PostComposer'
import ConectarRedesModal from '../components/ConectarRedesModal'
import UploadProgress from '../components/UploadProgress'
import NotificacoesConfig from '../components/NotificacoesConfig'
import OperacionalConfig from '../components/OperacionalConfig'
import SaudeSistema from '../components/SaudeSistema'
import LgpdCliente from '../components/LgpdCliente'
import AvatarCliente from '../components/AvatarCliente'
import { podeNivel, normalizaNivel, gruposDoPerfil, NIVEIS as PERM_NIVEIS } from '@/lib/permissoesCatalogo'
import { fecharFora } from '@/lib/fecharModal'

const ChatInterno = dynamic(() => import('../components/ChatInterno'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const StudioMes = dynamic(() => import('../components/StudioMes'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const DashboardHome = dynamic(() => import('../components/DashboardHome'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const GestaoTarefas = dynamic(() => import('../components/GestaoTarefas'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const Playbook = dynamic(() => import('../components/Playbook'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const MinhaConta = dynamic(() => import('../components/MinhaConta'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const Briefings = dynamic(() => import('../components/Briefings'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const Candidaturas = dynamic(() => import('../components/Candidaturas'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const Rentabilidade = dynamic(() => import('../components/Rentabilidade'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const Modelos = dynamic(() => import('../components/Modelos'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const Automacoes = dynamic(() => import('../components/Automacoes'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const Agentes = dynamic(() => import('../components/Agentes'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const Procedimentos = dynamic(() => import('../components/Procedimentos'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const Documentos = dynamic(() => import('../components/Documentos'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const DashboardVendas = dynamic(() => import('../components/DashboardVendas'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const MapasMentais = dynamic(() => import('../components/MapasMentais'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const MeuDia = dynamic(() => import('../components/MeuDia'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const PersonalList = dynamic(() => import('../components/PersonalList'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const CRM = dynamic(() => import('../components/CRM'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const LogsCliente = dynamic(() => import('../components/LogsCliente'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const CargaEquipe = dynamic(() => import('../components/CargaEquipe'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const RelatorioMensalEditor = dynamic(() => import('../components/RelatorioMensalEditor'), { ssr: false })
const PlaybookBotao = dynamic(() => import('../components/BrandPlaybook'), { ssr: false })
const ReferenciasVisuais = dynamic(() => import('../components/ReferenciasVisuais'), { ssr: false })
const FontesMarca = dynamic(() => import('../components/FontesMarca'), { ssr: false })
const Agenda = dynamic(() => import('../components/Agenda'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const Reunioes = dynamic(() => import('../components/Reunioes'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const Frota = dynamic(() => import('../components/Frota'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const Viagens = dynamic(() => import('../components/Viagens'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const CalendarioViagens = dynamic(() => import('../components/CalendarioViagens'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const Reservas = dynamic(() => import('../components/Reservas'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const Processos = dynamic(() => import('../components/Processos'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const Produtos = dynamic(() => import('../components/Produtos'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const Vendas = dynamic(() => import('../components/Vendas'), { ssr: false, loading: () => <LoadingPlaceholder /> })
const WhatsAppConexao = dynamic(() => import('../components/WhatsAppConexao'), { ssr: false })
const PermissoesGranular = dynamic(() => import('../components/PermissoesGranular'), { ssr: false })
// Modal de tarefa standalone (aberto ao clicar numa notificação de tarefa, sem trocar de aba)
const TarefaModalNotif = dynamic(() => import('../components/GestaoTarefas').then(m => ({ default: m.TarefaModal })), { ssr: false })

// Acompanha o status da publicacao pelo proprio post (resiliente a requisicoes longas:
// Reels demoram e a conexao do navegador pode cair antes do servidor terminar).
async function acompanharPublicacao(id: string): Promise<{ ok: boolean; error?: string }> {
  for (let i = 0; i < 75; i++) { // ~5 min (75 x 4s)
    await new Promise(r => setTimeout(r, 4000))
    const p = await fetch(`/api/posts?id=${id}`).then(r => r.json()).catch(() => null)
    if (p?.status === 'publicado') return { ok: true }
    if (p?.status === 'falha_publicacao') return { ok: false, error: p.erroPublicacao || 'falha na publicação' }
  }
  return { ok: false, error: 'A publicação está demorando mais que o normal (Reels podem demorar). Aguarde alguns instantes e confira se o post foi publicado antes de tentar de novo.' }
}

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
import { toast, confirmar } from '@/lib/toast'
import { setViewAsClient } from '@/lib/modoCliente'

type Post = { id: string; clienteId?: string; clienteNome: string; status: string; dataAgendada?: string; legenda: string; imagens: string[]; codigo?: string; formato?: string; erroPublicacao?: string; criadoEm?: string; atualizadoEm?: string; thumbnail?: string }
type Cliente = { id: string; nome: string; instagram: string; metaConectado?: boolean; instagramUsername?: string; instagramConectado?: boolean; instagramUserId?: string; facebookPageId?: string; loginEmail?: string; loginSenha?: string; logo?: string; corPrimaria?: string; corSecundaria?: string; tipo?: 'cliente' | 'interno'; entregaveis?: string[]; postsMensais?: number; contratoValor?: number; contratoInicio?: string; contratoRenovacao?: string; contratoCiclo?: 'mensal' | 'trimestral' | 'semestral' | 'anual'; diaVencimento?: number; receitasAvulsas?: { id: string; mes: string; valor: number; descricao?: string }[]; segmento?: string; palavrasChave?: string; descricao?: string; publicoAlvo?: string; tomDeVoz?: string; preferencias?: string; documentos?: { nome: string; url: string }[]; permissoes?: { entregas?: boolean; aprovacoes?: boolean; aprovar?: boolean; solicitar?: boolean; esteira?: boolean; planner?: boolean }; handoffVendas?: string; squad?: string[] }
type ConfigAgencia = { nomeAgencia: string; emailContato?: string; logo?: string; corPrimaria?: string; corSecundaria?: string; recrutamentoLogo?: string; recrutamentoTitulo?: string; recrutamentoSubtitulo?: string; recrutamentoDescricao?: string; recrutamentoMensagemFinalTitulo?: string; recrutamentoMensagemFinal?: string; recrutamentoVagas?: string[] }
type MetaPage = { pageId: string; pageName: string; pageToken: string | null; igToken?: string; igUserId?: string; instagram: { id: string; username: string; profilePic?: string } | null }

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  agendado: 'Agendado',
  aguardando_aprovacao: 'Aguardando',
  aprovado: 'Aprovado',
  corrigir: 'Corrigir',
  reprovado: 'Reprovado',
  publicando: 'Publicando...',
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
  publicando: '#dbeafe',
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
  publicando: '#1d4ed8',     // azul
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
  { key: 'google_meu_negocio', label: 'Google Meu Negócio' },
  { key: 'hospedagem', label: 'Hospedagem / servidor de páginas' },
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

// Ícone (path único) por aba do menu — usado no modo recolhido (rail) e expandido.
const ICONE_ABA: Record<string, string> = {
  agentes: 'M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  documentos: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8M8 9h2',
  conversao: 'M3 3v18h18M18 9l-5 5-3-3-4 4',
  mapas: 'M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM9 6h6a3 3 0 0 1 3 3v6M6 9v6',
  'meu-dia': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM8 12l2.5 2.5L16 9',
  'lista-pessoal': 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12l2 2 4-4',
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  tarefas: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  esteira: 'M3 4h7v7H3zM14 13h7v7h-7zM10 7.5h4a3 3 0 0 1 3 3V13M14 16.5H7a3 3 0 0 1-3-3V11',
  studio: 'M3 3h18v18H3zM3 9h18M9 9v12M3 15h6',
  agenda: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 16l2 2 4-4',
  procedimentos: 'M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1zM8 5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 12h6M9 16h4',
  carga: 'M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  reunioes: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 15l2 2 4-4',
  playbook: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5z',
  campanhas: 'M3 11l18-5v12L3 14v-3zM11.6 16.8a3 3 0 1 1-5.8-1.6',
  modelos: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  automacoes: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  inbox: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  mensagens: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  rentabilidade: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  config: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM19.4 13a7.5 7.5 0 0 0 0-2l2-1.5-2-3.5-2.3 1a7.5 7.5 0 0 0-1.7-1L15 2H9l-.4 2.5a7.5 7.5 0 0 0-1.7 1l-2.3-1-2 3.5L4.6 11a7.5 7.5 0 0 0 0 2l-2 1.5 2 3.5 2.3-1a7.5 7.5 0 0 0 1.7 1L9 22h6l.4-2.5a7.5 7.5 0 0 0 1.7-1l2.3 1 2-3.5z',
  clientes: 'M20 7h-4V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM10 5h4v2h-4z',
  usuarios: 'M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  candidaturas: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6',
  recrutamento: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8',
  planner: 'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18',
  aprovacoes: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  marca: 'M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L7.7 21l2.3-7.4-6-4.6h7.6z',
  listening: 'M22 12h-4l-3 9L9 3l-3 9H2',
  analytics: 'M3 3v18h18M7 14v4M12 9v9M17 5v13',
  crm: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  frota: 'M4 17V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11M4 17h16M4 17v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2M20 17v2a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-2M5 8h14M5 12h14M9 8v4M15 8v4',
  viagens: 'M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zM12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  'calendario-viagens': 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM7 14h6M7 18h10',
  reservas: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4zM14 5v14',
  default: 'M5 12h14',
}

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
    }).then(x => x.json()).catch(() => ({ error: 'Erro de conexão' }))
    if (r?.semData) { toast('Defina a data e horario da postagem antes de aprovar o criativo.', 'erro'); setEnviando(null); return }
    if (r?.error) { toast(r.error, 'erro'); setEnviando(null); return }
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
                      {cli?.logo && (
                        <span style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', background: '#f0f0f0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10, color: '#111', flexShrink: 0 }}>
                          <AvatarCliente logo={cli.logo} nome={p.clienteNome} />
                        </span>
                      )}
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
        <div onClick={fecharFora(() => setRejeitar(null))} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 440, width: '100%', padding: 22 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#b91c1c' }}>Rejeitar {rejeitar.ehCopy ? 'copy' : 'criativo'}</h3>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: '#888' }}>Informe o motivo da rejeição. O criativo voltará para a equipe com esta justificativa.</p>
            <textarea value={motivoRejeicao} onChange={e => setMotivoRejeicao(e.target.value)} placeholder="Motivo da rejeição..."
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
  const [aba, setAbaRaw] = useState<'home' | 'posts' | 'planner' | 'calendario' | 'biblioteca' | 'clientes' | 'usuarios' | 'novo-post' | 'config' | 'analytics' | 'mensagens' | 'marca' | 'listening' | 'esteira' | 'studio' | 'agenda' | 'aprovacoes' | 'tarefas' | 'playbook' | 'minha-conta' | 'inbox' | 'campanhas' | 'candidaturas' | 'recrutamento' | 'rentabilidade' | 'modelos' | 'automacoes' | 'meu-dia' | 'lista-pessoal' | 'carga' | 'crm' | 'agentes' | 'documentos' | 'conversao' | 'mapas' | 'solicitacoes' | 'reunioes' | 'frota' | 'viagens' | 'calendario-viagens' | 'reservas' | 'recebiveis' | 'procedimentos' | 'processos' | 'produtos' | 'vendas'>(() => {
    if (typeof window !== 'undefined') {
      const salva = sessionStorage.getItem('soma10_aba')
      if (salva === 'esteira') return 'studio' // Esteira removida — abre o Studio
      if (salva === 'producao') return 'studio' // aba Produção fundida no Studio
      if (salva) return salva as any
    }
    return 'home'
  })
  // Guarda a aba de onde o editor (novo-post) foi aberto, p/ o "Voltar" retornar lá.
  const abaAntesComposer = useRef<typeof aba>('planner')
  // Espelho do que está no compositor AGORA (PostComposer > aoMudar). Ref, não
  // state: isto muda a cada tecla e não pode re-renderizar o dashboard inteiro.
  const composerValor = useRef<any>(null)
  const setAba = (a: typeof aba) => {
    if (a === 'novo-post' && aba !== 'novo-post') abaAntesComposer.current = aba
    setAbaRaw(a); if (typeof window !== 'undefined') sessionStorage.setItem('soma10_aba', a)
  }
  // Motion: re-dispara a entrada do conteúdo a cada troca de aba SEM remount
  // (key={aba} remontaria a árvore e perderia estado/dados das telas). O reflow
  // faz o navegador esquecer a animação anterior e reiniciá-la via classe.
  const abaAnimRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = abaAnimRef.current
    if (!el) return
    el.classList.remove('anim-aba')
    void el.offsetWidth
    el.classList.add('anim-aba')
  }, [aba])
  const [listeningData, setListeningData] = useState<any>(null)
  const [listeningLoading, setListeningLoading] = useState(false)
  const [plannerView, setPlannerView] = useState<'lista' | 'calendario'>(() => (typeof window !== 'undefined' && sessionStorage.getItem('soma10_plannerView') === 'calendario') ? 'calendario' : 'lista')
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
  const [relatorioEditor, setRelatorioEditor] = useState<any>(null)

  const [configAgencia, setConfigAgencia] = useState<ConfigAgencia>({ nomeAgencia: 'Soma10 Approval', corPrimaria: '#ffc00f', corSecundaria: '#111111' })
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  // Hub de Configurações em abas
  const [abaConfig, setAbaConfig] = useState<'geral' | 'operacional' | 'notificacoes' | 'integracoes' | 'permissoes' | 'sistema'>('geral')
  const [resyncFotos, setResyncFotos] = useState(false)
  async function ressincronizarFotos() {
    if (!(await confirmar('Rebuscar as fotos de perfil dos clientes conectados e salvá-las de forma permanente? Corrige as imagens que quebram por expirarem no Instagram.', { titulo: 'Re-sincronizar fotos', okLabel: 'Re-sincronizar' }))) return
    setResyncFotos(true)
    const r = await fetch('/api/clientes/resync-fotos', { method: 'POST' }).then(x => x.json()).catch(() => null)
    setResyncFotos(false)
    if (r?.ok) {
      toast(`${r.atualizados} foto(s) atualizada(s)${r.falhas ? ` · ${r.falhas} falha(s)` : ''}.`, 'sucesso')
      fetch('/api/clientes').then(x => x.json()).then(d => { if (Array.isArray(d)) setClientes(d) }).catch(() => {})
    } else toast(r?.error || 'Falha ao re-sincronizar.', 'erro')
  }
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
  const [edicaoUsuario, setEdicaoUsuario] = useState<{ nome: string; role: string; novaSenha: string; cargo: string; foto: string; custoHora?: number; salarioFixo?: number; valorPorProjeto?: number; qtdProjetos?: number }>({ nome: '', role: 'gerente', novaSenha: '', cargo: '', foto: '' })
  const [bibBusca, setBibBusca] = useState('')
  // Cliente e status do Planner PERSISTEM ao atualizar (mesma aba/mesmo cliente).
  const [bibCliente, setBibCliente] = useState(() => (typeof window !== 'undefined' && sessionStorage.getItem('soma10_bibCliente')) || '')
  const [bibStatus, setBibStatus] = useState(() => (typeof window !== 'undefined' && sessionStorage.getItem('soma10_bibStatus')) || '')
  useEffect(() => { if (typeof window !== 'undefined') sessionStorage.setItem('soma10_plannerView', plannerView) }, [plannerView])
  useEffect(() => { if (typeof window !== 'undefined') sessionStorage.setItem('soma10_bibCliente', bibCliente) }, [bibCliente])
  useEffect(() => { if (typeof window !== 'undefined') sessionStorage.setItem('soma10_bibStatus', bibStatus) }, [bibStatus])
  const [bibSelecionados, setBibSelecionados] = useState<string[]>([])
  const [avisoFalhaOculto, setAvisoFalhaOculto] = useState(false)
  const [postPreview, setPostPreview] = useState<Post | null>(null)
  const [progImagem, setProgImagem] = useState<number | null>(null)
  const [postPreviewSlide, setPostPreviewSlide] = useState(0)
  const [postLegendaExpandida, setPostLegendaExpandida] = useState(false)
  useEffect(() => { setPostPreviewSlide(0); setPostLegendaExpandida(false) }, [postPreview])
  const [verComoClienteId, setVerComoClienteIdRaw] = useState(() => (typeof window !== 'undefined' ? sessionStorage.getItem('soma10_clienteId') || '' : ''))
  const setVerComoClienteId = (id: string) => { setVerComoClienteIdRaw(id); if (typeof window !== 'undefined') sessionStorage.setItem('soma10_clienteId', id) }
  // Varejo (telefonia): loja em foco no seletor lateral. '' = Todas (rede/consolidado).
  const [verComoLojaId, setVerComoLojaIdRaw] = useState(() => (typeof window !== 'undefined' ? sessionStorage.getItem('soma10_lojaId') || '' : ''))
  const setVerComoLojaId = (id: string) => { setVerComoLojaIdRaw(id); if (typeof window !== 'undefined') { if (id) sessionStorage.setItem('soma10_lojaId', id); else sessionStorage.removeItem('soma10_lojaId') } }
  // "Visualizar como" um PAPEL (admin prevê a visão de um colaborador gerente/usuário)
  const [verComoPapel, setVerComoPapelRaw] = useState<'' | 'gerente' | 'usuario'>(() => (typeof window !== 'undefined' ? (sessionStorage.getItem('soma10_verComoPapel') as any) || '' : ''))
  const setVerComoPapel = (p: '' | 'gerente' | 'usuario') => { setVerComoPapelRaw(p); if (typeof window !== 'undefined') sessionStorage.setItem('soma10_verComoPapel', p) }
  const [buscaCliente, setBuscaCliente] = useState('')
  const [clientesAberto, setClientesAberto] = useState(false)
  const [composerPrefill, setComposerPrefill] = useState<any>(null)
  const [composerKey, setComposerKey] = useState(0)
  const [criandoPost, setCriandoPost] = useState(false)
  const [salvandoRascunho, setSalvandoRascunho] = useState(false)
  const [rascunhoMsg, setRascunhoMsg] = useState('')
  const [linkAprovModal, setLinkAprovModal] = useState<{ url: string; cliente: string } | null>(null) // compartilhar link ao enviar p/ aprovação
  const [editandoPostId, setEditandoPostId] = useState<string | null>(null)
  const [visualizacaoPosts, setVisualizacaoPosts] = useState<'lista' | 'calendario' | 'fluxo'>('lista')
  const [tarefaAbrirId, setTarefaAbrirId] = useState<string | null>(null)
  const [mostrarFormCliente, setMostrarFormCliente] = useState(false)
  // #7 — tela de Clientes: visao lista/blocos + expandir detalhes ao clicar
  const [clientesView, setClientesView] = useState<'lista' | 'blocos'>(() => (typeof window !== 'undefined' && localStorage.getItem('clientesView') === 'blocos') ? 'blocos' : 'lista')
  const [clienteAberto, setClienteAberto] = useState<string | null>(null)
  const [clienteBusca, setClienteBusca] = useState('')
  const [clienteFiltro, setClienteFiltro] = useState<'todos' | 'renovar' | 'sem_conexao' | 'com_addon' | 'suspenso'>('todos')
  const [stripeOn, setStripeOn] = useState(false)
  useEffect(() => { fetch('/api/stripe/cobrar').then(r => r.json()).then(d => setStripeOn(!!d?.configurado)).catch(() => {}) }, [])
  const [novoCliente, setNovoCliente] = useState<{ nome: string; instagram: string; loginEmail: string; logo?: string; corPrimaria?: string; corSecundaria?: string; tipo?: string; entregaveis?: string[]; postsMensais?: number; contratoValor?: number; contratoInicio?: string; contratoRenovacao?: string; contratoCiclo?: string; receitasAvulsas?: { id: string; mes: string; valor: number; descricao?: string }[] }>({ nome: '', instagram: '', loginEmail: '', corPrimaria: '#ffc00f', corSecundaria: '#111111', tipo: 'cliente', entregaveis: [], postsMensais: 12, receitasAvulsas: [] })
  const [enviandoLogoNovoCliente, setEnviandoLogoNovoCliente] = useState(false)
  const [credenciaisGeradas, setCredenciaisGeradas] = useState<{ nome: string; email: string; senha: string } | null>(null)
  const [erroCliente, setErroCliente] = useState('')
  const [novoUsuario, setNovoUsuario] = useState({ nome: '', email: '', senha: '', role: 'gerente', cargo: '', custoHora: 0, salarioFixo: 0, valorPorProjeto: 0, qtdProjetos: 0 })
  // Resumo semanal do cliente (WhatsApp + e-mail)
  const [resumoCliente, setResumoCliente] = useState<string | null>(null)
  const [resumoTexto, setResumoTexto] = useState('')
  const [resumoInfo, setResumoInfo] = useState<{ publicados: number; aguardando: number; proximos: number; emailCliente: string } | null>(null)
  const [resumoCarregando, setResumoCarregando] = useState(false)
  const [enviandoResumo, setEnviandoResumo] = useState(false)
  const [resumoMsg, setResumoMsg] = useState('')
  // Predefinicoes (templates) do resumo semanal
  type ResumoPreset = { id: string; nome: string; intro: string; fechamento: string }
  const [resumoTemplates, setResumoTemplates] = useState<ResumoPreset[]>([])
  const [resumoTemplateId, setResumoTemplateId] = useState('')
  const [gerirPresets, setGerirPresets] = useState(false)
  const [salvandoPresets, setSalvandoPresets] = useState(false)
  async function gerarResumoTexto(clienteId: string, templateId: string) {
    setResumoCarregando(true); setResumoMsg('')
    const q = `clienteId=${clienteId}${templateId ? `&templateId=${templateId}` : ''}`
    const r = await fetch(`/api/resumo-semanal?${q}`).then(x => x.json()).catch(() => null)
    setResumoCarregando(false)
    if (r?.texto !== undefined) { setResumoTexto(r.texto); setResumoInfo({ publicados: r.publicados, aguardando: r.aguardando, proximos: r.proximos, emailCliente: r.emailCliente || '' }) }
    else setResumoMsg('Não foi possível gerar o resumo.')
  }
  async function abrirResumo(clienteId: string) {
    setResumoCliente(clienteId); setResumoTexto(''); setResumoInfo(null); setResumoMsg('')
    fetch('/api/resumo-templates').then(r => r.json()).then(d => setResumoTemplates(Array.isArray(d) ? d : [])).catch(() => {})
    gerarResumoTexto(clienteId, resumoTemplateId)
  }
  function aplicarTemplateResumo(id: string) {
    setResumoTemplateId(id)
    if (resumoCliente) gerarResumoTexto(resumoCliente, id)
  }
  async function salvarPresetsResumo() {
    setSalvandoPresets(true)
    const r = await fetch('/api/resumo-templates', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templates: resumoTemplates }) }).then(x => x.json()).catch(() => null)
    setSalvandoPresets(false)
    if (r?.ok) { setResumoTemplates(r.templates); setResumoMsg('Predefinições salvas.') }
    else setResumoMsg('Falha ao salvar predefinições.')
  }
  async function enviarResumoEmail() {
    if (!resumoCliente || enviandoResumo) return
    setEnviandoResumo(true); setResumoMsg('')
    const r = await fetch('/api/resumo-semanal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId: resumoCliente, templateId: resumoTemplateId || undefined }) }).then(x => x.json()).catch(() => null)
    setEnviandoResumo(false)
    setResumoMsg(r?.ok ? 'Resumo enviado por e-mail ao cliente!' : (r?.error || 'Falha ao enviar e-mail.'))
  }
  // Lançamento de cobrança avulsa/modular no form de cliente
  const [avMes, setAvMes] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)
  const [avValor, setAvValor] = useState('')
  const [avDesc, setAvDesc] = useState('')
  const [mostrarFormUsuario, setMostrarFormUsuario] = useState(false)
  const [verSenhaNovo, setVerSenhaNovo] = useState(false)
  const [verSenhaEdicao, setVerSenhaEdicao] = useState(false)
  const [erroUsuario, setErroUsuario] = useState('')
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [permPapel, setPermPapel] = useState<Record<string, Record<string, boolean>>>({})
  const [permGranular, setPermGranular] = useState<any>({})
  // Perfil da instância (clinica/gestao/null=agência) — adapta home, CRM e Agenda
  const [perfilInstancia, setPerfilInstancia] = useState<string | null>(null)
  const perfilClinica = perfilInstancia === 'clinica'
  const perfilTurismo = perfilInstancia === 'turismo'
  const perfilCidadania = perfilInstancia === 'cidadania'
  const perfilTelefonia = perfilInstancia === 'telefonia'
  // Lojas do varejo (perfil telefonia) — usadas no form de colaborador para
  // vincular o operador a uma unidade (isolamento; ver lib/escopoLoja).
  const [lojasTel, setLojasTel] = useState<{ id: string; nome: string; evolutionInstance?: string }[]>([])
  const [waLojaAberta, setWaLojaAberta] = useState('') // conexão WhatsApp: uma loja por vez (acordeão)
  useEffect(() => { if (perfilTelefonia) fetch('/api/lojas').then(r => r.json()).then(d => setLojasTel(Array.isArray(d) ? d : [])).catch(() => {}) }, [perfilTelefonia])
  const ocultas = abasOcultas(perfilInstancia)
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
  const [metaComoNova, setMetaComoNova] = useState(false) // OAuth voltou pedindo perfil ADICIONAL
  const [vinculandoPagina, setVinculandoPagina] = useState('')
  const [conectarRedesCliente, setConectarRedesCliente] = useState<string | null>(null)
  const [conectarComoNova, setConectarComoNova] = useState(false) // abrir a conexão em modo "perfil adicional"
  // Notificações
  const [notificacoes, setNotificacoes] = useState<any[]>([])
  const [inboxAberto, setInboxAberto] = useState(false)
  // Biblioteca = arquivo: carrega o histórico COMPLETO (sem a janela de 120 dias) uma vez
  const histCarregadoRef = useRef(false)
  useEffect(() => {
    if (aba === 'biblioteca' && !histCarregadoRef.current && status === 'authenticated' && (session?.user as any)?.role !== 'cliente') {
      histCarregadoRef.current = true
      fetch('/api/posts?tudo=1').then(r => r.json()).then(d => { if (Array.isArray(d)) setPosts(d) }).catch(() => {})
    }
  }, [aba, status])
  // Sidebar recolhida (rail só com ícones) — preferência lembrada entre sessões
  const [recolhida, setRecolhida] = useState(false)
  useEffect(() => { try { setRecolhida(localStorage.getItem('sidebarRecolhida') === '1') } catch {} }, [])
  function alternarRecolhida() { setRecolhida(v => { const n = !v; try { localStorage.setItem('sidebarRecolhida', n ? '1' : '0') } catch {}; return n }) }
  // Responsivo: no celular a sidebar vira drawer (menu hamburguer)
  const [mobile, setMobile] = useState(false)
  const [menuMobile, setMenuMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const apply = () => setMobile(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  // No mobile o drawer mostra o menu completo (nao o rail recolhido)
  useEffect(() => { if (mobile && recolhida) setRecolhida(false) }, [mobile, recolhida])
  // Fecha o drawer ao trocar de aba
  useEffect(() => { setMenuMobile(false) }, [aba])
  // Modo escuro: mantém botões amarelos AMARELOS (texto branco). O filtro de inversão
  // deixaria-os marrons; marcamos por cor computada (#ffc00f) e a classe .btn-amarelo
  // os re-inverte de volta. Reaplica via MutationObserver (modais/listas que surgem).
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (tema !== 'escuro') { document.querySelectorAll('.btn-amarelo').forEach(b => b.classList.remove('btn-amarelo')); return }
    const marcar = () => {
      document.querySelectorAll('button').forEach(b => {
        const amarelo = getComputedStyle(b).backgroundColor === 'rgb(255, 192, 15)'
        if (amarelo) b.classList.add('btn-amarelo')
        else if (b.classList.contains('btn-amarelo')) b.classList.remove('btn-amarelo')
      })
    }
    let raf = 0
    const agendar = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(marcar) }
    marcar()
    const obs = new MutationObserver(agendar)
    obs.observe(document.body, { childList: true, subtree: true })
    return () => { obs.disconnect(); cancelAnimationFrame(raf) }
  }, [tema])
  // Notificação aberta em modal (sem sair do Inbox)
  const [notifAberta, setNotifAberta] = useState<any | null>(null)
  // Tarefa aberta em modal a partir de uma notificação (sobreposto, sem trocar de aba)
  const [tarefaNotif, setTarefaNotif] = useState<any | null>(null)
  const [carregandoTarefaNotif, setCarregandoTarefaNotif] = useState(false)
  // Busca a tarefa pelo id e abre o modal por cima da tela atual (mantém o usuário nas notificações)
  async function abrirTarefaPorId(id: string) {
    setNotifAberta(null); setInboxAberto(false)
    setCarregandoTarefaNotif(true)
    const lista = await fetch('/api/tarefas').then(r => r.json()).catch(() => [])
    setCarregandoTarefaNotif(false)
    const t = Array.isArray(lista) ? lista.find((x: any) => x.id === id) : null
    if (t) setTarefaNotif(t)
    else setAba('tarefas' as any) // fallback: tarefa não encontrada (talvez excluída)
  }
  // Abre o item relacionado a uma notificação (tarefa/post/mensagem) — usado pelo Inbox e pelo sino
  function abrirItemNotificacao(n: any) {
    setNotifAberta(null)
    if (n.tarefaId) { abrirTarefaPorId(n.tarefaId); return }
    if (n.postId) { const p = posts.find((x: any) => x.id === n.postId); if (p) { setPostPreview(p); return } }
    if (n.tipo?.startsWith('tarefa_')) { setAba('tarefas' as any); return }
    if (n.tipo === 'mensagem_privada') { setAba('mensagens' as any); return }
  }

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status])

  useEffect(() => {
    if (status !== 'authenticated') return
    const role = (session?.user as any)?.role
    const fetches: Promise<void>[] = [
      fetch('/api/clientes').then(r => r.json()).then(setClientes),
    ]
    // Vendas nao acessa a operacao: nao carrega posts da equipe
    if (role !== 'vendas') {
      fetches.push(fetch('/api/posts').then(r => r.json()).then(setPosts))
    }
    if (role === 'admin' || role === 'gerente') {
      fetches.push(fetch('/api/usuarios').then(r => r.json()).then(setUsuarios).catch(() => {}))
    } else if (role === 'vendas' || role === 'usuario') {
      // Roster seguro (sem folha) para o dropdown de dono no CRM
      fetches.push(fetch('/api/equipe').then(r => r.json()).then(setUsuarios).catch(() => {}))
    }
    // Permissões por papel: admin (edita), gerente e usuario (gateiam o menu)
    if (role === 'admin' || role === 'gerente' || role === 'usuario') {
      fetches.push(fetch('/api/permissoes-papel').then(r => r.json()).then(d => { if (d && !d.error) setPermPapel(d) }).catch(() => {}))
      fetches.push(fetch('/api/permissoes-granular').then(r => r.json()).then(d => { if (d && !d.error) setPermGranular(d) }).catch(() => {}))
    }
    if (role !== 'cliente') {
      fetches.push(fetch('/api/perfil-instancia').then(r => r.json()).then(d => { if (d && !d.error) setPerfilInstancia(d.perfil || null) }).catch(() => {}))
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
    const erro = searchParams.get('meta_error')
    if (pagesId) {
      setAba('clientes')
      setMetaClienteAlvo(searchParams.get('meta_cliente') || '')
      setMetaComoNova(searchParams.get('meta_nova') === '1')
      fetch(`/api/meta/pages?id=${encodeURIComponent(pagesId)}`)
        .then(r => r.json())
        .then(pages => { if (Array.isArray(pages)) setMetaPages(pages) })
        .catch(() => {})
    }
    if (erro) {
      setAba('clientes')
      const erros: Record<string, string> = {
        acesso_negado: 'Acesso negado. Você cancelou a autorização.',
        token_falhou: 'Não foi possível obter o token de acesso.',
        sem_paginas: 'Nenhuma Página do Facebook encontrada. Verifique se você é administrador de alguma página.',
        sem_conta_ig: 'Não foi possível identificar a conta do Instagram. Use uma conta Profissional (Business/Criador).',
        ig_nao_configurado: 'Integração do Instagram não configurada (faltam INSTAGRAM_APP_ID/SECRET na Vercel).',
        erro_interno: 'Erro interno. Tente novamente.',
      }
      setMetaErro(erros[erro] || 'Erro desconhecido.')
    }
    // Consome os params UMA vez. Sem isto a URL segue com ?meta_pages/?meta_error
    // e todo refresh re-dispara este efeito, jogando de volta em Clientes.
    if ((pagesId || erro) && typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [searchParams])

  const role = (session?.user as any)?.role
  // Seletor de loja (telefonia): só admin e gestor-da-rede (gerente sem loja fixa) trocam;
  // operador vinculado a uma loja não tem seletor (fica selado — ver lib/escopoLoja).
  const meuLojaId = (session?.user as any)?.lojaId as string | undefined
  const podeTrocarLoja = perfilTelefonia && (role === 'admin' || (role === 'gerente' && !meuLojaId))
  const clienteEmVisualizacao = clientes.find(c => c.id === verComoClienteId)
  // Regra e histórico das regressões: lib/plannerFiltro.ts (com testes).
  const postsPlanner = posts.filter(p => apareceNoPlanner(p as any))
  const postsView = verComoClienteId ? postsPlanner.filter(p => p.clienteId === verComoClienteId) : postsPlanner

  // Cliente logado: trava na visao dele, aba padrao aprovacoes
  const ehCliente = role === 'cliente'
  useEffect(() => {
    if (ehCliente && (session?.user as any)?.clienteId) {
      setVerComoClienteId((session?.user as any).clienteId)
      setAba('aprovacoes')
    }
  }, [ehCliente, session])

  // Vendas: papel isolado da operacao. So acessa CRM, Meu dia, Personal list,
  // Mensagens (direct) e a propria conta. Qualquer outra aba cai no CRM.
  const ehVendas = role === 'vendas'
  const ABAS_VENDAS = ['crm', 'conversao', 'meu-dia', 'lista-pessoal', 'mensagens', 'minha-conta']
  useEffect(() => {
    if (ehVendas && !ABAS_VENDAS.includes(aba)) setAba('crm')
  }, [ehVendas, aba])

  // Preview de papel (só admin): a NAV e as permissões passam a refletir o papel
  // escolhido; as capacidades reais do admin continuam (é só uma prévia visual).
  const previewPapel = role === 'admin' && !!verComoPapel
  const roleView = previewPapel ? verComoPapel : role
  // Permissões por papel/usuário com 3 níveis (Ver/Editar/Excluir). Admin=tudo, Financeiro só admin.
  const minhasPermissoes = previewPapel ? undefined : ((session?.user as any)?.permissoes || {})
  const podeNivelDash = (grupo: string, nivel: 'ver' | 'editar' | 'excluir' = 'ver') =>
    podeNivel(roleView, grupo as any, nivel, minhasPermissoes, permPapel as any)
  const podeGrupo = (grupo: string) => podeNivelDash(grupo, 'ver')
  // Permissões DETALHADAS (por aba + por ação) — camada adicional ao módulo.
  const minhaGranular = previewPapel ? undefined : (session?.user as any)?.permissoesGranular
  const podeAbaDash = (aba: string) => podeAbaGranular(roleView, aba, minhaGranular, permGranular)
  const podeAcaoDash = (acao: any) => podeAcaoGranular(roleView, acao, minhaGranular, permGranular)

  // Matriz de níveis reutilizável. contexto 'usuario' edita o override do usuário;
  // 'papel' edita a config do papel (permPapel).
  function matrizNiveis(r: string, perm: any, onChange: (p: any) => void, contexto: 'usuario' | 'papel', titulo: string) {
    if (r !== 'gerente' && r !== 'usuario') return null
    const efetivo = (g: string, n: 'ver' | 'editar' | 'excluir') =>
      contexto === 'usuario' ? podeNivel(r, g as any, n, perm, permPapel as any) : podeNivel(r, g as any, n, undefined, { [r]: perm } as any)
    const setNivel = (g: string, n: 'ver' | 'editar' | 'excluir', valor: boolean) =>
      onChange({ ...(perm || {}), [g]: { ...normalizaNivel(perm?.[g]), [n]: valor } })
    return (
      <div style={{ width: '100%', marginTop: 4, background: '#fafafa', borderRadius: 10, padding: 12 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{titulo}</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 6, columnGap: 12, alignItems: 'center' }}>
          <span />
          <div style={{ display: 'flex', gap: 6 }}>{PERM_NIVEIS.map(n => <span key={n.chave} style={{ width: 52, textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#aaa' }}>{n.label}</span>)}</div>
          {gruposDoPerfil(perfilInstancia).map(g => (
            <div key={g.chave} style={{ display: 'contents' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#333' }}>{g.label}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {PERM_NIVEIS.map(n => {
                  const on = efetivo(g.chave, n.chave)
                  return (
                    <button key={n.chave} type="button" onClick={() => setNivel(g.chave, n.chave, !on)}
                      style={{ width: 52, height: 28, borderRadius: 7, border: on ? '1.5px solid #16a34a' : '1.5px solid #e0e0e0', background: on ? '#16a34a' : '#fff', color: on ? '#fff' : '#bbb', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>{on ? '✓' : '—'}</button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 10.5, color: '#bbb' }}>Começa no padrão do papel; ajuste clicando. O Financeiro é exclusivo do admin.</p>
      </div>
    )
  }
  // Usado nos forms de criar/editar usuário (override do próprio usuário)
  const renderPermissoes = (r: string, perm: any, onChange: (p: any) => void) => matrizNiveis(r, perm, onChange, 'usuario', 'Permissões deste usuário')

  // Override DETALHADO por usuário (por aba + por ação). Começa no padrão do papel
  // (config:permissoesGranular) e o admin refina só o que quiser deste usuário.
  // `escopo` muda só o rodapé: 'usuario' = ajuste individual no cadastro;
  // 'papel' = padrão do papel (Configurações → Funcionalidades por papel).
  function renderGranular(r: string, perm: any, onChange: (p: any) => void, escopo: 'usuario' | 'papel' = 'usuario') {
    if (r !== 'gerente' && r !== 'usuario') return null
    const g: any = perm || {}
    const setAba = (aba: string, valor: boolean) => onChange({ ...g, abas: { ...(g.abas || {}), [aba]: valor } })
    const setAcao = (acao: string, valor: boolean) => onChange({ ...g, acoes: { ...(g.acoes || {}), [acao]: valor } })
    const Cel = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
      <button type="button" onClick={onClick}
        style={{ width: 52, height: 28, borderRadius: 7, border: on ? '1.5px solid #16a34a' : '1.5px solid #e0e0e0', background: on ? '#16a34a' : '#fff', color: on ? '#fff' : '#bbb', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>{on ? '✓' : '—'}</button>
    )
    // Só as telas que EXISTEM nesta instância: tira as ocultas pelo perfil e as
    // exclusivas de outro perfil (a clínica não precisa ver "Viagens").
    const abasVisiveis = ABAS_PERM.filter(a => !ocultas.includes(a.key) && (!a.perfil || a.perfil === perfilInstancia))
    const cats = Array.from(new Set(abasVisiveis.map(a => a.categoria)))
    return (
      <div style={{ width: '100%', marginTop: 8, background: '#fafafa', borderRadius: 10, padding: 12 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Permissões detalhadas (telas e ações)</label>
        <p style={{ margin: '0 0 6px', fontSize: 10.5, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ações</p>
        {ACOES_PERM.map(a => {
          const on = podeAcaoGranular(r, a.key, perm, permGranular)
          return (
            <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '5px 0' }}>
              <span style={{ flex: 1, fontSize: 12.5, color: on ? '#333' : '#bbb' }}>{a.label}</span>
              <Cel on={on} onClick={() => setAcao(a.key, !on)} />
            </div>
          )
        })}
        <p style={{ margin: '10px 0 6px', fontSize: 10.5, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Telas</p>
        {cats.map(cat => (
          <div key={cat} style={{ marginBottom: 6 }}>
            <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: '#bbb' }}>{cat}</p>
            {abasVisiveis.filter(a => a.categoria === cat).map(a => {
              const on = podeAbaGranular(r, a.key, perm, permGranular)
              return (
                <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
                  <span style={{ flex: 1, fontSize: 12.5, color: on ? '#333' : '#bbb' }}>{a.label}</span>
                  <Cel on={on} onClick={() => setAba(a.key, !on)} />
                </div>
              )
            })}
          </div>
        ))}
        <p style={{ margin: '8px 0 0', fontSize: 10.5, color: '#bbb' }}>{escopo === 'papel' ? 'Vale para todo mundo com este papel. Salva na hora.' : 'Começa no padrão do papel; ajuste só o que for específico deste usuário.'}</p>
      </div>
    )
  }

  // Mapa aba -> grupo (esconde e protege o acesso direto via sessionStorage)
  const ABA_GRUPO: Record<string, string> = { tarefas: 'producao', esteira: 'producao', studio: 'producao', agenda: 'producao', planner: 'producao', carga: 'producao', playbook: 'estrategia', campanhas: 'estrategia', modelos: 'estrategia', automacoes: 'estrategia', crm: 'crm', conversao: 'crm', frota: 'crm', viagens: 'crm', 'calendario-viagens': 'crm', reservas: 'crm', procedimentos: 'crm', processos: 'crm', rentabilidade: 'financeiro', clientes: 'clientes' }
  useEffect(() => {
    // Modo clínica bloqueia o acesso direto às telas ocultas para qualquer papel
    if (ocultas.includes(aba)) { setAba('home'); return }
    if (role !== 'gerente' && role !== 'usuario') return
    const g = ABA_GRUPO[aba]
    if (g && !podeGrupo(g)) { setAba('home'); return }
    // Camada granular: aba desligada para o papel/usuário também bloqueia o acesso direto
    if (ABAS_PERM.some(a => a.key === aba) && !podeAbaDash(aba)) setAba('home')
  }, [role, aba, permPapel, permGranular, perfilInstancia])
  // Config por papel (matriz na tela Colaboradores): salva o nível alterado
  function setPermPapelNivel(papel: 'gerente' | 'usuario', novoPerm: any) {
    setPermPapel(p => ({ ...p, [papel]: novoPerm }))
    fetch('/api/permissoes-papel', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [papel]: novoPerm }) }).catch(() => {})
  }
  // Permissões DETALHADAS por papel (telas/ações) — padrão de todo gerente/usuário.
  // O ajuste individual no cadastro do colaborador continua valendo por cima deste.
  function setPermGranularPapel(papel: 'gerente' | 'usuario', novoPerm: any) {
    const atualizado = { ...permGranular, [papel]: novoPerm }
    setPermGranular(atualizado)
    fetch('/api/permissoes-granular', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(atualizado) })
      .then(r => r.json()).then(d => { if (!d?.ok) toast(d?.error || 'Não foi possível salvar as permissões.', 'erro') })
      .catch(() => toast('Falha de conexão ao salvar as permissões.', 'erro'))
  }

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
      toast(`Não foi possível gerar o PDF: ${e?.message || 'erro desconhecido'}`, 'erro')
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
      // Considera "entregue" quem já saiu da produção (etapa 'pronto' ou status pós-esteira)
      const PLANNER_STATUS_OK = ['aprovado', 'agendado', 'publicando', 'publicado', 'falha_publicacao']
      const entregue = (posts as any[]).filter(p => {
        if (p.clienteId !== analyticsClienteId) return false
        if (p.etapa && p.etapa !== 'pronto' && !PLANNER_STATUS_OK.includes(p.status)) return false
        if (p.status === 'publicado') return ehDoMes(p.atualizadoEm || p.criadoEm)
        if (p.status === 'agendado') return ehDoMes(p.dataAgendada)
        return false
      }).length
      const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
      const { montarModeloRelatorio } = await import('@/lib/relatorioMensal')
      const modelo = montarModeloRelatorio(cliente, analyticsData, entregue, `${MESES[mes]}/${ano}`)
      setRelatorioEditor({ cliente, modelo }) // abre o editor; exporta lá dentro
    } catch (e: any) {
      console.error('[relatorio] erro:', e)
      toast(`Não foi possível gerar o relatório: ${e?.message || 'erro desconhecido'}`, 'erro')
    }
    setGerandoRelatorio(false)
  }

  async function criarPost(valor: any) {
    const acao = valor.acao || 'publicar'
    if (!valor.clienteId) return
    setCriandoPost(true)
    setRascunhoMsg(acao === 'publicar' ? 'Publicando nas redes selecionadas...' : acao === 'agendar' ? 'Agendando a postagem...' : acao === 'aprovacao' ? 'Enviando para aprovação...' : 'Salvando rascunho...')
    // Fecha o compositor e volta ao Planner enquanto processa/carrega
    setEditandoPostId(null)
    setComposerPrefill(null)
    setComposerKey(k => k + 1)
    setAba(abaAntesComposer.current) // volta pra onde o editor foi aberto (Studio/Esteira/Planner)
    const cliente = clientes.find(c => c.id === valor.clienteId)
    // Converte a data local (datetime-local) para ISO absoluto, evitando erro de fuso no servidor
    const dataISO = valor.dataAgendada ? new Date(valor.dataAgendada).toISOString() : ''
    const body: any = { ...valor, dataAgendada: dataISO, clienteNome: cliente?.nome }
    if (acao === 'rascunho') body.rascunhoInterno = true
    if (acao === 'agendar') body.statusInicial = 'agendado'
    if (acao === 'aprovacao') { body.statusInicial = 'aguardando_aprovacao'; body.etapa = 'aprovacao_criativo' } // etapa: aparece nas Aprovações do portal (filtram por etapa) além do link público

    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json())

    if (acao === 'publicar') {
      fetch('/api/publicar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: res.post.id }),
      }).catch(() => {})
      const pub = await acompanharPublicacao(res.post.id)
      setRascunhoMsg(pub.ok ? 'Publicado com sucesso nas redes selecionadas!' : `Falha ao publicar: ${pub.error}`)
    } else if (acao === 'agendar') {
      setRascunhoMsg(`Post agendado para ${new Date(valor.dataAgendada).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.`)
    } else if (acao === 'aprovacao') {
      // Link ÚNICO do cliente (mostra TODOS os materiais aguardando aprovação dele)
      const tk = await fetch('/api/aprovacao-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId: valor.clienteId }) }).then(x => x.json()).catch(() => null)
      const url = tk?.token ? `${window.location.origin}/aprovacoes/${tk.token}` : ''
      if (url) {
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).catch(() => {})
        setLinkAprovModal({ url, cliente: cliente?.nome || 'cliente' })
      }
      setRascunhoMsg(url ? 'Enviado para aprovação! Link pronto para compartilhar.' : 'Enviado para aprovação. Pegue o link em Configurações › Clientes › "Link de aprovação".')
    } else {
      setRascunhoMsg('Rascunho salvo — visível apenas para a equipe.')
    }

    // insere o novo post localmente; ao publicar, o status muda no servidor -> recarrega só ele
    if (res?.post) {
      if (acao === 'publicar') {
        const atual = await fetch(`/api/posts?id=${res.post.id}`).then(r => r.json()).catch(() => null)
        setPosts(ps => [atual && !atual.error ? atual : res.post, ...ps])
      } else {
        setPosts(ps => [res.post, ...ps])
      }
    }
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
      ...((post as any).contaIds ? { contaIds: (post as any).contaIds } : {}),
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
    const res = await fetch('/api/posts', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: post.id, dataAgendada: novaISO, status }),
    })
    // sucesso: estado já está otimista. Falha: ressincroniza só este post.
    if (!res.ok) fetch(`/api/posts?id=${post.id}`).then(r => r.json()).then(p => p && !p.error && setPosts(ps => ps.map(x => x && x.id === post.id ? p : x))).catch(() => {})
  }

  // Link público de status (sem login) do cliente
  async function statusPublico(clienteId: string) {
    const r = await fetch('/api/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId }) }).then(x => x.json()).catch(() => null)
    if (r?.token) {
      const link = `${window.location.origin}/status/${r.token}`
      navigator.clipboard?.writeText(link).catch(() => {})
      window.open(link, '_blank')
    } else toast('Não foi possível gerar o link de status.', 'erro')
  }

  // Revoga o link de status atual (para de funcionar) e gera um novo.
  async function revogarLinkStatus(clienteId: string) {
    if (!(await confirmar('Revogar o link de status atual? O link que você já enviou vai PARAR de funcionar e um novo será gerado no lugar.', { titulo: 'Revogar link de status', okLabel: 'Revogar e gerar novo', perigo: true }))) return
    const r = await fetch('/api/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId, rotacionar: true }) }).then(x => x.json()).catch(() => null)
    if (r?.token) {
      const link = `${window.location.origin}/status/${r.token}`
      navigator.clipboard?.writeText(link).catch(() => {})
      toast('Link de status antigo revogado. Novo link gerado e copiado.', 'sucesso')
    } else toast('Não foi possível revogar o link de status.', 'erro')
  }

  // Link ÚNICO de aprovação do cliente (todos os materiais aguardando aprovação)
  async function linkAprovacao(clienteId: string) {
    const r = await fetch('/api/aprovacao-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId }) }).then(x => x.json()).catch(() => null)
    if (r?.token) {
      const link = `${window.location.origin}/aprovacoes/${r.token}`
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).then(() => toast('Link único de aprovação copiado! Envie ao cliente.', 'sucesso')).catch(() => toast(link, 'info'))
      else toast(link, 'info')
    } else toast('Não foi possível gerar o link de aprovação.', 'erro')
  }

  // Revoga o link de aprovação atual (para de funcionar) e gera um novo.
  async function revogarLinkAprovacao(clienteId: string, nome: string) {
    if (!(await confirmar('Revogar o link de aprovação atual? O link que você já enviou vai PARAR de funcionar e um novo será gerado no lugar.', { titulo: 'Revogar link', okLabel: 'Revogar e gerar novo', perigo: true }))) return
    const r = await fetch('/api/aprovacao-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId, rotacionar: true }) }).then(x => x.json()).catch(() => null)
    if (r?.token) {
      const url = `${window.location.origin}/aprovacoes/${r.token}`
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).catch(() => {})
      setLinkAprovModal({ url, cliente: nome })
      toast('Link antigo revogado. Novo link gerado e copiado.', 'sucesso')
    } else toast('Não foi possível revogar o link.', 'erro')
  }

  // Reaproveitamento (1 vira 3): duplica o post como rascunho em outro formato
  async function reaproveitar(post: any, formato: string) {
    const body = { clienteId: post.clienteId, clienteNome: post.clienteNome, imagens: post.imagens || [], legenda: post.legenda || '', formato, capasVideo: post.capasVideo || {}, redes: post.redes || ['instagram', 'facebook'], rascunhoInterno: true, ...(post.marcoId ? { marcoId: post.marcoId } : {}) }
    const res = await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => null)
    if (res?.ok) {
      if (res.post) setPosts(ps => [res.post, ...ps])
      setPostPreview(null)
      toast(`Cópia criada como rascunho (${formato}). Ajuste a mídia/legenda no Planner.`, 'sucesso')
    } else toast('Não foi possível reaproveitar o post.', 'erro')
  }

  // Fechar o compositor NUNCA joga trabalho fora (pedido do dono, 16/07): salva
  // sozinho, em qualquer fase do preenchimento.
  // - post novo -> rascunho (rascunhoInterno: não vai para o cliente);
  // - editando -> "salvar", que preserva o status (publicado continua publicado,
  //   com data segue agendado). Salvar como rascunho DESAGENDARIA o post.
  // "Cancelar edição" continua descartando: ali a intenção é explícita.
  function fecharComposer() {
    const v = composerValor.current
    const temConteudo = !!(v && (String(v.legenda || '').trim() || (v.imagens || []).length || v.dataAgendada))
    const voltar = () => setAba(abaAntesComposer.current || (verComoClienteId ? 'planner' : 'home'))

    if (!temConteudo) { if (editandoPostId) cancelarEdicaoPost(); voltar(); return }
    if (!v.clienteId) {
      // Sem cliente não há onde guardar: o rascunho ficaria órfão, invisível no
      // Planner. Melhor segurar aqui do que "salvar" no vazio.
      toast('Escolha o cliente para eu salvar seu rascunho — sem ele o material se perde.', 'erro')
      return
    }
    if (editandoPostId) salvarEdicaoPost({ ...v, acao: 'salvar' })
    else criarPost({ ...v, acao: 'rascunho' })
  }

  async function salvarEdicaoPost(valor: any) {
    if (!editandoPostId) return
    setCriandoPost(true)
    const cliente = clientes.find(c => c.id === valor.clienteId)
    const postAtual = posts.find(p => p?.id === editandoPostId)
    // "Enviar para aprovação" tem prioridade: volta o post para o cliente aprovar.
    // Senão: data futura = agendado; sem data = rascunho. Publicados mantêm o status.
    const paraAprovacao = valor.acao === 'aprovacao'
    let status = postAtual?.status
    if (paraAprovacao) {
      status = 'aguardando_aprovacao'
    } else if (postAtual?.status !== 'publicado') {
      status = valor.dataAgendada ? 'agendado' : 'rascunho'
    }
    const dataISO = valor.dataAgendada ? new Date(valor.dataAgendada).toISOString() : ''
    const body: any = { id: editandoPostId, ...valor, dataAgendada: dataISO, clienteNome: cliente?.nome, status }
    // Ao reenviar para aprovação, marca a etapa: as Aprovações do portal filtram por etapa
    // e o link público filtra por status — assim o material reaparece para o cliente.
    if (paraAprovacao) body.etapa = 'aprovacao_criativo'
    const r = await fetch('/api/posts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(x => x.json()).catch(() => null)
    setCriandoPost(false)
    setEditandoPostId(null)
    setComposerPrefill(null)
    setComposerKey(k => k + 1)
    setAba(abaAntesComposer.current) // volta pra onde o editor foi aberto
    if (r?.post) setPosts(ps => ps.map(p => p && p.id === r.post.id ? r.post : p))
    // Enviado para aprovação: pega o link ÚNICO do cliente e abre o modal para compartilhar.
    if (paraAprovacao && cliente) {
      const tk = await fetch('/api/aprovacao-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId: valor.clienteId }) }).then(x => x.json()).catch(() => null)
      const url = tk?.token ? `${window.location.origin}/aprovacoes/${tk.token}` : ''
      if (url) {
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).catch(() => {})
        setLinkAprovModal({ url, cliente: cliente.nome || 'cliente' })
      }
      toast('Enviado para aprovação do cliente!', 'sucesso')
    }
  }

  // Checklist do ajuste do cliente: marca cada alteração como resolvida.
  function aplicarPatchPostPreview(id: string, patch: any) {
    setPostPreview(pp => (pp && pp.id === id ? { ...pp, ...patch } : pp) as any)
    setPosts(ps => ps.map(p => p && p.id === id ? { ...p, ...patch } as any : p))
    fetch('/api/posts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) }).catch(() => {})
  }
  function marcarAnotacaoResolvida(post: Post, idx: number, valor: boolean) {
    const anot = Array.isArray((post as any).anotacoes) ? [...(post as any).anotacoes] : []
    if (!anot[idx]) return
    anot[idx] = { ...anot[idx], resolvido: valor }
    aplicarPatchPostPreview(post.id, { anotacoes: anot })
  }

  // Reenvia um post corrigido para aprovação do cliente (libera após tudo resolvido).
  async function reenviarAprovacao(post: Post) {
    aplicarPatchPostPreview(post.id, { status: 'aguardando_aprovacao', etapa: 'aprovacao_criativo' })
    const cliente = clientes.find(c => c.id === post.clienteId)
    const tk = await fetch('/api/aprovacao-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId: post.clienteId }) }).then(x => x.json()).catch(() => null)
    const url = tk?.token ? `${window.location.origin}/aprovacoes/${tk.token}` : ''
    if (url) {
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).catch(() => {})
      setLinkAprovModal({ url, cliente: cliente?.nome || 'cliente' })
    }
    toast('Reenviado para aprovação! Link pronto para compartilhar.', 'sucesso')
  }

  async function excluirPost(post: Post) {
    if (!(await confirmar(`Excluir definitivamente este post${post.clienteNome ? ' de ' + post.clienteNome : ''}? Esta ação não pode ser desfeita.`, { titulo: 'Excluir post', okLabel: 'Excluir', perigo: true }))) return
    setPosts(ps => ps.filter(p => p!.id !== post.id))
    const res = await fetch(`/api/posts?id=${post.id}`, { method: 'DELETE' })
    if (!res.ok) {
      fetch('/api/posts').then(r => r.json()).then(setPosts)
      toast('Não foi possível excluir o post.', 'erro')
    }
  }

  const [republicandoId, setRepublicandoId] = useState<string | null>(null)
  async function republicarPost(post: Post) {
    setRepublicandoId(post.id)
    fetch('/api/publicar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: post.id }),
    }).catch(() => {})
    const r = await acompanharPublicacao(post.id)
    setRepublicandoId(null)
    const atual = await fetch(`/api/posts?id=${post.id}`).then(x => x.json()).catch(() => null)
    if (atual && !atual.error) setPosts(ps => ps.map(p => p && p.id === post.id ? atual : p))
    if (!r.ok) toast(`Ainda não foi possível publicar: ${r.error}. Dica: edite o post e verifique a mídia (vídeos em MP4/MOV; imagens em JPG/PNG até 10 MB) antes de tentar de novo.`, 'erro')
    else { setPostPreview(null); toast('Publicado com sucesso!', 'sucesso') }
  }

  function alternarSelecaoPost(id: string) {
    setBibSelecionados(lista => lista.includes(id) ? lista.filter(x => x !== id) : [...lista, id])
  }

  async function excluirPostDireto(id: string) {
    setPosts(ps => ps.filter(p => p!.id !== id))
    setBibSelecionados(lista => lista.filter(x => x !== id))
    const res = await fetch(`/api/posts?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { fetch('/api/posts').then(r => r.json()).then(setPosts); toast('Não foi possível excluir o post.', 'erro') }
  }

  async function excluirSelecionados() {
    const ids = [...bibSelecionados]
    if (ids.length === 0) return
    if (!(await confirmar(`Excluir definitivamente ${ids.length} post(s)? Esta ação não pode ser desfeita.`, { titulo: 'Excluir posts', okLabel: 'Excluir', perigo: true }))) return
    setPosts(ps => ps.filter(p => !ids.includes(p!.id)))
    setBibSelecionados([])
    const resultados = await Promise.all(ids.map(id => fetch(`/api/posts?id=${id}`, { method: 'DELETE' })))
    // estado já atualizado de forma otimista; só ressincroniza se algum DELETE falhar
    if (resultados.some(r => !r.ok)) fetch('/api/posts').then(r => r.json()).then(setPosts)
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
        // Adicionar como perfil extra (contas[]) quando a conexão partiu do
        // botão "Adicionar perfil"; senão, sobrescreve a conta principal.
        ...(metaComoNova ? { comoNovaConta: true, contaNome: page.instagram.username ? `@${page.instagram.username}` : page.pageName } : {}),
      }),
    })
    setVinculandoPagina('')
    setMetaPages([])
    setVinculos({})
    setMetaClienteAlvo('')
    setMetaComoNova(false)
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
    if (data?.cliente?.loginEmail && data?.senhaGerada) {
      setCredenciaisGeradas({ nome: data.cliente.nome, email: data.cliente.loginEmail, senha: data.senhaGerada })
    }
    fetch('/api/clientes').then(r => r.json()).then(setClientes)
    setNovoCliente({ nome: '', instagram: '', loginEmail: '', corPrimaria: '#ffc00f', corSecundaria: '#111111', tipo: 'cliente', entregaveis: [], postsMensais: 12, receitasAvulsas: [] })
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
    setNovoUsuario({ nome: '', email: '', senha: '', role: 'gerente', cargo: '', custoHora: 0, salarioFixo: 0, valorPorProjeto: 0, qtdProjetos: 0 })
    setMostrarFormUsuario(false)
    setVerSenhaNovo(false)
  }

  async function enviarImagem(arquivo: File): Promise<string | null> {
    setProgImagem(0)
    try {
      const ext = arquivo.name.split('.').pop() || 'bin'
      const blob = await upload(`midia/${uuid()}.${ext}`, arquivo, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        contentType: arquivo.type,
        clientPayload: arquivo.type,
        onUploadProgress: ({ percentage }) => setProgImagem(percentage),
      })
      return blob.url
    } catch {
      return null
    } finally {
      setProgImagem(null)
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

  async function resetarSenhaCliente(clienteId: string, nome: string) {
    if (!(await confirmar('Gerar uma NOVA senha de acesso para este cliente? A senha atual deixa de funcionar.', { titulo: 'Resetar senha do cliente', okLabel: 'Resetar senha' }))) return
    const r = await fetch('/api/clientes/senha', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId }) }).then(x => x.json()).catch(() => null)
    if (!r || r.error) { toast(r?.error || 'Não foi possível resetar a senha.', 'erro'); return }
    setCredenciaisGeradas({ nome, email: r.email, senha: r.senha })
  }

  function iniciarEdicaoCliente(c: Cliente) {
    setEditandoCliente(c.id)
    setEdicaoCliente({ id: c.id, nome: c.nome, instagram: c.instagram, logo: c.logo, corPrimaria: c.corPrimaria || '#ffc00f', corSecundaria: c.corSecundaria || '#111111', tipo: c.tipo || 'cliente', entregaveis: c.entregaveis || [], postsMensais: c.postsMensais || 0,
      contratoValor: (c as any).contratoValor, contratoInicio: (c as any).contratoInicio, contratoRenovacao: (c as any).contratoRenovacao, contratoCiclo: (c as any).contratoCiclo, diaVencimento: (c as any).diaVencimento, receitasAvulsas: (c as any).receitasAvulsas || [],
      permissoes: (c as any).permissoes || {}, handoffVendas: (c as any).handoffVendas || '', squad: (c as any).squad || [], squadPapeis: (c as any).squadPapeis || {}, contas: (c as any).contas || [], modulos: (c as any).modulos || {} } as any)
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

  // Cobrança recorrente via Stripe: cria/reaproveita a assinatura mensal e abre o checkout.
  async function cobrarStripe(clienteId: string) {
    const r = await fetch('/api/stripe/cobrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId }) }).then(x => x.json()).catch(() => null)
    if (r?.url) window.open(r.url, '_blank')
    else toast(r?.error || 'Não foi possível iniciar a cobrança.', 'erro')
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
      if (!(await confirmar('O Brand Board está vazio e este cliente já tinha dados salvos. Salvar vai APAGAR o Brand Board. Tem certeza?', { titulo: 'Brand Board vazio', okLabel: 'Salvar mesmo assim', perigo: true }))) return
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
    if (!(await confirmar('Excluir o Brand Board deste cliente? As informações e o DNA da marca serão apagados.', { titulo: 'Excluir Brand Board', okLabel: 'Excluir', perigo: true }))) return
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
    if (brandForm.documentoMarca && !(await confirmar('Regenerar o documento vai consumir créditos da IA e substituir o documento atual. Deseja continuar?', { titulo: 'Regenerar documento', okLabel: 'Continuar' }))) return
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
    if (!(await confirmar(`Tem certeza que deseja excluir o cliente "${nome}"? Essa ação não pode ser desfeita.`, { titulo: 'Excluir cliente', okLabel: 'Excluir', perigo: true }))) return
    await fetch('/api/clientes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    fetch('/api/clientes').then(r => r.json()).then(setClientes)
  }

  function iniciarEdicaoUsuario(u: any) {
    setEditandoUsuario(u.email)
    setEdicaoUsuario({ nome: u.nome, role: u.role, novaSenha: '', cargo: u.cargo || '', funcaoVendas: (u as any).funcaoVendas || '', areaSaude: (u as any).areaSaude || '', corAgenda: (u as any).corAgenda || '', permissoes: (u as any).permissoes, permissoesGranular: (u as any).permissoesGranular, foto: u.foto || '', clienteId: u.clienteId || '', lojaId: (u as any).lojaId || '', custoHora: u.custoHora || 0, salarioFixo: u.salarioFixo || 0, valorPorProjeto: (u as any).valorPorProjeto || 0, qtdProjetos: (u as any).qtdProjetos || 0 } as any)
    setVerSenhaEdicao(false)
  }

  async function salvarEdicaoUsuario(email: string) {
    await fetch('/api/usuarios', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, nome: edicaoUsuario.nome, role: edicaoUsuario.role, cargo: edicaoUsuario.cargo, funcaoVendas: (edicaoUsuario as any).funcaoVendas || '', areaSaude: (edicaoUsuario as any).areaSaude ?? '', corAgenda: (edicaoUsuario as any).corAgenda ?? '', recebeAgenda: (edicaoUsuario as any).recebeAgenda ?? !!(edicaoUsuario as any).areaSaude, permissoes: (edicaoUsuario as any).permissoes ?? null, permissoesGranular: (edicaoUsuario as any).permissoesGranular ?? null, foto: edicaoUsuario.foto, clienteId: (edicaoUsuario as any).clienteId || '', lojaId: (edicaoUsuario as any).lojaId ?? '', custoHora: edicaoUsuario.custoHora || 0, salarioFixo: edicaoUsuario.salarioFixo || 0, valorPorProjeto: edicaoUsuario.valorPorProjeto || 0, qtdProjetos: edicaoUsuario.qtdProjetos || 0, tipoTurismo: (edicaoUsuario as any).tipoTurismo ?? '', cnh: (edicaoUsuario as any).cnh ?? '', telefone: (edicaoUsuario as any).telefone ?? '', novaSenha: edicaoUsuario.novaSenha || undefined }),
    })
    setEditandoUsuario(null)
    fetch('/api/usuarios').then(r => r.json()).then(setUsuarios)
  }

  async function excluirUsuario(email: string, nome: string) {
    if (!(await confirmar(`Tem certeza que deseja excluir o colaborador "${nome}"?`, { titulo: 'Excluir colaborador', okLabel: 'Excluir', perigo: true }))) return
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
  // Foto do usuário logado (para o avatar do cluster) — usa o cadastro ou a imagem da sessão
  const minhaFoto = (usuarios.find((u: any) => u.email === (session?.user as any)?.email) as any)?.foto || (session?.user as any)?.image || ''

  // Item de menu com ícone — mostra só o ícone quando a sidebar está recolhida
  function NavBtn({ chave, label, onClick, badge, fontSize = 14 }: { chave: string; label: string; onClick?: () => void; badge?: number; fontSize?: number }) {
    // Permissão detalhada por aba (esconde a tela para quem não pode vê-la).
    if (ABAS_PERM.some(a => a.key === chave) && !podeAbaDash(chave)) return null
    // Modo clínica: telas de agência somem para TODOS, admin incluso
    if (ocultas.includes(chave)) return null
    const ativo = aba === chave
    // Ao clicar com a sidebar recolhida, expande automaticamente
    const aoClicar = () => { if (onClick) onClick(); else setAba(chave as any); if (recolhida) { setRecolhida(false); try { localStorage.setItem('sidebarRecolhida', '0') } catch {} } }
    return (
      <button title={recolhida ? label : undefined} onClick={aoClicar} className={ativo ? 'soma10-no-invert' : undefined}
        style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: recolhida ? 'center' : 'space-between', gap: 10, width: '100%', padding: recolhida ? '11px 0' : '11px 12px', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontWeight: ativo ? 700 : 500, color: ativo ? (tema === 'escuro' ? '#fff' : '#111') : '#888', background: ativo ? '#ffc00f' : 'transparent', fontSize, transition: 'all 0.15s' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ display: 'flex', flexShrink: 0, color: ativo ? (tema === 'escuro' ? '#fff' : '#111') : '#999' }}><Icon size={18}><path d={ICONE_ABA[chave] || ICONE_ABA.default} /></Icon></span>
          {!recolhida && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>}
        </span>
        {!recolhida && !!badge && <span style={{ background: '#dc2626', color: '#fff', borderRadius: 999, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, padding: '0 5px' }}>{badge > 99 ? '99+' : badge}</span>}
        {recolhida && !!badge && <span style={{ position: 'absolute', top: 7, right: 12, width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }} />}
      </button>
    )
  }

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
        /* Imagens/fotos dentro de container no-invert: ja sao re-invertidas pelo proprio
           container, entao nao aplicar a inversao de imagem de novo (mantem cor natural). */
        .soma10-tema-escuro .soma10-no-invert img,
        .soma10-tema-escuro .soma10-no-invert video {
          filter: none;
        }
        /* Botoes amarelos (marcados via JS): continuam amarelos no escuro, com texto branco. */
        .soma10-tema-escuro .btn-amarelo {
          filter: invert(1) hue-rotate(180deg);
          color: #fff !important;
        }
        .soma10-tema-escuro .btn-amarelo svg { stroke: #fff !important; }
        @keyframes shimmer {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
      `}</style>
      {/* Controles flutuantes (topo-direito) — substitui a antiga barra preta */}
      <div className="soma10-no-invert" style={{ position: 'fixed', top: mobile ? 'calc(12px + env(safe-area-inset-top))' : 14, right: mobile ? 12 : 18, zIndex: 120, display: 'flex', alignItems: 'center', background: '#fff', borderRadius: 999, padding: '6px 12px', boxShadow: '0 6px 20px rgba(0,0,0,0.12)', border: '1px solid #eee' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Alternar modo claro/escuro */}
          <button onClick={alternarTema} title={tema === 'escuro' ? 'Mudar para modo claro' : 'Mudar para modo escuro'} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#444',
            width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {tema === 'escuro' ? <IconSun size={18} /> : <IconMoon size={18} />}
          </button>

          {/* Sininho de notificações — popup dropdown */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setInboxAberto(v => { const novo = !v; if (novo && notificacoes.some(n => !n.lida)) marcarTodasNotificacoesLidas(); return novo })} title="Notificações" style={{
              position: 'relative', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#444',
              width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconBell size={18} />
              {notificacoes.some(n => !n.lida) && (
                <span style={{
                  position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 999, background: '#ef4444',
                  color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', border: '2px solid #fff',
                }}>
                  {notificacoes.filter(n => !n.lida).length > 9 ? '9+' : notificacoes.filter(n => !n.lida).length}
                </span>
              )}
            </button>

            {inboxAberto && (
              <>
                <div onClick={fecharFora(() => setInboxAberto(false), { perguntar: false })} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
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
                        if (n.tarefaId) { setInboxAberto(false); abrirTarefaPorId(n.tarefaId) }
                        else if (n.postId) { const p = posts.find((x: any) => x.id === n.postId); if (p) { setInboxAberto(false); setPostPreview(p) } }
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

          {role === 'admin' && !mobile && (
            <select value={verComoPapel ? `papel:${verComoPapel}` : ''} onChange={e => {
              const v = e.target.value
              if (v === '_reset') { setVerComoClienteId(''); setVerComoPapel(''); return }
              // Prever a visão de um PAPEL (colaborador) — só muda a navegação, não as capacidades
              if (v.startsWith('papel:')) { setVerComoPapel(v.replace('papel:', '') as any); setAba('home'); return }
              // Visualizar como CLIENTE (somente leitura): abre o portal
              if (v.startsWith('cli:')) { setViewAsClient(true); router.push(`/cliente/${v.replace('cli:', '')}`); return }
            }} style={{ padding: '4px 8px', borderRadius: 8, border: `1px solid ${verComoPapel ? '#ffc00f' : '#e0e0e0'}`, background: verComoPapel ? '#fffbeb' : '#fff', color: '#444', fontSize: 11, cursor: 'pointer' }}>
              <option value="">Visualizar como...</option>
              {(verComoPapel || verComoClienteId) && <option value="_reset">Voltar à minha visão</option>}
              <optgroup label="Colaboradores (papel)">
                <option value="papel:gerente">Como Gerente</option>
                <option value="papel:usuario">Como Usuário</option>
              </optgroup>
              {!perfilClinica && clientes.length > 0 && (
                <optgroup label="Clientes (visualizar)">
                  {clientes.map(c => <option key={c.id} value={`cli:${c.id}`}>{c.nome}</option>)}
                </optgroup>
              )}
            </select>
          )}
          <button onClick={() => setAba('minha-conta' as any)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} title="Minha conta">
            <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', background: minhaFoto ? '#eee' : '#ffc00f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {minhaFoto
                ? <img src={minhaFoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ color: '#111', fontSize: 12, fontWeight: 800 }}>{session?.user?.name?.[0]?.toUpperCase()}</span>}
            </div>
            {!mobile && <span style={{ fontSize: 13, color: '#444', fontWeight: 600 }}>{session?.user?.name}</span>}
          </button>
          {!mobile && <span style={{ background: '#ffc00f', color: '#111', borderRadius: 12, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{role}</span>}
          <button onClick={() => signOut()} style={{ background: 'none', border: '1.5px solid #ddd', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#444' }}>Sair</button>
        </div>
      </div>

      {/* Menu hamburguer (mobile) — abre o drawer da sidebar */}
      {mobile && !menuMobile && (
        <button onClick={() => setMenuMobile(true)} aria-label="Menu" className="soma10-no-invert"
          style={{ position: 'fixed', top: 'calc(12px + env(safe-area-inset-top))', left: 12, zIndex: 120, width: 40, height: 40, borderRadius: 12, background: '#fff', border: '1px solid #eee', boxShadow: '0 6px 20px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
        </button>
      )}
      {/* Backdrop do drawer (mobile) */}
      {mobile && menuMobile && (
        <div onClick={fecharFora(() => setMenuMobile(false), { perguntar: false })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 150 }} />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', ...(mobile ? {} : { height: '100vh', overflow: 'hidden' }) }}>
        {/* Sidebar */}
        <aside style={mobile ? {
          width: 264, background: '#fff', borderRight: '1px solid #f0f0f0', boxSizing: 'border-box',
          padding: 'calc(16px + env(safe-area-inset-top)) 14px calc(16px + env(safe-area-inset-bottom))',
          position: 'fixed', top: 0, left: 0, height: '100vh', overflowY: 'auto', zIndex: 200,
          transform: menuMobile ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.25s ease',
          boxShadow: menuMobile ? '2px 0 16px rgba(0,0,0,0.18)' : 'none',
        } : {
          width: recolhida ? 66 : 232, flexShrink: 0, background: '#fff', borderRight: '1px solid #f0f0f0',
          height: '100vh', overflowY: 'auto', padding: recolhida ? '16px 8px' : '16px 14px', boxSizing: 'border-box', transition: 'width 0.18s',
        }}>
          {/* Logo no topo — wordmark quando expandida, ícone quando recolhida */}
          <div onClick={() => { if (!ehCliente) setVerComoClienteId(''); setAba(ehCliente ? 'aprovacoes' : 'home'); setPostPreview(null); setInboxAberto(false) }} style={{ display: 'flex', alignItems: 'center', justifyContent: recolhida ? 'center' : 'flex-start', cursor: 'pointer', padding: '4px 6px 16px', marginBottom: 4, borderBottom: '1px solid #f4f4f4' }} title="Ir para o início">
            {recolhida
              ? <div style={{ background: '#111', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}><img src="/logo.svg" alt="Soma10" style={{ width: 24, height: 24, objectFit: 'contain' }} /></div>
              : <img src={tema === 'escuro' ? '/soma10-logo-dark.png' : '/soma10-logo.png'} alt="Soma10" style={{ height: 28, width: 'auto', maxWidth: 160, objectFit: 'contain' }} />}
          </div>
          {/* PAINEL DO CLIENTE — nav simplificada */}
          {ehCliente && clienteEmVisualizacao && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', marginBottom: 10 }}>
                <span style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#111', flexShrink: 0 }}>
                  <AvatarCliente logo={clienteEmVisualizacao.logo} nome={clienteEmVisualizacao.nome} />
                </span>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#111' }}>{clienteEmVisualizacao.nome}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#888' }}>Painel do cliente</p>
                </div>
              </div>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {(['aprovacoes', 'playbook'] as const).map(a => (
                  <button key={a} onClick={() => setAba(a as any)} style={{
                    padding: '11px 14px', border: 'none', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    fontWeight: aba === a ? 700 : 500, color: aba === a ? '#111' : '#888',
                    background: aba === a ? '#ffc00f' : 'transparent', fontSize: 14,
                  }}>
                    {a === 'aprovacoes' ? 'Aprovações' : 'Playbook'}
                  </button>
                ))}
              </nav>
            </div>
          )}

          {/* Seletor de visualização por cliente — primeira coisa exibida (equipe).
              Oculto no turismo, na clínica e na cidadania: essas instâncias não têm
              "clientes" de agência (sub-accounts) — a aba clientes já é oculta nos
              três perfis. Na cidadania o cliente é PESSOA (contato do CRM) e o que
              se acompanha é o Processo, não uma sub-conta de marca. */}
          {/* Seletor de loja do varejo (telefonia) — Todas (rede) + cada unidade.
              Reaproveita o lugar do sub-account; operador travado não tem seletor. */}
          {podeTrocarLoja && !recolhida && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, padding: '0 4px' }}>Ver loja</label>
              <select value={verComoLojaId} onChange={e => setVerComoLojaId(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${verComoLojaId ? '#ffc00f' : '#e0e0e0'}`, background: verComoLojaId ? '#fffbeb' : '#fff', color: '#111', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                <option value="">Todas (rede)</option>
                {lojasTel.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </div>
          )}
          {!ehCliente && !ehVendas && !recolhida && !perfilTurismo && !perfilClinica && !perfilCidadania && !perfilTelefonia && <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, padding: '0 4px' }}>
              {verComoClienteId ? 'Acessando sub-account' : 'Acessar sub-account'}
            </label>
            {verComoClienteId ? (
              // Cliente travado: cada cliente é único, sem opção de trocar para outro
              <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', background: '#ffc00f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: '#111', flexShrink: 0, border: '1px solid #fde68a' }}>
                    <AvatarCliente logo={clienteEmVisualizacao?.logo} nome={clienteEmVisualizacao?.nome} />
                  </span>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                    {clienteEmVisualizacao?.nome || 'Cliente'}
                  </p>
                </div>
                <button onClick={() => { setVerComoClienteId('') }} style={{
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
                              <AvatarCliente logo={c.logo} nome={c.nome} clienteId={c.id} />
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

          {!ehCliente && !ehVendas && <div style={{ height: 1, background: '#f0f0f0', margin: '0 0 16px' }} />}

          {/* NIVEL VENDAS — papel isolado: so CRM, Meu dia, Personal list, Mensagens */}
          {ehVendas && (
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {!recolhida && <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px', padding: '0 4px' }}>Vendas</span>}
              <NavBtn chave="crm" label="CRM" />
              <NavBtn chave="conversao" label="Conversão & Retenção" />
              <NavBtn chave="meu-dia" label="Meu dia" />
              <NavBtn chave="lista-pessoal" label="Personal list" />
              <NavBtn chave="mensagens" label="Chat interno" onClick={() => { setAba('mensagens' as any); setChatNaoLidas(0) }} badge={chatNaoLidas} />
            </nav>
          )}

          {/* NIVEL AGENCIA — oculto na visao de cliente e de vendas */}
          {!verComoClienteId && !ehVendas && (
            <>
              {([
                { titulo: '', grupo: '', itens: [['home', 'Painel'], ['meu-dia', 'Meu dia'], ['lista-pessoal', 'Personal list']] },
                { titulo: 'Produção', grupo: 'producao', itens: [['tarefas', 'Tarefas'], ['studio', 'Studio'], ['agenda', 'Agenda'], ['planner', 'Planner'], ['agentes', 'Agentes de IA'], ['documentos', 'Documentos'], ['mapas', 'Mapas mentais']] },
              ] as { titulo: string; grupo: string; itens: [string, string][] }[]).filter(g => (!g.grupo || podeGrupo(g.grupo)) && !g.itens.every(([a]) => ocultas.includes(a))).map((grupo, gi) => (
                <nav key={gi} style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: gi === 0 ? 0 : 12 }}>
                  {grupo.titulo && !recolhida && <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px', padding: '0 4px' }}>{grupo.titulo}</span>}
                  {grupo.itens.map(([a, label]) => <NavBtn key={a} chave={a} label={label} />)}
                </nav>
              ))}
              {/* Operação (turismo) — viagens, ônibus, reservas (adicionadas por brick) */}
              {perfilTurismo && podeGrupo('crm') && (
                <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 12 }}>
                  {!recolhida && <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px', padding: '0 4px' }}>Operação</span>}
                  <NavBtn chave="viagens" label="Viagens" />
                  <NavBtn chave="calendario-viagens" label="Calendário" />
                  <NavBtn chave="reservas" label="Reservas" />
                  <NavBtn chave="frota" label="Frota" />
                </nav>
              )}
              {/* Clínica — catálogo de procedimentos e métodos (brick do perfil clínica) */}
              {perfilClinica && podeGrupo('crm') && (
                <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 12 }}>
                  {!recolhida && <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px', padding: '0 4px' }}>Clínica</span>}
                  <NavBtn chave="procedimentos" label="Procedimentos e Métodos" />
                </nav>
              )}
              {/* Assessoria (cidadania) — esteira de processos (brick do perfil cidadania) */}
              {perfilCidadania && podeGrupo('crm') && (
                <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 12 }}>
                  {!recolhida && <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px', padding: '0 4px' }}>Assessoria</span>}
                  <NavBtn chave="processos" label="Processos" />
                </nav>
              )}
              {/* Varejo (telefonia) — Produtos/Estoque (Vendas entra na Fase 2) */}
              {perfilTelefonia && podeGrupo('crm') && (
                <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 12 }}>
                  {!recolhida && <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px', padding: '0 4px' }}>Varejo</span>}
                  <NavBtn chave="produtos" label="Produtos" />
                  <NavBtn chave="vendas" label="Vendas (PDV)" />
                </nav>
              )}
              {/* Comunicação — acima de Estratégia */}
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 12 }}>
                {!recolhida && <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px', padding: '0 4px' }}>Comunicação</span>}
                <NavBtn chave="inbox" label="Inbox" onClick={() => { setAba('inbox' as any); marcarTodasNotificacoesLidas() }} badge={notificacoes.filter(n => !n.lida).length} />
                <NavBtn chave="mensagens" label="Chat interno" onClick={() => { setAba('mensagens' as any); setChatNaoLidas(0) }} badge={chatNaoLidas} />
                <NavBtn chave="solicitacoes" label="Solicitações do cliente" onClick={() => setAba('solicitacoes' as any)} />
              </nav>
              {([
                { titulo: 'Estratégia', grupo: 'estrategia', itens: [['playbook', 'Playbook'], ['campanhas', 'Campanhas'], ['modelos', 'Modelos'], ['automacoes', 'Automações']] },
                { titulo: 'Vendas', grupo: 'crm', itens: [['crm', 'CRM'], ['conversao', 'Conversão & Retenção']] },
              ] as { titulo: string; grupo: string; itens: [string, string][] }[]).filter(g => podeGrupo(g.grupo) && !g.itens.every(([a]) => ocultas.includes(a))).map((grupo) => (
                <nav key={grupo.grupo} style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 12 }}>
                  {grupo.titulo && !recolhida && <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px', padding: '0 4px' }}>{grupo.titulo}</span>}
                  {grupo.itens.map(([a, label]) => <NavBtn key={a} chave={a} label={label} />)}
                </nav>
              ))}
              {(roleView === 'admin' || podeGrupo('financeiro') || podeGrupo('clientes')) && (recolhida ? (
                <>
                  <div style={{ height: 1, background: '#f0f0f0', margin: '10px 0' }} />
                  {podeGrupo('financeiro') && <NavBtn chave="rentabilidade" label="Financeiro" fontSize={13} />}
                  {roleView === 'admin' && (<>
                    <NavBtn chave="carga" label="Carga da equipe" fontSize={13} />
                    <NavBtn chave="usuarios" label="Colaboradores" fontSize={13} />
                    <NavBtn chave="reunioes" label="Reuniões internas" fontSize={13} />
                    <NavBtn chave="candidaturas" label="Candidaturas" fontSize={13} />
                    <NavBtn chave="recrutamento" label="Trabalhe Conosco" fontSize={13} />
                  </>)}
                  {podeGrupo('clientes') && <NavBtn chave="clientes" label="Clientes" fontSize={13} />}
                  {roleView === 'admin' && <NavBtn chave="config" label="Configurações" fontSize={13} />}
                </>
              ) : (
                <>
                  {podeGrupo('financeiro') && (<>
                    <div style={{ height: 1, background: '#f0f0f0', margin: '12px 0' }} />
                    <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px', padding: '0 4px' }}>Gestão</span>
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 12 }}>
                      <NavBtn chave="rentabilidade" label="Financeiro" fontSize={13} />
                    </nav>
                  </>)}
                  {roleView === 'admin' && (<>
                    {/* Pessoas e Cultura (inclui Carga da equipe) */}
                    <div style={{ height: 1, background: '#f0f0f0', margin: '12px 0' }} />
                    <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px', padding: '0 4px' }}>Pessoas e Cultura</span>
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <NavBtn chave="carga" label="Carga da equipe" fontSize={13} />
                      <NavBtn chave="usuarios" label="Colaboradores" fontSize={13} />
                      <NavBtn chave="reunioes" label="Reuniões internas" fontSize={13} />
                      <NavBtn chave="candidaturas" label="Candidaturas" fontSize={13} />
                      <NavBtn chave="recrutamento" label="Página Trabalhe Conosco" fontSize={13} />
                    </nav>
                  </>)}
                  {(roleView === 'admin' || podeGrupo('clientes')) && (<>
                    {/* Configurações — por último */}
                    <div style={{ height: 1, background: '#f0f0f0', margin: '12px 0' }} />
                    <button onClick={() => setConfigAberto(v => !v)} style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', margin: '0 0 6px',
                      background: 'none', border: 'none', cursor: 'pointer',
                    }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Configurações</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: configAberto ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M6 9l6 6 6-6" /></svg>
                    </button>
                    {configAberto && (
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {roleView === 'admin' && <NavBtn chave="config" label="Geral" fontSize={13} />}
                      {podeGrupo('clientes') && <NavBtn chave="clientes" label="Clientes" fontSize={13} />}
                    </nav>
                    )}
                  </>)}
                </>
              ))}
            </>
          )}

          {/* NIVEL CLIENTE — so na visualizacao como cliente (equipe vendo como) */}
          {verComoClienteId && !ehCliente && (
            <div>
              {!recolhida && <>
                <p style={{ margin: '0 0 4px', padding: '0 4px', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cliente</p>
                <p style={{ margin: '0 0 8px', padding: '0 4px', fontSize: 11, color: '#16a34a' }}>Vendo como: {clienteEmVisualizacao?.nome}</p>
              </>}
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {([['planner', 'Planner'], ['aprovacoes', 'Aprovações'], ['marca', 'Marca (Brand Board)'], ['listening', 'Social Listening'], ['analytics', 'Analytics']] as [string, string][]).map(([a, label]) => (
                  <NavBtn key={a} chave={a} label={label} onClick={() => setAba(a as any)} />
                ))}
              </nav>
            </div>
          )}

        </aside>

        {/* Botão recolher/expandir — flutuante (desktop; no mobile o menu é o hamburguer) */}
        {!ehCliente && !mobile && (
          <button onClick={alternarRecolhida} title={recolhida ? 'Expandir menu' : 'Recolher menu'} className="soma10-no-invert"
            style={{ position: 'fixed', left: recolhida ? 15 : 194, bottom: 16, zIndex: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', color: '#fff', border: 'none', borderRadius: 999, padding: '9px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.2)', transition: 'left 0.18s' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: recolhida ? 'none' : 'rotate(180deg)' }}><path d="M9 18l6-6-6-6" /></svg>
          </button>
        )}

        {/* Barra de navegacao inferior (mobile / cara de app) — equipe */}
        {mobile && !ehCliente && (
          <nav className="soma10-no-invert" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 140, background: '#fff', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-around', paddingBottom: 'env(safe-area-inset-bottom)', boxShadow: '0 -2px 12px rgba(0,0,0,0.06)' }}>
            {[{ k: 'home', label: 'Início' }, { k: 'meu-dia', label: 'Meu dia' }, { k: 'mensagens', label: 'Chat' }].map(it => {
              const ativo = aba === it.k && !menuMobile
              return (
                <button key={it.k} onClick={() => { setAba(it.k as any); setInboxAberto(false) }} style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '9px 0 5px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: ativo ? '#111' : '#9aa0a6' }}>
                  <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ICONE_ABA[it.k] || ICONE_ABA.default} /></svg>
                  <span style={{ fontSize: 10.5, fontWeight: ativo ? 700 : 500 }}>{it.label}</span>
                </button>
              )
            })}
            <button onClick={() => setMenuMobile(true)} style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '9px 0 5px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: menuMobile ? '#111' : '#9aa0a6' }}>
              <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
              <span style={{ fontSize: 10.5, fontWeight: menuMobile ? 700 : 500 }}>Menu</span>
            </button>
          </nav>
        )}

        {/* Conteúdo principal — o topo reserva a faixa do cluster flutuante. No
            mobile o cluster fica em (12px + safe-area) + ~46px de altura; em
            aparelho com notch a safe-area cresce e o título passava POR BAIXO do
            cluster. Por isso o topo acompanha a mesma safe-area (não é 64px fixo). */}
        <div ref={abaAnimRef} className="anim-aba" style={{ flex: 1, minWidth: 0, padding: mobile ? 'calc(68px + env(safe-area-inset-top)) 14px calc(76px + env(safe-area-inset-bottom))' : '70px 28px 28px', ...(mobile ? {} : { height: '100vh', overflowY: 'auto', boxSizing: 'border-box' }) }}>

        {/* Faixa: admin visualizando como um papel (colaborador) */}
        {previewPapel && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#92400e' }}>Visualizando como <b>{verComoPapel === 'gerente' ? 'Gerente' : 'Usuário'}</b> — você vê o menu que esse papel enxerga. Suas permissões reais não mudam.</span>
            <span style={{ flex: 1 }} />
            <button onClick={() => setVerComoPapel('')} style={{ padding: '6px 12px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Voltar à minha visão</button>
          </div>
        )}

        {/* Faixa indicando visualizacao filtrada por cliente (so para equipe, nao para o cliente logado) */}
        {clienteEmVisualizacao && !ehCliente && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, background: '#fffbeb', border: '1px solid #fde68a',
            borderRadius: 12, padding: '10px 16px', marginBottom: 20,
          }}>
            <span style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', background: '#ffc00f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: '#111', flexShrink: 0, border: '1px solid #fde68a' }}>
              <AvatarCliente logo={clienteEmVisualizacao.logo} nome={clienteEmVisualizacao.nome} />
            </span>
            <p style={{ margin: 0, fontSize: 13, color: '#92400e' }}>
              Você está visualizando o painel como o cliente <strong>{clienteEmVisualizacao.nome}</strong> (@{clienteEmVisualizacao.instagram?.replace(/^@/, '')}) — somente o conteúdo dele é exibido.
            </p>
            <button onClick={() => { setVerComoClienteId('') }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#92400e', fontWeight: 700, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
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
                        <span style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', background: '#ffc00f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10, color: '#111', flexShrink: 0 }}>
                          {(() => {
                            const cli = clientes.find(c => c.id === post.clienteId || c.nome === post.clienteNome)
                            return <AvatarCliente logo={cli?.logo} nome={post.clienteNome} />
                          })()}
                        </span>
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
                        <button onClick={() => {
                          const url = `${window.location.origin}/aprovar/${post.id}${(post as any).codigo ? `?c=${(post as any).codigo}` : ''}`
                          if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(() => toast('Link de aprovação copiado! Envie ao cliente.', 'sucesso')).catch(() => toast(url, 'info'))
                          else toast(url, 'info')
                        }} title="Copiar o link público de aprovação (sem login) para enviar ao cliente" style={{
                          padding: '8px 14px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, fontWeight: 700, fontSize: 12, color: '#111', cursor: 'pointer',
                        }}>
                          Copiar link
                        </button>
                      )}
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
              {criandoPost && <span style={{ width: 14, height: 14, border: '2px solid #bfdbfe', borderTopColor: '#1d4ed8', borderRadius: '50%', display: 'inline-block', animation: 'soma-girar 0.8s linear infinite', flexShrink: 0 }} />}
              <span>{rascunhoMsg || 'Processando...'}</span>
            </div>
            {criandoPost && (
              <div style={{ position: 'relative', height: 4, borderRadius: 999, background: '#dbeafe', overflow: 'hidden', marginTop: 10 }}>
                <div style={{ position: 'absolute', top: 0, bottom: 0, background: '#1d4ed8', borderRadius: 999, animation: 'barraInd 1.2s ease-in-out infinite' }} />
              </div>
            )}
            <style>{`@keyframes barraInd{0%{left:-40%;width:40%}50%{left:30%;width:50%}100%{left:100%;width:40%}}`}</style>
          </div>
        )}

        {/* CALENDÁRIO (avulso ou dentro do Planner) */}
        {(aba === 'calendario' || (aba === 'planner' && plannerView === 'calendario')) && (
          <div>
            {aba !== 'planner' && <h2 style={{ margin: '0 0 20px', fontSize: 18, color: '#111' }}>Calendário de Conteúdo</h2>}
            {/* Filtro de cliente — mesma seleção da Lista (persiste ao atualizar) */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              <select value={bibCliente} onChange={e => setBibCliente(e.target.value)}
                style={{ minWidth: 220, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}>
                <option value="">Todos os clientes</option>
                {clientes.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
              </select>
            </div>
            <Calendar posts={(bibCliente ? postsView.filter(p => p.clienteNome === bibCliente) : postsView) as any} onSelectPost={(p: any) => setPostPreview(p)} onAddPost={novoPostNoDia} onMovePost={moverPostData} />
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
                        <button onClick={async (e) => { e.stopPropagation(); if (await confirmar('Excluir este post? Esta ação não pode ser desfeita.', { titulo: 'Excluir post', okLabel: 'Excluir', perigo: true })) excluirPostDireto(post.id) }} title="Excluir"
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
                                <AvatarCliente logo={cli?.logo} nome={post.clienteNome} />
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
                  background: '#fff', borderRadius: 16, maxWidth: 420, width: '100%', overflowY: 'auto', maxHeight: '92vh', display: 'flex', flexDirection: 'column',
                }}>
                  {/* Cabeçalho estilo Instagram */}
                  {(() => { const clientePreview = clientes.find(c => c.id === postPreview.clienteId || c.nome === postPreview.clienteNome); return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: clientePreview?.corPrimaria || '#ffc00f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: clientePreview?.corSecundaria || '#111', flexShrink: 0 }}>
                      <AvatarCliente logo={clientePreview?.logo} nome={postPreview.clienteNome} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>{postPreview.clienteNome}</span>
                    <span style={{ marginLeft: 'auto', background: STATUS_COLOR[postPreview.status] || '#eee', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 600, color: STATUS_TEXT[postPreview.status] || '#333', cursor: postPreview.erroPublicacao ? 'pointer' : 'default' }}
                      onClick={() => { if (postPreview.erroPublicacao) toast(postPreview.erroPublicacao, 'erro', 'Motivo da falha') }}
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
                  {postPreview.imagens?.[0] && (() => {
                    const imgs = postPreview.imagens
                    const sidx = Math.min(postPreviewSlide, imgs.length - 1)
                    const m = imgs[sidx]
                    const ehVideo = /\.(mp4|mov|m4v)(\?|$)/i.test(m)
                    // Mostra o criativo no FORMATO REAL: o wrapper inline-block se ajusta
                    // à imagem (sem recorte), então os pinos das marcações caem no ponto certo.
                    return (
                      <div style={{ position: 'relative', width: '100%', background: '#000', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                        <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0, maxWidth: '100%' }}>
                        {ehVideo
                          ? <video src={m} poster={(postPreview as any).capasVideo?.[m]} controls playsInline muted style={{ display: 'block', maxWidth: '100%', maxHeight: '58vh' }} />
                          : <img src={m} alt="" style={{ display: 'block', maxWidth: '100%', maxHeight: '58vh' }} />}
                        {imgs.length > 1 && (
                          <>
                            {sidx > 0 && (
                              <button type="button" onClick={() => setPostPreviewSlide(sidx - 1)} aria-label="Anterior"
                                style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.85)', color: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                              </button>
                            )}
                            {sidx < imgs.length - 1 && (
                              <button type="button" onClick={() => setPostPreviewSlide(sidx + 1)} aria-label="Próxima"
                                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.85)', color: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                              </button>
                            )}
                            <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px' }}>{sidx + 1}/{imgs.length}</div>
                            <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5 }}>
                              {imgs.map((_, i) => (
                                <span key={i} onClick={() => setPostPreviewSlide(i)} style={{ width: 6, height: 6, borderRadius: '50%', background: i === sidx ? '#fff' : 'rgba(255,255,255,0.5)', boxShadow: '0 0 2px rgba(0,0,0,0.4)', cursor: 'pointer' }} />
                              ))}
                            </div>
                          </>
                        )}
                        {/* Marcações do cliente sobre a imagem (pinos numerados = itens da lista abaixo) */}
                        {!ehVideo && Array.isArray((postPreview as any).anotacoes) && (postPreview as any).anotacoes.map((a: any, i: number) => (
                          (typeof a?.x === 'number' && typeof a?.y === 'number' && ((a.img ?? 0) === sidx))
                            ? <div key={i} title={a.text || a.texto} style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, transform: 'translate(-50%,-50%)', zIndex: 6, width: 24, height: 24, borderRadius: '50%', background: '#ffc00f', color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, boxShadow: '0 2px 8px rgba(0,0,0,0.3)', border: '2px solid #fff' }}>{i + 1}</div>
                            : null
                        ))}
                        </div>
                      </div>
                    )
                  })()}

                  <div style={{ padding: 16 }}>
                    {postLegendaExpandida ? (
                      <p style={{ margin: '0 0 10px', fontSize: 13.5, color: '#262626', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        <strong>{postPreview.clienteNome}</strong>{' '}{postPreview.legenda}
                      </p>
                    ) : (
                      <div style={{ margin: '0 0 10px' }}>
                        <p style={{ margin: 0, fontSize: 13.5, color: '#262626', lineHeight: 1.5, wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          <strong>{postPreview.clienteNome}</strong>{' '}{postPreview.legenda}
                        </p>
                        {(postPreview.legenda || '').length > 80 && (
                          <button onClick={() => setPostLegendaExpandida(true)} style={{ background: 'none', border: 'none', padding: 0, marginTop: 2, color: '#8e8e8e', fontSize: 13.5, cursor: 'pointer' }}>... mais</button>
                        )}
                      </div>
                    )}
                    {postPreview.dataAgendada && (
                      <p style={{ margin: '0 0 10px', fontSize: 12, color: '#aaa' }}>
                        Agendado para {new Date(postPreview.dataAgendada).toLocaleString('pt-BR')}
                      </p>
                    )}
                    {((postPreview as any).motivoReprovacao || (postPreview as any).ajusteCriativo || (postPreview as any).ajusteCopy || (Array.isArray((postPreview as any).anotacoes) && (postPreview as any).anotacoes.length > 0)) && (() => {
                      const anot: any[] = Array.isArray((postPreview as any).anotacoes) ? (postPreview as any).anotacoes : []
                      // Texto do ajuste: link único grava em motivoReprovacao; portal em ajusteCriativo/ajusteCopy.
                      const textoAjuste = (postPreview as any).motivoReprovacao || (postPreview as any).ajusteCriativo || (postPreview as any).ajusteCopy || ''
                      const temMotivo = !!textoAjuste
                      const total = anot.length + (temMotivo ? 1 : 0)
                      const feitos = anot.filter(a => a.resolvido).length + (temMotivo && (postPreview as any).motivoResolvido ? 1 : 0)
                      const tudo = total > 0 && feitos === total
                      const podeReenviar = tudo && ['rascunho', 'corrigir', 'reprovado'].includes(postPreview.status)
                      const Check = ({ on }: { on: boolean }) => (
                        <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: 5, border: on ? '1.5px solid #16a34a' : '1.5px solid #d6c48f', background: on ? '#16a34a' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1, cursor: 'pointer' }}>
                          {on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                        </span>
                      )
                      return (
                        <div style={{ margin: '0 0 10px', fontSize: 12.5, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', lineHeight: 1.5 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <strong>{postPreview.status === 'reprovado' ? 'Motivo da reprovação (cliente):' : 'Ajuste solicitado (cliente):'}</strong>
                            {total > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: tudo ? '#16a34a' : '#b45309', whiteSpace: 'nowrap' }}>{feitos}/{total} resolvido{total > 1 ? 's' : ''}</span>}
                          </div>
                          <p style={{ margin: '2px 0 6px', fontSize: 10.5, color: '#b98a2e' }}>Marque cada item ao resolver. Ao concluir tudo, libera o reenvio para aprovação.</p>
                          {temMotivo && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '3px 0' }}>
                              <span onClick={() => aplicarPatchPostPreview(postPreview.id, { motivoResolvido: !(postPreview as any).motivoResolvido })}><Check on={!!(postPreview as any).motivoResolvido} /></span>
                              <span style={{ flex: 1, whiteSpace: 'pre-wrap', textDecoration: (postPreview as any).motivoResolvido ? 'line-through' : 'none', opacity: (postPreview as any).motivoResolvido ? 0.55 : 1 }}>{textoAjuste}</span>
                            </div>
                          )}
                          {anot.map((a, i) => {
                            const temPonto = typeof a?.x === 'number' && typeof a?.y === 'number'
                            const done = !!a.resolvido
                            return (
                              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '3px 0' }}>
                                <span onClick={() => marcarAnotacaoResolvida(postPreview, i, !done)}><Check on={done} /></span>
                                <span onClick={() => temPonto && setPostPreviewSlide(a.img ?? 0)} title={temPonto ? 'Ver ponto na imagem' : ''} style={{ flexShrink: 0, width: 18, height: 18, borderRadius: '50%', background: temPonto ? '#ffc00f' : '#e5d5a8', color: '#111', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1, cursor: temPonto ? 'pointer' : 'default' }}>{i + 1}</span>
                                <span style={{ flex: 1, textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.55 : 1 }}>{a.text || a.texto}{temPonto && (postPreview.imagens?.length || 0) > 1 ? <em style={{ color: '#c99a3a' }}> · slide {(a.img ?? 0) + 1}</em> : null}</span>
                              </div>
                            )
                          })}
                          {podeReenviar && (
                            <button onClick={() => reenviarAprovacao(postPreview)} className="soma10-no-invert" style={{ marginTop: 10, width: '100%', padding: '10px 0', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}>Tudo resolvido — Reenviar para aprovação</button>
                          )}
                          {tudo && !podeReenviar && <div style={{ marginTop: 8, fontSize: 11.5, color: '#16a34a', fontWeight: 700 }}>Todas as alterações resolvidas ✓</div>}
                        </div>
                      )
                    })()}
                    {postPreview.status === 'falha_publicacao' && postPreview.erroPublicacao && (
                      <p style={{ margin: '0 0 10px', fontSize: 12, color: '#b91c1c', background: '#fef2f2', borderRadius: 8, padding: '8px 10px' }}>Erro: {postPreview.erroPublicacao}</p>
                    )}
                    {postPreview.status === 'falha_publicacao' && (
                      <button onClick={() => republicarPost(postPreview)} disabled={republicandoId === postPreview.id} className="soma10-no-invert" style={{ width: '100%', padding: '11px 0', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: republicandoId === postPreview.id ? 'not-allowed' : 'pointer', marginBottom: 8 }}>
                        {republicandoId === postPreview.id ? 'Publicando...' : 'Tentar publicar novamente'}
                      </button>
                    )}
                    {role !== 'cliente' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11.5, color: '#888', fontWeight: 600 }}>Reaproveitar como:</span>
                        {(['feed', 'reel', 'story'] as const).map(f => (
                          <button key={f} onClick={() => reaproveitar(postPreview, f)} style={{ padding: '6px 12px', background: '#eef2ff', color: '#1d4ed8', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', textTransform: 'capitalize' }}>{f}</button>
                        ))}
                      </div>
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
                  <AvatarCliente logo={clienteEmVisualizacao?.logo} nome={clienteEmVisualizacao?.nome} />
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

            {/* Ativos da marca — SEMPRE visível (não fica escondido no modo editar) */}
            {verComoClienteId && (
              <div style={{ background: '#fff', borderRadius: 16, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginTop: 16 }}>
                <ReferenciasVisuais clienteId={verComoClienteId} />
              </div>
            )}

            {/* Tipografia e vibe da marca — alimenta o motor de criativos */}
            {verComoClienteId && (
              <div style={{ background: '#fff', borderRadius: 16, padding: 22, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginTop: 16 }}>
                <FontesMarca clienteId={verComoClienteId} />
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

              {/* Playbook da marca — regras operacionais curadas por humano (agentes de IA leem) */}
              <div style={{ borderTop: '1px solid #eee', paddingTop: 18, marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <h3 style={{ margin: 0, fontSize: 15, color: '#111' }}>Playbook da marca</h3>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>
                      Regras de operação (o que funciona, do&apos;s &amp; don&apos;ts, restrições) que os agentes de IA seguem ao produzir para este cliente.
                    </p>
                  </div>
                  {verComoClienteId && <PlaybookBotao clienteId={verComoClienteId} clienteNome={(clientes.find((c: any) => c.id === verComoClienteId) as any)?.nome} />}
                </div>
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
                <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
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
                      { label: 'Posts no período', valor: analyticsData.totais?.posts, anterior: ant.posts },
                      { label: 'Curtidas', valor: analyticsData.totais?.curtidas, anterior: ant.curtidas },
                      { label: 'Comentários', valor: analyticsData.totais?.comentarios, anterior: ant.comentarios },
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
            <button onClick={fecharComposer} title="Volta salvando o que já foi preenchido" style={{ background: 'none', border: 'none', color: '#888', fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
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
              aoMudar={v => { composerValor.current = v }}
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
          <DashboardHome clientes={clientes as any} posts={posts as any} perfilClinica={perfilClinica} perfilTurismo={perfilTurismo} perfilTelefonia={perfilTelefonia} lojaAtiva={verComoLojaId} onVerCliente={(id: string) => router.push(`/cliente/${id}`)} onIr={(a: string) => setAba(a as any)} />
        )}

        {/* CLIENTES */}
        {conectarRedesCliente !== null && (
          <ConectarRedesModal
            clienteId={conectarRedesCliente || null}
            clienteNome={clientes.find(c => c.id === conectarRedesCliente)?.nome}
            comoNovaConta={conectarComoNova}
            onClose={() => { setConectarRedesCliente(null); setConectarComoNova(false) }}
          />
        )}

        {aba === 'studio' && (
          <StudioMes clientes={clientes} clienteFixo={verComoClienteId || undefined} podeEditar={podeNivelDash('producao', 'editar')} podeExcluir={podeNivelDash('producao', 'excluir')} podeGerarIA={podeAcaoDash('gerar_ia')} podeEnviarCliente={podeAcaoDash('enviar_cliente')}
            postsGlobais={posts as any} usuariosEquipe={usuarios.map((u: any) => ({ nome: u.nome, email: u.email }))} meuEmail={(session?.user as any)?.email || ''}
            onAbrirComposer={(pauta: any) => {
            setComposerPrefill({ clienteId: pauta.clienteId, legenda: pauta.legenda || '', imagens: pauta.imagens || [], formato: pauta.formato || 'feed', colaboradores: pauta.colaboradores || [], capasVideo: pauta.capasVideo || {}, redes: pauta.redes || ['instagram', 'facebook'] })
            setEditandoPostId(pauta.id)
            setAba('novo-post')
          }} />
        )}

        {/* Agenda (clínicas/serviços) — grupo Produção */}
        {aba === 'agenda' && role !== 'cliente' && (
          <Agenda
            usuarios={usuarios.filter((u: any) => u.role !== 'cliente').map((u: any) => ({ nome: u.nome, email: u.email, areaSaude: u.areaSaude, corAgenda: u.corAgenda, recebeAgenda: u.recebeAgenda, role: u.role }))}
            meuEmail={(session?.user as any)?.email || ''}
            perfilClinica={perfilClinica}
            podeEditar={podeNivelDash('producao', 'editar')}
          />
        )}

        {/* Clínica — catálogo de Procedimentos e Métodos */}
        {aba === 'procedimentos' && perfilClinica && role !== 'cliente' && (
          <Procedimentos podeEditar={role === 'admin' || role === 'gerente'} />
        )}

        {/* Operação turismo — Viagens / Ônibus */}
        {aba === 'viagens' && perfilTurismo && role !== 'cliente' && (
          <Viagens podeEditar={podeNivelDash('crm', 'editar')} podeExcluir={podeNivelDash('crm', 'excluir')} />
        )}
        {aba === 'calendario-viagens' && perfilTurismo && role !== 'cliente' && (
          <CalendarioViagens onAbrirViagem={() => setAba('viagens' as any)} />
        )}
        {aba === 'reservas' && perfilTurismo && role !== 'cliente' && (
          <Reservas podeEditar={podeNivelDash('crm', 'editar')} podeExcluir={podeNivelDash('crm', 'excluir')} meuEmail={(session?.user as any)?.email || ''} meuNome={session?.user?.name || ''} />
        )}
        {aba === 'frota' && perfilTurismo && role !== 'cliente' && (
          <Frota podeEditar={podeNivelDash('crm', 'editar')} podeExcluir={podeNivelDash('crm', 'excluir')} />
        )}

        {/* Varejo telefonia — Produtos/Estoque */}
        {aba === 'produtos' && perfilTelefonia && role !== 'cliente' && (
          <Produtos podeEditar={podeNivelDash('crm', 'editar')} podeExcluir={podeNivelDash('crm', 'excluir')} lojaAtiva={verComoLojaId} podeGerirLojas={role === 'admin'} />
        )}

        {/* Varejo telefonia — PDV (vendas) */}
        {aba === 'vendas' && perfilTelefonia && role !== 'cliente' && (
          <Vendas lojaAtiva={verComoLojaId} bloqueado={podeTrocarLoja && !verComoLojaId} podeEditar={role === 'vendas' || podeNivelDash('crm', 'editar')} />
        )}

        {/* Assessoria cidadania — esteira de Processos */}
        {aba === 'processos' && perfilCidadania && role !== 'cliente' && (
          <Processos podeEditar={podeNivelDash('crm', 'editar')} podeExcluir={podeNivelDash('crm', 'excluir')} />
        )}

        {/* Reuniões internas — Pessoas e Cultura (admin) */}
        {aba === 'reunioes' && role === 'admin' && (
          <Reunioes usuarios={usuarios.filter((u: any) => u.role !== 'cliente').map((u: any) => ({ nome: u.nome, email: u.email }))} podeEditar />
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
                <p style={{ margin: 0, fontSize: 14, color: '#888', fontWeight: 500 }}>Nenhuma notificação por enquanto.</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#bbb' }}>Você será notificado sobre tarefas, aprovações, mensagens e prazos.</p>
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
                      // Com destino (tarefa/post): vai direto. Sem destino: abre o detalhe da notificacao.
                      const temDestino = n.tarefaId || (n.postId && posts.some((x: any) => x.id === n.postId))
                      if (temDestino) abrirItemNotificacao(n)
                      else setNotifAberta(n)
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

        {/* Modal da notificacao aberta (abre dentro do Inbox, sem navegar) */}
        {notifAberta && (
          <div onClick={fecharFora(() => setNotifAberta(null), { perguntar: false })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 460, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 17, color: '#111', lineHeight: 1.3 }}>{notifAberta.titulo}</h3>
                <button onClick={() => setNotifAberta(null)} style={{ background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
              </div>
              <p style={{ margin: '0 0 14px', fontSize: 14, color: '#444', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{notifAberta.mensagem}</p>
              <span style={{ fontSize: 12, color: '#aaa' }}>{new Date(notifAberta.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              {(notifAberta.tarefaId || notifAberta.postId || notifAberta.tipo?.startsWith('tarefa_') || notifAberta.tipo === 'mensagem_privada') && (
                <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => abrirItemNotificacao(notifAberta)} className="soma10-no-invert" style={{ padding: '10px 18px', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                    {notifAberta.tarefaId ? 'Abrir tarefa →' : 'Abrir item relacionado →'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Carregando a tarefa de uma notificação */}
        {carregandoTarefaNotif && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: '16px 22px', fontSize: 13, fontWeight: 700, color: '#555', boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }}>Abrindo tarefa...</div>
          </div>
        )}

        {/* Tarefa aberta a partir de uma notificação (sobreposto, sem trocar de aba) */}
        {/* Modal de compartilhamento do link de aprovação (após "Enviar para aprovação") */}
        {linkAprovModal && (
          <div onClick={fecharFora(() => setLinkAprovModal(null), { perguntar: false })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 20 }}>
            <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, maxWidth: 460, width: '100%', padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </span>
                <h3 style={{ margin: 0, fontSize: 16.5, color: '#111' }}>Link de aprovação — {linkAprovModal.cliente}</h3>
              </div>
              <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#888', lineHeight: 1.5 }}>Compartilhe este link com o cliente. Ele lista todos os materiais aguardando aprovação, sem precisar de login.</p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input readOnly value={linkAprovModal.url} onFocus={e => e.currentTarget.select()} style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 9, border: '1px solid #e6e6e6', fontSize: 12.5, color: '#333', background: '#fafafa', fontFamily: 'inherit' }} />
                <button onClick={() => { if (navigator.clipboard?.writeText) navigator.clipboard.writeText(linkAprovModal.url).then(() => toast('Link copiado!', 'sucesso')).catch(() => {}) }}
                  style={{ padding: '10px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap' }}>Copiar</button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent('Olá! Segue o material para sua aprovação:\n' + linkAprovModal.url)}`, '_blank')}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 0', background: '#25d366', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.4A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.4c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.6 0a6.6 6.6 0 0 1-2-1.2 7.4 7.4 0 0 1-1.3-1.7c-.2-.3 0-.4.1-.5l.4-.5.3-.4v-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3 1 2.6 1.1 2.7s1.9 3 4.6 4.1c2.3 1 2.3.6 2.7.6.4 0 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1z" /></svg>
                  WhatsApp
                </button>
                <button onClick={() => window.open(linkAprovModal.url, '_blank')} style={{ padding: '11px 18px', background: '#fff', color: '#555', border: '1px solid #e6e6e6', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Abrir</button>
                <button onClick={() => setLinkAprovModal(null)} style={{ padding: '11px 18px', background: '#f0f0f0', color: '#666', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Fechar</button>
              </div>
            </div>
          </div>
        )}

        {tarefaNotif && (
          <TarefaModalNotif
            key={tarefaNotif.id}
            tarefa={tarefaNotif}
            clientes={clientes as any}
            usuarios={usuarios as any}
            onClose={() => setTarefaNotif(null)}
            onSalvo={() => setTarefaNotif(null)}
            onRecarregar={(t: any) => setTarefaNotif(t)}
            onExcluir={async () => { await fetch(`/api/tarefas?id=${tarefaNotif.id}`, { method: 'DELETE' }).catch(() => {}); setTarefaNotif(null) }}
          />
        )}

        {aba === 'tarefas' && (
          <GestaoTarefas clientes={clientes as any} usuarios={usuarios as any} perfilClinica={perfilClinica} perfilTurismo={perfilTurismo} perfilCidadania={perfilCidadania} perfilTelefonia={perfilTelefonia} abrirTarefaId={tarefaAbrirId} onAbriuTarefa={() => setTarefaAbrirId(null)} podeEditar={podeNivelDash('producao', 'editar')} podeExcluir={podeNivelDash('producao', 'excluir')} />
        )}

        {aba === 'campanhas' && (
          <Briefings clientes={clientes as any} />
        )}

        {aba === 'crm' && role !== 'cliente' && (
          <CRM usuarios={usuarios as any} perfilClinica={perfilClinica} perfilTurismo={perfilTurismo} perfilCidadania={perfilCidadania} perfilTelefonia={perfilTelefonia} lojaAtiva={verComoLojaId} podeTrocarLoja={podeTrocarLoja} onIrAgenda={() => setAba('agenda' as any)} onIrProcessos={() => setAba('processos' as any)} podeEditar={role === 'vendas' || podeNivelDash('crm', 'editar')} podeExcluir={role === 'vendas' || podeNivelDash('crm', 'excluir')} onClienteCriado={() => fetch('/api/clientes').then(r => r.json()).then(d => { if (Array.isArray(d)) setClientes(d) }).catch(() => {})} />
        )}

        {aba === 'candidaturas' && role === 'admin' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button onClick={() => {
                const url = `${window.location.origin}/trabalhe-conosco`
                const nav: any = navigator
                if (nav.share) { nav.share({ title: 'Trabalhe conosco — Grupo 10+', url }).catch(() => {}) }
                else { navigator.clipboard?.writeText(url); toast('Link copiado para a área de transferência.', 'sucesso') }
              }} className="soma10-no-invert" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#111', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
                Compartilhar link da candidatura
              </button>
            </div>
            <Candidaturas />
          </div>
        )}

        {aba === 'minha-conta' && (
          <MinhaConta />
        )}

        {aba === 'playbook' && (
          <Playbook clientes={clientes as any} podeEditar={podeNivelDash('estrategia', 'editar')} podeExcluir={podeNivelDash('estrategia', 'excluir')} />
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
              <div style={{ marginBottom: 20 }}>
                <button onClick={() => setMostrarFormCliente(v => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 20px', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                  {mostrarFormCliente ? 'Fechar' : '+ Cadastrar novo cliente'}
                </button>
                {mostrarFormCliente && (
                <div style={{ background: '#fff', borderRadius: 14, padding: 20, marginTop: 12, border: '1px solid #e8e8e8' }}>
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
                    {/* Cobranças avulsas / modulares */}
                    <div style={{ marginTop: 12, width: '100%' }}>
                      <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#888', marginBottom: 6 }}>Cobranças avulsas / modulares (por mês)</label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
                        <input type="month" value={avMes} onChange={e => setAvMes(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, fontFamily: 'inherit' }} />
                        <input type="number" min="0" placeholder="Valor R$" value={avValor} onChange={e => setAvValor(e.target.value)} style={{ width: 100, padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, fontFamily: 'inherit' }} />
                        <input placeholder="Descrição" value={avDesc} onChange={e => setAvDesc(e.target.value)} style={{ flex: 1, minWidth: 120, padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, fontFamily: 'inherit' }} />
                        <button type="button" onClick={() => { if (!avMes || !(Number(avValor) > 0)) return; const nova = { id: Math.random().toString(36).slice(2), mes: avMes, valor: Number(avValor), descricao: avDesc.trim() }; setNovoCliente(p => ({ ...p, receitasAvulsas: [...((p.receitasAvulsas) || []), nova] })); setAvValor(''); setAvDesc('') }} style={{ padding: '7px 12px', background: (avMes && Number(avValor) > 0) ? '#111' : '#f0f0f0', color: (avMes && Number(avValor) > 0) ? '#fff' : '#aaa', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ Adicionar</button>
                      </div>
                      {((novoCliente.receitasAvulsas) || []).length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {(novoCliente.receitasAvulsas || []).map((r) => (
                            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#555', padding: '4px 8px', background: '#fafafa', borderRadius: 6 }}>
                              <span style={{ fontWeight: 700, color: '#111' }}>{Number(r.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                              <span style={{ color: '#aaa' }}>{r.mes}</span>
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.descricao}</span>
                              <button type="button" onClick={() => setNovoCliente(p => ({ ...p, receitasAvulsas: (p.receitasAvulsas || []).filter(x => x.id !== r.id) }))} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 14 }}>×</button>
                            </div>
                          ))}
                        </div>
                      )}
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
              </div>
            )}
            {/* Busca + filtros + toggle de visualização */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                <input value={clienteBusca} onChange={e => setClienteBusca(e.target.value)} placeholder="Buscar por nome, @ ou e-mail..." style={{ width: '100%', padding: '9px 34px 9px 36px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                {clienteBusca && <button onClick={() => setClienteBusca('')} aria-label="Limpar busca" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 17, lineHeight: 1, padding: 4 }}>×</button>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([['todos', 'Todos'], ['renovar', 'A renovar'], ['sem_conexao', 'Sem conexão'], ['com_addon', 'Com add-on'], ['suspenso', 'Suspensos']] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setClienteFiltro(k)}
                    style={{ padding: '7px 13px', borderRadius: 999, border: clienteFiltro === k ? '1.5px solid #111' : '1px solid #e5e7eb', background: clienteFiltro === k ? '#111' : '#fff', color: clienteFiltro === k ? '#fff' : '#6b7280', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
                ))}
              </div>
              <div style={{ display: 'inline-flex', background: '#f0f0f0', borderRadius: 9, padding: 3 }}>
                {(['lista', 'blocos'] as const).map(v => (
                  <button key={v} onClick={() => { setClientesView(v); try { localStorage.setItem('clientesView', v) } catch {} }}
                    style={{ padding: '6px 16px', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, textTransform: 'capitalize', background: clientesView === v ? '#fff' : 'transparent', color: clientesView === v ? '#111' : '#888', boxShadow: clientesView === v ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}>{v}</button>
                ))}
              </div>
            </div>

            {(() => {
              const q = clienteBusca.trim().toLowerCase()
              const match = (c: any) => {
                if (q && !(`${c.nome || ''} ${c.instagram || ''} ${c.loginEmail || ''}`.toLowerCase().includes(q))) return false
                if (clienteFiltro === 'com_addon') return totalMensalModulos(c.modulos) > 0
                if (clienteFiltro === 'suspenso') return !!c.inadimplente
                if (clienteFiltro === 'sem_conexao') return !c.facebookPageId && !c.instagramConectado && !c.instagramUserId
                if (clienteFiltro === 'renovar') { if (!c.contratoRenovacao) return false; return Math.ceil((new Date(c.contratoRenovacao).getTime() - Date.now()) / 86400000) <= 30 }
                return true
              }
              const grupos = [{ titulo: 'Clientes', lista: clientes.filter(c => (c as any).tipo !== 'interno' && match(c)) }, { titulo: 'Projetos internos', lista: clientes.filter(c => (c as any).tipo === 'interno' && match(c)) }]
              if (grupos.every(g => g.lista.length === 0)) return (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: '#aaa', fontSize: 14, background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>Nenhum cliente encontrado{(clienteBusca || clienteFiltro !== 'todos') ? ' com esse filtro.' : '.'}</div>
              )
              return grupos.map(g => g.lista.length === 0 ? null : (
              <div key={g.titulo} style={{ marginBottom: 24 }}>
                <h3 style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{g.titulo} <span style={{ color: '#ccc' }}>({g.lista.length})</span></h3>
                <div style={clientesView === 'blocos' ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 12 } : { display: 'flex', flexDirection: 'column', gap: 10 }}>
              {g.lista.map(c => (
                <div key={c.id} className="cliente-card" style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', height: 'fit-content' }}>
                  <div onClick={() => iniciarEdicaoCliente(c)} style={{ padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 14, cursor: 'pointer' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: c.corPrimaria || '#f5f5f5', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <AvatarCliente logo={c.logo} nome={c.nome} clienteId={c.id} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {c.nome}
                        <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '1px 8px', background: (c as any).tipo === 'interno' ? '#dbeafe' : '#f0fdf4', color: (c as any).tipo === 'interno' ? '#1d4ed8' : '#16a34a' }}>{(c as any).tipo === 'interno' ? 'Projeto interno' : 'Cliente'}</span>
                        {(c as any).inadimplente && <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '1px 8px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>Suspenso</span>}
                        {clientesView !== 'blocos' && (() => { const cc = c as any; const temBrand = !!(cc.segmento || cc.palavrasChave || cc.descricao || cc.publicoAlvo || cc.tomDeVoz || cc.preferencias || cc.documentoMarca); return temBrand ? (
                          <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '1px 8px', background: '#f3e8ff', color: '#7c3aed' }}>Brand Board{cc.documentoMarca ? ' + IA' : ''}</span>
                        ) : null })()}
                      </p>
                      {/* Na visualizacao em BLOCO, o tile mostra so a previa (nome + tipo). O resto (contato, renovacao, status) fica na Lista e na ficha. */}
                      {clientesView !== 'blocos' && (
                        <>
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
                        </>
                      )}
                    </div>
                    {clientesView !== 'blocos' && (() => {
                      const temFB = !!c.facebookPageId
                      const temIG = !!(c.instagramConectado || c.instagramUserId)
                      const nPosts = posts.filter(p => p.clienteNome === c.nome).length
                      const dotS: React.CSSProperties = { width: 7, height: 7, borderRadius: '50%', display: 'inline-block', flexShrink: 0 }
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#cbd0d6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                            {(temIG || temFB) ? (
                              <span style={{ display: 'inline-flex', gap: 3 }} title={`${temIG ? 'Instagram ' : ''}${temFB ? 'Facebook ' : ''}conectado`}>
                                {temIG && <span style={{ ...dotS, background: '#c2185b' }} />}
                                {temFB && <span style={{ ...dotS, background: '#1877f2' }} />}
                              </span>
                            ) : (
                              <span style={{ ...dotS, background: '#e5e7eb' }} title="Sem redes conectadas" />
                            )}
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>{nPosts} {nPosts === 1 ? 'post' : 'posts'}</span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  {/* Ficha completa do cliente — modal com todas as informações */}
                  {editandoCliente === c.id && (() => {
                    const temFB = !!c.facebookPageId
                    const temIG = !!(c.instagramConectado || c.instagramUserId)
                    const nPosts = posts.filter(p => p.clienteNome === c.nome).length
                    const mbtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 9, padding: '8px 13px', fontSize: 12.5, fontWeight: 600, color: '#374151', cursor: 'pointer', lineHeight: 1, whiteSpace: 'nowrap' }
                    const mchip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, padding: '5px 11px', fontSize: 12, fontWeight: 600, lineHeight: 1 }
                    const secLabel: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }
                    const secDiv: React.CSSProperties = { marginTop: 16, paddingTop: 16, borderTop: '1px dashed #e5e7eb' }
                    const igIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8z"/></svg>
                    const fbIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    return (
                    <div onClick={fecharFora(() => setEditandoCliente(null))} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1200, padding: '5vh 16px', overflowY: 'auto' }}>
                      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, maxWidth: 800, width: '100%', boxShadow: '0 24px 70px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }}>
                        {/* Cabeçalho do modal */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 22px', borderBottom: '1px solid #eef0f2', flexShrink: 0 }}>
                          <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', background: c.corPrimaria || '#f5f5f5', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <AvatarCliente logo={c.logo} nome={c.nome} clienteId={c.id} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: 17, color: '#111' }}>{c.nome}</p>
                            <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#94a3b8' }}>Ficha do cliente{c.loginEmail ? ' · ' + c.loginEmail : ''}</p>
                          </div>
                          <button onClick={() => setEditandoCliente(null)} aria-label="Fechar" style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                          </button>
                        </div>
                        {/* Corpo rolável */}
                        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 22px' }}>
                          {c.tipo !== 'interno' && (
                            <div>
                              <span style={secLabel}>Compartilhar com o cliente</span>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button onClick={() => abrirResumo(c.id)} title="Gerar o resumo da semana para enviar ao cliente" style={mbtn}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="#25D366"><path d="M12 2a10 10 0 0 0-8.6 15l-1.4 5 5.2-1.4A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-2 .9-2.2.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.1.1.3 0 .5l-.4.5-.2.2c-.1.1-.3.3-.1.5.1.3.7 1.1 1.4 1.8.96.85 1.7 1.1 2 1.2.2.1.4.1.5-.1l.7-.8c.2-.2.4-.2.6-.1l1.8.9c.2.1.4.2.4.3.1.1.1.6-.1 1.2z" /></svg>
                                  Resumo semanal
                                </button>
                                <button onClick={() => statusPublico(c.id)} title="Copiar o link público de status (sem login)" style={mbtn}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></svg>
                                  Status público
                                </button>
                                <button onClick={() => revogarLinkStatus(c.id)} title="Revoga o link de status atual (para de funcionar) e gera um novo" style={{ ...mbtn, color: '#b91c1c', borderColor: '#fecaca' }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.5 2.8L3 8" /><path d="M3 3v5h5" /></svg>
                                  Revogar status
                                </button>
                                <button onClick={() => linkAprovacao(c.id)} title="Copiar o link ÚNICO de aprovação (sem login)" style={{ ...mbtn, background: '#111', border: '1px solid #111', color: '#fff' }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                  Link de aprovação
                                </button>
                                <button onClick={() => revogarLinkAprovacao(c.id, c.nome)} title="Revoga o link atual (para de funcionar) e gera um novo" style={{ ...mbtn, color: '#b91c1c', borderColor: '#fecaca' }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.5 2.8L3 8" /><path d="M3 3v5h5" /></svg>
                                  Revogar link
                                </button>
                              </div>
                            </div>
                          )}
                          <div style={c.tipo !== 'interno' ? secDiv : undefined}>
                            <span style={secLabel}>Conexões</span>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                              {temIG && <span style={{ ...mchip, background: '#fdecf3', color: '#c2185b' }}>{igIcon}Instagram{c.instagramUsername ? ' · @' + c.instagramUsername : ''}</span>}
                              {temFB && <span style={{ ...mchip, background: '#e7f0fd', color: '#1877f2' }}>{fbIcon}Facebook</span>}
                              {role === 'admin' ? (
                                <>
                                  {!temIG && <a href={`/api/instagram/oauth?cliente=${c.id}`} style={{ ...mbtn, textDecoration: 'none', color: '#c2185b' }}>{igIcon} Conectar Instagram</a>}
                                  {!temFB && <a href={`/api/meta/oauth?cliente=${c.id}`} style={{ ...mbtn, textDecoration: 'none', color: '#1877f2' }}>{fbIcon} Conectar Facebook</a>}
                                  {(temFB || temIG) && <button onClick={async () => { if (await confirmar(`Desconectar as redes sociais de ${c.nome}? O perfil perdera o acesso para publicacao ate ser reconectado.`, { titulo: 'Desconectar redes', okLabel: 'Desconectar', perigo: true })) desconectarInstagram(c.id) }} style={{ ...mbtn, color: '#9ca3af' }}>Desconectar</button>}
                                </>
                              ) : (!temFB && !temIG) ? <span style={{ ...mchip, background: '#fff7ed', color: '#b45309' }}>Não conectado</span> : null}
                              <span style={{ ...mchip, marginLeft: 'auto', background: '#f3f4f6', color: '#6b7280' }}>{nPosts} {nPosts === 1 ? 'post' : 'posts'}</span>
                            </div>
                          </div>
                          <span style={{ ...secLabel, marginTop: 16, paddingTop: 16, borderTop: '1px dashed #e5e7eb' }}>Dados do cliente</span>
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
                            <label style={{ fontSize: 11, color: '#888', display: 'flex', flexDirection: 'column', gap: 2 }}>Dia de vencimento
                              <input type="number" min="1" max="31" value={(edicaoCliente as any).diaVencimento || ''} onChange={e => setEdicaoCliente(p => ({ ...p, diaVencimento: Number(e.target.value) || undefined } as any))} placeholder="ex.: 10"
                                style={{ width: 90, padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} /></label>
                          </div>
                          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#bbb' }}>Valor mensal recorrente. Para projeto pontual ou valores diferentes mês a mês, use as cobranças abaixo.</p>

                          {/* Cobranças avulsas / modulares (pontual ou valor por mês) */}
                          <div style={{ marginTop: 12 }}>
                            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#888', marginBottom: 6 }}>Cobranças avulsas / modulares (por mês)</label>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
                              <input type="month" value={avMes} onChange={e => setAvMes(e.target.value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, fontFamily: 'inherit' }} />
                              <input type="number" min="0" placeholder="Valor R$" value={avValor} onChange={e => setAvValor(e.target.value)} style={{ width: 100, padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, fontFamily: 'inherit' }} />
                              <input placeholder="Descrição (ex.: Landing page)" value={avDesc} onChange={e => setAvDesc(e.target.value)} style={{ flex: 1, minWidth: 120, padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, fontFamily: 'inherit' }} />
                              <button type="button" onClick={() => {
                                if (!avMes || !(Number(avValor) > 0)) return
                                const nova = { id: Math.random().toString(36).slice(2), mes: avMes, valor: Number(avValor), descricao: avDesc.trim() }
                                setEdicaoCliente(p => ({ ...p, receitasAvulsas: [...(((p as any).receitasAvulsas) || []), nova] } as any))
                                setAvValor(''); setAvDesc('')
                              }} style={{ padding: '7px 12px', background: (avMes && Number(avValor) > 0) ? '#111' : '#f0f0f0', color: (avMes && Number(avValor) > 0) ? '#fff' : '#aaa', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ Adicionar</button>
                            </div>
                            {(((edicaoCliente as any).receitasAvulsas) || []).length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                {((edicaoCliente as any).receitasAvulsas as any[]).map((r) => (
                                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#555', padding: '4px 8px', background: '#fafafa', borderRadius: 6 }}>
                                    <span style={{ fontWeight: 700, color: '#111' }}>{Number(r.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    <span style={{ color: '#aaa' }}>{r.mes}</span>
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.descricao}</span>
                                    <button type="button" onClick={() => setEdicaoCliente(p => ({ ...p, receitasAvulsas: (((p as any).receitasAvulsas) || []).filter((x: any) => x.id !== r.id) } as any))} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 14 }}>×</button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Passagem de bastão (vendas → gestão) — vem da conversão do CRM */}
                      {'handoffVendas' in edicaoCliente && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #eee' }}>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 2 }}>Passagem de bastão (vendas → onboarding)</label>
                          <p style={{ margin: '0 0 8px', fontSize: 11, color: '#bbb' }}>Contexto da venda transmitido pelo closer. Edite/complemente conforme o onboarding avança.</p>
                          <textarea value={(edicaoCliente as any).handoffVendas || ''} onChange={e => setEdicaoCliente(p => ({ ...p, handoffVendas: e.target.value } as any))} placeholder="Sem passagem de bastão registrada (clientes criados pela conversão do CRM trazem este resumo automaticamente)."
                            style={{ width: '100%', minHeight: 110, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical', whiteSpace: 'pre-wrap' }} />
                        </div>
                      )}

                      {/* Papéis do squad — quem faz O QUÊ neste cliente */}
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #eee' }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 2 }}>Papéis do squad</label>
                        <p style={{ margin: '0 0 8px', fontSize: 11, color: '#bbb' }}>Quem ocupa cada função neste cliente. Quem entra aqui entra no squad automaticamente.</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginBottom: 14 }}>
                          {PAPEIS_SQUAD.map(p => (
                            <div key={p.chave}>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#999', marginBottom: 4 }} title={p.descricao}>{p.label}</label>
                              <select value={((edicaoCliente as any).squadPapeis || {})[p.chave] || ''}
                                onChange={e => setEdicaoCliente(prev => ({ ...prev, squadPapeis: { ...((prev as any).squadPapeis || {}), [p.chave]: e.target.value } } as any))}
                                style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 12.5, fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box' }}>
                                <option value="">A definir</option>
                                {usuarios.filter((u: any) => u.role !== 'cliente').map((u: any) => <option key={u.email} value={u.email}>{u.nome || u.email}</option>)}
                              </select>
                            </div>
                          ))}
                        </div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 2 }}>Squad do cliente</label>
                        <p style={{ margin: '0 0 8px', fontSize: 11, color: '#bbb' }}>Quem mais acompanha este cliente, além dos papéis acima. É esta lista que recebe as notificações.</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {usuarios.filter((u: any) => u.role !== 'cliente').map((u: any) => {
                            const sel = ((edicaoCliente as any).squad || []).includes(u.email)
                            return (
                              <button key={u.email} type="button" onClick={() => setEdicaoCliente(p => { const cur = (((p as any).squad || []) as string[]); return { ...p, squad: sel ? cur.filter(e => e !== u.email) : [...cur, u.email] } as any })}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 999, border: sel ? '1.5px solid #1d4ed8' : '1.5px solid #e0e0e0', background: sel ? '#eff6ff' : '#fff', color: sel ? '#1d4ed8' : '#888', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: sel ? '#1d4ed8' : '#ccc' }} />
                                {u.nome || u.email}
                              </button>
                            )
                          })}
                          {usuarios.filter((u: any) => u.role !== 'cliente').length === 0 && <span style={{ fontSize: 12, color: '#bbb' }}>Nenhum colaborador cadastrado ainda.</span>}
                        </div>
                      </div>

                      {/* Perfis conectados — vários Instagram/Facebook por cliente (filiais) */}
                      {edicaoCliente.id && (() => {
                        const contasCli = ((edicaoCliente as any).contas || []) as { id: string; nome: string; logo?: string; temInstagram?: boolean; temFacebook?: boolean }[]
                        return (
                          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #eee' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                              <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888' }}>Perfis conectados</label>
                                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#bbb' }}>Cliente com mais de uma loja/perfil: adicione cada Instagram ou Facebook. No Novo Post você escolhe em quais publicar.</p>
                              </div>
                              <button type="button" onClick={() => { setConectarComoNova(true); setConectarRedesCliente(edicaoCliente.id!) }}
                                style={{ flexShrink: 0, padding: '8px 14px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Adicionar perfil</button>
                            </div>
                            {contasCli.length === 0
                              ? <p style={{ margin: 0, fontSize: 12.5, color: '#bbb' }}>Nenhum perfil conectado ainda. Use "Conectar redes" (conta principal) ou "Adicionar perfil".</p>
                              : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {contasCli.map(conta => (
                                    <div key={conta.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, border: '1px solid #eee', background: '#fafafa' }}>
                                      <span style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--marca,#ffc00f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#111' }}>
                                        <AvatarCliente logo={conta.logo} nome={conta.nome} />
                                      </span>
                                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#111' }}>{conta.nome}
                                        {conta.id === 'principal' && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', borderRadius: 999, padding: '2px 8px' }}>principal</span>}
                                      </span>
                                      <span style={{ fontSize: 11, color: '#999', whiteSpace: 'nowrap' }}>{[conta.temInstagram ? 'IG' : null, conta.temFacebook ? 'FB' : null].filter(Boolean).join(' · ') || 'sem rede'}</span>
                                      {conta.id !== 'principal' && (
                                        <button type="button" onClick={async () => {
                                          if (!(await confirmar(`Desconectar o perfil "${conta.nome}"? Os posts já publicados não são afetados.`, { titulo: 'Desconectar perfil', okLabel: 'Desconectar', perigo: true }))) return
                                          const r = await fetch('/api/clientes/conectar', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clienteId: edicaoCliente.id, contaId: conta.id }) }).then(x => x.json()).catch(() => null)
                                          if (r?.ok) { setEdicaoCliente(p => ({ ...p, contas: r.contas } as any)); fetch('/api/clientes').then(x => x.json()).then(setClientes) }
                                          else toast('Não foi possível desconectar.', 'erro')
                                        }} style={{ flexShrink: 0, background: 'none', border: 'none', color: '#b91c1c', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Desconectar</button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                          </div>
                        )
                      })()}

                      {/* Módulos & assinatura (plano modular) */}
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #eee' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888' }}>Módulos & assinatura</label>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#16a34a' }}>{totalMensalModulos((edicaoCliente as any).modulos).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês</span>
                        </div>
                        <p style={{ margin: '0 0 8px', fontSize: 11, color: '#bbb' }}>O núcleo é grátis e vem incluído em todo cliente. Ative os add-ons contratados e ajuste o valor mensal de cada um.</p>

                        {/* Núcleo — grátis, pré-definido (sempre incluído) */}
                        <p style={{ margin: '4px 0 6px', fontSize: 10.5, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Incluído no núcleo (grátis)</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                          {MODULOS.filter(m => m.gratuito).map(m => (
                            <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#f8fafc', border: '1px solid #eef0f2', borderRadius: 10 }}>
                              <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111' }}>{m.label}</p>
                                <p style={{ margin: 0, fontSize: 11, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.descricao}</p>
                              </div>
                              <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 999, padding: '3px 10px' }}>Incluído</span>
                            </div>
                          ))}
                        </div>

                        {/* Add-ons — pagos, a selecionar */}
                        <p style={{ margin: '0 0 6px', fontSize: 10.5, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Add-ons (opcionais)</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {MODULOS_PAGOS.map(m => {
                            const mod = ((edicaoCliente as any).modulos || {})[m.key] || {}
                            const ativo = !!mod.ativo
                            const valor = typeof mod.valor === 'number' ? mod.valor : m.valorPadrao
                            const set = (patch: any) => setEdicaoCliente(p => ({ ...p, modulos: { ...((p as any).modulos || {}), [m.key]: { ...(((p as any).modulos || {})[m.key] || {}), ...patch } } } as any))
                            return (
                              <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: ativo ? '#f0fdf4' : '#fafafa', border: `1px solid ${ativo ? '#bbf7d0' : '#f0f0f0'}`, borderRadius: 10 }}>
                                <button type="button" onClick={() => set({ ativo: !ativo, ...(!ativo && !mod.desde ? { desde: new Date().toISOString() } : {}) })} aria-label={ativo ? 'Desativar' : 'Ativar'} style={{ flexShrink: 0, width: 38, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer', background: ativo ? '#16a34a' : '#e0e0e0', position: 'relative' }}>
                                  <span style={{ position: 'absolute', top: 3, left: ativo ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
                                </button>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111' }}>{m.label}</p>
                                  <p style={{ margin: 0, fontSize: 11, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.descricao}</p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, opacity: ativo ? 1 : 0.5 }}>
                                  <span style={{ fontSize: 12, color: '#888' }}>R$</span>
                                  <input type="number" min="0" value={valor} disabled={!ativo} onChange={e => set({ valor: Number(e.target.value) || 0 })} style={{ width: 64, padding: '5px 7px', borderRadius: 7, border: '1px solid #e0e0e0', fontSize: 12, fontFamily: 'inherit' }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Cobrança / acesso — suspensão por inadimplência */}
                      {(() => {
                        const suspenso = !!(edicaoCliente as any).inadimplente
                        return (
                          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #eee' }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 2 }}>Cobrança e acesso</label>
                            <p style={{ margin: '0 0 8px', fontSize: 11, color: '#bbb' }}>Suspender por inadimplência bloqueia o acesso do cliente ao portal (a equipe continua vendo tudo). Reative ao regularizar o pagamento.</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: suspenso ? '#fef2f2' : '#f8fafc', border: `1px solid ${suspenso ? '#fecaca' : '#eef0f2'}` }}>
                              <button type="button" onClick={() => setEdicaoCliente(p => ({ ...p, inadimplente: !suspenso, suspensoDesde: !suspenso ? new Date().toISOString() : undefined } as any))} aria-label={suspenso ? 'Reativar acesso' : 'Suspender acesso'}
                                style={{ flexShrink: 0, width: 38, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer', background: suspenso ? '#dc2626' : '#e0e0e0', position: 'relative' }}>
                                <span style={{ position: 'absolute', top: 3, left: suspenso ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
                              </button>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: suspenso ? '#b91c1c' : '#111' }}>{suspenso ? 'Acesso suspenso (inadimplente)' : 'Acesso liberado'}</p>
                                <p style={{ margin: 0, fontSize: 11, color: '#999' }}>{suspenso ? (((edicaoCliente as any).suspensoDesde) ? `Suspenso desde ${new Date((edicaoCliente as any).suspensoDesde).toLocaleDateString('pt-BR')}` : 'Cliente sem acesso ao portal.') : 'Cliente acessa o portal normalmente.'}</p>
                              </div>
                            </div>
                            {stripeOn && (
                              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                <button type="button" onClick={() => cobrarStripe(c.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', background: '#635bff', color: '#fff', border: 'none', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                                  {(c as any).stripeCustomerId ? 'Nova cobrança (Stripe)' : 'Cobrar via Stripe (assinatura mensal)'}
                                </button>
                                {(c as any).stripeCustomerId && <span style={{ fontSize: 11.5, fontWeight: 700, color: (c as any).assinaturaStatus === 'active' ? '#16a34a' : '#b45309' }}>Assinatura vinculada{(c as any).assinaturaStatus ? ` · ${(c as any).assinaturaStatus}` : ''}</span>}
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {/* Permissoes do portal do cliente */}
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #eee' }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 2 }}>Permissões do portal</label>
                        <p style={{ margin: '0 0 8px', fontSize: 11, color: '#bbb' }}>O que este cliente vê e faz no portal. Tudo ligado por padrão.</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {([['entregas', 'Entregas'], ['aprovacoes', 'Aprovações'], ['aprovar', 'Aprovar/reprovar'], ['solicitar', 'Solicitar conteúdo']] as [string, string][]).map(([chave, rotulo]) => {
                            const ligado = (edicaoCliente as any).permissoes?.[chave] !== false
                            return (
                              <button key={chave} type="button" onClick={() => setEdicaoCliente(p => ({ ...p, permissoes: { ...((p as any).permissoes || {}), [chave]: ((p as any).permissoes?.[chave] !== false) ? false : true } } as any))}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 999, border: ligado ? '1.5px solid #16a34a' : '1.5px solid #e0e0e0', background: ligado ? '#f0fdf4' : '#fff', color: ligado ? '#16a34a' : '#aaa', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: ligado ? '#16a34a' : '#ccc' }} />
                                {rotulo}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <span style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 16, paddingTop: 16, borderTop: '1px dashed #e5e7eb', marginBottom: 10 }}>Identidade visual</span>
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
                      </div>
                        <LgpdCliente clienteId={c.id} clienteNome={c.nome} onApagado={() => { setEditandoCliente(null); setClientes(cs => cs.filter((x: any) => x.id !== c.id)) }} />
                        </div>
                        {/* Rodapé fixo do modal */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 22px', borderTop: '1px solid #eef0f2', flexShrink: 0, flexWrap: 'wrap', background: '#fff' }}>
                          <button onClick={() => excluirCliente(c.id, c.nome)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff', border: '1px solid #fecaca', borderRadius: 9, padding: '9px 14px', fontSize: 12.5, fontWeight: 700, color: '#ef4444', cursor: 'pointer' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                            Excluir cliente
                          </button>
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {(c as any).loginEmail && <button onClick={() => resetarSenhaCliente(c.id, c.nome)} title="Gera uma nova senha de acesso para o cliente" style={{ padding: '9px 14px', background: '#fff', color: '#b45309', border: '1px solid #fde68a', borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Resetar senha</button>}
                            <button onClick={() => setEditandoCliente(null)} style={{ padding: '9px 16px', background: '#f1f5f9', border: 'none', borderRadius: 9, fontSize: 13, color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                            <button onClick={() => salvarEdicaoCliente(c.id)} style={{ padding: '9px 20px', background: '#111', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Salvar alterações</button>
                          </div>
                        </div>
                      </div>
                    </div>
                    )
                  })()}
                </div>
              ))}
                </div>
              </div>
              ))
            })()}
          </div>
        )}

        {/* USUÁRIOS (admin only) */}
        {aba === 'usuarios' && role === 'admin' && (
          <div>
            <h2 style={{ margin: '0 0 20px', fontSize: 18, color: '#111' }}>Colaboradores</h2>

            {/* Permissões por papel — padrão do papel (Ver/Editar/Excluir por módulo) */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>Permissões por papel</h3>
              <p style={{ margin: '4px 0 16px', fontSize: 12.5, color: '#999' }}>Padrão de cada papel por módulo (Ver / Editar / Excluir). <b>Admin</b> vê tudo (inclusive Financeiro). <b>Vendas</b>/<b>Cliente</b> têm acesso próprio. Cada usuário pode ter ajuste individual no cadastro.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(['gerente', 'usuario'] as const).map(papel => (
                  <div key={papel}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>{papel === 'gerente' ? 'Gerente' : 'Usuário'}</span>
                    {matrizNiveis(papel, permPapel[papel] || {}, (novoPerm: any) => setPermPapelNivel(papel, novoPerm), 'papel', '')}
                  </div>
                ))}
              </div>
            </div>

            {/* Permissões detalhadas por papel — liga/desliga CADA tela e ação
                para todo gerente/usuário (o cadastro individual sobrepõe). */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>Funcionalidades por papel (telas e ações)</h3>
              <p style={{ margin: '4px 0 16px', fontSize: 12.5, color: '#999' }}>Controle fino de <b>cada tela</b> e das <b>ações críticas</b> (gerar com IA, enviar ao cliente, publicar, aprovar, excluir). Vale como padrão do papel — no cadastro de cada colaborador dá para ajustar individualmente. <b>Admin</b> sempre tem acesso total.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(['gerente', 'usuario'] as const).map(papel => (
                  <div key={papel}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>{papel === 'gerente' ? 'Gerente' : 'Usuário'}</span>
                    {renderGranular(papel, permGranular?.[papel] || {}, (novoPerm: any) => setPermGranularPapel(papel, novoPerm), 'papel')}
                  </div>
                ))}
              </div>
            </div>

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
                  <input value={novoUsuario.cargo} onChange={e => setNovoUsuario(p => ({ ...p, cargo: e.target.value }))} placeholder={perfilClinica ? 'Função / Cargo (ex.: Recepção, Esteticista, Gestora)' : perfilCidadania ? 'Função / Cargo (ex.: Analista de processos, Genealogista, Comercial)' : perfilTurismo ? 'Função / Cargo (ex.: Atendimento, Motorista, Guia)' : 'Função / Cargo (ex.: Social Media, Designer, Gestor de Tráfego)'}
                    style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, fontFamily: 'inherit' }} />
                  {perfilTurismo && (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 10, padding: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 4 }}>Tipo no turismo</label>
                        <select value={(novoUsuario as any).tipoTurismo || 'equipe'} onChange={e => setNovoUsuario(p => ({ ...p, tipoTurismo: e.target.value } as any))}
                          style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, background: '#fff', fontFamily: 'inherit' }}>
                          <option value="equipe">Equipe</option>
                          <option value="motorista">Motorista</option>
                          <option value="guia">Guia</option>
                          <option value="parceiro">Parceiro</option>
                        </select>
                      </div>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 4 }}>Telefone</label>
                        <input value={(novoUsuario as any).telefone || ''} onChange={e => setNovoUsuario(p => ({ ...p, telefone: e.target.value } as any))} placeholder="(00) 00000-0000"
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                      </div>
                      {(novoUsuario as any).tipoTurismo === 'motorista' && (
                        <div style={{ flex: 1, minWidth: 140 }}>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 4 }}>CNH</label>
                          <input value={(novoUsuario as any).cnh || ''} onChange={e => setNovoUsuario(p => ({ ...p, cnh: e.target.value } as any))} placeholder="Nº da CNH"
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                        </div>
                      )}
                    </div>
                  )}
                  {perfilClinica && novoUsuario.role !== 'vendas' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 10, padding: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#555' }}>Disponibilidade de agenda</span>
                        <div style={{ display: 'inline-flex', gap: 3, background: '#eee', borderRadius: 9, padding: 3 }}>
                          {([[true, 'Sim — recebe pacientes'], [false, 'Não — só cria eventos']] as const).map(([v, lab]) => {
                            const ativo = ((novoUsuario as any).recebeAgenda ?? true) === v
                            return (
                              <button key={String(v)} type="button" onClick={() => setNovoUsuario(p => ({ ...p, recebeAgenda: v } as any))}
                                style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: ativo ? '#fff' : 'transparent', fontWeight: ativo ? 700 : 500, fontSize: 12, cursor: 'pointer', color: ativo ? '#111' : '#888', boxShadow: ativo ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{lab}</button>
                            )
                          })}
                        </div>
                      </div>
                      {((novoUsuario as any).recebeAgenda ?? true) && (
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          <input value={(novoUsuario as any).areaSaude || ''} onChange={e => setNovoUsuario(p => ({ ...p, areaSaude: e.target.value } as any))} placeholder="Área de atendimento (ex.: Estética, Dermato)"
                            style={{ flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, fontFamily: 'inherit' }} />
                          <label title="Cor na Agenda" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#666', fontWeight: 600 }}>
                            Cor na agenda
                            <input type="color" value={(novoUsuario as any).corAgenda || '#7c3aed'} onChange={e => setNovoUsuario(p => ({ ...p, corAgenda: e.target.value } as any))} style={{ width: 34, height: 30, border: '1px solid #e0e0e0', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 4 }}>Custo/hora (R$)</label>
                      <input type="number" min="0" value={novoUsuario.custoHora || ''} onChange={e => setNovoUsuario(p => ({ ...p, custoHora: Number(e.target.value) || 0 }))} placeholder="Ex.: 50"
                        style={{ width: 130, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, fontFamily: 'inherit' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 4 }}>Salário fixo (R$/mês)</label>
                      <input type="number" min="0" value={novoUsuario.salarioFixo || ''} onChange={e => setNovoUsuario(p => ({ ...p, salarioFixo: Number(e.target.value) || 0 }))} placeholder="Ex.: 2500"
                        style={{ width: 140, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, fontFamily: 'inherit' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 4 }}>Valor/projeto (R$)</label>
                      <input type="number" min="0" value={novoUsuario.valorPorProjeto || ''} onChange={e => setNovoUsuario(p => ({ ...p, valorPorProjeto: Number(e.target.value) || 0 }))} placeholder="Ex.: 200"
                        style={{ width: 120, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, fontFamily: 'inherit' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 4 }}>Nº de projetos</label>
                      <input type="number" min="0" value={novoUsuario.qtdProjetos || ''} onChange={e => setNovoUsuario(p => ({ ...p, qtdProjetos: Number(e.target.value) || 0 }))} placeholder="Ex.: 10"
                        style={{ width: 110, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, fontFamily: 'inherit' }} />
                    </div>
                    <div style={{ alignSelf: 'flex-end', padding: '0 0 10px' }}>
                      <span style={{ fontSize: 11, color: '#aaa' }}>Variável = </span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#16a34a' }}>{((novoUsuario.valorPorProjeto || 0) * (novoUsuario.qtdProjetos || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  </div>
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
                      <option value="usuario">Usuário</option>
                      <option value="admin">Admin</option>
                      <option value="vendas">{perfilClinica ? 'Comercial' : 'Vendas'}</option>
                      {!perfilClinica && <option value="cliente">Cliente</option>}
                    </select>
                    {novoUsuario.role === 'vendas' && !perfilClinica && (
                      <select value={(novoUsuario as any).funcaoVendas || ''} onChange={e => setNovoUsuario(p => ({ ...p, funcaoVendas: e.target.value }))}
                        style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, background: '#fff', fontFamily: 'inherit' }}>
                        <option value="">Função...</option>
                        <option value="sdr">SDR / BDR</option>
                        <option value="closer">Closer</option>
                      </select>
                    )}
                    {novoUsuario.role === 'cliente' && (
                      <select value={(novoUsuario as any).clienteId || ''} onChange={e => setNovoUsuario(p => ({ ...p, clienteId: e.target.value }))}
                        style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, background: '#fff', fontFamily: 'inherit' }}>
                        <option value="">Vincular a qual cliente?</option>
                        {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    )}
                    {perfilTelefonia && novoUsuario.role !== 'admin' && novoUsuario.role !== 'cliente' && (
                      <select value={(novoUsuario as any).lojaId || ''} onChange={e => setNovoUsuario(p => ({ ...p, lojaId: e.target.value } as any))}
                        style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 14, background: '#fff', fontFamily: 'inherit' }}>
                        <option value="">{novoUsuario.role === 'gerente' ? 'Loja (vazio = toda a rede)' : 'Vincular a qual loja?'}</option>
                        {lojasTel.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                      </select>
                    )}
                    <button onClick={criarUsuario} disabled={!usuarioFormValido} style={{
                      padding: '10px 20px', background: usuarioFormValido ? '#ffc00f' : '#f0f0f0', border: 'none', borderRadius: 10,
                      fontWeight: 700, cursor: usuarioFormValido ? 'pointer' : 'not-allowed', color: usuarioFormValido ? '#111' : '#bbb',
                    }}>Adicionar</button>
                  </div>
                  {renderPermissoes(novoUsuario.role, (novoUsuario as any).permissoes, (p: any) => setNovoUsuario(u => ({ ...u, permissoes: p } as any)))}
                  {renderGranular(novoUsuario.role, (novoUsuario as any).permissoesGranular, (p: any) => setNovoUsuario(u => ({ ...u, permissoesGranular: p } as any)))}
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
                        <input type="number" min="0" value={edicaoUsuario.custoHora || ''} onChange={e => setEdicaoUsuario(p => ({ ...p, custoHora: Number(e.target.value) || 0 }))} placeholder="Custo/hora R$"
                          style={{ width: 110, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                        <input type="number" min="0" value={edicaoUsuario.salarioFixo || ''} onChange={e => setEdicaoUsuario(p => ({ ...p, salarioFixo: Number(e.target.value) || 0 }))} placeholder="Salário fixo R$"
                          style={{ width: 120, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                        <input type="number" min="0" value={edicaoUsuario.valorPorProjeto || ''} onChange={e => setEdicaoUsuario(p => ({ ...p, valorPorProjeto: Number(e.target.value) || 0 }))} placeholder="Valor/projeto R$"
                          style={{ width: 110, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                        <input type="number" min="0" value={edicaoUsuario.qtdProjetos || ''} onChange={e => setEdicaoUsuario(p => ({ ...p, qtdProjetos: Number(e.target.value) || 0 }))} placeholder="Nº projetos"
                          style={{ width: 100, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                        <span style={{ alignSelf: 'center', fontSize: 12, color: '#888' }}>Variável: <strong style={{ color: '#16a34a' }}>{((edicaoUsuario.valorPorProjeto || 0) * (edicaoUsuario.qtdProjetos || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
                        <select value={edicaoUsuario.role} onChange={e => setEdicaoUsuario(p => ({ ...p, role: e.target.value }))}
                          style={{ flex: 1, minWidth: 140, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, background: '#fff', fontFamily: 'inherit' }}>
                          <option value="gerente">Gerente</option>
                          <option value="usuario">Usuário</option>
                          <option value="admin">Admin</option>
                          <option value="vendas">{perfilClinica ? 'Comercial' : 'Vendas'}</option>
                          {!perfilClinica && <option value="cliente">Cliente</option>}
                        </select>
                        {edicaoUsuario.role === 'vendas' && !perfilClinica && (
                          <select value={(edicaoUsuario as any).funcaoVendas || ''} onChange={e => setEdicaoUsuario(p => ({ ...p, funcaoVendas: e.target.value }))}
                            style={{ flex: 1, minWidth: 140, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, background: '#fff', fontFamily: 'inherit' }}>
                            <option value="">Função...</option>
                            <option value="sdr">SDR / BDR</option>
                            <option value="closer">Closer</option>
                          </select>
                        )}
                        {edicaoUsuario.role === 'cliente' && !perfilClinica && (
                          <select value={(edicaoUsuario as any).clienteId || ''} onChange={e => setEdicaoUsuario(p => ({ ...p, clienteId: e.target.value }))}
                            style={{ flex: 1, minWidth: 140, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, background: '#fff', fontFamily: 'inherit' }}>
                            <option value="">Vincular a qual cliente?</option>
                            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                          </select>
                        )}
                        {perfilTelefonia && edicaoUsuario.role !== 'admin' && edicaoUsuario.role !== 'cliente' && (
                          <select value={(edicaoUsuario as any).lojaId || ''} onChange={e => setEdicaoUsuario(p => ({ ...p, lojaId: e.target.value } as any))}
                            style={{ flex: 1, minWidth: 140, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, background: '#fff', fontFamily: 'inherit' }}>
                            <option value="">{edicaoUsuario.role === 'gerente' ? 'Loja (vazio = toda a rede)' : 'Vincular a qual loja?'}</option>
                            {lojasTel.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
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
                      {perfilTurismo && (
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
                          <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 4 }}>Tipo no turismo</label>
                            <select value={(edicaoUsuario as any).tipoTurismo || 'equipe'} onChange={e => setEdicaoUsuario(p => ({ ...p, tipoTurismo: e.target.value } as any))}
                              style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, background: '#fff', fontFamily: 'inherit' }}>
                              <option value="equipe">Equipe</option>
                              <option value="motorista">Motorista</option>
                              <option value="guia">Guia</option>
                              <option value="parceiro">Parceiro</option>
                            </select>
                          </div>
                          <div style={{ flex: 1, minWidth: 150 }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 4 }}>Telefone</label>
                            <input value={(edicaoUsuario as any).telefone || ''} onChange={e => setEdicaoUsuario(p => ({ ...p, telefone: e.target.value } as any))} placeholder="(00) 00000-0000"
                              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                          </div>
                          {(edicaoUsuario as any).tipoTurismo === 'motorista' && (
                            <div style={{ flex: 1, minWidth: 130 }}>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 4 }}>CNH</label>
                              <input value={(edicaoUsuario as any).cnh || ''} onChange={e => setEdicaoUsuario(p => ({ ...p, cnh: e.target.value } as any))} placeholder="Nº da CNH"
                                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                            </div>
                          )}
                        </div>
                      )}
                      {perfilClinica && edicaoUsuario.role !== 'vendas' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#555' }}>Disponibilidade de agenda</span>
                            <div style={{ display: 'inline-flex', gap: 3, background: '#eee', borderRadius: 9, padding: 3 }}>
                              {([[true, 'Sim — recebe pacientes'], [false, 'Não — só cria eventos']] as const).map(([v, lab]) => {
                                const ativo = ((edicaoUsuario as any).recebeAgenda ?? !!(edicaoUsuario as any).areaSaude) === v
                                return (
                                  <button key={String(v)} type="button" onClick={() => setEdicaoUsuario(p => ({ ...p, recebeAgenda: v } as any))}
                                    style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: ativo ? '#fff' : 'transparent', fontWeight: ativo ? 700 : 500, fontSize: 12, cursor: 'pointer', color: ativo ? '#111' : '#888', boxShadow: ativo ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{lab}</button>
                                )
                              })}
                            </div>
                          </div>
                          {((edicaoUsuario as any).recebeAgenda ?? !!(edicaoUsuario as any).areaSaude) && (
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                              <input value={(edicaoUsuario as any).areaSaude || ''} onChange={e => setEdicaoUsuario(p => ({ ...p, areaSaude: e.target.value } as any))} placeholder="Área de atendimento (ex.: Estética)"
                                style={{ flex: 1, minWidth: 180, padding: '10px 14px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit' }} />
                              <label title="Cor na Agenda" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666', fontWeight: 600 }}>
                                Cor
                                <input type="color" value={(edicaoUsuario as any).corAgenda || '#7c3aed'} onChange={e => setEdicaoUsuario(p => ({ ...p, corAgenda: e.target.value } as any))} style={{ width: 32, height: 28, border: '1px solid #e0e0e0', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                              </label>
                            </div>
                          )}
                        </div>
                      )}
                      {renderPermissoes(edicaoUsuario.role, (edicaoUsuario as any).permissoes, (p: any) => setEdicaoUsuario(x => ({ ...x, permissoes: p } as any)))}
                      {renderGranular(edicaoUsuario.role, (edicaoUsuario as any).permissoesGranular, (p: any) => setEdicaoUsuario(x => ({ ...x, permissoesGranular: p } as any)))}
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                        {/* Recuperação de lockout: reseta o 2FA de quem perdeu o autenticador (auditado) */}
                        <button onClick={async () => {
                          if (!(await confirmar(`Resetar a verificação em 2 fatores de ${u.nome}? A pessoa volta a entrar só com e-mail e senha e pode reativar o 2FA depois.`, { titulo: 'Resetar 2FA', okLabel: 'Resetar', perigo: true }))) return
                          const r = await fetch('/api/usuarios', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: u.email, resetar2FA: true }) }).then(x => x.json()).catch(() => null)
                          if (r && !r.error) toast('2FA resetado — o colaborador entra só com e-mail e senha.', 'sucesso')
                          else toast(r?.error || 'Falha ao resetar o 2FA.', 'erro')
                        }} style={{ marginRight: 'auto', padding: '9px 14px', background: '#fff', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12.5, fontWeight: 700, color: '#b91c1c', cursor: 'pointer' }}>
                          Resetar 2FA
                        </button>
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

        {/* RENTABILIDADE (admin only) */}
        {aba === 'rentabilidade' && podeGrupo('financeiro') && (
          <Rentabilidade clientes={clientes as any} usuarios={usuarios as any} />
        )}

        {/* MODELOS DE PROJETO (equipe) */}
        {aba === 'modelos' && role !== 'cliente' && (
          <Modelos clientes={clientes as any} usuarios={usuarios as any} podeEditar={podeNivelDash('estrategia', 'editar')} podeExcluir={podeNivelDash('estrategia', 'excluir')} perfil={perfilInstancia} />
        )}

        {/* AUTOMAÇÕES (equipe) */}
        {aba === 'automacoes' && role !== 'cliente' && (
          <Automacoes clientes={clientes.filter(c => (c as any).tipo !== 'interno').map(c => ({ id: c.id, nome: c.nome }))} />
        )}

        {aba === 'agentes' && role === 'admin' && (
          <Agentes />
        )}

        {aba === 'documentos' && role !== 'cliente' && (
          <Documentos clientes={clientes as any} />
        )}

        {aba === 'conversao' && (role === 'admin' || role === 'gerente' || role === 'vendas') && (
          <DashboardVendas />
        )}

        {aba === 'mapas' && role !== 'cliente' && (
          <MapasMentais clientes={clientes as any} />
        )}

        {aba === 'solicitacoes' && role !== 'cliente' && (
          <LogsCliente clientes={clientes} onAbrirPost={async (postId: string) => {
            // Abre o post da solicitação no editor (corrigir → "Enviar para aprovação" reenvia ao cliente).
            let p = posts.find(x => x.id === postId)
            if (!p) {
              // Post fora da janela carregada — consulta a base completa uma vez
              const todos = await fetch('/api/posts?tudo=1').then(r => r.json()).catch(() => null)
              if (Array.isArray(todos)) p = todos.find((x: any) => x.id === postId)
            }
            if (p) iniciarEdicaoPost(p as any)
            else toast('Post não encontrado — pode ter sido excluído.', 'erro')
          }} onVerNoPlanner={async (postId: string) => {
            // Já aprovado: não há o que corrigir. Leva para o Planner (Lista, filtrado no cliente)
            // e abre a pré-visualização da peça.
            let p = posts.find(x => x.id === postId)
            if (!p) {
              const todos = await fetch('/api/posts?tudo=1').then(r => r.json()).catch(() => null)
              if (Array.isArray(todos)) p = todos.find((x: any) => x.id === postId)
            }
            if (!p) { toast('Post não encontrado — pode ter sido excluído.', 'erro'); return }
            if (apareceNoPlanner(p as any)) {
              setBibCliente(p.clienteNome || '')
              setPlannerView('lista')
              setAba('planner')
            } else {
              // Copy aprovada segue para o criativo: a peça vive no Studio até a arte ficar pronta.
              toast('Esta peça ainda não está no Planner — a arte está sendo produzida no Studio. Abaixo, o post como o cliente deixou.', 'info')
            }
            setPostPreview(p as any)
          }} />
        )}

        {/* MEU DIA (equipe) */}
        {aba === 'lista-pessoal' && role !== 'cliente' && (
          <PersonalList />
        )}

        {aba === 'meu-dia' && role !== 'cliente' && (
          <MeuDia onAbrirTarefas={() => setAba('tarefas')} clientes={clientes as any} usuarios={usuarios as any} />
        )}

        {/* CARGA DA EQUIPE (equipe) */}
        {aba === 'carga' && role !== 'cliente' && (
          <CargaEquipe usuarios={usuarios as any} />
        )}

        {/* PÁGINA TRABALHE CONOSCO — personalização (admin only) */}
        {aba === 'recrutamento' && role === 'admin' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 760 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Página Trabalhe Conosco</h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#999' }}>Personalize o formulário público de candidaturas e compartilhe o link.</p>
              </div>
              <button onClick={() => {
                const url = `${window.location.origin}/trabalhe-conosco`
                const nav: any = navigator
                if (nav.share) { nav.share({ title: 'Trabalhe conosco — Grupo 10+', url }).catch(() => {}) }
                else { navigator.clipboard?.writeText(url); setConfigMsg('Link copiado: ' + url); setTimeout(() => setConfigMsg(''), 4000) }
              }} className="soma10-no-invert" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#111', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
                Compartilhar
              </button>
            </div>

            <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <a href="/trabalhe-conosco" target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: '#1d4ed8', fontWeight: 700, textDecoration: 'none' }}>Abrir página pública em nova aba →</a>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Logomarca (use a oficial do 10+)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {configAgencia.recrutamentoLogo ? <img src={configAgencia.recrutamentoLogo} alt="" style={{ height: 40, maxWidth: 160, objectFit: 'contain', background: '#f7f7f7', borderRadius: 8, padding: 4 }} /> : <span style={{ fontSize: 12, color: '#bbb' }}>Sem logo (usará o nome da agência)</span>}
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: '#f5f5f5', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, color: '#444' }}>
                    Enviar logo
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => { if (e.target.files?.[0]) { const url = await enviarImagem(e.target.files[0]); if (url) setConfigAgencia(c => ({ ...c, recrutamentoLogo: url })) } e.target.value = '' }} />
                  </label>
                  {configAgencia.recrutamentoLogo && <button onClick={() => setConfigAgencia(c => ({ ...c, recrutamentoLogo: '' }))} style={{ background: 'none', border: 'none', color: '#b91c1c', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Remover</button>}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Título</label>
                  <input value={configAgencia.recrutamentoTitulo || ''} onChange={e => setConfigAgencia(c => ({ ...c, recrutamentoTitulo: e.target.value }))} placeholder="Ex: Quer entrar para o time?" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Subtítulo</label>
                  <input value={configAgencia.recrutamentoSubtitulo || ''} onChange={e => setConfigAgencia(c => ({ ...c, recrutamentoSubtitulo: e.target.value }))} placeholder="Frase curta abaixo do título" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Descrição da empresa (aparece em destaque no formulário)</label>
                <textarea value={configAgencia.recrutamentoDescricao || ''} onChange={e => setConfigAgencia(c => ({ ...c, recrutamentoDescricao: e.target.value }))} placeholder="Conte sobre a empresa, cultura, plano de carreira..." style={{ width: '100%', minHeight: 110, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
              </div>

              <div style={{ height: 1, background: '#f0f0f0' }} />
              <div>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: '#111' }}>Vagas / oportunidades</span>
                <p style={{ margin: '4px 0 10px', fontSize: 12, color: '#999' }}>O candidato escolhe uma destas opções num menu. Se a lista ficar vazia, o formulário mostra um campo de texto livre.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(configAgencia.recrutamentoVagas || []).map((v, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input value={v} onChange={e => setConfigAgencia(c => { const arr = [...(c.recrutamentoVagas || [])]; arr[i] = e.target.value; return { ...c, recrutamentoVagas: arr } })} placeholder="Ex: Social Media" style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                      <button onClick={() => setConfigAgencia(c => ({ ...c, recrutamentoVagas: (c.recrutamentoVagas || []).filter((_, j) => j !== i) }))} title="Remover" style={{ flexShrink: 0, padding: '8px 12px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Remover</button>
                    </div>
                  ))}
                  <button onClick={() => setConfigAgencia(c => ({ ...c, recrutamentoVagas: [...(c.recrutamentoVagas || []), ''] }))} style={{ alignSelf: 'flex-start', padding: '8px 14px', background: '#f5f5f5', color: '#444', border: '1px solid #e0e0e0', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ Adicionar vaga</button>
                </div>
              </div>

              <div style={{ height: 1, background: '#f0f0f0' }} />
              <span style={{ fontSize: 12.5, fontWeight: 800, color: '#111' }}>Mensagem final (após enviar)</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Título da confirmação</label>
                  <input value={configAgencia.recrutamentoMensagemFinalTitulo || ''} onChange={e => setConfigAgencia(c => ({ ...c, recrutamentoMensagemFinalTitulo: e.target.value }))} placeholder="Ex: Candidatura enviada!" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 6 }}>Texto da confirmação</label>
                  <textarea value={configAgencia.recrutamentoMensagemFinal || ''} onChange={e => setConfigAgencia(c => ({ ...c, recrutamentoMensagemFinal: e.target.value }))} placeholder="Mensagem que o candidato vê após enviar." style={{ width: '100%', minHeight: 70, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={salvarConfigAgencia} disabled={salvandoConfig} className="soma10-no-invert" style={{ padding: '11px 22px', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: salvandoConfig ? 'not-allowed' : 'pointer' }}>{salvandoConfig ? 'Salvando...' : 'Salvar página'}</button>
                {configMsg && <span style={{ fontSize: 13, color: configMsg.startsWith('Erro') ? '#b91c1c' : '#16a34a', fontWeight: 600 }}>{configMsg}</span>}
              </div>
            </div>
          </div>
        )}

        {/* CONFIGURAÇÕES (admin only) */}
        {aba === 'config' && role === 'admin' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 760 }}>
            <h2 style={{ margin: 0, fontSize: 18, color: '#111' }}>Configurações</h2>

            {/* Hub de configurações — abas */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid #eee' }}>
              {([['geral', 'Geral'], ['operacional', 'Operacional'], ['notificacoes', 'Notificações'], ['integracoes', 'Integrações'], ['permissoes', 'Permissões'], ['sistema', 'Saúde do sistema']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setAbaConfig(k)} style={{ padding: '9px 16px', border: 'none', borderBottom: abaConfig === k ? '2px solid #111' : '2px solid transparent', background: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: abaConfig === k ? '#111' : '#888', marginBottom: -1 }}>{l}</button>
              ))}
              <span style={{ width: 1, height: 20, background: '#e5e5e5', margin: '0 6px' }} />
              {([['clientes', 'Clientes'], ['usuarios', 'Colaboradores'], ['automacoes', 'Automações']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setAba(k as any)} title={`Abrir ${l}`} style={{ padding: '9px 12px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#888', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: -1 }}>
                  {l} <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M9 7h8v8" /></svg>
                </button>
              ))}
            </div>

            {abaConfig === 'operacional' && (
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111' }}>Operacional</h3>
              <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#999' }}>Prazos e padrões do dia a dia (antes fixos no sistema).</p>
              <OperacionalConfig />
            </div>
            )}

            {abaConfig === 'notificacoes' && (
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111' }}>Notificações do sistema</h3>
              <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#999' }}>Quais tipos o sistema envia. Desligar afeta todos; cada usuário ainda pode silenciar os seus em Minha Conta.</p>
              <NotificacoesConfig modo="admin" />
            </div>
            )}

            {abaConfig === 'permissoes' && (
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111' }}>Permissões detalhadas</h3>
              <PermissoesGranular />
            </div>
            )}

            {abaConfig === 'sistema' && (
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111' }}>Saúde do sistema</h3>
              <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#999' }}>O que está no ar: banco, integrações, backup e erros recentes.</p>
              <SaudeSistema />
            </div>
            )}

            {abaConfig === 'geral' && (<>
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111' }}>Perfil da instância</h3>
              <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#999' }}>Adapta o sistema ao tipo de negócio: painel inicial, cadastro de pacientes e vínculo da Agenda. Instâncias criadas com perfil no setup já vêm definidas.</p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <select value={perfilInstancia || ''} onChange={async e => {
                  const novo = e.target.value || ''
                  if (novo === (perfilInstancia || '')) return
                  // TRAVA DE DUAS PORTAS. Este <select> reconfigura a instância inteira
                  // (menu, telas, cadastros, matriz de permissões) e mora no meio de
                  // opções corriqueiras — encostar nele sem querer já foi capaz de
                  // trocar o perfil de uma instância no ar. Sem estado local: negando
                  // qualquer uma das duas, o valor exibido volta sozinho (controlado).
                  const nome = (c: string) => PERFIS_INSTANCIA.find(p => p.chave === c)?.label || 'Agência (padrão)'
                  const de = nome(perfilInstancia || ''), para = nome(novo)
                  const ok1 = await confirmar(
                    `O perfil define QUAIS TELAS a instância mostra — menu, cadastros e painel inicial mudam para toda a equipe, não só para você.\n\nDe: ${de}\nPara: ${para}`,
                    { titulo: 'Trocar o perfil da instância?', okLabel: 'Continuar', cancelLabel: 'Cancelar' }
                  )
                  if (!ok1) return
                  const ok2 = await confirmar(
                    `Confirma trocar para ${para}? A equipe vê a mudança no próximo carregamento.`,
                    { titulo: 'Tem certeza?', okLabel: `Sim, trocar para ${para}`, cancelLabel: `Não, manter ${de}`, perigo: true }
                  )
                  if (!ok2) return
                  const r = await fetch('/api/perfil-instancia', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ perfil: novo }) }).then(x => x.json()).catch(() => null)
                  if (r?.ok !== undefined ? r.ok : r) { setPerfilInstancia(novo || null); toast(`Perfil da instância alterado para ${para}.`, 'sucesso') }
                  else toast(r?.error || 'Não foi possível trocar o perfil — nada foi alterado.', 'erro')
                }} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'inherit', background: '#fff', cursor: 'pointer' }}>
                  {/* Opções vindas do CATÁLOGO, nunca escritas à mão. Quando eram
                      fixas aqui, o perfil `cidadania` ficou de fora: o <select>
                      tinha value="cidadania" sem opção correspondente, o navegador
                      exibia a primeira ("Agência (padrão)") e a instância PARECIA
                      ser agência — pior, salvar o campo sem querer trocaria o
                      perfil de verdade. Perfil novo agora aparece sozinho. */}
                  <option value="">Agência (padrão)</option>
                  {PERFIS_INSTANCIA.map(p => <option key={p.chave} value={p.chave}>{p.label}</option>)}
                </select>
                <span style={{ fontSize: 11.5, color: '#aaa' }}>Muda só a experiência — permissões e funil existentes não são tocados.</span>
              </div>
            </div>
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

            {/* Backup e segurança (admin) */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111' }}>Backup dos dados</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#999', lineHeight: 1.5 }}>Um backup completo é gerado <strong>todo dia</strong> automaticamente (guardado de forma privada). Aqui você pode baixar uma cópia agora, quando quiser.</p>
                </div>
                <a href="/api/backup" title="Baixa um JSON com todos os dados (clientes, posts, tarefas, CRM, config...)"
                  style={{ flexShrink: 0, padding: '8px 14px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                  Baixar backup agora
                </a>
              </div>
            </div>

            {/* Imagem de perfil dos clientes */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111' }}>Imagem de perfil dos clientes</h3>
                  <p style={{ margin: '0 0 16px', fontSize: 12, color: '#999' }}>Defina a foto de perfil de cada cliente — exibida nas pré-visualizações e listagens.</p>
                </div>
                <button onClick={ressincronizarFotos} disabled={resyncFotos} title="Rebusca as fotos do Instagram e salva de forma permanente (corrige fotos quebradas)"
                  style={{ flexShrink: 0, padding: '8px 14px', background: '#fff', color: '#444', border: '1px solid #e0e0e0', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: resyncFotos ? 'default' : 'pointer' }}>
                  {resyncFotos ? 'Re-sincronizando...' : 'Re-sincronizar fotos do Instagram'}
                </button>
              </div>
              {clientes.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: '#aaa' }}>Nenhum cliente cadastrado ainda.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {clientes.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: '#fafafa', borderRadius: 10 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', background: '#eee', border: '1.5px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, color: '#bbb', fontSize: 16 }}>
                        <AvatarCliente logo={c.logo} nome={c.nome} clienteId={c.id} />
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

            </>)}

            {abaConfig === 'integracoes' && (<>
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#111' }}>WhatsApp (conexão){perfilTelefonia ? ' — por loja' : ''}</h3>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: '#999' }}>{perfilTelefonia ? 'Cada loja pareia o seu próprio número (mesmo host, instâncias separadas). Defina a instância de cada loja em Produtos → Gerenciar lojas.' : 'Conecte o WhatsApp da empresa por QR — mantém o número atual. O host fica no Evolution; aqui você pareia e vê o status. As conversas aparecem no CRM, na aba Mensagens.'}</p>
              {perfilTelefonia ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {lojasTel.length === 0 && <p style={{ fontSize: 12.5, color: '#a16207' }}>Cadastre as lojas em Produtos → Gerenciar lojas primeiro.</p>}
                  {lojasTel.map(l => {
                    const aberta = waLojaAberta === l.id
                    return (
                      <div key={l.id} style={{ border: '1px solid #f0f0f0', borderRadius: 12, overflow: 'hidden' }}>
                        <button onClick={() => setWaLojaAberta(aberta ? '' : l.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 14px', background: aberta ? '#f5f5f5' : '#fafafa', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                          <span style={{ fontSize: 13.5, fontWeight: 800, color: '#111' }}>{l.nome}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: l.evolutionInstance ? '#1d4ed8' : '#a16207' }}>{l.evolutionInstance ? (aberta ? 'Fechar' : 'Abrir conexão') : 'defina a instância'}</span>
                        </button>
                        {aberta && (
                          <div style={{ padding: 14, borderTop: '1px solid #f0f0f0' }}>
                            {l.evolutionInstance
                              ? <WhatsAppConexao instancia={l.evolutionInstance} />
                              : <p style={{ margin: 0, fontSize: 12, color: '#a16207' }}>Defina a “Instância WhatsApp” desta loja em Produtos → Gerenciar lojas para poder conectar.</p>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : <WhatsAppConexao />}
            </div>
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
                <div style={{ border: '1px solid #eee', borderRadius: 12, overflowX: 'auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 44px', minWidth: 460, gap: 8, padding: '10px 14px', background: '#fafafa', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    <span>Conta social</span><span>Status</span><span>Tipo</span><span></span>
                  </div>
                  {clientes.filter(c => c.metaConectado).flatMap(c => ([
                    ...(c.facebookPageId ? [{ c, rede: 'facebook' as const, label: c.nome, tipo: 'Página', sub: 'Facebook' }] : []),
                    ...((c.instagramConectado || c.instagramUserId || c.instagramUsername) ? [{ c, rede: 'instagram' as const, label: c.instagramUsername ? `@${c.instagramUsername}` : (c.instagram?.replace(/^@/, '') || c.nome), tipo: 'Profissional', sub: 'Instagram' }] : []),
                  ])).map((row, i) => (
                    <div key={row.c.id + row.rede} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 44px', minWidth: 460, gap: 8, alignItems: 'center', padding: '12px 14px', borderTop: '1px solid #f0f0f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{ position: 'relative', width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: '#eee', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#bbb', fontSize: 13 }}>
                          <AvatarCliente logo={row.c.logo} nome={row.c.nome} />
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
                        <button onClick={async () => { if (await confirmar(`Desconectar as contas de ${row.c.nome}?`, { titulo: 'Desconectar contas', okLabel: 'Desconectar', perigo: true })) desconectarInstagram(row.c.id) }} title="Desconectar"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, display: 'flex', alignItems: 'center' }}><IconTrash size={15} /></button>
                      ) : <span />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            </>)}

            {abaConfig === 'notificacoes' && (
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
            )}
          </div>
        )}
        </div>
      </div>

      {/* Modal: resumo semanal do cliente */}
      {resumoCliente && (
        <div onClick={fecharFora(() => setResumoCliente(null), { perguntar: false })} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} className="soma10-no-invert" style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#111' }}>Resumo da semana</h3>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#888' }}>{clientes.find(c => c.id === resumoCliente)?.nome}</p>
            {resumoCarregando ? <p style={{ color: '#aaa' }}>Gerando...</p> : (
              <>
                {resumoInfo && <p style={{ margin: '0 0 10px', fontSize: 12, color: '#666' }}>✅ {resumoInfo.publicados} publicados · ⏳ {resumoInfo.aguardando} aguardando · 📅 {resumoInfo.proximos} próximos</p>}
                {/* Predefinicoes (templates): aplica saudacao/fechamento personalizados */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <select value={resumoTemplateId} onChange={e => aplicarTemplateResumo(e.target.value)} style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 12.5, fontFamily: 'inherit', background: '#fff' }}>
                    <option value="">Texto padrão</option>
                    {resumoTemplates.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                  {(role === 'admin' || role === 'gerente') && (
                    <button onClick={() => setGerirPresets(v => !v)} style={{ flexShrink: 0, padding: '9px 14px', background: gerirPresets ? '#111' : '#f5f5f5', color: gerirPresets ? '#fff' : '#444', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Predefinições</button>
                  )}
                </div>
                {gerirPresets && (role === 'admin' || role === 'gerente') && (
                  <div style={{ marginBottom: 12, padding: 14, background: '#fafafa', border: '1px solid #eee', borderRadius: 12 }}>
                    <p style={{ margin: '0 0 8px', fontSize: 11.5, color: '#888' }}>Saudação e fechamento personalizados. Use <b>{'{cliente}'}</b> e <b>{'{periodo}'}</b> — serão substituídos. O corpo (publicados/aguardando/próximos) é sempre automático.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {resumoTemplates.map((t, i) => (
                        <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, background: '#fff', border: '1px solid #eee', borderRadius: 10 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input value={t.nome} onChange={e => setResumoTemplates(arr => arr.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} placeholder="Nome da predefinição" style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                            <button onClick={() => setResumoTemplates(arr => arr.filter((_, j) => j !== i))} title="Remover" style={{ flexShrink: 0, padding: '6px 10px', background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 8, fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}>Remover</button>
                          </div>
                          <textarea value={t.intro} onChange={e => setResumoTemplates(arr => arr.map((x, j) => j === i ? { ...x, intro: e.target.value } : x))} placeholder="Saudação (ex: Oi {cliente}! Aqui está seu resumo de {periodo})" style={{ width: '100%', minHeight: 46, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 12.5, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
                          <textarea value={t.fechamento} onChange={e => setResumoTemplates(arr => arr.map((x, j) => j === i ? { ...x, fechamento: e.target.value } : x))} placeholder="Fechamento (ex: Qualquer dúvida, é só chamar! — Grupo 10+)" style={{ width: '100%', minHeight: 40, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 12.5, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button onClick={() => setResumoTemplates(arr => [...arr, { id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), nome: 'Nova predefinição', intro: '', fechamento: '' }])} style={{ padding: '8px 14px', background: '#fff', color: '#444', border: '1px solid #e0e0e0', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ Adicionar</button>
                      <button onClick={salvarPresetsResumo} disabled={salvandoPresets} style={{ padding: '8px 16px', background: '#ffc00f', color: '#111', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: salvandoPresets ? 'not-allowed' : 'pointer' }}>{salvandoPresets ? 'Salvando...' : 'Salvar predefinições'}</button>
                    </div>
                  </div>
                )}
                <textarea value={resumoTexto} onChange={e => setResumoTexto(e.target.value)} style={{ width: '100%', minHeight: 180, padding: '12px 14px', borderRadius: 12, border: '1.5px solid #e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5 }} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  <a href={`https://wa.me/?text=${encodeURIComponent(resumoTexto)}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: '#25D366', color: '#fff', borderRadius: 10, fontWeight: 800, fontSize: 13, textDecoration: 'none' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.4 5 5.2-1.4A10 10 0 1 0 12 2z" /></svg> Abrir no WhatsApp
                  </a>
                  {(resumoInfo?.aguardando || 0) > 0 && (
                    <a href={`https://wa.me/?text=${encodeURIComponent(`Olá! Você tem ${resumoInfo!.aguardando} conteúdo(s) aguardando a sua aprovação. Acesse o portal para aprovar: ${typeof window !== 'undefined' ? window.location.origin : ''}/login`)}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: '#0ea5e9', color: '#fff', borderRadius: 10, fontWeight: 800, fontSize: 13, textDecoration: 'none' }}>Cobrar aprovação ({resumoInfo!.aguardando})</a>
                  )}
                  <button onClick={() => { navigator.clipboard?.writeText(resumoTexto); setResumoMsg('Copiado!') }} style={{ padding: '10px 16px', background: '#f5f5f5', color: '#111', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Copiar</button>
                  <button onClick={enviarResumoEmail} disabled={enviandoResumo || !resumoInfo?.emailCliente} title={resumoInfo?.emailCliente ? `Enviar para ${resumoInfo.emailCliente}` : 'Cliente sem e-mail cadastrado'} style={{ padding: '10px 16px', background: resumoInfo?.emailCliente ? '#111' : '#f0f0f0', color: resumoInfo?.emailCliente ? '#fff' : '#aaa', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: resumoInfo?.emailCliente ? 'pointer' : 'not-allowed' }}>{enviandoResumo ? 'Enviando...' : 'Enviar por e-mail'}</button>
                  <button onClick={() => setResumoCliente(null)} style={{ marginLeft: 'auto', padding: '10px 16px', background: '#fff', color: '#666', border: '1.5px solid #e0e0e0', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Fechar</button>
                </div>
                {resumoMsg && <p style={{ margin: '10px 0 0', fontSize: 12.5, color: resumoMsg.includes('Falha') || resumoMsg.includes('Não') ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{resumoMsg}</p>}
              </>
            )}
          </div>
        </div>
      )}

      {relatorioEditor && <RelatorioMensalEditor cliente={relatorioEditor.cliente} inicial={relatorioEditor.modelo} onClose={() => setRelatorioEditor(null)} />}

      {/* Barra flutuante global de upload de imagem/logo/documento */}
      {progImagem !== null && (
        <div style={{ position: 'fixed', right: 20, bottom: 20, width: 280, background: '#fff', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.18)', padding: 14, zIndex: 3000 }} className="soma10-no-invert">
          <UploadProgress valor={progImagem} rotulo="Enviando arquivo..." />
        </div>
      )}
    </div>
  )
}
