import { NextRequest, NextResponse } from 'next/server'
import { dbGetMenus, dbSaveMenu } from '@/lib/db'
import { Menu } from '@/lib/types'

export async function GET() {
  try {
    const menus = await dbGetMenus()
    return NextResponse.json({ menus })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const menu: Menu = {
      ...body,
      id: body.id || crypto.randomUUID(),
      courses: body.courses || [],
      make_ahead: body.make_ahead || [],
      created_at: body.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    const saved = await dbSaveMenu(menu)
    return NextResponse.json({ menu: saved })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
