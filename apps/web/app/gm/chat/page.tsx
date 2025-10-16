'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useWS, useWSMessages } from '@/components/ws/WSProvider'
import DicePreview from '@/components/DicePreview'
import { archeiRoll } from '@shared/dice'

type Msg = { nick: string; text: string; ts: number }
type InitEntry = { id:string; name:string; init:number }
type CountdownItem = { label:string; value:number; max:number }
type ClockItem = { name:string; value:number; max:number }
type InitiativeState = { entries:InitEntry[]; active:number; round:number; visible:boolean }

// chiavi base (verranno “namespaced” per room)
const LS_SCENE = 'archei:gm:scene'
const LS_CD    = 'archei:gm:countdown'
const LS_CK    = 'archei:gm:clocks'
const LS_INIT  = 'archei:gm:init'

// helper: chiave per stanza
const keyFor = (base: string, room?: string) => `${base}:${room || 'default'}`

// ===== Helpers aggiunti =====
function linkifyParts(text: string): (string | JSX.Element)[] {
  // Riconosce http/https fino al primo spazio o ) o ]
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

export default function GmChatPage() {
  const { config, connected, connecting, error, openSetup, send } = useWS()
  const room = config?.room || 'default'

  // chat/dadi
  const [messages, setMessages] = useState<Msg[]>([])
  const [total, setTotal] = useState(5)
  const [real, setReal] = useState(5)
  const [lastRoll, setLastRoll] = useState<any>(null)

  // ===== Stato anteprima NPC =====
  const [npcPreview, setNpcPreview] = useState<{ name: string; portrait: string } | null>(null)

  // scene (input + display)
  const [sceneTitle, setSceneTitle] = useState(''); const [sceneText, setSceneText] = useState(''); const [sceneImages, setSceneImages] = useState('')
  const [displayScene, setDisplayScene] = useState<{title?:string; text?:string; images?:string[]; bannerEnabled?:boolean; bannerColor?:string}>({})

  // countdown / clocks
  const [cdItems, setCdItems] = useState<CountdownItem[]>([])
  const [displayCountdown, setDisplayCountdown] = useState<CountdownItem[]>([])
  const [cdLabel, setCdLabel] = useState(''); const [cdVal, setCdVal] = useState(0); const [cdMax, setCdMax] = useState(6)

  const [ckItems, setCkItems] = useState<ClockItem[]>([])
  const [displayClocks, setDisplayClocks] = useState<ClockItem[]>([])
  const [ckName, setCkName] = useState(''); const [ckVal, setCkVal] = useState(0); const [ckMax, setCkMax] = useState(4)

  // iniziativa
  const [init, setInit] = useState<InitiativeState>({ entries:[], active:0, round:1, visible:true })
  const [displayInitiative, setDisplayInitiative] = useState<InitiativeState>({ entries:[], active:0, round:1, visible:false })
  const [newInitName, setNewInitName] = useState(''); const [newInitVal, setNewInitVal] = useState(10)

  // debounce salvataggi
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleSave = (fn:()=>void) => { if (saveTimer.current) clearTimeout(saveTimer.current); saveTimer.current = setTimeout(fn, 300) }

  // ruolo
  useEffect(()=>{ localStorage.setItem('archei:role','gm') }, [])

  // restore per stanza
  useEffect(()=>{ try{
    const sc = JSON.parse(localStorage.getItem(keyFor(LS_SCENE, room)) || '{"title":"","text":"","images":""}')
    setSceneTitle(sc.title||''); setSceneText(sc.text||''); setSceneImages(Array.isArray(sc.images)? sc.images.join('\n') : (sc.images||''))
  }catch{} }, [room])

  useEffect(()=>{ try{ setCdItems(JSON.parse(localStorage.getItem(keyFor(LS_CD, room)) || '[]')) }catch{} }, [room])
  useEffect(()=>{ try{
    const cks = JSON.parse(localStorage.getItem(keyFor(LS_CK, room)) || '[]')
    setCkItems(cks); setDisplayClocks(cks)
  }catch{} }, [room])
  useEffect(()=>{ try{ setInit(JSON.parse(localStorage.getItem(keyFor(LS_INIT, room)) || '{"entries":[],"active":0,"round":1,"visible":true}')) }catch{} }, [room])

  // persist (debounced) per stanza
  useEffect(()=>{ scheduleSave(()=> {
    localStorage.setItem(keyFor(LS_SCENE, room), JSON.stringify({ title:sceneTitle, text:sceneText, images:sceneImages }))
  }) }, [sceneTitle, sceneText, sceneImages, room])

  useEffect(()=>{ scheduleSave(()=> {
    localStorage.setItem(keyFor(LS_CD, room), JSON.stringify(cdItems))
  }) }, [cdItems, room])

  useEffect(()=>{ scheduleSave(()=> {
    localStorage.setItem(keyFor(LS_CK, room), JSON.stringify(ckItems))
  }) }, [ckItems, room])

  useEffect(()=>{ scheduleSave(()=> {
    localStorage.setItem(keyFor(LS_INIT, room), JSON.stringify(init))
  }) }, [init, room])

  // salva anche quando cambi scheda o chiudi
  useEffect(() => {
    const persistNow = () => {
      localStorage.setItem(keyFor(LS_SCENE, room), JSON.stringify({ title:sceneTitle, text:sceneText, images:sceneImages }))
      localStorage.setItem(keyFor(LS_CD, room), JSON.stringify(cdItems))
      localStorage.setItem(keyFor(LS_CK, room), JSON.stringify(ckItems))
      localStorage.setItem(keyFor(LS_INIT, room), JSON.stringify(init))
    }
    const onVis = () => persistNow()
    const onUnload = () => persistNow()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [sceneTitle, sceneText, sceneImages, cdItems, ckItems, init, room])

  // ricezione messaggi WS (globale)
  useWSMessages((msg) => {
    if (msg.t === 'chat:msg') setMessages(m=>[...m, {nick: msg.nick, text: msg.text, ts: msg.ts}])

    // SCENE: supporta nuovo e legacy + banner
    if (msg.t === 'DISPLAY_SCENE_STATE' || msg.t === 'DISPLAY_SCENE') {
      setDisplayScene({
        title: msg.title,
        text: msg.text,
        images: msg.images,
        bannerEnabled: msg.bannerEnabled,
        bannerColor: msg.bannerColor
      })
    }

    if (msg.t === 'DISPLAY_CLOCKS_STATE' && Array.isArray(msg.clocks)) { setCkItems(msg.clocks); setDisplayClocks(msg.clocks) }
    if (msg.t === 'DISPLAY_COUNTDOWN' && Array.isArray(msg.items)) setDisplayCountdown(msg.items)
    if (msg.t === 'DISPLAY_INITIATIVE_STATE' && msg.initiative) setDisplayInitiative(msg.initiative)
  })

  // Quando arriva un nuovo messaggio, se è un NPC, aggiorna l’anteprima
  useEffect(()=>{
    const last = messages[messages.length - 1]
    if (!last) return
    const npc = parseNpcLine(last.text)
    if (npc) setNpcPreview(npc)
  }, [messages])

  const status = useMemo(() => {
    const color = connecting ? 'bg-yellow-500' : connected ? 'bg-green-500' : error ? 'bg-red-500' : 'bg-zinc-600'
    const label = connecting ? 'conn…' : connected ? 'online' : (error ? 'errore' : 'offline')
    return <div className="flex items-center gap-2 text-xs text-zinc-400"><div className={`w-2.5 h-2.5 rounded-full ${color}`} />{label}</div>
  }, [connected, connecting, error])

  // ===== Autoscroll chat =====
  const chatRef = useRef<HTMLDivElement | null>(null)
  // Scorri in fondo quando arrivano messaggi (solo se l'utente è già vicino al fondo)
  useEffect(() => {
    const el = chatRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const nearBottom = distanceFromBottom < 80 // se sta leggendo in alto, non forziamo
    if (nearBottom) {
      requestAnimationFrame(() => { el.scrollTop = el.scrollHeight })
    }
  }, [messages])
  // All'apertura pagina porta in fondo
  useEffect(() => {
    const el = chatRef.current
    if (!el) return
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight })
  }, [])

  // azioni
  function sendChat(text:string){
    if (!config) return
    send({ t:'chat:msg', room: config.room, nick: config.nick, text, ts:Date.now(), channel:'global' })
    // autoscroll immediato quando invii tu
    const el = chatRef.current
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight })
  }
  function roll(){
    const res = archeiRoll(total, real)
    setLastRoll(res)
    sendChat(`Tiro ARCHEI — tot:${res.totalDice}, reali:${res.realDice}, soglia:${res.threshold}, tiri:[${res.rolls.join(',')}], successi:${res.successes}${res.fiveOfFive?' (CRITICO 5/5)':''}`)
  }

  function publishScene(announce=true){
    if (!config) return
    const images = sceneImages.split('\n').map(s=>s.trim()).filter(Boolean)
    const payload = { t:'DISPLAY_SCENE_STATE', room: config.room, title: sceneTitle || undefined, text: sceneText || undefined, images: images.length?images:undefined }
    send(payload); setDisplayScene({ title:payload.title, text:payload.text, images:payload.images })
    if (announce) sendChat(`📜 Scena aggiornata${sceneTitle?`: ${sceneTitle}`:''}`)
  }
  function clearScene(){
    if (!config) return
    setSceneTitle(''); setSceneText(''); setSceneImages('')
    send({ t:'DISPLAY_SCENE_STATE', room: config.room, title:'', text:'', images:[] })
    setDisplayScene({})
  }

  function addCountdown(){ if(!cdLabel.trim()) return
    setCdItems(v=>[...v, { label:cdLabel.trim(), value:cdVal, max:cdMax }]); setCdLabel(''); setCdVal(0); setCdMax(6) }
  function updateCd(i:number, patch:Partial<CountdownItem>){ setCdItems(v=>v.map((it,idx)=> idx===i?{...it,...patch}:it)) }
  function removeCd(i:number){ setCdItems(v=>v.filter((_,idx)=> idx!==i)) }
  function publishCountdown(announce=true){
    if (!config) return
    send({ t:'DISPLAY_COUNTDOWN', room: config.room, items: cdItems }); setDisplayCountdown(cdItems)
    if (announce) sendChat('⏳ Countdown aggiornati')
  }

  function addClock(){ if(!ckName.trim()) return
    setCkItems(v=>[...v, { name:ckName.trim(), value:ckVal, max:ckMax }]); setCkName(''); setCkVal(0); setCkMax(4) }
  function updateCk(i:number, patch:Partial<ClockItem>){ setCkItems(v=>v.map((it,idx)=> idx===i?{...it,...patch}:it)) }
  function removeCk(i:number){ setCkItems(v=>v.filter((_,idx)=> idx!==i)) }
  function publishClocks(announce=true){
    if (!config) return
    send({ t:'DISPLAY_CLOCKS_STATE', room: config.room, clocks: ckItems }); setDisplayClocks(ckItems)
    if (announce) sendChat('🕒 Clocks aggiornati')
  }

  function addEntry(){ if(!newInitName.trim()) return
    const id = Math.random().toString(36).slice(2,8)
    setInit(s=>({ ...s, entries:[...s.entries, { id, name:newInitName.trim(), init:Number.isFinite(newInitVal)?newInitVal:10 }] }))
    setNewInitName(''); setNewInitVal(10)
  }
  function removeEntry(id:string){ setInit(s=>({ ...s, entries:s.entries.filter(e=>e.id!==id) })) }
  function sortByInit(){ setInit(s=>({ ...s, entries:[...s.entries].sort((a,b)=>b.init-a.init) })) }
  function startOrder(){ setInit(s=>({ ...s, active:0, round:1, entries:[...s.entries].sort((a,b)=>b.init-a.init) })); setTimeout(()=>publishInitiative(),0) }
  function nextTurn(){ setInit(s=>{ const n=s.entries.length; if(!n) return s; const a=(s.active+1)%n; return {...s, active:a, round: a===0? s.round+1 : s.round } }); setTimeout(()=>publishInitiative(),0) }
  function prevTurn(){ setInit(s=>{ const n=s.entries.length; if(!n) return s; const a=(s.active-1+n)%n; return {...s, active:a} }); setTimeout(()=>publishInitiative(),0) }
  function clearInit(){ setInit(s=>({ entries:[], active:0, round:1, visible:s.visible })); setTimeout(()=>publishInitiative(),0) }
  function toggleInitVisible(v:boolean){ setInit(s=>({ ...s, visible:v })); setTimeout(()=>publishInitiative(),0) }
  function publishInitiative(announce=true){
    if (!config) return
    send({ t:'DISPLAY_INITIATIVE_STATE', room: config.room, initiative: init }); setDisplayInitiative(init)
    if (announce) sendChat('⚔️ Iniziativa aggiornata')
  }

  return (
    <div className="min-h-screen flex flex-col gap-4">
      {/* TOPBAR */}
      <div className="border-b border-zinc-800 p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold">Archei Companion</div>
          <button className="btn !bg-zinc-800" onClick={openSetup}>WS</button>
          {status}
        </div>
        <div className="text-xs text-zinc-500">GM</div>
      </div>

      {/* DUE COLONNE */}
      <div className="grid xl:grid-cols-[360px_1fr] gap-4 flex-1 min-h-0">
        {/* SINISTRA (tendine) */}
        <div className="space-y-4">
          {/* Tiradadi */}
          <details className="card space-y-3" open>
            <summary className="font-semibold cursor-pointer select-none">Tiradadi</summary>
            <div className="grid grid-cols-2 gap-2">
              <div><div className="label">Dadi totali</div><input className="input" type="number" value={total} onChange={e=>setTotal(parseInt(e.target.value||'0'))}/></div>
              <div><div className="label">Dadi reali</div><input className="input" type="number" value={real} onChange={e=>setReal(parseInt(e.target.value||'0'))}/></div>
              <div className="col-span-2"><button className="btn" onClick={roll} disabled={!connected}>Lancia</button></div>
            </div>
            {lastRoll && <div className="text-sm text-zinc-400">Soglia: {lastRoll.threshold} • Successi: <span className="text-green-400">{lastRoll.successes}</span></div>}
          </details>

          {/* Selettore Scene */}
          <details className="card space-y-2" open>
            <summary className="font-semibold cursor-pointer select-none">Selettore Scene</summary>
            <input className="input" placeholder="Titolo" value={sceneTitle} onChange={e=>setSceneTitle(e.target.value)} />
            <textarea className="input min-h-24" placeholder="Testo" value={sceneText} onChange={e=>setSceneText(e.target.value)} />
            <textarea className="input min-h-20" placeholder="Immagini (una URL per riga)" value={sceneImages} onChange={e=>setSceneImages(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn" onClick={()=>publishScene(true)} disabled={!connected}>Mostra</button>
              <button className="btn !bg-zinc-800" onClick={clearScene} disabled={!connected}>Svuota</button>
            </div>
          </details>

          {/* Clocks */}
          <details className="card space-y-3">
            <summary className="font-semibold cursor-pointer select-none">Controllo CLOCK</summary>
            <div className="grid grid-cols-3 gap-2">
              <input className="input col-span-2" placeholder="Nome/Etichetta" value={ckName} onChange={e=>setCkName(e.target.value)} />
              <input className="input" type="number" placeholder="Max" value={ckMax} onChange={e=>setCkMax(parseInt(e.target.value||'0'))}/>
              <input className="input" type="number" placeholder="Valore" value={ckVal} onChange={e=>setCkVal(parseInt(e.target.value||'0'))}/>
              <button className="btn" onClick={addClock}>+ Aggiungi</button>
            </div>
            <div className="space-y-2">
              {ckItems.map((c,i)=>(
                <div key={i} className="flex items-center gap-2">
                  <input className="input flex-1" value={c.name} onChange={e=>updateCk(i,{name:e.target.value})}/>
                  <input className="input w-20" type="number" value={c.value} onChange={e=>updateCk(i,{value:parseInt(e.target.value||'0')})}/>
                  <input className="input w-20" type="number" value={c.max} onChange={e=>updateCk(i,{max:parseInt(e.target.value||'0')})}/>
                  <button className="btn !bg-zinc-800" onClick={()=>removeCk(i)}>✕</button>
                </div>
              ))}
              {ckItems.length===0 && <div className="text-sm text-zinc-500">Nessun clock.</div>}
            </div>
            <div className="flex gap-2">
              <button className="btn" onClick={()=>publishClocks(true)} disabled={!connected}>Invia</button>
              <button className="btn !bg-zinc-800" onClick={()=>{ setCkItems([]); publishClocks(true) }} disabled={!connected}>Svuota</button>
            </div>

            <div className="border-t border-zinc-800 pt-3">
              <div className="font-semibold mb-2">Countdown rapidi</div>
              <div className="grid grid-cols-3 gap-2">
                <input className="input col-span-2" placeholder="Etichetta" value={cdLabel} onChange={e=>setCdLabel(e.target.value)} />
                <input className="input" type="number" placeholder="Max" value={cdMax} onChange={e=>setCdMax(parseInt(e.target.value||'0'))}/>
                <input className="input" type="number" placeholder="Valore" value={cdVal} onChange={e=>setCdVal(parseInt(e.target.value||'0'))}/>
                <button className="btn" onClick={addCountdown}>+ Aggiungi</button>
              </div>
              <div className="space-y-2 mt-2">
                {cdItems.map((c,i)=>{
                  const pct = Math.max(0, Math.min(100, Math.round((c.value/(c.max||1))*100)))
                  return (
                    <div key={i}>
                      <div className="flex items-center gap-2">
                        <input className="input flex-1" value={c.label} onChange={e=>updateCd(i,{label:e.target.value})}/>
                        <input className="input w-20" type="number" value={c.value} onChange={e=>updateCd(i,{value:parseInt(e.target.value||'0')})}/>
                        <input className="input w-20" type="number" value={c.max} onChange={e=>updateCd(i,{max:parseInt(e.target.value||'0')})}/>
                        <button className="btn !bg-zinc-800" onClick={()=>removeCd(i)}>✕</button>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mt-1">
                        <div className="h-full bg-teal-500" style={{width:`${pct}%`}}/>
                      </div>
                    </div>
                  )
                })}
                {cdItems.length===0 && <div className="text-sm text-zinc-500">Nessun countdown.</div>}
              </div>
              <div className="flex gap-2 mt-2">
                <button className="btn" onClick={()=>publishCountdown(true)} disabled={!connected}>Invia</button>
                <button className="btn !bg-zinc-800" onClick={()=>{ setCdItems([]); publishCountdown(true) }} disabled={!connected}>Svuota</button>
              </div>
            </div>
          </details>

          {/* Iniziativa */}
          <details className="card space-y-3" open>
            <summary className="flex items-center justify-between cursor-pointer select-none">
              <span className="font-semibold">Tracker Iniziativa</span>
              <label className="label flex items-center gap-2">
                <input type="checkbox" checked={init.visible} onChange={e=>toggleInitVisible(e.target.checked)} />
                Mostra ai player
              </label>
            </summary>
            <div className="grid grid-cols-3 gap-2">
              <input className="input col-span-2" placeholder="Nome" value={newInitName} onChange={e=>setNewInitName(e.target.value)} />
              <input className="input" type="number" placeholder="Init" value={newInitVal} onChange={e=>setNewInitVal(parseInt(e.target.value||'10'))}/>
            </div>
            <div className="flex gap-2">
              <button className="btn" onClick={addEntry}>+ Aggiungi</button>
              <button className="btn" onClick={sortByInit}>Ordina</button>
              <button className="btn" onClick={startOrder}>Avvia</button>
              <button className="btn !bg-zinc-800" onClick={clearInit}>Svuota</button>
            </div>
            <div className="text-sm text-zinc-400">Round: <span className="text-zinc-200">{init.round}</span></div>
            <div className="space-y-2 max-h-56 overflow-auto">
              {init.entries.map((e,i)=>(
                <div key={e.id} className={`rounded-xl border px-3 py-2 flex items-center justify-between ${i===init.active?'border-teal-600 bg-teal-600/10':'border-zinc-800 bg-zinc-900/40'}`}>
                  <div className="flex items-center gap-2">
                    <input className="w-12 bg-transparent border border-zinc-800 rounded px-2 py-1" type="number"
                      value={e.init}
                      onChange={ev=>setInit(s=>({ ...s, entries:s.entries.map(x=>x.id===e.id?{...x,init:parseInt(ev.target.value||'0')}:x) }))}
                      onBlur={sortByInit}
                    />
                    <input className="bg-transparent border-b border-transparent focus:border-teal-600 outline-none"
                      value={e.name} onChange={ev=>setInit(s=>({ ...s, entries:s.entries.map(x=>x.id===e.id?{...x,name:ev.target.value}:x) }))}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="btn" onClick={()=>{ setInit(s=>({ ...s, active:i })); publishInitiative() }}>Attiva</button>
                    <button className="btn !bg-zinc-800" onClick={()=>removeEntry(e.id)}>✕</button>
                  </div>
                </div>
              ))}
              {init.entries.length===0 && <div className="text-sm text-zinc-500">Aggiungi i combattenti e premi Avvia.</div>}
            </div>
            <div className="flex gap-2">
              <button className="btn" onClick={prevTurn}>← Prec</button>
              <button className="btn" onClick={nextTurn}>Succ →</button>
              <button className="btn" onClick={()=>publishInitiative(true)} disabled={!connected}>Invia</button>
            </div>
          </details>
        </div>

        {/* DESTRA */}
        <div className="space-y-4 min-h-0 flex flex-col">
          {/* DISPLAY */}
          <div className="card space-y-3 overflow-auto">
            <div className="font-semibold">DISPLAY</div>

            {/* Scena */}
            {(displayScene.title || displayScene.text || (displayScene.images?.length)) ? (
              <div className="space-y-2">
                {/* Banner con TITOLO dentro */}
                {displayScene.bannerEnabled && displayScene.bannerColor && (
                  <div className="rounded-xl overflow-hidden border border-zinc-800">
                    <div className="px-4 py-3" style={{ backgroundColor: displayScene.bannerColor }}>
                      {displayScene.title && (
                        <div className="text-lg font-bold text-white drop-shadow-sm">
                          {displayScene.title}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {displayScene.images?.[0] && (
                  <img
                    src={displayScene.images[0]}
                    alt=""
                    className="w-full h-40 md:h-56 object-cover rounded-xl border border-zinc-800"
                  />
                )}
                {/* Se NON c'è banner, mostra il titolo normale sotto */}
                {!displayScene.bannerEnabled && displayScene.title && (
                  <div className="text-xl font-bold">{displayScene.title}</div>
                )}
                {displayScene.text && <div className="whitespace-pre-wrap text-zinc-200">{displayScene.text}</div>}
              </div>
            ) : (<div className="text-sm text-zinc-500">Nessuna scena attiva.</div>)}

            {/* Countdown */}
            {displayCountdown.length>0 && (
              <div className="border-t border-zinc-800 pt-3 space-y-2">
                <div className="text-sm font-semibold">Countdown</div>
                {displayCountdown.map((c,i)=>{
                  const pct = Math.max(0, Math.min(100, Math.round((c.value/(c.max||1))*100)))
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-300">{c.label}</span>
                        <span className="text-zinc-400">{c.value}/{c.max}</span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500" style={{width:`${pct}%`}}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Clocks */}
            {displayClocks.length>0 && (
              <div className="border-t border-zinc-800 pt-3 space-y-2">
                <div className="text-sm font-semibold">Clocks</div>
                {displayClocks.map((c,i)=>{
                  const pct = Math.max(0, Math.min(100, Math.round((c.value/(c.max||1))*100)))
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-300">{c.name}</span>
                        <span className="text-zinc-400">{c.value}/{c.max}</span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{width:`${pct}%`}}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Iniziativa */}
            {displayInitiative.visible && displayInitiative.entries.length>0 && (
              <div className="border-t border-zinc-800 pt-3">
                <div className="text-sm text-zinc-400 mb-2">Round {displayInitiative.round}</div>
                <div className="flex flex-wrap gap-2">
                  {displayInitiative.entries.map((e,i)=>(
                    <div key={e.id || e.name} className={`px-3 py-1 rounded-xl border ${i===displayInitiative.active?'border-teal-500 bg-teal-600/20':'border-zinc-700 bg-zinc-800/50'}`}>
                      <span className="font-semibold">{e.name}</span>
                      <span className="text-xs text-zinc-400 ml-2">({e.init})</span>
                      {i===displayInitiative.active && <span className="ml-2 text-teal-400">● turno</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Chat */}
          <div className="card flex flex-col max-h-[50vh]">
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
                    <a
                      href={npcPreview.portrait}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-400 underline"
                    >
                      🖌️ Ritratto
                    </a>
                  </div>
                  <button
                    className="btn !bg-zinc-800 ml-auto"
                    title="Chiudi anteprima"
                    onClick={()=>setNpcPreview(null)}
                  >✕</button>
                </div>
              </div>
            )}

            <div ref={chatRef} className="flex-1 overflow-auto">
              {messages.length===0 ? (
                <div className="text-sm text-zinc-500">Nessun messaggio.</div>
              ) : (
                <div className="space-y-2">
                  {messages.map((m,i)=>{
                    // Messaggio NPC con link formattato "🖌️ Ritratto"
                    const npc = parseNpcLine(m.text)
                    if (npc) {
                      return (
                        <div key={i} className="bg-zinc-900/50 rounded-xl px-3 py-2">
                          <span className="text-teal-400">{m.nick}:</span>{' '}
                          <span className="font-semibold">NPC: {npc.name}</span>{' '}
                          <a
                            href={npc.portrait}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 underline"
                          >
                            🖌️ Ritratto
                          </a>
                        </div>
                      )
                    }
                    // Messaggi normali con linkify
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
