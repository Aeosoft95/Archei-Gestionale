'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useWS } from '@/components/ws/WSProvider'

// ===== Tipi =====
type NoteType =
  | 'Missione' | 'Storia' | 'Appunti' | 'Oggetti' | 'Npc' | 'Player'
  | 'Mostri' | 'Eventi' | 'Oggetto Storia' | 'Luoghi' | 'Altro'

type Nota = {
  id: string
  title: string
  type: NoteType
  content: string
  images: string[]       // URL (una per riga nell’editor)
  tags: string[]         // tag (virgola-separati nell’editor)
  folderId?: string|null // cartella
  createdAt: number
  updatedAt: number
}

type Folder = { id: string; name: string }

// ===== Costanti/UI =====
const NOTE_TYPES: NoteType[] = [
  'Missione','Storia','Appunti','Oggetti','Npc','Player','Mostri','Eventi','Oggetto Storia','Luoghi','Altro'
]
const uid = () => Math.random().toString(36).slice(2,10)
const now = () => Date.now()

// localStorage key separata per stanza + per PLAYER
const LS_KEY = (room:string)=> `archei:player:notes:v1:${room||'default'}`

// normalizza blocco multilinea -> array URL ripuliti
function normalizeUrls(multiline: string) {
  return (multiline||'')
    .split('\n')
    .map(s=>s.trim())
    .filter(Boolean)
}

// normalizza lista tag 'a, b ,c' -> ['a','b','c']
function normalizeTags(input: string) {
  return (input||'')
    .split(',')
    .map(s=>s.trim())
    .filter(Boolean)
    .map(s=>s.toLowerCase())
}

// breve anteprima testo
function preview(s:string, n=140){ const t=(s||'').replace(/\s+/g,' ').trim(); return t.length>n? t.slice(0,n)+'…' : t }

export default function PlayerNotesPage(){
  const { config, connected, send } = useWS()

  // stato base
  const [folders, setFolders] = useState<Folder[]>([])
  const [notes, setNotes]     = useState<Nota[]>([])
  const [currentId, setCurrentId] = useState<string| null>(null)

  // filtri
  const [q, setQ] = useState('')
  const [byType, setByType] = useState<'all'|NoteType>('all')
  const [byFolder, setByFolder] = useState<string| 'all'>('all')
  const [byTag, setByTag] = useState('')

  // editor correnti
  const current = useMemo(()=> notes.find(n=>n.id===currentId) || null, [notes, currentId])
  const [title, setTitle] = useState('')
  const [type, setType] = useState<NoteType>('Appunti')
  const [content, setContent] = useState('')
  const [imagesRaw, setImagesRaw] = useState('')
  const [tagsRaw, setTagsRaw] = useState('')
  const [folderForNote, setFolderForNote] = useState<string|''>('')

  // nick UI (per invio in chat)
  const [nickUI, setNickUI] = useState<string>(()=> {
    try { return localStorage.getItem('archei:nick') || '' } catch { return '' }
  })
  useEffect(()=>{
    try {
      const onStorage = (e:StorageEvent)=>{
        if(e.key==='archei:nick' && typeof e.newValue==='string') setNickUI(e.newValue)
      }
      window.addEventListener('storage', onStorage)
      return ()=> window.removeEventListener('storage', onStorage)
    } catch {}
  },[])

  // caricamento iniziale
  useEffect(()=>{
    const key = LS_KEY(config?.room || 'default')
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const js = JSON.parse(raw)
        setFolders(Array.isArray(js.folders)? js.folders : [])
        setNotes(Array.isArray(js.notes)? js.notes : [])
      } else {
        // iniziale
        setFolders([{ id: uid(), name:'Generale' }])
        setNotes([])
      }
    } catch {
      setFolders([{ id: uid(), name:'Generale' }])
      setNotes([])
    }
  }, [config?.room])

  // persistenza
  useEffect(()=>{
    const key = LS_KEY(config?.room || 'default')
    try {
      localStorage.setItem(key, JSON.stringify({ folders, notes }))
    } catch {}
  }, [folders, notes, config?.room])

  // quando cambio current, popola editor
  useEffect(()=>{
    if (!current) { setTitle(''); setType('Appunti'); setContent(''); setImagesRaw(''); setTagsRaw(''); setFolderForNote(''); return }
    setTitle(current.title || '')
    setType((current.type as NoteType) || 'Appunti')
    setContent(current.content || '')
    setImagesRaw((current.images||[]).join('\n'))
    setTagsRaw((current.tags||[]).join(', '))
    setFolderForNote(current.folderId || '')
  }, [currentId]) // eslint-disable-line

  // azioni cartelle
  function addFolder(){
    const name = prompt('Nome cartella:')
    if(!name) return
    setFolders(f=>[...f, { id:uid(), name:name.trim() }])
  }
  function renameFolder(id:string){
    const f = folders.find(x=>x.id===id); if(!f) return
    const name = prompt('Rinomina cartella:', f.name)
    if(!name) return
    setFolders(fs => fs.map(x=>x.id===id ? {...x, name:name.trim()} : x))
  }
  function deleteFolder(id:string){
    if(!confirm('Eliminare la cartella? (le note rimarranno senza cartella)')) return
    setFolders(fs => fs.filter(x=>x.id!==id))
    setNotes(ns => ns.map(n=> n.folderId===id ? {...n, folderId:null} : n))
    if (byFolder===id) setByFolder('all')
  }

  // azioni note
  function newNote(){
    const n: Nota = {
      id: uid(),
      title: 'Nuova nota',
      type: 'Appunti',
      content: '',
      images: [],
      tags: [],
      folderId: (byFolder!=='all'? byFolder : (folders[0]?.id || null)),
      createdAt: now(),
      updatedAt: now(),
    }
    setNotes(ns=>[...ns, n])
    setCurrentId(n.id)
  }
  function duplicateNote(id:string){
    const orig = notes.find(n=>n.id===id); if(!orig) return
    const n: Nota = { ...orig, id: uid(), title: orig.title + ' (copia)', createdAt: now(), updatedAt: now() }
    setNotes(ns=>[...ns, n])
    setCurrentId(n.id)
  }
  function deleteNote(id:string){
    if(!confirm('Eliminare questa nota?')) return
    setNotes(ns => ns.filter(n=>n.id!==id))
    if (currentId===id) setCurrentId(null)
  }
  function saveCurrent(){
    if(!currentId) return
    setNotes(ns => ns.map(n=>{
      if(n.id!==currentId) return n
      return {
        ...n,
        title: (title||'').trim() || 'Senza titolo',
        type,
        content,
        images: normalizeUrls(imagesRaw),
        tags: normalizeTags(tagsRaw),
        folderId: folderForNote || null,
        updatedAt: now(),
      }
    }))
  }

  // invio in chat
  function sendNoteToChat(n: Nota){
    if(!config) return
    const who = (nickUI && nickUI.trim()) ? nickUI.trim() : (config.nick || 'Player')
    const firstImg = (n.images||[])[0]
    const msgLines = [
      `📝 Nota: ${n.title} — ${n.type}`,
      n.content?.trim() ? preview(n.content, 500) : '',
      firstImg ? `Immagine: ${firstImg}` : '',
      (n.tags?.length ? `#${n.tags.join(' #')}` : '')
    ].filter(Boolean)
    const text = msgLines.join('\n')

    send({ t:'chat:msg', room: config.room, nick: who, text, ts: Date.now(), channel:'global' })
  }

  // elenco note filtrato
  const filtered = useMemo(()=>{
    const ql = q.trim().toLowerCase()
    const tag = byTag.trim().toLowerCase()
    return notes
      .filter(n => byFolder==='all' ? true : (n.folderId===byFolder))
      .filter(n => byType==='all' ? true : (n.type===byType))
      .filter(n => !ql ? true : (
        n.title.toLowerCase().includes(ql) ||
        n.content.toLowerCase().includes(ql) ||
        (n.tags||[]).some(t=>t.includes(ql))
      ))
      .filter(n => !tag ? true : (n.tags||[]).includes(tag))
      .sort((a,b)=> (b.updatedAt - a.updatedAt))
  }, [notes, byFolder, byType, q, byTag])

  return (
    <div className="flex min-h-screen">
      {/* Sidebar sinistra: cartelle */}
      <aside className="bg-zinc-950/60 border-r border-zinc-800 w-64 p-3 hidden md:flex md:flex-col">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Note (Player)</div>
          <Link href="/tools/chat" className="btn !bg-zinc-800 text-xs">↩︎ Chat</Link>
        </div>

        <div className="mt-3 text-xs text-zinc-400">Cartelle</div>
        <div className="mt-1 space-y-1 overflow-auto">
          <button
            className={`w-full text-left rounded-md px-2 py-1 ${byFolder==='all'?'bg-zinc-800 text-zinc-100':'hover:bg-zinc-900'}`}
            onClick={()=>setByFolder('all')}
          >Tutte</button>
          {folders.map(f=>(
            <div key={f.id} className="flex items-center gap-1">
              <button
                className={`flex-1 text-left rounded-md px-2 py-1 truncate ${byFolder===f.id?'bg-zinc-800 text-zinc-100':'hover:bg-zinc-900'}`}
                onClick={()=>setByFolder(f.id)}
                title={f.name}
              >
                {f.name}
              </button>
              <button className="btn !bg-zinc-800" title="Rinomina" onClick={()=>renameFolder(f.id)}>✎</button>
              <button className="btn !bg-zinc-800" title="Elimina" onClick={()=>deleteFolder(f.id)}>✕</button>
            </div>
          ))}
        </div>

        <div className="mt-2">
          <button className="btn w-full" onClick={addFolder}>+ Nuova cartella</button>
        </div>
      </aside>

      {/* Colonna centrale: lista note */}
      <div className="flex-1 p-4 space-y-3">
        {/* barra filtri */}
        <div className="card">
          <div className="grid sm:grid-cols-4 gap-2">
            <input className="input sm:col-span-2" placeholder="Cerca titolo, testo, tag…" value={q} onChange={e=>setQ(e.target.value)}/>
            <select className="input" value={byType} onChange={e=>setByType(e.target.value as any)}>
              <option value="all">Tutti i tipi</option>
              {NOTE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <input className="input" placeholder="Filtra per #tag" value={byTag} onChange={e=>setByTag(e.target.value)}/>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Le mie note</div>
            <div className="flex gap-2">
              <button className="btn" onClick={newNote}>+ Nuova nota</button>
            </div>
          </div>

          <div className="mt-3 grid md:grid-cols-2 xl:grid-cols-3 gap-2">
            {filtered.length===0 && <div className="text-sm text-zinc-500">Nessuna nota trovata.</div>}
            {filtered.map(n=>(
              <button
                key={n.id}
                className={`rounded-lg border px-3 py-2 text-left hover:border-zinc-600 ${n.id===currentId ? 'border-teal-500' : 'border-zinc-800'}`}
                onClick={()=>setCurrentId(n.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold truncate">{n.title || 'Senza titolo'}</div>
                  <div className="text-[11px] text-zinc-400 ml-2 shrink-0">{new Date(n.updatedAt).toLocaleString()}</div>
                </div>
                <div className="text-xs text-zinc-400">{n.type}{n.folderId ? ' • ' + (folders.find(f=>f.id===n.folderId)?.name||'') : ''}</div>
                {n.tags?.length ? (
                  <div className="mt-1 text-[11px] text-zinc-400 truncate">#{n.tags.join(' #')}</div>
                ) : null}
                <div className="text-sm mt-1 text-zinc-200">{preview(n.content)}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Colonna destra: editor nota */}
      <aside className="w-[420px] p-4 border-l border-zinc-800 space-y-3 hidden lg:block">
        <div className="card">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Editor nota</div>
            <div className={`text-xs ${connected?'text-green-400':'text-zinc-400'}`}>{connected?'WS online':'WS offline'}</div>
          </div>

          {!current ? (
            <div className="text-sm text-zinc-500 mt-2">Seleziona una nota o creane una nuova.</div>
          ) : (
            <>
              <div className="mt-2">
                <div className="label">Titolo</div>
                <input className="input" value={title} onChange={e=>setTitle(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <div className="label">Tipo</div>
                  <select className="input" value={type} onChange={e=>setType(e.target.value as NoteType)}>
                    {NOTE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <div className="label">Cartella</div>
                  <select className="input" value={folderForNote} onChange={e=>setFolderForNote(e.target.value)}>
                    <option value="">—</option>
                    {folders.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="mt-2">
                <div className="label">Contenuto</div>
                <textarea className="input min-h-40" value={content} onChange={e=>setContent(e.target.value)} placeholder="Testo, appunti, collegamenti…"/>
              </div>

              <div className="mt-2">
                <div className="label">Immagini (un URL per riga)</div>
                <textarea className="input min-h-24" value={imagesRaw} onChange={e=>setImagesRaw(e.target.value)} placeholder="https://…"/>
              </div>

              <div className="mt-2">
                <div className="label">Tag (separati da virgola)</div>
                <input className="input" value={tagsRaw} onChange={e=>setTagsRaw(e.target.value)} placeholder="es. viaggio, tempio, segreto" />
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800">
                <button className="btn" onClick={saveCurrent}>💾 Salva</button>
                <button
                  className="btn"
                  onClick={()=>{
                    if (!current) return
                    // invia direttamente quanto ho nell’editor (anche se non ho salvato)
                    const tmp: Nota = {
                      ...current,
                      title, type, content,
                      images: normalizeUrls(imagesRaw),
                      tags: normalizeTags(tagsRaw),
                      folderId: folderForNote || null,
                    }
                    sendNoteToChat(tmp)
                  }}
                  disabled={!connected}
                >
                  ↗︎ Invia in chat
                </button>
                <button className="btn !bg-zinc-800" onClick={()=> current && duplicateNote(current.id)}>Duplica</button>
                <button className="btn !bg-zinc-800" onClick={()=> current && deleteNote(current.id)}>Elimina</button>
              </div>

              {/* preview immagini */}
              {normalizeUrls(imagesRaw).length>0 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {normalizeUrls(imagesRaw).slice(0,4).map((u,i)=>(
                    <a key={i} className="block rounded-lg overflow-hidden border border-zinc-800" href={u} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="" className="w-full h-28 object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
