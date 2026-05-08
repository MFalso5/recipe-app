import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { PARSE_SYSTEM_PROMPT, PARSE_SCHEMA } from '@/lib/parser'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const maxDuration = 60
export const dynamic = 'force-dynamic'

function extractJSON(raw: string): string {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) return raw.slice(start, end + 1)
  return raw
}

// Extract og:site_name or fall back to hostname
function extractSiteName(html: string, url: string): string | null {
  const ogMatch = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i)
  if (ogMatch?.[1]?.trim()) return ogMatch[1].trim()
  try {
    const host = new URL(url).hostname.replace('www.', '')
    const name = host.split('.')[0]
    return name.charAt(0).toUpperCase() + name.slice(1)
  } catch { return null }
}

// Extract JSON-LD recipe block from HTML if present — passed to Claude as a quantity reference
function extractJsonLd(html: string): Record<string, unknown> | null {
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim())
      const schemas = Array.isArray(data) ? data : [data]
      for (const schema of schemas) {
        if (schema['@type'] === 'Recipe') return schema
        if (schema['@graph']) {
          const recipe = schema['@graph'].find((s: Record<string, unknown>) => s['@type'] === 'Recipe')
          if (recipe) return recipe
        }
      }
    } catch { /* continue */ }
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 })

    // Clean tracking parameters
    let cleanUrl = url
    try {
      const u = new URL(url)
      ;['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid'].forEach(p => u.searchParams.delete(p))
      cleanUrl = u.toString()
    } catch { /* keep original */ }

    // Fetch the page
    const res = await fetch(cleanUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(15000)
    })

    if (!res.ok) return NextResponse.json({ error: 'Failed to fetch URL: ' + res.status }, { status: 400 })

    const html = await res.text()

    // Extract images from page
    const images: string[] = []
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
    let imgMatch
    while ((imgMatch = imgRegex.exec(html)) !== null) {
      const src = imgMatch[1]
      if (src && !src.startsWith('data:') && (src.includes('jpg') || src.includes('jpeg') || src.includes('png') || src.includes('webp')) && src.length > 20) {
        try {
          const fullUrl = src.startsWith('http') ? src : new URL(src, cleanUrl).toString()
          if (!images.includes(fullUrl)) images.push(fullUrl)
        } catch { /* skip */ }
      }
    }

    // Extract site name and any JSON-LD data present on the page
    const siteName = extractSiteName(html, cleanUrl)
    const jsonLd = extractJsonLd(html)

    // Clean page text for Claude
    const cleanHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000)

    // If JSON-LD is present, include it so Claude can use it as a quantity reference
    const jsonLdBlock = jsonLd
      ? `\n\nSTRUCTURED DATA FOUND ON THIS PAGE (JSON-LD):
Use the ingredient strings in recipeIngredient as your authoritative source for ingredient quantities and names — copy them exactly, then apply shorthand formatting rules below. Do not invent or change any quantity.
${JSON.stringify(jsonLd, null, 2)}`
      : ''

    const userMessage = `Extract the complete recipe from this page and return JSON matching the schema below.

SOURCE URL: ${cleanUrl}
SOURCE NAME: ${siteName || 'extract from page if possible'}
${jsonLdBlock}

PAGE TEXT:
${cleanHtml}

SCHEMA:
${PARSE_SCHEMA}

RULES:
- If JSON-LD structured data is provided above, copy ingredient strings from recipeIngredient EXACTLY — never change any quantity or amount
- Apply unit shorthand: cup/cups→C, tablespoon/tablespoons/tbsp→T, teaspoon/teaspoons/tsp→t, ounce/ounces→oz, pound/pounds/lb/lbs→#, gram/grams→g, kilogram/kilograms→kg, milliliter/milliliters→ml, liter/liters→L, quart/quarts/qt→qt, fluid ounce/fl oz→fl oz, pint/pints→pt
- qty = number and unit ONLY. name = everything else including size descriptors and prep notes
- Convert parenthetical descriptors to comma format: "onion (diced)" → "onion, diced". Keep parentheses only for measurement alternatives like "1 C (240g)"
- If you cannot confidently determine qty for an ingredient, set qty to "" and needs_review to true — never guess at a quantity
- Copy all instruction step text VERBATIM — never summarize or reword
- Capture description, notes, storage, tips, and variations from the page
- Set source to "${siteName || 'extract from page'}" and source_type to "website"

Return ONLY valid JSON — no markdown fences, no explanation.`

    const claudeRes = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      system: PARSE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }]
    })

    const raw = claudeRes.content.map(b => b.type === 'text' ? b.text : '').join('')
    const clean = extractJSON(raw.replace(/```json|```/g, '').trim())
    const recipe = JSON.parse(clean)

    // Always enforce these fields
    recipe.source_url = cleanUrl
    recipe.source_type = 'website'
    if (!recipe.source && siteName) recipe.source = siteName

    return NextResponse.json({
      recipe,
      images: images.slice(0, 12),
      data_source: jsonLd ? 'jsonld' : 'claude',
      has_jsonld: !!jsonLd
    })

  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
