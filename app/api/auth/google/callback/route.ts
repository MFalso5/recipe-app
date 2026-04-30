export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from 'next/server'

const APP_URL = 'https://recipe-app-orpin-chi.vercel.app'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.redirect(APP_URL + '/import/google-docs?error=no_code')

  const callbackUri = APP_URL + '/api/auth/google/callback'

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: callbackUri,
        grant_type: 'authorization_code'
      })
    })

    const tokens = await res.json()
    if (tokens.error) throw new Error(tokens.error)

    const response = NextResponse.redirect(APP_URL + '/import/google-docs')
    response.cookies.set('google_access_token', tokens.access_token, {
      httpOnly: true, secure: true, maxAge: 3600, sameSite: 'lax'
    })
    return response
  } catch (err) {
    return NextResponse.redirect(APP_URL + '/import/google-docs?error=auth_failed')
  }
}
