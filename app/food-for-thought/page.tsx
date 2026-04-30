'use client'
import { useEffect, useState, useRef } from 'react'
import { FoodForThoughtEntry } from '@/lib/types'
import Link from 'next/link'

export default function FoodForThoughtPage() {
  const [entries, setEntries] = useState<FoodForThoughtEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [fetching, setFetching] = useState(false)

  // Form state
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState('')

  useEffect(() => {
    fetch('/api/saved-articles').then(r => r.json()).then(d => {
      setEntries(d.entries || [])
      setLoading(false)
    })
  }, [])

  const allTags = Array.from(new Set(entries.flatMap(e => e.tags))).sort()

  const fetchPageInfo = async () => {
    if (!url.trim()) return
    setFetching(true)
    try {
      const res = await fetch('/api/parse-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      })
      const data = await res.json()
      if (data.recipe?.title && !title) setTitle(data.recipe.title)
      if (data.recipe?.description && !description) setDescription(data.recipe.description?.slice(0, 200) || '')
      if (data.recipe?.source && !tags) setTags(data.recipe.source)
    } catch { /* non-fatal */ }
    setFetching(false)
  }

  const resetForm = () => {
    setUrl(''); setTitle(''); setDescription(''); setNotes(''); setTags('')
    setEditingId(null); setShowForm(false)
  }

  const saveEntry = async () => {
    if (!url.trim() || !title.trim()) return
    const entry: FoodForThoughtEntry = {
      id: editingId || crypto.randomUUID(),
      url: url.trim(),
      title: title.trim(),
      description: description.trim() || null,
      notes: notes.trim() || null,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      created_at: entries.find(e => e.id === editingId)?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    if (editingId) {
      await fetch('/api/saved-articles/' + editingId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) })
      setEntries(prev => prev.map(e => e.id === editingId ? entry : e))
    } else {
      await fetch('/api/saved-articles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) })
      setEntries(prev => [entry, ...prev])
    }
    resetForm()
  }

  const editEntry = (entry: FoodForThoughtEntry) => {
    setUrl(entry.url); setTitle(entry.title)
    setDescription(entry.description || ''); setNotes(entry.notes || '')
    setTags((entry.tags || []).join(', '))
    setEditingId(entry.id); setShowForm(true)
  }

  const deleteEntry = async (id: string) => {
    if (!confirm('Remove this entry?')) return
    await fetch('/api/saved-articles/' + id, { method: 'DELETE' })
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  const filtered = entries.filter(e => {
    const q = search.toLowerCase()
    const matchQ = !q || e.title.toLowerCase().includes(q) || (e.description || '').toLowerCase().includes(q) || (e.notes || '').toLowerCase().includes(q) || e.tags.some(t => t.toLowerCase().includes(q))
    const matchTag = !filterTag || e.tags.includes(filterTag)
    return matchQ && matchTag
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>

      {/* NAV */}
      <div style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto' }}>
          <Link href="/" style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--muted)', textDecoration: 'none', whiteSpace: 'nowrap' }}>All Recipes</Link>
          <Link href="/" style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--muted)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Collections</Link>
          <Link href="/" style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--muted)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Menus</Link>
          <Link href="/meal-prep-list" style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--muted)', textDecoration: 'none', whiteSpace: 'nowrap' }}>🥘 Meal Prep</Link>
          <Link href="/research" style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--muted)', textDecoration: 'none', whiteSpace: 'nowrap' }}>🔬 Research</Link>
          <Link href="/saved-articles" style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--accent)', textDecoration: 'none', background: 'var(--accent-bg)', whiteSpace: 'nowrap' }}>📌 Saved Articles</Link>
          <div style={{ marginLeft: 'auto' }}>
            <Link href="/import" className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap' }}>+ Add Recipe</Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px 80px' }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 700 }}>Food for Thought</h1>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>Saved articles, websites and resources</p>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true) }} className="btn btn-primary btn-sm">+ Add Link</button>
        </div>

        {/* ADD / EDIT FORM */}
        {showForm && (
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{editingId ? 'Edit Entry' : 'Add Link'}</div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input className="input" style={{ flex: 1 }} type="url" placeholder="https://..." value={url}
                onChange={e => setUrl(e.target.value)}
                onBlur={fetchPageInfo} />
              <button onClick={fetchPageInfo} className="btn btn-ghost btn-sm" disabled={fetching}>
                {fetching ? '⟳' : '✨ Auto-fill'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 5 }}>
                  Title <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Article or page title" />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Description</label>
                <textarea className="input" style={{ minHeight: 60 }} value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this about?" />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Your Notes</label>
                <textarea className="input" style={{ minHeight: 60 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Why did you save this? What do you want to remember?" />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Tags <span style={{ fontWeight: 400, textTransform: 'none' }}>(comma-separated)</span></label>
                <input className="input" value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. Technique, Italian, Baking" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={resetForm} className="btn btn-ghost">Cancel</button>
              <button onClick={saveEntry} className="btn btn-primary" disabled={!url.trim() || !title.trim()}>
                {editingId ? 'Save Changes' : 'Save Link'}
              </button>
            </div>
          </div>
        )}

        {/* SEARCH + FILTER */}
        {entries.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: .4 }}>🔍</span>
              <input className="input" style={{ paddingLeft: 36 }} placeholder="Search links..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {allTags.length > 0 && (
              <select className="input" style={{ width: 'auto' }} value={filterTag} onChange={e => setFilterTag(e.target.value)}>
                <option value="">All tags</option>
                {allTags.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </div>
        )}

        {/* ENTRIES */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
        ) : filtered.length === 0 && entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, marginBottom: 8 }}>Nothing saved yet</h2>
            <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 24 }}>Save articles, websites, and resources you want to come back to</p>
            <button onClick={() => setShowForm(true)} className="btn btn-primary">+ Add your first link</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ color: 'var(--muted)', fontSize: 15 }}>No entries match your search.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>{filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}</div>
            {filtered.map(entry => (
              <div key={entry.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', transition: 'box-shadow .15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,.08)'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <a href={entry.url} target="_blank" rel="noreferrer" style={{ fontFamily: 'Playfair Display, serif', fontSize: 17, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none', display: 'block', marginBottom: 4 }}>
                      {entry.title} ↗
                    </a>
                    <a href={entry.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', opacity: .8, display: 'block', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.url}
                    </a>
                    {entry.description && <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 8 }}>{entry.description}</p>}
                    {entry.notes && (
                      <div style={{ background: 'var(--tip)', borderLeft: '3px solid var(--tip-border)', borderRadius: '0 6px 6px 0', padding: '8px 12px', fontSize: 13, color: 'var(--tip-text)', lineHeight: 1.6, marginBottom: 8 }}>
                        📝 {entry.notes}
                      </div>
                    )}
                    {entry.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {entry.tags.map(t => (
                          <button key={t} onClick={() => setFilterTag(filterTag === t ? '' : t)} style={{ padding: '3px 10px', borderRadius: 50, fontSize: 11, fontWeight: 500, background: filterTag === t ? 'var(--accent-bg)' : 'var(--tag)', border: '1px solid ' + (filterTag === t ? 'var(--accent)' : 'transparent'), color: filterTag === t ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit' }}>{t}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => editEntry(entry)} className="btn btn-ghost btn-sm">✏️</button>
                    <button onClick={() => deleteEntry(entry.id)} className="btn btn-danger btn-sm">✕</button>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, opacity: .6 }}>
                  Saved {new Date(entry.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
