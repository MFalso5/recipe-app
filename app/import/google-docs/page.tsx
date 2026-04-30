'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Recipe } from '@/lib/types'
import Link from 'next/link'
import RecipeReviewPanel from '@/components/RecipeReviewPanel'
import { Suspense } from 'react'

interface DriveFile {
  id: string
  name: string
  modifiedTime: string
}

interface DriveFolder {
  id: string
  name: string
}

interface QueueItem {
  id: string
  docId: string
  docName: string
  status: 'pending' | 'parsing' | 'review' | 'saving' | 'saved' | 'error'
  recipe: Partial<Recipe> | null
  error: string | null
  selected: boolean
}

function GoogleDocsImportPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [authenticated, setAuthenticated] = useState(false)
  const [checking, setChecking] = useState(true)
  const [files, setFiles] = useState<DriveFile[]>([])
  const [folders, setFolders] = useState<DriveFolder[]>([])
  const [folderStack, setFolderStack] = useState<{ id: string, name: string }[]>([{ id: 'root', name: 'My Drive' }])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const error = searchParams.get('error')

  // Check if authenticated by trying to load files
  useEffect(() => {
    fetch('/api/google/drive')
      .then(r => r.json())
      .then(d => {
        if (d.error === 'Not authenticated') {
          setAuthenticated(false)
        } else {
          setAuthenticated(true)
          setFiles(d.files || [])
          setFolders(d.folders || [])
        }
        setChecking(false)
      })
      .catch(() => { setAuthenticated(false); setChecking(false) })
  }, [])

  const loadFolder = async (folderId: string, folderName: string) => {
    setLoadingFiles(true)
    const res = await fetch('/api/google/drive?folder=' + folderId)
    const data = await res.json()
    setFiles(data.files || [])
    setFolders(data.folders || [])
    setFolderStack(prev => [...prev, { id: folderId, name: folderName }])
    setLoadingFiles(false)
  }

  const navigateBack = async (idx: number) => {
    const target = folderStack[idx]
    setLoadingFiles(true)
    const res = await fetch('/api/google/drive?folder=' + target.id)
    const data = await res.json()
    setFiles(data.files || [])
    setFolders(data.folders || [])
    setFolderStack(prev => prev.slice(0, idx + 1))
    setLoadingFiles(false)
  }

  const toggleFile = (id: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedFiles.size === files.length) setSelectedFiles(new Set())
    else setSelectedFiles(new Set(files.map(f => f.id)))
  }

  const addToQueue = () => {
    const toAdd = files.filter(f => selectedFiles.has(f.id))
    const newItems: QueueItem[] = toAdd.map(f => ({
      id: crypto.randomUUID(),
      docId: f.id,
      docName: f.name,
      status: 'pending',
      recipe: null,
      error: null,
      selected: false
    }))
    setQueue(prev => [...prev, ...newItems])
    setSelectedFiles(new Set())
  }

  const updateItem = (id: string, update: Partial<QueueItem>) => {
    setQueue(prev => prev.map(i => i.id === id ? { ...i, ...update } : i))
  }

  const parseItem = async (item: QueueItem) => {
    updateItem(item.id, { status: 'parsing', error: null })
    try {
      const res = await fetch('/api/google/doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: item.docId, docName: item.docName })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      updateItem(item.id, {
        status: 'review',
        recipe: {
          ...data.recipe,
          id: crypto.randomUUID(),
          made: false,
          made_log: [],
          gallery_urls: [],
          dietary_tags: data.recipe.dietary_tags || [],
          collections: [],
          tags: data.recipe.tags || [],
          share_token: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      })
      setActiveId(item.id)
    } catch (e: unknown) {
      updateItem(item.id, { status: 'error', error: e instanceof Error ? e.message : 'Failed' })
    }
  }

  const parseAll = async () => {
    setProcessing(true)
    for (const item of queue.filter(i => i.status === 'pending')) await parseItem(item)
    setProcessing(false)
  }

  const saveItem = async (id: string) => {
    const item = queue.find(i => i.id === id)
    if (!item?.recipe) return
    updateItem(id, { status: 'saving' })
    try {
      await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.recipe)
      })
      updateItem(id, { status: 'saved' })
      setActiveId(null)
    } catch {
      updateItem(id, { status: 'error', error: 'Save failed' })
    }
  }

  const activeItem = queue.find(i => i.id === activeId)
  const pendingCount = queue.filter(i => i.status === 'pending').length
  const reviewCount = queue.filter(i => i.status === 'review').length
  const savedCount = queue.filter(i => i.status === 'saved').length
  const currentFolder = folderStack[folderStack.length - 1]

  const statusColor = (s: QueueItem['status']) => ({ saved: 'var(--green)', error: 'var(--red)', review: 'var(--accent)', parsing: 'var(--muted)', saving: 'var(--muted)', pending: 'var(--muted)' }[s])
  const statusLabel = (s: QueueItem['status']) => ({ saved: '✓ Saved', error: '✕ Error', review: '● Review', parsing: '⟳ Parsing...', saving: '⟳ Saving...', pending: 'Pending' }[s])

  if (checking) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px 80px' }}>
      <div style={{ padding: '24px 0 20px', borderBottom: '1px solid var(--border)', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 700 }}>Import from Google Drive</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>Browse your Google Docs and import recipes</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/import" className="btn btn-ghost btn-sm">Single import</Link>
          <Link href="/" className="btn btn-ghost btn-sm">← Library</Link>
        </div>
      </div>

      {!authenticated ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, marginBottom: 8 }}>Connect Google Drive</h2>
          <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 8 }}>Sign in with Google to browse your Docs and import recipes</p>
          {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>Authentication failed — please try again</p>}
          <a href="/api/auth/google" className="btn btn-primary" style={{ display: 'inline-flex', fontSize: 15 }}>
            🔗 Connect Google Drive
          </a>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: queue.length > 0 ? '1fr 1fr' : '1fr', gap: 20 }}>

          {/* LEFT — DRIVE BROWSER */}
          <div>
            {/* BREADCRUMB */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
              {folderStack.map((f, i) => (
                <span key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {i > 0 && <span style={{ color: 'var(--muted)', fontSize: 12 }}>/</span>}
                  <button onClick={() => navigateBack(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: i === folderStack.length - 1 ? 'var(--ink)' : 'var(--accent)', fontFamily: 'inherit', padding: '2px 4px', fontWeight: i === folderStack.length - 1 ? 500 : 400 }}>
                    {f.name}
                  </button>
                </span>
              ))}
            </div>

            {/* FILE LIST */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {/* HEADER */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--tag)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" checked={selectedFiles.size === files.length && files.length > 0} onChange={toggleAll} style={{ accentColor: 'var(--accent)', width: 15, height: 15 }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', flex: 1 }}>{files.length} documents{selectedFiles.size > 0 ? ` · ${selectedFiles.size} selected` : ''}</span>
                {selectedFiles.size > 0 && (
                  <button onClick={addToQueue} className="btn btn-primary btn-sm">
                    + Add {selectedFiles.size} to queue
                  </button>
                )}
              </div>

              {loadingFiles ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
              ) : (
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {/* FOLDERS */}
                  {folders.map(folder => (
                    <div key={folder.id} onClick={() => loadFolder(folder.id, folder.name)} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', transition: 'background .1s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--cream)'}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = ''}>
                      <span style={{ fontSize: 18 }}>📁</span>
                      <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 500, flex: 1 }}>{folder.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>→</span>
                    </div>
                  ))}
                  {/* FILES */}
                  {files.map(file => (
                    <div key={file.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, background: selectedFiles.has(file.id) ? 'var(--accent-bg)' : '' }}>
                      <input type="checkbox" checked={selectedFiles.has(file.id)} onChange={() => toggleFile(file.id)} style={{ accentColor: 'var(--accent)', width: 15, height: 15, flexShrink: 0 }} />
                      <span style={{ fontSize: 18 }}>📄</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Modified {new Date(file.modifiedTime).toLocaleDateString()}</div>
                      </div>
                      {queue.find(q => q.docId === file.id) && (
                        <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 500 }}>In queue</span>
                      )}
                    </div>
                  ))}
                  {files.length === 0 && folders.length === 0 && (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>No documents found in this folder</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — QUEUE + REVIEW */}
          {queue.length > 0 && (
            <div>
              {/* QUEUE HEADER */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {queue.length} in queue
                  {reviewCount > 0 && <span style={{ color: 'var(--accent)', fontWeight: 500 }}> · {reviewCount} ready</span>}
                  {savedCount > 0 && <span style={{ color: 'var(--green)', fontWeight: 500 }}> · {savedCount} saved</span>}
                </div>
                {pendingCount > 0 && (
                  <button onClick={parseAll} disabled={processing} className="btn btn-primary btn-sm">
                    {processing ? '⟳ Parsing...' : '✨ Parse All ' + pendingCount}
                  </button>
                )}
              </div>

              {/* QUEUE LIST */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {queue.map(item => (
                  <div key={item.id} onClick={() => item.status === 'review' && setActiveId(item.id)} style={{
                    background: activeId === item.id ? 'var(--accent-bg)' : 'var(--card)',
                    border: '1px solid ' + (activeId === item.id ? 'var(--accent)' : 'var(--border)'),
                    borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
                    cursor: item.status === 'review' ? 'pointer' : 'default'
                  }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>📄</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.recipe?.title || item.docName}
                      </div>
                      <div style={{ fontSize: 11, color: statusColor(item.status), marginTop: 1 }}>{statusLabel(item.status)}</div>
                      {item.error && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 1 }}>{item.error.slice(0, 60)}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {item.status === 'pending' && <button onClick={e => { e.stopPropagation(); parseItem(item) }} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Parse</button>}
                      {item.status === 'review' && <button onClick={e => { e.stopPropagation(); saveItem(item.id) }} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>}
                      {item.status === 'error' && <button onClick={e => { e.stopPropagation(); parseItem(item) }} style={{ background: 'var(--tag)', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>}
                      <button onClick={e => { e.stopPropagation(); setQueue(prev => prev.filter(i => i.id !== item.id)); if (activeId === item.id) setActiveId(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 15 }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* REVIEW PANEL */}
              {activeItem?.status === 'review' && (
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--tag)' }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{activeItem.recipe?.title || 'Review Recipe'}</div>
                  </div>
                  <div style={{ padding: 16, maxHeight: 500, overflowY: 'auto' }}>
                    <RecipeReviewPanel
                      recipe={activeItem.recipe || {}}
                      compact={true}
                      onChange={(updated) => updateItem(activeItem.id, { recipe: updated as Partial<Recipe> })}
                      onSave={() => saveItem(activeItem.id)}
                      saving={queue.find(i => i.id === activeItem.id)?.status === 'saving'}
                    />
                  </div>
                </div>
              )}

              {savedCount === queue.length && savedCount > 0 && (
                <Link href="/" className="btn btn-primary" style={{ width: '100%', textAlign: 'center', marginTop: 12, display: 'block' }}>
                  View Library →
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function GoogleDocsImportPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>}>
      <GoogleDocsImportPageInner />
    </Suspense>
  )
}
