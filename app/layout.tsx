export const metadata = { title: 'Aprovação de Criativos — Grupo 10+' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: 'Inter, sans-serif', background: '#f5f5f5' }}>
        {children}
      </body>
    </html>
  )
}
