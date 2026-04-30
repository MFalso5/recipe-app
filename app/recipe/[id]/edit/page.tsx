'use client'
import * as React from 'react'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Recipe } from '@/lib/types'
import Link from 'next/link'

async function uploadImageToBlob(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('image', file)
  const res = await fetch('/api/upload-image', { method: 'POST', body: fd })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.url
}


function LinkedRecipePicker({ name, onLink }: { name: string, onLink: (id: string, title: string) => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState(name)
  const [results, setResults] = useState<{ id: string, title: string, source: string }[]>([])

  useEffect(() => {
    fetch('/api/recipes').then(r => r.json()).then(d => {
      const all = (d.recipes || []) as { id: string, title: string, source: string }[]
      setResults(all.filter(r => r.title.toLowerCase().includes(search.toLowerCase())).slice(0, 6))
    })
  }, [search])

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-bg)', border: '1px solid var(--accent)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit', marginLeft: 6 }}>
      🔗 Link recipe
    </button>
  )

  return (
    <div style={{ marginTop: 6, background: 'var(--cream)', borderRadius: 8, padding: 10, border: '1px solid var(--border)' }}>
      <input className="input" style={{ fontSize: 12, marginBottom: 8 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your library..." autoFocus />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
        {results.map(r => (
          <button key={r.id} onClick={() => { onLink(r.id, r.title); setOpen(false) }} style={{ padding: '6px 10px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, textAlign: 'left', color: 'var(--ink)' }}>
            {r.title} <span style={{ color: 'var(--muted)', fontSize: 11 }}>— {r.source}</span>
          </button>
        ))}
        {results.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)', padding: '4px 0' }}>No recipes found matching "{search}"</p>}
      </div>
      <button onClick={() => setOpen(false)} style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginTop: 6 }}>Cancel</button>
    </div>
  )
}


function GalleryUploader({ onAdd }: { onAdd: (file: File) => Promise<void> }) {
  const ref = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    setUploading(true)
    try { await onAdd(file) } finally { setUploading(false) }
  }
  return (
    <div onClick={() => ref.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
      style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: '12px 16px', textAlign: 'center', cursor: 'pointer', background: 'var(--cream)' }}>
      <input ref={ref} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} style={{ display: 'none' }} />
      {uploading ? <span style={{ fontSize: 13, color: 'var(--muted)' }}>Uploading...</span> : <span style={{ fontSize: 13, color: 'var(--muted)' }}><strong style={{ color: 'var(--accent)' }}>+ Add photo</strong> to gallery</span>}
    </div>
  )
}


function CookbookCoverUploader({ current, onUpload, onClear }: { current: string | null, onUpload: (url: string) => void, onClear: () => void }) {
  const ref = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)

  const handleFile = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.url) onUpload(data.url)
    } finally { setUploading(false) }
  }

  return (
    <div>
      {current && (
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8 }}>
          <img src={current} alt="" style={{ height: 80, width: 'auto', borderRadius: 6, objectFit: 'cover', border: '2px solid var(--accent)' }} />
          <button onClick={onClear} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      )}
      <div onClick={() => ref.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: '10px 14px', textAlign: 'center', cursor: 'pointer', background: 'var(--cream)' }}>
        <input ref={ref} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} style={{ display: 'none' }} />
        {uploading ? <span style={{ fontSize: 12, color: 'var(--muted)' }}>Uploading...</span> : <span style={{ fontSize: 12, color: 'var(--muted)' }}><strong style={{ color: 'var(--accent)' }}>Upload cover photo</strong> or drag & drop</span>}
      </div>
    </div>
  )
}

export default function EditRecipePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [imgUploading, setImgUploading] = useState(false)
  const [imgDragOver, setImgDragOver] = useState(false)
  const imgRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/recipes/' + params.id)
      .then(r => r.json())
      .then(d => { setRecipe(d.recipe); setLoading(false) })
  }, [params.id])

  const set = (key: string, val: unknown) => setRecipe(prev => prev ? { ...prev, [key]: val } : prev)

  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    setImgUploading(true)
    try {
      const url = await uploadImageToBlob(file)
      set('image_url', url)
    } catch {
      alert('Image upload failed. Please try again.')
    } finally {
      setImgUploading(false)
    }
  }

  const save = async () => {
    if (!recipe) return
    setSaving(true)
    await fetch('/api/recipes/' + params.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recipe)
    })
    router.push('/recipe/' + params.id)
  }

  if (loading || !recipe) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '0 16px 80px' }}>
      <div style={{ padding: '28px 0 24px', borderBottom: '1px solid var(--border)', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 700 }}>Edit Recipe</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>{recipe.title}</p>
        </div>
        <Link href={'/recipe/' + params.id} className="btn btn-ghost btn-sm">Cancel</Link>
      </div>

      <div className="card-shell" style={{ padding: 24 }}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { label: 'Title', key: 'title', full: true },
            { label: 'Source', key: 'source' },
            { label: 'Source URL', key: 'source_url' },
            { label: 'Yield', key: 'yield' },
            { label: 'Active Time', key: 'time_active' },
            { label: 'Temperature', key: 'temperature' },
            { label: 'Page Number', key: 'page_number' },
          ].map(({ label, key, full }) => (
            <div key={key} style={full ? { gridColumn: '1/-1' } : {}}>
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 5 }}>{label}</label>
              <input className="input" value={(recipe as unknown as Record<string, unknown>)[key] as string || ''} onChange={e => set(key, e.target.value || null)} />
            </div>
          ))}
        </div>

        {/* PHOTO UPLOAD */}
        <div style={{ marginTop: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 10 }}>Recipe Photo</label>

          {/* Current image preview */}
          {recipe.image_url && (
            <div style={{ position: 'relative', marginBottom: 12, display: 'inline-block' }}>
              <img src={recipe.image_url} alt="" style={{ height: 120, width: 'auto', borderRadius: 10, objectFit: 'cover', border: '2px solid var(--accent)' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              <button onClick={() => set('image_url', null)} style={{ position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
          )}

          {/* Upload zone */}
          <div
            onClick={() => imgRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setImgDragOver(true) }}
            onDragLeave={() => setImgDragOver(false)}
            onDrop={e => { e.preventDefault(); setImgDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleImageFile(f) }}
            style={{
              border: '2px dashed ' + (imgDragOver ? 'var(--accent)' : 'var(--border)'),
              borderRadius: 10, padding: '20px', textAlign: 'center', cursor: 'pointer',
              background: imgDragOver ? 'var(--accent-bg)' : 'var(--cream)', transition: 'all .15s'
            }}>
            <input ref={imgRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f) }} style={{ display: 'none' }} />
            {imgUploading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Uploading...</span>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 24, marginBottom: 6 }}>📷</div>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}><strong style={{ color: 'var(--accent)' }}>Tap to upload</strong> or drag & drop</p>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3, opacity: .7 }}>JPG, PNG, HEIC</p>
              </>
            )}
          </div>

          {/* URL fallback */}
          <div style={{ marginTop: 10 }}>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Or paste image URL</label>
            <input className="input" value={recipe.image_url || ''} onChange={e => set('image_url', e.target.value || null)} placeholder="https://..." />
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Description</label>
          <textarea className="input" value={recipe.description || ''} onChange={e => set('description', e.target.value)} />
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Before You Begin</label>
          <textarea className="input" style={{ minHeight: 56 }} value={recipe.before_you_begin || ''} onChange={e => set('before_you_begin', e.target.value || null)} />
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Equipment</label>
          <input className="input" value={recipe.equipment || ''} onChange={e => set('equipment', e.target.value || null)} />
        </div>

        {/* GALLERY */}
        <div style={{ marginTop: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 10 }}>
            Additional Photos <span style={{ fontWeight: 400, textTransform: 'none' }}>(gallery)</span>
          </label>
          {(recipe.gallery_urls || []).length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {(recipe.gallery_urls || []).map((url, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  <button onClick={() => set('gallery_urls', (recipe.gallery_urls || []).filter((_, j) => j !== i))}
                    style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>
              ))}
            </div>
          )}
          <GalleryUploader onAdd={async (file) => {
            const fd = new FormData()
            fd.append('image', file)
            const res = await fetch('/api/upload-image', { method: 'POST', body: fd })
            const data = await res.json()
            if (data.url) set('gallery_urls', [...(recipe.gallery_urls || []), data.url])
          }} />
        </div>

        {/* DIETARY TAGS */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Dietary Tags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['Vegan','Vegetarian','Gluten Free','Dairy Free','Keto','Paleo','Sugar Free','Nut Free','Low Carb','Whole30'].map(tag => {
              const active = (recipe.dietary_tags || []).includes(tag)
              return (
                <button key={tag} onClick={() => {
                  const current = recipe.dietary_tags || []
                  set('dietary_tags', active ? current.filter(t => t !== tag) : [...current, tag])
                }} style={{ padding: '5px 12px', borderRadius: 50, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', background: active ? 'var(--green-bg)' : 'var(--tag)', border: '1px solid ' + (active ? 'var(--green)' : 'transparent'), color: active ? 'var(--green)' : 'var(--muted)' }}>{tag}</button>
              )
            })}
          </div>
        </div>

        {/* INGREDIENTS */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>Ingredients</div>
          {recipe.ingredient_groups.map((g, gi) => (
            <div key={gi} style={{ marginBottom: 14, padding: 14, background: 'var(--cream)', borderRadius: 10 }}>
              <input className="input" style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-bg)' }}
                placeholder="Group name (optional)" value={g.group_name || ''}
                onChange={e => { const gs = [...recipe.ingredient_groups]; gs[gi] = { ...gs[gi], group_name: e.target.value || null }; set('ingredient_groups', gs) }} />
              {g.ingredients.map((ing, ii) => (
                <div key={ii} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="input" style={{ width: 80, flexShrink: 0 }} value={ing.qty}
                      onChange={e => { const gs = [...recipe.ingredient_groups]; gs[gi].ingredients[ii] = { ...ing, qty: e.target.value }; set('ingredient_groups', gs) }} />
                    <input className="input" value={ing.name}
                      onChange={e => { const gs = [...recipe.ingredient_groups]; gs[gi].ingredients[ii] = { ...ing, name: e.target.value }; set('ingredient_groups', gs) }} />
                    <button onClick={() => { const gs = [...recipe.ingredient_groups]; gs[gi].ingredients = gs[gi].ingredients.filter((_, j) => j !== ii); set('ingredient_groups', gs) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16 }}>✕</button>
                  </div>
                  {ing.linked_recipe_id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, paddingLeft: 88 }}>
                      <span style={{ fontSize: 11, color: 'var(--accent)' }}>📎 Linked: {ing.linked_recipe_title}</span>
                      <button onClick={() => { const gs = [...recipe.ingredient_groups]; gs[gi].ingredients[ii] = { ...ing, linked_recipe_id: null, linked_recipe_title: null }; set('ingredient_groups', gs) }}
                        style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>unlink</button>
                    </div>
                  ) : (
                    <div style={{ paddingLeft: 88, marginTop: 2 }}>
                      <LinkedRecipePicker name={ing.name} onLink={(id, title) => {
                        const gs = [...recipe.ingredient_groups]
                        gs[gi].ingredients[ii] = { ...ing, linked_recipe_id: id, linked_recipe_title: title }
                        set('ingredient_groups', gs)
                      }} />
                    </div>
                  )}
                </div>
              ))}
              <button onClick={() => { const gs = [...recipe.ingredient_groups]; gs[gi].ingredients.push({ qty: '', name: '' }); set('ingredient_groups', gs) }}
                style={{ background: 'none', border: '1.5px dashed var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 13, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>+ Add ingredient</button>
            </div>
          ))}
        </div>

        {/* STEPS */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>Instructions</div>
          {recipe.step_groups.map((g, gi) => (
            <div key={gi} style={{ marginBottom: 14, padding: 14, background: 'var(--cream)', borderRadius: 10 }}>
              <input className="input" style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-bg)' }}
                placeholder="Section name (optional)" value={g.group_name || ''}
                onChange={e => { const gs = [...recipe.step_groups]; gs[gi] = { ...gs[gi], group_name: e.target.value || null }; set('step_groups', gs) }} />
              {g.steps.map((s, si) => (
                <div key={si} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                  <div style={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', color: 'var(--accent)', fontSize: 18, minWidth: 24, paddingTop: 8 }}>{s.num}</div>
                  <input className="input" style={{ width: 80, flexShrink: 0 }} placeholder="Time" value={s.time || ''}
                    onChange={e => { const gs = [...recipe.step_groups]; gs[gi].steps[si] = { ...s, time: e.target.value || null }; set('step_groups', gs) }} />
                  <textarea className="input" style={{ minHeight: 56 }} value={s.text}
                    onChange={e => { const gs = [...recipe.step_groups]; gs[gi].steps[si] = { ...s, text: e.target.value }; set('step_groups', gs) }} />
                  <button onClick={() => { const gs = [...recipe.step_groups]; gs[gi].steps = gs[gi].steps.filter((_, j) => j !== si).map((s, i) => ({ ...s, num: i + 1 })); set('step_groups', gs) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16, paddingTop: 8 }}>✕</button>
                </div>
              ))}
              <button onClick={() => { const gs = [...recipe.step_groups]; const n = (gs[gi].steps[gs[gi].steps.length - 1]?.num || 0) + 1; gs[gi].steps.push({ num: n, time: null, text: '' }); set('step_groups', gs) }}
                style={{ background: 'none', border: '1.5px dashed var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 13, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>+ Add step</button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 18 }}>
          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Notes <span style={{ fontWeight: 400, textTransform: 'none' }}>(one per line)</span></label>
          <textarea className="input" value={(recipe.notes || []).join('\n')} onChange={e => set('notes', e.target.value ? e.target.value.split('\n') : null)} />
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Storage</label>
          <textarea className="input" style={{ minHeight: 48 }} value={recipe.storage || ''} onChange={e => set('storage', e.target.value || null)} />
        </div>
        {/* TAGS — TIER BASED */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>Tier 1 — Dish Type</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {['Pie','Cake','Cookies','Bread','Pasta','Soup','Salad','Appetizer','Side','Main','Sauce','Drink','Breakfast','Snack'].map(tag => {
              const active = (recipe.tags || []).includes(tag)
              return <button key={tag} onClick={() => {
                const without = (recipe.tags || []).filter(t => !['Pie','Cake','Cookies','Bread','Pasta','Soup','Salad','Appetizer','Side','Main','Sauce','Drink','Breakfast','Snack'].includes(t))
                set('tags', active ? without : [...without, tag])
              }} style={{ padding: '5px 12px', borderRadius: 50, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', background: active ? 'var(--accent-bg)' : 'var(--tag)', border: '1px solid ' + (active ? 'var(--accent)' : 'transparent'), color: active ? 'var(--accent)' : 'var(--muted)' }}>{tag}</button>
            })}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--green)', marginBottom: 8 }}>Tier 2 — Sweet or Savory</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {['Sweet','Savory'].map(tag => {
              const active = (recipe.tags || []).includes(tag)
              return <button key={tag} onClick={() => {
                const without = (recipe.tags || []).filter(t => !['Sweet','Savory'].includes(t))
                set('tags', active ? without : [...without, tag])
              }} style={{ padding: '5px 16px', borderRadius: 50, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', background: active ? 'var(--green-bg)' : 'var(--tag)', border: '1px solid ' + (active ? 'var(--green)' : 'transparent'), color: active ? 'var(--green)' : 'var(--muted)' }}>{tag}</button>
            })}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Tier 3 — Cuisine & Character <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {['Italian','French','American','Greek','Asian','Mexican','Spanish','Middle Eastern','Indian','Japanese','Chinese','Thai','Mediterranean','Holiday','Weekend','Quick','Comfort Food','Seasonal','Summer','Winter','Spring','Fall'].map(tag => {
              const active = (recipe.tags || []).includes(tag)
              return <button key={tag} onClick={() => {
                const current = recipe.tags || []
                set('tags', active ? current.filter(t => t !== tag) : [...current, tag])
              }} style={{ padding: '5px 12px', borderRadius: 50, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', background: active ? 'var(--tag)' : 'var(--cream)', border: '1px solid ' + (active ? 'var(--border)' : 'transparent'), color: active ? 'var(--ink)' : 'var(--muted)' }}>{tag}</button>
            })}
          </div>
          {/* Custom tags */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" style={{ fontSize: 13 }} placeholder="Add custom tag..." onKeyDown={e => {
              if (e.key === 'Enter') {
                const val = (e.target as HTMLInputElement).value.trim()
                if (val && !(recipe.tags || []).includes(val)) set('tags', [...(recipe.tags || []), val]);
                (e.target as HTMLInputElement).value = ''
              }
            }} />
          </div>
          {/* Show custom tags */}
          {(recipe.tags || []).filter(t => !['Pie','Cake','Cookies','Bread','Pasta','Soup','Salad','Appetizer','Side','Main','Sauce','Drink','Breakfast','Snack','Sweet','Savory','Italian','French','American','Greek','Asian','Mexican','Spanish','Middle Eastern','Indian','Japanese','Chinese','Thai','Mediterranean','Holiday','Weekend','Quick','Comfort Food','Seasonal','Summer','Winter','Spring','Fall'].includes(t)).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {(recipe.tags || []).filter(t => !['Pie','Cake','Cookies','Bread','Pasta','Soup','Salad','Appetizer','Side','Main','Sauce','Drink','Breakfast','Snack','Sweet','Savory','Italian','French','American','Greek','Asian','Mexican','Spanish','Middle Eastern','Indian','Japanese','Chinese','Thai','Mediterranean','Holiday','Weekend','Quick','Comfort Food','Seasonal','Summer','Winter','Spring','Fall'].includes(t)).map(t => (
                <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 50, fontSize: 12, background: 'var(--tag)', border: '1px solid var(--border)', color: 'var(--ink)' }}>
                  {t} <button onClick={() => set('tags', (recipe.tags || []).filter(x => x !== t))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 12, padding: 0 }}>✕</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
        <Link href={'/recipe/' + params.id} className="btn btn-ghost">Cancel</Link>
        <button className="btn btn-green" onClick={save} disabled={saving}>{saving ? 'Saving...' : '✓ Save Changes'}</button>
      </div>
    </div>
  )
}
