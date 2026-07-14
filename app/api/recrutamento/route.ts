import { NextResponse } from 'next/server'
import { redis, ConfigAgencia } from '@/lib/redis'
import { getPerfilInstancia } from '@/lib/perfisInstancia'
import { perfilSemRecrutamento } from '@/lib/perfisInstanciaCatalogo'

export const runtime = 'nodejs'

// Leitura PUBLICA dos campos de exibicao da pagina "Trabalhe conosco".
// (A pagina e publica, sem sessao — por isso nao usa /api/config, que exige login.)
export async function GET() {
  // Instâncias clínica/turismo não têm página de recrutamento (decisão do dono)
  if (perfilSemRecrutamento(await getPerfilInstancia())) {
    return NextResponse.json({ desabilitado: true }, { status: 404 })
  }
  const c = (await redis.get<ConfigAgencia>('config:agencia')) || ({} as ConfigAgencia)
  return NextResponse.json({
    logo: c.recrutamentoLogo || c.logo || '',
    titulo: c.recrutamentoTitulo || 'Trabalhe conosco',
    subtitulo: c.recrutamentoSubtitulo || 'Preencha seus dados e anexe seu currículo. Vamos adorar conhecer você.',
    descricao: c.recrutamentoDescricao || '',
    mensagemFinalTitulo: c.recrutamentoMensagemFinalTitulo || 'Candidatura enviada!',
    mensagemFinal: c.recrutamentoMensagemFinal || 'Recebemos seus dados. Se o seu perfil corresponder a uma vaga, nossa equipe entrará em contato.',
    nomeAgencia: c.nomeAgencia || 'Grupo 10+',
    vagas: Array.isArray(c.recrutamentoVagas) ? c.recrutamentoVagas.filter(Boolean) : [],
  })
}
