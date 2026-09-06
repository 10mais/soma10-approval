import './globals.css'
import { Outfit } from 'next/font/google'

// Fonte do layout novo, AUTO-HOSPEDADA pelo Next: sem requisição externa a
// fonts.googleapis.com bloqueando a renderização de toda página. Exposta como
// variável CSS (--font-outfit) e consumida por --v2-font no globals.css.
const outfit = Outfit({ subsets: ['latin'], weight: ['300', '400', '500', '600'], display: 'swap', variable: '--font-outfit' })
import { Providers } from './providers'
import PushSetup from './components/PushSetup'
import Ortografia from './components/Ortografia'
import AssistenteIA from './components/AssistenteIA'
import Toaster from './components/Toaster'
import { getPerfilCache } from '@/lib/cache'
import { nomeSistema } from '@/lib/perfisInstanciaCatalogo'

// Splash screens do iOS (fundo escuro + logo) por dispositivo — geradas em public/splash.
const iosSplash = [
  { dw: 430, dh: 932, r: 3, f: '1290x2796' },
  { dw: 393, dh: 852, r: 3, f: '1179x2556' },
  { dw: 390, dh: 844, r: 3, f: '1170x2532' },
  { dw: 428, dh: 926, r: 3, f: '1284x2778' },
  { dw: 414, dh: 896, r: 3, f: '1242x2688' },
  { dw: 375, dh: 812, r: 3, f: '1125x2436' },
  { dw: 414, dh: 896, r: 2, f: '828x1792' },
  { dw: 375, dh: 667, r: 2, f: '750x1334' },
].map(d => ({ url: `/splash/splash-${d.f}.png`, media: `(device-width: ${d.dw}px) and (device-height: ${d.dh}px) and (-webkit-device-pixel-ratio: ${d.r}) and (orientation: portrait)` }))

export async function generateMetadata() {
  const nome = nomeSistema(await getPerfilCache())
  return {
    title: `${nome} — Grupo 10+`,
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, title: 'Soma10', statusBarStyle: 'black-translucent' as const, startupImage: iosSplash },
    icons: { apple: '/apple-touch-icon.png' },
    other: { 'mobile-web-app-capable': 'yes' },
  }
}

export const viewport = { themeColor: '#111111', viewportFit: 'cover' as const, width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={outfit.variable}>
      <body className={outfit.variable} style={{ margin: 0, fontFamily: 'Inter, system-ui, sans-serif', background: '#f8f8f8' }}>
        <Providers>{children}<PushSetup /><Ortografia /><AssistenteIA /><Toaster /></Providers>
      </body>
    </html>
  )
}
