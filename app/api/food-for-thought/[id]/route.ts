import { NextRequest, NextResponse } from 'next/server'
import { dbSaveFoodForThought, dbDeleteFoodForThought, dbGetFoodForThought } from '@/lib/db'
import { FoodForThoughtEntry } from '@/lib/types'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const updated: FoodForThoughtEntry = { ...body, id: params.id, updated_at: new Date().toISOString() }
    return NextResponse.json({ entry: await dbSaveFoodForThought(updated) })
  } catch (err: unknown) { return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 }) }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try { await dbDeleteFoodForThought(params.id); return NextResponse.json({ success: true }) }
  catch (err: unknown) { return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 }) }
}
