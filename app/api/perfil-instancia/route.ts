import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import { PERFIS, perfilDef } from '@/lib/perfisInstanciaCatalogo'
import { aplicarPerfilInstancia, getPerfilInstancia } from '@/lib/perfisInstancia'
import { registrarAuditoria } from '@/lib/auditoria'

export const runtime = 'nodejs'

// Perfil da instância (clinica/gestao/agência). GET para o dashboard adaptar a
// experiência; PUT (admin) define em instâncias criadas antes do setup com perfil
// — com opção de reaplicar as sementes (permissões + funil) do catálogo.

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role === 'cliente') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  return NextResponse.json({ perfil: await getPerfilInstancia() })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  const b = await req.json().catch(() => ({} as any))
  const chave = (b.perfil || '').toString()

  if (!chave) {
    // Voltar ao padrão agência: só limpa o marcador (permissões/funil ficam como estão)
    await redis.del('config:perfilInstancia')
    await registrarAuditoria({ ator: session.user?.name || 'admin', acao: 'perfil_instancia_alterado', detalhe: 'Perfil removido (padrão agência)' })
    return NextResponse.json({ ok: true, perfil: null })
  }
  if (!perfilDef(chave)) {
    return NextResponse.json({ error: `perfil inválido — use um de: ${PERFIS.map(p => p.chave).join(', ')}` }, { status: 400 })
  }

  if (b.reaplicarSementes) {
    // CUIDADO: substitui permissões por papel/telas E o funil de CRM pelo preset
    // do perfil (negócios existentes podem ficar órfãos de estágio). Uso pensado
    // para instância recém-provisionada.
    await aplicarPerfilInstancia(chave)
  } else {
    await redis.set('config:perfilInstancia', chave)
  }
  await registrarAuditoria({ ator: session.user?.name || 'admin', acao: 'perfil_instancia_alterado', detalhe: `Perfil definido: ${chave}${b.reaplicarSementes ? ' (sementes reaplicadas)' : ''}` })
  return NextResponse.json({ ok: true, perfil: chave })
}
