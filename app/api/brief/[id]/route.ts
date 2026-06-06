import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const filePath = path.join(process.cwd(), 'data', 'pendentes', `${params.id}.json`)
  if (!fs.existsSync(filePath)) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  return NextResponse.json(data)
}
