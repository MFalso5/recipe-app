import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('google_access_token')?.value
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const folderId = req.nextUrl.searchParams.get('folder') || 'root'
  
  try {
    // List Google Docs in this folder
    const query = folderId === 'root'
      ? `mimeType='application/vnd.google-apps.document' and 'root' in parents and trashed=false`
      : `mimeType='application/vnd.google-apps.document' and '${folderId}' in parents and trashed=false`

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc&pageSize=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    const data = await res.json()
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 400 })

    // Also get folders
    const folderQuery = folderId === 'root'
      ? `mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`
      : `mimeType='application/vnd.google-apps.folder' and '${folderId}' in parents and trashed=false`

    const folderRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(folderQuery)}&fields=files(id,name)&orderBy=name&pageSize=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const folderData = await folderRes.json()

    return NextResponse.json({ 
      files: data.files || [],
      folders: folderData.files || []
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
