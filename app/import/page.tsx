'use client'
import * as React from 'react'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Recipe } from '@/lib/types'
import RecipeCard from '@/components/RecipeCard'
import RecipeReviewPanel from '@/components/RecipeReviewPanel'
import Link from 'next/link'

function LinkedRecipePicker({ name, onLink }: { name: string, onLink: (id: string, title: string) => void }) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState(name)
  const [results, setResults] = React.useState<{ id: string, title: string, source: string }[]>([])

  React.useEffect(() => {
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

async function compressImage(file: File, maxSizeKB = 1500): Promise<File> {
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
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      let quality = 0.85
      const tryCompress = () => {
        canvas.toBlob(blob => {
          if (!blob) { resolve(file); return }
          if (blob.size / 1024 <= maxSizeKB || quality <= 0.4) {
            resolve(new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' }))
          } else {
            quality -= 0.1
            tryCompress()
          }
        }, 'image/jpeg', quality)
      }
      tryCompress()
    }
    img.onerror = () => resolve(file)
    img.src = url
  })
}


type Step = 'import' | 'loading' | 'review' | 'card'
type ImportMode = 'url' | 'image' | 'document' | 'text'

type ParsedRecipe = Omit<Recipe, 'id' | 'made' | 'created_at' | 'updated_at'>


function BatchUrlInputs({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  const [urls, setUrls] = React.useState<string[]>([''])

  const update = (newUrls: string[]) => {
    setUrls(newUrls)
    onChange(newUrls.filter(u => u.trim()).join('\n'))
  }

  const set = (i: number, val: string) => {
    const next = [...urls]
    next[i] = val
    update(next)
  }

  const remove = (i: number) => {
    if (urls.length === 1) { update(['']); return }
    update(urls.filter((_, j) => j !== i))
  }

  const addRow = () => update([...urls, ''])

  const handlePaste = (i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text')
    const lines = pasted.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean)
    if (lines.length > 1) {
      e.preventDefault()
      const next = [...urls]
      next.splice(i, 1, ...lines)
      update([...next, ''])
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {urls.map((url, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: url.trim() ? 'var(--accent)' : 'var(--tag)', color: url.trim() ? '#fff' : 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
            {i + 1}
          </div>
          <input
            className="input"
            style={{ flex: 1, fontFamily: 'monospace', fontSize: 13 }}
            placeholder="https://..."
            value={url}
            onChange={e => set(i, e.target.value)}
            onPaste={e => handlePaste(i, e)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); addRow() }
              if (e.key === 'Backspace' && !url && urls.length > 1) { e.preventDefault(); remove(i) }
            }}
          />
          <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16, padding: '0 4px', flexShrink: 0, opacity: urls.length === 1 && !url ? 0.3 : 1 }}>✕</button>
        </div>
      ))}
      <button onClick={addRow} style={{ alignSelf: 'flex-start', background: 'none', border: '1.5px dashed var(--border)', borderRadius: 8, padding: '6px 14px', fontSize: 13, color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', marginTop: 2 }}>
        + Add URL
      </button>
    </div>
  )
}

export default function ImportPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('import')
  const [mode, setMode] = useState<ImportMode>('url')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [docFiles, setDocFiles] = useState<File[]>([])
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null)
  const [availableImages, setAvailableImages] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loadingMsg, setLoadingMsg] = useState('Reading your recipe...')
  const fileRef = useRef<HTMLInputElement>(null)
  const docRef = useRef<HTMLInputElement>(null)

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming) return
    const imgs = Array.from(incoming).filter(f => f.type.startsWith('image/'))
    setFiles(prev => [...prev, ...imgs])
  }

  const startParse = async () => {
    setError('')
    if (mode === 'url' && !url.trim()) { setError('Please enter a URL.'); return }
    if (mode === 'image' && !files.length) { setError('Please upload at least one image.'); return }
    if (mode === 'document' && !docFiles.length) { setError('Please upload at least one document.'); return }
    if (mode === 'text' && !text.trim()) { setError('Please paste the recipe text.'); return }

    setStep('loading')
    const msgs = ['Reading your recipe...', 'Identifying ingredients...', 'Structuring the steps...', 'Applying your formatting...']
    let mi = 0
    const rot = setInterval(() => { mi = (mi + 1) % msgs.length; setLoadingMsg(msgs[mi]) }, 3500)

    try {
      let res: Response

      if (mode === 'url') {
        res = await fetch('/api/parse-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
      } else if (mode === 'image') {
        const fd = new FormData()
        const compressed = await Promise.all(files.map(f => compressImage(f)))
        compressed.forEach(f => fd.append('images', f))
        // Also upload first image to blob for use as recipe photo
        try {
          const imgUrl = await uploadImageToBlob(compressed[0])
          fd.append('hero_image_url', imgUrl)
        } catch { /* non-fatal */ }
        res = await fetch('/api/parse-image', { method: 'POST', body: fd })
      } else if (mode === 'document') {
        const fd = new FormData()
        docFiles.forEach(f => fd.append('documents', f))
        res = await fetch('/api/parse-document', { method: 'POST', body: fd })
      } else if (mode === 'text') {
        res = await fetch('/api/parse-text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
      } else {
        res = await fetch('/api/parse-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
      }

      const data = await res.json()
      clearInterval(rot)

      if (!res.ok || data.error) throw new Error(data.error || 'Parse failed')
      setParsed(data.recipe)
      setAvailableImages(data.images || [])
      setStep('review')
    } catch (e: unknown) {
      clearInterval(rot)
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
      setStep('import')
    }
  }

  const saveAndView = async () => {
    if (!parsed) return
    const recipe: Recipe = {
      ...parsed,
      id: crypto.randomUUID(),
      made: false,
      tags: parsed.tags || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    const res = await fetch('/api/recipes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(recipe) })
    const data = await res.json()
    router.push('/recipe/' + data.recipe.id)
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '0 16px 80px' }}>

      <div style={{ padding: '28px 0 24px', borderBottom: '1px solid var(--border)', marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 700 }}>Add Recipe</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>Import from a URL, photo, or pasted text</p>
        </div>
        <Link href="/import/batch" className="btn btn-ghost btn-sm">Batch Import</Link>
          <Link href="/import/google-docs" className="btn btn-ghost btn-sm">📁 Google Drive</Link>
          <Link href="/" className="btn btn-ghost btn-sm">← Library</Link>
      </div>

      <div className="step-bar">
        {(['import','review','card'] as const).map((s, i) => {
          const labels = ['Import', 'Review & Edit', 'Recipe Card']
          const current = ['import','loading'].includes(step) ? 0 : step === 'review' ? 1 : 2
          return (
            <span key={s} style={{ display: 'contents' }}>
              <div className={'step-dot' + (current === i ? ' active' : current > i ? ' done' : '')}>
                <div className="dot">{current > i ? '✓' : i + 1}</div>
                <span>{labels[i]}</span>
              </div>
              {i < 2 && <div className={'step-line' + (current > i ? ' done' : '')} />}
            </span>
          )
        })}
      </div>

      {step === 'import' && (
        <div className="card-shell">
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            {(['url','image','document','text'] as ImportMode[]).map(m => {
              const labels: Record<ImportMode, string> = { url: 'URL', image: 'Photo', document: 'PDF / Doc', text: 'Paste Text' }
              const icons: Record<ImportMode, string> = { url: '🔗', image: '📷', document: '📄', text: '📋' }
              return (
                <button key={m} onClick={() => setMode(m)} style={{
                  flex: 1, padding: '14px 0', fontSize: 14, fontWeight: 500,
                  background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  borderBottom: mode === m ? '2px solid var(--accent)' : '2px solid transparent',
                  color: mode === m ? 'var(--accent)' : 'var(--muted)', marginBottom: -1
                }}>{icons[m]} {labels[m]}</button>
              )
            })}
          </div>

          <div style={{ padding: 24 }}>
            {mode === 'url' && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Recipe URL</div>
                <input className="input" type="url" placeholder="https://www.example.com/my-recipe" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && startParse()} />
              </div>
            )}

            {mode === 'image' && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Upload Photos</div>
                <div onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
                  style={{ border: '2px dashed var(--border)', borderRadius: 12, padding: '28px 20px', textAlign: 'center', cursor: 'pointer' }}>
                  <input ref={fileRef} type="file" accept="image/*" multiple onChange={e => handleFiles(e.target.files)} style={{ display: 'none' }} />
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📷</div>
                  <p style={{ fontSize: 14, color: 'var(--muted)' }}><strong style={{ color: 'var(--accent)' }}>Tap to choose</strong> or drag and drop</p>
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, opacity: .7 }}>JPG, PNG, HEIC - Multiple pages OK</p>
                </div>
                {files.length > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {files.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, background: 'var(--cream)', borderRadius: 8 }}>
                        <img src={URL.createObjectURL(f)} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{f.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{(f.size / 1024).toFixed(0)} KB{files.length > 1 ? ' - Page ' + (i + 1) : ''}</div>
                        </div>
                        <button onClick={() => setFiles(files.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, padding: 4 }}>x</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}


            {mode === 'document' && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Upload Documents</div>
                <div onClick={() => docRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = Array.from(e.dataTransfer.files); setDocFiles(prev => [...prev, ...f]) }}
                  style={{ border: '2px dashed var(--border)', borderRadius: 12, padding: '28px 20px', textAlign: 'center', cursor: 'pointer' }}>
                  <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.txt" multiple onChange={e => { if (e.target.files) setDocFiles(prev => [...prev, ...Array.from(e.target.files!)]) }} style={{ display: 'none' }} />
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                  <p style={{ fontSize: 14, color: 'var(--muted)' }}><strong style={{ color: 'var(--accent)' }}>Tap to choose</strong> or drag and drop</p>
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, opacity: .7 }}>PDF, Word (.docx), or text files · Multiple files OK</p>
                </div>
                {docFiles.length > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {docFiles.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, background: 'var(--cream)', borderRadius: 8 }}>
                        <div style={{ width: 48, height: 48, background: 'var(--tag)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                          {f.name.endsWith('.pdf') ? '📕' : f.name.endsWith('.docx') || f.name.endsWith('.doc') ? '📘' : '📄'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{f.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{(f.size / 1024).toFixed(0)} KB</div>
                        </div>
                        <button onClick={() => setDocFiles(docFiles.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, padding: 4 }}>x</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}


            {mode === 'urls' && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>
                  Batch URL Import
                </div>
                <BatchUrlInputs value={text} onChange={setText} />
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
                  Each URL imports separately — review each one before saving.
                </p>
              </div>
            )}

            {mode === 'text' && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Paste Recipe Text</div>
                <textarea className="input" style={{ minHeight: 200 }} placeholder="Paste the full recipe text here..." value={text} onChange={e => setText(e.target.value)} />
              </div>
            )}

            {error && (
              <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--red-bg)', border: '1px solid #FECACA', borderRadius: 10, fontSize: 13, color: 'var(--red)' }}>
                {error}
              </div>
            )}
          </div>

          <div style={{ padding: '16px 24px', background: 'var(--cream)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={startParse}>Parse Recipe</button>
          </div>
        </div>
      )}

      {step === 'loading' && (
        <div className="card-shell" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontSize: 15, fontWeight: 500 }}>{loadingMsg}</p>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>This usually takes 15-25 seconds</p>
        </div>
      )}

      {step === 'review' && parsed && (
        <div className="card-shell" style={{ padding: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16 }}>Review & Edit</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setStep('card')}>👁 Preview Card</button>
          </div>
          <RecipeReviewPanel
            recipe={parsed}
            pageImages={availableImages}
            onChange={(updated) => setParsed(updated as ParsedRecipe)}
            onSave={saveAndView}
            onCancel={() => setStep('import')}
          />
        </div>
      )}

      {step === 'card' && parsed && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }} className="no-print">
            <button className="btn btn-ghost" onClick={() => setStep('review')}>Back to Edit</button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => window.print()}>Print</button>
              <button className="btn btn-green" onClick={saveAndView}>Save to Library</button>
            </div>
          </div>
          <RecipeCard recipe={{ ...parsed, id: 'preview', made: false, created_at: '', updated_at: '' }} />
        </div>
      )}
    </div>
  )
}


async function uploadImageToBlob(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('image', file)
  const res = await fetch('/api/upload-image', { method: 'POST', body: fd })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.url
}


