'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Recipe } from '@/lib/types'
import RecipeReviewPanel from '@/components/RecipeReviewPanel'

type ItemStatus = 'pending' | 'parsing' | 'review' | 'saving' | 'saved' | 'error'

interface BatchItem {
  id: string
  files: File[]
  url?: string
  label: string
  status: ItemStatus
  recipe: Partial<Recipe> | null
  error: string | null
}

function statusColor(s: ItemStatus): string {
  if (s === 'saved') return 'var(--green)'
  if (s === 'error') return 'var(--red)'
  if (s === 'review') return 'var(--accent)'
  return 'var(--muted)'
}

function statusLabel(s: ItemStatus): string {
  if (s === 'saved') return 'Saved'
  if (s === 'error') return 'Error'
  if (s === 'review') return 'Review'
  if (s === 'parsing') return 'Parsing...'
  if (s === 'saving') return 'Saving...'
  return 'Pending'
}

function BatchImportPageInner() {
  const searchParams = useSearchParams()
  const fileRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<BatchItem[]>([])
  const [drafts, setDrafts] = useState<{sessionId: string, items: {id: string, recipe: unknown, cookbookTitle: string}[]}[]>([])

  useEffect(function() {
    fetch('/api/drafts').then(function(r) { return r.json() }).then(function(d) {
      setDrafts(d.drafts || [])
    })
  }, [])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [defaultSource, setDefaultSource] = useState('')
  const [defaultSourceType, setDefaultSourceType] = useState<'cookbook' | 'website' | 'other'>('cookbook')
  const [urlInputs, setUrlInputs] = useState<string[]>([''])
  const [batchMode, setBatchMode] = useState<'files' | 'urls'>('files')

  const updateItem = (id: string, update: Partial<BatchItem>) => {
    setItems(prev => prev.map(i => i.id === id ? Object.assign({}, i, update) : i))
  }

  const addFiles = (incoming: File[]) => {
    const newItems: BatchItem[] = incoming.map(function(f) {
      return {
        id: crypto.randomUUID(),
        files: [f],
        label: f.name.replace(/\.[^.]+$/, ''),
        status: 'pending' as ItemStatus,
        recipe: null,
        error: null
      }
    })
    setItems(function(prev) { return prev.concat(newItems) })
  }

  const addUrlsToQueue = () => {
    const urls = urlInputs.filter(function(u) { return u.trim().startsWith('http') })
    if (!urls.length) return
    const newItems: BatchItem[] = urls.map(function(url) {
      return {
        id: crypto.randomUUID(),
        files: [],
        url: url.trim(),
        label: url.replace(/^https?:\/\//, '').split('/')[0],
        status: 'pending' as ItemStatus,
        recipe: null,
        error: null
      }
    })
    setItems(function(prev) { return prev.concat(newItems) })
    setUrlInputs([''])
    setBatchMode('files')
  }

  const removeItem = (id: string) => {
    setItems(function(prev) { return prev.filter(function(i) { return i.id !== id }) })
    if (activeId === id) setActiveId(null)
  }

  const parseItem = async (item: BatchItem) => {
    updateItem(item.id, { status: 'parsing', error: null })
    try {
      let resData: Record<string, unknown>

      if (item.url) {
        const res = await fetch('/api/parse-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: item.url })
        })
        resData = await res.json()
        if (!res.ok || resData.error) throw new Error((resData.error as string) || 'Parse failed')
        const dr = resData.recipe as Record<string, unknown>
        const pageImages = (resData.images as string[]) || []
        const heroUrl = (dr.image_url as string) || pageImages[0] || null
        const galleryImages = pageImages.filter(function(u: string) { return u !== heroUrl }).slice(0, 8)
        const src = (dr.source as string) && (dr.source as string) !== 'Unknown Source'
          ? (dr.source as string)
          : defaultSource || (dr.source as string)
        updateItem(item.id, {
          status: 'review',
          recipe: { ...dr, image_url: heroUrl, source: src,
            source_type: (defaultSource && (!dr.source || dr.source === 'Unknown Source') ? defaultSourceType : (dr.source_type as string || 'other')) as 'cookbook' | 'website' | 'other',
            id: crypto.randomUUID(), made: false, made_log: [], gallery_urls: galleryImages,
            dietary_tags: (dr.dietary_tags as string[]) || [], collections: [], tags: (dr.tags as string[]) || [],
            share_token: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
          } as Partial<Recipe>
        })
        setActiveId(item.id)
        return
      }

      const fd = new FormData()
      const isDoc = item.files.some(function(f) { return !f.type.startsWith('image/') })

      if (isDoc) {
        item.files.forEach(function(f) { fd.append('documents', f) })
        const res = await fetch('/api/parse-document', { method: 'POST', body: fd })
        resData = await res.json()
        if (!res.ok || resData.error) throw new Error((resData.error as string) || 'Parse failed')
      } else {
        item.files.forEach(function(f) { fd.append('images', f) })
        fd.append('page_count', String(item.files.length))
        const res = await fetch('/api/parse-image', { method: 'POST', body: fd })
        resData = await res.json()
        if (!res.ok || resData.error) throw new Error((resData.error as string) || 'Parse failed')
      }

      const dr = resData.recipe as Record<string, unknown>
      const src = (dr.source as string) && (dr.source as string) !== 'Unknown Source'
        ? (dr.source as string)
        : defaultSource || (dr.source as string)

      updateItem(item.id, {
        status: 'review',
        recipe: { ...dr, source: src,
          source_type: (defaultSource && (!dr.source || dr.source === 'Unknown Source') ? defaultSourceType : (dr.source_type as string || 'other')) as 'cookbook' | 'website' | 'other',
          id: crypto.randomUUID(), made: false, made_log: [], gallery_urls: [],
          dietary_tags: (dr.dietary_tags as string[]) || [], collections: [], tags: (dr.tags as string[]) || [],
          share_token: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
        } as Partial<Recipe>
      })
      setActiveId(item.id)
    } catch (err: unknown) {
      updateItem(item.id, { status: 'error', error: err instanceof Error ? err.message : 'Failed' })
    }
  }

  const parseAll = async () => {
    setProcessing(true)
    const pending = items.filter(function(i) { return i.status === 'pending' })
    for (let idx = 0; idx < pending.length; idx++) {
      await parseItem(pending[idx])
    }
    setProcessing(false)
  }

  const saveItem = async (id: string) => {
    const item = items.find(function(i) { return i.id === id })
    if (!item || !item.recipe) return
    updateItem(id, { status: 'saving' })
    try {
      await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.recipe)
      })
      updateItem(id, { status: 'saved' })
      setActiveId(null)
    } catch (err: unknown) {
      updateItem(id, { status: 'error', error: err instanceof Error ? err.message : 'Save failed' })
    }
  }

  const saveAll = async () => {
    const toSave = items.filter(function(i) { return i.status === 'review' })
    for (let idx = 0; idx < toSave.length; idx++) {
      await saveItem(toSave[idx].id)
    }
  }

  const pendingCount = items.filter(function(i) { return i.status === 'pending' }).length
  const reviewCount = items.filter(function(i) { return i.status === 'review' }).length
  const savedCount = items.filter(function(i) { return i.status === 'saved' }).length
  const activeItem = items.find(function(i) { return i.id === activeId })

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px 80px' }}>

      <div style={{ padding: '24px 0 20px', borderBottom: '1px solid var(--border)', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 700 }}>Batch Import</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>Upload multiple recipes at once</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/import" className="btn btn-ghost btn-sm">Single import</Link>
          <Link href="/" className="btn btn-ghost btn-sm">Library</Link>
        </div>
      </div>

      <Link href="/import/cookbook-session" style={{ textDecoration: 'none', display: 'block', marginBottom: 20 }}>
        <div style={{ background: 'var(--accent)', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: 16 }}>Cookbook Import Session</div>
          <div style={{ marginLeft: 'auto', color: 'rgba(255,255,255,.8)', fontSize: 20 }}>-&gt;</div>
        </div>
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: items.length > 0 ? '320px 1fr' : '1fr', gap: 20 }}>

        <div>
          <div style={{ display: 'flex', background: 'var(--tag)', borderRadius: 8, padding: 3, gap: 2, marginBottom: 12 }}>
            <button onClick={function() { setBatchMode('files') }} style={{ flex: 1, padding: '6px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, background: batchMode === 'files' ? 'var(--card)' : 'transparent', color: batchMode === 'files' ? 'var(--ink)' : 'var(--muted)' }}>Files</button>
            <button onClick={function() { setBatchMode('urls') }} style={{ flex: 1, padding: '6px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, background: batchMode === 'urls' ? 'var(--card)' : 'transparent', color: batchMode === 'urls' ? 'var(--ink)' : 'var(--muted)' }}>URLs</button>
          </div>

          {batchMode === 'files' ? (
            <div onClick={function() { if (fileRef.current) fileRef.current.click() }}
              onDragOver={function(e) { e.preventDefault(); setDragOver(true) }}
              onDragLeave={function() { setDragOver(false) }}
              onDrop={function(e) { e.preventDefault(); setDragOver(false); addFiles(Array.from(e.dataTransfer.files)) }}
              style={{ border: '2px dashed ' + (dragOver ? 'var(--accent)' : 'var(--border)'), borderRadius: 14, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'var(--accent-bg)' : 'var(--card)', marginBottom: 12 }}>
              <input ref={fileRef} type="file" accept="image/*,.pdf,.docx,.doc" multiple onChange={function(e) { if (e.target.files) addFiles(Array.from(e.target.files)) }} style={{ display: 'none' }} />
              <p style={{ fontSize: 14, color: 'var(--muted)' }}><strong style={{ color: 'var(--accent)' }}>Tap to choose files</strong> or drag and drop</p>
            </div>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                {urlInputs.map(function(url, i) {
                  return (
                    <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: url.trim() ? 'var(--accent)' : 'var(--tag)', color: url.trim() ? '#fff' : 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>{i + 1}</div>
                      <input className="input" style={{ flex: 1, fontSize: 12 }} placeholder="https://..." value={url}
                        onChange={function(e) { const n = urlInputs.slice(); n[i] = e.target.value; setUrlInputs(n) }}
                        onKeyDown={function(e) {
                          if (e.key === 'Enter') { e.preventDefault(); setUrlInputs(function(p) { return p.concat(['']) }) }
                          if (e.key === 'Backspace' && !url && urlInputs.length > 1) { e.preventDefault(); setUrlInputs(function(p) { return p.filter(function(_, j) { return j !== i }) }) }
                        }}
                      />
                      <button onClick={function() { setUrlInputs(function(p) { return p.length === 1 ? [''] : p.filter(function(_, j) { return j !== i }) }) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14 }}>x</button>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={function() { setUrlInputs(function(p) { return p.concat(['']) }) }} style={{ background: 'none', border: '1.5px dashed var(--border)', borderRadius: 7, padding: '5px 10px', fontSize: 12, color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit' }}>+ Add URL</button>
                <button onClick={addUrlsToQueue} disabled={!urlInputs.some(function(u) { return u.trim().startsWith('http') })} className="btn btn-primary btn-sm" style={{ flex: 1 }}>Add to Queue</button>
              </div>
            </div>
          )}

          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Default Source</div>
            <input className="input" style={{ fontSize: 13, marginBottom: 8 }} placeholder="e.g. Four and Twenty Blackbirds" value={defaultSource} onChange={function(e) { setDefaultSource(e.target.value) }} />
            <div style={{ display: 'flex', gap: 6 }}>
              {(['cookbook', 'website', 'other'] as const).map(function(t) {
                return (
                  <button key={t} onClick={function() { setDefaultSourceType(t) }} style={{ flex: 1, padding: '6px 4px', borderRadius: 7, border: '1.5px solid ' + (defaultSourceType === t ? 'var(--accent)' : 'var(--border)'), background: defaultSourceType === t ? 'var(--accent-bg)' : 'var(--cream)', color: defaultSourceType === t ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 10, fontWeight: 600 }}>
                    {t}
                  </button>
                )
              })}
            </div>
          </div>

          {items.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
                {items.length} total
                {reviewCount > 0 && <span style={{ color: 'var(--accent)', fontWeight: 500 }}> {reviewCount} ready</span>}
                {savedCount > 0 && <span style={{ color: 'var(--green)', fontWeight: 500 }}> {savedCount} saved</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {pendingCount > 0 && (
                  <button onClick={parseAll} disabled={processing} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                    {processing ? 'Parsing...' : 'Parse All ' + String(pendingCount)}
                  </button>
                )}
                {reviewCount > 1 && (
                  <button onClick={saveAll} className="btn btn-green btn-sm" style={{ flex: 1 }}>
                    Save All {String(reviewCount)}
                  </button>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map(function(item) {
              return (
                <div key={item.id}
                  onClick={function() { if (item.status === 'review') setActiveId(item.id === activeId ? null : item.id) }}
                  style={{ background: activeId === item.id ? 'var(--accent-bg)' : 'var(--card)', border: '1px solid ' + (activeId === item.id ? 'var(--accent)' : 'var(--border)'), borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: item.status === 'review' ? 'pointer' : 'default' }}>
                  <div style={{ width: 36, height: 36, background: 'var(--tag)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                    {item.url ? 'URL' : 'IMG'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.recipe ? String(item.recipe.title || item.label) : item.label}
                    </div>
                    <div style={{ fontSize: 11, color: statusColor(item.status), marginTop: 1 }}>{statusLabel(item.status)}</div>
                    {item.error && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 1 }}>{item.error.slice(0, 50)}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {item.status === 'pending' && (
                      <button onClick={function(e) { e.stopPropagation(); parseItem(item) }} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Parse</button>
                    )}
                    {item.status === 'error' && (
                      <button onClick={function(e) { e.stopPropagation(); parseItem(item) }} style={{ background: 'var(--tag)', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
                    )}
                    <button onClick={function(e) { e.stopPropagation(); removeItem(item.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14 }}>x</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {items.length > 0 && (
          <div>
            {!activeItem || activeItem.status !== 'review' ? (
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
                <p style={{ color: 'var(--muted)', fontSize: 15 }}>
                  {reviewCount > 0 ? 'Select a recipe to review' : 'Click Parse All to start'}
                </p>
              </div>
            ) : (
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--tag)' }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{String(activeItem.recipe ? (activeItem.recipe.title || 'Review Recipe') : 'Review Recipe')}</div>
                </div>
                <div style={{ padding: 20, maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
                  <RecipeReviewPanel
                    recipe={activeItem.recipe || {}}
                    pageImages={[]}
                    compact={true}
                    onChange={function(updated) { updateItem(activeItem.id, { recipe: updated as Partial<Recipe> }) }}
                    onSave={function() { saveItem(activeItem.id) }}
                    saving={items.find(function(i) { return i.id === activeItem.id }) ? items.find(function(i) { return i.id === activeItem.id })!.status === 'saving' : false}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function BatchImportPage() {
  return (
    <Suspense fallback={<div style={{ padding: 80 }} />}>
      <BatchImportPageInner />
    </Suspense>
  )
}
