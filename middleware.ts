import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Rotas do portal do cliente: /cliente/[clienteId]/*
  if (pathname.startsWith('/cliente/')) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    const role = token.role as string
    const segmentos = pathname.split('/')
    const clienteIdRota = segmentos[2] // /cliente/[clienteId]/...

    // Cliente so acessa o proprio projeto
    if (role === 'cliente' && token.clienteId !== clienteIdRota) {
      return NextResponse.redirect(new URL(`/cliente/${token.clienteId}`, req.url))
    }

    return NextResponse.next()
  }

  // Dashboard: redireciona cliente logado para o portal dele
  if (pathname === '/dashboard') {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (token && token.role === 'cliente' && token.clienteId) {
      return NextResponse.redirect(new URL(`/cliente/${token.clienteId}`, req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/cliente/:path*', '/dashboard'],
}
