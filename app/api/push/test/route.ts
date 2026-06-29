import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { enviarPushDetalhado } from '@/lib/webpush'

export const runtime = 'nodejs'

// POST -> envia um push de teste para o usuario logado e devolve o resultado (diagnostico).
export async function POST() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const r = await enviarPushDetalhado(email, {
    title: 'Soma10 Approval',
    body: 'Notificação de teste — se você está vendo isto, o push está funcionando! 🎉',
    url: '/dashboard',
    tag: 'teste-push',
  })
  return NextResponse.json({ email, ...r })
}
