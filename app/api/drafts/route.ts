import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function initDraftsTable() {
  await sql`CREATE TABLE IF NOT EXISTS drafts (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`
}

export async function GET() {
  try {
    await initDraftsTable()
    const rows = await sql`SELECT data FROM drafts ORDER BY updated_at DESC`
    return NextResponse.json({ drafts: rows.map((r: Record<string, unknown>) => r.data) })
  } catch (err: unknown) { return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    await initDraftsTable()
    const { sessionId, items } = await req.json()
    await sql`INSERT INTO drafts (id, data, updated_at) VALUES (${sessionId}, ${JSON.stringify({ sessionId, items })}, NOW()) ON CONFLICT (id) DO UPDATE SET data = ${JSON.stringify({ sessionId, items })}, updated_at = NOW()`
    return NextResponse.json({ ok: true })
  } catch (err: unknown) { return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  try {
    await initDraftsTable()
    const { sessionId } = await req.json()
    await sql`DELETE FROM drafts WHERE id = ${sessionId}`
    return NextResponse.json({ ok: true })
  } catch (err: unknown) { return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 }) }
}
