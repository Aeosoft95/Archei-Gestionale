'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function SideNav() {
  const pathname = usePathname()
  const [role, setRole] = useState<'gm' | 'player'>('player')

  // ===== NOVITÀ: prova a leggere il ruolo dalla sessione server (/api/auth/me)
  useEffect(() => {
    let alive = true
    fetch('/api/auth/me')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!alive || !data?.ok) return
        const r = (data.user?.role as 'gm' | 'player') || 'player'
        setRole(r)
        // sincronizza anche il vecchio storage (fallback per parti legacy)
        try { localStorage.setItem('archei:role', r) } catch {}
      })
      .catch(() => {
        // se fallisce, resta il fallback sotto
      })
    return () => { alive = false }
  }, [])

  // Leggi il ruolo salvato localmente (GM/Player) — Fallback/Compatibilità
  useEffect(() => {
    try {
      const r = (localStorage.getItem('archei:role') || 'player') as 'gm' | 'player'
      setRole(r === 'gm' ? 'gm' : 'player')
    } catch {}
  }, [])

  const isGM = role === 'gm'

  const linkCls = (href: string) =>
    `btn justify-start ${pathname === href ? '!bg-teal-600 text-white' : ''}`

  // ====== BACKUP / RIPRISTINO ======
  const fileRef = useRef<HTMLInputElement | null>(null)
  const ARCH_PREFIX = 'archei:'

  function buildSnapshot() {
    const data: Record<string, string> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!
      if (k && k.startsWith(ARCH_PREFIX)) {
        const v = localStorage.getItem(k)
        if (v !== null) data[k] = v
      }
    }
    return {
      version: 1,
      createdAt: new Date().toISOString(),
      data,
    }
  }

  function downloadSnapshot() {
    const snap = buildSnapshot()
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    a.href = url
    a.download = `archei-backup-${ts}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function clearArcheiKeys() {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!
      if (k && k.startsWith(ARCH_PREFIX)) keys.push(k)
    }
    keys.forEach(k => localStorage.removeItem(k))
  }

  function restoreFromObject(obj: any) {
    if (!obj || typeof obj !== 'object' || !obj.data || typeof obj.data !== 'object') {
      alert('File di backup non valido.')
      return
    }
    // Rimuovi le chiavi esistenti del namespace per evitare conflitti
    clearArcheiKeys()
    // Ripristina le chiavi
    for (const [k, v] of Object.entries<string>(obj.data)) {
      try { localStorage.setItem(k, v) } catch {}
    }
    alert('Ripristino completato. Ricarico la pagina…')
    location.reload()
  }

  function handleCloseSession() {
    downloadSnapshot()
    // opzionale: chiedi se vuoi azzerare i dati locali dopo il download
    setTimeout(() => {
      if (confirm('Vuoi azzerare i dati locali dopo il download?')) {
        clearArcheiKeys()
        alert('Dati locali azzerati.')
      }
    }, 50)
  }

  function handlePickRestore() {
    fileRef.current?.click()
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result))
        restoreFromObject(obj)
      } catch {
        alert('Impossibile leggere il file di backup.')
      } finally {
        e.target.value = ''
      }
    }
    reader.readAsText(file)
  }

  // Backup automatico ogni 10 minuti (in localStorage, non scarica)
  useEffect(() => {
    const saveAuto = () => {
      try {
        const snap = buildSnapshot()
        localStorage.setItem('archei:autoBackup', JSON.stringify(snap))
      } catch {}
    }
    // salva subito all’avvio
    saveAuto()
    const id = setInterval(saveAuto, 10 * 60 * 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <nav className="flex flex-col gap-2">
      {/* Player */}
	  <Link href="/dashboard" className={linkCls('/dashboard')}>📊 Dashboard Player</Link>
      <Link href="/tools/chat" className={linkCls('/tools/chat')}>💬 Chat</Link>
	  <Link href="/player/sheet" className={linkCls('/player/sheet')}>📜 Scheda Personaggio</Link>
	  <Link href="/player/inventory" className={linkCls('/player/inventory')}>🎒 Inventario</Link>
	  <Link href="/player/notes" className={linkCls('/player/notes')}>📝 Note</Link>

      {/* GM: visibile solo se role === 'gm' */}
      {isGM && (
        <>
          <div className="mt-3 text-xs uppercase tracking-wide text-zinc-400">GM</div>
          <Link href="/gm" className={linkCls('/gm')}>📊 Dashboard GM</Link>
          <Link href="/gm/chat" className={linkCls('/gm/chat')}>💬 Chat GM</Link>
          <Link href="/gm/editor-scene" className={linkCls('/gm/editor-scene')}>🎬 Editor Scene</Link>
          <Link href="/gm/editor-clock" className={linkCls('/gm/editor-clock')}>🕑 Editor Clock</Link>
          <Link href="/gm/npc" className={linkCls('/gm/npc')}>🤖 Generatore NPC</Link>
          <Link href="/gm/generatore-mostri" className={linkCls('/gm/generatore-mostri')}>👹 Generatore Mostri</Link>
          <Link href="/gm/notes" className={linkCls('/gm/notes')}>📝 Note (GM)</Link>
          <Link href="/gm/editor-clock" className={linkCls('/gm/editor-clock')}>💁‍♂️ Gestione Player - Non disp</Link>

          {/* ===== Sezione Sessione (backup globale) ===== */}
          <div className="mt-4 pt-3 border-t border-zinc-800 space-y-2">
            <div className="text-xs uppercase tracking-wide text-zinc-400">Sessione</div>
            <button className="btn !bg-red-600 text-white" onClick={handleCloseSession}>
              ⏹️ Chiudi Sessione
            </button>
            <button className="btn" onClick={handlePickRestore}>
              🔁 Ripristina backup
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={onFileChosen}
            />
          </div>
        </>
      )}
    </nav>
  )
}
