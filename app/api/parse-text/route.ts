import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { PARSE_SYSTEM_PROMPT, PARSE_SCHEMA } from '@/lib/parser'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const maxDuration = 60
export const dynamic = 'force-dynamic'

function extractJSON(raw: string): string {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end !== -1) return raw.slice(start, end + 1)
  return raw
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()
    if (!text?.trim()) return NextResponse.json({ error: 'No text provided' }, { status: 400 })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      system: PARSE_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Extract the recipe from this pasted text. Return JSON matching this schema:\n${PARSE_SCHEMA}\n\nReturn ONLY valid JSON — no markdown, no explanation.\n\nText:\n${text.slice(0, 8000)}`
      }]
    })

    const raw = response.content.map((b: { type: string; text?: string }) => b.type === 'text' ? b.text : '').join('')
    const clean = extractJSON(raw.replace(/```json|```/g, '').trim())
    const parsed = JSON.parse(clean)
    return NextResponse.json({ recipe: parsed })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
