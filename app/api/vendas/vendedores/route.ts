import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUsuariosRaw } from '@/lib/cache'
import { resolverEscopoLoja } from '@/lib/escopoLoja'

export const runtime = 'nodejs'

// Vendedores de uma loja (PDV, perfil telefonia). Diferente de /api/usuarios (só
// admin/gerente), este é acessível a QUALQUER membro da equipe — o operador do
// balcão precisa escolher a quem atribuir a venda. Devolve só nome/e-mail/papel,
// escopado por loja: o operador vê os da SUA loja; admin/gestor os da loja em foco
// (ou todos). NUNCA expõe senha/2FA.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return NextResponse.json({ vendedores: [] })
  const esc = resolverEscopoLoja({ role: (session.user as any).role, lojaId: (session.user as any).lojaId }, req.nextUrl.searchParams.get('lojaId'))
  if (esc.tipo === 'bloqueado') return NextResponse.json({ vendedores: [] })

  const usuarios = await getUsuariosRaw()
  const daLoja = usuarios.filter(u => {
    if (u.role === 'cliente') return false
    // "todas" (admin/gestor sem loja focada): a equipe vinculada a QUALQUER loja.
    if (esc.tipo === 'todas') return true
    // Loja focada: quem está vinculado a ela.
    return u.lojaId === esc.lojaId
  })
  const vendedores = daLoja
    .map(u => ({ id: u.id, nome: u.nome, email: u.email, role: u.role }))
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'))
  return NextResponse.json({ vendedores })
}
