'use client'

import { useEffect, useState } from 'react'

type Me = { nickname: string; role: 'gm'|'player' }

export default function TopBarUser(){
  const [me, setMe] = useState<Me | null>(null)

  useEffect(()=>{
    let alive = true
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!alive || !data?.ok) return
        setMe({ nickname: data.user.nickname, role: data.user.role || 'player' })
      })
      .catch(()=>{})
    return ()=>{ alive=false }
  },[])

  if (!me) return <div className="text-xs text-zinc-400">Utente: — • Ruolo: —</div>
  return (
    <div className="text-xs text-zinc-400">
      Utente: <span className="text-zinc-200">{me.nickname}</span> • Ruolo: <span className="text-zinc-200 uppercase">{me.role}</span>
    </div>
  )
}
