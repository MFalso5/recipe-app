'use client'
import * as React from 'react'
import { Recipe, MadeItEntry } from '@/lib/types'
import { useState } from 'react'
import Link from 'next/link'

interface Props {
  recipe: Recipe
  onToggleMade?: () => void
  onUpdateLog?: (log: MadeItEntry[]) => void
  onUpdateFavorite?: (favorited: boolean) => void
  onUpdateIngredientNote?: (gi: number, ii: number, note: string) => void
  onUpdateStepNote?: (gi: number, si: number, note: string) => void
  onUpdateStepPhoto?: (gi: number, si: number, url: string) => void
  printMode?: boolean
}


function AiSuggestions({ recipe, note }: { recipe: Recipe, note: string }) {
  const [suggestions, setSuggestions] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [asked, setAsked] = React.useState(false)

  const ask = async () => {
    setLoading(true); setAsked(true)
    try {
      const ingredientList = recipe.ingredient_groups
        .flatMap(g => g.ingredients)
        .map(i => i.qty + ' ' + i.name)
        .join(', ')

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `I made "${recipe.title}" and want to make changes. Here are my thoughts: "${note || 'No specific notes yet'}"

Recipe ingredients: ${ingredientList}

Please give me 3-5 specific, practical suggestions for improving this recipe based on my notes. For each suggestion include the specific quantity change or technique adjustment. Keep it concise and actionable. Format as a simple numbered list.`
          }]
        })
      })
      const data = await res.json()
      const text = data.content?.map((b: { type: string; text?: string }) => b.type === 'text' ? b.text : '').join('') || ''
      setSuggestions(text)
    } catch {
      setSuggestions('Unable to get suggestions. Try again.')
    }
    setLoading(false)
  }

  if (!asked) return (
    <button onClick={ask} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent-bg)', border: '1px solid var(--accent)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
      ✨ Ask Claude for suggestions
    </button>
  )

  if (loading) return (
    <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--card)', borderRadius: 8, fontSize: 13, color: 'var(--muted)' }}>
      ✨ Thinking...
    </div>
  )

  if (!suggestions) return null

  return (
    <div style={{ marginTop: 8, padding: '12px 14px', background: 'var(--card)', border: '1px solid var(--accent)', borderRadius: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>✨ Claude's Suggestions</div>
      <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{suggestions}</div>
      <button onClick={ask} style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>↺ Ask again</button>
    </div>
  )
}

export default function RecipeCard({ recipe: r, onToggleMade, onUpdateLog, onUpdateFavorite, onUpdateIngredientNote, onUpdateStepNote, onUpdateStepPhoto, printMode }: Props) {
  const [made, setMade] = useState(r.made)
  const [favorited, setFavorited] = useState(r.favorited || false)
  const [log, setLog] = useState<MadeItEntry[]>(r.made_log || [])
  const [showLogForm, setShowLogForm] = useState(false)
  const [logNote, setLogNote] = useState('')
  const [logRating, setLogRating] = useState<MadeItEntry['rating']>(null)
  const [editingIngNote, setEditingIngNote] = useState<string | null>(null)
  const [editingStepNote, setEditingStepNote] = useState<string | null>(null)
  const [heroImg, setHeroImg] = useState(r.image_url)

  const handleFavorite = () => {
    const next = !favorited
    setFavorited(next)
    onUpdateFavorite?.(next)
  }

  const handleMade = () => {
    const next = !made
    setMade(next)
    if (next) setShowLogForm(true)
    onToggleMade?.()
  }

  const addLogEntry = () => {
    const entry: MadeItEntry = { id: crypto.randomUUID(), date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), note: logNote.trim() || null, rating: logRating }
    const newLog = [entry, ...log]
    setLog(newLog); setLogNote(''); setLogRating(null); setShowLogForm(false)
    onUpdateLog?.(newLog)
  }

  const removeLogEntry = (id: string) => {
    const newLog = log.filter(e => e.id !== id)
    setLog(newLog); onUpdateLog?.(newLog)
  }

  const allImages = [r.image_url, ...(r.gallery_urls || [])].filter(Boolean) as string[]

  return (
    <div className="recipe-card">

      {/* HEADER */}
      <div className="rc-header" style={!heroImg ? { gridTemplateColumns: '1fr' } : undefined}>
        <div className="rc-header-text">
          <h2 className="rc-title">{r.title}</h2>
          <div className="meta-row">
            {r.yield && <span className="yield-badge"><span className="yield-label">y=</span><span className="yield-value">{r.yield}</span></span>}
            {r.time_active && <span>⏱ {r.time_active}</span>}
            {r.temperature && <span>🌡 {r.temperature}</span>}
            {r.source && (
              <span>{r.source_url
                ? <a href={r.source_url} target="_blank" rel="noreferrer" style={{ color: 'var(--muted)', textDecoration: 'none' }}>📖 {r.source}{r.page_number ? ' · ' + r.page_number : ''}</a>
                : <span style={{ color: 'var(--muted)' }}>📖 {r.source}{r.page_number ? ' · ' + r.page_number : ''}</span>}
              </span>
            )}
            {!printMode && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <label className={'made-badge' + (made ? ' checked' : '')} onClick={handleMade} style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={made} onChange={() => {}} style={{ pointerEvents: 'none' }} />
                  {made ? 'Made it' : 'Made it'}
                </label>
                <button onClick={handleFavorite} style={{ background: favorited ? '#FEF9C3' : 'var(--tag)', border: '0.5px solid ' + (favorited ? '#FDE047' : 'var(--border)'), borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 14, lineHeight: 1, color: favorited ? '#854D0E' : 'var(--muted)', fontWeight: favorited ? 700 : 400 }}>
                  {favorited ? <span>&#9733;</span> : <span>&#9734;</span>}
                </button>
              </div>
            )}
          </div>
          {/* TAGS — Tier 1 + Tier 2 prominent, dietary smaller */}
          {((r.tags || []).length > 0 || (r.dietary_tags || []).length > 0) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8, alignItems: 'center' }}>
              {(r.tags || []).filter(t => ['Pie','Cake','Cookies','Bread','Pasta','Soup','Salad','Appetizer','Side','Main','Sauce','Drink','Breakfast','Snack'].includes(t)).map(t => (
                <span key={t} style={{ background: 'var(--accent-bg)', color: 'var(--accent)', borderRadius: 50, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{t}</span>
              ))}
              {(r.tags || []).filter(t => ['Sweet','Savory'].includes(t)).map(t => (
                <span key={t} style={{ background: 'var(--tag)', color: 'var(--muted)', borderRadius: 50, padding: '2px 10px', fontSize: 11, fontWeight: 500 }}>{t}</span>
              ))}
              {(r.tags || []).filter(t => !['Pie','Cake','Cookies','Bread','Pasta','Soup','Salad','Appetizer','Side','Main','Sauce','Drink','Breakfast','Snack','Sweet','Savory'].includes(t)).map(t => (
                <span key={t} style={{ background: 'var(--tag)', color: 'var(--muted)', borderRadius: 50, padding: '2px 10px', fontSize: 11, fontWeight: 400 }}>{t}</span>
              ))}
              {(r.dietary_tags || []).map(t => (
                <span key={t} style={{ background: 'var(--green-bg)', color: 'var(--green)', borderRadius: 50, padding: '2px 9px', fontSize: 10, fontWeight: 500 }}>{t}</span>
              ))}
            </div>
          )}
        </div>
        {heroImg && (
          <div className="rc-header-img">
            <img src={heroImg} alt={r.title} />
          </div>
        )}
      </div>

      {/* MADE IT LOG — single unified section */}
      {!printMode && (showLogForm || log.length > 0) && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '16px 22px', background: 'var(--accent-bg)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>Made it log</div>

          {/* EXISTING ENTRIES */}
          {log.map(entry => {
            const ratingInfo = {
              'would-make-again': { label: '⭐ Make again', color: 'var(--green)' },
              'make-with-changes': { label: '✏️ Make again with changes', color: 'var(--accent)' },
              'wouldnt-make-again': { label: "✕ Wouldn't make again", color: '#ef4444' }
            }
            const rating = entry.rating ? ratingInfo[entry.rating as keyof typeof ratingInfo] : null
            return (
              <div key={entry.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{entry.date}</span>
                  {rating && <span style={{ fontSize: 11, fontWeight: 600, color: rating.color, background: rating.color + '15', padding: '2px 10px', borderRadius: 50 }}>{rating.label}</span>}
                  <button onClick={() => removeLogEntry(entry.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 12, marginLeft: 'auto', opacity: .5 }}>✕</button>
                </div>
                {entry.note && <p style={{ fontSize: 13, color: 'var(--ink)', margin: '6px 0 0 0', lineHeight: 1.6 }}>{entry.note}</p>}
              </div>
            )
          })}

          {/* LOG FORM — shown when showLogForm is true */}
          {showLogForm && (
            <div style={{ marginTop: log.length > 0 ? 14 : 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--accent)', marginBottom: 10 }}>
                {log.length === 0 ? 'How did it go?' : 'Log another cook'}
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {([
                  { value: 'would-make-again', label: '⭐ Make again', color: 'var(--green)' },
                  { value: 'make-with-changes', label: '✏️ Make again with changes', color: 'var(--accent)' },
                  { value: 'wouldnt-make-again', label: "✕ Wouldn't make again", color: '#ef4444' },
                ] as const).map(opt => (
                  <button key={opt.value} onClick={() => setLogRating(logRating === opt.value ? null : opt.value)} style={{
                    padding: '6px 14px', borderRadius: 50, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                    background: logRating === opt.value ? opt.color + '20' : 'var(--card)',
                    border: '1.5px solid ' + (logRating === opt.value ? opt.color : 'var(--border)'),
                    color: logRating === opt.value ? opt.color : 'var(--muted)'
                  }}>{opt.label}</button>
                ))}
              </div>
              <textarea style={{ width: '100%', background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)', outline: 'none', resize: 'vertical', minHeight: 60, boxSizing: 'border-box' }}
                placeholder={logRating === 'make-with-changes' ? 'What changes are you thinking? e.g. less salt, add lemon zest' : 'Add a note (optional)'}
                value={logNote} onChange={e => setLogNote(e.target.value)} autoFocus />
              {logRating === 'make-with-changes' && (
                <AiSuggestions recipe={r} note={logNote} />
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={addLogEntry} className="btn btn-primary btn-sm">Log it</button>
                <button onClick={() => { setShowLogForm(false); setLogRating(null); setLogNote('') }} className="btn btn-ghost btn-sm">
                  {log.length === 0 ? 'Skip' : 'Cancel'}
                </button>
              </div>
            </div>
          )}

          {/* ADD ANOTHER button — only when form is hidden and entries exist */}
          {!showLogForm && log.length > 0 && (
            <button onClick={() => setShowLogForm(true)} style={{ marginTop: 10, background: 'none', border: '1.5px dashed var(--border)', borderRadius: 8, padding: '6px 14px', fontSize: 12, color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit' }}>
              + Log another cook
            </button>
          )}
        </div>
      )}

      {/* DESCRIPTION */}
      {r.description && (
        <div className="rc-description">
          <div className="sec-label">About this recipe</div>
          <p className="rc-desc-text" style={{ fontFamily: "'DM Sans', sans-serif", fontStyle: 'normal', fontSize: 14, lineHeight: 1.75, opacity: .85 }}>{r.description}</p>
        </div>
      )}

      {/* BEFORE YOU BEGIN */}
      {r.before_you_begin && <div className="byb-box"><strong>Before You Begin: </strong>{r.before_you_begin}</div>}

      {/* EQUIPMENT */}
      {r.equipment && <div className="equip-box"><span>🍳</span><span><strong>You&apos;ll need: </strong>{r.equipment}</span></div>}

      {/* BODY */}
      <div className="rc-body" style={{ marginTop: 14 }}>

        {/* INGREDIENTS */}
        <div className="rc-ings">
          <div className="col-lbl">Ingredients</div>
          {r.ingredient_groups.map((g, gi) => (
            <div className="ing-group" key={gi}>
              {g.group_name && <div className="grp-lbl">{g.group_name}</div>}
              {g.ingredients.map((ing, ii) => (
                <div key={ii}>
                  {ing.linked_recipe_id ? (
                    <div className="ing-row">
                      <span className="ing-qty">📎</span>
                      <span className="ing-name">
                        <Link href={'/recipe/' + ing.linked_recipe_id} style={{ color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }}>
                          {ing.name} →
                        </Link>
                      </span>
                    </div>
                  ) : (
                    <div className="ing-row">
                      <span className={'ing-qty' + (ing.qty === '?' ? ' ing-qty-alert' : '')}>{ing.qty}</span>
                      <span className="ing-name">{ing.name}</span>
                    </div>
                  )}
                  {!printMode && (
                    <div style={{ paddingLeft: 66, marginBottom: 2 }}>
                      {editingIngNote === `${gi}-${ii}` ? (
                        <input style={{ width: '100%', background: 'var(--tip)', border: '1px solid var(--tip-border)', borderRadius: 6, padding: '4px 8px', fontFamily: 'inherit', fontSize: 12, color: 'var(--tip-text)', outline: 'none' }}
                          placeholder="Add a note..." defaultValue={ing.note || ''} autoFocus
                          onBlur={e => { onUpdateIngredientNote?.(gi, ii, e.target.value); setEditingIngNote(null) }}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { onUpdateIngredientNote?.(gi, ii, (e.target as HTMLInputElement).value); setEditingIngNote(null) } }} />
                      ) : ing.note ? (
                        <div onClick={() => setEditingIngNote(`${gi}-${ii}`)} style={{ fontSize: 12, color: 'var(--tip-text)', background: 'var(--tip)', borderRadius: 6, padding: '3px 8px', cursor: 'text', display: 'inline-block' }}>📝 {ing.note}</div>
                      ) : (
                        <button onClick={() => setEditingIngNote(`${gi}-${ii}`)} style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '2px 0', opacity: .5 }}>+ note</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* STEPS */}
        <div className="rc-steps">
          <div className="col-lbl">Instructions</div>
          {r.step_groups.map((g, gi) => (
            <div key={gi}>
              {g.group_name && <div className="step-sec">{g.group_name}</div>}
              {g.steps.map((s, si) => (
                <div key={si}>
                  <div className="step-row">
                    <div className="step-num-wrap">
                      <span className="step-num">{s.num}</span>
                      {s.time && <span className="step-time">{s.time}</span>}
                    </div>
                    <div className="step-text">{s.text}</div>
                  </div>
                  {/* STEP PHOTO */}
                  {s.photo_url && (
                    <div style={{ paddingLeft: 40, marginBottom: 8 }}>
                      <img src={s.photo_url} alt="" style={{ width: '100%', maxWidth: 240, borderRadius: 8, objectFit: 'cover' }} />
                    </div>
                  )}
                  {!printMode && !s.photo_url && (
                    <div style={{ paddingLeft: 40, marginBottom: 4 }}>
                      <label style={{ fontSize: 11, color: 'var(--muted)', cursor: 'pointer', opacity: .5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        📷 <span>add photo</span>
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const fd = new FormData()
                          fd.append('image', file)
                          const res = await fetch('/api/upload-image', { method: 'POST', body: fd })
                          const data = await res.json()
                          if (data.url) onUpdateStepPhoto?.(gi, si, data.url)
                        }} />
                      </label>
                    </div>
                  )}
                  {/* STEP NOTE */}
                  {!printMode && (
                    <div style={{ paddingLeft: 40, marginBottom: 4 }}>
                      {editingStepNote === `${gi}-${si}` ? (
                        <input style={{ width: '100%', background: 'var(--tip)', border: '1px solid var(--tip-border)', borderRadius: 6, padding: '4px 8px', fontFamily: 'inherit', fontSize: 12, color: 'var(--tip-text)', outline: 'none' }}
                          placeholder="Add a note..." defaultValue={s.note || ''} autoFocus
                          onBlur={e => { onUpdateStepNote?.(gi, si, e.target.value); setEditingStepNote(null) }}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { onUpdateStepNote?.(gi, si, (e.target as HTMLInputElement).value); setEditingStepNote(null) } }} />
                      ) : s.note ? (
                        <div onClick={() => setEditingStepNote(`${gi}-${si}`)} style={{ fontSize: 12, color: 'var(--tip-text)', background: 'var(--tip)', borderRadius: 6, padding: '3px 8px', cursor: 'text', display: 'inline-block' }}>📝 {s.note}</div>
                      ) : (
                        <button onClick={() => setEditingStepNote(`${gi}-${si}`)} style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '2px 0', opacity: .5 }}>+ note</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* NOTES */}
      {r.notes && r.notes.length > 0 && (
        <div className="rc-notes">
          <div className="sec-label" style={{ marginBottom: 10 }}>Notes</div>
          <div className="notes-grid">{r.notes.map((n, i) => <div className="note-item" key={i}>{n}</div>)}</div>
        </div>
      )}

      {/* TIPS */}
      {r.tips && r.tips.length > 0 && (
        <div className="rc-notes">
          <div className="sec-label" style={{ marginBottom: 10 }}>Tips</div>
          <div className="notes-grid">{r.tips.map((t, i) => <div className="note-item" key={i}>{t}</div>)}</div>
        </div>
      )}

      {/* STORAGE */}
      {r.storage && (
        <div className="rc-storage">
          <div className="sec-label" style={{ marginBottom: 6 }}>Storage</div>
          <p>{r.storage}</p>
        </div>
      )}

      {/* PHOTO GALLERY */}
      {allImages.length > 1 && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '16px 22px 20px' }}>
          <div className="sec-label" style={{ marginBottom: 12 }}>Photos <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11, color: 'var(--muted)' }}>— tap to set as main photo</span></div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
            {allImages.map((url, i) => (
              <div key={i} onClick={() => setHeroImg(url)} style={{
                flexShrink: 0, width: 140, height: 105, borderRadius: 10, overflow: 'hidden',
                cursor: 'pointer', border: '2px solid ' + (heroImg === url ? 'var(--accent)' : 'var(--border)'),
                transition: 'border-color .15s', boxShadow: heroImg === url ? '0 0 0 3px var(--accent-bg)' : 'none'
              }}>
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }} />
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
