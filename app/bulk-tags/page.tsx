'use client'
import * as React from 'react'
import { useEffect, useState } from 'react'
import { Recipe } from '@/lib/types'
import Link from 'next/link'

const TIER1 = ['Pie','Cake','Cookies','Bread','Pasta','Soup','Salad','Appetizer','Side','Main','Sauce','Drink','Breakfast','Snack']
const TIER2 = ['Sweet','Savory']
const TIER3 = ['Italian','French','American','Greek','Asian','Mexican','Spanish','Middle Eastern','Indian','Japanese','Chinese','Thai','Mediterranean','Holiday','Weekend','Quick','Comfort Food','Seasonal','Summer','Winter','Spring','Fall']


function CustomTagInput({ onAdd }: { onAdd: (tag: string) => void }) {
  const [editing, setEditing] = React.useState(false)
  const [value, setValue] = React.useState('')

  if (!editing) return (
    <button onClick={() => setEditing(true)} style={{
      padding: '4px 11px', borderRadius: 50, fontSize: 12, fontWeight: 500,
      background: 'none', border: '1.5px dashed var(--border)',
      color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit'
    }}>+ custom tag</button>
  )

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && value.trim()) { onAdd(value.trim()); setValue(''); setEditing(false) }
          if (e.key === 'Escape') { setValue(''); setEditing(false) }
        }}
        placeholder="Tag name..."
        style={{ width: 100, padding: '3px 8px', borderRadius: 50, border: '1.5px solid var(--accent)', fontSize: 12, fontFamily: 'inherit', outline: 'none', background: 'var(--accent-bg)', color: 'var(--accent)' }}
      />
      <button onClick={() => { if (value.trim()) { onAdd(value.trim()); setValue('') } setEditing(false) }}
        style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 50, padding: '3px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Add</button>
      <button onClick={() => { setValue(''); setEditing(false) }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14, padding: '0 2px' }}>✕</button>
    </span>
  )
}

export default function BulkTagsPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [filterMissing, setFilterMissing] = useState(false)

  useEffect(() => {
    fetch('/api/recipes').then(r => r.json()).then(d => {
      setRecipes(d.recipes || [])
      setLoading(false)
    })
  }, [])

  const hasTier1 = (r: Recipe) => (r.tags || []).some(t => TIER1.includes(t))
  const hasTier2 = (r: Recipe) => (r.tags || []).some(t => TIER2.includes(t))
  const isMissingTags = (r: Recipe) => !hasTier1(r) || !hasTier2(r)

  const filtered = recipes.filter(r => {
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.source?.toLowerCase().includes(search.toLowerCase())
    const matchMissing = !filterMissing || isMissingTags(r)
    return matchSearch && matchMissing
  })

  const missingCount = recipes.filter(isMissingTags).length

  const toggleTag = (recipeId: string, tag: string) => {
    setRecipes(prev => prev.map(r => {
      if (r.id !== recipeId) return r
      const current = r.tags || []
      // For Tier 1: replace any existing Tier 1 tag
      if (TIER1.includes(tag)) {
        const withoutTier1 = current.filter(t => !TIER1.includes(t))
        return { ...r, tags: current.includes(tag) ? withoutTier1 : [...withoutTier1, tag] }
      }
      // For Tier 2: replace any existing Tier 2 tag
      if (TIER2.includes(tag)) {
        const withoutTier2 = current.filter(t => !TIER2.includes(t))
        return { ...r, tags: current.includes(tag) ? withoutTier2 : [...withoutTier2, tag] }
      }
      // For Tier 3: toggle freely
      return { ...r, tags: current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag] }
    }))
  }

  const saveRecipe = async (recipe: Recipe) => {
    setSaving(prev => new Set(prev).add(recipe.id))
    await fetch('/api/recipes/' + recipe.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recipe)
    })
    setSaving(prev => { const n = new Set(prev); n.delete(recipe.id); return n })
    setSaved(prev => new Set(prev).add(recipe.id))
    setTimeout(() => setSaved(prev => { const n = new Set(prev); n.delete(recipe.id); return n }), 2000)
  }

  const saveAll = async () => {
    for (const r of filtered) await saveRecipe(r)
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 16px 80px' }}>

      {/* HEADER */}
      <div style={{ padding: '24px 0 20px', borderBottom: '1px solid var(--border)', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 700 }}>Bulk Tag Editor</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>
            Update tags across all recipes · {recipes.length} recipes
            {missingCount > 0 && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>· {missingCount} missing required tags</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/" className="btn btn-ghost btn-sm">← Library</Link>
          <button onClick={saveAll} className="btn btn-green btn-sm">✓ Save All Changes</button>
        </div>
      </div>

      {/* TIER LEGEND */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
        <div><span style={{ fontWeight: 600, color: 'var(--accent)' }}>Tier 1</span> <span style={{ color: 'var(--muted)' }}>— Dish type (required, pick one)</span></div>
        <div><span style={{ fontWeight: 600, color: 'var(--green)' }}>Tier 2</span> <span style={{ color: 'var(--muted)' }}>— Sweet or Savory (required, pick one)</span></div>
        <div><span style={{ fontWeight: 600, color: 'var(--muted)' }}>Tier 3</span> <span style={{ color: 'var(--muted)' }}>— Cuisine / character (optional)</span></div>
      </div>

      {/* SEARCH + FILTER */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: .4 }}>🔍</span>
          <input className="input" style={{ paddingLeft: 36 }} placeholder="Search recipes..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setFilterMissing(!filterMissing)} style={{
          padding: '10px 16px', borderRadius: 10, border: '1px solid ' + (filterMissing ? 'var(--accent)' : 'var(--border)'),
          background: filterMissing ? 'var(--accent-bg)' : 'var(--card)', color: filterMissing ? 'var(--accent)' : 'var(--muted)',
          cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500
        }}>
          {filterMissing ? '✓ ' : ''}Show missing tags only {missingCount > 0 && `(${missingCount})`}
        </button>
      </div>

      {/* RECIPE LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(recipe => {
          const t1 = (recipe.tags || []).find(t => TIER1.includes(t))
          const t2 = (recipe.tags || []).find(t => TIER2.includes(t))
          const t3 = (recipe.tags || []).filter(t => TIER3.includes(t))
          const missing = !t1 || !t2

          return (
            <div key={recipe.id} style={{
              background: 'var(--card)', border: '1px solid ' + (missing ? '#FECACA' : 'var(--border)'),
              borderRadius: 14, overflow: 'hidden'
            }}>
              {/* RECIPE HEADER */}
              <div style={{ padding: '12px 16px', background: missing ? 'var(--red-bg)' : 'var(--tag)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recipe.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {recipe.source && <span>📖 {recipe.source}</span>}
                    {recipe.page_number && <span> · {recipe.page_number}</span>}
                    {missing && <span style={{ color: 'var(--red)', marginLeft: 8 }}>⚠️ Missing {!t1 ? 'type' : ''}{!t1 && !t2 ? ' + ' : ''}{!t2 ? 'sweet/savory' : ''}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  {/* CURRENT TAGS SUMMARY */}
                  {t1 && <span style={{ padding: '2px 8px', borderRadius: 50, fontSize: 11, fontWeight: 600, background: 'var(--accent-bg)', color: 'var(--accent)' }}>{t1}</span>}
                  {t2 && <span style={{ padding: '2px 8px', borderRadius: 50, fontSize: 11, fontWeight: 600, background: 'var(--green-bg)', color: 'var(--green)' }}>{t2}</span>}
                  <button onClick={() => saveRecipe(recipe)} className="btn btn-ghost btn-sm"
                    style={{ background: saved.has(recipe.id) ? 'var(--green-bg)' : undefined, color: saved.has(recipe.id) ? 'var(--green)' : undefined }}>
                    {saving.has(recipe.id) ? '⟳' : saved.has(recipe.id) ? '✓ Saved' : 'Save'}
                  </button>
                </div>
              </div>

              {/* TAG EDITOR */}
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* TIER 1 */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 7 }}>Tier 1 — Type</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {TIER1.map(tag => {
                      const active = (recipe.tags || []).includes(tag)
                      return (
                        <button key={tag} onClick={() => toggleTag(recipe.id, tag)} style={{
                          padding: '4px 11px', borderRadius: 50, fontSize: 12, fontWeight: 500,
                          background: active ? 'var(--accent-bg)' : 'var(--cream)',
                          border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
                          color: active ? 'var(--accent)' : 'var(--muted)',
                          cursor: 'pointer', fontFamily: 'inherit'
                        }}>{tag}</button>
                      )
                    })}
                  </div>
                </div>

                {/* TIER 2 */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--green)', marginBottom: 7 }}>Tier 2 — Sweet or Savory</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {TIER2.map(tag => {
                      const active = (recipe.tags || []).includes(tag)
                      return (
                        <button key={tag} onClick={() => toggleTag(recipe.id, tag)} style={{
                          padding: '4px 14px', borderRadius: 50, fontSize: 12, fontWeight: 500,
                          background: active ? 'var(--green-bg)' : 'var(--cream)',
                          border: '1px solid ' + (active ? 'var(--green)' : 'var(--border)'),
                          color: active ? 'var(--green)' : 'var(--muted)',
                          cursor: 'pointer', fontFamily: 'inherit'
                        }}>{tag}</button>
                      )
                    })}
                  </div>
                </div>

                {/* TIER 3 */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 7 }}>Tier 3 — Cuisine & Character <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {TIER3.map(tag => {
                      const active = (recipe.tags || []).includes(tag)
                      return (
                        <button key={tag} onClick={() => toggleTag(recipe.id, tag)} style={{
                          padding: '4px 11px', borderRadius: 50, fontSize: 12, fontWeight: 500,
                          background: active ? 'var(--tag)' : 'var(--cream)',
                          border: '1px solid ' + (active ? 'var(--border)' : 'transparent'),
                          color: active ? 'var(--ink)' : 'var(--muted)',
                          cursor: 'pointer', fontFamily: 'inherit'
                        }}>{tag}</button>
                      )
                    })}
                    {/* Custom tags not in any tier */}
                    {(recipe.tags || []).filter(t => !TIER1.includes(t) && !TIER2.includes(t) && !TIER3.includes(t)).map(tag => (
                      <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 11px', borderRadius: 50, fontSize: 12, background: 'var(--tag)', border: '1px solid var(--border)', color: 'var(--ink)' }}>
                        {tag}
                        <button onClick={() => toggleTag(recipe.id, tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
                      </span>
                    ))}
                    {/* Add custom tag */}
                    <CustomTagInput onAdd={(tag) => {
                      if (!tag || (recipe.tags || []).includes(tag)) return
                      setRecipes(prev => prev.map(r => r.id === recipe.id ? { ...r, tags: [...(r.tags || []), tag] } : r))
                    }} />
                  </div>
                </div>

              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ color: 'var(--muted)', fontSize: 15 }}>No recipes match your search.</p>
        </div>
      )}
    </div>
  )
}
