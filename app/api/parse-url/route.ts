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

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 })

    // Clean UTM parameters from URL
    let cleanUrl = url
    try {
      const u = new URL(url)
      // Remove UTM and tracking params
      ;['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid'].forEach(p => u.searchParams.delete(p))
      cleanUrl = u.toString()
    } catch { /* keep original if URL parsing fails */ }

    // Fetch the page
    const res = await fetch(cleanUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; recipe-bot/1.0)' },
      signal: AbortSignal.timeout(15000)
    })

    if (!res.ok) return NextResponse.json({ error: `Failed to fetch URL: ${res.status}` }, { status: 400 })

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
        } catch { /* skip invalid URLs */ }
      }
    }

    // Strip HTML and truncate — be more aggressive to avoid token limits
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000) // Reduced from 12000 to avoid unterminated JSON

    let parsed
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        system: PARSE_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `Extract the recipe from this webpage. Source URL: ${cleanUrl}\n\nReturn JSON matching this schema:\n${PARSE_SCHEMA}\n\nReturn ONLY valid JSON — no markdown, no explanation.\n\nPage content:\n${text}`
        }]
      })

      const raw = response.content.map((b: { type: string; text?: string }) => b.type === 'text' ? b.text : '').join('')
      const clean = extractJSON(raw.replace(/```json|```/g, '').trim())
      parsed = JSON.parse(clean)
    } catch {
      // Second attempt with even less content
      const response = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        system: PARSE_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `Extract the recipe from this webpage. Source URL: ${cleanUrl}\n\nReturn JSON matching this schema:\n${PARSE_SCHEMA}\n\nReturn ONLY valid JSON — no markdown, no explanation.\n\nPage content:\n${text.slice(0, 4000)}`
        }]
      })
      const raw = response.content.map((b: { type: string; text?: string }) => b.type === 'text' ? b.text : '').join('')
      const clean = extractJSON(raw.replace(/```json|```/g, '').trim())
      parsed = JSON.parse(clean)
    }

    return NextResponse.json({ recipe: parsed, images: images.slice(0, 12) })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
