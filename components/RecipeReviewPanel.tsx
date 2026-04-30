'use client'
import * as React from 'react'
import { Recipe, Ingredient, Step } from '@/lib/types'

const TIER1 = ['Pie','Cake','Cookies','Bread','Pasta','Soup','Salad','Appetizer','Side','Main','Sauce','Drink','Breakfast','Snack']
const TIER2 = ['Sweet','Savory']
const TIER3 = ['Italian','French','American','Greek','Asian','Mexican','Spanish','Middle Eastern','Indian','Japanese','Chinese','Thai','Mediterranean','Holiday','Weekend','Quick','Comfort Food','Seasonal','Summer','Winter','Spring','Fall']
const DIETARY = ['Vegan','Vegetarian','Gluten Free','Dairy Free','Keto','Paleo','Sugar Free','Nut Free','Low Carb','Whole30']

interface Props {
  recipe: Partial<Recipe>
  pageImages?: string[]
  onChange: (updated: Partial<Recipe>) => void
  onSave: () => void
  onCancel?: () => void
  saving?: boolean
  compact?: boolean
}

async function uploadImageToBlob(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('image', file)
  const res = await fetch('/api/upload-image', { method: 'POST', body: fd })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.url
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

export default function RecipeReviewPanel({ recipe, pageImages = [], onChange, onSave, onCancel, saving, compact }: Props) {
  const [imgUploading, setImgUploading] = React.useState(false)
  const [galleryUploading, setGalleryUploading] = React.useState(false)
  const [customTag, setCustomTag] = React.useState('')
  const imgRef = React.useRef<HTMLInputElement>(null)
  const galleryRef = React.useRef<HTMLInputElement>(null)

  const set = (key: string, val: unknown) => onChange({ ...recipe, [key]: val })

  // All images available for hero selection
  const allImages = [
    recipe.image_url,
    ...(recipe.gallery_urls || []),
    ...pageImages
  ].filter(Boolean).filter((url, i, arr) => arr.indexOf(url) === i) as string[]

  const handleHeroUpload = async (file: File) => {
    setImgUploading(true)
    try {
      const compressed = await compressImage(file)
      const url = await uploadImageToBlob(compressed)
      set('image_url', url)
    } catch { /* ignore */ }
    setImgUploading(false)
  }

  const handleGalleryUpload = async (file: File) => {
    setGalleryUploading(true)
    try {
      const compressed = await compressImage(file)
      const url = await uploadImageToBlob(compressed)
      onChange({ ...recipe, gallery_urls: [...(recipe.gallery_urls || []), url] })
    } catch { /* ignore */ }
    setGalleryUploading(false)
  }

  const toggleTag = (tag: string) => {
    const current = recipe.tags || []
    if (TIER1.includes(tag)) {
      const without = current.filter(t => !TIER1.includes(t))
      set('tags', current.includes(tag) ? without : [...without, tag])
    } else if (TIER2.includes(tag)) {
      const without = current.filter(t => !TIER2.includes(t))
      set('tags', current.includes(tag) ? without : [...without, tag])
    } else {
      set('tags', current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag])
    }
  }

  const toggleDietary = (tag: string) => {
    const current = recipe.dietary_tags || []
    set('dietary_tags', current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag])
  }

  const sourceOk = recipe.source && recipe.source !== 'Unknown Source'

  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, letterSpacing: .8,
    textTransform: 'uppercase', color: 'var(--muted)',
    display: 'block', marginBottom: compact ? 4 : 5
  }

  const sectionGap = compact ? 14 : 18

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: sectionGap }}>

      {/* HERO IMAGE */}
      <div>
        <label style={labelStyle}>Recipe Photo</label>
        {recipe.image_url && (
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <img src={recipe.image_url} alt="" style={{ width: '100%', height: compact ? 160 : 200, objectFit: 'cover', borderRadius: 10, display: 'block' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <button onClick={() => set('image_url', null)} style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,0,0,.5)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        )}

        {/* IMAGE THUMBNAILS TO PICK FROM */}
        {allImages.length > 1 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>Tap to set as hero:</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {allImages.map((url, i) => (
                <div key={i} onClick={() => set('image_url', url)} style={{
                  width: 60, height: 60, borderRadius: 7, overflow: 'hidden', cursor: 'pointer', flexShrink: 0,
                  border: '2px solid ' + (recipe.image_url === url ? 'var(--accent)' : 'var(--border)'),
                  boxShadow: recipe.image_url === url ? '0 0 0 3px var(--accent-bg)' : 'none',
                  transition: 'border-color .15s'
                }}>
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* UPLOAD ZONE */}
        <div onClick={() => imgRef.current?.click()} onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleHeroUpload(f) }}
          style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: '10px 14px', textAlign: 'center', cursor: 'pointer', background: 'var(--cream)', fontSize: 13, color: 'var(--muted)' }}>
          <input ref={imgRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleHeroUpload(f) }} style={{ display: 'none' }} />
          {imgUploading ? '⟳ Uploading...' : '📷 Upload photo or drag & drop'}
        </div>
      </div>

      {/* METADATA */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: compact ? 10 : 12 }}>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={labelStyle}>Title</label>
          <input className="input" value={recipe.title || ''} onChange={e => set('title', e.target.value)} />
        </div>
        <div>
          <label style={{ ...labelStyle, color: !sourceOk ? 'var(--red)' : 'var(--muted)' }}>
            Source <span style={{ color: 'var(--red)' }}>*</span>
          </label>
          <input className="input" style={{ borderColor: !sourceOk ? 'var(--red)' : undefined }}
            value={recipe.source || ''} onChange={e => set('source', e.target.value)}
            placeholder="e.g. Sip and Feast, Four & Twenty Blackbirds" />
          {!sourceOk && <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 3 }}>Required</p>}
        </div>
        <div>
          <label style={labelStyle}>Source Type</label>
          <div style={{ display: 'flex', gap: 5 }}>
            {(['cookbook','website','other'] as const).map(t => (
              <button key={t} onClick={() => set('source_type', t)} style={{
                flex: 1, padding: '6px 4px', borderRadius: 7, border: '1.5px solid ' + ((recipe.source_type || 'other') === t ? 'var(--accent)' : 'var(--border)'),
                background: (recipe.source_type || 'other') === t ? 'var(--accent-bg)' : 'var(--cream)',
                color: (recipe.source_type || 'other') === t ? 'var(--accent)' : 'var(--muted)',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 10, fontWeight: 600
              }}>{{ cookbook: '📚', website: '🌐', other: '📄' }[t]} {t}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={labelStyle}>Yield</label>
          <input className="input" value={recipe.yield || ''} onChange={e => set('yield', e.target.value)} placeholder="e.g. 9-inch pie" />
        </div>
        <div>
          <label style={labelStyle}>Active Time</label>
          <input className="input" value={recipe.time_active || ''} onChange={e => set('time_active', e.target.value || null)} />
        </div>
        <div>
          <label style={labelStyle}>Temperature</label>
          <input className="input" value={recipe.temperature || ''} onChange={e => set('temperature', e.target.value || null)} />
        </div>
        <div>
          <label style={labelStyle}>Page Number</label>
          <input className="input" value={(recipe as Record<string,unknown>).page_number as string || ''} onChange={e => set('page_number', e.target.value || null)} placeholder="e.g. p. 182" />
        </div>
      </div>

      {/* DIETARY TAGS */}
      <div>
        <label style={labelStyle}>Dietary Tags <span style={{ fontWeight: 400, textTransform: 'none' }}>(AI suggested)</span></label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {DIETARY.map(tag => {
            const active = (recipe.dietary_tags || []).includes(tag)
            return <button key={tag} onClick={() => toggleDietary(tag)} style={{ padding: '4px 10px', borderRadius: 50, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', background: active ? 'var(--green-bg)' : 'var(--tag)', border: '1px solid ' + (active ? 'var(--green)' : 'transparent'), color: active ? 'var(--green)' : 'var(--muted)' }}>{tag}</button>
          })}
        </div>
      </div>

      {/* TAGS */}
      <div>
        <div style={{ ...labelStyle, color: 'var(--accent)', display: 'block', marginBottom: 6 }}>Tier 1 — Dish Type</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
          {TIER1.map(tag => {
            const active = (recipe.tags || []).includes(tag)
            return <button key={tag} onClick={() => toggleTag(tag)} style={{ padding: '4px 10px', borderRadius: 50, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', background: active ? 'var(--accent-bg)' : 'var(--tag)', border: '1px solid ' + (active ? 'var(--accent)' : 'transparent'), color: active ? 'var(--accent)' : 'var(--muted)' }}>{tag}</button>
          })}
        </div>
        <div style={{ ...labelStyle, color: 'var(--green)', display: 'block', marginBottom: 6 }}>Tier 2 — Sweet or Savory</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {TIER2.map(tag => {
            const active = (recipe.tags || []).includes(tag)
            return <button key={tag} onClick={() => toggleTag(tag)} style={{ padding: '4px 14px', borderRadius: 50, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', background: active ? 'var(--green-bg)' : 'var(--tag)', border: '1px solid ' + (active ? 'var(--green)' : 'transparent'), color: active ? 'var(--green)' : 'var(--muted)' }}>{tag}</button>
          })}
        </div>
        <div style={{ ...labelStyle, display: 'block', marginBottom: 6 }}>Tier 3 — Cuisine & Character</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
          {TIER3.map(tag => {
            const active = (recipe.tags || []).includes(tag)
            return <button key={tag} onClick={() => toggleTag(tag)} style={{ padding: '4px 10px', borderRadius: 50, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', background: active ? 'var(--tag)' : 'var(--cream)', border: '1px solid ' + (active ? 'var(--border)' : 'transparent'), color: active ? 'var(--ink)' : 'var(--muted)' }}>{tag}</button>
          })}
        </div>
        {/* Custom tags */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {(recipe.tags || []).filter(t => !TIER1.includes(t) && !TIER2.includes(t) && !TIER3.includes(t)).map(t => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 50, fontSize: 11, background: 'var(--tag)', border: '1px solid var(--border)', color: 'var(--ink)' }}>
              {t}<button onClick={() => set('tags', (recipe.tags || []).filter(x => x !== t))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: 0, lineHeight: 1 }}>✕</button>
            </span>
          ))}
          <input style={{ width: 120, padding: '3px 8px', borderRadius: 50, border: '1.5px dashed var(--border)', fontSize: 11, fontFamily: 'inherit', outline: 'none', background: 'var(--cream)', color: 'var(--ink)' }}
            placeholder="+ custom tag" value={customTag} onChange={e => setCustomTag(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && customTag.trim()) { toggleTag(customTag.trim()); setCustomTag('') } }} />
        </div>
      </div>

      {/* DESCRIPTION */}
      <div>
        <label style={labelStyle}>Description</label>
        <textarea className="input" style={{ minHeight: 72 }} value={recipe.description || ''} onChange={e => set('description', e.target.value || null)} placeholder="About this recipe..." />
      </div>

      {/* BEFORE YOU BEGIN */}
      <div>
        <label style={labelStyle}>Before You Begin <span style={{ fontWeight: 400, textTransform: 'none' }}>(leave blank to omit)</span></label>
        <textarea className="input" style={{ minHeight: 52 }} value={(recipe as Record<string,unknown>).before_you_begin as string || ''} onChange={e => set('before_you_begin', e.target.value || null)} />
      </div>

      {/* EQUIPMENT */}
      <div>
        <label style={labelStyle}>Equipment</label>
        <input className="input" value={(recipe as Record<string,unknown>).equipment as string || ''} onChange={e => set('equipment', e.target.value || null)} />
      </div>

      {/* INGREDIENTS */}
      <div>
        <label style={labelStyle}>
          Ingredients — {(recipe.ingredient_groups || []).reduce((n, g) => n + g.ingredients.length, 0)} items
        </label>
        {(recipe.ingredient_groups || []).map((g, gi) => (
          <div key={gi} style={{ marginBottom: 10, padding: 10, background: 'var(--cream)', borderRadius: 8 }}>
            <input className="input" style={{ marginBottom: 6, fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-bg)' }}
              placeholder="Group name (optional)" value={g.group_name || ''}
              onChange={e => {
                const gs = [...(recipe.ingredient_groups || [])]; gs[gi] = { ...gs[gi], group_name: e.target.value || null }
                set('ingredient_groups', gs)
              }} />
            {g.ingredients.map((ing: Ingredient, ii: number) => (
              <div key={ii} style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
                <input className="input" style={{ width: 70, flexShrink: 0, fontSize: 13, borderColor: ing.qty === '?' ? 'var(--red)' : undefined }}
                  value={ing.qty} onChange={e => {
                    const gs = [...(recipe.ingredient_groups || [])]; gs[gi].ingredients[ii] = { ...ing, qty: e.target.value }
                    set('ingredient_groups', gs)
                  }} />
                <input className="input" style={{ fontSize: 13 }} value={ing.name} onChange={e => {
                  const gs = [...(recipe.ingredient_groups || [])]; gs[gi].ingredients[ii] = { ...ing, name: e.target.value }
                  set('ingredient_groups', gs)
                }} />
                <button onClick={() => {
                  const gs = [...(recipe.ingredient_groups || [])]; gs[gi].ingredients = gs[gi].ingredients.filter((_: unknown, j: number) => j !== ii)
                  set('ingredient_groups', gs)
                }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 15, flexShrink: 0 }}>✕</button>
              </div>
            ))}
            <button onClick={() => {
              const gs = [...(recipe.ingredient_groups || [])]; gs[gi].ingredients.push({ qty: '', name: '' })
              set('ingredient_groups', gs)
            }} style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', marginTop: 2 }}>+ Add</button>
          </div>
        ))}
        {(recipe.ingredient_groups || []).some(g => g.ingredients.some((i: Ingredient) => i.qty === '?')) && (
          <p style={{ fontSize: 11, color: 'var(--red)' }}>⚠️ Some quantities need review — marked in red</p>
        )}
      </div>

      {/* STEPS */}
      <div>
        <label style={labelStyle}>
          Instructions — {(recipe.step_groups || []).reduce((n, g) => n + g.steps.length, 0)} steps
        </label>
        {(recipe.step_groups || []).map((g, gi) => (
          <div key={gi} style={{ marginBottom: 10, padding: 10, background: 'var(--cream)', borderRadius: 8 }}>
            <input className="input" style={{ marginBottom: 6, fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-bg)' }}
              placeholder="Section name (optional)" value={g.group_name || ''}
              onChange={e => {
                const gs = [...(recipe.step_groups || [])]; gs[gi] = { ...gs[gi], group_name: e.target.value || null }
                set('step_groups', gs)
              }} />
            {g.steps.map((s: Step, si: number) => (
              <div key={si} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'flex-start' }}>
                <span style={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic', color: 'var(--accent)', fontSize: 16, minWidth: 20, paddingTop: 8, flexShrink: 0 }}>{s.num}</span>
                <input className="input" style={{ width: 72, flexShrink: 0 }} placeholder="Time" value={s.time || ''}
                  onChange={e => {
                    const gs = [...(recipe.step_groups || [])]; gs[gi].steps[si] = { ...s, time: e.target.value || null }
                    set('step_groups', gs)
                  }} />
                <textarea className="input" style={{ minHeight: 52, fontSize: 13 }} value={s.text}
                  onChange={e => {
                    const gs = [...(recipe.step_groups || [])]; gs[gi].steps[si] = { ...s, text: e.target.value }
                    set('step_groups', gs)
                  }} />
                <button onClick={() => {
                  const gs = [...(recipe.step_groups || [])]; gs[gi].steps = gs[gi].steps.filter((_: unknown, j: number) => j !== si).map((st: Step, i: number) => ({ ...st, num: i + 1 }))
                  set('step_groups', gs)
                }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 15, paddingTop: 8, flexShrink: 0 }}>✕</button>
              </div>
            ))}
            <button onClick={() => {
              const gs = [...(recipe.step_groups || [])]; const n = (gs[gi].steps[gs[gi].steps.length - 1]?.num || 0) + 1
              gs[gi].steps.push({ num: n, time: null, text: '' })
              set('step_groups', gs)
            }} style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', marginTop: 2 }}>+ Add step</button>
          </div>
        ))}
      </div>

      {/* NOTES + STORAGE */}
      <div>
        <label style={labelStyle}>Notes <span style={{ fontWeight: 400, textTransform: 'none' }}>(one per line)</span></label>
        <textarea className="input" style={{ minHeight: 52 }} value={((recipe as Record<string,unknown>).notes as string[] || []).join('\n')} onChange={e => set('notes', e.target.value ? e.target.value.split('\n') : null)} />
      </div>
      <div>
        <label style={labelStyle}>Storage</label>
        <textarea className="input" style={{ minHeight: 48 }} value={(recipe as Record<string,unknown>).storage as string || ''} onChange={e => set('storage', e.target.value || null)} />
      </div>

      {/* GALLERY */}
      <div>
        <label style={labelStyle}>Additional Photos <span style={{ fontWeight: 400, textTransform: 'none' }}>(gallery)</span></label>
        {(recipe.gallery_urls || []).length > 0 && (
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 8 }}>
            {(recipe.gallery_urls || []).map((url, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 7 }} onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }} />
                <button onClick={() => set('gallery_urls', (recipe.gallery_urls || []).filter((_, j) => j !== i))}
                  style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            ))}
          </div>
        )}
        <div onClick={() => galleryRef.current?.click()} onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleGalleryUpload(f) }}
          style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: '8px 12px', textAlign: 'center', cursor: 'pointer', background: 'var(--cream)', fontSize: 12, color: 'var(--muted)' }}>
          <input ref={galleryRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleGalleryUpload(f) }} style={{ display: 'none' }} />
          {galleryUploading ? '⟳ Uploading...' : '+ Add photo to gallery'}
        </div>
      </div>

      {/* SAVE BUTTON */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
        {onCancel && <button onClick={onCancel} className="btn btn-ghost">Cancel</button>}
        <button onClick={onSave} className="btn btn-green" disabled={saving || !sourceOk}
          style={{ opacity: !sourceOk ? .45 : 1 }}>
          {saving ? '⟳ Saving...' : '✓ Save to Library'}
        </button>
      </div>

    </div>
  )
}
