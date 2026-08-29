'use client'
import { useEffect } from 'react'
import { aplicarOrtografia } from '@/lib/ortografia'

// Aplica a preferência do corretor ortográfico assim que a página carrega.
// Não desenha nada: só escreve (ou não) o `spellcheck` no <html>, de onde todos
// os campos herdam. Ver lib/ortografia.
export default function Ortografia() {
  useEffect(() => { aplicarOrtografia() }, [])
  return null
}
