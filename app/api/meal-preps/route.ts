import { NextRequest, NextResponse } from 'next/server'
import { dbGetMealPreps, dbSaveMealPrep } from '@/lib/db'
import { MealPrep } from '@/lib/types'

export async function GET() {
  try { return NextResponse.json({ meal_preps: await dbGetMealPreps() }) }
  catch (err: unknown) { return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const prep: MealPrep = { ...body, id: body.id || crypto.randomUUID(), sessions: body.sessions || [], created_at: body.created_at || new Date().toISOString(), updated_at: new Date().toISOString() }
    return NextResponse.json({ meal_prep: await dbSaveMealPrep(prep) })
  } catch (err: unknown) { return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 }) }
}
