'use client'
import { SessionProvider } from 'next-auth/react'
import { ProvedorIdioma } from '@/app/components/Idioma'

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider><ProvedorIdioma>{children}</ProvedorIdioma></SessionProvider>
}
