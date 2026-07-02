import './globals.css'
import { Providers } from './providers'
import PushSetup from './components/PushSetup'
import AssistenteIA from './components/AssistenteIA'
import Toaster from './components/Toaster'

export const metadata = {
  title: 'Soma10 Approval — Grupo 10+',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Soma10', statusBarStyle: 'black-translucent' as const },
  icons: { apple: '/apple-touch-icon.png' },
}

export const viewport = { themeColor: '#111111', viewportFit: 'cover' as const, width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: 'Inter, system-ui, sans-serif', background: '#f8f8f8' }}>
        <Providers>{children}<PushSetup /><AssistenteIA /><Toaster /></Providers>
      </body>
    </html>
  )
}
