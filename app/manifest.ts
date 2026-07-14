import type { MetadataRoute } from 'next'
import { getPerfilCache } from '@/lib/cache'
import { nomeSistema } from '@/lib/perfisInstanciaCatalogo'

// Manifest do PWA — torna o app instalavel ("Adicionar a tela inicial").
// Nome perfil-aware (Soma10 App/Clinic/Agency); short_name segue "Soma10".
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  return {
    name: nomeSistema(await getPerfilCache()),
    short_name: 'Soma10',
    description: 'Gestão e aprovação de conteúdo — Grupo 10+',
    id: '/',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#111111',
    theme_color: '#111111',
    lang: 'pt-BR',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
