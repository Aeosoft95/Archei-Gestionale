'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Login fallito')

      // opzionale: salva il ruolo locale se ti serve (GM/Player)
      // localStorage.setItem('archei:role', data.role ?? 'player')

      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Errore di login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center">
      <div className="w-full max-w-md card space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Accedi</h1>
          <p className="text-sm text-zinc-400">Entra in Archei Companion</p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-700 bg-red-900/20 p-2 text-red-300 text-sm">
            {error}
          </div>
        )}

        <form className="space-y-3" onSubmit={onSubmit}>
          <div>
            <div className="label">Email</div>
            <input
              className="input"
              type="email"
              placeholder="tu@esempio.com"
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
              placeholder="••••••••"
              value={password}
              onChange={e=>setPassword(e.target.value)}
              required
            />
          </div>

          <button className="btn w-full" type="submit" disabled={loading}>
            {loading ? 'Accesso…' : 'Accedi'}
          </button>
        </form>

        <div className="text-sm text-zinc-400">
          Non hai un account?{' '}
          <a href="/auth/register" className="text-indigo-400 underline">
            Registrati
          </a>
        </div>
      </div>
    </div>
  )
}
