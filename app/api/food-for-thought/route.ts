import { NextRequest, NextResponse } from 'next/server'
import { dbGetFoodForThought, dbSaveFoodForThought } from '@/lib/db'
import { FoodForThoughtEntry } from '@/lib/types'

export async function GET() {
  try { return NextResponse.json({ entries: await dbGetFoodForThought() }) }
  catch (err: unknown) { return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const entry: FoodForThoughtEntry = {
      ...body,
      id: body.id || crypto.randomUUID(),
      tags: body.tags || [],
      created_at: body.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    return NextResponse.json({ entry: await dbSaveFoodForThought(entry) })
  } catch (err: unknown) { return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 }) }
}
