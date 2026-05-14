'use client'
import * as React from 'react'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Recipe, Menu, Cookbook, DIETARY_TAGS } from '@/lib/types'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type ViewMode = 'all' | 'collections'

interface CollectionSummary {
  name: string
  source_type: 'cookbook' | 'website' | 'other'
  author: string | null
  cover_url: string | null
  recipe_count: number
  made_count: number
  image_urls: string[]
}

export default function Home() {
  const router = useRouter()

  // Lightweight collection summaries — loaded immediately on mount
  const [collectionSummaries, setCollectionSummaries] = useState<CollectionSummary[]>([])
  const [summariesLoading, setSummariesLoading] = useState(true)

  // Full recipe data — lazy loaded on demand
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([])
  const [allRecipesLoaded, setAllRecipesLoaded] = useState(false)
  const [allRecipesLoading, setAllRecipesLoading] = useState(false)

  const [menus, setMenus] = useState<Menu[]>([])
  const [cookbooks, setCookbooks] = useState<Cookbook[]>([])
  const [editingCookbook, setEditingCookbook] = useState<string | null>(null)
  const [cookbookSort, setCookbookSort] = useState<'author' | 'title'>('title')
  const [view, setView] = useState<ViewMode>('collections')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('recent')
  const [filterOpen, setFilterOpen] = useState(false)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [smartSearch, setSmartSearch] = useState('')
  const [smartResults, setSmartResults] = useState<string[] | null>(null)
  const [smartLoading, setSmartLoading] = useState(false)
  const [smartMode, setSmartMode] = useState(false)
  const [filters, setFilters] = useState<{ dietary: string[], sources: string[], tags: string[], made: string, ingredients: string[] }>({
    dietary: [], sources: [], tags: [], made: 'all', ingredients: []
  })
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [activeCollection, setActiveCollection] = useState<CollectionSummary | null>(null)
  const [threshold, setThreshold] = useState(3)
  const filterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('collection_threshold')
    if (saved) setThreshold(parseInt(saved) || 3)
  }, [])

  // Fast initial load — collections + cookbooks only
  useEffect(() => {
    Promise.all([
      fetch('/api/collections').then(r => r.json()),
      fetch('/api/menus').then(r => r.json()),
      fetch('/api/cookbooks').then(r => r.json())
    ]).then(([cd, md, ckd]) => {
      setCollectionSummaries(cd.collections || [])
      setMenus(md.menus || [])
      setCookbooks(ckd.cookbooks || [])
      setSummariesLoading(false)
    })
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false)
    }
    if (filterOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [filterOpen])

  // Lazy load all recipes — no-op if already loaded
  const loadRecipes = useCallback(() => {
    if (allRecipesLoaded || allRecipesLoading) return
    setAllRecipesLoading(true)
    fetch('/api/recipes').then(r => r.json()).then(d => {
      setAllRecipes(d.recipes || [])
      setAllRecipesLoaded(true)
      setAllRecipesLoading(false)
    })
  }, [allRecipesLoaded, allRecipesLoading])

  // Derived collection groupings from summaries
  const cookbookSummaries = collectionSummaries.filter(c => c.source_type === 'cookbook' && c.recipe_count >= threshold)
  const pooledCookbookSummaries = collectionSummaries.filter(c => c.source_type === 'cookbook' && c.recipe_count < threshold)
  const otherCookbooks: CollectionSummary | null = pooledCookbookSummaries.length > 0 ? {
    name: 'Other Cookbooks', source_type: 'cookbook', author: null, cover_url: null,
    recipe_count: pooledCookbookSummaries.reduce((s, c) => s + c.recipe_count, 0),
    made_count: pooledCookbookSummaries.reduce((s, c) => s + c.made_count, 0),
    image_urls: []
  } : null

  const websiteSummaries = collectionSummaries.filter(c => c.source_type !== 'cookbook' && c.recipe_count >= threshold)
  const pooledWebsiteSummaries = collectionSummaries.filter(c => c.source_type !== 'cookbook' && c.recipe_count < threshold)
  const blogsAndSocial: CollectionSummary | null = pooledWebsiteSummaries.length > 0 ? {
    name: 'Blogs & Social', source_type: 'other', author: null, cover_url: null,
    recipe_count: pooledWebsiteSummaries.reduce((s, c) => s + c.recipe_count, 0),
    made_count: pooledWebsiteSummaries.reduce((s, c) => s + c.made_count, 0),
    image_urls: pooledWebsiteSummaries.flatMap(c => c.image_urls).slice(0, 4)
  } : null

  const totalRecipeCount = collectionSummaries.reduce((s, c) => s + c.recipe_count, 0)
  const pooledCookbookSourceNames = pooledCookbookSummaries.map(c => c.name)
  const pooledWebsiteSourceNames = pooledWebsiteSummaries.map(c => c.name)

  // Full recipes for the currently open collection (computed when allRecipes is loaded)
  const activeCollectionRecipes = (() => {
    if (!activeCollection || !allRecipesLoaded) return []
    if (activeCollection.name === 'Other Cookbooks') return allRecipes.filter(r => pooledCookbookSourceNames.includes(r.source || ''))
    if (activeCollection.name === 'Blogs & Social') return allRecipes.filter(r => pooledWebsiteSourceNames.includes(r.source || ''))
    return allRecipes.filter(r => r.source === activeCollection.name)
  })()

  // Filter values — only populated when recipes are loaded
  const allTags = allRecipesLoaded
    ? Array.from(new Set(allRecipes.flatMap(r => (r.tags || []).filter(t => !DIETARY_TAGS.includes(t))))).sort()
    : []
  const allSources = allRecipesLoaded
    ? Array.from(new Set(allRecipes.map(r => r.source).filter(Boolean) as string[])).sort()
    : []
  const activeFilterCount = filters.dietary.length + filters.sources.length + filters.tags.length + filters.ingredients.length + (filters.made !== 'all' ? 1 : 0)

  const toggleFilter = (type: 'dietary' | 'sources' | 'tags', val: string) => {
    setFilters(prev => ({ ...prev, [type]: prev[type].includes(val) ? prev[type].filter(v => v !== val) : [...prev[type], val] }))
  }
  const clearFilters = () => { setFilters({ dietary: [], sources: [], tags: [], made: 'all', ingredients: [] }); setIngredientSearch('') }

  const runSmartSearch = async () => {
    if (!smartSearch.trim()) return
    setSmartLoading(true)
    loadRecipes()
    try {
      const res = await fetch('/api/smart-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: smartSearch }) })
      const data = await res.json()
      setSmartResults(data.ids || [])
    } catch { setSmartResults([]) }
    setSmartLoading(false)
  }

  const clearSmartSearch = () => { setSmartResults(null); setSmartSearch(''); setSmartMode(false) }

  const filterRecipesWithFilters = (list: Recipe[]) => list.filter(r => {
    if (favoritesOnly && !r.favorited) return false
    const q = search.toLowerCase()
    const matchSearch = !q || r.title.toLowerCase().includes(q) || (r.source || '').toLowerCase().includes(q) ||
      (r.tags || []).some(t => t.toLowerCase().includes(q)) ||
      r.ingredient_groups?.some(g => g.ingredients.some(i => i.name.toLowerCase().includes(q)))
    const matchDietary = filters.dietary.length === 0 || filters.dietary.every(d => (r.dietary_tags || r.tags || []).includes(d))
    const matchSource = filters.sources.length === 0 || (r.source !== null && filters.sources.includes(r.source))
    const matchTags = filters.tags.length === 0 || filters.tags.some(t => (r.tags || []).includes(t))
    const matchMade = filters.made === 'all' || (filters.made === 'made' ? r.made : !r.made)
    const matchIngredients = filters.ingredients.length === 0 || filters.ingredients.every(fi => r.ingredient_groups?.some(g => g.ingredients.some(i => i.name.toLowerCase().includes(fi.toLowerCase()))))
    return matchSearch && matchDietary && matchSource && matchTags && matchMade && matchIngredients
  }).sort((a, b) => {
    if (sort === 'alpha' || activeCollection) return a.title.localeCompare(b.title)
    if (sort === 'made') return (b.made ? 1 : 0) - (a.made ? 1 : 0)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const filtered = smartResults !== null
    ? allRecipes.filter(r => smartResults.includes(r.id))
    : filterRecipesWithFilters(allRecipes)

  const createMenu = async () => {
    const name = prompt('Menu name (e.g. Easter 2026):')
    if (!name) return
    const res = await fetch('/api/menus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, courses: [], make_ahead: [] }) })
    const data = await res.json()
    router.push('/menus/' + data.menu.id)
  }

  const saveCookbook = async (name: string, author: string, coverUrl: string | null, pubYear: string | null) => {
    const cb = cookbooks.find(c => c.name === name)
    const updated: Cookbook = {
      id: cb?.id || name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      name, author: author || null, cover_url: coverUrl, pub_year: pubYear,
      created_at: cb?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    await fetch('/api/cookbooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
    setCookbooks(prev => [...prev.filter(c => c.name !== name), updated])
    setEditingCookbook(null)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>

      {/* TOP NAV */}
      <div style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', height: 60, display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 700, whiteSpace: 'nowrap', marginRight: 8 }}>Recipe Collector</h1>
          <Link href="/import" className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap' }}>+ Import</Link>

          <div style={{ display: 'flex', background: 'var(--tag)', borderRadius: 10, padding: 3, gap: 2 }}>
            {(['collections', 'all'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => {
                setView(v)
                setActiveCollection(null)
                setSearch('')
                if (v === 'all') loadRecipes()
              }} style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
                background: view === v && !activeCollection ? 'var(--card)' : 'transparent',
                color: view === v && !activeCollection ? 'var(--ink)' : 'var(--muted)',
                boxShadow: view === v && !activeCollection ? '0 1px 4px rgba(0,0,0,.08)' : 'none', transition: 'all .15s'
              }}>
                {v === 'collections'
                  ? `Collections (${collectionSummaries.length})`
                  : `All Recipes (${allRecipesLoaded ? allRecipes.length : totalRecipeCount})`}
              </button>
            ))}
          </div>

          <div style={{ marginLeft: 'auto', position: 'relative' }}>
            <MoreMenu menus={menus} onCreateMenu={createMenu} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 80px' }}>

        {/* SEARCH + FILTER — only shown for All Recipes or inside a collection */}
        {(view === 'all' || !!activeCollection) && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
            {!smartMode ? (
              <div style={{ flex: 1, position: 'relative' }}>
                <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 15, opacity: .4 }}>🔍</span>
                <input className="input" style={{ paddingLeft: 38 }}
                  placeholder={activeCollection ? 'Search ' + activeCollection.name + '...' : 'Search recipes, ingredients, sources...'}
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            ) : (
              <div style={{ flex: 1, position: 'relative', display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 14 }}>✨</span>
                  <input className="input" style={{ paddingLeft: 36, borderColor: 'var(--accent)' }}
                    placeholder='e.g. "quick weeknight pasta" or "something with apples"'
                    value={smartSearch} onChange={e => setSmartSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && runSmartSearch()} autoFocus />
                </div>
                <button onClick={runSmartSearch} disabled={smartLoading} className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>
                  {smartLoading ? '⟳' : 'Search'}
                </button>
                {smartResults !== null && <button onClick={clearSmartSearch} className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }}>Clear</button>}
              </div>
            )}
            {!activeCollection && !smartMode && (
              <select className="input" style={{ width: 'auto' }} value={favoritesOnly ? 'favorites' : sort} onChange={e => {
                if (e.target.value === 'favorites') { setFavoritesOnly(true); setSort('recent') }
                else { setFavoritesOnly(false); setSort(e.target.value) }
              }}>
                <option value="recent">Most recent</option>
                <option value="alpha">A to Z</option>
                <option value="made">Made first</option>
                <option value="favorites">★ Favorites</option>
              </select>
            )}
            <button onClick={() => { setSmartMode(!smartMode); clearSmartSearch() }} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
              background: smartMode ? 'var(--accent-bg)' : 'var(--card)',
              border: '0.5px solid ' + (smartMode ? 'var(--accent)' : 'var(--border)'),
              borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
              color: smartMode ? 'var(--accent)' : 'var(--muted)', fontWeight: 500, flexShrink: 0
            }}>✨ Ask Claude</button>
            <div style={{ position: 'relative' }} ref={filterRef}>
              <button onClick={() => setFilterOpen(!filterOpen)} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px',
                background: activeFilterCount > 0 ? 'var(--accent-bg)' : 'var(--card)',
                border: '1px solid ' + (activeFilterCount > 0 ? 'var(--accent)' : 'var(--border)'),
                borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14,
                color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--ink)', fontWeight: 500
              }}>
                ⚙️ Filters
                {activeFilterCount > 0 && <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>{activeFilterCount}</span>}
              </button>
              {filterOpen && (
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 320, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 16px 48px rgba(0,0,0,.12)', zIndex: 100, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Filters</span>
                    {activeFilterCount > 0 && <button onClick={clearFilters} style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Clear all</button>}
                  </div>
                  <div style={{ padding: '14px 18px', maxHeight: 480, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Status</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[['all','All'],['made','✓ Made'],['notmade','Not yet']].map(([val,label]) => (
                          <button key={val} onClick={() => setFilters(f => ({ ...f, made: val }))} style={{ padding: '5px 12px', borderRadius: 50, fontSize: 12, fontWeight: 500, background: filters.made === val ? 'var(--accent-bg)' : 'var(--tag)', border: '1px solid ' + (filters.made === val ? 'var(--accent)' : 'transparent'), color: filters.made === val ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Dietary</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {DIETARY_TAGS.map(t => (
                          <button key={t} onClick={() => toggleFilter('dietary', t)} style={{ padding: '5px 11px', borderRadius: 50, fontSize: 12, fontWeight: 500, background: filters.dietary.includes(t) ? 'var(--accent-bg)' : 'var(--tag)', border: '1px solid ' + (filters.dietary.includes(t) ? 'var(--accent)' : 'transparent'), color: filters.dietary.includes(t) ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit' }}>{t}</button>
                        ))}
                      </div>
                    </div>
                    {allSources.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Source</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {allSources.map(s => (
                            <button key={s} onClick={() => toggleFilter('sources', s)} style={{ padding: '5px 11px', borderRadius: 50, fontSize: 12, fontWeight: 500, background: filters.sources.includes(s) ? 'var(--accent-bg)' : 'var(--tag)', border: '1px solid ' + (filters.sources.includes(s) ? 'var(--accent)' : 'transparent'), color: filters.sources.includes(s) ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit' }}>{s}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {allTags.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Tags</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {allTags.map(t => (
                            <button key={t} onClick={() => toggleFilter('tags', t)} style={{ padding: '5px 11px', borderRadius: 50, fontSize: 12, fontWeight: 500, background: filters.tags.includes(t) ? 'var(--accent-bg)' : 'var(--tag)', border: '1px solid ' + (filters.tags.includes(t) ? 'var(--accent)' : 'transparent'), color: filters.tags.includes(t) ? 'var(--accent)' : 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit' }}>{t}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Ingredients</div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        <input className="input" style={{ fontSize: 13 }} placeholder="e.g. butter, grapefruit..."
                          value={ingredientSearch} onChange={e => setIngredientSearch(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && ingredientSearch.trim()) {
                              if (!filters.ingredients.includes(ingredientSearch.trim())) setFilters(f => ({ ...f, ingredients: [...f.ingredients, ingredientSearch.trim()] }))
                              setIngredientSearch('')
                            }
                          }}
                        />
                        <button onClick={() => {
                          if (ingredientSearch.trim() && !filters.ingredients.includes(ingredientSearch.trim())) setFilters(f => ({ ...f, ingredients: [...f.ingredients, ingredientSearch.trim()] }))
                          setIngredientSearch('')
                        }} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '0 12px', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', flexShrink: 0 }}>Add</button>
                      </div>
                      {filters.ingredients.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {filters.ingredients.map(ing => (
                            <span key={ing} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 50, fontSize: 12, fontWeight: 500, background: 'var(--accent-bg)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
                              {ing}
                              <button onClick={() => setFilters(f => ({ ...f, ingredients: f.ingredients.filter(i => i !== ing) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 13, padding: 0, lineHeight: 1 }}>✕</button>
                            </span>
                          ))}
                        </div>
                      )}
                      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, opacity: .7 }}>Type an ingredient and press Enter or Add</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {summariesLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>
        ) : (
          <>
            {/* ── ALL RECIPES ── */}
            {view === 'all' && !activeCollection && (
              <>
                {allRecipesLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner" /></div>
                ) : allRecipesLoaded ? (
                  <>
                    <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
                      {filtered.length} {filtered.length === 1 ? 'recipe' : 'recipes'}
                      {smartResults !== null ? ' matching your search' : activeFilterCount > 0 ? ' matching filters' : ''}
                    </div>
                    {filtered.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                        <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
                        <p style={{ color: 'var(--muted)', fontSize: 15 }}>No recipes match your search or filters.</p>
                        <button onClick={() => { setSearch(''); clearFilters() }} className="btn btn-ghost" style={{ marginTop: 12 }}>Clear search</button>
                      </div>
                    ) : <RecipeGrid recipes={filtered} cookbooks={cookbooks} />}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🍽️</div>
                    <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, marginBottom: 8 }}>Your library</h2>
                    <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 24 }}>
                      {totalRecipeCount} recipes across {collectionSummaries.length} collections
                    </p>
                    <button onClick={loadRecipes} className="btn btn-primary">Load All Recipes</button>
                  </div>
                )}
              </>
            )}

            {/* ── COLLECTIONS ── */}
            {view === 'collections' && !activeCollection && (
              collectionSummaries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <p style={{ color: 'var(--muted)', fontSize: 15 }}>Collections are created automatically from recipe sources.</p>
                </div>
              ) : (
                <>
                  {/* COOKBOOKS SHELF */}
                  {cookbookSummaries.length > 0 && (
                    <div style={{ marginBottom: 36 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700 }}>📚 Cookbooks</h2>
                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{cookbookSummaries.length} {cookbookSummaries.length === 1 ? 'book' : 'books'}</span>
                        <div style={{ marginLeft: 'auto', display: 'flex', background: 'var(--tag)', borderRadius: 8, padding: 2, gap: 2 }}>
                          {(['author', 'title'] as const).map(s => (
                            <button key={s} onClick={() => setCookbookSort(s)} style={{
                              padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                              fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
                              background: cookbookSort === s ? 'var(--card)' : 'transparent',
                              color: cookbookSort === s ? 'var(--ink)' : 'var(--muted)',
                              boxShadow: cookbookSort === s ? '0 1px 3px rgba(0,0,0,.08)' : 'none'
                            }}>By {s === 'author' ? 'Author' : 'Title'}</button>
                          ))}
                        </div>
                      </div>

                      {cookbookSort === 'author' ? (() => {
                        const authorMap = new Map<string, CollectionSummary[]>()
                        cookbookSummaries.forEach(col => {
                          const cb = cookbooks.find(c => c.name === col.name)
                          const author = cb?.author || 'Unknown Author'
                          if (!authorMap.has(author)) authorMap.set(author, [])
                          authorMap.get(author)!.push(col)
                        })
                        const authors = Array.from(authorMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            {authors.map(([author, cols]) => (
                              <div key={author}>
                                {authors.length > 1 && (
                                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', fontStyle: 'italic', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>{author}</div>
                                )}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                                  {cols.sort((a, b) => a.name.localeCompare(b.name)).map(col => (
                                    <CookbookCard key={col.name} collection={col}
                                      cookbook={cookbooks.find(c => c.name === col.name)}
                                      onClick={() => { setActiveCollection(col); setSearch(''); loadRecipes() }}
                                      onEdit={(e) => { e.stopPropagation(); setEditingCookbook(col.name) }} />
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })() : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                          {cookbookSummaries.sort((a, b) => a.name.localeCompare(b.name)).map(col => (
                            <CookbookCard key={col.name} collection={col}
                              cookbook={cookbooks.find(c => c.name === col.name)}
                              onClick={() => { setActiveCollection(col); setSearch(''); loadRecipes() }}
                              onEdit={(e) => { e.stopPropagation(); setEditingCookbook(col.name) }} />
                          ))}
                        </div>
                      )}

                      {editingCookbook && (() => {
                        const cb = cookbooks.find(c => c.name === editingCookbook)
                        return <CookbookEditModal name={editingCookbook} cookbook={cb} onClose={() => setEditingCookbook(null)}
                          onSave={(a, cu, py) => saveCookbook(editingCookbook, a, cu, py)} />
                      })()}
                    </div>
                  )}

                  {otherCookbooks && (
                    <div style={{ marginTop: 20, marginBottom: 20 }}>
                      <CollectionCard collection={otherCookbooks} onClick={() => { setActiveCollection(otherCookbooks); setSearch(''); loadRecipes() }} />
                    </div>
                  )}

                  {websiteSummaries.length > 0 && (
                    <div style={{ marginBottom: 36 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
                        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700 }}>🌐 Websites & Blogs</h2>
                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{websiteSummaries.length} sources</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
                        {websiteSummaries.map(col => <CollectionCard key={col.name} collection={col} onClick={() => { setActiveCollection(col); setSearch(''); loadRecipes() }} />)}
                      </div>
                    </div>
                  )}

                  {blogsAndSocial && (
                    <div style={{ marginTop: websiteSummaries.length > 0 ? 28 : 0, marginBottom: 36 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
                        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700 }}>📱 Blogs & Social</h2>
                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{pooledWebsiteSummaries.length} sources · {blogsAndSocial.recipe_count} recipes</span>
                      </div>
                      <CollectionCard collection={blogsAndSocial} onClick={() => { setActiveCollection(blogsAndSocial); setSearch(''); loadRecipes() }} />
                    </div>
                  )}
                </>
              )
            )}

            {/* ── INSIDE COLLECTION ── */}
            {activeCollection && (
              <>
                {(() => {
                  const cb = activeCollection.source_type === 'cookbook' ? cookbooks.find(c => c.name === activeCollection.name) : null
                  const displayCount = allRecipesLoaded ? activeCollectionRecipes.length : activeCollection.recipe_count
                  const displayMade = allRecipesLoaded ? activeCollectionRecipes.filter(r => r.made).length : activeCollection.made_count
                  return (
                    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px', marginBottom: 24, display: 'flex', gap: 20, alignItems: 'center' }}>
                      {cb?.cover_url && <img src={cb.cover_url} alt="" style={{ width: 80, height: 100, objectFit: 'cover', borderRadius: 8, flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,.15)' }} />}
                      <div style={{ flex: 1 }}>
                        <button onClick={() => { setActiveCollection(null); setSearch(''); setView('collections') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 13, padding: 0, marginBottom: 8, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>← Back to Collections</button>
                        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 700, marginBottom: 3 }}>{activeCollection.name}</h2>
                        {cb?.author && <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', marginBottom: 4 }}>{cb.author}</p>}
                        {cb?.pub_year && <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{cb.pub_year}</p>}
                        <p style={{ fontSize: 13, color: 'var(--muted)' }}>{displayCount} recipes · {displayMade} made</p>
                      </div>
                      {activeCollection.source_type === 'cookbook' && (
                        <button onClick={() => setEditingCookbook(activeCollection.name)} style={{ background: 'var(--tag)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--muted)', flexShrink: 0 }}>✏️ Edit</button>
                      )}
                    </div>
                  )
                })()}

                {editingCookbook && (() => {
                  const cb = cookbooks.find(c => c.name === editingCookbook)
                  return <CookbookEditModal name={editingCookbook} cookbook={cb} onClose={() => setEditingCookbook(null)}
                    onSave={(a, cu, py) => saveCookbook(editingCookbook, a, cu, py)} />
                })()}

                {allRecipesLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
                ) : allRecipesLoaded ? (
                  filterRecipesWithFilters(activeCollectionRecipes).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                      <p style={{ color: 'var(--muted)', fontSize: 15 }}>No recipes match your search.</p>
                    </div>
                  ) : <RecipeGrid recipes={filterRecipesWithFilters(activeCollectionRecipes)} cookbooks={cookbooks} />
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}


function CookbookCard({ collection, cookbook, onClick, onEdit }: {
  collection: CollectionSummary, cookbook?: Cookbook,
  onClick: () => void, onEdit: (e: React.MouseEvent) => void
}) {
  const coverPhoto = cookbook?.cover_url || collection.image_urls[0]
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'transform .18s, box-shadow .18s', display: 'flex', flexDirection: 'column', position: 'relative' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 32px rgba(0,0,0,.1)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}>
      <button onClick={onEdit} style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, background: 'rgba(0,0,0,.45)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>✏️ Edit</button>
      <div onClick={onClick} style={{ height: 140, background: 'var(--tag)', overflow: 'hidden', position: 'relative' }}>
        {coverPhoto ? <img src={coverPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 36 }}>📚</div>}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, background: 'var(--accent)', opacity: .8 }} />
      </div>
      <div onClick={onClick} style={{ padding: '12px 14px 14px' }}>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 15, fontWeight: 600, lineHeight: 1.3, marginBottom: 3 }}>{collection.name}</div>
        {cookbook?.author && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 3, fontStyle: 'italic' }}>{cookbook.author}</div>}
        {cookbook?.pub_year && <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>{cookbook.pub_year}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
          <span>{collection.recipe_count} {collection.recipe_count === 1 ? 'recipe' : 'recipes'}</span>
          {collection.made_count > 0 && <span style={{ color: 'var(--green)', fontWeight: 500 }}>✓ {collection.made_count} made</span>}
        </div>
      </div>
    </div>
  )
}


function CollectionCard({ collection, onClick }: { collection: CollectionSummary, onClick: () => void }) {
  const photos = collection.image_urls
  const isOtherCookbooks = collection.name === 'Other Cookbooks'
  const isBlogsAndSocial = collection.name === 'Blogs & Social'

  return (
    <div onClick={onClick} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', cursor: 'pointer', transition: 'transform .18s, box-shadow .18s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 32px rgba(0,0,0,.1)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}>

      {isOtherCookbooks ? (
        <div style={{ height: 160, background: '#D8EBCF', display: 'flex', overflow: 'hidden' }}>
          <div style={{ width: 14, background: '#4A7A3A', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 12 }}>
            <div style={{ fontSize: 36, lineHeight: 1 }}>📚</div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase' as const, color: '#4A7A3A', textAlign: 'center' as const, lineHeight: 1.4 }}>Other<br />Cookbooks</div>
          </div>
        </div>
      ) : isBlogsAndSocial ? (
        <div style={{ height: 160, background: '#EEF2FF', display: 'flex', overflow: 'hidden' }}>
          <div style={{ width: 14, background: '#4F6BDB', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 12 }}>
            <div style={{ fontSize: 36, lineHeight: 1 }}>🌐</div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase' as const, color: '#4F6BDB', textAlign: 'center' as const, lineHeight: 1.4 }}>Blogs &<br />Social</div>
          </div>
        </div>
      ) : (
        <div style={{ height: 160, display: 'grid', gridTemplateColumns: photos.length >= 2 ? '1fr 1fr' : '1fr', gridTemplateRows: photos.length >= 3 ? '1fr 1fr' : '1fr', gap: 2, background: 'var(--tag)' }}>
          {photos.length === 0
            ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>📚</div>
            : photos.slice(0, 4).map((url, i) => (
              <div key={i} style={{ overflow: 'hidden', gridColumn: photos.length === 1 ? '1/-1' : undefined, gridRow: photos.length === 3 && i === 0 ? '1/3' : undefined }}>
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            ))}
        </div>
      )}

      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 600, marginBottom: 5 }}>{collection.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)' }}>
          <span>{collection.recipe_count} {collection.recipe_count === 1 ? 'recipe' : 'recipes'}</span>
          {collection.made_count > 0 && <span style={{ color: 'var(--green)', fontWeight: 500 }}>✓ {collection.made_count} made</span>}
        </div>
      </div>
    </div>
  )
}


function RecipeGrid({ recipes, cookbooks }: { recipes: Recipe[], cookbooks?: Cookbook[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
      {recipes.map(r => {
        const cbCover = !r.image_url && cookbooks ? cookbooks.find(c => c.name === r.source)?.cover_url : null
        return (
          <Link href={'/recipe/' + r.id} key={r.id} style={{ display: 'block', textDecoration: 'none' }}>
            <div className="lib-card">
              {r.image_url ? <img className="lib-card-img" src={r.image_url} alt={r.title} />
                : cbCover ? <img className="lib-card-img" src={cbCover} alt={r.title} style={{ opacity: 0.6 }} />
                : <div className="lib-card-placeholder">🍽️</div>}
              <div className="lib-card-body">
                <div className="lib-card-tags">
                  {r.favorited && <span style={{ fontSize: 12, color: '#854D0E' }}>★</span>}
                  {r.made && (() => {
                    const lastEntry = (r.made_log || [])[0]
                    const ratingColors: Record<string, string> = { 'would-make-again': 'var(--green)', 'make-with-changes': 'var(--accent)', 'wouldnt-make-again': '#ef4444' }
                    const ratingIcons: Record<string, string> = { 'would-make-again': '⭐', 'make-with-changes': '✏️', 'wouldnt-make-again': '✕' }
                    const color = lastEntry?.rating ? ratingColors[lastEntry.rating] : 'var(--green)'
                    const icon = lastEntry?.rating ? ratingIcons[lastEntry.rating] : '✓'
                    return <span style={{ fontSize: 11, color, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 3 }}>{icon} Made</span>
                  })()}
                  {(r.tags || []).filter(t => ['Pie','Cake','Cookies','Bread','Pasta','Soup','Salad','Appetizer','Side','Main','Sauce','Drink','Breakfast','Snack'].includes(t)).slice(0,1).map(t => (
                    <span key={t} style={{ background: 'var(--accent-bg)', color: 'var(--accent)', borderRadius: 50, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>{t}</span>
                  ))}
                  {(r.tags || []).filter(t => ['Sweet','Savory'].includes(t)).slice(0,1).map(t => (
                    <span key={t} style={{ background: 'var(--tag)', color: 'var(--muted)', borderRadius: 50, padding: '2px 9px', fontSize: 11 }}>{t}</span>
                  ))}
                  {(r.dietary_tags || []).slice(0, 1).map(t => <span key={t} style={{ background: 'var(--green-bg)', color: 'var(--green)', borderRadius: 50, padding: '2px 9px', fontSize: 10, fontWeight: 500 }}>{t}</span>)}
                </div>
                <div className="lib-card-title">{r.title}</div>
                <div className="lib-card-meta">
                  {r.yield && <span>y= {r.yield}</span>}
                  {r.time_active && <span>⏱ {r.time_active}</span>}
                </div>
                {r.source && <div className="lib-card-source">📖 {r.source}{r.page_number ? ' · ' + r.page_number : ''}</div>}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}


function MoreMenu({ menus, onCreateMenu }: { menus: unknown[], onCreateMenu: () => void }) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const item = (href: string, icon: string, label: string, soon?: boolean) => (
    soon ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', fontSize: 13, color: 'var(--muted)', opacity: .5 }}>
        <span>{icon}</span><span>{label}</span><span style={{ marginLeft: 'auto', fontSize: 10, background: 'var(--tag)', padding: '1px 6px', borderRadius: 50 }}>Soon</span>
      </div>
    ) : (
      <Link href={href} onClick={() => setOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', fontSize: 13, color: 'var(--ink)', textDecoration: 'none', borderRadius: 6, transition: 'background .1s' }}
        onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = 'var(--cream)'}
        onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'}>
        <span>{icon}</span><span>{label}</span>
      </Link>
    )
  )

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
        background: open ? 'var(--tag)' : 'var(--card)', border: '0.5px solid var(--border)',
        borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--muted)', fontWeight: 500
      }}>
        More {open ? '▲' : '▼'}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 6, background: 'var(--card)', border: '0.5px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,.12)', minWidth: 220, zIndex: 100, padding: '6px' }}>
          {item('/menus', '📋', 'Menus')}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', fontSize: 13, color: 'var(--ink)', cursor: 'pointer', borderRadius: 6 }}
            onClick={() => { onCreateMenu(); setOpen(false) }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--cream)'}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}>
            <span>+</span><span>New Menu</span>
          </div>
          {item('/meal-prep-list', '🥘', 'Meal Prep')}
          {item('/research', '🔬', 'Research')}
          {item('/saved-articles', '📌', 'Saved Articles')}
          <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
          {item('/bulk-tags', '🏷', 'Bulk Tag Editor')}
          {item('/import/batch', '📂', 'Batch Import')}
          {item('/import/cookbook-session', '📚', 'Cookbook Session')}
          <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
          {item('/settings', '⚙️', 'Settings')}
          <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
          {item('', '💰', 'Cost per Serving', true)}
          {item('', '🥗', 'Nutrition Info', true)}
          {item('', '⚖️', 'Recipe Scaling', true)}
          {item('', '🔬', 'Recipe Analyzer', true)}
        </div>
      )}
    </div>
  )
}


function CookbookEditModal({ name, cookbook, onSave, onClose }: {
  name: string, cookbook: Cookbook | undefined,
  onSave: (author: string, coverUrl: string | null, pubYear: string | null) => void,
  onClose: () => void
}) {
  const [author, setAuthor] = React.useState(cookbook?.author || '')
  const [pubYear, setPubYear] = React.useState(cookbook?.pub_year || '')
  const [coverUrl, setCoverUrl] = React.useState(cookbook?.cover_url || '')
  const [uploading, setUploading] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.url) setCoverUrl(data.url)
    } catch { /* ignore */ }
    setUploading(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'var(--card)', borderRadius: 18, padding: 28, maxWidth: 480, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{name}</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>Edit cookbook details</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Author(s)</label>
            <input className="input" value={author} onChange={e => setAuthor(e.target.value)} placeholder="e.g. Emily and Melissa Elsen" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Publication Year</label>
            <input className="input" value={pubYear} onChange={e => setPubYear(e.target.value)} placeholder="e.g. 2013" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Cover Photo</label>
            {coverUrl && (
              <div style={{ position: 'relative', marginBottom: 10, display: 'inline-block' }}>
                <img src={coverUrl} alt="" style={{ height: 120, width: 'auto', borderRadius: 8, objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                <button onClick={() => setCoverUrl('')} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11 }}>✕</button>
              </div>
            )}
            <div onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleUpload(f) }}
              style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: '14px', textAlign: 'center', cursor: 'pointer', background: 'var(--cream)', fontSize: 13, color: 'var(--muted)' }}>
              <input ref={fileRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} style={{ display: 'none' }} />
              {uploading ? '⟳ Uploading...' : '📷 Upload cover photo or drag & drop'}
            </div>
            <div style={{ marginTop: 8 }}>
              <input className="input" style={{ fontSize: 13 }} value={coverUrl} onChange={e => setCoverUrl(e.target.value)} placeholder="Or paste image URL..." />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button onClick={() => onSave(author, coverUrl || null, pubYear || null)} className="btn btn-green">Save</button>
        </div>
      </div>
    </div>
  )
}
