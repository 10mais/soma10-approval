import { NextResponse } from 'next/server'

// Rota de criação do admin inicial — DESATIVADA permanentemente após o primeiro uso.
export async function POST() {
  return NextResponse.json({ error: 'rota desativada' }, { status: 410 })
}
