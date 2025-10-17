'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function DashboardPage() {
  const [role, setRole] = useState<'gm' | 'player'>('player')
  const [nickname, setNickname] = useState<string | null>(null)

  useEffect(() => {
    try {
      const r = (localStorage.getItem('archei:role') || 'player') as 'gm' | 'player'
      setRole(r === 'gm' ? 'gm' : 'player')
      const nick = localStorage.getItem('archei:nickname')
      if (nick) setNickname(nick)
    } catch {}
  }, [])

  const isGM = role === 'gm'

  const playerCards = [
    { href: '/tools/chat', label: 'Chat (Player)', icon: '💬' },
    { href: '/player', label: 'Dashboard Giocatore', icon: '🏠' },
    { href: '/player/scheda', label: 'Scheda del Personaggio', icon: '🧙‍♀️' },
    { href: '/player/inventario', label: 'Inventario', icon: '🎒' },
    { href: '/player/note', label: 'Note Personali', icon: '📝' },
  ]

  const gmCards = [
    { href: '/gm/chat', label: 'Chat (GM)', icon: '🗨️' },
    { href: '/gm/editor-clock', label: 'Editor Clock', icon: '⏲️' },
    { href: '/gm/editor-scene', label: 'Editor Scene', icon: '🎬' },
    { href: '/gm/npc', label: 'Generatore NPC', icon: '🧑‍🤝‍🧑' },
    { href: '/gm/generatore-mostri', label: 'Generatore Mostri', icon: '🐉' },
    { href: '/gm/notes', label: 'Note (GM)', icon: '🗒️' },
  ]

  return (
    <main className="max-w-5xl mx-auto p-6">
      {/* Header identico per tipografia/spaziatura alla GM Dashboard */}
      <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
      <p className="text-zinc-400 mb-6">
        Pannello rapido per la sessione.
        {nickname ? (
          <>
            {' '}Benvenutə, <span className="text-zinc-200 font-medium">{nickname}</span> — Ruolo:{' '}
            <span className="text-zinc-200 font-medium">{isGM ? 'GM' : 'Player'}</span>
          </>
        ) : (
          <>
            {' '}Ruolo: <span className="text-zinc-200 font-medium">{isGM ? 'GM' : 'Player'}</span>
          </>
        )}
      </p>

      {/* Sezione Player: stessa griglia e card della GM Dashboard */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {playerCards.map((c) => (
          <Link key={c.href} href={c.href} className="card hover:bg-zinc-900/80 transition">
            <div className="text-3xl mb-2">{c.icon}</div>
            <div className="text-lg font-semibold">{c.label}</div>
            <div className="text-xs text-zinc-400 mt-1">{c.href}</div>
          </Link>
        ))}
      </div>

      {/* Sezione GM: visibile solo se il ruolo è GM, stessa UI della tua GM Dashboard */}
      {isGM && (
        <>
          <h2 className="text-sm uppercase tracking-wide text-zinc-400 mb-3">GM</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {gmCards.map((c) => (
              <Link key={c.href} href={c.href} className="card hover:bg-zinc-900/80 transition">
                <div className="text-3xl mb-2">{c.icon}</div>
                <div className="text-lg font-semibold">{c.label}</div>
                <div className="text-xs text-zinc-400 mt-1">{c.href}</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
