'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Me = { ok:boolean; user?:{ id:number; nickname:string } }
type MySession = { code:string; name:string; description?:string; kind?:string; role:'gm'|'player'; created_at:string }

export default function SessionsHome() {
  const [loading, setLoading] = useState(true)
  const [logged, setLogged] = useState(false)
  const [nick, setNick] = useState<string>('')
  const [sessions, setSessions] = useState<MySession[]>([])

  // form create
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [kind, setKind] = useState('')

  // form join
  const [joinCode, setJoinCode] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const r = await fetch('/api/auth/me', { cache: 'no-store' })
        if (!r.ok) return
        const js: Me = await r.json()
        if (!alive) return
        if (js.ok && js.user) {
          setLogged(true)
          setNick(js.user.nickname || 'Player')
          // carica le mie sessioni
          const s = await fetch('/api/sessions/my', { cache: 'no-store' }).then(r=>r.ok?r.json():null)
          if (s?.ok) setSessions(s.sessions || [])
        }
      } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [])

  async function onCreate() {
    const body = { name, description: desc, kind }
    const r = await fetch('/api/sessions/create', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)
    })
    const js = await r.json()
    if (!js?.ok) { alert(js?.error || 'Errore creazione'); return }
    // vai in area GM di quella stanza
    location.href = `/gm?code=${encodeURIComponent(js.code)}`
  }

  async function onJoin() {
    const r = await fetch('/api/sessions/join', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code: joinCode })
    })
    const js = await r.json()
    if (!js?.ok) { alert(js?.error || 'Codice non valido'); return }
    if (js.role === 'gm') {
      location.href = `/gm?code=${encodeURIComponent(js.code)}`
    } else {
      location.href = `/tools/chat?code=${encodeURIComponent(js.code)}`
    }
  }

  return (
    <main className="min-h-screen max-w-6xl mx-auto px-4 py-10 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold">Le tue sessioni</h1>
          <p className="text-zinc-400">Crea una stanza o entra con un codice.</p>
        </div>
        <div>
          {loading ? (
            <div className="text-sm text-zinc-500">Verifica sessione…</div>
          ) : logged ? (
            <div className="text-sm text-zinc-400">Ciao, <span className="font-semibold text-zinc-200">{nick}</span></div>
          ) : (
            <Link href="/auth/login" className="btn">Accedi</Link>
          )}
        </div>
      </header>

      {/* CREA NUOVA SESSIONE */}
      <section className="card">
        <div className="font-semibold mb-2">Crea nuova sessione</div>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <div className="label">Nome sessione</div>
            <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Es. Campagna Estiva" />
          </div>
          <div>
            <div className="label">Tipo sessione</div>
            <input className="input" value={kind} onChange={e=>setKind(e.target.value)} placeholder="Es. Campagna / One-shot" />
          </div>
          <div>
            <div className="label">Descrizione</div>
            <input className="input" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Opzionale" />
          </div>
        </div>
        <div className="mt-3">
          <button className="btn" onClick={onCreate} disabled={!logged || !name.trim()}>Crea nuova sessione</button>
        </div>
      </section>

      {/* ENTRA IN SESSIONE */}
      <section className="card">
        <div className="font-semibold mb-2">Entra in una sessione esistente</div>
        <div className="grid md:grid-cols-[240px_1fr] gap-3">
          <div>
            <div className="label">Codice sessione</div>
            <input className="input uppercase" value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} placeholder="Es. 9KZ7F2QH" />
          </div>
          <div className="flex items-end">
            <button className="btn" onClick={onJoin} disabled={!logged || !joinCode.trim()}>Entra</button>
          </div>
        </div>
        <div className="text-xs text-zinc-500 mt-2">Il creatore della stanza vede sempre il codice nella sua area GM.</div>
      </section>

      {/* LE MIE SESSIONI */}
      <section className="card">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Le mie sessioni</div>
          <Link href="/tools/chat" className="btn !bg-zinc-800">Apri chat generica</Link>
        </div>
        {sessions.length === 0 ? (
          <div className="text-sm text-zinc-500 mt-2">Nessuna sessione ancora. Crea la tua stanza o unisciti con un codice.</div>
        ) : (
          <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sessions.map(s => (
              <div key={s.code} className="rounded-xl border border-zinc-800 p-3 bg-zinc-900/40">
                <div className="text-xs text-zinc-500">{s.role === 'gm' ? 'GM' : 'Player'}</div>
                <div className="font-semibold">{s.name}</div>
                {s.description && <div className="text-sm text-zinc-400">{s.description}</div>}
                <div className="text-xs text-zinc-500 mt-1">Codice: <span className="font-mono">{s.code}</span></div>
                <div className="flex gap-2 mt-3">
                  {s.role === 'gm' ? (
                    <Link className="btn" href={`/gm?code=${encodeURIComponent(s.code)}`}>Apri come GM</Link>
                  ) : (
                    <Link className="btn" href={`/tools/chat?code=${encodeURIComponent(s.code)}`}>Apri come Player</Link>
                  )}
                  <Link className="btn !bg-zinc-800" href={`/tools/chat?code=${encodeURIComponent(s.code)}`}>Chat</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
