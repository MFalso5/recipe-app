'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MealPrep, PrepSession, MenuRecipeEntry, Recipe } from '@/lib/types'
import Link from 'next/link'

export default function MealPrepPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [prep, setPrep] = useState<MealPrep | null>(null)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [showAddSession, setShowAddSession] = useState(false)
  const [showRecipePicker, setShowRecipePicker] = useState<string | null>(null)
  const [pickerSearch, setPickerSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'prep' | 'shopping'>('prep')
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const saveTimeout = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/meal-preps/' + params.id).then(r => r.json()),
      fetch('/api/recipes').then(r => r.json())
    ]).then(([pd, rd]) => { setPrep(pd.meal_prep); setRecipes(rd.recipes || []); setLoading(false) })
  }, [params.id])

  const savePrep = (updated: MealPrep) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      await fetch('/api/meal-preps/' + params.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
    }, 600)
  }

  const updatePrep = (updated: MealPrep) => { setPrep(updated); savePrep(updated) }

  const addSession = (name: string) => {
    if (!prep) return
    const session: PrepSession = { id: crypto.randomUUID(), name, recipes: [], notes: null }
    updatePrep({ ...prep, sessions: [...prep.sessions, session] })
    setShowAddSession(false)
  }

  const removeSession = (sid: string) => {
    if (!prep) return
    updatePrep({ ...prep, sessions: prep.sessions.filter(s => s.id !== sid) })
  }

  const addRecipeToSession = (sessionId: string, recipe: Recipe | null, freeText?: string) => {
    if (!prep) return
    const entry: MenuRecipeEntry = { id: crypto.randomUUID(), recipe_id: recipe?.id || null, recipe_title: recipe?.title || freeText || '', note: null, is_free_text: !recipe }
    updatePrep({ ...prep, sessions: prep.sessions.map(s => s.id === sessionId ? { ...s, recipes: [...s.recipes, entry] } : s) })
    setShowRecipePicker(null); setPickerSearch('')
  }

  const removeFromSession = (sessionId: string, entryId: string) => {
    if (!prep) return
    updatePrep({ ...prep, sessions: prep.sessions.map(s => s.id === sessionId ? { ...s, recipes: s.recipes.filter(r => r.id !== entryId) } : s) })
  }

  const updateSessionNotes = (sessionId: string, notes: string) => {
    if (!prep) return
    updatePrep({ ...prep, sessions: prep.sessions.map(s => s.id === sessionId ? { ...s, notes: notes || null } : s) })
  }

  const buildShoppingList = () => {
    if (!prep) return []
    const items: Map<string, { qty: string, breakdown: { recipe_title: string, qty: string }[] }> = new Map()
    prep.sessions.forEach(session => {
      session.recipes.forEach(entry => {
        if (entry.is_free_text) return
        const recipe = recipes.find(r => r.id === entry.recipe_id)
        if (!recipe) return
        recipe.ingredient_groups.forEach(g => {
          g.ingredients.forEach(ing => {
            const key = ing.name.toLowerCase().trim()
            const existing = items.get(key)
            if (existing) existing.breakdown.push({ recipe_title: entry.recipe_title, qty: ing.qty })
            else items.set(key, { qty: ing.qty, breakdown: [{ recipe_title: entry.recipe_title, qty: ing.qty }] })
          })
        })
      })
    })
    return Array.from(items.entries()).map(([name, data]) => ({ id: name, name, total_qty: data.breakdown.length > 1 ? 'see breakdown' : data.qty, breakdown: data.breakdown }))
  }

  const shoppingList = buildShoppingList()

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>
  if (!prep) return <div style={{ textAlign: 'center', padding: 80 }}><Link href="/" className="btn btn-ghost">← Back</Link></div>

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px 80px' }}>
      <div style={{ padding: '20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <Link href="/" className="btn btn-ghost btn-sm">← Library</Link>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => window.print()} className="btn btn-ghost btn-sm">🖨 Print</button>
          <button onClick={async () => { if (!confirm('Delete this meal prep?')) return; await fetch('/api/meal-preps/' + params.id, { method: 'DELETE' }); router.push('/') }} className="btn btn-danger btn-sm">🗑 Delete</button>
        </div>
      </div>

      {/* TITLE */}
      <div style={{ padding: '0 0 20px', borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {editingName
          ? <input className="input" style={{ fontSize: 28, fontFamily: 'Playfair Display, serif', fontWeight: 700 }} defaultValue={prep.name} autoFocus onBlur={e => { updatePrep({ ...prep, name: e.target.value }); setEditingName(false) }} onKeyDown={e => { if (e.key === 'Enter') { updatePrep({ ...prep, name: (e.target as HTMLInputElement).value }); setEditingName(false) } }} />
          : <h1 onClick={() => setEditingName(true)} style={{ fontFamily: 'Playfair Display, serif', fontSize: 32, fontWeight: 700, cursor: 'text', marginBottom: 10 }}>{prep.name} <span style={{ fontSize: 16, color: 'var(--muted)', fontFamily: 'DM Sans, sans-serif', fontWeight: 400 }}>✏️</span></h1>
        }
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input className="input" style={{ width: 180 }} placeholder="Date (e.g. Week of April 28)" value={prep.date || ''} onChange={e => updatePrep({ ...prep, date: e.target.value || null })} />
          <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Notes (optional)" value={prep.notes || ''} onChange={e => updatePrep({ ...prep, notes: e.target.value || null })} />
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', background: 'var(--tag)', borderRadius: 10, padding: 3, gap: 2, marginBottom: 24, width: 'fit-content' }}>
        {(['prep', 'shopping'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, background: activeTab === t ? 'var(--card)' : 'transparent', color: activeTab === t ? 'var(--ink)' : 'var(--muted)', boxShadow: activeTab === t ? '0 1px 4px rgba(0,0,0,.08)' : 'none', transition: 'all .15s' }}>
            {t === 'prep' ? '🥘 Prep Plan' : '🛒 Shopping List'}
          </button>
        ))}
      </div>

      {/* PREP TAB */}
      {activeTab === 'prep' && (
        <div>
          {prep.sessions.map((session, si) => (
            <div key={session.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--tag)' }}>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 600 }}>Session {si + 1} — {session.name}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowRecipePicker(session.id)} style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>+ Add recipe</button>
                  <button onClick={() => removeSession(session.id)} style={{ fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                </div>
              </div>

              {session.recipes.map(entry => (
                <div key={entry.id} style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  {entry.recipe_id
                    ? <Link href={'/recipe/' + entry.recipe_id} style={{ flex: 1, textDecoration: 'none', color: 'var(--ink)', fontSize: 14, fontWeight: 500 }}>{entry.recipe_title}</Link>
                    : <span style={{ flex: 1, fontSize: 14, color: 'var(--muted)', fontStyle: 'italic' }}>{entry.recipe_title}</span>
                  }
                  <button onClick={() => removeFromSession(session.id, entry.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14 }}>✕</button>
                </div>
              ))}

              {/* RECIPE PICKER */}
              {showRecipePicker === session.id && (
                <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', background: 'var(--cream)' }}>
                  <input className="input" style={{ marginBottom: 10 }} placeholder="Search library or type a recipe name..." value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} autoFocus />
                  <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {recipes.filter(r => !pickerSearch || r.title.toLowerCase().includes(pickerSearch.toLowerCase())).slice(0, 8).map(r => (
                      <button key={r.id} onClick={() => addRecipeToSession(session.id, r)} style={{ padding: '8px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, textAlign: 'left', color: 'var(--ink)' }}>
                        {r.title} <span style={{ color: 'var(--muted)', fontSize: 11 }}>— {r.source}</span>
                      </button>
                    ))}
                    {pickerSearch && (
                      <button onClick={() => addRecipeToSession(session.id, null, pickerSearch)} style={{ padding: '8px 12px', background: 'var(--accent-bg)', border: '1px solid var(--accent)', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, textAlign: 'left', color: 'var(--accent)' }}>
                        + Add "{pickerSearch}" as free text
                      </button>
                    )}
                  </div>
                  <button onClick={() => { setShowRecipePicker(null); setPickerSearch('') }} className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}>Cancel</button>
                </div>
              )}

              {/* SESSION NOTES */}
              <div style={{ padding: '10px 18px' }}>
                <textarea className="input" style={{ minHeight: 48, fontSize: 13 }} placeholder="Session notes (e.g. double the chicken, refrigerate overnight)..." value={session.notes || ''} onChange={e => updateSessionNotes(session.id, e.target.value)} />
              </div>
            </div>
          ))}

          {/* ADD SESSION */}
          <div style={{ marginTop: 8 }}>
            {showAddSession ? (
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 10 }}>Session name:</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input" placeholder="e.g. Sunday Batch Cook, Wednesday Top-Up" onKeyDown={e => { if (e.key === 'Enter') addSession((e.target as HTMLInputElement).value) }} autoFocus />
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowAddSession(false)}>Cancel</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {['Sunday Batch Cook', 'Monday Prep', 'Midweek Top-Up', 'Weekend Cook'].map(name => (
                    <button key={name} onClick={() => addSession(name)} style={{ padding: '5px 12px', background: 'var(--tag)', border: '1px solid var(--border)', borderRadius: 50, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: 'var(--ink)' }}>{name}</button>
                  ))}
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddSession(true)} style={{ width: '100%', padding: '14px', background: 'none', border: '2px dashed var(--border)', borderRadius: 16, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>
                + Add Prep Session
              </button>
            )}
          </div>
        </div>
      )}

      {/* SHOPPING TAB */}
      {activeTab === 'shopping' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{shoppingList.length} ingredients · {checkedItems.size} checked off</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {checkedItems.size > 0 && <button onClick={() => setCheckedItems(new Set())} className="btn btn-ghost btn-sm">Reset</button>}
              <button onClick={() => window.print()} className="btn btn-ghost btn-sm">🖨 Print</button>
            </div>
          </div>
          {shoppingList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p style={{ color: 'var(--muted)', fontSize: 15 }}>Add recipes to your sessions to generate a shopping list.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {shoppingList.sort((a, b) => {
                const ac = checkedItems.has(a.id), bc = checkedItems.has(b.id)
                if (ac !== bc) return ac ? 1 : -1
                return a.name.localeCompare(b.name)
              }).map(item => (
                <div key={item.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', opacity: checkedItems.has(item.id) ? .5 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="checkbox" checked={checkedItems.has(item.id)} onChange={() => { const n = new Set(checkedItems); n.has(item.id) ? n.delete(item.id) : n.add(item.id); setCheckedItems(n) }} style={{ accentColor: 'var(--accent)', width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
                    <span style={{ fontWeight: 500, fontSize: 14, flex: 1, textDecoration: checkedItems.has(item.id) ? 'line-through' : 'none' }}>{item.name}</span>
                    <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>{item.total_qty}</span>
                  </div>
                  {item.breakdown.length > 1 && (
                    <div style={{ marginTop: 6, paddingLeft: 26 }}>
                      {item.breakdown.map((b, i) => <div key={i} style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}><span style={{ fontWeight: 500, color: 'var(--accent)' }}>{b.qty}</span> — {b.recipe_title}</div>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
