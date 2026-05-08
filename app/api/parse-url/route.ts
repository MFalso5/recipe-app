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

function extractJSONArray(raw: string): string {
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start !== -1 && end !== -1 && end > start) return raw.slice(start, end + 1)
  return raw
}

// Extract JSON-LD structured recipe data from HTML
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

// Extract site name — tries og:site_name first, then falls back to hostname
function extractSiteName(html: string, url: string): string | null {
  // Try og:site_name meta tag — most recipe sites include this with proper capitalization
  const ogMatch = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i)
  if (ogMatch?.[1]?.trim()) return ogMatch[1].trim()

  // Fall back to hostname — title-case the domain name
  try {
    const host = new URL(url).hostname.replace('www.', '')
    const domainName = host.split('.')[0]
    return domainName.charAt(0).toUpperCase() + domainName.slice(1)
  } catch { return null }
}

// Parse ISO 8601 duration to human-readable string
function parseTime(iso: string): string | null {
  if (!iso) return null
  const h = iso.match(/(\d+)H/)?.[1]
  const m = iso.match(/(\d+)M/)?.[1]
  if (h && m) return h + ' hr ' + m + ' min'
  if (h) return h + ' hr'
  if (m) return m + ' min'
  return null
}

// Ask Claude to format raw ingredient strings from JSON-LD into qty/name pairs.
// FORMATTING ONLY — Claude must never change quantities or ingredient meaning.
async function formatIngredients(rawIngredients: string[]): Promise<Record<string, unknown>[]> {
  const prompt = `You are a recipe data formatter. Your ONLY job is to split ingredient strings into a qty field and a name field, and apply unit shorthand. You must NEVER change any quantity, amount, or ingredient meaning.

SHORTHAND — apply these unit conversions exactly:
cup / cups → C
tablespoon / tablespoons / tbsp → T
teaspoon / teaspoons / tsp → t
ounce / ounces → oz
pound / pounds / lb / lbs → #
gram / grams → g
kilogram / kilograms → kg
milliliter / milliliters → ml
liter / liters → L
quart / quarts / qt → qt
fluid ounce / fluid ounces / fl oz → fl oz
pint / pints → pt

SPLITTING RULES:
- qty = the number and unit ONLY
- name = everything else (size descriptor, prep note, form description)
- "2 cups flour" → qty: "2 C", name: "flour"
- "1/2 teaspoon salt" → qty: "1/2 t", name: "salt"
- "¼ teaspoon pepper" → qty: "¼ t", name: "pepper"
- "1½ pounds broccoli" → qty: "1½ #", name: "broccoli"
- "1 garlic clove, minced" → qty: "1", name: "garlic clove, minced"
- "1 medium onion, sliced" → qty: "1", name: "medium onion, sliced"
- "3 large eggs" → qty: "3", name: "large eggs"
- "salt to taste" → qty: "to taste", name: "salt"
- "1 t grated lemon zest plus 3 T lemon juice" → qty: "1 t", name: "grated lemon zest plus 3 T lemon juice"

PARENTHESES RULE:
- Convert parenthetical DESCRIPTORS to comma format:
  "1 medium onion (diced)" → qty: "1", name: "medium onion, diced"
  "2 C flour (sifted)" → qty: "2 C", name: "flour, sifted"
- KEEP parentheses when they contain a measurement ALTERNATIVE:
  "1 C (240g) flour" → qty: "1 C (240g)", name: "flour"
  "2 oz (56g) chocolate" → qty: "2 oz (56g)", name: "chocolate"

NEEDS REVIEW — if you cannot confidently split the string, set needs_review: true, put the full original string in name, and set qty to "":
- Use this when the string is ambiguous or unclear
- NEVER guess at a quantity — fail safe rather than guess wrong

CRITICAL RULES:
- Never change any number or quantity
- Never add or remove words from the ingredient name
- Never reorder ingredients
- Preserve Unicode fractions exactly as written (½, ¼, ¾, ⅓, ⅔, etc.)
- Return exactly ${rawIngredients.length} ingredients in the same order

Return ONLY a JSON array with no markdown fences, no explanation:
[{"qty": "...", "name": "...", "needs_review": false}, ...]

Ingredients to format:
${JSON.stringify(rawIngredients, null, 2)}`

  const res = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }]
  })

  const raw = res.content.map(b => b.type === 'text' ? b.text : '').join('')
  const clean = extractJSONArray(raw.replace(/```json|```/g, '').trim())
  const parsed = JSON.parse(clean)

  return parsed.map((ing: Record<string, unknown>) => ({
    qty: String(ing.qty || ''),
    name: String(ing.name || ''),
    is_linked_recipe: false,
    needs_review: Boolean(ing.needs_review) || false
  }))
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 })

    // Clean UTM and tracking parameters
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

    // Extract site name from og:site_name or hostname
    const siteName = extractSiteName(html, cleanUrl)

    // STEP 1: Try JSON-LD structured data first
    const jsonLdSchema = extractJsonLd(html)
    let dataSource = 'claude'
    let recipe: Record<string, unknown>

    if (jsonLdSchema && jsonLdSchema.name && jsonLdSchema.recipeIngredient) {
      // JSON-LD found — use it as source of truth for ingredients and steps
      // Claude formats ingredients only — never changes quantities or meaning
      const rawIngredients = jsonLdSchema.recipeIngredient as string[]

      let ingredients: Record<string, unknown>[]
      try {
        ingredients = await formatIngredients(rawIngredients)
      } catch {
        // If Claude formatting fails, put full strings in name field flagged for review
        ingredients = rawIngredients.map(s => ({
          qty: '',
          name: s,
          is_linked_recipe: false,
          needs_review: true
        }))
      }

      // Parse instructions from JSON-LD
      const rawInstructions = jsonLdSchema.recipeInstructions
      const steps: Record<string, unknown>[] = []
      if (Array.isArray(rawInstructions)) {
        rawInstructions.forEach((step: unknown, i: number) => {
          if (typeof step === 'string') {
            steps.push({ num: i + 1, time: null, text: step })
          } else if (typeof step === 'object' && step !== null) {
            const s = step as Record<string, unknown>
            const text = String(s.text || s.name || '')
            if (text) steps.push({ num: i + 1, time: null, text })
          }
        })
      } else if (typeof rawInstructions === 'string') {
        rawInstructions.split(/\n+/).filter(Boolean).forEach((t, i) => {
          steps.push({ num: i + 1, time: null, text: t.trim() })
        })
      }

      // Extract yield
      const yieldRaw = jsonLdSchema.recipeYield
      const yieldStr = Array.isArray(yieldRaw) ? String(yieldRaw[0]) : String(yieldRaw || '')

      // Extract image URL
      const imageRaw = jsonLdSchema.image
      let imageUrl: string | null = null
      if (typeof imageRaw === 'string') imageUrl = imageRaw
      else if (Array.isArray(imageRaw) && imageRaw.length > 0) {
        imageUrl = typeof imageRaw[0] === 'string' ? imageRaw[0] : (imageRaw[0] as Record<string, unknown>).url as string
      } else if (imageRaw && typeof imageRaw === 'object') {
        imageUrl = (imageRaw as Record<string, unknown>).url as string
      }

      const jsonldRecipe: Record<string, unknown> = {
        title: String(jsonLdSchema.name || ''),
        source: siteName,
        source_url: cleanUrl,
        source_type: 'website',
        description: (jsonLdSchema.description as string) || null,
        yield: yieldStr || null,
        time_active: parseTime(jsonLdSchema.prepTime as string) || parseTime(jsonLdSchema.cookTime as string) || null,
        temperature: null,
        before_you_begin: null,
        equipment: null,
        image_url: imageUrl,
        ingredient_groups: [{ group_name: null, ingredients }],
        step_groups: [{ group_name: null, steps }],
        notes: null,
        storage: null,
        tags: [],
        dietary_tags: [],
        variations: null,
        sub_recipes: null,
        data_source: 'jsonld'
      }

      // Use Claude to fill in metadata fields only (description, tags, notes, storage, before_you_begin)
      const cleanHtml = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 4000)

      try {
        const claudeRes = await client.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `Given this recipe page text, extract ONLY these fields as JSON (do not extract ingredients or steps — those are already captured):
- description: the intro/headnote paragraph about the recipe
- before_you_begin: any critical prep notes (or null)
- tags: array of 2-3 tags following this system: Tier 1 (one of: Pie,Cake,Cookies,Bread,Pasta,Soup,Salad,Appetizer,Side,Main,Sauce,Drink,Breakfast,Snack), Tier 2 (one of: Sweet,Savory), optional Tier 3 (cuisine/season)
- dietary_tags: array from: Vegan,Vegetarian,Gluten Free,Dairy Free,Keto,Paleo,Sugar Free,Nut Free,Low Carb,Whole30
- storage: storage instructions if mentioned (or null)
- notes: array of tips or notes (or null)

Return ONLY valid JSON with just these fields. Page text:
${cleanHtml}`
          }]
        })

        const claudeRaw = claudeRes.content.map(b => b.type === 'text' ? b.text : '').join('')
        const claudeClean = extractJSON(claudeRaw.replace(/```json|```/g, '').trim())
        const claudeExtras = JSON.parse(claudeClean)

        recipe = {
          ...jsonldRecipe,
          description: claudeExtras.description || jsonldRecipe.description,
          before_you_begin: claudeExtras.before_you_begin || null,
          tags: claudeExtras.tags || [],
          dietary_tags: claudeExtras.dietary_tags || [],
          storage: claudeExtras.storage || null,
          notes: claudeExtras.notes || null,
          data_source: 'jsonld'
        }
      } catch {
        // Claude metadata call failed — use JSON-LD fields as-is
        recipe = { ...jsonldRecipe, data_source: 'jsonld' }
      }

      dataSource = 'jsonld'

    } else {
      // STEP 2: No JSON-LD found — fall back to Claude for full extraction
      const cleanHtml = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 8000)

      const claudeRes = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        system: PARSE_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `Extract the recipe from this page. Return JSON matching this schema:\n${PARSE_SCHEMA}\n\nCRITICAL: Copy ingredients and steps EXACTLY as written. Do not paraphrase, reorder, or change quantities.\n\nPage URL: ${cleanUrl}\nPage content:\n${cleanHtml}`
        }]
      })

      const raw = claudeRes.content.map(b => b.type === 'text' ? b.text : '').join('')
      const clean = extractJSON(raw.replace(/```json|```/g, '').trim())
      recipe = JSON.parse(clean)
      recipe.source_url = cleanUrl
      recipe.source = recipe.source || siteName
      dataSource = 'claude'
    }

    return NextResponse.json({
      recipe,
      images: images.slice(0, 12),
      data_source: dataSource,
      has_jsonld: !!jsonLdSchema
    })

  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
