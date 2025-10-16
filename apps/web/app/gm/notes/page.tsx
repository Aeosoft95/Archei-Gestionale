'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useWS } from '@/components/ws/WSProvider'

// Chiave base (verrà “namespaced” per room)
const LS_NOTES = 'archei:gm:notes'
const keyFor = (base: string, room?: string) => `${base}:${room || 'default'}`

export default function GmNotesPage() {
  const { config, connected, connecting, error, openSetup } = useWS()
  const room = config?.room || 'default'

  // NOTE
  const [notes, setNotes] = useState('')

  // Debounce salvataggi
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleSave = (fn:()=>void) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(fn, 300)
  }

  // Ruolo
  useEffect(()=>{ localStorage.setItem('archei:role','gm') }, [])

  // Ripristino per stanza
  useEffect(()=>{ try{
    const n = localStorage.getItem(keyFor(LS_NOTES, room))
    setNotes(n || '')
  }catch{} }, [room])

  // Persistenza (debounced) per stanza
  useEffect(()=>{ scheduleSave(()=> {
    localStorage.setItem(keyFor(LS_NOTES, room), notes)
  }) }, [notes, room])

  // Salva anche quando cambi scheda o chiudi
  useEffect(() => {
    const persistNow = () => {
      localStorage.setItem(keyFor(LS_NOTES, room), notes)
    }
    const onVis = () => persistNow()
    const onUnload = () => persistNow()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [notes, room])

  // Stato WS
  const status = useMemo(() => {
    const color = connecting ? 'bg-yellow-500' : connected ? 'bg-green-500' : error ? 'bg-red-500' : 'bg-zinc-600'
    const label = connecting ? 'conn…' : connected ? 'online' : (error ? 'errore' : 'offline')
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <div className={`w-2.5 h-2.5 rounded-full ${color}`} />{label}
      </div>
    )
  }, [connected, connecting, error])

  // Azioni extra (opzionali ma utili)
  function copyToClipboard(){
    try {
      navigator.clipboard.writeText(notes || '')
      alert('Note copiate negli appunti.')
    } catch {
      alert('Non è stato possibile copiare negli appunti.')
    }
  }
  function downloadTxt(){
    const blob = new Blob([notes || ''], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const date = new Date().toISOString().slice(0,10)
    a.download = `Note-GM-${room}-${date}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen flex flex-col gap-4">
      {/* TOPBAR */}
      <div className="border-b border-zinc-800 p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold">Archei Companion — Note (GM)</div>
          <button className="btn !bg-zinc-800" onClick={openSetup}>WS</button>
          {status}
        </div>
        <div className="text-xs text-zinc-500">Stanza: <span className="text-zinc-300">{room}</span></div>
      </div>

      {/* CONTENUTO */}
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Appunti di sessione</div>
            <div className="flex gap-2">
              <button
                className="btn"
                onClick={copyToClipboard}
                title="Copia negli appunti"
              >
                Copia
              </button>
              <button
                className="btn"
                onClick={downloadTxt}
                title="Scarica .txt"
              >
                Scarica .txt
              </button>
              <button
                className="btn !bg-zinc-800"
                onClick={()=>{
                  if (confirm('Sicuro di svuotare le note per questa stanza?')) setNotes('')
                }}
                title="Svuota note"
              >
                Svuota
              </button>
            </div>
          </div>

          <textarea
            className="input min-h-[60vh]"
            value={notes}
            onChange={e=>setNotes(e.target.value)}
            placeholder="Appunta qui le tue note: riassunto sessione, ganci, countdown, ricompense, condizioni dei PNG, promemoria per la prossima volta..."
          />

          <div className="text-xs text-zinc-500 flex items-center justify-between">
            <span>Salvataggio automatico per stanza (localStorage)</span>
            <span>Consiglio: usa “Scarica .txt” a fine sessione per archiviare.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
