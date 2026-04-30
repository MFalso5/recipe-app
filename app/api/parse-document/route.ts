import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { PARSE_SYSTEM_PROMPT, PARSE_SCHEMA } from '@/lib/parser'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const maxDuration = 60
export const dynamic = 'force-dynamic'

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default
  const data = await pdfParse(buffer)
  return data.text
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll('documents') as File[]

    if (!files.length) return NextResponse.json({ error: 'No files provided' }, { status: 400 })

    // Extract text from all files
    const allTexts: string[] = []

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const name = file.name.toLowerCase()

      if (name.endsWith('.pdf')) {
        const text = await extractTextFromPDF(buffer)
        allTexts.push(`[From: ${file.name}]\n${text}`)
      } else if (name.endsWith('.docx') || name.endsWith('.doc')) {
        const text = await extractTextFromDocx(buffer)
        allTexts.push(`[From: ${file.name}]\n${text}`)
      } else if (name.endsWith('.txt')) {
        allTexts.push(`[From: ${file.name}]\n${buffer.toString('utf-8')}`)
      } else {
        allTexts.push(`[From: ${file.name}]\n${buffer.toString('utf-8')}`)
      }
    }

    const combined = allTexts.join('\n\n---\n\n').slice(0, 15000)

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      system: PARSE_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: 'Parse this recipe from the document content below. Return JSON matching this schema:\n' + PARSE_SCHEMA + '\n\nImportant: If a quantity is unclear, use "?" never guess. Note any page numbers and include them.\n\nDocument content:\n' + combined
      }]
    })

    const raw = response.content.map((b: { type: string; text?: string }) => b.type === 'text' ? b.text : '').join('')
    const clean = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    return NextResponse.json({ recipe: parsed, images: [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
