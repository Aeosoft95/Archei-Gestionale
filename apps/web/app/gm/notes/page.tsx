'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useWS } from '@/components/ws/WSProvider'

// === Tipi e costanti ===
type NoteType =
  | 'Missione' | 'Storia' | 'Appunti' | 'Oggetti' | 'Npc' | 'Player'
  | 'Mostri' | 'Eventi' | 'Oggetto Storia' | 'Luoghi' | 'Altro'

type Nota = {
  id: string
  title: string
  type: NoteType
  content: string
  images: string[]          // URL immagini (una per riga nel form)
  createdAt: number
  updatedAt: number
  folderId: string
}

type Folder = { id: string; name: string }

type StoreShape = {
  folders: Folder[]
  notes: Nota[]
}

const NOTE_TYPES: NoteType[] = [
  'Missione','Storia','Appunti','Oggetti','Npc','Player','Mostri','Eventi','Oggetto Storia','Luoghi','Altro'
]

const LS_KEY = (room: string) => `archei:gm:notes:v1:${room || 'default'}`

// === Helpers ===
const uid = () => Math.random().toString(36).slice(2, 10)
const now = () => Date.now()

function normalizeUrls(multiline: string) {
  return multiline
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
}

// === Pagina ===
export default function GmNotesPage() {
  const { config, connected, connecting, error, openSetup, send } = useWS()
  const room = config?.room || 'default'

  // Stato archivio (cartelle + note)
  const [folders, setFolders] = useState<Folder[]>([])
  const [notes, setNotes] = useState<Nota[]>([])

  // UI state
  const [activeFolderId, setActiveFolderId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'' | NoteType>('')

  // Editor corrente
  const [currentId, setCurrentId] = useState<string>('') // nota attiva
  const current = useMemo(() => notes.find(n => n.id === currentId) || null, [notes, currentId])

  // Campi editor (controllati)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<NoteType>('Appunti')
  const [content, setContent] = useState('')
  const [imagesRaw, setImagesRaw] = useState('') // textarea con URL per riga
  const [folderForNote, setFolderForNote] = useState<string>('')

  // ====== Load / Save ======
  // Carica
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY(room))
      if (raw) {
        const parsed = JSON.parse(raw) as StoreShape
        if (Array.isArray(parsed.folders)) setFolders(parsed.folders)
        if (Array.isArray(parsed.notes)) setNotes(parsed.notes)
        if (parsed.folders?.[0]) setActiveFolderId(parsed.folders[0].id)
      } else {
        // Prima volta: crea una cartella di default
        const defId = uid()
        const initial = {
          folders: [{ id: defId, name: 'Generale' }],
          notes: []
        } satisfies StoreShape
        setFolders(initial.folders)
        setNotes(initial.notes)
        setActiveFolderId(defId)
      }
    } catch {}
  }, [room])

  // Salva (debounced)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function persistDebounced() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      try {
        const pack: StoreShape = { folders, notes }
        localStorage.setItem(LS_KEY(room), JSON.stringify(pack))
      } catch {}
    }, 250)
  }
  useEffect(() => { persistDebounced() }, [folders, notes, room])

  // ====== CRUD Cartelle ======
  function addFolder() {
    const name = prompt('Nome cartella?')?.trim()
    if (!name) return
    const f: Folder = { id: uid(), name }
    setFolders(fs => [...fs, f])
    setActiveFolderId(f.id)
  }
  function renameFolder(id: string) {
    const f = folders.find(x => x.id === id)
    if (!f) return
    const name = prompt('Rinomina cartella:', f.name)?.trim()
    if (!name) return
    setFolders(fs => fs.map(x => x.id === id ? { ...x, name } : x))
  }
  function deleteFolder(id: string) {
    const f = folders.find(x => x.id === id)
    if (!f) return
    if (!confirm(`Eliminare la cartella "${f.name}" e le note in essa contenute?`)) return
    setNotes(ns => ns.filter(n => n.folderId !== id))
    setFolders(fs => fs.filter(x => x.id !== id))
    // sposta il focus su una cartella rimasta
    setTimeout(() => {
      if (folders.length > 1) {
        const first = folders.find(x => x.id !== id)
        if (first) setActiveFolderId(first.id)
      } else {
        const defId = uid()
        setFolders([{ id: defId, name: 'Generale' }])
        setActiveFolderId(defId)
      }
    }, 0)
  }

  // ====== CRUD Note ======
  function newNote(folderId?: string) {
    const fid = folderId || activeFolderId || folders[0]?.id || uid()
    const n: Nota = {
      id: uid(),
      title: 'Nuova nota',
      type: 'Appunti',
      content: '',
      images: [],
      createdAt: now(),
      updatedAt: now(),
      folderId: fid
    }
    setNotes(ns => [n, ...ns])
    editNote(n)
  }

  function editNote(n: Nota) {
    setCurrentId(n.id)
    setTitle(n.title)
    setType(n.type)
    setContent(n.content)
    setImagesRaw(n.images.join('\n'))
    setFolderForNote(n.folderId)
  }

  function saveCurrent() {
    if (!currentId) return
    const imgs = normalizeUrls(imagesRaw)
    setNotes(ns => ns.map(n => n.id === currentId ? {
      ...n,
      title: (title || 'Senza titolo').trim(),
      type,
      content,
      images: imgs,
      updatedAt: now(),
      folderId: folderForNote || n.folderId
    } : n))
  }

  function deleteNote(id: string) {
    const n = notes.find(x => x.id === id)
    if (!n) return
    if (!confirm(`Eliminare la nota "${n.title}"?`)) return
    setNotes(ns => ns.filter(x => x.id !== id))
    if (currentId === id) {
      setCurrentId('')
      setTitle('')
      setContent('')
      setImagesRaw('')
      setFolderForNote(activeFolderId)
    }
  }

  // ====== Filtri lista ======
  const visibleNotes = useMemo(() => {
    let list = notes
    if (activeFolderId) list = list.filter(n => n.folderId === activeFolderId)
    if (filterType) list = list.filter(n => n.type === filterType)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
      )
    }
    return list.sort((a,b) => b.updatedAt - a.updatedAt)
  }, [notes, activeFolderId, filterType, search])

  // ====== Invio in chat ======
  function sendNoteToChat(n: Nota) {
    if (!config) return
    const lines: string[] = []
    lines.push(`📝 ${n.title} — tipo: ${n.type}`)
    if (n.content?.trim()) lines.push(n.content.trim())

    // Per ogni immagine, aggiungi link cliccabile. La chat GM già rende cliccabili http/https.
    // Manteniamo un prefisso chiaro.
    if (n.images?.length) {
      n.images.forEach((url, idx) => {
        lines.push(`🖼️ Immagine ${idx+1}: ${url}`)
      })
    }

    const text = lines.join('\n')
    send({ t:'chat:msg', room: config.room, nick: config.nick, text, ts: Date.now(), channel:'global' })
  }

  // ====== UI ======
  const status = useMemo(() => {
    const color = connecting ? 'bg-yellow-500' : connected ? 'bg-green-500' : error ? 'bg-red-500' : 'bg-zinc-600'
    const label = connecting ? 'conn…' : connected ? 'online' : (error ? 'errore' : 'offline')
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <div className={`w-2.5 h-2.5 rounded-full ${color}`} />{label}
      </div>
    )
  }, [connected, connecting, error])

  return (
    <div className="min-h-screen flex flex-col gap-4">
      {/* Topbar */}
      <div className="border-b border-zinc-800 p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold">ARCHEI — Note (GM)</div>
          <button className="btn !bg-zinc-800" onClick={openSetup}>WS</button>
          {status}
        </div>
        <div className="text-xs text-zinc-500">GM</div>
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[280px_1.2fr_1.6fr] gap-4 items-start">
        {/* Colonna 1: Cartelle */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Cartelle</div>
            <button className="btn" onClick={addFolder}>+ Nuova</button>
          </div>
          <div className="space-y-1">
            {folders.map(f => (
              <div
                key={f.id}
                className={`rounded-lg border px-3 py-2 flex items-center gap-2 cursor-pointer ${activeFolderId===f.id?'border-teal-600 bg-teal-600/10':'border-zinc-800 bg-zinc-900/40'}`}
                onClick={()=>setActiveFolderId(f.id)}
              >
                <div className="flex-1 truncate">{f.name}</div>
                <button className="btn !bg-zinc-800" title="Rinomina" onClick={(e)=>{ e.stopPropagation(); renameFolder(f.id) }}>✎</button>
                <button className="btn !bg-zinc-800" title="Elimina" onClick={(e)=>{ e.stopPropagation(); deleteFolder(f.id) }}>✕</button>
              </div>
            ))}
            {folders.length===0 && <div className="text-sm text-zinc-500">Nessuna cartella.</div>}
          </div>
        </div>

        {/* Colonna 2: Lista Note */}
        <div className="card space-y-3 min-h-[60vh]">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold">Note</div>
            <button className="btn" onClick={()=>newNote(activeFolderId)} disabled={!activeFolderId}>+ Nuova nota</button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <input className="input col-span-2" placeholder="Cerca…" value={search} onChange={e=>setSearch(e.target.value)} />
            <select className="input" value={filterType} onChange={e=>setFilterType((e.target.value || '') as any)}>
              <option value="">Tutti i tipi</option>
              {NOTE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="space-y-2 overflow-auto">
            {visibleNotes.length===0 && <div className="text-sm text-zinc-500">Nessuna nota trovata.</div>}
            {visibleNotes.map(n => (
              <div
                key={n.id}
                className={`rounded-xl border p-3 cursor-pointer ${currentId===n.id?'border-teal-600 bg-teal-600/10':'border-zinc-800 bg-zinc-900/40'}`}
                onClick={()=>editNote(n)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold truncate">{n.title}</div>
                  <div className="text-xs text-zinc-400">{new Date(n.updatedAt).toLocaleString()}</div>
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">{n.type} • {n.images.length} img</div>
                {n.content.trim() && (
                  <div className="text-sm text-zinc-300 line-clamp-2 mt-1 whitespace-pre-line">
                    {n.content}
                  </div>
                )}
                <div className="flex gap-2 mt-2">
                  <button className="btn" onClick={(e)=>{ e.stopPropagation(); sendNoteToChat(n) }} disabled={!connected}>Invia in chat</button>
                  <button className="btn !bg-zinc-800" onClick={(e)=>{ e.stopPropagation(); deleteNote(n.id) }}>Elimina</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Colonna 3: Editor */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Editor</div>
            <div className="text-xs text-zinc-400">{current ? 'Modifica' : 'Nessuna nota selezionata'}</div>
          </div>

          {!current && (
            <div className="text-sm text-zinc-500">
              Seleziona una nota dalla lista o creane una nuova.
            </div>
          )}

          {current && (
            <>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <div className="label">Titolo</div>
                  <input className="input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Titolo nota…"/>
                </div>
                <div>
                  <div className="label">Tipo</div>
                  <select className="input" value={type} onChange={e=>setType(e.target.value as NoteType)}>
                    {NOTE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <div className="label">Cartella</div>
                  <select className="input" value={folderForNote} onChange={e=>setFolderForNote(e.target.value)}>
                    {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div className="label">Contenuto</div>
                <textarea className="input min-h-40" value={content} onChange={e=>setContent(e.target.value)} placeholder="Testo della nota…"/>
              </div>

              <div>
                <div className="label">Immagini (una URL per riga)</div>
                <textarea className="input min-h-24" value={imagesRaw} onChange={e=>setImagesRaw(e.target.value)} placeholder="https://.../img1.jpg
https://.../img2.png"/>
                {normalizeUrls(imagesRaw).length>0 && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {normalizeUrls(imagesRaw).slice(0,6).map((u, i) => (
                      <div key={i} className="rounded-lg border border-zinc-800 overflow-hidden bg-zinc-900/40">
                        <img src={u} alt="" className="w-full h-20 object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800">
                <button className="btn" onClick={saveCurrent}>Salva</button>
                <button className="btn" onClick={()=>current && sendNoteToChat({
                  ...current,
                  title, type, content, images: normalizeUrls(imagesRaw), folderId: folderForNote
                })} disabled={!connected}>Invia in chat</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
