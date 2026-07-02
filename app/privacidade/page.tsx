import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidade — Soma10 Approval',
  description: 'Política de Privacidade da plataforma Soma10 Approval, do Grupo 10+.',
}

const EMAIL = '10mais@grupo10mais.com.br'
const ATUALIZADO = '2 de julho de 2026'

const page: React.CSSProperties = { minHeight: '100vh', background: '#f4f4f4', fontFamily: 'Inter, system-ui, sans-serif', padding: '40px 16px', color: '#333' }
const card: React.CSSProperties = { maxWidth: 760, margin: '0 auto', background: '#fff', borderRadius: 16, padding: '40px 36px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', lineHeight: 1.65, fontSize: 15 }
const h1: React.CSSProperties = { fontSize: 26, color: '#111', margin: '0 0 4px' }
const h2: React.CSSProperties = { fontSize: 18, color: '#111', margin: '32px 0 10px' }
const meta: React.CSSProperties = { fontSize: 13, color: '#999', margin: '0 0 8px' }
const ul: React.CSSProperties = { paddingLeft: 20, margin: '8px 0' }

export default function PrivacidadePage() {
  return (
    <div style={page}>
      <div style={card}>
        <h1 style={h1}>Política de Privacidade</h1>
        <p style={meta}>Última atualização: {ATUALIZADO}</p>

        <p>
          Esta Política de Privacidade descreve como a <strong>Soma10 Approval</strong>, plataforma operada
          pelo <strong>Grupo 10+</strong> ("nós"), coleta, utiliza, armazena e protege os dados dos usuários
          da plataforma disponível em <strong>approval.soma10.com.br</strong>. Ao utilizar a plataforma, você
          concorda com as práticas descritas neste documento.
        </p>

        <h2 style={h2}>1. Quem somos</h2>
        <p>
          A Soma10 Approval é uma plataforma de gestão de agência de marketing utilizada pelo Grupo 10+
          para aprovação de conteúdo, produção, agendamento e publicação de postagens em redes sociais,
          gestão de tarefas e relacionamento com clientes. O acesso é restrito a colaboradores da agência
          e aos clientes contratantes.
        </p>

        <h2 style={h2}>2. Dados que coletamos</h2>
        <p>Podemos coletar e tratar os seguintes dados:</p>
        <ul style={ul}>
          <li><strong>Dados de cadastro:</strong> nome, e-mail, telefone, cargo e foto de perfil.</li>
          <li><strong>Dados de autenticação:</strong> credenciais de acesso (senhas são armazenadas de forma criptografada).</li>
          <li><strong>Conteúdo do usuário:</strong> textos, imagens, vídeos e documentos enviados para produção e aprovação.</li>
          <li><strong>Dados de contas do Instagram e Facebook:</strong> quando você conecta uma conta profissional, acessamos, mediante sua autorização, informações e permissões da conta (identificador da página/perfil, tokens de acesso, publicação de conteúdo, mensagens diretas e métricas), estritamente para operar as funcionalidades da plataforma.</li>
        </ul>

        <h2 style={h2}>3. Como usamos os dados</h2>
        <ul style={ul}>
          <li>Autenticar o acesso e manter a segurança das contas.</li>
          <li>Produzir, aprovar, agendar e publicar conteúdo nas redes sociais conectadas.</li>
          <li>Gerenciar e responder mensagens e comentários das redes sociais conectadas.</li>
          <li>Gerar relatórios de desempenho e métricas para os clientes.</li>
          <li>Enviar notificações operacionais (por e-mail e notificações push) relacionadas ao uso da plataforma.</li>
        </ul>

        <h2 style={h2}>4. Integração com a Meta (Instagram e Facebook)</h2>
        <p>
          A plataforma integra-se às APIs da Meta Platforms, Inc. O uso e a transferência de informações
          recebidas dessas APIs seguem a Política de Uso de Dados da Plataforma Meta, incluindo os
          requisitos de Uso Limitado. Os tokens de acesso são utilizados apenas para executar as ações
          que você solicita e nunca são compartilhados com terceiros para fins de publicidade ou revenda.
        </p>

        <h2 style={h2}>5. Armazenamento e segurança</h2>
        <p>
          Os dados são armazenados em serviços de nuvem (Upstash Redis para dados estruturados e Vercel Blob
          para mídias), com controles de acesso e transmissão criptografada (HTTPS). Adotamos medidas técnicas
          e organizacionais razoáveis para proteger os dados contra acesso não autorizado, perda ou alteração.
        </p>

        <h2 style={h2}>6. Compartilhamento de dados</h2>
        <p>
          Não vendemos dados pessoais. O compartilhamento ocorre apenas com provedores de infraestrutura
          necessários à operação da plataforma (ex.: Meta, Upstash, Vercel) e quando exigido por lei.
        </p>

        <h2 style={h2}>7. Seus direitos (LGPD)</h2>
        <p>
          Nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você pode solicitar a
          confirmação, o acesso, a correção, a portabilidade e a <strong>exclusão</strong> dos seus dados,
          bem como revogar o consentimento a qualquer momento. Para o procedimento de exclusão, consulte a
          página <a href="/exclusao-de-dados" style={{ color: '#0a58ca' }}>Exclusão de dados</a>.
        </p>

        <h2 style={h2}>8. Retenção</h2>
        <p>
          Mantemos os dados enquanto durar a relação de uso da plataforma ou pelo período necessário ao
          cumprimento de obrigações legais. Após esse prazo, os dados são excluídos ou anonimizados.
        </p>

        <h2 style={h2}>9. Contato</h2>
        <p>
          Para dúvidas, solicitações ou exercício de direitos, entre em contato com o encarregado de proteção
          de dados pelo e-mail <a href={`mailto:${EMAIL}`} style={{ color: '#0a58ca' }}>{EMAIL}</a>.
        </p>

        <p style={{ ...meta, marginTop: 32 }}>Grupo 10+ · Soma10 Approval</p>
      </div>
    </div>
  )
}
