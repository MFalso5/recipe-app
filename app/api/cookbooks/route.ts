import { NextRequest, NextResponse } from 'next/server'
import { dbGetCookbooks, dbSaveCookbook } from '@/lib/db'
import { Cookbook } from '@/lib/types'

export async function GET() {
  try { return NextResponse.json({ cookbooks: await dbGetCookbooks() }) }
  catch (err: unknown) { return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const cookbook: Cookbook = {
      ...body,
      id: body.id || body.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      created_at: body.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    return NextResponse.json({ cookbook: await dbSaveCookbook(cookbook) })
  } catch (err: unknown) { return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 }) }
}
