import { NextRequest, NextResponse } from 'next/server'
import { dbGetMenu, dbSaveMenu, dbDeleteMenu } from '@/lib/db'
import { Menu } from '@/lib/types'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const menu = await dbGetMenu(params.id)
    if (!menu) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ menu })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const existing = await dbGetMenu(params.id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const updated: Menu = { ...existing, ...body, id: params.id, updated_at: new Date().toISOString() }
    await dbSaveMenu(updated)
    return NextResponse.json({ menu: updated })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await dbDeleteMenu(params.id)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
