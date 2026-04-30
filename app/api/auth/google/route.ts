import { NextRequest, NextResponse } from 'next/server'

const APP_URL = 'https://recipe-app-orpin-chi.vercel.app'

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const callbackUri = APP_URL + '/api/auth/google/callback'

  const params = new URLSearchParams({
    client_id: clientId!,
    redirect_uri: callbackUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/documents.readonly',
    access_type: 'offline',
    prompt: 'consent'
  })

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
