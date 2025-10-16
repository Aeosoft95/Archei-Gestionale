'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function SideNav() {
  const pathname = usePathname()
  const [role, setRole] = useState<'gm' | 'player'>('player')

  // Leggi il ruolo salvato localmente (GM/Player)
  useEffect(() => {
    try {
      const r = (localStorage.getItem('archei:role') || 'player') as 'gm' | 'player'
      setRole(r === 'gm' ? 'gm' : 'player')
    } catch {}
  }, [])

  const isGM = role === 'gm'

  const linkCls = (href: string) =>
    `btn justify-start ${pathname === href ? '!bg-teal-600 text-white' : ''}`

  return (
    <nav className="flex flex-col gap-2">
      {/* Player */}
      <Link href="/tools/chat" className={linkCls('/tools/chat')}>Chat (Player)</Link>

      {/* GM: visibile solo se role === 'gm' */}
      {isGM && (
        <>
          <div className="mt-3 text-xs uppercase tracking-wide text-zinc-400">GM</div>
          <Link href="/gm" className={linkCls('/gm')}>📊 Dashboard GM</Link>
          <Link href="/gm/chat" className={linkCls('/gm/chat')}>💬 Chat GM</Link>
          <Link href="/gm/editor-scene" className={linkCls('/gm/editor-scene')}>🎬 Editor Scene</Link>
          <Link href="/gm/editor-clock" className={linkCls('/gm/editor-clock')}>🕑 Editor Clock</Link>
        </>
      )}
    </nav>
  )
}
