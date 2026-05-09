import { NextRequest, NextResponse } from 'next/server'
import { dbFindDuplicate } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const title = searchParams.get('title') || ''
    const source = searchParams.get('source') || ''
    if (!title) return NextResponse.json({ duplicate: null })
    const duplicate = await dbFindDuplicate(title, source)
    return NextResponse.json({ duplicate })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
