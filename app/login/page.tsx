'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
    if (res.ok) {
      const from = searchParams.get('from') || '/'
      router.push(from)
    } else {
      setError('Incorrect username or password')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleLogin}>
      <input
        type="text"
        className="input"
        style={{ marginBottom: 10, fontSize: 16 }}
        placeholder="Username"
        value={username}
        onChange={e => setUsername(e.target.value)}
        autoComplete="username"
        autoFocus
      />
      <input
        type="password"
        className="input"
        style={{ marginBottom: 12, fontSize: 16 }}
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        autoComplete="current-password"
      />
      {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: 15 }} disabled={loading}>
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--card)', borderRadius: 20, padding: '40px 36px', maxWidth: 380, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,.08)' }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 700, marginBottom: 6, textAlign: 'center' }}>Recipe Collector</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, textAlign: 'center', marginBottom: 32 }}>Sign in to continue</p>
        <Suspense fallback={<div />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
