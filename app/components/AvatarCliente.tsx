'use client'
import { useEffect, useState } from 'react'

// Conteudo interno de um avatar de cliente: renderiza a logo e, se a imagem
// falhar (ex.: URL do Instagram expirada = 403), cai para a inicial do nome.
// Nao desenha o circulo — herda o container (tamanho/fundo/fonte/cor) do pai,
// entao e um drop-in para o padrao `{x.logo ? <img .../> : inicial}`.
export default function AvatarCliente({ logo, nome, clienteId }: { logo?: string; nome?: string; clienteId?: string }) {
  const [erro, setErro] = useState(false)
  // Reseta o estado de erro se a logo/cliente mudar (troca de cliente reaproveitando o no)
  useEffect(() => { setErro(false) }, [logo, clienteId])
  const inicial = (nome || '?').trim()[0]?.toUpperCase() || '?'
  const ehBlob = !!logo && /\.public\.blob\.vercel-storage\.com/i.test(logo)
  // Logo permanente (Blob) carrega direto; caso contrário passa pelo proxy do
  // servidor, que resolve/auto-conserta a foto e nunca devolve imagem quebrada.
  const src = ehBlob ? logo : (clienteId ? `/api/foto-cliente?clienteId=${encodeURIComponent(clienteId)}` : logo)
  if (src && !erro) {
    // Fundo NEUTRO por baixo da logo: várias telas põem o avatar num círculo
    // amarelo (var --marca) para a inicial ficar legível. Logo com cantos
    // transparentes (ex.: o selo da Sua Dupla Cidadania) deixava esse amarelo
    // vazar pelas beiradas. `background:#fff` cobre o container só onde há logo;
    // quando cai na inicial (return abaixo), o amarelo do container reaparece.
    return <img src={src} alt="" onError={() => setErro(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#fff' }} />
  }
  return <>{inicial}</>
}
