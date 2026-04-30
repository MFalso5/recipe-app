import { NextRequest, NextResponse } from 'next/server'
import { dbGetMealPrep, dbSaveMealPrep, dbDeleteMealPrep } from '@/lib/db'
import { MealPrep } from '@/lib/types'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const prep = await dbGetMealPrep(params.id)
    if (!prep) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ meal_prep: prep })
  } catch (err: unknown) { return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 }) }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const existing = await dbGetMealPrep(params.id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const updated: MealPrep = { ...existing as MealPrep, ...body, id: params.id, updated_at: new Date().toISOString() }
    return NextResponse.json({ meal_prep: await dbSaveMealPrep(updated) })
  } catch (err: unknown) { return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 }) }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try { await dbDeleteMealPrep(params.id); return NextResponse.json({ success: true }) }
  catch (err: unknown) { return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 }) }
}
