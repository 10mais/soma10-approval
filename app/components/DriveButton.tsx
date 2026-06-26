'use client'
import { useState } from 'react'

// Botao que abre o Google Picker (Drive nativo) dentro do sistema.
// O usuario navega no Drive da conta, seleciona criativos e eles entram no post
// (na ordem da numeracao das laminas). Requer:
//   NEXT_PUBLIC_GOOGLE_CLIENT_ID  (OAuth Client ID web)
//   NEXT_PUBLIC_GOOGLE_API_KEY    (developer key / API key do Picker)

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
const MIMES = 'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime'

function carregarScript(src: string): Promise<void> {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res()
    const s = document.createElement('script')
    s.src = src; s.async = true
    s.onload = () => res()
    s.onerror = () => rej(new Error('Falha ao carregar ' + src))
    document.head.appendChild(s)
  })
}

export default function DriveButton({ onArquivos }: { onArquivos: (files: File[]) => Promise<void> | void }) {
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  if (!CLIENT_ID || !API_KEY) return null // so aparece quando configurado

  async function baixarSelecionados(docs: any[], token: string) {
    // Ordena pela numeracao das laminas (1, 2, 3... 10)
    const ordenados = [...docs].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt', { numeric: true, sensitivity: 'base' }))
    const files: File[] = []
    for (const d of ordenados) {
      const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${d.id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: 'Bearer ' + token } })
      if (!resp.ok) { setErro(`Não foi possível baixar "${d.name}".`); continue }
      const blob = await resp.blob()
      files.push(new File([blob], d.name || `arquivo-${d.id}`, { type: d.mimeType || blob.type }))
    }
    if (files.length) await onArquivos(files)
  }

  function montarPicker(token: string) {
    const g = (window as any).google
    const view = new g.picker.DocsView(g.picker.ViewId.DOCS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false)
      .setMimeTypes(MIMES)
    const picker = new g.picker.PickerBuilder()
      .enableFeature(g.picker.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(token)
      .setDeveloperKey(API_KEY)
      .setOrigin(window.location.protocol + '//' + window.location.host)
      .addView(view)
      .setTitle('Selecione os criativos no Drive')
      .setCallback(async (data: any) => {
        if (data.action === g.picker.Action.PICKED) {
          setCarregando(true)
          try { await baixarSelecionados(data.docs || [], token) }
          catch (e: any) { setErro(e?.message || 'Erro ao baixar do Drive.') }
          finally { setCarregando(false) }
        } else if (data.action === g.picker.Action.CANCEL) {
          setCarregando(false)
        }
      })
      .build()
    picker.setVisible(true)
  }

  async function abrir() {
    setErro('')
    setCarregando(true)
    try {
      await carregarScript('https://apis.google.com/js/api.js')
      await carregarScript('https://accounts.google.com/gsi/client')
      await new Promise<void>((res) => (window as any).gapi.load('picker', () => res()))
      const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: (resp: any) => {
          if (resp?.access_token) montarPicker(resp.access_token)
          else { setErro('Não foi possível autenticar no Google.'); setCarregando(false) }
        },
      })
      tokenClient.requestAccessToken()
      // O loading continua ate o callback do token; o picker some o loading ao terminar/cancelar
      setCarregando(false)
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível abrir o Google Drive.')
      setCarregando(false)
    }
  }

  return (
    <div>
      <button type="button" onClick={abrir} disabled={carregando}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center', padding: '10px 12px', background: '#fff', border: '1.5px solid #1a73e8', color: '#1a73e8', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: carregando ? 'default' : 'pointer' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
        {carregando ? 'Abrindo o Drive...' : 'Selecionar criativos do Google Drive'}
      </button>
      {erro && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#dc2626' }}>{erro}</p>}
    </div>
  )
}
