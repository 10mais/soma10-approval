import { Providers } from './providers'

export const metadata = { title: 'Soma10 Approval — Grupo 10+' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: 'Inter, system-ui, sans-serif', background: '#f8f8f8' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
