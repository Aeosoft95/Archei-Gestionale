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
    setError(null); setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Errore di login')

      const { user } = data
      // Salva info per header/side
      localStorage.setItem('archei:role', user.role || 'player')
      localStorage.setItem('archei:nickname', user.nickname || 'Player')
      localStorage.setItem('archei:email', user.email || '')

      // Redirect in base al ruolo (richiesto)
      if ((user.role || 'player') === 'gm') router.replace('/gm')
      else router.replace('/dashboard')
    } catch (err:any) {
      setError(err?.message || 'Errore di login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-sm mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-2">Accedi</h1>
      <p className="text-zinc-400 mb-4">Inserisci credenziali per continuare.</p>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <div className="label">Email</div>
          <input className="input w-full" value={email} onChange={e=>setEmail(e.target.value)} />
        </div>
        <div>
          <div className="label">Password</div>
          <input className="input w-full" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        </div>

        {error && <div className="text-sm text-red-400">{error}</div>}

        <button className="btn w-full" disabled={loading}>
          {loading ? 'Accesso…' : 'Accedi'}
        </button>

        <a href="/auth/register" className="text-sm text-indigo-400 underline block mt-2">
          Non hai un account? Registrati
        </a>
      </form>
    </main>
  )
}
