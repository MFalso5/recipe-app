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
  const token = req.cookies.get('google_access_token')?.value
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { docId, docName } = await req.json()

  try {
    // Export Google Doc as plain text
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=text/plain`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (!res.ok) throw new Error(`Failed to fetch doc: ${res.status}`)
    const text = await res.text()

    // Parse with Claude
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      system: PARSE_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Extract the recipe from this Google Doc named "${docName}". Return JSON matching this schema:\n${PARSE_SCHEMA}\n\nReturn ONLY valid JSON.\n\nDocument content:\n${text.slice(0, 8000)}`
      }]
    })

    const raw = response.content.map((b: { type: string; text?: string }) => b.type === 'text' ? b.text : '').join('')
    const clean = extractJSON(raw.replace(/```json|```/g, '').trim())
    const parsed = JSON.parse(clean)

    return NextResponse.json({ recipe: parsed })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
