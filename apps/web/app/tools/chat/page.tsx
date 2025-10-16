'use client'
import { useEffect, useState } from 'react'
import { useWS, useWSMessages } from '@/components/ws/WSProvider'

type Msg = { nick: string; text: string; ts: number }
type InitEntry = { id?: string; name: string; init: number }
type Initiative = { entries: InitEntry[]; active: number; round: number; visible: boolean }
type SceneMsg = { title?: string; text?: string; images?: string[] }
type CountdownItem = { label: string; value: number; max: number }
type ClockItem = { name: string; value: number; max: number }

export default function ChatPlayerPage() {
  const { config, connected, connecting, error, openSetup, send } = useWS()

  const [messages, setMessages] = useState<Msg[]>([])
  const [scene, setScene] = useState<SceneMsg>({})
  const [countdown, setCountdown] = useState<CountdownItem[]>([])
  const [clocks, setClocks] = useState<ClockItem[]>([])
  const [initiative, setInitiative] = useState<Initiative>({ entries: [], active: 0, round: 1, visible: false })

  useEffect(() => { localStorage.setItem('archei:role','player') }, [])

  useWSMessages((msg) => {
    if (msg.t === 'chat:msg') setMessages(m => [...m, { nick: msg.nick, text: msg.text, ts: msg.ts }])
    if (msg.t === 'DISPLAY_SCENE_STATE') setScene({ title: msg.title, text: msg.text, images: msg.images || [] })
    if (msg.t === 'DISPLAY_COUNTDOWN' && msg.items) setCountdown(msg.items)
    if (msg.t === 'DISPLAY_CLOCKS_STATE' && msg.clocks) setClocks(msg.clocks)
    if (msg.t === 'DISPLAY_INITIATIVE_STATE' && msg.initiative) setInitiative(msg.initiative)
  })

  function sendChat(text: string) {
    if (!config) return
    send({ t: 'chat:msg', room: config.room, nick: config.nick, text, ts: Date.now(), channel: 'global' })
  }

  return (
    <div className="min-h-screen flex flex-col gap-4">
      {/* TOPBAR */}
      <div className="border-b border-zinc-800 p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold">Archei Companion</div>
          <button className="btn !bg-zinc-800" onClick={openSetup}>WS</button>
          <Status connected={connected} connecting={connecting} error={error}/>
        </div>
        <div className="text-xs text-zinc-500">Player</div>
      </div>

      {/* Layout due colonne */}
      <div className="grid xl:grid-cols-[1.1fr_1fr] gap-4 flex-1 min-h-0">
        {/* Chat */}
        <div className="card flex flex-col max-h-[70vh]">
          <div className="font-semibold mb-2">Chat</div>
          <div className="flex-1 overflow-auto">
            {messages.length === 0 ? (
              <div className="text-sm text-zinc-500">Nessun messaggio.</div>
            ) : (
              <div className="space-y-2">
                {messages.map((m, i) => (
                  <div key={i} className="bg-zinc-900/50 rounded-xl px-3 py-2">
                    <span className="text-teal-400">{m.nick}:</span> {m.text}
                  </div>
                ))}
              </div>
            )}
          </div>
          <ChatInput onSend={sendChat} disabled={!connected}/>
        </div>

        {/* Pannelli readonly */}
        <div className="space-y-4 min-h-0">
          {/* Scena */}
          <div className="card space-y-2">
            <div className="font-semibold">Scena</div>
            {(!scene.title && !scene.text && !(scene.images?.length)) ? (
              <div className="text-sm text-zinc-500">In attesa di scena…</div>
            ) : (
              <>
                {scene.images?.[0] && (
                  <img src={scene.images[0]} alt="" className="w-full h-40 md:h-56 object-cover rounded-xl border border-zinc-800" />
                )}
                {scene.title && <div className="text-xl font-bold">{scene.title}</div>}
                {scene.text && <div className="whitespace-pre-wrap text-zinc-200">{scene.text}</div>}
              </>
            )}
          </div>

          {/* Countdown */}
          <div className="card space-y-2">
            <div className="font-semibold">Countdown</div>
            {countdown.length === 0
              ? <div className="text-sm text-zinc-500">Nessun countdown.</div>
              : countdown.map((c, i) => {
                  const pct = Math.max(0, Math.min(100, Math.round((c.value / (c.max || 1)) * 100)))
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-300">{c.label}</span>
                        <span className="text-zinc-400">{c.value}/{c.max}</span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
          </div>

          {/* Clocks */}
          <div className="card space-y-2">
            <div className="font-semibold">Clocks</div>
            {clocks.length === 0
              ? <div className="text-sm text-zinc-500">Nessun clock.</div>
              : clocks.map((c, i) => {
                  const pct = Math.max(0, Math.min(100, Math.round((c.value / (c.max || 1)) * 100)))
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-300">{c.name}</span>
                        <span className="text-zinc-400">{c.value}/{c.max}</span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
          </div>

          {/* Iniziativa */}
          <div className="card space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Iniziativa</div>
              {!initiative.visible && <span className="text-xs text-zinc-500">nascosta</span>}
            </div>
            {(initiative.visible && initiative.entries.length > 0) ? (
              <>
                <div className="text-xs text-zinc-400">Round {initiative.round}</div>
                <div className="flex flex-wrap gap-2">
                  {initiative.entries.map((e, i) => (
                    <div key={e.id || e.name} className={`px-3 py-1 rounded-xl border ${i === initiative.active ? 'border-teal-500 bg-teal-600/20' : 'border-zinc-700 bg-zinc-800/50'}`}>
                      <span className="font-semibold">{e.name}</span>
                      <span className="text-xs text-zinc-400 ml-2">({e.init})</span>
                      {i === initiative.active && <span className="ml-2 text-teal-400">● turno</span>}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-sm text-zinc-500">In attesa di iniziativa…</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Status({ connected, connecting, error }:{connected:boolean; connecting:boolean; error:string|null}) {
  const color = connecting ? 'bg-yellow-500' : connected ? 'bg-green-500' : error ? 'bg-red-500' : 'bg-zinc-600'
  const label = connecting ? 'conn…' : connected ? 'online' : (error ? 'errore' : 'offline')
  return <div className="flex items-center gap-2 text-xs text-zinc-400"><div className={`w-2.5 h-2.5 rounded-full ${color}`} />{label}</div>
}

function ChatInput({ onSend, disabled }: { onSend: (txt: string) => void; disabled?: boolean }) {
  const [txt, setTxt] = useState('')
  return (
    <div className="mt-3 flex gap-2">
      <input className="input" value={txt} disabled={disabled} onChange={e => setTxt(e.target.value)}
             onKeyDown={e => { if (e.key === 'Enter' && txt.trim() && !disabled) { onSend(txt); setTxt('') } }}
             placeholder={disabled ? 'Non connesso…' : 'Scrivi… (Invio per inviare)'} />
      <button className="btn" onClick={() => { if (txt.trim() && !disabled) { onSend(txt); setTxt('') } }} disabled={disabled}>Invia</button>
    </div>
  )
}
