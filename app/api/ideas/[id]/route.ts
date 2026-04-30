import { NextRequest, NextResponse } from 'next/server'
import { dbGetIdea, dbSaveIdea, dbDeleteIdea } from '@/lib/db'
import { IdeaNote } from '@/lib/types'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const existing = await dbGetIdea(params.id)
    const updated: IdeaNote = { ...existing as IdeaNote, ...body, id: params.id, updated_at: new Date().toISOString() }
    return NextResponse.json({ idea: await dbSaveIdea(updated) })
  } catch (err: unknown) { return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 }) }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try { await dbDeleteIdea(params.id); return NextResponse.json({ success: true }) }
  catch (err: unknown) { return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 }) }
}
