'use client'
import * as React from 'react'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Recipe, Cookbook } from '@/lib/types'
import RecipeReviewPanel from '@/components/RecipeReviewPanel'

interface QueueItem {
  id: string
  file: File
  preview: string
  status: 'pending' | 'parsing' | 'review' | 'saving' | 'saved' | 'error'
  recipe: Partial<Recipe> | null
  error: string | null
}

type ParseMode = 'immediate' | 'queue'
type SessionMode = 'new' | 'existing'

export default function CookbookSessionPage() {
  const router = useRouter()

  // Step tracking
  const [step, setStep] = useState<'setup' | 'import' | 'done'>('setup')

  // Cookbook setup
  const [sessionMode, setSessionMode] = useState<SessionMode>('new')
  const [existingCookbooks, setExistingCookbooks] = useState<Cookbook[]>([])
  const [selectedCookbook, setSelectedCookbook] = useState<Cookbook | null>(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [pubYear, setPubYear] = useState('')
  const [parseMode, setParseMode] = useState<ParseMode>('immediate')

  // Import queue
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Load existing cookbooks
  useEffect(() => {
    fetch('/api/cookbooks').then(r => r.json()).then(d => {
      setExistingCookbooks(d.cookbooks || [])
    })
  }, [])

  const cookbookTitle = sessionMode === 'existing' ? selectedCookbook?.name || '' : title
  const cookbookAuthor = sessionMode === 'existing' ? selectedCookbook?.author || '' : author

  const canStart = sessionMode === 'existing'
    ? !!selectedCookbook
    : !!title.trim()

  const startSession = async () => {
    // Save cookbook metadata if new
    if (sessionMode === 'new' && title.trim()) {
      const cb: Cookbook = {
        id: title.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name: title.trim(),
        author: author.trim() || null,
        cover_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      await fetch('/api/cookbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cb)
      })
    }
    setStep('import')
  }

  const addPhoto = async (file: File) => {
    const preview = URL.createObjectURL(file)
    const item: QueueItem = {
      id: crypto.randomUUID(),
      file,
      preview,
      status: parseMode === 'immediate' ? 'parsing' : 'pending',
      recipe: null,
      error: null
    }
    setQueue(prev => [...prev, item])

    if (parseMode === 'immediate') {
      await parseItem(item, cookbookTitle, cookbookAuthor)
    }
  }

  const parseItem = async (item: QueueItem, cbTitle: string, cbAuthor: string) => {
    const updateItem = (id: string, update: Partial<QueueItem>) =>
      setQueue(prev => prev.map(i => i.id === id ? { ...i, ...update } : i))

    updateItem(item.id, { status: 'parsing' })
    try {
      const fd = new FormData()
      fd.append('images', item.file)
      const res = await fetch('/api/parse-image', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Parse failed')

      const recipe: Partial<Recipe> = {
        ...data.recipe,
        id: crypto.randomUUID(),
        source: cbTitle || data.recipe.source,
        source_type: 'cookbook' as const,
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

      updateItem(item.id, { status: 'review', recipe })
      setActiveId(item.id)
    } catch (e: unknown) {
      updateItem(item.id, { status: 'error', error: e instanceof Error ? e.message : 'Failed' })
    }
  }

  const parseAll = async () => {
    setProcessing(true)
    const pending = queue.filter(i => i.status === 'pending')
    for (const item of pending) {
      await parseItem(item, cookbookTitle, cookbookAuthor)
    }
    setProcessing(false)
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
      setQueue(prev => prev.map(i => i.id === id ? { ...i, status: 'saved' } : i))
      setActiveId(null)
    } catch {
      setQueue(prev => prev.map(i => i.id === id ? { ...i, status: 'error', error: 'Save failed' } : i))
    }
  }

  const updateRecipe = (id: string, updated: Partial<Recipe>) => {
    setQueue(prev => prev.map(i => i.id === id ? { ...i, recipe: updated } : i))
  }

  const activeItem = queue.find(i => i.id === activeId)
  const pendingCount = queue.filter(i => i.status === 'pending').length
  const savedCount = queue.filter(i => i.status === 'saved').length
  const reviewCount = queue.filter(i => i.status === 'review').length

  const statusColor = (s: QueueItem['status']) =>
    ({ saved: 'var(--green)', error: 'var(--red)', review: 'var(--accent)', parsing: 'var(--muted)', saving: 'var(--muted)', pending: 'var(--muted)' }[s])

  const statusLabel = (s: QueueItem['status']) =>
    ({ saved: 'Saved', error: 'Error', review: 'Review', parsing: 'Parsing...', saving: 'Saving...', pending: 'Pending' }[s])

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
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {queue.length} photos · {savedCount} saved
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px 100px' }}>

        {/* ── STEP 1: SETUP ── */}
        {step === 'setup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 14, color: 'var(--muted)' }}>
              Set up your cookbook once — all imported recipes will inherit these details automatically.
            </p>

            {/* NEW vs EXISTING toggle */}
            <div style={{ display: 'flex', background: 'var(--tag)', borderRadius: 10, padding: 3, gap: 2 }}>
              {(['new', 'existing'] as const).map(m => (
                <button key={m} onClick={() => setSessionMode(m)} style={{
                  flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 14, fontWeight: 500,
                  background: sessionMode === m ? 'var(--card)' : 'transparent',
                  color: sessionMode === m ? 'var(--ink)' : 'var(--muted)',
                  boxShadow: sessionMode === m ? '0 1px 4px rgba(0,0,0,.08)' : 'none'
                }}>
                  {m === 'new' ? '✨ New Cookbook' : '📚 Continue Existing'}
                </button>
              ))}
            </div>

            {sessionMode === 'new' ? (
              <div style={{ background: 'var(--card)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, border: '1px solid var(--border)' }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Cookbook Title *</label>
                  <input className="input" style={{ fontSize: 16 }} placeholder="e.g. Four & Twenty Blackbirds Pie Book" value={title} onChange={e => setTitle(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Author(s)</label>
                  <input className="input" style={{ fontSize: 16 }} placeholder="e.g. Emily and Melissa Elsen" value={author} onChange={e => setAuthor(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Publication Year</label>
                  <input className="input" style={{ fontSize: 16 }} placeholder="e.g. 2013" value={pubYear} onChange={e => setPubYear(e.target.value)} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {existingCookbooks.length === 0 ? (
                  <div style={{ background: 'var(--card)', borderRadius: 14, padding: 24, textAlign: 'center', border: '1px solid var(--border)', color: 'var(--muted)', fontSize: 14 }}>
                    No cookbooks yet — start a new one!
                  </div>
                ) : existingCookbooks.map(cb => (
                  <div key={cb.id} onClick={() => setSelectedCookbook(cb)} style={{
                    background: 'var(--card)', borderRadius: 12, padding: '14px 16px',
                    border: '2px solid ' + (selectedCookbook?.id === cb.id ? 'var(--accent)' : 'var(--border)'),
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                    transition: 'border-color .15s'
                  }}>
                    {cb.cover_url
                      ? <img src={cb.cover_url} alt="" style={{ width: 44, height: 56, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                      : <div style={{ width: 44, height: 56, background: 'var(--accent-bg)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>📚</div>
                    }
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{cb.name}</div>
                      {cb.author && <div style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>{cb.author}</div>}
                    </div>
                    {selectedCookbook?.id === cb.id && (
                      <div style={{ marginLeft: 'auto', width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>✓</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* PARSE MODE */}
            <div style={{ background: 'var(--card)', borderRadius: 14, padding: 16, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>Parse Mode</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {([
                  { value: 'immediate', label: 'Parse as I go', desc: 'Each photo parses automatically after capture — review one at a time' },
                  { value: 'queue', label: 'Queue all, parse later', desc: 'Take all photos first, then parse and review in batch' }
                ] as const).map(opt => (
                  <div key={opt.value} onClick={() => setParseMode(opt.value)} style={{
                    padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                    border: '2px solid ' + (parseMode === opt.value ? 'var(--accent)' : 'var(--border)'),
                    background: parseMode === opt.value ? 'var(--accent-bg)' : 'var(--cream)',
                    transition: 'all .15s'
                  }}>
                    <div style={{ fontWeight: 500, fontSize: 14, color: parseMode === opt.value ? 'var(--accent)' : 'var(--ink)', marginBottom: 3 }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{opt.desc}</div>
                  </div>
                ))}
              </div>
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
            {/* BIG CAMERA BUTTON */}
            <div onClick={() => fileRef.current?.click()} style={{
              background: 'var(--accent)', borderRadius: 16, padding: '28px 20px',
              textAlign: 'center', cursor: 'pointer', marginBottom: 16,
              boxShadow: '0 4px 20px rgba(29,78,216,.25)', transition: 'transform .15s, box-shadow .15s',
              border: 'none'
            }}
              onTouchStart={e => (e.currentTarget as HTMLDivElement).style.transform = 'scale(.97)'}
              onTouchEnd={e => (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'}
            >
              <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple
                onChange={e => { if (e.target.files) Array.from(e.target.files).forEach(addPhoto); e.target.value = '' }}
                style={{ display: 'none' }} />
              <div style={{ fontSize: 40, marginBottom: 8 }}>📷</div>
              <div style={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>Take Photo</div>
              <div style={{ color: 'rgba(255,255,255,.75)', fontSize: 13, marginTop: 4 }}>
                {cookbookTitle} · tap to capture
              </div>
            </div>

            {/* PARSE ALL button for queue mode */}
            {parseMode === 'queue' && pendingCount > 0 && (
              <button onClick={parseAll} disabled={processing} className="btn btn-primary"
                style={{ width: '100%', padding: '14px', fontSize: 15, borderRadius: 12, marginBottom: 14 }}>
                {processing ? 'Parsing...' : 'Parse All ' + pendingCount + ' Photos'}
              </button>
            )}

            {/* QUEUE */}
            {queue.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {queue.map(item => (
                  <div key={item.id} onClick={() => item.status === 'review' && setActiveId(item.id === activeId ? null : item.id)}
                    style={{
                      background: 'var(--card)', borderRadius: 12, overflow: 'hidden',
                      border: '1.5px solid ' + (activeId === item.id ? 'var(--accent)' : 'var(--border)'),
                      cursor: item.status === 'review' ? 'pointer' : 'default'
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                      <img src={item.preview} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.recipe?.title || 'Photo ' + (queue.indexOf(item) + 1)}
                        </div>
                        <div style={{ fontSize: 12, color: statusColor(item.status), marginTop: 2 }}>
                          {statusLabel(item.status)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {item.status === 'pending' && (
                          <button onClick={e => { e.stopPropagation(); parseItem(item, cookbookTitle, cookbookAuthor) }}
                            style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Parse
                          </button>
                        )}
                        {item.status === 'review' && (
                          <button onClick={e => { e.stopPropagation(); saveItem(item.id) }}
                            style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Save
                          </button>
                        )}
                        {item.status === 'error' && (
                          <button onClick={e => { e.stopPropagation(); parseItem(item, cookbookTitle, cookbookAuthor) }}
                            style={{ background: 'var(--tag)', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Retry
                          </button>
                        )}
                        {item.status === 'saved' && (
                          <span style={{ fontSize: 18 }}>✓</span>
                        )}
                      </div>
                    </div>

                    {/* INLINE REVIEW PANEL */}
                    {activeId === item.id && item.status === 'review' && item.recipe && (
                      <div style={{ borderTop: '1px solid var(--border)', padding: 16 }}>
                        <RecipeReviewPanel
                          recipe={item.recipe}
                          compact={true}
                          onChange={(updated) => updateRecipe(item.id, updated as Partial<Recipe>)}
                          onSave={() => saveItem(item.id)}
                          saving={item.status === 'saving'}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* DONE / CONTINUE LATER */}
            {queue.length > 0 && (
              <div style={{ display: 'flex', gap: 10 }}>
                <Link href="/" className="btn btn-ghost" style={{ flex: 1, textAlign: 'center', padding: '12px' }}>
                  Done for now →
                </Link>
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
