'use client'
import { useEffect, useState } from 'react'

// Conteudo interno de um avatar de cliente: renderiza a logo e, se a imagem
// falhar (ex.: URL do Instagram expirada = 403), cai para a inicial do nome.
// Nao desenha o circulo — herda o container (tamanho/fundo/fonte/cor) do pai,
// entao e um drop-in para o padrao `{x.logo ? <img .../> : inicial}`.
export default function AvatarCliente({ logo, nome }: { logo?: string; nome?: string }) {
  const [erro, setErro] = useState(false)
  // Reseta o estado de erro se a logo mudar (troca de cliente reaproveitando o no)
  useEffect(() => { setErro(false) }, [logo])
  const inicial = (nome || '?').trim()[0]?.toUpperCase() || '?'
  if (logo && !erro) {
    return <img src={logo} alt="" onError={() => setErro(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  }
  return <>{inicial}</>
}
