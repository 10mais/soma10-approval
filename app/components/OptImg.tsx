'use client'
import Image from 'next/image'
import { useState } from 'react'

export default function OptImg({ src, alt = '', size, style, className }: {
  src: string; alt?: string; size: number; style?: React.CSSProperties; className?: string
}) {
  const [erro, setErro] = useState(false)
  if (!src || erro) return null
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
      onError={() => setErro(true)}
      style={{ objectFit: 'cover', borderRadius: '50%', ...style }}
      unoptimized={src.includes('blob.vercel-storage.com')}
    />
  )
}
