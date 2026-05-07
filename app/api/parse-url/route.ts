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

// Extract JSON-LD structured recipe data from HTML
function extractJsonLd(html: string): Record<string, unknown> | null {
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim())
      // Handle array of schemas
      const schemas = Array.isArray(data) ? data : [data]
      for (const schema of schemas) {
        if (schema['@type'] === 'Recipe') return schema
        // Handle @graph
        if (schema['@graph']) {
          const recipe = schema['@graph'].find((s: Record<string, unknown>) => s['@type'] === 'Recipe')
          if (recipe) return recipe
        }
      }
    } catch { /* continue */ }
  }
  return null
}

// Convert JSON-LD recipe to our format
function jsonLdToRecipe(schema: Record<string, unknown>, sourceUrl: string): Record<string, unknown> {
  // Unit abbreviation map
  const unitMap: Record<string, string> = {
    'cups': 'C', 'cup': 'C',
    'tablespoons': 'T', 'tablespoon': 'T', 'tbsp': 'T',
    'teaspoons': 't', 'teaspoon': 't', 'tsp': 't',
    'ounces': 'oz', 'ounce': 'oz',
    'pounds': '#', 'pound': '#', 'lbs': '#', 'lb': '#',
    'grams': 'g', 'gram': 'g',
    'kilograms': 'kg', 'kilogram': 'kg',
    'milliliters': 'ml', 'milliliter': 'ml',
    'liters': 'L', 'liter': 'L',
  }

  // Parse ingredients
  const rawIngredients = (schema.recipeIngredient as string[]) || []
  const ingredients = rawIngredients.map((ing: string) => {
    const qtyMatch = ing.match(/^([\d\s\/.]+)\s*(cups?|tablespoons?|tbsp|teaspoons?|tsp|ounces?|oz|pounds?|lbs?|lb|grams?|g|kg|ml|milliliters?|liters?|L|pinch|dash|handful|bunch)\.?\s+(.+)$/i)
    if (qtyMatch) {
      const num = qtyMatch[1].trim()
      const unit = unitMap[qtyMatch[2].toLowerCase()] || qtyMatch[2]
      const name = qtyMatch[3].trim()
      return { qty: num + ' ' + unit, name, is_linked_recipe: false }
    }
    // No unit - just a number
    const numOnlyMatch = ing.match(/^([\d\s\/.]+)\s+(.+)$/)
    if (numOnlyMatch) {
      return { qty: numOnlyMatch[1].trim(), name: numOnlyMatch[2].trim(), is_linked_recipe: false }
    }
    return { qty: '', name: ing.trim(), is_linked_recipe: false }
  })

  // Parse instructions
  const rawInstructions = schema.recipeInstructions
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

  // Parse time
  const parseTime = (iso: string): string | null => {
    if (!iso) return null
    const h = iso.match(/(\d+)H/)?.[1]
    const m = iso.match(/(\d+)M/)?.[1]
    if (h && m) return h + ' hr ' + m + ' min'
    if (h) return h + ' hr'
    if (m) return m + ' min'
    return null
  }

  // Extract yield
  const yieldRaw = schema.recipeYield
  const yieldStr = Array.isArray(yieldRaw) ? String(yieldRaw[0]) : String(yieldRaw || '')

  // Extract description
  const description = schema.description as string || null

  // Extract image
  const imageRaw = schema.image
  let imageUrl: string | null = null
  if (typeof imageRaw === 'string') imageUrl = imageRaw
  else if (Array.isArray(imageRaw) && imageRaw.length > 0) imageUrl = typeof imageRaw[0] === 'string' ? imageRaw[0] : (imageRaw[0] as Record<string,unknown>).url as string
  else if (imageRaw && typeof imageRaw === 'object') imageUrl = (imageRaw as Record<string,unknown>).url as string

  // Extract source name from URL
  const sourceName = (() => {
    try {
      const host = new URL(sourceUrl).hostname.replace('www.', '')
      const parts = host.split('.')
      return parts[0].split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    } catch { return null }
  })()

  return {
    title: String(schema.name || ''),
    source: sourceName,
    source_url: sourceUrl,
    source_type: 'website',
    description: description,
    yield: yieldStr || null,
    time_active: parseTime(schema.prepTime as string) || parseTime(schema.cookTime as string) || null,
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
}

// Compare JSON-LD ingredients with Claude output to find changes
function detectChanges(jsonldRecipe: Record<string, unknown>, claudeRecipe: Record<string, unknown>): string[] {
  const changes: string[] = []

  const jsonldIngs = ((jsonldRecipe.ingredient_groups as Record<string,unknown>[])?.[0]?.ingredients as Record<string,unknown>[]) || []
  const claudeIngs = ((claudeRecipe.ingredient_groups as Record<string,unknown>[])?.[0]?.ingredients as Record<string,unknown>[]) || []

  if (jsonldIngs.length !== claudeIngs.length) {
    changes.push('ingredient_count')
  }

  const jsonldSteps = ((jsonldRecipe.step_groups as Record<string,unknown>[])?.[0]?.steps as Record<string,unknown>[]) || []
  const claudeSteps = ((claudeRecipe.step_groups as Record<string,unknown>[])?.[0]?.steps as Record<string,unknown>[]) || []

  if (jsonldSteps.length !== claudeSteps.length) {
    changes.push('step_count')
  }

  return changes
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 })

    // Clean UTM parameters
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

    // Extract images
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

    // STEP 1: Try JSON-LD structured data first
    const jsonLdSchema = extractJsonLd(html)
    let dataSource = 'claude'
    let recipe: Record<string, unknown>

    if (jsonLdSchema && jsonLdSchema.name && jsonLdSchema.recipeIngredient) {
      // Use JSON-LD as primary source  -  most accurate
      const jsonldRecipe = jsonLdToRecipe(jsonLdSchema, cleanUrl)

      // Use Claude only to fill in missing fields (description, tags, notes, before_you_begin)
      // NOT to re-extract ingredients or steps
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
            content: `Given this recipe page text, extract ONLY these fields as JSON (do not extract ingredients or steps  -  those are already captured):
- description: the intro/headnote paragraph about the recipe
- before_you_begin: any critical prep notes
- tags: array of 2-3 tags following this system: Tier 1 (one of: Pie,Cake,Cookies,Bread,Pasta,Soup,Salad,Appetizer,Side,Main,Sauce,Drink,Breakfast,Snack), Tier 2 (one of: Sweet,Savory), optional Tier 3 (cuisine/season)
- dietary_tags: array from: Vegan,Vegetarian,Gluten Free,Dairy Free,Keto,Paleo,Sugar Free,Nut Free,Low Carb,Whole30
- storage: storage instructions if mentioned
- notes: any tips or notes array

Return ONLY valid JSON with just these fields. Page text:
${cleanHtml}`
          }]
        })

        const claudeRaw = claudeRes.content.map(b => b.type === 'text' ? b.text : '').join('')
        const claudeClean = extractJSON(claudeRaw.replace(/```json|```/g, '').trim())
        const claudeExtras = JSON.parse(claudeClean)

        // Apply ingredient groups if Claude detected them
        let ingredientGroups = jsonldRecipe.ingredient_groups as Record<string,unknown>[]
        if (claudeExtras.ingredient_groups && Array.isArray(claudeExtras.ingredient_groups)) {
          // Claude found groups - use them but verify ingredient count matches
          const claudeIngCount = claudeExtras.ingredient_groups.reduce((n: number, g: Record<string,unknown>) => n + ((g.ingredients as unknown[]) || []).length, 0)
          const jsonldIngCount = ingredients.length
          if (claudeIngCount === jsonldIngCount) {
            // Counts match - safe to use Claude groups with JSON-LD qty/names
            ingredientGroups = claudeExtras.ingredient_groups
          }
        }

        // Merge: JSON-LD for ingredients/steps, Claude for metadata
        recipe = {
          ...jsonldRecipe,
          ingredient_groups: ingredientGroups,
          description: claudeExtras.description || jsonldRecipe.description,
          before_you_begin: claudeExtras.before_you_begin || null,
          tags: claudeExtras.tags || [],
          dietary_tags: claudeExtras.dietary_tags || [],
          storage: claudeExtras.storage || null,
          notes: claudeExtras.notes || null,
          data_source: 'jsonld'
        }
      } catch {
        // Claude failed for extras, just use JSON-LD
        recipe = { ...jsonldRecipe, data_source: 'jsonld' }
      }

      dataSource = 'jsonld'

    } else {
      // STEP 2: No JSON-LD  -  fall back to Claude for full extraction
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
