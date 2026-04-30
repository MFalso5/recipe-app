import { NextRequest, NextResponse } from 'next/server'
import { dbGetRecipe, dbSaveRecipe, dbDeleteRecipe } from '@/lib/db'
import { Recipe } from '@/lib/types'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const recipe = await dbGetRecipe(params.id)
    if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ recipe })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const existing = await dbGetRecipe(params.id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const updated: Recipe = { ...existing as Recipe, ...body, id: params.id, updated_at: new Date().toISOString() }
    await dbSaveRecipe(updated)
    return NextResponse.json({ recipe: updated })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await dbDeleteRecipe(params.id)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const existing = await dbGetRecipe(params.id) as Recipe
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const updated: Recipe = { ...existing, made: !existing.made, updated_at: new Date().toISOString() }
    await dbSaveRecipe(updated)
    return NextResponse.json({ recipe: updated })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
