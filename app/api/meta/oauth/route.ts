import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  const APP_ID = process.env.APP_ID
  const BASE_URL = process.env.NEXTAUTH_URL || 'https://soma10-approval.vercel.app'
  const REDIRECT_URI = `${BASE_URL}/api/meta/callback`

  const scopes = [
    'pages_manage_posts',
    'pages_read_engagement',
    'pages_show_list',
    'instagram_basic',
    'instagram_content_publish',
    'business_management',
  ].join(',')

  const oauthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${scopes}&response_type=code&state=soma10`

  return NextResponse.redirect(oauthUrl)
}
