'use client'

import { useEffect, useState } from 'react'

export default function Home() {
  const [nick, setNick] = useState('')
  const [role, setRole] = useState<'gm' | 'player'>('gm')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setNick(localStorage.getItem('archei:nick') || '')
    setRole((localStorage.getItem('archei:role') as any) || 'gm')
  }, [])

  function enter() {
    if (!nick.trim() || busy) return
    setBusy(true)
    localStorage.setItem('archei:nick', nick.trim())
    localStorage.setItem('archei:role', role)
    location.href = role === 'gm' ? '/gm' : '/tools/chat'
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black" />
      <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full blur-3xl opacity-20 bg-teal-500" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full blur-3xl opacity-20 bg-emerald-600" />

      <div className="relative mx-auto flex min-h-screen max-w-4xl items-center justify-center p-6">
        <div className="w-full rounded-3xl border border-zinc-800/60 bg-zinc-950/60 p-6 shadow-2xl backdrop-blur-md md:p-10">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                ARCHEI Companion
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                Accedi come <span className="text-teal-400 font-medium">{role === 'gm' ? 'GM' : 'Player'}</span> e inizia la sessione.
              </p>
            </div>
            <div className="hidden md:block rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-400">
              v0.2.0 • Next 14
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="label">Nickname</label>
              <div className="mt-1 flex rounded-xl border border-zinc-800 bg-zinc-900/60">
                <div className="flex items-center px-3 text-zinc-500">🙂</div>
                <input
                  className="w-full bg-transparent px-3 py-3 outline-none placeholder:text-zinc-500"
                  placeholder="Es. GM, Player1…"
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && enter()}
                />
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                Suggerimento: usa un nickname univoco per la stanza.
              </p>
            </div>

            <div>
              <label className="label">Ruolo</label>
              <div className="mt-1 grid grid-cols-2 gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
                <button
                  className={`rounded-lg px-3 py-2 text-sm ${role === 'gm' ? 'bg-teal-600 text-white' : 'hover:bg-zinc-800 text-zinc-300'}`}
                  onClick={() => setRole('gm')}
                >
                  GM
                </button>
                <button
                  className={`rounded-lg px-3 py-2 text-sm ${role === 'player' ? 'bg-teal-600 text-white' : 'hover:bg-zinc-800 text-zinc-300'}`}
                  onClick={() => setRole('player')}
                >
                  Player
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              className="btn !bg-zinc-800"
              onClick={() => setNick(role === 'gm' ? 'GM' : 'Player1')}
              type="button"
            >
              Autocompila
            </button>
            <button
              className={`btn ${busy ? '!opacity-80 cursor-not-allowed' : ''}`}
              onClick={enter}
              disabled={busy || !nick.trim()}
            >
              {busy ? 'Entrando…' : 'Entra'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
