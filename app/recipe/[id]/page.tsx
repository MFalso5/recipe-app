'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Recipe, MadeItEntry } from '@/lib/types'
import RecipeCard from '@/components/RecipeCard'
import Link from 'next/link'


async function uploadImageToBlob(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('image', file)
  const res = await fetch('/api/upload-image', { method: 'POST', body: fd })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.url
}

export default function RecipePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [favorited, setFavorited] = useState(false)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const saveTimeout = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetch('/api/recipes/' + params.id)
      .then(r => r.json())
      .then(d => { setRecipe(d.recipe); setFavorited(d.recipe?.favorited || false); setLoading(false) })
  }, [params.id])

  const saveRecipe = (updated: Recipe) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => {
      fetch('/api/recipes/' + params.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      })
    }, 600)
  }

  const toggleMade = async () => {
    if (!recipe) return
    const updated = { ...recipe, made: !recipe.made }
    setRecipe(updated)
    saveRecipe(updated)
  }

  const updateLog = (log: MadeItEntry[]) => {
    if (!recipe) return
    const updated = { ...recipe, made_log: log, made: log.length > 0 }
    setRecipe(updated)
    saveRecipe(updated)
  }

  const updateIngredientNote = (gi: number, ii: number, note: string) => {
    if (!recipe) return
    const groups = recipe.ingredient_groups.map((g, gIdx) => ({
      ...g,
      ingredients: g.ingredients.map((ing, iIdx) =>
        gIdx === gi && iIdx === ii ? { ...ing, note: note || null } : ing
      )
    }))
    const updated = { ...recipe, ingredient_groups: groups }
    setRecipe(updated)
    saveRecipe(updated)
  }

  const updateStepNote = (gi: number, si: number, note: string) => {
    if (!recipe) return
    const groups = recipe.step_groups.map((g, gIdx) => ({
      ...g,
      steps: g.steps.map((s, sIdx) =>
        gIdx === gi && sIdx === si ? { ...s, note: note || null } : s
      )
    }))
    const updated = { ...recipe, step_groups: groups }
    setRecipe(updated)
    saveRecipe(updated)
  }

  const deleteRecipe = async () => {
    if (!confirm('Delete this recipe? This cannot be undone.')) return
    setDeleting(true)
    await fetch('/api/recipes/' + params.id, { method: 'DELETE' })
    router.push('/')
  }

  const shareRecipe = async () => {
    // Get or generate a share token
    const res = await fetch('/api/recipes/' + params.id + '/share', { method: 'POST' })
    const data = await res.json()
    const url = window.location.origin + '/share/' + data.token
    if (navigator.share) {
      await navigator.share({ title: recipe?.title || "Recipe", url })
    } else {
      await navigator.clipboard.writeText(url)
      alert('Link copied! Paste it into a text or email.')
    }
  }

  const exportText = () => {
    if (!recipe) return
    const lines: string[] = []
    lines.push(recipe.title)
    lines.push('='.repeat(recipe.title.length))
    lines.push('')
    if (recipe.source) lines.push('Source: ' + recipe.source)
    if (recipe.yield) lines.push('Yield: ' + recipe.yield)
    if (recipe.time_active) lines.push('Time: ' + recipe.time_active)
    if (recipe.temperature) lines.push('Temp: ' + recipe.temperature)
    lines.push('')
    if (recipe.description) { lines.push(recipe.description); lines.push('') }
    if (recipe.before_you_begin) { lines.push('Before You Begin: ' + recipe.before_you_begin); lines.push('') }
    recipe.ingredient_groups.forEach(g => {
      if (g.group_name) lines.push('--- ' + g.group_name + ' ---')
      g.ingredients.forEach(i => {
        lines.push(i.qty + '  ' + i.name)
        if (i.note) lines.push('    Note: ' + i.note)
      })
      lines.push('')
    })
    recipe.step_groups.forEach(g => {
      if (g.group_name) lines.push('--- ' + g.group_name + ' ---')
      g.steps.forEach(s => {
        lines.push(s.num + '. ' + (s.time ? '[' + s.time + '] ' : '') + s.text)
        if (s.note) lines.push('    Note: ' + s.note)
      })
      lines.push('')
    })
    if (recipe.notes?.length) { lines.push('Notes:'); recipe.notes.forEach(n => lines.push('- ' + n)); lines.push('') }
    if (recipe.storage) { lines.push('Storage: ' + recipe.storage); lines.push('') }
    if (recipe.made_log?.length) {
      lines.push('Made it log:')
      recipe.made_log.forEach(e => lines.push('- ' + e.date + (e.note ? ' — ' + e.note : '')))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = recipe.title.replace(/[^a-z0-9]/gi, '-').toLowerCase() + '.txt'
    a.click()
  }

  const exportJSON = () => {
    if (!recipe) return
    const blob = new Blob([JSON.stringify(recipe, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = recipe.title.replace(/[^a-z0-9]/gi, '-').toLowerCase() + '.json'
    a.click()
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="spinner" />
    </div>
  )

  if (!recipe) return (
    <div style={{ textAlign: 'center', padding: 80 }}>
      <p>Recipe not found.</p>
      <Link href="/" className="btn btn-ghost" style={{ marginTop: 16, display: 'inline-flex' }}>Back to Library</Link>
    </div>
  )

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px 80px' }}>

      <div className="no-print" style={{ padding: '20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <Link href="/" className="btn btn-ghost btn-sm">Back to Library</Link>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <details style={{ position: 'relative' }}>
            <summary className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', listStyle: 'none' }}>↓ Export</summary>
            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 6, minWidth: 160, zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,.1)' }}>
              <button onClick={() => window.print()} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, textAlign: 'left', fontFamily: 'inherit', borderRadius: 6 }}>🖨 Print / PDF</button>
              <button onClick={exportText} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, textAlign: 'left', fontFamily: 'inherit', borderRadius: 6 }}>📄 Plain Text</button>
              <button onClick={exportJSON} style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, textAlign: 'left', fontFamily: 'inherit', borderRadius: 6 }}>💾 JSON Backup</button>
            </div>
          </details>
          <button onClick={async () => {
            const next = !favorited
            setFavorited(next)
            await fetch('/api/recipes/' + params.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ favorited: next }) })
          }} style={{
            background: favorited ? '#FEF9C3' : 'var(--card)', border: '0.5px solid ' + (favorited ? '#FDE047' : 'var(--border)'),
            borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
            color: favorited ? '#854D0E' : 'var(--muted)', fontWeight: favorited ? 600 : 400
          }}>
            {favorited ? '★' : '☆'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={shareRecipe}>🔗 Share</button>
          <Link href={'/recipe/' + params.id + '/edit'} className="btn btn-ghost btn-sm">✏️ Edit</Link>
          <button className="btn btn-danger btn-sm" onClick={deleteRecipe} disabled={deleting}>{deleting ? '...' : '🗑 Delete'}</button>
        </div>
      </div>

      <RecipeCard
        recipe={recipe}
        onToggleMade={toggleMade}
        onUpdateLog={updateLog}
        onUpdateIngredientNote={updateIngredientNote}
        onUpdateStepNote={updateStepNote}
      />

    </div>
  )
}
