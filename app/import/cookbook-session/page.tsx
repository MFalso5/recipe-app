'use client'
import * as React from 'react'
import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Recipe, Cookbook } from '@/lib/types'
import RecipeReviewPanel from '@/components/RecipeReviewPanel'

interface QueueItem {
  id: string
  files: File[]
  previews: string[]
  status: 'pending' | 'parsing' | 'review' | 'saving' | 'saved' | 'error'
  recipe: Partial<Recipe> | null
  error: string | null
  selected: boolean
}

interface StagedPage {
  id: string
  file: File
  preview: string
}

function CookbookSessionPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Step tracking
  const [step, setStep] = useState<'setup' | 'import' | 'done'>('setup')

  // Cookbook setup
  const [existingCookbooks, setExistingCookbooks] = useState<Cookbook[]>([])
  const [matchedCookbook, setMatchedCookbook] = useState<Cookbook | null>(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [pubYear, setPubYear] = useState('')

  // Staged pages (photographed but not yet parsed)
  const [stagedPages, setStagedPages] = useState<StagedPage[]>([])

  // Review queue (parsed recipes)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [sessionId] = useState(() => 'session-' + Date.now())
  const [draftSaved, setDraftSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Load existing cookbooks for auto-fill
  useEffect(() => {
    fetch('/api/cookbooks').then(r => r.json()).then(d => {
      setExistingCookbooks(d.cookbooks || [])
    })
  }, [])

  // Auto-fill author/year when title matches an existing cookbook
  useEffect(() => {
    const match = existingCookbooks.find(cb => cb.name.toLowerCase() === title.trim().toLowerCase())
    if (match) {
      setMatchedCookbook(match)
      if (!author) setAuthor(match.author || '')
      if (!pubYear) setPubYear(match.pub_year || '')
    } else {
      setMatchedCookbook(null)
    }
  }, [title, existingCookbooks])

  // Restore draft from URL param
  useEffect(() => {
    const draftId = searchParams.get('draft')
    if (!draftId) return

    fetch('/api/drafts')
      .then(r => r.json())
      .then(d => {
        const allDrafts = d.drafts || []
        const draft = allDrafts.find((dr: Record<string, unknown>) => String(dr.sessionId) === draftId)
        if (!draft) return
        const draftItems = (draft as Record<string, unknown>).items as { id: string, recipe: Record<string, unknown>, cookbookTitle: string }[]
        if (!draftItems || !draftItems.length) return

        const cbTitle = draftItems[0].cookbookTitle || ''
        setTitle(cbTitle)

        const restoredQueue = draftItems.map((di) => ({
          id: di.id,
          files: [] as File[],
          previews: [] as string[],
          status: 'review' as const,
          recipe: di.recipe as Partial<Recipe>,
          error: null,
          selected: false
        }))

        setQueue(restoredQueue)
        setStep('import')
        if (restoredQueue.length > 0) setActiveId(restoredQueue[0].id)

        fetch('/api/drafts', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: draftId })
        })
      })
      .catch(err => console.error('Draft load error:', err))
  }, [searchParams])

  const cookbookTitle = title
  const cookbookAuthor = author
  const canStart = !!title.trim()

  const startSession = async () => {
    if (!title.trim()) return
    const cb: Cookbook = {
      id: matchedCookbook?.id || title.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      name: title.trim(),
      author: author.trim() || null,
      pub_year: pubYear.trim() || null,
      cover_url: matchedCookbook?.cover_url || null,
      created_at: matchedCookbook?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    await fetch('/api/cookbooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cb)
    })
    setStep('import')
  }

  const saveDraft = async (currentQueue: QueueItem[]) => {
    const saveable = currentQueue.filter(i => i.status === 'review' && i.recipe)
    if (!saveable.length) return
    await fetch('/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        items: saveable.map(i => ({ id: i.id, recipe: i.recipe, cookbookTitle, cookbookAuthor }))
      })
    })
    setDraftSaved(true)
    setTimeout(() => setDraftSaved(false), 2000)
  }

  // Add a photo to staged pages
  const addPhoto = (file: File) => {
    const preview = URL.createObjectURL(file)
    setStagedPages(prev => [...prev, { id: crypto.randomUUID(), file, preview }])
  }

  // Remove a single staged page
  const removeStagedPage = (id: string) => {
    setStagedPages(prev => prev.filter(p => p.id !== id))
  }

  // Compress an image before sending
  const compressFile = (f: File, index: number): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(f)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const canvas = document.createElement('canvas')
        let { width, height } = img
        // Batch mode uses smaller images to stay within Vercel's 60s timeout.
        // 900px is sufficient for cookbook text extraction.
        const maxDim = 900
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * maxDim / width); width = maxDim }
          else { width = Math.round(width * maxDim / height); height = maxDim }
        }
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(blob => {
          resolve(blob ? new File([blob], 'page_' + (index + 1) + '.jpg', { type: 'image/jpeg' }) : f)
        }, 'image/jpeg', 0.75)
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(f) }
      img.src = url
    })
  }

  // Parse all staged pages as a batch — Claude returns N recipes
  const parseBatch = async () => {
    if (!stagedPages.length || processing) return
    setProcessing(true)

    const pagesToParse = [...stagedPages]
    setStagedPages([]) // Clear immediately so user can keep photographing

    // Placeholder item shows progress in the queue
    const placeholderId = crypto.randomUUID()
    setQueue(prev => [...prev, {
      id: placeholderId,
      files: pagesToParse.map(p => p.file),
      previews: pagesToParse.map(p => p.preview),
      status: 'parsing',
      recipe: null,
      error: null,
      selected: false
    }])

    try {
      // Split into chunks of 2 pages to stay within Vercel's 60s timeout.
      // Results from each chunk are combined into a single review queue.
      const chunks: StagedPage[][] = []
      for (let i = 0; i < pagesToParse.length; i += 2) {
        chunks.push(pagesToParse.slice(i, i + 2))
      }

      const allRecipes: unknown[] = []

      for (const chunk of chunks) {
        const fd = new FormData()
        const converted = await Promise.all(chunk.map((p, i) => compressFile(p.file, i)))
        converted.forEach(f => fd.append('images', f))
        fd.append('batch_mode', 'true')

        const res = await fetch('/api/parse-image', { method: 'POST', body: fd })
        if (!res.ok) {
          throw new Error(res.status === 504 ? 'Timed out — try fewer pages at once' : 'Server error ' + res.status)
        }
        let data: Record<string, unknown>
        try {
          data = await res.json() as Record<string, unknown>
        } catch {
          throw new Error('Timed out — try fewer pages at once')
        }
        if (data.error) throw new Error(data.error as string)

        const recipes: unknown[] = Array.isArray(data.recipes)
          ? data.recipes
          : [data.recipes || data.recipe]
        allRecipes.push(...recipes)
      }

      // Remove placeholder
      setQueue(prev => prev.filter(i => i.id !== placeholderId))

      // One review item per recipe found across all chunks
      const newItems: QueueItem[] = allRecipes.map((r: unknown) => {
        const rd = r as Record<string, unknown>
        const recipe: Partial<Recipe> = {
          ...rd as Partial<Recipe>,
          id: crypto.randomUUID(),
          source: cookbookTitle || rd.source as string,
          source_type: 'cookbook' as const,
          made: false,
          favorited: false,
          made_log: [],
          gallery_urls: [],
          dietary_tags: rd.dietary_tags as string[] || [],
          collections: [],
          tags: rd.tags as string[] || [],
          share_token: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        return {
          id: crypto.randomUUID(),
          files: pagesToParse.map(p => p.file),
          previews: pagesToParse.map(p => p.preview),
          status: 'review' as const,
          recipe,
          error: null,
          selected: false
        }
      })

      setQueue(prev => [...prev, ...newItems])
      if (newItems.length > 0) setActiveId(newItems[0].id)

    } catch (e: unknown) {
      // Turn placeholder into an error item so user can retry
      setQueue(prev => prev.map(i => i.id === placeholderId ? {
        ...i,
        status: 'error' as const,
        error: e instanceof Error ? e.message : 'Parse failed'
      } : i))
    }

    setProcessing(false)
  }

  // Retry a failed parse item
  const retryItem = async (item: QueueItem) => {
    if (!item.files.length) return
    const update = (id: string, patch: Partial<QueueItem>) =>
      setQueue(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))

    update(item.id, { status: 'parsing', error: null })
    try {
      const fd = new FormData()
      const converted = await Promise.all(item.files.map((f, i) => compressFile(f, i)))
      converted.forEach(f => fd.append('images', f))
      fd.append('batch_mode', 'true')

      const res = await fetch('/api/parse-image', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Parse failed')

      const recipes: unknown[] = Array.isArray(data.recipes)
        ? data.recipes
        : [data.recipes || data.recipe]
      const rd = recipes[0] as Record<string, unknown>

      const recipe: Partial<Recipe> = {
        ...rd as Partial<Recipe>,
        id: item.recipe?.id || crypto.randomUUID(),
        source: cookbookTitle || rd.source as string,
        source_type: 'cookbook' as const,
        made: false,
        favorited: false,
        made_log: [],
        gallery_urls: [],
        dietary_tags: rd.dietary_tags as string[] || [],
        collections: [],
        tags: rd.tags as string[] || [],
        share_token: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      update(item.id, { status: 'review', recipe })
      setActiveId(item.id)
    } catch (e: unknown) {
      update(item.id, { status: 'error', error: e instanceof Error ? e.message : 'Failed' })
    }
  }

  const saveItem = async (id: string) => {
    const item = queue.find(i => i.id === id)
    if (!item?.recipe) return
    setQueue(prev => prev.map(i => i.id === id ? { ...i, status: 'saving' } : i))
    try {
      await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.recipe)
      })

      const subRecipes = (item.recipe.sub_recipes || [])
      const excluded = ((item.recipe as Record<string, unknown>).excluded_sub_recipes as number[] || [])
      const toSave = subRecipes.filter((_: unknown, i: number) => !excluded.includes(i))

      for (const sr of toSave) {
        await fetch('/api/recipes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...sr,
            id: crypto.randomUUID(),
            source: item.recipe.source,
            source_url: item.recipe.source_url || null,
            source_type: 'cookbook',
            made: false,
            favorited: false,
            made_log: [],
            gallery_urls: [],
            collections: [],
            tags: (sr as unknown as Record<string, unknown>).tags as string[] || [],
            dietary_tags: (sr as unknown as Record<string, unknown>).dietary_tags as string[] || [],
            share_token: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        })
      }

      setQueue(prev => prev.map(i => i.id === id ? { ...i, status: 'saved' } : i))
      setActiveId(null)
    } catch {
      setQueue(prev => prev.map(i => i.id === id ? { ...i, status: 'error', error: 'Save failed' } : i))
    }
  }

  const updateRecipe = (id: string, updated: Partial<Recipe>) => {
    setQueue(prev => prev.map(i => i.id === id ? { ...i, recipe: updated } : i))
  }

  const savedCount = queue.filter(i => i.status === 'saved').length
  const reviewCount = queue.filter(i => i.status === 'review').length

  const statusColor = (s: QueueItem['status']) =>
    ({ saved: 'var(--green)', error: 'var(--red)', review: 'var(--accent)', parsing: 'var(--muted)', saving: 'var(--muted)', pending: 'var(--muted)' }[s])

  const statusLabel = (s: QueueItem['status']) =>
    ({ saved: 'Saved', error: 'Parse error', review: 'Ready to review', parsing: 'Parsing...', saving: 'Saving...', pending: 'Pending' }[s])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>

      {/* HEADER */}
      <div style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href="/import/batch" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 20 }}>←</Link>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>📚 Cookbook Session</div>
              {step === 'import' && cookbookTitle && (
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{cookbookTitle}{cookbookAuthor ? ' · ' + cookbookAuthor : ''}</div>
              )}
            </div>
          </div>
          {step === 'import' && (
            <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>
              {queue.filter(i => i.status !== 'parsing').length > 0 && (
                <>{queue.filter(i => i.status !== 'parsing').length} recipes · {savedCount} saved</>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px 100px' }}>

        {/* ── STEP 1: SETUP ── */}
        {step === 'setup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 14, color: 'var(--muted)' }}>
              Enter the cookbook title — if it already exists in your library, the details will fill in automatically.
            </p>

            <div style={{ background: 'var(--card)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, border: '1px solid var(--border)' }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Cookbook Title *</label>
                <input className="input" style={{ fontSize: 16 }} placeholder="e.g. Bouchon Bakery" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
                {matchedCookbook && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--green)', fontWeight: 500 }}>
                    ✓ Continuing existing cookbook — details auto-filled
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Author(s)</label>
                <input className="input" style={{ fontSize: 16 }} placeholder="e.g. Thomas Keller" value={author} onChange={e => setAuthor(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Publication Year</label>
                <input className="input" style={{ fontSize: 16 }} placeholder="e.g. 2012" value={pubYear} onChange={e => setPubYear(e.target.value)} />
              </div>
            </div>

            <div style={{ background: 'var(--card)', borderRadius: 12, padding: '12px 16px', border: '1px solid var(--border)', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
              💡 Photograph pages in order and stage them before parsing. Claude will detect recipe boundaries automatically — no merging needed.
            </div>

            <button onClick={startSession} disabled={!canStart} className="btn btn-primary"
              style={{ padding: '14px', fontSize: 16, borderRadius: 12, opacity: canStart ? 1 : .4 }}>
              Start Importing →
            </button>
          </div>
        )}

        {/* ── STEP 2: IMPORT ── */}
        {step === 'import' && (
          <div>

            {/* CAMERA BUTTON */}
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                background: 'var(--accent)', borderRadius: 16, padding: '22px 20px',
                textAlign: 'center', cursor: 'pointer', marginBottom: 14,
                boxShadow: '0 4px 20px rgba(29,78,216,.2)',
                transition: 'transform .15s'
              }}
              onTouchStart={e => (e.currentTarget as HTMLDivElement).style.transform = 'scale(.97)'}
              onTouchEnd={e => (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                onChange={e => { if (e.target.files) Array.from(e.target.files).forEach(addPhoto); e.target.value = '' }}
                style={{ display: 'none' }}
              />
              <div style={{ fontSize: 34, marginBottom: 5 }}>📷</div>
              <div style={{ color: '#fff', fontSize: 17, fontWeight: 600 }}>Add Page</div>
              <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12, marginTop: 3 }}>
                Tap to photograph — stage multiple pages, then parse together
              </div>
            </div>

            {/* STAGED PAGES */}
            {stagedPages.length > 0 && (
              <div style={{
                background: 'var(--card)', borderRadius: 14, padding: 14,
                border: '2px solid var(--accent)', marginBottom: 14
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                    {stagedPages.length} {stagedPages.length === 1 ? 'page' : 'pages'} staged
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>tap × to remove</div>
                </div>

                {/* Thumbnail strip */}
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 12 }}>
                  {stagedPages.map((page, idx) => (
                    <div key={page.id} style={{ position: 'relative', flexShrink: 0 }}>
                      <img
                        src={page.preview}
                        alt={`Page ${idx + 1}`}
                        style={{ width: 68, height: 80, objectFit: 'cover', borderRadius: 8, display: 'block' }}
                      />
                      {/* Page number badge */}
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'rgba(0,0,0,0.5)', color: '#fff',
                        fontSize: 10, fontWeight: 700, textAlign: 'center',
                        borderRadius: '0 0 8px 8px', padding: '2px 0'
                      }}>
                        {idx + 1}
                      </div>
                      {/* Remove button */}
                      <button
                        onClick={() => removeStagedPage(page.id)}
                        style={{
                          position: 'absolute', top: -6, right: -6,
                          background: '#1e293b', color: '#fff', border: 'none',
                          borderRadius: '50%', width: 20, height: 20,
                          fontSize: 10, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'inherit', lineHeight: 1, fontWeight: 700
                        }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                {/* Parse button */}
                <button
                  onClick={parseBatch}
                  disabled={processing}
                  style={{
                    width: '100%',
                    background: processing ? 'var(--muted)' : 'var(--accent)',
                    color: '#fff', border: 'none', borderRadius: 10,
                    padding: '13px', fontSize: 15, fontWeight: 600,
                    cursor: processing ? 'default' : 'pointer',
                    fontFamily: 'inherit', transition: 'background .15s'
                  }}>
                  {processing
                    ? '⏳  Parsing pages...'
                    : `Parse ${stagedPages.length} ${stagedPages.length === 1 ? 'page' : 'pages'} →`
                  }
                </button>
              </div>
            )}

            {/* REVIEW QUEUE */}
            {queue.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {reviewCount > 0 && (
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4, marginBottom: 2 }}>
                    {reviewCount} {reviewCount === 1 ? 'recipe' : 'recipes'} ready to review
                  </div>
                )}

                {queue.map(item => (
                  <div
                    key={item.id}
                    onClick={() => item.status === 'review' && setActiveId(item.id === activeId ? null : item.id)}
                    style={{
                      background: 'var(--card)', borderRadius: 12, overflow: 'hidden',
                      border: '1.5px solid ' + (activeId === item.id ? 'var(--accent)' : 'var(--border)'),
                      cursor: item.status === 'review' ? 'pointer' : 'default'
                    }}>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                      {/* Thumbnail */}
                      {item.previews[0]
                        ? <img src={item.previews[0]} alt="" style={{ width: 48, height: 52, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                        : <div style={{ width: 48, height: 52, borderRadius: 8, background: 'var(--tag)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📄</div>
                      }

                      {/* Title + status */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.status === 'parsing'
                            ? 'Parsing...'
                            : item.recipe?.title || 'Recipe'
                          }
                        </div>
                        <div style={{ fontSize: 12, color: statusColor(item.status), marginTop: 2 }}>
                          {item.status === 'error' && item.error ? item.error : statusLabel(item.status)}
                        </div>
                        {item.recipe?.page_number && (
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                            p. {item.recipe.page_number}
                          </div>
                        )}
                      </div>

                      {/* Action button */}
                      <div style={{ flexShrink: 0 }}>
                        {item.status === 'review' && (
                          <button
                            onClick={e => { e.stopPropagation(); saveItem(item.id) }}
                            style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                            Save
                          </button>
                        )}
                        {item.status === 'error' && item.files.length > 0 && (
                          <button
                            onClick={e => { e.stopPropagation(); retryItem(item) }}
                            style={{ background: 'var(--tag)', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Retry
                          </button>
                        )}
                        {item.status === 'saved' && (
                          <span style={{ fontSize: 20, color: 'var(--green)' }}>✓</span>
                        )}
                        {(item.status === 'parsing' || item.status === 'saving') && (
                          <span style={{ fontSize: 13, color: 'var(--muted)' }}>...</span>
                        )}
                      </div>
                    </div>

                    {/* INLINE REVIEW PANEL */}
                    {activeId === item.id && item.status === 'review' && item.recipe && (
                      <div style={{ borderTop: '1px solid var(--border)', padding: 16 }} onClick={e => e.stopPropagation()}>
                        <RecipeReviewPanel
                          recipe={item.recipe}
                          compact={true}
                          onChange={(updated) => updateRecipe(item.id, updated as Partial<Recipe>)}
                          onSave={() => saveItem(item.id)}
                          saving={queue.find(q => q.id === item.id)?.status === 'saving'}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* BOTTOM ACTIONS */}
            {(queue.length > 0 || stagedPages.length > 0) && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link href="/" className="btn btn-ghost" style={{ flex: 1, textAlign: 'center', padding: '12px' }}>
                  Done for now
                </Link>
                {reviewCount > 0 && (
                  <button
                    onClick={() => saveDraft(queue)}
                    style={{ flex: 1, padding: '12px', background: '#FEF9C3', border: '1px solid #FDE047', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, color: '#854D0E' }}>
                    {draftSaved ? '✓ Saved!' : 'Save draft'}
                  </button>
                )}
                {savedCount > 0 && (
                  <Link href={'/?source=' + encodeURIComponent(cookbookTitle)} className="btn btn-primary" style={{ flex: 1, textAlign: 'center', padding: '12px' }}>
                    View in Library
                  </Link>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}

export default function CookbookSessionPage() {
  return (
    <Suspense fallback={<div style={{ padding: 80 }} />}>
      <CookbookSessionPageInner />
    </Suspense>
  )
}
