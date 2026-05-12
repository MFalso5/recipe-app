import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { PARSE_SYSTEM_PROMPT, PARSE_SCHEMA } from '@/lib/parser'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const maxDuration = 60
export const dynamic = 'force-dynamic'

function extractJSON(raw: string): string {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    return raw.slice(start, end + 1)
  }
  return raw
}

function extractJSONArray(raw: string): string {
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start !== -1 && end !== -1 && end > start) {
    return raw.slice(start, end + 1)
  }
  // Fallback: if no array found, wrap any object we can find
  const obj = extractJSON(raw)
  if (obj !== raw) return '[' + obj + ']'
  return raw
}

// Appended to PARSE_SYSTEM_PROMPT only in batch mode
const BATCH_RULES = `

BATCH MODE — MULTIPLE RECIPES PER BATCH:

These images are consecutive cookbook pages and may contain more than one recipe.

RETURN FORMAT: A JSON array — even if there is only 1 recipe: [{ ... }]

RECIPE BOUNDARY RULES:
1. A new recipe begins ONLY when a distinct title/heading appears
2. A recipe continues across page breaks until the next title appears
3. Full-page food photography: skip for text extraction — do not create a recipe for a photo-only page
4. Section headers (e.g. "Brioche & Doughnuts", "Pâte à Choux") are chapter headers, NOT recipe titles — ignore them as recipe starts

SUB-RECIPE RULES:
5. If an ingredient references another recipe by page number (e.g. "Diplomat Cream (page 374)", "Chocolate Glaze (page 377)") AND that recipe is NOT physically present in these images: preserve it as a plain ingredient string exactly as written — do NOT create a sub_recipe entry for it
6. If a referenced recipe IS physically present in these images: parse it as its own recipe object in the array

FIDELITY RULES:
7. Never convert between metric and imperial — preserve both if both are listed
8. For unclear or obscured quantities: use "?"
9. Capture page numbers for each recipe

Return the array in the order recipes appear in the images.
Return ONLY a valid JSON array — no markdown fences, no explanation, no trailing commas.`

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll('images') as File[]
    const heroImageUrl = formData.get('hero_image_url') as string | null
    const pageCount = formData.get('page_count') as string | null
    const batchMode = formData.get('batch_mode') === 'true'

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

    // ── BATCH MODE ────────────────────────────────────────────────────────────
    if (batchMode) {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 16000,
        system: PARSE_SYSTEM_PROMPT + BATCH_RULES,
        messages: [{
          role: 'user',
          content: [
            ...imageContents,
            {
              type: 'text',
              text: `Extract all recipes from these ${files.length} cookbook page(s). Return a JSON array where each element matches this schema:\n${PARSE_SCHEMA}\n\nReturn ONLY a valid JSON array — no markdown fences, no explanation, no trailing commas.`
            }
          ]
        }]
      })

      const raw = response.content
        .map((b: { type: string; text?: string }) => b.type === 'text' ? b.text : '')
        .join('')
      const clean = extractJSONArray(raw.replace(/```json|```/g, '').trim())

      let parsed: unknown[]
      try {
        const result = JSON.parse(clean)
        parsed = Array.isArray(result) ? result : [result]
      } catch {
        // Repair attempt
        const fixResponse = await client.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 8000,
          system: 'You are a JSON repair tool. Fix the following malformed JSON and return only a valid JSON array with no explanation or markdown.',
          messages: [{ role: 'user', content: clean }]
        })
        const fixedRaw = fixResponse.content
          .map((b: { type: string; text?: string }) => b.type === 'text' ? b.text : '')
          .join('')
        const fixedClean = extractJSONArray(fixedRaw.replace(/```json|```/g, '').trim())
        const fixedResult = JSON.parse(fixedClean)
        parsed = Array.isArray(fixedResult) ? fixedResult : [fixedResult]
      }

      return NextResponse.json({ recipes: parsed })
    }

    // ── SINGLE MODE (existing behaviour) ─────────────────────────────────────
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

    const raw = response.content
      .map((b: { type: string; text?: string }) => b.type === 'text' ? b.text : '')
      .join('')
    const clean = extractJSON(raw.replace(/```json|```/g, '').trim())

    let parsed
    try {
      parsed = JSON.parse(clean)
    } catch {
      const fixResponse = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        system: 'You are a JSON repair tool. Fix the following malformed JSON and return only valid JSON with no explanation.',
        messages: [{ role: 'user', content: clean }]
      })
      const fixedRaw = fixResponse.content
        .map((b: { type: string; text?: string }) => b.type === 'text' ? b.text : '')
        .join('')
      parsed = JSON.parse(extractJSON(fixedRaw.replace(/```json|```/g, '').trim()))
    }

    if (heroImageUrl) parsed.image_url = heroImageUrl

    return NextResponse.json({ recipe: parsed })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
