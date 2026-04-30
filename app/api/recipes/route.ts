import { NextRequest, NextResponse } from 'next/server'
import { dbGetRecipes, dbSaveRecipe } from '@/lib/db'
import { Recipe } from '@/lib/types'

export async function GET() {
  try {
    const recipes = await dbGetRecipes()
    return NextResponse.json({ recipes })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const recipe: Recipe = {
      ...body,
      id: body.id || crypto.randomUUID(),
      made: body.made || false,
      made_log: body.made_log || [],
      tags: body.tags || [],
      created_at: body.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    const saved = await dbSaveRecipe(recipe)
    return NextResponse.json({ recipe: saved })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
