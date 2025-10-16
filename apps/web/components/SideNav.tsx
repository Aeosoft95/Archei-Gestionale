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
      {/* Player */}
      <Link href="/tools/chat" className="btn">Chat (Player)</Link>

      {/* GM */}
      {isGM && (
        <>
          <div className="label mt-2">GM</div>
		  <Link href="/gm" className="btn !bg-zinc-800">GM Dashboard</Link>
          <Link href="/gm/chat" className="btn">Chat (GM)</Link>
		  <Link href="/gm/editor-clock" className="btn">Editor Clock (GM)</Link>
        </>
      )}

      {/* (Opzionale) voci display, se le tieni ancora */}
      {/* <div className="label mt-2">Display</div>
      <Link href="/display" className="btn !bg-zinc-700">Display (locale)</Link>
      <Link href="/display-online" className="btn !bg-zinc-700">Display (online)</Link> */}
    </nav>
  )
}
