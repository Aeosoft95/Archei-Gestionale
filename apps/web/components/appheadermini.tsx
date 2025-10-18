'use client'

import { useEffect, useState } from 'react'
import LogoutButton from '@/components/LogoutButton'
import BackButton from '@/components/BackButton'

type Me = { id:number; email:string; nickname:string; role:'gm'|'player'|string }

export default function AppHeaderMini() {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let aborted = false
    async function load() {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        if (!res.ok) throw new Error('no session')
        const data = await res.json()
        if (aborted) return
        const user = data?.user as Me
        setMe(user)

        // 🔁 Sync nei storage per WS/chat
        try {
          if (user?.nickname) localStorage.setItem('archei:nick', user.nickname)
          if (user?.role) localStorage.setItem('archei:role', user.role === 'gm' ? 'gm' : 'player')
        } catch {}
      } catch {
        setMe(null)
      } finally {
        if (!aborted) setLoading(false)
      }
    }
    load()
    return () => { aborted = true }
  }, [])

  return (
    <div className="border-b border-zinc-800 p-3 flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-2">
        <BackButton />
      </div>

      <div className="text-sm text-zinc-300">
        {loading ? (
          <span className="text-zinc-500">Caricamento…</span>
        ) : me ? (
          <>
            Utente: <span className="text-zinc-100 font-medium">{me.nickname}</span>{' '}
            <span className="mx-2">•</span>
            Ruolo: <span className="text-zinc-100 font-medium">{me.role === 'gm' ? 'GM' : 'Player'}</span>
          </>
        ) : (
          <span className="text-zinc-500">Non autenticato</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <LogoutButton />
      </div>
    </div>
  )
}
