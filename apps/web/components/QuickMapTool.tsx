// apps/web/components/QuickMapTool.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useWS } from '@/components/ws/WSProvider'
import MapBoard from '@/components/MapBoard'

export default function QuickMapTool() {
  const { config } = useWS()
  const [role, setRole] = useState<'gm'|'player'>('player')

  // prendi il ruolo reale dal server
  useEffect(() => {
    let alive = true
    fetch('/api/auth/me')
      .then(r => (r.ok ? r.json() : null))
      .then(d=>{
        if (!alive || !d?.ok) return
        const r = (d.user?.role as 'gm'|'player') || 'player'
        setRole(r)
      }).catch(()=>{})
    return () => { alive = false }
  }, [])

  const room = config?.room || 'global'

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Mappa (room: <span className="text-teal-400">{room}</span>)</div>
        <Link className="btn" href={`/table/${room}`} target="_blank">Apri vista completa</Link>
      </div>

      {/* embed con altezza contenuta */}
      <MapBoard roomId={room} role={role} embedHeight={280} />

      <div className="text-xs text-zinc-500">
        Pan: Alt+Drag o tasto centrale • Zoom: rotellina. Solo il GM può disegnare.
      </div>
    </div>
  )
}
