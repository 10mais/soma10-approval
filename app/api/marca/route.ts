import { NextResponse } from 'next/server'
import { getConfigCache, getPerfilCache } from '@/lib/cache'
import { nomeSistema } from '@/lib/perfisInstanciaCatalogo'

// Público (pré-login): nome de exibição do sistema conforme o perfil da instância.
// Usado pela tela de login e páginas públicas para o branding perfil-aware
// (Soma10 App / Clinic / Agency). Não expõe nada sensível — é só a marca.
//
// Devolve também a LOGO da agência: as páginas públicas (link de aprovação) não
// têm sessão e /api/config exige uma, então antes elas caíam num "10+" chumbado.
// Os campos são escolhidos UM A UM de propósito — `config:agencia` guarda também
// emailContato e os textos de recrutamento, que não podem vazar pré-login.
export async function GET() {
  const [perfil, config] = await Promise.all([getPerfilCache(), getConfigCache()])
  return NextResponse.json({
    perfil: perfil || null,
    nome: nomeSistema(perfil),
    logo: config?.logo || '',
    nomeAgencia: config?.nomeAgencia || '',
    corPrimaria: config?.corPrimaria || '',
  })
}
