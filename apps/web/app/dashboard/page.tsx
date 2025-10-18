'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import SideNav from '@/components/SideNav'

export default function PlayerDashboard() {
  const router = useRouter()
  const [role, setRole] = useState<'gm' | 'player'>('player')
  const [nickname, setNickname] = useState<string>('Player')

  useEffect(() => {
    try {
      const r = (localStorage.getItem('archei:role') || 'player') as 'gm' | 'player'
      setRole(r === 'gm' ? 'gm' : 'player')
      const nick = localStorage.getItem('archei:nickname') || 'Player'
      setNickname(nick)
    } catch {}
  }, [])

  async function doLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    try {
      localStorage.removeItem('archei:role')
      localStorage.removeItem('archei:nickname')
    } catch {}
    router.push('/auth/login')
  }

  const cards = [
    { href: '/tools/chat', label: 'Chat (Player)', icon: '🗨️' },
    { href: '/player/scheda', label: 'Scheda Personaggio', icon: '📜' },
    { href: '/player/inventario', label: 'Inventario', icon: '🎒' },
    { href: '/player/notes', label: 'Note Personali', icon: '📝' },
    { href: '/player/dashboard', label: 'Dashboard Player', icon: '🧭' }, // questa stessa pagina
  ]

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      {/* SIDENAV: stessa del GM, sempre visibile */}
      <aside className="border-r border-zinc-800 p-3">
        <SideNav />
      </aside>

      {/* COLONNA CONTENUTO */}
      <div className="flex flex-col">
        {/* Topbar con Indietro + Logout (uguale al GM) */}
        <div className="border-b border-zinc-800 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              className="btn !bg-zinc-800"
              onClick={() => router.back()}
              title="Indietro"
            >
              ← Indietro
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">
              Utente: <span className="text-zinc-200 font-medium">{nickname}</span>
            </span>
            <span className="text-xs text-zinc-500">
              Ruolo: <span className="text-zinc-200 font-medium">{role === 'gm' ? 'GM' : 'Player'}</span>
            </span>
            <button className="btn !bg-red-700 hover:!bg-red-600" onClick={doLogout}>
              Esci
            </button>
          </div>
        </div>

        {/* Contenuto (stesso stile della GM Dashboard) */}
        <main className="max-w-5xl mx-auto p-6 w-full">
          <h1 className="text-3xl font-bold mb-1">Player Dashboard</h1>
          <p className="text-zinc-400 mb-6">Benvenuto, {nickname}! Accesso rapido agli strumenti del giocatore.</p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((c) => (
              <Link key={c.href} href={c.href} className="card hover:bg-zinc-900/80 transition">
                <div className="text-3xl mb-2">{c.icon}</div>
                <div className="text-lg font-semibold">{c.label}</div>
                <div className="text-xs text-zinc-400 mt-1">{c.href}</div>
              </Link>
            ))}
          </div>

          {/* Nota informativa se l’utente è GM ma sta guardando la dashboard player */}
          {role === 'gm' && (
            <div className="mt-6 rounded-xl border border-zinc-800 p-4 bg-zinc-900/40">
              <div className="text-sm text-zinc-300">
                Stai visualizzando la <span className="font-semibold">dashboard Player</span> come GM.
                La struttura è identica alla pagina GM per coerenza di UI.
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
