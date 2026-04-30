'use client'
import { useEffect, useState } from 'react'
import { MealPrep } from '@/lib/types'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function MealPrepListPage() {
  const router = useRouter()
  const [preps, setPreps] = useState<MealPrep[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/meal-preps').then(r => r.json()).then(d => { setPreps(d.meal_preps || []); setLoading(false) })
  }, [])

  const createPrep = async () => {
    const name = prompt('Meal prep name (e.g. Week of April 28):')
    if (!name) return
    const res = await fetch('/api/meal-preps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, sessions: [] }) })
    const data = await res.json()
    router.push('/meal-prep/' + data.meal_prep.id)
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px 80px' }}>
      {/* NAV */}
      <div style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)', margin: '0 -16px 28px', padding: '0 16px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', height: 52, display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto' }}>
          <Link href="/" style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--muted)', textDecoration: 'none', whiteSpace: 'nowrap' }}>All Recipes</Link>
          <Link href="/" style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--muted)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Collections</Link>
          <Link href="/" style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--muted)', textDecoration: 'none', whiteSpace: 'nowrap' }}>Menus</Link>
          <Link href="/meal-prep-list" style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--accent)', textDecoration: 'none', background: 'var(--accent-bg)', whiteSpace: 'nowrap' }}>🥘 Meal Prep</Link>
          <Link href="/research" style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--muted)', textDecoration: 'none', whiteSpace: 'nowrap' }}>🔬 Research</Link>
          <Link href="/saved-articles" style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--muted)', textDecoration: 'none', whiteSpace: 'nowrap' }}>📌 Saved Articles</Link>
          <div style={{ marginLeft: 'auto' }}>
            <Link href="/import" className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap' }}>+ Add Recipe</Link>
          </div>
        </div>
      </div>


      <div style={{ padding: '28px 0 24px', borderBottom: '1px solid var(--border)', marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 700 }}>Meal Prep</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>Plan your prep sessions and generate shopping lists</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
<button onClick={createPrep} className="btn btn-primary btn-sm">+ New Plan</button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : preps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🥘</div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, marginBottom: 8 }}>No meal preps yet</h2>
          <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 24 }}>Create a meal prep plan to organize your weekly cooking sessions</p>
          <button onClick={createPrep} className="btn btn-primary">+ New Plan</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {preps.map(prep => (
            <Link href={'/meal-prep/' + prep.id} key={prep.id} style={{ textDecoration: 'none' }}>
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '20px 22px', cursor: 'pointer', transition: 'transform .18s, box-shadow .18s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 32px rgba(0,0,0,.1)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🥘</div>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{prep.name}</div>
                {prep.date && <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>📅 {prep.date}</div>}
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {prep.sessions.length} session{prep.sessions.length !== 1 ? 's' : ''} · {prep.sessions.reduce((n, s) => n + s.recipes.length, 0)} recipes
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
