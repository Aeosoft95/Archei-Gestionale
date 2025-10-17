'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const qs = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const signupOk = qs.get('signup') === 'ok'

  useEffect(() => {
    if (signupOk) {
      // piccolo messaggio post-registrazione (facoltativo)
      setError(null)
    }
  }, [signupOk])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Login fallito')
      // vai alla dashboard / pagina di default
      location.href = '/'
    } catch (err:any) {
      setError(err?.message || 'Errore')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-sm card space-y-4">
        <div className="text-2xl font-bold">Accedi</div>

        {signupOk && (
          <div className="text-sm text-green-400">
            Registrazione completata! Ora effettua il login.
          </div>
        )}
        {error && <div className="text-sm text-red-400">{error}</div>}

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <div className="label">Email</div>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={e=>setEmail(e.target.value)}
              placeholder="tu@email.com"
            />
          </div>
          <div>
            <div className="label">Password</div>
            <input
              className="input"
              type="password"
              required
              value={password}
              onChange={e=>setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button className="btn w-full" type="submit" disabled={loading}>
            {loading ? 'Accesso…' : 'Accedi'}
          </button>
        </form>

        {/* QUI il tasto/link per la registrazione */}
        <div className="text-sm text-zinc-400 text-center">
          Non hai un account?{' '}
          <Link href="/auth/register" className="text-indigo-400 underline">
            Crea un account
          </Link>
        </div>
      </div>
    </div>
  )
}
