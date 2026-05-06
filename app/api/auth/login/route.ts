import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  const validUsername = username === process.env.APP_USERNAME
  const validPassword = password === process.env.APP_PASSWORD

  if (!validUsername || !validPassword) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('rc_session', process.env.SESSION_SECRET!, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30
  })
  return res
}
