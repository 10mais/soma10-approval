'use client'

// Modal "Conectar redes sociais" no estilo GoHighLevel.
// Facebook e Instagram conectam de verdade via OAuth da Meta (uma autorização traz Página + Instagram).
// As demais redes ficam como "Em breve" até integrarmos cada API (cada uma exige app próprio e aprovação).

type Rede = {
  key: string
  nome: string
  cor: string
  ativo: boolean
  icone: React.ReactNode
}

const IG_GRAD = 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)'

const REDES: Rede[] = [
  {
    key: 'facebook', nome: 'Facebook', cor: '#1877f2', ativo: true,
    icone: <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
  },
  {
    key: 'instagram', nome: 'Instagram', cor: IG_GRAD, ativo: true,
    icone: <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>,
  },
  { key: 'google', nome: 'Google (GBP)', cor: '#4285f4', ativo: false, icone: <span style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>G</span> },
  { key: 'linkedin', nome: 'LinkedIn', cor: '#0a66c2', ativo: false, icone: <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> },
  { key: 'tiktok', nome: 'TikTok', cor: '#010101', ativo: false, icone: <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg> },
  { key: 'youtube', nome: 'YouTube', cor: '#ff0000', ativo: false, icone: <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> },
  { key: 'pinterest', nome: 'Pinterest', cor: '#e60023', ativo: false, icone: <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.746-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.987C24.007 5.367 18.641.001 12.017.001z"/></svg> },
  { key: 'threads', nome: 'Threads', cor: '#000000', ativo: false, icone: <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.331-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.74-1.757-.5-.586-1.27-.883-2.29-.89h-.029c-.82 0-1.927.225-2.633 1.282L8.71 8.179c.945-1.41 2.484-2.187 4.336-2.187h.043c3.094.02 4.937 1.91 5.12 5.222.107.046.214.094.32.143 1.49.7 2.58 1.76 3.154 3.07.797 1.82.871 4.79-1.553 7.16-1.85 1.81-4.1 2.628-7.18 2.65Z"/></svg> },
  { key: 'bluesky', nome: 'Bluesky', cor: '#0085ff', ativo: false, icone: <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M5.8 3.2C8.6 5.3 11.6 9.6 12 12c.4-2.4 3.4-6.7 6.2-8.8C20.3 1.7 23 .5 23 3.6c0 .6-.4 5.2-.6 5.9-.7 2.6-3.4 3.2-5.7 2.8 4.1.7 5.1 3 2.9 5.3-4.3 4.4-6.1-1.1-6.6-2.5-.1-.3-.1-.4-.2 0-.5 1.4-2.3 6.9-6.6 2.5-2.2-2.3-1.2-4.6 2.9-5.3-2.4.4-5-.2-5.7-2.8C.4 8.8 0 4.2 0 3.6 0 .5 2.7 1.7 4.8 3.2z"/></svg> },
]

export default function ConectarRedesModal({ clienteId, clienteNome, onClose }: { clienteId: string | null; clienteNome?: string; onClose: () => void }) {
  function conectar(rede: Rede) {
    if (!rede.ativo) return
    // Facebook e Instagram usam o mesmo OAuth da Meta (uma autorização traz Página + Instagram)
    const url = clienteId ? `/api/meta/oauth?cliente=${clienteId}` : '/api/meta/oauth'
    window.location.href = url
  }

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #f0f0f0' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111' }}>Conectar redes sociais</h3>
            {clienteNome
              ? <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>Cliente: <strong style={{ color: '#111' }}>{clienteNome}</strong></p>
              : <p style={{ margin: '4px 0 0', fontSize: 13, color: '#b45309' }}>Conexão geral — você escolherá o cliente de cada conta depois.</p>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, lineHeight: 1, color: '#999', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {REDES.map(rede => (
            <button key={rede.key} onClick={() => conectar(rede)} disabled={!rede.ativo} type="button"
              style={{
                position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12,
                border: '1.5px solid #eee', background: '#fff', cursor: rede.ativo ? 'pointer' : 'not-allowed',
                opacity: rede.ativo ? 1 : 0.55, textAlign: 'left', fontFamily: 'inherit',
              }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: rede.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {rede.icone}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111', lineHeight: 1.2 }}>{rede.nome}</span>
              {!rede.ativo && (
                <span style={{ position: 'absolute', top: 6, right: 6, fontSize: 9, fontWeight: 700, color: '#b45309', background: '#fff3cd', borderRadius: 999, padding: '2px 6px' }}>Em breve</span>
              )}
            </button>
          ))}
        </div>

        <div style={{ padding: '0 20px 20px', fontSize: 12, color: '#999' }}>
          Facebook e Instagram conectam pela API da Meta (uma autorização vincula a Página e a conta do Instagram). As demais redes serão habilitadas conforme cada integração for aprovada.
        </div>
      </div>
    </div>
  )
}
