'use client'

import { useEffect, useMemo, useState } from 'react'
import { useWS } from '@/components/ws/WSProvider'

type SceneState = { title?: string; text?: string; images?: string[] }
const LS_KEY = 'archei:gm:editor-scene'

export default function EditorScenePage() {
  const { config, connected, connecting, error, openSetup, send } = useWS()

  // stato editor
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [imagesRaw, setImagesRaw] = useState('') // una URL per riga
  const [autopublish, setAutopublish] = useState(true)
  const [announce, setAnnounce] = useState(true)

  // ripristino locale
  useEffect(() => {
    localStorage.setItem('archei:role', 'gm')
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}')
      if (saved.title) setTitle(saved.title)
      if (saved.text) setText(saved.text)
      if (Array.isArray(saved.images)) setImagesRaw(saved.images.join('\n'))
      if (typeof saved.autopublish === 'boolean') setAutopublish(saved.autopublish)
      if (typeof saved.announce === 'boolean') setAnnounce(saved.announce)
    } catch {}
  }, [])

  // persistenza locale
  useEffect(() => {
    const images = imagesRaw.split('\n').map(s => s.trim()).filter(Boolean)
    localStorage.setItem(LS_KEY, JSON.stringify({ title, text, images, autopublish, announce }))
  }, [title, text, imagesRaw, autopublish, announce])

  // stato WS (badge)
  const status = useMemo(() => {
    const color = connecting ? 'bg-yellow-500' : connected ? 'bg-green-500' : error ? 'bg-red-500' : 'bg-zinc-600'
    const label = connecting ? 'conn…' : connected ? 'online' : (error ? 'errore' : 'offline')
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <div className={`w-2.5 h-2.5 rounded-full ${color}`} /> {label}
      </div>
    )
  }, [connected, connecting, error])

  // helpers
  function toSceneState(): SceneState {
    const imgs = imagesRaw.split('\n').map(s => s.trim()).filter(Boolean)
    return {
      title: title.trim() || undefined,
      text: text.trim() || undefined,
      images: imgs.length ? imgs : undefined
    }
  }

  // azioni
  function publishScene(alsoAnnounce = announce) {
    if (!config) return
    const payload = { t: 'DISPLAY_SCENE_STATE', room: config.room, ...toSceneState() }
    send(payload)
    if (alsoAnnounce) {
      const t = payload.title ? `: ${payload.title}` : ''
      send({ t: 'CHAT', room: config.room, nick: 'GM', text: `📜 Scena aggiornata${t}`, ts: Date.now() })
    }
  }

  function clearScene() {
    if (!config) return
    setTitle(''); setText(''); setImagesRaw('')
    send({ t: 'DISPLAY_SCENE_STATE', room: config.room, title: '', text: '', images: [] })
    if (announce) send({ t:'CHAT', room:config.room, nick:'GM', text:'🧹 Scena svuotata', ts:Date.now() })
  }

  // autopublish con debounce
  useEffect(() => {
    if (!autopublish || !connected || !config) return
    const id = setTimeout(() => publishScene(false), 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, text, imagesRaw, autopublish, connected, config?.room])

  const preview = toSceneState()

  return (
    <div className="min-h-screen flex flex-col gap-4">
      {/* TOPBAR */}
      <div className="border-b border-zinc-800 p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold">ARCHEI — Editor Scene (GM)</div>
          <button className="btn !bg-zinc-800" onClick={openSetup}>WS</button>
          {status}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <label className="label flex items-center gap-2">
            <input type="checkbox" checked={autopublish} onChange={e=>setAutopublish(e.target.checked)} /> Autopublish
          </label>
          <label className="label flex items-center gap-2">
            <input type="checkbox" checked={announce} onChange={e=>setAnnounce(e.target.checked)} /> Annuncia in chat
          </label>
        </div>
      </div>

      {/* LAYOUT */}
      <div className="grid lg:grid-cols-[420px_1fr] gap-4 px-3 lg:px-4">
        {/* EDITOR */}
        <div className="card space-y-3">
          <div className="font-semibold">Dettagli scena</div>
          <input className="input" placeholder="Titolo" value={title} onChange={e=>setTitle(e.target.value)} />
          <textarea className="input min-h-32" placeholder="Testo/descrizione…" value={text} onChange={e=>setText(e.target.value)} />
          <textarea className="input min-h-28" placeholder="Immagini (una URL per riga)" value={imagesRaw} onChange={e=>setImagesRaw(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={()=>publishScene(true)} disabled={!connected}>Pubblica</button>
            <button className="btn !bg-zinc-800" onClick={clearScene} disabled={!connected}>Svuota</button>
          </div>
          <div className="text-xs text-zinc-500">
            Con <span className="text-zinc-300">Autopublish</span>, ogni modifica viene inviata al display dopo un attimo.
          </div>
        </div>

        {/* PREVIEW */}
        <div className="card space-y-3">
          <div className="font-semibold">Anteprima (Display)</div>
          {preview.images?.[0] && (
            <img src={preview.images[0]} alt="" className="w-full h-48 object-cover rounded-xl border border-zinc-800" />
          )}
          {preview.title ? (
            <div className="text-xl font-bold">{preview.title}</div>
          ) : (
            <div className="text-sm text-zinc-500">Nessun titolo</div>
          )}
          {preview.text ? (
            <div className="whitespace-pre-wrap text-zinc-200">{preview.text}</div>
          ) : (
            <div className="text-sm text-zinc-500">Nessun testo</div>
          )}
          {!preview.images?.length && (
            <div className="text-sm text-zinc-500">Nessuna immagine impostata</div>
          )}
        </div>
      </div>
    </div>
  )
}
