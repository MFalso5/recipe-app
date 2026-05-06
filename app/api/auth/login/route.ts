import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + (process.env.SESSION_SECRET || 'rc-secret'))
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()

    let valid = false

    // Check DB credentials first
    try {
      const rows = await sql`SELECT username, password_hash FROM app_credentials WHERE id = 'main'`
      if (rows.length > 0) {
        const hash = await hashPassword(password)
        valid = rows[0].username === username && rows[0].password_hash === hash
      }
    } catch (_e) {
      // DB not set up yet, fall through to env vars
    }

    // Fall back to env vars
    if (!valid) {
      valid = username === process.env.APP_USERNAME && password === process.env.APP_PASSWORD
    }

    if (!valid) {
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
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
