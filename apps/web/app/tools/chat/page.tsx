'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useWS, useWSMessages } from '@/components/ws/WSProvider'
import { archeiRoll } from '@shared/dice'

// ===== tipi base chat =====
type Msg = { nick: string; text: string; ts: number }

// ===== helper linkify =====
function linkifyParts(text: string): (string | JSX.Element)[] {
  const urlRe = /\bhttps?:\/\/[^\s)\]]+/gi
  const parts: (string | JSX.Element)[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = urlRe.exec(text)) !== null) {
    const start = m.index
    if (start > last) parts.push(text.slice(last, start))
    const url = m[0]
    parts.push(
      <a
        key={`${start}-${url}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-indigo-400 underline break-words"
      >
        {url}
      </a>
    )
    last = start + url.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

// NPC: "NPC: Nome — Ritratto: URL" (accetta anche "-" e "--")
const NPC_RE = /^NPC:\s*(.+?)\s*[—-]+\s*Ritratto:\s*(https?:\/\/\S+)/i
function parseNpcLine(text: string): { name: string, portrait: string } | null {
  const m = text.match(NPC_RE)
  if (!m) return null
  return { name: m[1].trim(), portrait: m[2].trim() }
}

// MOSTRO: "Mostro: Nome — 🖼️ Ritratto: URL" o "🗡️ Mostro: Nome — Ritratto: URL"
const MONSTER_RE = /(?:🗡️\s*)?Mostro:\s*(.+?)\s*[—-]+\s*(?:🖼️\s*)?Ritratto:\s*(https?:\/\/\S+)/i
function parseMonsterLine(text: string): { name: string, portrait: string } | null {
  const m = text.match(MONSTER_RE)
  if (!m) return null
  return { name: m[1].trim(), portrait: m[2].trim() }
}

// ===== storage keys =====
const LS_SHEET = 'archei:player:sheet'
const LS_INV   = 'archei:player:inventory'
const LS_NOTES = 'archei:player:quickNotes'

// ===== tipi anteprime player =====
type SheetPreview = {
  name?: string
  archetype?: string
  level?: number
  hp?: number
  hpMax?: number
  dif?: number
  soglia?: number
}
type InvPreview = {
  coins?: number
  items?: { name: string; qty?: number }[]
}
type QuickNote = { id: string; text: string; ts: number }

// ===== util =====
const clamp = (n:number, a:number, b:number)=> Math.max(a, Math.min(b, n))
const uid = ()=> Math.random().toString(36).slice(2,9)

export default function PlayerChatPage() {
  const { config, connected, connecting, error, openSetup, send } = useWS()
  const room = config?.room || 'default'

  // ===== NICK dall’account (/api/auth/me) =====
  const [nickUI, setNickUI] = useState<string>(() => {
    try { return localStorage.getItem('archei:nick') || '' } catch { return '' }
  })
  useEffect(() => {
    let aborted = false
    ;(async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const nickname = data?.user?.nickname as string | undefined
        const role = (data?.user?.role as string | undefined) || 'player'
        if (nickname) {
          try { localStorage.setItem('archei:nick', nickname) } catch {}
          if (!aborted) setNickUI(nickname)
        }
        try { localStorage.setItem('archei:role', role) } catch {}
      } catch {}
    })()
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'archei:nick' && typeof e.newValue === 'string') setNickUI(e.newValue)
    }
    window.addEventListener('storage', onStorage)
    return () => { aborted = true; window.removeEventListener('storage', onStorage) }
  }, [])

  // ===== Chat & dadi =====
  const [messages, setMessages] = useState<Msg[]>([])
  const [total, setTotal] = useState(5)
  const [real, setReal] = useState(5)
  const [lastRoll, setLastRoll] = useState<any>(null)

  // Anteprime da chat
  const [npcPreview, setNpcPreview] = useState<{ name: string; portrait: string } | null>(null)
  const [monsterPreview, setMonsterPreview] = useState<{ name: string; portrait: string } | null>(null)

  // ===== Colonna destra: dati player (solo struttura) =====
  const [sheet, setSheet] = useState<SheetPreview>({})
  const [inv, setInv] = useState<InvPreview>({ items: [] })
  const [notes, setNotes] = useState<QuickNote[]>([])
  const [newNote, setNewNote] = useState('')

  // carica anteprime da LS
  useEffect(()=> {
    try {
      const s = JSON.parse(localStorage.getItem(LS_SHEET) || '{}')
      setSheet(s || {})
    } catch {}
    try {
      const i = JSON.parse(localStorage.getItem(LS_INV) || '{}')
      setInv(i || { items: [] })
    } catch {}
    try {
      const n = JSON.parse(localStorage.getItem(LS_NOTES) || '[]')
      setNotes(Array.isArray(n)? n : [])
    } catch {}
  }, [])

  // persistenza note
  useEffect(()=> {
    try { localStorage.setItem(LS_NOTES, JSON.stringify(notes)) } catch {}
  }, [notes])

  // ===== WS: ricezione messaggi =====
  useWSMessages((msg) => {
    if (msg.t === 'chat:msg') setMessages(m=>[...m, {nick: msg.nick, text: msg.text, ts: msg.ts}])
  })

  // ===== Autoscroll chat =====
  const chatRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = chatRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const nearBottom = distanceFromBottom < 80
    if (nearBottom) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight })
  }, [messages])
  useEffect(() => {
    const el = chatRef.current
    if (!el) return
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight })
  }, [])

  // ===== Azioni chat/dadi =====
  function sendChat(text:string){
    if (!config) return
    const who = (nickUI && nickUI.trim()) ? nickUI.trim() : (config.nick || 'Player')
    send({ t:'chat:msg', room: config.room, nick: who, text, ts:Date.now(), channel:'global' })
    const el = chatRef.current
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight })
  }
  function roll(){
    const res = archeiRoll(total, real)
    setLastRoll(res)
    sendChat(`Tiro ARCHEI — tot:${res.totalDice}, reali:${res.realDice}, soglia:${res.threshold}, tiri:[${res.rolls.join(',')}], successi:${res.successes}${res.fiveOfFive?' (CRITICO 5/5)':''}`)
  }

  // Anteprime da ultimo messaggio
  useEffect(()=>{
    const last = messages[messages.length - 1]
    if (!last) return
    const npc = parseNpcLine(last.text)
    if (npc) { setNpcPreview(npc); return }
    const mon = parseMonsterLine(last.text)
    if (mon) setMonsterPreview(mon)
  }, [messages])

  // ===== Stato WS topbar =====
  const status = useMemo(() => {
    const color = connecting ? 'bg-yellow-500' : connected ? 'bg-green-500' : error ? 'bg-red-500' : 'bg-zinc-600'
    const label = connecting ? 'conn…' : connected ? 'online' : (error ? 'errore' : 'offline')
    return <div className="flex items-center gap-2 text-xs text-zinc-400"><div className={`w-2.5 h-2.5 rounded-full ${color}`} />{label}</div>
  }, [connected, connecting, error])

  // ===== Note rapide: azioni =====
  function addNote() {
    const t = (newNote || '').trim()
    if (!t) return
    setNotes(n => [...n, { id: uid(), text: t, ts: Date.now() }])
    setNewNote('')
  }
  function delNote(id:string) {
    setNotes(n => n.filter(x=>x.id!==id))
  }
  function sendNoteToChat(id:string) {
    const n = notes.find(x=>x.id===id)
    if (!n) return
    sendChat(`📝 Nota: ${n.text}`)
  }

  return (
    <div className="min-h-screen flex flex-col gap-4">
      {/* TOPBAR SEMPLICE */}
      <div className="border-b border-zinc-800 p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold">Archei Companion — Player</div>
          <button className="btn !bg-zinc-800" onClick={openSetup}>WS</button>
          {status}
        </div>
        <div className="text-xs text-zinc-500">Utente: {nickUI || 'Player'}</div>
      </div>

      {/* DUE COLONNE */}
      <div className="grid xl:grid-cols-[1fr_420px] gap-4 flex-1 min-h-0">
        {/* SINISTRA: Chat + dadi */}
        <div className="space-y-4 min-h-0 flex flex-col">
          {/* Tiradadi */}
          <div className="card space-y-3">
            <div className="font-semibold">Tiradadi</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="label">Dadi totali</div>
                <input className="input" type="number" value={total} onChange={e=>setTotal(parseInt(e.target.value||'0'))}/>
              </div>
              <div>
                <div className="label">Dadi reali</div>
                <input className="input" type="number" value={real} onChange={e=>setReal(parseInt(e.target.value||'0'))}/>
              </div>
              <div className="col-span-2">
                <button className="btn" onClick={roll} disabled={!connected}>Lancia</button>
              </div>
            </div>
            {lastRoll && (
              <div className="text-sm text-zinc-400">
                Soglia: {lastRoll.threshold} • Successi: <span className="text-green-400">{lastRoll.successes}</span>
              </div>
            )}
          </div>

          {/* Chat */}
          <div className="card flex flex-col min-h-0 max-h-[60vh]">
            <div className="font-semibold mb-2">Chat</div>

            {/* ANTEPRIMA NPC */}
            {npcPreview && (
              <div className="mb-3 rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/40">
                <div className="flex items-center gap-3 p-3">
                  <div className="w-20 h-16 rounded-md overflow-hidden bg-zinc-800 shrink-0">
                    <img src={npcPreview.portrait} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{npcPreview.name}</div>
                    <a href={npcPreview.portrait} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-400 underline">
                      🖌️ Ritratto
                    </a>
                  </div>
                  <button className="btn !bg-zinc-800 ml-auto" title="Chiudi anteprima" onClick={()=>setNpcPreview(null)}>✕</button>
                </div>
              </div>
            )}

            {/* ANTEPRIMA MOSTRO */}
            {monsterPreview && (
              <div className="mb-3 rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/40">
                <div className="flex items-center gap-3 p-3">
                  <div className="w-20 h-16 rounded-md overflow-hidden bg-zinc-800 shrink-0">
                    <img src={monsterPreview.portrait} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">🗡️ Mostro: {monsterPreview.name}</div>
                    <a href={monsterPreview.portrait} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-400 underline">
                      🖌️ Ritratto
                    </a>
                  </div>
                  <button className="btn !bg-zinc-800 ml-auto" title="Chiudi anteprima" onClick={()=>setMonsterPreview(null)}>✕</button>
                </div>
              </div>
            )}

            <div ref={chatRef} className="flex-1 overflow-auto">
              {messages.length===0 ? (
                <div className="text-sm text-zinc-500">Nessun messaggio.</div>
              ) : (
                <div className="space-y-2">
                  {messages.map((m,i)=>{
                    const npc = parseNpcLine(m.text)
                    if (npc) {
                      return (
                        <div key={i} className="bg-zinc-900/50 rounded-xl px-3 py-2">
                          <span className="text-teal-400">{m.nick}:</span>{' '}
                          <span className="font-semibold">NPC: {npc.name}</span>{' '}
                          <a href={npc.portrait} target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">🖌️ Ritratto</a>
                        </div>
                      )
                    }
                    const mon = parseMonsterLine(m.text)
                    if (mon) {
                      return (
                        <div key={i} className="bg-zinc-900/50 rounded-xl px-3 py-2">
                          <span className="text-teal-400">{m.nick}:</span>{' '}
                          <span className="font-semibold">🗡️ Mostro: {mon.name}</span>{' '}
                          <a href={mon.portrait} target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">🖌️ Ritratto</a>
                        </div>
                      )
                    }
                    return (
                      <div key={i} className="bg-zinc-900/50 rounded-xl px-3 py-2 break-words">
                        <span className="text-teal-400">{m.nick}:</span>{' '}
                        {linkifyParts(m.text)}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <ChatInput onSend={txt=>sendChat(txt)} disabled={!connected}/>
          </div>
        </div>

        {/* DESTRA: scheda / inventario / note */}
        <div className="space-y-4">
          {/* Scheda personaggio (ANTEPRIMA) */}
          <div className="card space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Scheda personaggio</div>
              {/* il redirect lo aggiungeremo dopo */}
              <button className="btn !bg-zinc-800" disabled>Apri scheda</button>
            </div>
            <div className="rounded-xl border border-zinc-800 p-3">
              <div className="text-lg font-bold">{sheet.name || '—'}</div>
              <div className="text-sm text-zinc-400">
                {sheet.archetype || '—'} • Livello {sheet.level ?? '—'}
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm mt-3">
                <div className="bg-zinc-900/50 rounded-lg p-2">
                  <div className="text-zinc-400 text-xs">HP</div>
                  <div className="font-semibold">
                    {typeof sheet.hp === 'number' && typeof sheet.hpMax === 'number' ? `${clamp(sheet.hp,0,sheet.hpMax)}/${sheet.hpMax}` : '—'}
                  </div>
                </div>
                <div className="bg-zinc-900/50 rounded-lg p-2">
                  <div className="text-zinc-400 text-xs">DIF</div>
                  <div className="font-semibold">{typeof sheet.dif === 'number' ? sheet.dif : '—'}</div>
                </div>
                <div className="bg-zinc-900/50 rounded-lg p-2">
                  <div className="text-zinc-400 text-xs">Soglia</div>
                  <div className="font-semibold">{typeof sheet.soglia === 'number' ? `${sheet.soglia}+` : '—'}</div>
                </div>
              </div>
            </div>
            <div className="text-xs text-zinc-500">
              (Questa è un’anteprima. Imposteremo i dati reali quando creeremo la sezione “Scheda Player”.)
            </div>
          </div>

          {/* Inventario (ESSENZIALE) */}
          <div className="card space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Inventario</div>
              {/* il redirect lo aggiungeremo dopo */}
              <button className="btn !bg-zinc-800" disabled>Apri inventario</button>
            </div>
            <div className="rounded-xl border border-zinc-800 p-3">
              <div className="flex items-center justify-between text-sm">
                <div className="text-zinc-400">Monete</div>
                <div className="font-semibold">{typeof inv.coins === 'number' ? inv.coins : 0}</div>
              </div>
              <div className="mt-2 text-sm">
                <div className="text-zinc-400 mb-1">Oggetti principali</div>
                {inv.items && inv.items.length > 0 ? (
                  <ul className="list-disc list-inside space-y-0.5">
                    {inv.items.slice(0,5).map((it,idx)=>(
                      <li key={`${it.name}-${idx}`}>
                        {it.name} {typeof it.qty==='number' ? `×${it.qty}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-zinc-500">Nessun oggetto.</div>
                )}
              </div>
            </div>
            <div className="text-xs text-zinc-500">
              (Anteprima: mostriamo max 5 oggetti. Il resto nella pagina Inventario.)
            </div>
          </div>

          {/* Note rapide */}
          <div className="card space-y-2">
            <div className="font-semibold">Note rapide</div>
            <textarea
              className="input min-h-24"
              placeholder="Scrivi una nota veloce…"
              value={newNote}
              onChange={e=>setNewNote(e.target.value)}
            />
            <div className="flex gap-2">
              <button className="btn" onClick={addNote}>+ Aggiungi</button>
              <button className="btn !bg-zinc-800" disabled>Apri note personali</button>
            </div>

            <div className="space-y-2 pt-2 border-t border-zinc-800">
              {notes.length === 0 ? (
                <div className="text-sm text-zinc-500">Nessuna nota.</div>
              ) : notes.slice().reverse().map(n=>(
                <div key={n.id} className="rounded-xl border border-zinc-800 p-2 text-sm bg-zinc-900/40">
                  <div className="mb-2 whitespace-pre-wrap break-words">{linkifyParts(n.text)}</div>
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <div>{new Date(n.ts).toLocaleString()}</div>
                    <div className="flex gap-2">
                      <button className="btn" onClick={()=>sendNoteToChat(n.id)}>Invia in chat</button>
                      <button className="btn !bg-zinc-800" onClick={()=>delNote(n.id)}>Elimina</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

function ChatInput({ onSend, disabled }: { onSend:(txt:string)=>void; disabled?:boolean }){
  const [txt,setTxt] = useState('')
  return (
    <div className="mt-3 flex gap-2">
      <input className="input" value={txt} disabled={disabled} onChange={e=>setTxt(e.target.value)}
             onKeyDown={e=>{ if(e.key==='Enter' && txt.trim() && !disabled){ onSend(txt); setTxt('') } }}
             placeholder={disabled?'Non connesso…':'Scrivi… (Invio per inviare)'} />
      <button className="btn" onClick={()=>{ if(txt.trim() && !disabled){ onSend(txt); setTxt('') } }} disabled={disabled}>Invia</button>
    </div>
  )
}
