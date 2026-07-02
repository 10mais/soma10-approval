import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Termos de Serviço — Soma10 Approval',
  description: 'Termos de Serviço da plataforma Soma10 Approval, do Grupo 10+.',
}

const EMAIL = '10mais@grupo10mais.com.br'
const ATUALIZADO = '2 de julho de 2026'

const page: React.CSSProperties = { minHeight: '100vh', background: '#f4f4f4', fontFamily: 'Inter, system-ui, sans-serif', padding: '40px 16px', color: '#333' }
const card: React.CSSProperties = { maxWidth: 760, margin: '0 auto', background: '#fff', borderRadius: 16, padding: '40px 36px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', lineHeight: 1.65, fontSize: 15 }
const h1: React.CSSProperties = { fontSize: 26, color: '#111', margin: '0 0 4px' }
const h2: React.CSSProperties = { fontSize: 18, color: '#111', margin: '32px 0 10px' }
const meta: React.CSSProperties = { fontSize: 13, color: '#999', margin: '0 0 8px' }
const ul: React.CSSProperties = { paddingLeft: 20, margin: '8px 0' }

export default function TermosPage() {
  return (
    <div style={page}>
      <div style={card}>
        <h1 style={h1}>Termos de Serviço</h1>
        <p style={meta}>Última atualização: {ATUALIZADO}</p>

        <p>
          Estes Termos de Serviço regem o uso da plataforma <strong>Soma10 Approval</strong>, operada pelo
          <strong> Grupo 10+</strong> e disponível em <strong>approval.soma10.com.br</strong>. Ao acessar ou
          utilizar a plataforma, você concorda com estes Termos. Caso não concorde, não utilize a plataforma.
        </p>

        <h2 style={h2}>1. Objeto</h2>
        <p>
          A Soma10 Approval é uma ferramenta de gestão de agência de marketing destinada à produção,
          aprovação, agendamento e publicação de conteúdo em redes sociais, além da gestão de tarefas,
          relatórios e relacionamento com clientes.
        </p>

        <h2 style={h2}>2. Cadastro e acesso</h2>
        <ul style={ul}>
          <li>O acesso é restrito a usuários autorizados (colaboradores do Grupo 10+ e clientes contratantes).</li>
          <li>Você é responsável por manter a confidencialidade das suas credenciais e por toda atividade realizada com a sua conta.</li>
          <li>É proibido compartilhar credenciais ou permitir o acesso de terceiros não autorizados.</li>
        </ul>

        <h2 style={h2}>3. Uso das contas de redes sociais</h2>
        <p>
          Ao conectar uma conta profissional do Instagram ou Facebook, você autoriza a plataforma a realizar,
          em seu nome, as ações que você solicitar — como publicar conteúdo, responder mensagens e consultar
          métricas. Você declara possuir os direitos e as permissões necessárias sobre as contas conectadas e
          sobre o conteúdo publicado.
        </p>

        <h2 style={h2}>4. Responsabilidades do usuário</h2>
        <ul style={ul}>
          <li>Não publicar conteúdo ilegal, ofensivo, difamatório ou que viole direitos de terceiros.</li>
          <li>Respeitar as políticas das plataformas de terceiros integradas (Meta/Instagram/Facebook).</li>
          <li>Não tentar comprometer a segurança, a integridade ou a disponibilidade da plataforma.</li>
        </ul>

        <h2 style={h2}>5. Propriedade intelectual</h2>
        <p>
          O software, a marca e os elementos visuais da plataforma pertencem ao Grupo 10+. O conteúdo enviado
          por você permanece de sua propriedade; você nos concede uma licença limitada para processá-lo com a
          finalidade de operar as funcionalidades da plataforma.
        </p>

        <h2 style={h2}>6. Disponibilidade e limitação de responsabilidade</h2>
        <p>
          Empenhamo-nos em manter a plataforma disponível e segura, mas ela é fornecida "no estado em que se
          encontra". Não nos responsabilizamos por indisponibilidades de serviços de terceiros (como as APIs
          da Meta) nem por danos indiretos decorrentes do uso da plataforma.
        </p>

        <h2 style={h2}>7. Encerramento</h2>
        <p>
          Podemos suspender ou encerrar o acesso em caso de violação destes Termos. Você pode solicitar o
          encerramento da sua conta e a exclusão dos seus dados a qualquer momento, conforme a página
          <a href="/exclusao-de-dados" style={{ color: '#0a58ca' }}> Exclusão de dados</a>.
        </p>

        <h2 style={h2}>8. Alterações</h2>
        <p>
          Estes Termos podem ser atualizados periodicamente. A versão vigente estará sempre disponível nesta
          página, com a respectiva data de atualização.
        </p>

        <h2 style={h2}>9. Contato</h2>
        <p>
          Dúvidas sobre estes Termos podem ser enviadas para
          <a href={`mailto:${EMAIL}`} style={{ color: '#0a58ca' }}> {EMAIL}</a>.
        </p>

        <p style={{ ...meta, marginTop: 32 }}>Grupo 10+ · Soma10 Approval</p>
      </div>
    </div>
  )
}
