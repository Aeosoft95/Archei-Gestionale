'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

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
      // La route API setta il cookie di sessione: vai alla dashboard (o dove preferisci)
      router.replace('/dashboard')
    } catch (err:any) {
      setError(err.message || 'Errore')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md card space-y-4">
        <h1 className="text-xl font-semibold">Crea un nuovo account</h1>

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 text-sm text-red-300 p-2">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <div className="label">Email</div>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e=>setEmail(e.target.value)}
              placeholder="tu@esempio.com"
              required
            />
          </div>

          <div>
            <div className="label">Password</div>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e=>setPassword(e.target.value)}
              placeholder="min 6 caratteri"
              required
            />
          </div>

          <div>
            <div className="label">Nickname</div>
            <input
              className="input"
              value={nickname}
              onChange={e=>setNickname(e.target.value)}
              placeholder="nome in gioco"
              required
            />
          </div>

          <button className="btn w-full" type="submit" disabled={loading}>
            {loading ? 'Registrazione…' : 'Registrati'}
          </button>
        </form>

        <div className="text-sm text-zinc-400">
          Hai già un account?{' '}
          <a href="/auth/login" className="text-indigo-400 underline">Accedi</a>
        </div>
      </div>
    </div>
  )
}
