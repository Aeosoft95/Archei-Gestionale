'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useWS } from '@/components/ws/WSProvider'

/** ---- Tipi ---- */
type SceneState = { id: string; title?: string; text?: string; images?: string[]; updatedAt?: number }
type SceneListState = {
  scenes: SceneState[]
  currentId?: string
  autopublish?: boolean
  announce?: boolean
}
const BASE_KEY = 'archei:gm:editor-scenes:v1'

/** ---- Utils ---- */
const uid = () => Math.random().toString(36).slice(2, 10)
const cleanImages = (raw: string) => raw.split('\n').map(s => s.trim()).filter(Boolean)

export default function EditorScenePage() {
  const { config, connected, connecting, error, openSetup, send } = useWS()

  // Chiave LS per stanza (default se non definita)
  const lsKey = useMemo(
    () => `${BASE_KEY}:${config?.room || 'default'}`,
    [config?.room]
  )

  // stato globale editor (lista scene + preferenze)
  const [data, setData] = useState<SceneListState>({ scenes: [], autopublish: true, announce: true })

  // stato editor per la scena corrente
  const current = data.scenes.find(s => s.id === data.currentId)
  const [title, setTitle] = useState(current?.title || '')
  const [text, setText] = useState(current?.text || '')
  const [imagesRaw, setImagesRaw] = useState((current?.images || []).join('\n'))

  // per evitare scritture eccessive
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** ---- Boot + restore PER STANZA ---- */
  useEffect(() => {
    localStorage.setItem('archei:role', 'gm')
  }, [])

  // ricarica quando cambia room (lsKey)
  useEffect(() => {
    try {
      const saved: SceneListState | null = JSON.parse(localStorage.getItem(lsKey) || 'null')
      if (saved && Array.isArray(saved.scenes) && saved.scenes.length) {
        setData({
          scenes: saved.scenes,
          currentId: saved.currentId || saved.scenes[0]?.id,
          autopublish: saved.autopublish ?? true,
          announce: saved.announce ?? true
        })
        const cur = saved.scenes.find(s => s.id === (saved.currentId || saved.scenes[0]?.id))
        setTitle(cur?.title || ''); setText(cur?.text || ''); setImagesRaw((cur?.images || []).join('\n'))
      } else {
        const first: SceneState = { id: uid(), title: 'Nuova scena', text: '', images: [], updatedAt: Date.now() }
        setData({ scenes: [first], currentId: first.id, autopublish: true, announce: true })
        setTitle(first.title || ''); setText(''); setImagesRaw('')
      }
    } catch {
      const first: SceneState = { id: uid(), title: 'Nuova scena', text: '', images: [], updatedAt: Date.now() }
      setData({ scenes: [first], currentId: first.id, autopublish: true, announce: true })
      setTitle(first.title || ''); setText(''); setImagesRaw('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lsKey])

  /** ---- Persistenza locale (debounce) ---- */
  const persistAll = useMemo(() => {
    return () => {
      const cur = data.scenes.find(s => s.id === data.currentId)
      const mergedCur: SceneState | undefined = cur
        ? { ...cur, title: title.trim() || undefined, text: text.trim() || undefined, images: cleanImages(imagesRaw), updatedAt: Date.now() }
        : undefined
      const payload: SceneListState = {
        ...data,
        scenes: mergedCur ? data.scenes.map(s => (s.id === data.currentId ? mergedCur : s)) : data.scenes
      }
      localStorage.setItem(lsKey, JSON.stringify(payload))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, title, text, imagesRaw, lsKey])

  // salva con debounce mentre scrivi
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persistAll(), 300)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [persistAll])

  // salva anche su cambio visibilità/tab o uscita
  useEffect(() => {
    const onVis = () => persistAll()
    const onUnload = () => persistAll()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [persistAll])

  /** ---- Quando cambia la scena corrente, carica i campi ---- */
  useEffect(() => {
    const cur = data.scenes.find(s => s.id === data.currentId)
    setTitle(cur?.title || '')
    setText(cur?.text || '')
    setImagesRaw((cur?.images || []).join('\n'))
  }, [data.currentId]) // eslint-disable-line

  /** ---- Badge stato WS ---- */
  const status = useMemo(() => {
    const color = connecting ? 'bg-yellow-500' : connected ? 'bg-green-500' : error ? 'bg-red-500' : 'bg-zinc-600'
    const label = connecting ? 'conn…' : connected ? 'online' : (error ? 'errore' : 'offline')
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <div className={`w-2.5 h-2.5 rounded-full ${color}`} /> {label}
      </div>
    )
  }, [connected, connecting, error])

  /** ---- Helpers scena corrente ---- */
  function curState(): SceneState {
    return {
      id: data.currentId || uid(),
      title: title.trim() || undefined,
      text: text.trim() || undefined,
      images: cleanImages(imagesRaw),
      updatedAt: Date.now()
    }
  }

  /** ---- Operazioni lista scene ---- */
  function addScene() {
    const s: SceneState = { id: uid(), title: 'Nuova scena', text: '', images: [], updatedAt: Date.now() }
    setData(d => ({ ...d, scenes: [s, ...d.scenes], currentId: s.id }))
  }
  function duplicateScene(id: string) {
    const base = data.scenes.find(s => s.id === id); if (!base) return
    const cpy: SceneState = { ...base, id: uid(), title: (base.title ? base.title + ' (copia)' : 'Scena (copia)'), updatedAt: Date.now() }
    setData(d => ({ ...d, scenes: [cpy, ...d.scenes], currentId: cpy.id }))
  }
  function deleteScene(id: string) {
    setData(d => {
      const scenes = d.scenes.filter(s => s.id !== id)
      const currentId = d.currentId === id ? scenes[0]?.id : d.currentId
      return { ...d, scenes, currentId }
    })
  }
  function selectScene(id: string) { setData(d => ({ ...d, currentId: id })) }

  /** ---- Pubblicazione WS ---- */
  function publishScene(alsoAnnounce = data.announce) {
    if (!config) return
    const s = curState()
    // allinea memoria prima di inviare
    setData(d => ({ ...d, scenes: d.scenes.map(x => (x.id === d.currentId ? { ...x, ...s } : x)) }))
    const payload = { t: 'DISPLAY_SCENE_STATE', room: config.room, title: s.title, text: s.text, images: s.images }
    send(payload)
    if (alsoAnnounce) {
      const t = s.title ? `: ${s.title}` : ''
      send({ t: 'CHAT', room: config.room, nick: 'GM', text: `📜 Scena aggiornata${t}`, ts: Date.now() })
    }
    // salva subito dopo pubblicazione
    localStorage.setItem(lsKey, JSON.stringify({
      ...data,
      scenes: data.scenes.map(x => (x.id === data.currentId ? { ...x, ...s } : x))
    }))
  }
  function clearDisplay() {
    if (!config) return
    send({ t: 'DISPLAY_SCENE_STATE', room: config.room, title: '', text: '', images: [] })
    if (data.announce) send({ t: 'CHAT', room: config.room, nick: 'GM', text: '🧹 Scena svuotata', ts: Date.now() })
  }
  function announceOnly() {
    if (!config) return
    const s = curState()
    const t = s.title ? `: ${s.title}` : ''
    send({ t: 'CHAT', room: config.room, nick: 'GM', text: `📜 Scena${t || ' (senza titolo)'}`, ts: Date.now() })
  }

  /** ---- Anteprima ---- */
  const preview = curState()
  const imgs = preview.images || []

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
            <input
              type="checkbox"
              checked={!!data.autopublish}
              onChange={e => setData(d => ({ ...d, autopublish: e.target.checked }))}
            /> Autopublish
          </label>
          <label className="label flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!data.announce}
              onChange={e => setData(d => ({ ...d, announce: e.target.checked }))}
            /> Annuncia in chat
          </label>
        </div>
      </div>

      {/* LAYOUT */}
      <div className="grid lg:grid-cols-[320px_1fr] gap-4 px-3 lg:px-4">
        {/* COLONNA SX: Lista scene */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Scene salvate</div>
            <div className="flex gap-2">
              <button className="btn" onClick={addScene}>+ Nuova</button>
            </div>
          </div>
          <div className="space-y-2 max-h-[50vh] overflow-auto pr-1">
            {data.scenes.map(s => (
              <div
                key={s.id}
                className={`rounded-xl border px-3 py-2 text-sm flex items-center justify-between ${
                  s.id === data.currentId ? 'border-teal-600 bg-teal-600/10' : 'border-zinc-800 bg-zinc-900/40'
                }`}
              >
                <button className="text-left truncate flex-1" onClick={() => selectScene(s.id)}>
                  {s.title || '(senza titolo)'}
                  {s.updatedAt && <span className="ml-2 text-xs text-zinc-500">{new Date(s.updatedAt).toLocaleTimeString()}</span>}
                </button>
                <div className="flex items-center gap-2 ml-2">
                  <button className="btn !bg-zinc-800" title="Duplica" onClick={() => duplicateScene(s.id)}>⧉</button>
                  <button className="btn !bg-zinc-800" title="Elimina" onClick={() => deleteScene(s.id)}>✕</button>
                </div>
              </div>
            ))}
            {data.scenes.length === 0 && <div className="text-sm text-zinc-500">Nessuna scena salvata.</div>}
          </div>
        </div>

        {/* COLONNA DX: Editor + Anteprima */}
        <div className="space-y-4">
          {/* EDITOR */}
          <div className="card space-y-3">
            <div className="font-semibold">Dettagli scena</div>
            <input className="input" placeholder="Titolo" value={title} onChange={e=>setTitle(e.target.value)} />
            <textarea className="input min-h-32" placeholder="Testo/descrizione…" value={text} onChange={e=>setText(e.target.value)} />
            <div className="space-y-2">
              <label className="label">Immagini (una URL per riga)</label>
              <textarea className="input min-h-28" placeholder="https://…" value={imagesRaw} onChange={e=>setImagesRaw(e.target.value)} />
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="btn" onClick={()=>publishScene(true)} disabled={!connected}>Pubblica</button>
              <button className="btn !bg-zinc-800" onClick={clearDisplay} disabled={!connected}>Svuota display</button>
              <button className="btn !bg-zinc-800" onClick={announceOnly} disabled={!connected}>Annuncia in chat</button>
            </div>
          </div>

          {/* ANTEPRIMA */}
          <div className="card space-y-3">
            <div className="font-semibold">Anteprima (Display)</div>
            {imgs[0] && (
              <img src={imgs[0]} alt="" className="w-full h-56 object-cover rounded-xl border border-zinc-800" />
            )}
            {imgs.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {imgs.slice(1, 6).map((u, i) => (
                  <img key={i} src={u} alt="" className="w-20 h-20 object-cover rounded-lg border border-zinc-800" />
                ))}
              </div>
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
            {!imgs.length && (
              <div className="text-sm text-zinc-500">Nessuna immagine impostata</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
