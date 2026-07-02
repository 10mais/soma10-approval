import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Exclusão de dados — Soma10 Approval',
  description: 'Como solicitar a exclusão dos seus dados na plataforma Soma10 Approval, do Grupo 10+.',
}

const EMAIL = '10mais@grupo10mais.com.br'
const ATUALIZADO = '2 de julho de 2026'

const page: React.CSSProperties = { minHeight: '100vh', background: '#f4f4f4', fontFamily: 'Inter, system-ui, sans-serif', padding: '40px 16px', color: '#333' }
const card: React.CSSProperties = { maxWidth: 760, margin: '0 auto', background: '#fff', borderRadius: 16, padding: '40px 36px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', lineHeight: 1.65, fontSize: 15 }
const h1: React.CSSProperties = { fontSize: 26, color: '#111', margin: '0 0 4px' }
const h2: React.CSSProperties = { fontSize: 18, color: '#111', margin: '32px 0 10px' }
const meta: React.CSSProperties = { fontSize: 13, color: '#999', margin: '0 0 8px' }
const ol: React.CSSProperties = { paddingLeft: 20, margin: '8px 0' }
const box: React.CSSProperties = { margin: '18px 0', padding: '16px 18px', background: '#f8f9fb', border: '1px solid #eef0f4', borderRadius: 12 }

export default function ExclusaoDeDadosPage() {
  return (
    <div style={page}>
      <div style={card}>
        <h1 style={h1}>Exclusão de dados</h1>
        <p style={meta}>Última atualização: {ATUALIZADO}</p>

        <p>
          Você pode solicitar a exclusão de todos os seus dados pessoais e do conteúdo associado à sua conta
          na plataforma <strong>Soma10 Approval</strong>, operada pelo <strong>Grupo 10+</strong>. Esta página
          descreve como fazer essa solicitação e o que acontece em seguida.
        </p>

        <h2 style={h2}>Como solicitar a exclusão</h2>
        <ol style={ol}>
          <li>
            Envie um e-mail para <a href={`mailto:${EMAIL}?subject=Solicitação de exclusão de dados`} style={{ color: '#0a58ca' }}>{EMAIL}</a>
            {' '}com o assunto <strong>"Solicitação de exclusão de dados"</strong>.
          </li>
          <li>Informe o <strong>e-mail cadastrado</strong> na plataforma e, se aplicável, o nome da conta do Instagram/Facebook conectada.</li>
          <li>Nossa equipe confirmará sua identidade e processará a solicitação.</li>
        </ol>

        <div style={box}>
          <strong>Prazo:</strong> concluímos a exclusão em até <strong>30 dias</strong> a partir da confirmação
          da solicitação e enviamos uma confirmação por e-mail quando o processo for finalizado.
        </div>

        <h2 style={h2}>O que é excluído</h2>
        <ol style={ol}>
          <li>Dados de cadastro (nome, e-mail, telefone, foto de perfil) e credenciais de acesso.</li>
          <li>Conteúdo enviado por você que esteja armazenado na plataforma (textos, imagens, vídeos e documentos).</li>
          <li>Tokens de acesso e vínculos com as contas do Instagram e Facebook conectadas.</li>
        </ol>

        <h2 style={h2}>Desconectar as contas da Meta</h2>
        <p>
          A qualquer momento, você também pode remover o acesso da Soma10 Approval diretamente nas suas contas
          da Meta, em <strong>Configurações → Aplicativos e sites</strong> (Facebook) ou nas configurações de
          aplicativos conectados do Instagram. Isso revoga imediatamente os tokens de acesso; para a exclusão
          completa dos demais dados, siga também o procedimento por e-mail descrito acima.
        </p>

        <h2 style={h2}>Observações</h2>
        <p>
          Alguns registros podem ser retidos por período limitado quando exigido por obrigação legal. Nesses
          casos, os dados ficam restritos e são eliminados assim que o prazo legal se encerra.
        </p>

        <h2 style={h2}>Contato</h2>
        <p>
          Dúvidas sobre este procedimento podem ser enviadas para
          <a href={`mailto:${EMAIL}`} style={{ color: '#0a58ca' }}> {EMAIL}</a>.
        </p>

        <p style={{ ...meta, marginTop: 32 }}>Grupo 10+ · Soma10 Approval</p>
      </div>
    </div>
  )
}
