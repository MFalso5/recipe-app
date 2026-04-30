import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('image') as File

    if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const filename = 'recipes/' + crypto.randomUUID() + '.' + ext

    const blob = await put(filename, file, {
      access: 'public',
      contentType: file.type || 'image/jpeg'
    })

    return NextResponse.json({ url: blob.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
