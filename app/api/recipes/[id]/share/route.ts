import { NextRequest, NextResponse } from 'next/server'
import { dbGetRecipe, dbSaveRecipe } from '@/lib/db'
import { Recipe } from '@/lib/types'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const recipe = await dbGetRecipe(params.id) as Recipe
    if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    // Generate a secure random token if not already set
    if (!recipe.share_token) {
      const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
        .map(b => b.toString(16).padStart(2, '0')).join('')
      recipe.share_token = token
      await dbSaveRecipe(recipe)
    }
    return NextResponse.json({ token: recipe.share_token })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
