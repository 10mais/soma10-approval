import type { MetadataRoute } from 'next'

// Manifest do PWA — torna o app instalavel ("Adicionar a tela inicial").
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Soma10 Approval',
    short_name: 'Soma10',
    description: 'Gestão e aprovação de conteúdo — Grupo 10+',
    start_url: '/dashboard',
    display: 'standalone',
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
