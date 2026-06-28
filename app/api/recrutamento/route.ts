import { NextResponse } from 'next/server'
import { redis, ConfigAgencia } from '@/lib/redis'

export const runtime = 'nodejs'

// Leitura PUBLICA dos campos de exibicao da pagina "Trabalhe conosco".
// (A pagina e publica, sem sessao — por isso nao usa /api/config, que exige login.)
export async function GET() {
  const c = (await redis.get<ConfigAgencia>('config:agencia')) || ({} as ConfigAgencia)
  return NextResponse.json({
    logo: c.recrutamentoLogo || c.logo || '',
    titulo: c.recrutamentoTitulo || 'Trabalhe conosco',
    subtitulo: c.recrutamentoSubtitulo || 'Preencha seus dados e anexe seu currículo. Vamos adorar conhecer você.',
    descricao: c.recrutamentoDescricao || '',
    mensagemFinalTitulo: c.recrutamentoMensagemFinalTitulo || 'Candidatura enviada!',
    mensagemFinal: c.recrutamentoMensagemFinal || 'Recebemos seus dados. Se o seu perfil corresponder a uma vaga, nossa equipe entrará em contato.',
    nomeAgencia: c.nomeAgencia || 'Grupo 10+',
  })
}
