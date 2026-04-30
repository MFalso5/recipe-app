'use client'
import { useEffect, useState, useRef } from 'react'
import { IdeaNote } from '@/lib/types'
import Link from 'next/link'

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<IdeaNote[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const saveTimeout = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetch('/api/research').then(r => r.json()).then(d => {
      const all = d.ideas || []
      // Ensure scratchpad exists
      const scratchpad = all.find((i: IdeaNote) => i.is_scratchpad)
      if (!scratchpad) {
        const pad: IdeaNote = { id: crypto.randomUUID(), title: 'Quick Capture', content: '', is_scratchpad: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        fetch('/api/research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pad) })
        setIdeas([pad, ...all])
        setActiveId(pad.id)
      } else {
        setIdeas(all)
        setActiveId(scratchpad.id)
      }
      setLoading(false)
    })
  }, [])

  const saveIdea = (idea: IdeaNote) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => {
      fetch('/api/research/' + idea.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(idea) })
    }, 800)
  }

  const updateIdea = (id: string, updates: Partial<IdeaNote>) => {
    setIdeas(prev => prev.map(i => {
      if (i.id !== id) return i
      const updated = { ...i, ...updates, updated_at: new Date().toISOString() }
      saveIdea(updated)
      return updated
    }))
  }

  const createNote = async () => {
    if (!newTitle.trim()) return
    const note: IdeaNote = { id: crypto.randomUUID(), title: newTitle.trim(), content: '', is_scratchpad: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    await fetch('/api/research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(note) })
    setIdeas(prev => [prev.find(i => i.is_scratchpad)!, note, ...prev.filter(i => !i.is_scratchpad)])
    setActiveId(note.id)
    setNewTitle(''); setShowNewForm(false)
  }

  const deleteNote = async (id: string) => {
    const idea = ideas.find(i => i.id === id)
    if (idea?.is_scratchpad) return
    if (!confirm('Delete this note?')) return
    await fetch('/api/research/' + id, { method: 'DELETE' })
    const remaining = ideas.filter(i => i.id !== id)
    setIdeas(remaining)
    setActiveId(remaining[0]?.id || null)
  }

  const active = ideas.find(i => i.id === activeId)
  const scratchpad = ideas.find(i => i.is_scratchpad)
  const notes = ideas.filter(i => !i.is_scratchpad)

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 16px 80px' }}>
      {/* NAV */}
      <div style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)', margin: '0 -16px 28px', padding: '0 16px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', height: 52, display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto' }}>
          <Link href="/" style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--muted)', textDecoration: 'none', whiteSpace: 'nowrap' }}>All Recipes</Link>
          <Link href="/" style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--muted)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Collections</Link>
          <Link href="/" style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--muted)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Menus</Link>
          <Link href="/meal-prep-list" style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--muted)', textDecoration: 'none', whiteSpace: 'nowrap' }}>🥘 Meal Prep</Link>
          <Link href="/research" style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--accent)', background: 'var(--accent-bg)', textDecoration: 'none', whiteSpace: 'nowrap' }}>🔬 Research</Link>
          <div style={{ marginLeft: 'auto' }}>
            <Link href="/import" className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap' }}>+ Add Recipe</Link>
          </div>
        </div>
      </div>


      <div style={{ padding: '28px 0 24px', borderBottom: '1px solid var(--border)', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 700 }}>Ideas</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>Research, wishlists and recipe notes</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
<button onClick={() => setShowNewForm(true)} className="btn btn-primary btn-sm">+ New Note</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20 }}>

        {/* SIDEBAR */}
        <div>
          {/* SCRATCHPAD */}
          {scratchpad && (
            <div onClick={() => setActiveId(scratchpad.id)} style={{
              padding: '12px 14px', borderRadius: 10, cursor: 'pointer', marginBottom: 16,
              background: activeId === scratchpad.id ? 'var(--accent-bg)' : 'var(--tip)',
              border: '1px solid ' + (activeId === scratchpad.id ? 'var(--accent)' : 'var(--tip-border)'),
              transition: 'all .15s'
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: activeId === scratchpad.id ? 'var(--accent)' : 'var(--tip-text)' }}>⚡ Quick Capture</div>
              <div style={{ fontSize: 11, color: 'var(--tip-text)', marginTop: 3, opacity: .7 }}>
                {scratchpad.content ? scratchpad.content.slice(0, 40) + '...' : 'Tap to start capturing ideas...'}
              </div>
            </div>
          )}

          {/* NEW NOTE FORM */}
          {showNewForm && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
              <input className="input" style={{ fontSize: 13, marginBottom: 8 }} placeholder="Note title..." value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && createNote()} autoFocus />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={createNote} className="btn btn-primary btn-sm" style={{ flex: 1 }}>Create</button>
                <button onClick={() => { setShowNewForm(false); setNewTitle('') }} className="btn btn-ghost btn-sm">Cancel</button>
              </div>
              {/* QUICK START SUGGESTIONS */}
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {['Recipes to find', 'Holiday baking ideas', 'Weeknight dinners', 'Recipes to create'].map(s => (
                  <button key={s} onClick={() => { setNewTitle(s); }} style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {/* NOTES LIST */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {notes.map(note => (
              <div key={note.id} onClick={() => setActiveId(note.id)} style={{
                padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                background: activeId === note.id ? 'var(--accent-bg)' : 'var(--card)',
                border: '1px solid ' + (activeId === note.id ? 'var(--accent)' : 'var(--border)'),
                transition: 'all .15s', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: activeId === note.id ? 'var(--accent)' : 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, opacity: .7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {note.content ? note.content.slice(0, 35) + '...' : 'Empty note'}
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); deleteNote(note.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14, padding: '0 0 0 8px', flexShrink: 0, opacity: .5 }}>✕</button>
              </div>
            ))}
          </div>

          {notes.length === 0 && !showNewForm && (
            <div style={{ textAlign: 'center', padding: '24px 12px' }}>
              <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>Create notes for recipe wishlists, ideas to try, or anything you want to remember.</p>
            </div>
          )}
        </div>

        {/* EDITOR */}
        <div>
          {active ? (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
              {/* NOTE HEADER */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: active.is_scratchpad ? 'var(--tip)' : 'var(--tag)', display: 'flex', alignItems: 'center', gap: 10 }}>
                {active.is_scratchpad ? (
                  <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 17, fontWeight: 600, color: 'var(--tip-text)' }}>⚡ Quick Capture</div>
                ) : (
                  <input
                    style={{ flex: 1, background: 'none', border: 'none', fontFamily: 'Playfair Display, serif', fontSize: 17, fontWeight: 600, color: 'var(--ink)', outline: 'none' }}
                    value={active.title}
                    onChange={e => updateIdea(active.id, { title: e.target.value })}
                  />
                )}
                <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>
                  {new Date(active.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>

              {/* EDITOR AREA */}
              <textarea
                style={{
                  flex: 1, background: 'none', border: 'none', padding: '20px', fontFamily: 'DM Sans, sans-serif',
                  fontSize: 14, color: 'var(--ink)', resize: 'none', outline: 'none', lineHeight: 1.8
                }}
                placeholder={active.is_scratchpad
                  ? 'Capture recipe ideas, things to look up, recipes you want to create...\n\nExamples:\n• Find a good sourdough focaccia recipe\n• Try making homemade pasta\n• Look for a Sicilian caponata\n• ATK has a brown butter chocolate chip cookie — find it'
                  : 'Start typing your ideas...'
                }
                value={active.content}
                onChange={e => updateIdea(active.id, { content: e.target.value })}
              />

              {/* FOOTER */}
              <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', background: 'var(--cream)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{active.content.length} characters · auto-saves</span>
                <button onClick={() => window.print()} className="btn btn-ghost btn-sm">🖨 Print</button>
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '60px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>💡</div>
              <p style={{ color: 'var(--muted)', fontSize: 15 }}>Select a note or create a new one</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
