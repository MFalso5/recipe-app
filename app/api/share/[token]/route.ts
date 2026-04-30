import { NextRequest, NextResponse } from 'next/server'
import { dbGetRecipes } from '@/lib/db'
import { Recipe } from '@/lib/types'

export async function GET(_: NextRequest, { params }: { params: { token: string } }) {
  try {
    const recipes = await dbGetRecipes() as Recipe[]
    const recipe = recipes.find(r => r.share_token === params.token)
    if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ recipe })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
