'use client'

import { useEffect, useState } from 'react'

type Me = { user?: { role?: string; nickname?: string } }

export default function MakeGMButton() {
  const [isGM, setIsGM] = useState(false)
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState('')
  const [secret, setSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [meNick, setMeNick] = useState('')

  // Mostra il bottone solo ai GM
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        if (!res.ok) return
        const js: Me = await res.json()
        if (!alive) return
        const role = (js?.user?.role || '').toLowerCase()
        setIsGM(role === 'gm')
        setMeNick(js?.user?.nickname || '')
      } catch {}
    })()
    return () => { alive = false }
  }, [])

  if (!isGM) return null

  async function submit() {
    const n = nickname.trim()
    const s = secret.trim()
    if (!n || !s) {
      alert('Inserisci nickname e password.')
      return
    }
    if (n === meNick) {
      const ok = confirm('Stai promuovendo te stesso. Confermi?')
      if (!ok) return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/make-gm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: n, password: s }),
      })
      const js = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(js?.error || 'Errore promozione')
      alert(`✅ ${n} è stato promosso a GM`)
      setOpen(false)
      setNickname('')
      setSecret('')
    } catch (e: any) {
      alert(e?.message || 'Errore promozione')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-2">
      <button className="btn w-full" onClick={()=>setOpen(true)}>👑 Promuovi a GM</button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setOpen(false)} />
          <div className="relative z-[101] w-[90vw] max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <div className="text-lg font-semibold">Promuovi utente a GM</div>

            <div>
              <div className="label">Nickname account</div>
              <input
                className="input"
                placeholder="es. SirGalahad"
                value={nickname}
                onChange={e=>setNickname(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <div className="label">Password segreta</div>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={secret}
                onChange={e=>setSecret(e.target.value)}
              />
              <div className="text-xs text-zinc-500 mt-1">
                Deve combaciare con il segreto usato dal tuo endpoint <code>/api/admin/make-gm</code>.
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button className="btn !bg-zinc-800" onClick={()=>setOpen(false)} disabled={loading}>Annulla</button>
              <button className="btn" onClick={submit} disabled={loading}>{loading ? 'Invio…' : 'Conferma'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
