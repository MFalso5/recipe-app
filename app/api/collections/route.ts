import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL!)

    const rows = await sql`
      SELECT
        data->>'source' as name,
        data->>'source_type' as source_type,
        MAX(data->>'cookbook_author') as author,
        MAX(data->>'cookbook_cover_url') as cover_url,
        COUNT(*)::int as recipe_count,
        COUNT(*) FILTER (WHERE (data->>'made') = 'true')::int as made_count,
        array_remove(array_agg(DISTINCT data->>'image_url'), NULL) as image_urls
      FROM recipes
      WHERE data->>'source' IS NOT NULL AND data->>'source' != ''
      GROUP BY data->>'source', data->>'source_type'
      ORDER BY COUNT(*) DESC
    `

    const collections = rows.map(r => ({
      name: r.name as string,
      source_type: ((r.source_type as string) || 'other') as 'cookbook' | 'website' | 'other',
      author: r.author as string | null,
      cover_url: r.cover_url as string | null,
      recipe_count: r.recipe_count as number,
      made_count: r.made_count as number,
      image_urls: ((r.image_urls as string[]) || []).slice(0, 4)
    }))

    return NextResponse.json({ collections })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
