'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useWS } from '@/components/ws/WSProvider'

type SceneState = {
  id: string
  title?: string
  text?: string
  images?: string[]
  bannerEnabled?: boolean
  bannerColor?: string   // es. "#0ea5e9"
  updatedAt?: number
}
type SceneListState = { scenes: SceneState[]; currentId?: string; autopublish?: boolean; announce?: boolean }
const BASE_KEY = 'archei:gm:editor-scenes:v2' // bump per includere banner

const uid = () => Math.random().toString(36).slice(2, 10)
const cleanImages = (raw: string) => raw.split('\n').map(s => s.trim()).filter(Boolean)

export default function EditorScenePage() {
  const { config, connected, connecting, error, openSetup, send } = useWS()

  const lsKey = useMemo(() => `${BASE_KEY}:${config?.room || 'default'}`, [config?.room])
  const [data, setData] = useState<SceneListState>({ scenes: [], autopublish: true, announce: true })

  const current = data.scenes.find(s => s.id === data.currentId)

  const [title, setTitle] = useState(current?.title || '')
  const [text, setText] = useState(current?.text || '')
  const [imagesRaw, setImagesRaw] = useState((current?.images || []).join('\n'))
  const [bannerEnabled, setBannerEnabled] = useState<boolean>(current?.bannerEnabled ?? true)
  const [bannerColor, setBannerColor] = useState<string>(current?.bannerColor || '#0ea5e9')

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { localStorage.setItem('archei:role', 'gm') }, [])

  // Carica dallo storage
  useEffect(() => {
    try {
      const saved: SceneListState | null = JSON.parse(localStorage.getItem(lsKey) || 'null')
      if (saved?.scenes?.length) {
        setData({
          scenes: saved.scenes.map(s => ({
            bannerEnabled: true,
            bannerColor: '#0ea5e9',
            ...s
          })),
          currentId: saved.currentId || saved.scenes[0]?.id,
          autopublish: saved.autopublish ?? true,
          announce: saved.announce ?? true
        })
        const cur = saved.scenes.find(s => s.id === (saved.currentId || saved.scenes[0]?.id))
        setTitle(cur?.title || '')
        setText(cur?.text || '')
        setImagesRaw((cur?.images || []).join('\n'))
        setBannerEnabled(cur?.bannerEnabled ?? true)
        setBannerColor(cur?.bannerColor || '#0ea5e9')
      } else {
        const first: SceneState = { id: uid(), title: 'Nuova scena', text: '', images: [], bannerEnabled: true, bannerColor: '#0ea5e9', updatedAt: Date.now() }
        setData({ scenes: [first], currentId: first.id, autopublish: true, announce: true })
        setTitle(first.title || ''); setText(''); setImagesRaw(''); setBannerEnabled(true); setBannerColor('#0ea5e9')
      }
    } catch {
      const first: SceneState = { id: uid(), title: 'Nuova scena', text: '', images: [], bannerEnabled: true, bannerColor: '#0ea5e9', updatedAt: Date.now() }
      setData({ scenes: [first], currentId: first.id, autopublish: true, announce: true })
      setTitle(first.title || ''); setText(''); setImagesRaw(''); setBannerEnabled(true); setBannerColor('#0ea5e9')
    }
  }, [lsKey])

  // Salva con debounce
  const persistAll = useMemo(() => {
    return () => {
      const curIdx = data.scenes.findIndex(s => s.id === data.currentId)
      const mergedCur: SceneState | undefined =
        curIdx >= 0
          ? {
              ...data.scenes[curIdx],
              title: title.trim() || undefined,
              text: text.trim() || undefined,
              images: cleanImages(imagesRaw),
              bannerEnabled,
              bannerColor,
              updatedAt: Date.now()
            }
          : undefined
      const payload: SceneListState = {
        ...data,
        scenes: mergedCur
          ? data.scenes.map(s => (s.id === data.currentId ? mergedCur : s))
          : data.scenes
      }
      localStorage.setItem(lsKey, JSON.stringify(payload))
    }
  }, [data, title, text, imagesRaw, bannerEnabled, bannerColor, lsKey])

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persistAll(), 300)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [persistAll])

  // Salva anche su cambio scheda/chiusura
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

  // Cambi scena -> ricarica campi
  useEffect(() => {
    const cur = data.scenes.find(s => s.id === data.currentId)
    setTitle(cur?.title || '')
    setText(cur?.text || '')
    setImagesRaw((cur?.images || []).join('\n'))
    setBannerEnabled(cur?.bannerEnabled ?? true)
    setBannerColor(cur?.bannerColor || '#0ea5e9')
  }, [data.currentId])

  const status = useMemo(() => {
    const color = connecting ? 'bg-yellow-500' : connected ? 'bg-green-500' : error ? 'bg-red-500' : 'bg-zinc-600'
    const label = connecting ? 'conn…' : connected ? 'online' : (error ? 'errore' : 'offline')
    return <div className="flex items-center gap-2 text-xs text-zinc-400"><div className={`w-2.5 h-2.5 rounded-full ${color}`} />{label}</div>
  }, [connected, connecting, error])

  // Stato corrente
  function curState(): SceneState {
    return {
      id: data.currentId || uid(),
      title: title.trim() || undefined,
      text: text.trim() || undefined,
      images: cleanImages(imagesRaw),
      bannerEnabled,
      bannerColor,
      updatedAt: Date.now()
    }
  }

  // Azioni lista
  function addScene() {
    const s: SceneState = { id: uid(), title: 'Nuova scena', text: '', images: [], bannerEnabled: true, bannerColor: '#0ea5e9', updatedAt: Date.now() }
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

  // Pubblica (nuovo + legacy)
  function publishScene(alsoAnnounce = data.announce) {
    if (!config) return
    const s = curState()
    setData(d => ({ ...d, scenes: d.scenes.map(x => (x.id === d.currentId ? { ...x, ...s } : x)) }))

    const payload = {
      room: config.room,
      title: s.title,
      text: s.text,
      images: s.images,
      bannerEnabled: s.bannerEnabled,
      bannerColor: s.bannerColor
    }

    // nuovo
    send({ t: 'DISPLAY_SCENE_STATE', ...payload })
    // legacy
    send({ t: 'DISPLAY_SCENE', ...payload })

    if (alsoAnnounce) {
      const t = s.title ? `: ${s.title}` : ''
      send({ t: 'chat:msg', room: config.room, nick: 'GM', text: `📜 Scena aggiornata${t}`, ts: Date.now(), channel:'global' })
    }

    // persisti subito
    localStorage.setItem(lsKey, JSON.stringify({
      ...data,
      scenes: data.scenes.map(x => (x.id === data.currentId ? { ...x, ...s } : x))
    }))
  }

  function clearDisplay() {
    if (!config) return
    const payload = { room: config.room, title: '', text: '', images: [] as string[], bannerEnabled: false, bannerColor: undefined as string | undefined }
    send({ t: 'DISPLAY_SCENE_STATE', ...payload })
    send({ t: 'DISPLAY_SCENE', ...payload })
    if (data.announce) send({ t: 'chat:msg', room: config.room, nick: 'GM', text: '🧹 Scena svuotata', ts: Date.now(), channel:'global' })
  }
  function announceOnly() {
    if (!config) return
    const s = curState()
    const t = s.title ? `: ${s.title}` : ''
    send({ t: 'chat:msg', room: config.room, nick: 'GM', text: `📜 Scena${t || ' (senza titolo)'}`, ts: Date.now(), channel:'global' })
  }

  // Autopublish (facoltativo): pubblica al blur del campo o al click, non sul singolo keypress
  function onBlurMaybePublish() { if (data.autopublish && connected) publishScene(false) }

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
            <input type="checkbox" checked={!!data.autopublish}
              onChange={e => setData(d => ({ ...d, autopublish: e.target.checked }))}/>
            Autopublish
          </label>
          <label className="label flex items-center gap-2">
            <input type="checkbox" checked={!!data.announce}
              onChange={e => setData(d => ({ ...d, announce: e.target.checked }))}/>
            Annuncia in chat
          </label>
          <span className="text-zinc-500">room: <span className="text-zinc-300">{config?.room || 'default'}</span></span>
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
              <div key={s.id}
                className={`rounded-xl border px-3 py-2 text-sm flex items-center justify-between ${
                  s.id === data.currentId ? 'border-teal-600 bg-teal-600/10' : 'border-zinc-800 bg-zinc-900/40'
                }`}>
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

            {/* Banner */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="label flex items-center gap-2">
                <input type="checkbox" checked={bannerEnabled} onChange={e=>{ setBannerEnabled(e.target.checked); onBlurMaybePublish() }} />
                Mostra banner
              </label>
              <div className="flex items-center gap-2">
                <span className="label mb-0">Colore</span>
                <input
                  type="color"
                  className="h-9 w-12 p-1 rounded bg-zinc-900 border border-zinc-700"
                  value={bannerColor}
                  onChange={e=>setBannerColor(e.target.value)}
                  onBlur={onBlurMaybePublish}
                  title="Colore banner"
                />
                <input
                  className="input w-36"
                  value={bannerColor}
                  onChange={e=>setBannerColor(e.target.value)}
                  onBlur={onBlurMaybePublish}
                  placeholder="#0ea5e9"
                />
              </div>
            </div>

            <input className="input" placeholder="Titolo" value={title} onChange={e=>setTitle(e.target.value)} onBlur={onBlurMaybePublish}/>
            <textarea className="input min-h-32" placeholder="Testo/descrizione…" value={text} onChange={e=>setText(e.target.value)} onBlur={onBlurMaybePublish}/>
            <div className="space-y-2">
              <label className="label">Immagini (una URL per riga)</label>
              <textarea className="input min-h-28" placeholder="https://…" value={imagesRaw} onChange={e=>setImagesRaw(e.target.value)} onBlur={onBlurMaybePublish}/>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="btn" onClick={()=>publishScene(true)} disabled={!connected}>Pubblica</button>
              <button className="btn !bg-zinc-800" onClick={clearDisplay} disabled={!connected}>Svuota display</button>
              <button className="btn !bg-zinc-800" onClick={announceOnly} disabled={!connected}>Annuncia in chat</button>
            </div>
          </div>

          {/* ANTEPRIMA */}
          <div className="card space-y-3 overflow-hidden">
            <div className="font-semibold">Anteprima (Display)</div>

            {/* Banner preview */}
            {bannerEnabled && (
              <div className="rounded-xl border border-zinc-800 overflow-hidden">
                <div className="h-14" style={{ backgroundColor: bannerColor }} />
                <div className="p-3 text-xs text-zinc-400 border-t border-zinc-800">Banner attivo</div>
              </div>
            )}

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
