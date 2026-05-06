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
  if (s === 'parsing') return 'var(--muted)'
  if (s === 'saving') return 'var(--muted)'
  return 'var(--muted)'
}

function statusLabel(s: ItemStatus): string {
  if (s === 'saved') return 'Saved'
  if (s === 'error') return 'Error'
  if (s === 'review') return 'Ready to review'
  if (s === 'parsing') return 'Parsing...'
  if (s === 'saving') return 'Saving...'
  return 'Pending'
}

function BatchImportPageInner() {
  const searchParams = useSearchParams()
  const fileRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<BatchItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [defaultSource, setDefaultSource] = useState('')
  const [defaultSourceType, setDefaultSourceType] = useState<'cookbook' | 'website' | 'other'>('cookbook')
  const [urlInputs, setUrlInputs] = useState<string[]>([''])
  const [showUrls, setShowUrls] = useState(false)
  const [drafts, setDrafts] = useState<{sessionId: string, items: {id: string, recipe: unknown, cookbookTitle: string}[]}[]>([])

  useEffect(function() {
    fetch('/api/drafts').then(function(r) { return r.json() }).then(function(d) {
      setDrafts(d.drafts || [])
    }).catch(function() {})

    if (searchParams.get('mode') === 'urls') {
      try {
        const stored = sessionStorage.getItem('batchUrls')
        if (stored) {
          const urls: string[] = JSON.parse(stored)
          sessionStorage.removeItem('batchUrls')
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
          setItems(newItems)
        }
      } catch(_e) {}
    }
  }, [])

  const updateItem = function(id: string, update: Partial<BatchItem>) {
    setItems(function(prev) { return prev.map(function(i) { return i.id === id ? Object.assign({}, i, update) : i }) })
  }

  const addFiles = function(incoming: File[]) {
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

  const addUrlsToQueue = function() {
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
    setShowUrls(false)
  }

  const removeItem = function(id: string) {
    setItems(function(prev) { return prev.filter(function(i) { return i.id !== id }) })
    if (activeId === id) setActiveId(null)
  }

  const parseItem = async function(item: BatchItem) {
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
          : defaultSource || null
        updateItem(item.id, {
          status: 'review',
          recipe: Object.assign({}, dr, {
            image_url: heroUrl,
            source: src,
            source_type: (src ? (defaultSource ? defaultSourceType : (dr.source_type as string || 'other')) : 'other') as 'cookbook' | 'website' | 'other',
            id: crypto.randomUUID(),
            made: false,
            made_log: [],
            gallery_urls: galleryImages,
            dietary_tags: (dr.dietary_tags as string[]) || [],
            collections: [],
            tags: (dr.tags as string[]) || [],
            share_token: null,
            favorited: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }) as Partial<Recipe>
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
        if (item.files.length > 1) fd.append('multi_page', 'true')
        const res = await fetch('/api/parse-image', { method: 'POST', body: fd })
        resData = await res.json()
        if (!res.ok || resData.error) throw new Error((resData.error as string) || 'Parse failed')
      }

      const dr = resData.recipe as Record<string, unknown>
      const src = (dr.source as string) && (dr.source as string) !== 'Unknown Source'
        ? (dr.source as string)
        : defaultSource || null

      updateItem(item.id, {
        status: 'review',
        recipe: Object.assign({}, dr, {
          source: src,
          source_type: (src ? (defaultSource ? defaultSourceType : (dr.source_type as string || 'other')) : 'other') as 'cookbook' | 'website' | 'other',
          id: crypto.randomUUID(),
          made: false,
          made_log: [],
          gallery_urls: [],
          dietary_tags: (dr.dietary_tags as string[]) || [],
          collections: [],
          tags: (dr.tags as string[]) || [],
          share_token: null,
          favorited: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }) as Partial<Recipe>
      })
      setActiveId(item.id)
    } catch(err: unknown) {
      updateItem(item.id, { status: 'error', error: err instanceof Error ? err.message.slice(0, 80) : 'Failed' })
    }
  }

  const parseAll = async function() {
    setProcessing(true)
    const pending = items.filter(function(i) { return i.status === 'pending' })
    for (let idx = 0; idx < pending.length; idx++) {
      await parseItem(pending[idx])
    }
    setProcessing(false)
  }

  const saveItem = async function(id: string) {
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
    } catch(err: unknown) {
      updateItem(id, { status: 'error', error: err instanceof Error ? err.message : 'Save failed' })
    }
  }

  const saveAll = async function() {
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

      <div style={{ padding: '24px 0 20px', borderBottom: '1px solid var(--border)', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 700 }}>Batch Import</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>Upload multiple recipes at once</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/import" className="btn btn-ghost btn-sm">Single import</Link>
          <Link href="/" className="btn btn-ghost btn-sm">Library</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: items.length > 0 ? '360px 1fr' : '1fr', gap: 20 }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* DRAFT SESSIONS */}
          {drafts.length > 0 && drafts.map(function(draft) {
            return (
              <div key={draft.sessionId} style={{ background: '#FEF9C3', border: '1px solid #FDE047', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#854D0E' }}>Draft: {draft.items[0] ? String((draft.items[0] as Record<string, unknown>).cookbookTitle || '') : ''}</div>
                  <div style={{ fontSize: 12, color: '#92400E', marginTop: 2 }}>{draft.items.length} recipes ready</div>
                </div>
                <Link href={'/import/cookbook-session?draft=' + draft.sessionId} style={{ background: '#854D0E', color: '#fff', padding: '5px 12px', borderRadius: 7, textDecoration: 'none', fontSize: 12, fontWeight: 500 }}>Continue</Link>
                <button onClick={async function() {
                  await fetch('/api/drafts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: draft.sessionId }) })
                  setDrafts(function(prev) { return prev.filter(function(d) { return d.sessionId !== draft.sessionId }) })
                }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400E', fontSize: 14 }}>x</button>
              </div>
            )
          })}

          {/* COOKBOOK SESSION */}
          <Link href="/import/cookbook-session" style={{ textDecoration: 'none' }}>
            <div style={{ background: 'var(--accent)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <div style={{ fontSize: 22 }}>CB</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Cookbook session</div>
                <div style={{ color: 'rgba(255,255,255,.75)', fontSize: 12, marginTop: 2 }}>Set details once, photograph recipes</div>
              </div>
              <div style={{ color: 'rgba(255,255,255,.75)', fontSize: 18 }}>&gt;</div>
            </div>
          </Link>

          {/* DEFAULT SOURCE */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Default source <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></div>
            <input className="input" style={{ fontSize: 13, marginBottom: 8 }}
              placeholder="e.g. Four and Twenty Blackbirds"
              value={defaultSource}
              onChange={function(e) { setDefaultSource(e.target.value) }} />
            <div style={{ display: 'flex', gap: 6 }}>
              {(['cookbook', 'website', 'other'] as const).map(function(t) {
                return (
                  <button key={t} onClick={function() { setDefaultSourceType(t) }} style={{
                    flex: 1, padding: '6px 4px', borderRadius: 7,
                    border: '1px solid ' + (defaultSourceType === t ? 'var(--accent)' : 'var(--border)'),
                    background: defaultSourceType === t ? 'var(--accent-bg)' : 'var(--cream)',
                    color: defaultSourceType === t ? 'var(--accent)' : 'var(--muted)',
                    cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600
                  }}>{t}</button>
                )
              })}
            </div>
          </div>

          {/* TWO ACTION CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div onClick={function() { setShowUrls(function(v) { return !v }) }}
              style={{ background: showUrls ? 'var(--accent-bg)' : 'var(--card)', border: '1px solid ' + (showUrls ? 'var(--accent)' : 'var(--border)'), borderRadius: 12, padding: '20px 12px', textAlign: 'center', cursor: 'pointer', transition: 'background .15s' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>URLs</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: showUrls ? 'var(--accent)' : 'var(--ink)', marginBottom: 4 }}>Add URLs</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Paste recipe links</div>
            </div>

            <div onClick={function() { if (fileRef.current) fileRef.current.click() }}
              onDragOver={function(e) { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-bg)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)' }}
              onDragLeave={function(e) { (e.currentTarget as HTMLDivElement).style.background = 'var(--card)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)' }}
              onDrop={function(e) { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.background = 'var(--card)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; addFiles(Array.from(e.dataTransfer.files)) }}
              style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 12px', textAlign: 'center', cursor: 'pointer', transition: 'background .15s, border-color .15s' }}
              onMouseEnter={function(e) { (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-bg)' }}
              onMouseLeave={function(e) { (e.currentTarget as HTMLDivElement).style.background = 'var(--card)' }}>
              <input ref={fileRef} type="file" accept="image/*,.pdf,.docx,.doc" multiple
                onChange={function(e) { if (e.target.files) addFiles(Array.from(e.target.files)) }}
                style={{ display: 'none' }} />
              <div style={{ fontSize: 28, marginBottom: 8 }}>Files</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', marginBottom: 4 }}>Upload files</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Click or drag and drop</div>
            </div>
          </div>

          {/* URL INPUTS - expands inline */}
          {showUrls && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--accent)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                {urlInputs.map(function(url, i) {
                  return (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: url.trim() ? 'var(--accent)' : 'var(--tag)', color: url.trim() ? '#fff' : 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>{i + 1}</div>
                      <input className="input" style={{ flex: 1, fontSize: 13 }}
                        placeholder="https://..."
                        value={url}
                        onChange={function(e) { const n = urlInputs.slice(); n[i] = e.target.value; setUrlInputs(n) }}
                        onKeyDown={function(e) {
                          if (e.key === 'Enter') { e.preventDefault(); setUrlInputs(function(p) { return p.concat(['']) }) }
                          if (e.key === 'Backspace' && !url && urlInputs.length > 1) { e.preventDefault(); setUrlInputs(function(p) { return p.filter(function(_, j) { return j !== i }) }) }
                        }}
                      />
                      <button onClick={function() { setUrlInputs(function(p) { return p.length === 1 ? [''] : p.filter(function(_, j) { return j !== i }) }) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16, flexShrink: 0 }}>x</button>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={function() { setUrlInputs(function(p) { return p.concat(['']) }) }}
                  style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: 7, padding: '6px 12px', fontSize: 12, color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  + Add URL
                </button>
                <button onClick={addUrlsToQueue}
                  disabled={!urlInputs.some(function(u) { return u.trim().startsWith('http') })}
                  className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                  Add to queue
                </button>
              </div>
            </div>
          )}

          {/* QUEUE CONTROLS */}
          {items.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {items.length} total
                {reviewCount > 0 && <span style={{ color: 'var(--accent)', fontWeight: 500 }}> - {reviewCount} ready</span>}
                {savedCount > 0 && <span style={{ color: 'var(--green)', fontWeight: 500 }}> - {savedCount} saved</span>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {pendingCount > 0 && (
                  <button onClick={parseAll} disabled={processing} className="btn btn-primary btn-sm">
                    {processing ? 'Parsing...' : 'Parse all ' + String(pendingCount)}
                  </button>
                )}
                {reviewCount > 1 && (
                  <button onClick={saveAll} className="btn btn-green btn-sm">
                    Save all {String(reviewCount)}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* QUEUE LIST */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map(function(item) {
              return (
                <div key={item.id}
                  onClick={function() { if (item.status === 'review') setActiveId(item.id === activeId ? null : item.id) }}
                  style={{ background: activeId === item.id ? 'var(--accent-bg)' : 'var(--card)', border: '1px solid ' + (activeId === item.id ? 'var(--accent)' : 'var(--border)'), borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: item.status === 'review' ? 'pointer' : 'default' }}>
                  <div style={{ width: 36, height: 36, background: item.url ? 'var(--accent-bg)' : 'var(--tag)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                    {item.url ? 'URL' : item.files[0] && item.files[0].type.startsWith('image/') ? 'IMG' : 'DOC'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.recipe ? String(item.recipe.title || item.label) : item.label}
                    </div>
                    <div style={{ fontSize: 11, color: statusColor(item.status), marginTop: 1 }}>{statusLabel(item.status)}</div>
                    {item.error && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 1 }}>{item.error}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {item.status === 'pending' && (
                      <button onClick={function(e) { e.stopPropagation(); parseItem(item) }} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Parse</button>
                    )}
                    {item.status === 'error' && (
                      <button onClick={function(e) { e.stopPropagation(); parseItem(item) }} style={{ background: 'var(--tag)', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
                    )}
                    <button onClick={function(e) { e.stopPropagation(); removeItem(item.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16 }}>x</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT PANEL */}
        {items.length > 0 && (
          <div>
            {!activeItem || activeItem.status !== 'review' ? (
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
                <p style={{ color: 'var(--muted)', fontSize: 15 }}>
                  {reviewCount > 0 ? 'Select a recipe to review' : 'Click Parse to start'}
                </p>
              </div>
            ) : (
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--tag)' }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{String(activeItem.recipe ? (activeItem.recipe.title || 'Review Recipe') : 'Review Recipe')}</div>
                </div>
                <div style={{ padding: 20, maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
                  <RecipeReviewPanel
                    recipe={activeItem.recipe || {}}
                    pageImages={[
                      ...(activeItem.recipe && activeItem.recipe.image_url ? [activeItem.recipe.image_url as string] : []),
                      ...((activeItem.recipe as Record<string, unknown>)?.gallery_urls as string[] || [])
                    ].filter(function(u, i, arr) { return arr.indexOf(u) === i })}
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
