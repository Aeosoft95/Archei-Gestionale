'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterPage(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [err, setErr] = useState<string>()
  const r = useRouter()

  async function submit(){
    setErr(undefined)
    const res = await fetch('/api/auth/register', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ email, password, nickname }),
    })
    const j = await res.json()
    if(!res.ok){ setErr(j.error||'Errore'); return }
    r.replace('/player/dashboard')
  }

  return (
    <div className="p-6 max-w-md mx-auto space-y-3">
      <h1 className="text-2xl font-bold">Crea account</h1>
      <input className="input" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input className="input" type="password" placeholder="Password (min 6)" value={password} onChange={e=>setPassword(e.target.value)} />
      <input className="input" placeholder="Nickname" value={nickname} onChange={e=>setNickname(e.target.value)} />
      {err && <div className="text-red-400 text-sm">{err}</div>}
      <button className="btn w-full" onClick={submit}>Registrati</button>
    </div>
  )
}
