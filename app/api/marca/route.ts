import { NextResponse } from 'next/server'
import { getPerfilCache } from '@/lib/cache'
import { nomeSistema } from '@/lib/perfisInstanciaCatalogo'

// Público (pré-login): nome de exibição do sistema conforme o perfil da instância.
// Usado pela tela de login e páginas públicas para o branding perfil-aware
// (Soma10 App / Clinic / Agency). Não expõe nada sensível — é só a marca.
export async function GET() {
  const perfil = await getPerfilCache()
  return NextResponse.json({ perfil: perfil || null, nome: nomeSistema(perfil) })
}
