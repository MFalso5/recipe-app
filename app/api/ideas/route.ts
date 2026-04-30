import { NextRequest, NextResponse } from 'next/server'
import { dbGetIdeas, dbSaveIdea } from '@/lib/db'
import { IdeaNote } from '@/lib/types'

export async function GET() {
  try { return NextResponse.json({ ideas: await dbGetIdeas() }) }
  catch (err: unknown) { return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const idea: IdeaNote = { ...body, id: body.id || crypto.randomUUID(), created_at: body.created_at || new Date().toISOString(), updated_at: new Date().toISOString() }
    return NextResponse.json({ idea: await dbSaveIdea(idea) })
  } catch (err: unknown) { return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 }) }
}
