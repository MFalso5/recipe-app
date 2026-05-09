'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const router = useRouter()
  const [currentUsername, setCurrentUsername] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [collectionThreshold, setCollectionThreshold] = useState(3)

  useEffect(() => {
    fetch('/api/auth/credentials').then(r => r.json()).then(d => {
      if (d.username) setCurrentUsername(d.username)
    })
    const saved = localStorage.getItem('collection_threshold')
    if (saved) setCollectionThreshold(parseInt(saved) || 3)
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (!currentPassword) { setError('Please enter your current password'); return }
    if (!newUsername.trim()) { setError('Username cannot be empty'); return }
    if (!newPassword) { setError('Please enter a new password'); return }
    if (newPassword !== confirmPassword) { setError('New passwords do not match'); return }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return }

    setSaving(true)
    const res = await fetch('/api/auth/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newUsername, newPassword })
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(data.error || 'Failed to update credentials')
    } else {
      setMessage('Credentials updated successfully!')
      setCurrentUsername(newUsername)
      setCurrentPassword('')
      setNewUsername('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const labelStyle = { fontSize: 11, fontWeight: 600, letterSpacing: .8, textTransform: 'uppercase' as const, color: 'var(--muted)', display: 'block', marginBottom: 6 }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 16px 80px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 700 }}>Settings</h1>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>Manage your account</p>
          </div>
          <Link href="/" className="btn btn-ghost btn-sm">Back to Library</Link>
        </div>

        {/* CURRENT USER */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>Signed in as</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{currentUsername || 'Loading...'}</div>
            </div>
            <button onClick={handleSignOut} style={{ background: 'var(--tag)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--muted)' }}>
              Sign out
            </button>
          </div>
        </div>

        {/* LIBRARY SETTINGS */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Library Settings</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.6 }}>
            Control how your Collections view is organized.
          </p>
          <div>
            <label style={labelStyle}>Collection Threshold</label>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.6 }}>
              Sources with fewer than <strong>{collectionThreshold}</strong> recipe{collectionThreshold !== 1 ? 's' : ''} are grouped into &ldquo;Blogs &amp; Social&rdquo; instead of getting their own collection.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3, 5, 10].map(n => (
                <button key={n} onClick={() => {
                  setCollectionThreshold(n)
                  localStorage.setItem('collection_threshold', String(n))
                }} style={{
                  width: 44, height: 44, borderRadius: 10, border: '1.5px solid ' + (collectionThreshold === n ? 'var(--accent)' : 'var(--border)'),
                  background: collectionThreshold === n ? 'var(--accent-bg)' : 'var(--cream)',
                  color: collectionThreshold === n ? 'var(--accent)' : 'var(--muted)',
                  fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer'
                }}>{n}</button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, opacity: .7 }}>
              Default is 3. Change takes effect immediately in the Collections view.
            </p>
          </div>
        </div>

        {/* CHANGE CREDENTIALS */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Change Credentials</h2>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Current Password</label>
              <input className="input" type="password" value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Enter current password" autoComplete="current-password" />
            </div>
            <div style={{ height: 1, background: 'var(--border)' }} />
            <div>
              <label style={labelStyle}>New Username</label>
              <input className="input" type="text" value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder={currentUsername || 'New username'} autoComplete="username" />
            </div>
            <div>
              <label style={labelStyle}>New Password</label>
              <input className="input" type="password" value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min 8 characters" autoComplete="new-password" />
            </div>
            <div>
              <label style={labelStyle}>Confirm New Password</label>
              <input className="input" type="password" value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password" autoComplete="new-password" />
            </div>

            {error && <p style={{ fontSize: 13, color: 'var(--red)', margin: 0 }}>{error}</p>}
            {message && <p style={{ fontSize: 13, color: 'var(--green)', margin: 0 }}>{message}</p>}

            <button type="submit" className="btn btn-primary" style={{ padding: '11px' }} disabled={saving}>
              {saving ? 'Saving...' : 'Update Credentials'}
            </button>
          </form>
        </div>

        {/* COMING SOON */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px', marginTop: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Coming Soon</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {['Recipe Scaling', 'Cost per Serving', 'Nutrition Information', 'Pantry & Equipment Tracker', 'Recipe Analyzer'].map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--cream)', borderRadius: 8, opacity: .6 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{item}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, background: 'var(--tag)', color: 'var(--muted)', padding: '2px 8px', borderRadius: 50 }}>Soon</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
