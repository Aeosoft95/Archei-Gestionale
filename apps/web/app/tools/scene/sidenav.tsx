'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function SideNav() {
  const [role, setRole] = useState<'gm' | 'player'>('player')
  useEffect(() => {
    const r = (localStorage.getItem('archei:role') as 'gm' | 'player') || 'player'
    setRole(r)
  }, [])
  const isGM = role === 'gm'

  return (
    <nav className="flex flex-col gap-2">
      {isGM && <Link href="/gm" className="btn !bg-zinc-800">GM Dashboard</Link>}
      <Link href="/tools/chat" className="btn">Chat</Link>

      {isGM && (
        <>
          <div className="label mt-2">Strumenti GM</div>
          <Link href="/gm/scene" className="btn">Scene</Link>
          <Link href="/gm/clock" className="btn">Clock</Link>
          <Link href="/gm/npc" className="btn">Generatore NPC</Link>
          <Link href="/gm/monsters" className="btn">Generatore Mostri</Link>
          <Link href="/gm/notes" className="btn">Note</Link>

          <div className="label mt-2">Display</div>
          <Link href="/display" className="btn !bg-zinc-700">Display (locale)</Link>
          <Link href="/display-online" className="btn !bg-zinc-700">Display (online)</Link>
        </>
      )}
    </nav>
  )
}
