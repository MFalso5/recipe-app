'use client'
import Link from 'next/link'

export default function SettingsPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <div style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 20px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700, textDecoration: 'none', color: 'var(--ink)' }}>Recipe Collector</Link>
          <Link href="/" className="btn btn-ghost btn-sm">← Library</Link>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px 80px' }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 700, marginBottom: 6 }}>Settings</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 32 }}>Manage your recipe library</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* LIBRARY MANAGEMENT */}
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Library</div>

          <SettingsCard
            icon="🏷"
            title="Bulk Tag Editor"
            description="Update tags across all recipes at once — fix inconsistencies, add tiers"
            href="/bulk-tags"
          />

          <SettingsCard
            icon="📁"
            title="Import from Google Drive"
            description="Browse your Google Docs and import recipes directly"
            href="/import/google-docs"
          />

          <SettingsCard
            icon="📂"
            title="Batch Import"
            description="Import multiple recipes at once from photos, PDFs, or Word documents"
            href="/import/batch"
          />

          {/* COMING SOON */}
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginTop: 16, marginBottom: 4 }}>Coming Soon</div>

          <SettingsCard icon="💰" title="Cost per Serving" description="Track ingredient costs and calculate cost per serving" disabled />
          <SettingsCard icon="🥗" title="Nutrition Information" description="Add nutritional data to your recipes" disabled />
          <SettingsCard icon="⚖️" title="Recipe Scaling" description="Scale recipes up or down automatically" disabled />
          <SettingsCard icon="🥫" title="Pantry & Equipment" description="Track what spices, ingredients and equipment you have" disabled />
          <SettingsCard icon="🔬" title="Recipe Analyzer" description="Compare similar recipes side-by-side for recipe development" disabled />
          <SettingsCard icon="🔐" title="Login & Access" description="Password protect your recipe collection" disabled />
          <SettingsCard icon="🎨" title="Appearance" description="Customize colors, fonts and layout" disabled />
        </div>
      </div>
    </div>
  )
}

function SettingsCard({ icon, title, description, href, disabled }: {
  icon: string
  title: string
  description: string
  href?: string
  disabled?: boolean
}) {
  const inner = (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
      padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16,
      opacity: disabled ? .5 : 1,
      transition: disabled ? 'none' : 'transform .15s, box-shadow .15s',
      cursor: disabled ? 'default' : 'pointer'
    }}
      onMouseEnter={e => { if (!disabled) { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,.08)' } }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--tag)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>{description}</div>
      </div>
      {!disabled && <div style={{ fontSize: 18, color: 'var(--muted)' }}>→</div>}
      {disabled && <div style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--tag)', padding: '2px 8px', borderRadius: 50 }}>Soon</div>}
    </div>
  )

  if (href && !disabled) return <Link href={href} style={{ textDecoration: 'none' }}>{inner}</Link>
  return inner
}
