import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { PARSE_SYSTEM_PROMPT, PARSE_SCHEMA } from '@/lib/parser'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const maxDuration = 60
export const dynamic = 'force-dynamic'

function extractJSON(raw: string): string {
  // Try to find JSON object in the response even if there's surrounding text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    return raw.slice(start, end + 1)
  }
  return raw
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll('images') as File[]
    const heroImageUrl = formData.get('hero_image_url') as string | null
    const pageCount = formData.get('page_count') as string | null

    if (!files.length) return NextResponse.json({ error: 'No images provided' }, { status: 400 })

    const imageContents = await Promise.all(files.map(async (file) => {
      const buffer = await file.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const mediaType = (file.type === 'image/heic' || file.type === 'image/heif')
        ? 'image/jpeg'
        : file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
      return {
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: mediaType, data: base64 }
      }
    }))

    const pageNote = pageCount && parseInt(pageCount) > 1
      ? `\n\nNote: This recipe spans ${pageCount} pages/images. Some pages may be full-page food photos with no text — use those as the recipe image but extract text only from pages that contain recipe content.`
      : ''

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      system: PARSE_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          ...imageContents,
          {
            type: 'text',
            text: `Extract the recipe from this image (or multiple pages if provided). Return JSON matching this schema:\n${PARSE_SCHEMA}\n\nImportant: If a quantity is unclear or partially obscured, use "?" — never guess. Note any page numbers and include them.${pageNote}\n\nReturn ONLY valid JSON — no markdown fences, no explanation, no trailing commas.`
          }
        ]
      }]
    })

    const raw = response.content.map((b: { type: string; text?: string }) => b.type === 'text' ? b.text : '').join('')
    const clean = extractJSON(raw.replace(/```json|```/g, '').trim())

    let parsed
    try {
      parsed = JSON.parse(clean)
    } catch {
      // Second attempt — ask Claude to fix the JSON
      const fixResponse = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        system: 'You are a JSON repair tool. Fix the following malformed JSON and return only valid JSON with no explanation.',
        messages: [{ role: 'user', content: clean }]
      })
      const fixedRaw = fixResponse.content.map((b: { type: string; text?: string }) => b.type === 'text' ? b.text : '').join('')
      parsed = JSON.parse(extractJSON(fixedRaw.replace(/```json|```/g, '').trim()))
    }

    if (heroImageUrl) parsed.image_url = heroImageUrl

    return NextResponse.json({ recipe: parsed })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
