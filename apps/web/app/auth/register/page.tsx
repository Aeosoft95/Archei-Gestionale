'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nickname }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Registrazione fallita')

      // opzionale: ruolo locale
      // localStorage.setItem('archei:role', 'player')

      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Errore di registrazione')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center">
      <div className="w-full max-w-md card space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Crea account</h1>
          <p className="text-sm text-zinc-400">Registrati ad Archei web</p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-700 bg-red-900/20 p-2 text-red-300 text-sm">
            {error}
          </div>
        )}

        <form className="space-y-3" onSubmit={onSubmit}>
          <div>
            <div className="label">Nickname</div>
            <input
              className="input"
              placeholder="Username"
              value={nickname}
              onChange={e=>setNickname(e.target.value)}
              required
            />
          </div>
          <div>
            <div className="label">Email</div>
            <input
              className="input"
              type="email"
              placeholder="cazzo@palle.com"
              value={email}
              onChange={e=>setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <div className="label">Password</div>
            <input
              className="input"
              type="password"
              placeholder="Minimo 8 caratteri"
              value={password}
              onChange={e=>setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button className="btn w-full" type="submit" disabled={loading}>
            {loading ? 'Registrazione…' : 'Registrati'}
          </button>
        </form>

        <div className="text-sm text-zinc-400">
          Hai già un account?{' '}
          <a href="/auth/login" className="text-indigo-400 underline">
            Accedi
          </a>
        </div>
      </div>
    </div>
  )
}
