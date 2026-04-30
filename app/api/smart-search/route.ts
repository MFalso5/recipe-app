import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { dbGetRecipes } from '@/lib/db'
import { Recipe } from '@/lib/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const maxDuration = 30
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json()
    if (!query) return NextResponse.json({ ids: [] })

    const recipes = await dbGetRecipes() as Recipe[]

    // Build a concise recipe index for Claude
    const index = recipes.map(r => ({
      id: r.id,
      title: r.title,
      source: r.source,
      tags: [...(r.tags || []), ...(r.dietary_tags || [])].join(', '),
      yield: r.yield,
      time: r.time_active,
      ingredients: r.ingredient_groups.flatMap(g => g.ingredients.map(i => i.name)).slice(0, 12).join(', ')
    }))

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `You are a recipe search assistant. Given a natural language query, return the IDs of matching recipes from this library.

Query: "${query}"

Recipe library:
${JSON.stringify(index, null, 2)}

Return ONLY a JSON array of matching recipe IDs, ordered by relevance. If nothing matches, return [].
Example: ["id1", "id2", "id3"]`
      }]
    })

    const raw = response.content.map((b: { type: string; text?: string }) => b.type === 'text' ? b.text : '').join('')
    const clean = raw.replace(/```json|```/g, '').trim()
    const start = clean.indexOf("["); const end = clean.lastIndexOf("]"); const match = start !== -1 && end !== -1 ? [clean.slice(start, end + 1)] : null
    const ids = match ? JSON.parse(match[0]) : []

    return NextResponse.json({ ids })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error', ids: [] }, { status: 500 })
  }
}
