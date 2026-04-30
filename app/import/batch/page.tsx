'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Recipe } from '@/lib/types'
import RecipeReviewPanel from '@/components/RecipeReviewPanel'

interface BatchItem {
  id: string
  files: File[]
  url?: string
  label: string
  status: 'pending' | 'parsing' | 'review' | 'saving' | 'saved' | 'error'
  recipe: Partial<Recipe> | null
  error: string | null
  selected: boolean
}

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      let { width, height } = img
      const maxDim = 1600
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * maxDim / width); width = maxDim }
        else { width = Math.round(width * maxDim / height); height = maxDim }
      }
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => {
        resolve(blob ? new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' }) : file)
      }, 'image/jpeg', 0.85)
    }
    img.onerror = () => resolve(file)
    img.src = url
  })
}

async function uploadImageToBlob(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('image', file)
  const res = await fetch('/api/upload-image', { method: 'POST', body: fd })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.url
}

function BatchImportPageInner() {
  const searchParams = useSearchParams()
  const fileRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<BatchItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [defaultSource, setDefaultSource] = useState('')
  const [defaultSourceType, setDefaultSourceType] = useState<'cookbook' | 'website' | 'other'>('cookbook')
  const [batchMode, setBatchMode] = useState<'files' | 'urls'>('files')
  const [urlInputs, setUrlInputs] = useState<string[]>([''])

  useEffect(() => {
    if (searchParams.get('mode') === 'urls') {
      try {
        const stored = sessionStorage.getItem('batchUrls')
        if (stored) {
          const urls: string[] = JSON.parse(stored)
          sessionStorage.removeItem('batchUrls')
          const newItems: BatchItem[] = urls.map(url => ({
            id: crypto.randomUUID(),
            files: [],
            url,
            label: url.replace(/^https?:\/\//, '').split('/')[0],
            status: 'pending' as const,
            recipe: null,
            error: null,
            selected: false
          }))
          setItems(newItems)
        }
      } catch { /* ignore */ }
    }
  }, [])

  const updateItem = (id: string, update: Partial<BatchItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...update } : i))
  }

  const addFiles = (incoming: File[]) => {
    const newItems: BatchItem[] = incoming.map(f => ({
      id: crypto.randomUUID(),
      files: [f],
      label: f.name.replace(/\.[^.]+$/, ''),
      status: 'pending' as const,
      recipe: null,
      error: null,
      selected: false
    }))
    setItems(prev => [...prev, ...newItems])
  }

  const addUrlsToQueue = () => {
    const urls = urlInputs.filter(u => u.trim().startsWith('http'))
    if (!urls.length) return
    const newItems: BatchItem[] = urls.map(url => ({
      id: crypto.randomUUID(),
      files: [],
      url: url.trim(),
      label: url.replace(/^https?:\/\//, '').split('/')[0],
      status: 'pending' as const,
      recipe: null,
      error: null,
      selected: false
    }))
    setItems(prev => [...prev, ...newItems])
    setUrlInputs([''])
    setBatchMode('files')
  }

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
    if (activeId === id) setActiveId(null)
  }

  const parseItem = async (item: BatchItem) => {
    updateItem(item.id, { status: 'parsing', error: null })
    try {
      let res: Response

      if (item.url) {
        res = await fetch('/api/parse-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: item.url })
        })
        const data = await res.json()
        if (!res.ok || data.error) throw new Error(data.error || 'Parse failed')
        const recipeSource = data.recipe.source && data.recipe.source !== 'Unknown Source'
          ? data.recipe.source
          : defaultSource || data.recipe.source
        const pageImages: string[] = data.images || []
        const heroUrl = data.recipe.image_url || pageImages[0] || null
        const galleryImages = pageImages.filter((u: string) => u !== heroUrl).slice(0, 8)
        updateItem(item.id, {
          status: 'review',
          recipe: {
            ...data.recipe,
            image_url: heroUrl,
            source: recipeSource,
            source_type: (!data.recipe.source || data.recipe.source === 'Unknown Source') && defaultSource ? defaultSourceType : (data.recipe.source_type || 'other'),
            id: crypto.randomUUID(),
            made: false,
            made_log: [],
            gallery_urls: galleryImages,
            dietary_tags: data.recipe.dietary_tags || [],
            collections: [],
            tags: data.recipe.tags || [],
            share_token: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        })
        setActiveId(item.id)
        return
      }

      const isDoc = item.files.some(f => !f.type.startsWith('image/'))
      const fd = new FormData()

      if (isDoc) {
        item.files.forEach(f => fd.append('documents', f))
        res = await fetch('/api/parse-document', { method: 'POST', body: fd })
      } else {
        const compressed = await Promise.all(item.files.map(f => compressImage(f)))
        const heroFile = compressed.reduce((best, f) => f.size > best.size ? f : best, compressed[0])
        let heroUrl: string | null = null
        try { heroUrl = await uploadImageToBlob(heroFile) } catch { /* non-fatal */ }
        if (heroUrl) fd.append('hero_image_url', heroUrl)
        compressed.forEach(f => fd.append('images', f))
        fd.append('page_count', String(item.files.length))
        res = await fetch('/api/parse-image', { method: 'POST', body: fd })
      }

      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Parse failed')

      const recipeSource = data.recipe.source && data.recipe.source !== 'Unknown Source'
        ? data.recipe.source
        : defaultSource || data.recipe.source

      updateItem(item.id, {
        status: 'review',
        recipe: {
          ...data.recipe,
          source: recipeSource,
          source_type: (!data.recipe.source || data.recipe.source === 'Unknown Source') && defaultSource ? defaultSourceType : (data.recipe.source_type || 'other'),
          id: crypto.randomUUID(),
          made: false,
          made_log: [],
          gallery_urls: data.gallery_urls || [],
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
    for (const item of items.filter(i => i.status === 'pending')) {
      await parseItem(item)
    }
    setProcessing(false)
  }

  const saveItem = async (id: string) => {
    const item = items.find(i => i.id === id)
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

  const saveAll = async () => {
    for (const item of items.filter(i => i.status === 'review')) {
      await saveItem(item.id)
    }
  }

  const pendingCount = items.filter(i => i.status === 'pending').length
  const reviewCount = items.filter(i => i.status === 'review').length
  const savedCount = items.filter(i => i.status === 'saved').length
  const activeItem = items.find(i => i.id === activeId)

  const sColor = (s: BatchItem['status']): string => {
    if (s === 'saved') return 'var(--green)'
    if (s === 'error') return 'var(--red)'
    if (s === 'review') return 'var(--accent)'
    return 'var(--muted)'
  }
  const sLabel = (s: BatchItem['status']): string => {
    if (s === 'saved') return 'Saved'
    if (s === 'error') return 'Error'
    if (s === 'review') return 'Review'
    if (s === 'parsing') return 'Parsing...'
    if (s === 'saving') return 'Saving...'
    return 'Pending'
  }

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

      {/* COOKBOOK SESSION BANNER */}
      <Link href="/import/cookbook-session" style={{ textDecoration: 'none', display: 'block', marginBottom: 20 }}>
        <div style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #1e40af 100%)', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', boxShadow: '0 4px 16px rgba(29,78,216,.2)' }}>
          <div style={{ fontSize: 36 }}>Cookbook Session</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 16, marginBottom: 3 }}>Cookbook Import Session</div>
            <div style={{ color: 'rgba(255,255,255,.8)', fontSize: 13 }}>Set book details once, then photograph recipes one by one</div>
          </div>
          <div style={{ marginLeft: 'auto', color: 'rgba(255,255,255,.8)', fontSize: 20 }}>-></div>
        </div>
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: items.length > 0 ? '320px 1fr' : '1fr', gap: 20 }}>

        {/* LEFT PANEL */}
        <div>
          {/* MODE TABS */}
          <div style={{ display: 'flex', background: 'var(--tag)', borderRadius: 8, padding: 3, gap: 2, marginBottom: 12 }}>
            {(['files', 'urls'] as const).map(m => (
              <button key={m} onClick={() => setBatchMode(m)} style={{
                flex: 1, padding: '6px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
                background: batchMode === m ? 'var(--card)' : 'transparent',
                color: batchMode === m ? 'var(--ink)' : 'var(--muted)',
                boxShadow: batchMode === m ? '0 1px 3px rgba(0,0,0,.08)' : 'none'
              }}>{m === 'files' ? 'Files Files' : 'URLs URLs'}</button>
            ))}
          </div>

          {batchMode === 'files' ? (
            <div onClick={() => fileRef.current?.click()} onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(Array.from(e.dataTransfer.files)) }}
              style={{ border: '2px dashed ' + (dragOver ? 'var(--accent)' : 'var(--border)'), borderRadius: 14, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'var(--accent-bg)' : 'var(--card)', transition: 'all .15s', marginBottom: 12 }}>
              <input ref={fileRef} type="file" accept="image/*,.pdf,.docx,.doc,.txt" multiple onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)) }} style={{ display: 'none' }} />
              <div style={{ fontSize: 28, marginBottom: 8 }}>folder</div>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}><strong style={{ color: 'var(--accent)' }}>Tap to choose files</strong> or drag and drop</p>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, opacity: .7 }}>Photos, PDFs, Word docs</p>
            </div>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                {urlInputs.map((url, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: url.trim() ? 'var(--accent)' : 'var(--tag)', color: url.trim() ? '#fff' : 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>{i + 1}</div>
                    <input className="input" style={{ flex: 1, fontSize: 12, fontFamily: 'monospace' }}
                      placeholder="https://..."
                      value={url}
                      onChange={e => { const n = [...urlInputs]; n[i] = e.target.value; setUrlInputs(n) }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); setUrlInputs(p => [...p, '']) }
                        if (e.key === 'Backspace' && !url && urlInputs.length > 1) { e.preventDefault(); setUrlInputs(p => p.filter((_, j) => j !== i)) }
                      }}
                    />
                    <button onClick={() => setUrlInputs(p => p.length === 1 ? [''] : p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14, flexShrink: 0 }}>x</button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setUrlInputs(p => [...p, ''])} style={{ background: 'none', border: '1.5px dashed var(--border)', borderRadius: 7, padding: '5px 10px', fontSize: 12, color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit' }}>+ Add URL</button>
                <button onClick={addUrlsToQueue} disabled={!urlInputs.some(u => u.trim().startsWith('http'))} className="btn btn-primary btn-sm" style={{ flex: 1 }}>Add to Queue</button>
              </div>
            </div>
          )}

          {/* DEFAULT SOURCE */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
              Default Source <span style={{ fontWeight: 400, textTransform: 'none' }}>(applied if not detected)</span>
            </div>
            <input className="input" style={{ fontSize: 13, marginBottom: 8 }}
              placeholder="e.g. Four and Twenty Blackbirds Pie Book"
              value={defaultSource}
              onChange={e => setDefaultSource(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              {(['cookbook', 'website', 'other'] as const).map(t => (
                <button key={t} onClick={() => setDefaultSourceType(t)} style={{
                  flex: 1, padding: '6px 4px', borderRadius: 7, border: '1.5px solid ' + (defaultSourceType === t ? 'var(--accent)' : 'var(--border)'),
                  background: defaultSourceType === t ? 'var(--accent-bg)' : 'var(--cream)',
                  color: defaultSourceType === t ? 'var(--accent)' : 'var(--muted)',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 10, fontWeight: 600
                }}>{t === 'cookbook' ? 'Cookbook Session' : t === 'website' ? 'Web' : 'Doc'} {t}</button>
              ))}
            </div>
          </div>

          {/* QUEUE STATS */}
          {items.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
                {items.length} total
                {reviewCount > 0 && <span style={{ color: 'var(--accent)', fontWeight: 500 }}> - {reviewCount} ready</span>}
                {savedCount > 0 && <span style={{ color: 'var(--green)', fontWeight: 500 }}> - {savedCount} saved</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {pendingCount > 0 && (
                  <button onClick={parseAll} disabled={processing} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                    {processing ? 'Parsing...' : 'Parse All ' + pendingCount}
                  </button>
                )}
                {reviewCount > 1 && (
                  <button onClick={saveAll} className="btn btn-green btn-sm" style={{ flex: 1 }}>
                    Save All {reviewCount}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* QUEUE LIST */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map(item => (
              <div key={item.id} onClick={() => item.status === 'review' && setActiveId(item.id === activeId ? null : item.id)}
                style={{
                  background: activeId === item.id ? 'var(--accent-bg)' : 'var(--card)',
                  border: '1px solid ' + (activeId === item.id ? 'var(--accent)' : 'var(--border)'),
                  borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8,
                  cursor: item.status === 'review' ? 'pointer' : 'default'
                }}>
                {item.recipe?.image_url ? (
                  <img src={item.recipe.image_url as string} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                ) : item.url ? (
                  <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>URLs</div>
                ) : item.files[0]?.type.startsWith('image/') ? (
                  <img src={URL.createObjectURL(item.files[0])} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 36, height: 36, background: 'var(--tag)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                    {item.files[0]?.name.endsWith('.pdf') ? 'PDF' : 'DOC'}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.recipe?.title || item.label}
                  </div>
                  <div style={{ fontSize: 11, color: sColor(item.status), marginTop: 1 }}>{sLabel(item.status)}</div>
                  {item.error && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 1 }}>{item.error.slice(0, 50)}</div>}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {item.status === 'pending' && (
                    <button onClick={e => { e.stopPropagation(); parseItem(item) }} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Parse</button>
                  )}
                  {item.status === 'error' && (
                    <button onClick={e => { e.stopPropagation(); parseItem(item) }} style={{ background: 'var(--tag)', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
                  )}
                  <button onClick={e => { e.stopPropagation(); removeItem(item.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14 }}>x</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL */}
        {items.length > 0 && (
          <div>
            {!activeItem || activeItem.status !== 'review' ? (
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}><--</div>
                <p style={{ color: 'var(--muted)', fontSize: 15 }}>
                  {reviewCount > 0 ? 'Select a parsed recipe to review' : 'Click "Parse All" to start'}
                </p>
              </div>
            ) : (
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--tag)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 600 }}>{activeItem.recipe?.title || 'Review Recipe'}</div>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>Scroll to review</span>
                </div>
                <div style={{ padding: 20, maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
                  <RecipeReviewPanel
                    recipe={activeItem.recipe || {}}
                    pageImages={[
                      ...(activeItem.recipe?.image_url ? [activeItem.recipe.image_url as string] : []),
                      ...((activeItem.recipe as Record<string, unknown>)?.gallery_urls as string[] || [])
                    ].filter((u, i, arr) => arr.indexOf(u) === i)}
                    compact={true}
                    onChange={(updated) => updateItem(activeItem.id, { recipe: updated as Partial<Recipe> })}
                    onSave={() => saveItem(activeItem.id)}
                    saving={items.find(i => i.id === activeItem.id)?.status === 'saving'}
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
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>}>
      <BatchImportPageInner />
    </Suspense>
  )
}
