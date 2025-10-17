'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

type PlayerData = { sheet?: any; inventory?: any; notes?: any; lastSeen?: number }

export default function PlayerDashboard(){
  const [data, setData] = useState<PlayerData|null>(null)
  const [err, setErr] = useState<string>()
  const [saving, setSaving] = useState(false)

  async function load(){
    setErr(undefined)
    const res = await fetch('/api/player/data', { cache:'no-store' })
    const j = await res.json()
    if(!res.ok){ setErr(j.error||'Errore'); return }
    setData(j.data as PlayerData)
  }
  useEffect(()=>{ load() }, [])

  async function save(){
    if(!data) return
    setSaving(true)
    const res = await fetch('/api/player/data', {
      method:'PUT', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(data),
    })
    setSaving(false)
    if(!res.ok){
      const j = await res.json()
      setErr(j.error||'Errore salvataggio')
    }
  }

  function downloadExport(){ window.location.href = '/api/player/export' }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>){
    const file = e.target.files?.[0]
    if(!file) return
    const text = await file.text()
    const res = await fetch('/api/player/import', {
      method:'POST', headers:{ 'Content-Type':'application/json' }, body: text,
    })
    if(res.ok) load()
    else {
      const j = await res.json()
      setErr(j.error||'Import fallito')
    }
    e.target.value = ''
  }

  async function logout(){
    await fetch('/api/auth/logout', { method:'POST' })
    window.location.href = '/login'
  }

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard Player</h1>
        <button className="btn !bg-zinc-800" onClick={logout}>Esci</button>
      </div>

      {err && <div className="text-red-400 text-sm">{err}</div>}
      {!data ? <div className="text-sm text-zinc-500">Caricamento…</div> : (
        <>
          <div className="rounded-xl border border-zinc-800 p-3 space-y-2">
            <div className="text-sm text-zinc-400">Ultimo salvataggio: {data.lastSeen ? new Date(data.lastSeen).toLocaleString() : '—'}</div>

            <div className="grid md:grid-cols-3 gap-2">
              <Link href="/player/scheda" className="btn">📜 Scheda</Link>
              <Link href="/player/inventario" className="btn">🎒 Inventario</Link>
              <Link href="/player/note" className="btn">📝 Note</Link>
            </div>

            <div className="grid md:grid-cols-2 gap-2 pt-3 border-t border-zinc-800">
              <button className="btn" onClick={save} disabled={saving}>{saving ? 'Salvo…' : 'Salva adesso'}</button>
              <button className="btn" onClick={downloadExport}>⬇️ Esporta dati</button>
              <label className="btn cursor-pointer">⬆️ Importa dati
                <input type="file" accept="application/json" className="hidden" onChange={onImport}/>
              </label>
            </div>
          </div>

          <div className="text-xs text-zinc-500">I tuoi dati sono salvati sul server e puoi anche esportarli come backup personale.</div>
        </>
      )}
    </div>
  )
}
