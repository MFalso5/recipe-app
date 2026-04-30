'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, MenuCourse, MenuRecipeEntry, MakeAheadEntry, Recipe, DEFAULT_COURSES, MAKE_AHEAD_TIMEFRAMES } from '@/lib/types'
import Link from 'next/link'

export default function MenuPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [menu, setMenu] = useState<Menu | null>(null)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'menu' | 'shopping'>('menu')
  const [editingName, setEditingName] = useState(false)
  const [showAddCourse, setShowAddCourse] = useState(false)
  const [showRecipePicker, setShowRecipePicker] = useState<string | null>(null)
  const [pickerSearch, setPickerSearch] = useState('')
  const [showMakeAheadForm, setShowMakeAheadForm] = useState(false)
  const [makeAheadTask, setMakeAheadTask] = useState('')
  const [makeAheadTimeframe, setMakeAheadTimeframe] = useState('1 day before')
  const [customTimeframe, setCustomTimeframe] = useState('')
  const [shoppingView, setShoppingView] = useState<'category' | 'course'>('category')
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const [printStyle, setPrintStyle] = useState<'simple' | 'elegant' | null>(null)
  const saveTimeout = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/menus/' + params.id).then(r => r.json()),
      fetch('/api/recipes').then(r => r.json())
    ]).then(([md, rd]) => {
      setMenu(md.menu)
      setRecipes(rd.recipes || [])
      setLoading(false)
    })
  }, [params.id])

  const saveMenu = (updated: Menu) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    setSaving(true)
    saveTimeout.current = setTimeout(async () => {
      await fetch('/api/menus/' + params.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
      setSaving(false)
    }, 600)
  }

  const updateMenu = (updated: Menu) => { setMenu(updated); saveMenu(updated) }

  const addCourse = (name: string) => {
    if (!menu) return
    const course: MenuCourse = { id: crypto.randomUUID(), name, recipes: [] }
    updateMenu({ ...menu, courses: [...menu.courses, course] })
    setShowAddCourse(false)
  }

  const removeCourse = (courseId: string) => {
    if (!menu) return
    updateMenu({ ...menu, courses: menu.courses.filter(c => c.id !== courseId) })
  }

  const addRecipeToCourse = (courseId: string, recipe: Recipe | null, freeText?: string) => {
    if (!menu) return
    const entry: MenuRecipeEntry = {
      id: crypto.randomUUID(),
      recipe_id: recipe?.id || null,
      recipe_title: recipe?.title || freeText || '',
      note: null,
      is_free_text: !recipe
    }
    updateMenu({
      ...menu,
      courses: menu.courses.map(c => c.id === courseId ? { ...c, recipes: [...c.recipes, entry] } : c)
    })
    setShowRecipePicker(null)
    setPickerSearch('')
  }

  const removeFromCourse = (courseId: string, entryId: string) => {
    if (!menu) return
    updateMenu({ ...menu, courses: menu.courses.map(c => c.id === courseId ? { ...c, recipes: c.recipes.filter(r => r.id !== entryId) } : c) })
  }

  const addMakeAhead = () => {
    if (!menu || !makeAheadTask.trim()) return
    const entry: MakeAheadEntry = {
      id: crypto.randomUUID(),
      task: makeAheadTask,
      timeframe: makeAheadTimeframe === 'Custom' ? customTimeframe : makeAheadTimeframe,
      recipe_id: null, recipe_title: null, confirmed: true
    }
    updateMenu({ ...menu, make_ahead: [...menu.make_ahead, entry] })
    setMakeAheadTask(''); setShowMakeAheadForm(false); setCustomTimeframe('')
  }

  const removeMakeAhead = (id: string) => {
    if (!menu) return
    updateMenu({ ...menu, make_ahead: menu.make_ahead.filter(m => m.id !== id) })
  }

  const deleteMenu = async () => {
    if (!confirm('Delete this menu?')) return
    await fetch('/api/menus/' + params.id, { method: 'DELETE' })
    router.push('/')
  }

  // Build shopping list
  const buildShoppingList = () => {
    if (!menu) return []
    const items: Map<string, { qty: string, breakdown: { recipe_title: string, qty: string }[] }> = new Map()
    menu.courses.forEach(course => {
      course.recipes.forEach(entry => {
        if (entry.is_free_text) return
        const recipe = recipes.find(r => r.id === entry.recipe_id)
        if (!recipe) return
        recipe.ingredient_groups.forEach(g => {
          g.ingredients.forEach(ing => {
            const key = ing.name.toLowerCase().trim()
            const existing = items.get(key)
            if (existing) {
              existing.breakdown.push({ recipe_title: entry.recipe_title, qty: ing.qty })
            } else {
              items.set(key, { qty: ing.qty, breakdown: [{ recipe_title: entry.recipe_title, qty: ing.qty }] })
            }
          })
        })
      })
    })
    return Array.from(items.entries()).map(([name, data]) => ({
      id: name, name, total_qty: data.breakdown.length > 1 ? 'see breakdown' : data.qty, breakdown: data.breakdown
    }))
  }

  const shoppingList = buildShoppingList()

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>
  if (!menu) return <div style={{ textAlign: 'center', padding: 80 }}><p>Menu not found.</p><Link href="/" className="btn btn-ghost" style={{ marginTop: 16, display: 'inline-flex' }}>Back</Link></div>

  const populatedCourses = menu.courses.filter(c => c.recipes.length > 0)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px 80px' }}>

      {/* HEADER */}
      <div style={{ padding: '20px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <Link href="/" className="btn btn-ghost btn-sm">← Library</Link>
        <div style={{ display: 'flex', gap: 8 }}>
          {saving && <span style={{ fontSize: 13, color: 'var(--muted)', alignSelf: 'center' }}>Saving...</span>}
          <button onClick={() => setPrintStyle('simple')} className="btn btn-ghost btn-sm">🖨 Print List</button>
          <button onClick={() => setPrintStyle('elegant')} className="btn btn-ghost btn-sm">🎨 Print Card</button>
          <button onClick={deleteMenu} className="btn btn-danger btn-sm">🗑 Delete</button>
        </div>
      </div>

      {/* MENU TITLE */}
      <div style={{ padding: '16px 0 20px', borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {editingName ? (
          <input className="input" style={{ fontSize: 28, fontFamily: 'Playfair Display, serif', fontWeight: 700, padding: '4px 8px', marginBottom: 8 }}
            defaultValue={menu.name} autoFocus
            onBlur={e => { updateMenu({ ...menu, name: e.target.value }); setEditingName(false) }}
            onKeyDown={e => { if (e.key === 'Enter') { updateMenu({ ...menu, name: (e.target as HTMLInputElement).value }); setEditingName(false) } }} />
        ) : (
          <h1 onClick={() => setEditingName(true)} style={{ fontFamily: 'Playfair Display, serif', fontSize: 32, fontWeight: 700, cursor: 'text', marginBottom: 8 }}>
            {menu.name} <span style={{ fontSize: 16, color: 'var(--muted)', fontFamily: 'DM Sans, sans-serif', fontWeight: 400 }}>✏️</span>
          </h1>
        )}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input className="input" style={{ width: 180 }} placeholder="Date (e.g. April 20, 2026)" value={menu.date || ''}
            onChange={e => updateMenu({ ...menu, date: e.target.value || null })} />
          <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Notes (optional)" value={menu.notes || ''}
            onChange={e => updateMenu({ ...menu, notes: e.target.value || null })} />
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', background: 'var(--tag)', borderRadius: 10, padding: 3, gap: 2, marginBottom: 24, width: 'fit-content' }}>
        {(['menu', 'shopping'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, background: activeTab === t ? 'var(--card)' : 'transparent', color: activeTab === t ? 'var(--ink)' : 'var(--muted)', boxShadow: activeTab === t ? '0 1px 4px rgba(0,0,0,.08)' : 'none', transition: 'all .15s' }}>
            {t === 'menu' ? '🍽️ Menu' : '🛒 Shopping List'}
          </button>
        ))}
      </div>

      {/* MENU TAB */}
      {activeTab === 'menu' && (
        <div>

          {/* QUICK CAPTURE NOTES */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, marginBottom: 20, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: 'var(--tag)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>📝 Overview & Notes</div>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>auto-saves</span>
            </div>
            <textarea
              style={{ width: '100%', minHeight: 120, padding: '14px 18px', background: 'none', border: 'none', fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'var(--ink)', resize: 'vertical', outline: 'none', lineHeight: 1.7, boxSizing: 'border-box' }}
              placeholder={"Outline your menu ideas here before adding recipes...\n\nExamples:\n• Theme: Italian Easter feast\n• 8-10 guests\n• Want to try the new lamb recipe\n• Ask Maria about her focaccia"}
              value={menu.notes || ''}
              onChange={e => updateMenu({ ...menu, notes: e.target.value || null })}
            />
          </div>

          {/* MAKE AHEAD */}
          <div style={{ background: 'var(--tip)', border: '1px solid var(--tip-border)', borderRadius: 16, padding: '18px 20px', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--tip-text)' }}>📋 Make Ahead</div>
              <button onClick={() => setShowMakeAheadForm(true)} style={{ fontSize: 12, color: 'var(--tip-text)', background: 'none', border: '1px solid var(--tip-border)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>+ Add item</button>
            </div>
            {menu.make_ahead.length === 0 && !showMakeAheadForm && (
              <p style={{ fontSize: 13, color: 'var(--tip-text)', opacity: .7 }}>Add items that need to be prepared in advance — pie crusts, stocks, marinades, etc.</p>
            )}
            {menu.make_ahead.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--tip-border)' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tip-text)', whiteSpace: 'nowrap', minWidth: 110 }}>{item.timeframe}</span>
                <span style={{ fontSize: 13, color: 'var(--ink)', flex: 1 }}>{item.task}</span>
                <button onClick={() => removeMakeAhead(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tip-text)', fontSize: 14, opacity: .6 }}>✕</button>
              </div>
            ))}
            {showMakeAheadForm && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input className="input" placeholder="What needs to be made ahead? (e.g. All-Butter Pie Crust)" value={makeAheadTask} onChange={e => setMakeAheadTask(e.target.value)} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {MAKE_AHEAD_TIMEFRAMES.map(t => (
                    <button key={t} onClick={() => setMakeAheadTimeframe(t)} style={{ padding: '5px 11px', borderRadius: 50, fontSize: 12, fontWeight: 500, background: makeAheadTimeframe === t ? 'var(--tip-border)' : 'transparent', border: '1px solid var(--tip-border)', color: 'var(--tip-text)', cursor: 'pointer', fontFamily: 'inherit' }}>{t}</button>
                  ))}
                </div>
                {makeAheadTimeframe === 'Custom' && (
                  <input className="input" placeholder="Custom timeframe (e.g. 4 hours before)" value={customTimeframe} onChange={e => setCustomTimeframe(e.target.value)} />
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={addMakeAhead} className="btn btn-primary btn-sm">Add</button>
                  <button onClick={() => setShowMakeAheadForm(false)} className="btn btn-ghost btn-sm">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* COURSES */}
          {menu.courses.map(course => (
            <div key={course.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: course.recipes.length > 0 ? '1px solid var(--border)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--tag)' }}>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 600 }}>{course.name}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowRecipePicker(course.id)} style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>+ Add dish</button>
                  <button onClick={() => removeCourse(course.id)} style={{ fontSize: 12, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                </div>
              </div>
              {course.recipes.map(entry => (
                <div key={entry.id} style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  {entry.recipe_id ? (
                    <Link href={'/recipe/' + entry.recipe_id} style={{ flex: 1, textDecoration: 'none', color: 'var(--ink)', fontSize: 14, fontWeight: 500 }}>
                      {entry.recipe_title}
                      {(() => { const r = recipes.find(r => r.id === entry.recipe_id); return r?.made ? <span style={{ fontSize: 11, color: 'var(--green)', marginLeft: 8 }}>✓ made before</span> : <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>first time</span> })()}
                    </Link>
                  ) : (
                    <span style={{ flex: 1, fontSize: 14, color: 'var(--muted)', fontStyle: 'italic' }}>{entry.recipe_title}</span>
                  )}
                  <button onClick={() => removeFromCourse(course.id, entry.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14 }}>✕</button>
                </div>
              ))}

              {/* RECIPE PICKER */}
              {showRecipePicker === course.id && (
                <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', background: 'var(--cream)' }}>
                  <input className="input" style={{ marginBottom: 10 }} placeholder="Search library or type a dish name..." value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} autoFocus />
                  <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {recipes.filter(r => !pickerSearch || r.title.toLowerCase().includes(pickerSearch.toLowerCase())).slice(0, 8).map(r => (
                      <button key={r.id} onClick={() => addRecipeToCourse(course.id, r)} style={{ padding: '8px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, textAlign: 'left', color: 'var(--ink)' }}>
                        {r.title} <span style={{ color: 'var(--muted)', fontSize: 11 }}>— {r.source}</span>
                      </button>
                    ))}
                    {pickerSearch && (
                      <button onClick={() => addRecipeToCourse(course.id, null, pickerSearch)} style={{ padding: '8px 12px', background: 'var(--accent-bg)', border: '1px solid var(--accent)', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, textAlign: 'left', color: 'var(--accent)' }}>
                        + Add "{pickerSearch}" as a free-text dish
                      </button>
                    )}
                  </div>
                  <button onClick={() => { setShowRecipePicker(null); setPickerSearch('') }} className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}>Cancel</button>
                </div>
              )}
            </div>
          ))}

          {/* ADD COURSE */}
          <div style={{ marginTop: 8 }}>
            {showAddCourse ? (
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 10 }}>Choose a course or type a custom name:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {DEFAULT_COURSES.filter(dc => !menu.courses.find(c => c.name === dc)).map(dc => (
                    <button key={dc} onClick={() => addCourse(dc)} style={{ padding: '6px 14px', background: 'var(--tag)', border: '1px solid var(--border)', borderRadius: 50, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)' }}>{dc}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input" placeholder="Custom course name..." onKeyDown={e => { if (e.key === 'Enter') addCourse((e.target as HTMLInputElement).value) }} autoFocus />
                  <button onClick={() => setShowAddCourse(false)} className="btn btn-ghost btn-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddCourse(true)} style={{ width: '100%', padding: '14px', background: 'none', border: '2px dashed var(--border)', borderRadius: 16, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>
                + Add Course
              </button>
            )}
          </div>
        </div>
      )}

      {/* SHOPPING LIST TAB */}
      {activeTab === 'shopping' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', background: 'var(--tag)', borderRadius: 10, padding: 3, gap: 2 }}>
              {(['category', 'course'] as const).map(t => (
                <button key={t} onClick={() => setShoppingView(t)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, background: shoppingView === t ? 'var(--card)' : 'transparent', color: shoppingView === t ? 'var(--ink)' : 'var(--muted)', boxShadow: shoppingView === t ? '0 1px 4px rgba(0,0,0,.08)' : 'none', transition: 'all .15s' }}>
                  {t === 'category' ? 'By Category' : 'By Course'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {checkedItems.size > 0 && <button onClick={() => setCheckedItems(new Set())} className="btn btn-ghost btn-sm">Reset</button>}
              <button onClick={() => window.print()} className="btn btn-ghost btn-sm">🖨 Print</button>
            </div>
          </div>

          {shoppingList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p style={{ color: 'var(--muted)', fontSize: 15 }}>Add recipes to your menu courses to generate a shopping list.</p>
            </div>
          ) : shoppingView === 'category' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>{shoppingList.length} ingredients · {checkedItems.size} checked off</div>
              {shoppingList.sort((a, b) => {
                const aChecked = checkedItems.has(a.id)
                const bChecked = checkedItems.has(b.id)
                if (aChecked !== bChecked) return aChecked ? 1 : -1
                return a.name.localeCompare(b.name)
              }).map(item => (
                <ShoppingItem key={item.id} item={item} checked={checkedItems.has(item.id)} onToggle={() => {
                  const next = new Set(checkedItems)
                  next.has(item.id) ? next.delete(item.id) : next.add(item.id)
                  setCheckedItems(next)
                }} />
              ))}
            </div>
          ) : (
            <div>
              {menu.courses.filter(c => c.recipes.filter(e => !e.is_free_text).length > 0).map(course => {
                const courseItems: typeof shoppingList = []
                course.recipes.forEach(entry => {
                  if (entry.is_free_text) return
                  const recipe = recipes.find(r => r.id === entry.recipe_id)
                  if (!recipe) return
                  recipe.ingredient_groups.forEach(g => {
                    g.ingredients.forEach(ing => {
                      courseItems.push({ id: course.id + '-' + ing.name, name: ing.name, total_qty: ing.qty, breakdown: [{ recipe_title: entry.recipe_title, qty: ing.qty }] })
                    })
                  })
                })
                return (
                  <div key={course.id} style={{ marginBottom: 20 }}>
                    <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 600, marginBottom: 10, paddingBottom: 6, borderBottom: '2px solid var(--border)' }}>{course.name}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {courseItems.map(item => (
                        <ShoppingItem key={item.id} item={item} checked={checkedItems.has(item.id)} onToggle={() => {
                          const next = new Set(checkedItems)
                          next.has(item.id) ? next.delete(item.id) : next.add(item.id)
                          setCheckedItems(next)
                        }} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* PRINT OVERLAY */}
      {printStyle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setPrintStyle(null)}>
          <div style={{ background: 'var(--card)', borderRadius: 20, padding: 32, maxWidth: 600, width: '90%' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, marginBottom: 8 }}>{menu.name}</h2>
            {menu.date && <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>{menu.date}</p>}
            {printStyle === 'elegant' && (
              <div style={{ textAlign: 'center', borderTop: '2px solid var(--border)', borderBottom: '2px solid var(--border)', padding: '20px 0', marginBottom: 20 }}>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)' }}>Menu</div>
              </div>
            )}
            {populatedCourses.map(course => (
              <div key={course.id} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: printStyle === 'elegant' ? 11 : 13, fontWeight: 600, letterSpacing: printStyle === 'elegant' ? 2 : .5, textTransform: 'uppercase', color: printStyle === 'elegant' ? 'var(--muted)' : 'var(--accent)', marginBottom: 6 }}>{course.name}</div>
                {course.recipes.map(e => (
                  <div key={e.id} style={{ fontSize: printStyle === 'elegant' ? 16 : 14, fontFamily: printStyle === 'elegant' ? 'Playfair Display, serif' : 'inherit', marginBottom: printStyle === 'elegant' ? 6 : 3, paddingLeft: printStyle === 'simple' ? 12 : 0 }}>
                    {printStyle === 'simple' && '• '}{e.recipe_title}
                  </div>
                ))}
              </div>
            ))}
            {menu.make_ahead.length > 0 && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Make Ahead</div>
                {menu.make_ahead.map(m => (
                  <div key={m.id} style={{ fontSize: 13, marginBottom: 4 }}><strong>{m.timeframe}:</strong> {m.task}</div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => window.print()} className="btn btn-primary">🖨 Print</button>
              <button onClick={() => setPrintStyle(null)} className="btn btn-ghost">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ShoppingItem({ item, checked, onToggle }: { item: { id: string, name: string, total_qty: string, breakdown: { recipe_title: string, qty: string }[] }, checked: boolean, onToggle: () => void }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', opacity: checked ? .5 : 1, transition: 'opacity .15s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input type="checkbox" checked={checked} onChange={onToggle} style={{ accentColor: 'var(--accent)', width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
        <span style={{ fontWeight: 500, fontSize: 14, flex: 1, textDecoration: checked ? 'line-through' : 'none' }}>{item.name}</span>
        <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>{item.total_qty}</span>
        {item.breakdown.length > 1 && (
          <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 12, fontFamily: 'inherit' }}>
            {expanded ? '▲' : '▼'} {item.breakdown.length} recipes
          </button>
        )}
      </div>
      {expanded && item.breakdown.length > 1 && (
        <div style={{ marginTop: 8, paddingLeft: 26 }}>
          {item.breakdown.map((b, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 3 }}>
              <span style={{ fontWeight: 500, color: 'var(--accent)' }}>{b.qty}</span> — {b.recipe_title}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
