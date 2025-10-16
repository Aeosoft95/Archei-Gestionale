'use client'
import { useEffect, useRef, useState } from 'react'

type Initiative = {
  entries: { id?: string; name: string; init: number }[]
  active: number
  round: number
  visible: boolean
}

type SceneMsg = any      // supporto flessibile: {title?, text?, image?/images?}
type CountdownMsg = any  // supporto flessibile: {label?, value?, max?} | {items:[...] }
type ClocksMsg = any     // supporto flessibile: {clocks:[{name,progress,max}]}

function wsDefault(): string {
  if (process.env.NEXT_PUBLIC_WS_DEFAULT) return process.env.NEXT_PUBLIC_WS_DEFAULT
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.hostname}:8787`
  }
  return 'ws://localhost:8787'
}

export default function DisplayPage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // --- Stato visualizzato ---
  const [initiative, setInitiative] = useState<Initiative>({ entries: [], active: 0, round: 1, visible: false })
  const [scene, setScene] = useState<SceneMsg | null>(null)
  const [countdown, setCountdown] = useState<CountdownMsg | null>(null)
  const [clocks, setClocks] = useState<ClocksMsg | null>(null)

  // --- Connessione WS ---
  const [wsUrl, setWsUrl] = useState(wsDefault)
  const [room, setRoom] = useState(process.env.NEXT_PUBLIC_ROOM_DEFAULT || 'demo')
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [panel, setPanel] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  // Autoconnect all’avvio
  useEffect(() => {
    if (!mounted) return
    connectWS()
    return () => { try { wsRef.current?.close() } catch {} }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted])

  function connectWS() {
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.close()
      setConnecting(true); setError(null)
      const ws = new WebSocket(wsUrl + `?room=${encodeURIComponent(room)}`)
      wsRef.current = ws
      ws.onopen = () => { setConnecting(false); setConnected(true) }
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)

          // Initiative
          if (msg.t === 'DISPLAY_INITIATIVE_STATE' && msg.initiative) {
            setInitiative(msg.initiative as Initiative)
          }

          // Scene
          if (msg.t === 'DISPLAY_SCENE_STATE') {
            setScene(msg)
          }

          // Countdown singolo/generico
          if (msg.t === 'DISPLAY_COUNTDOWN') {
            setCountdown(msg)
          }

          // Clocks multipli
          if (msg.t === 'DISPLAY_CLOCKS_STATE') {
            setClocks(msg)
          }
        } catch {}
      }
      ws.onclose = () => { setConnected(false); setConnecting(false) }
      ws.onerror = () => { setError(`Connessione fallita a ${wsUrl}.`) }
    } catch (e: any) {
      setConnecting(false); setConnected(false); setError(e?.message || 'Errore di connessione.')
    }
  }
  function disconnectWS() { try { wsRef.current?.close() } catch {}; setConnected(false) }

  if (!mounted) return null

  // --- Helpers di rendering tolleranti ---
  const sceneTitle = scene?.title ?? scene?.name ?? scene?.scene?.title ?? ''
  const sceneText  = scene?.text ?? scene?.description ?? scene?.scene?.text ?? ''
  const sceneImage = scene?.image ?? scene?.img ?? (Array.isArray(scene?.images) ? scene.images[0] : undefined)
  const sceneImages: string[] = Array.isArray(scene?.images) ? scene!.images : (sceneImage ? [sceneImage] : [])

  // Countdown generico -> array normalizzato
  const countdownItems = (() => {
    if (!countdown) return []
    if (Array.isArray(countdown.items)) return countdown.items
    // supporta forma semplice {label, value, max}
    if (countdown.label || countdown.value != null) return [countdown]
    return []
  })()

  // Clocks multipli -> array normalizzato
  const clocksItems = (() => {
    if (!clocks) return []
    if (Array.isArray(clocks.clocks)) return clocks.clocks
    if (Array.isArray(clocks.items)) return clocks.items
    return []
  })()

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* PANNELLO WS */}
      <div className="fixed top-3 right-3 z-50 flex items-center gap-2">
        <button className="btn !bg-zinc-800" onClick={() => setPanel(p => !p)}>WS</button>
        <StatusDot connected={connected} connecting={connecting} />
      </div>

      {panel && (
        <div className="fixed top-14 right-3 z-50 w-80 bg-zinc-900/95 backdrop-blur border border-zinc-700 rounded-2xl p-3 space-y-2">
          <div className="label">WS URL</div>
          <input className="input" value={wsUrl} onChange={e => setWsUrl(e.target.value)} placeholder="ws://host:8787" />
          <div className="label">Room</div>
          <input className="input" value={room} onChange={e => setRoom(e.target.value)} />
          <div className="flex gap-2">
            {!connected ? (
              <button className="btn" onClick={connectWS} disabled={connecting}>Connettiti</button>
            ) : (
              <button className="btn !bg-zinc-800" onClick={disconnectWS}>Disconnetti</button>
            )}
          </div>
          {error && <div className="text-xs text-red-400">{error}</div>}
        </div>
      )}

      {/* SCENE (area principale) */}
      <section className="absolute inset-0">
        {/* immagine di scena full-bleed (prima disponibile) */}
        {sceneImages[0] && (
          <img
            src={sceneImages[0]}
            alt="scene"
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
        )}
        <div className="relative z-10 h-full p-6 md:p-10">
          {(sceneTitle || sceneText) ? (
            <div className="max-w-4xl">
              {sceneTitle && <h1 className="text-3xl md:text-5xl font-bold mb-4">{sceneTitle}</h1>}
              {sceneText && <p className="text-lg md:text-2xl text-zinc-200 leading-relaxed whitespace-pre-wrap">{sceneText}</p>}
            </div>
          ) : (
            <div className="h-full grid place-items-center">
              <div className="text-sm text-zinc-400 text-center px-4">
                In attesa di **Scene** dal GM…<br />
                Appena il GM invia <b>DISPLAY_SCENE_STATE</b> vedrai titolo/testo/immagini.
              </div>
            </div>
          )}
        </div>
      </section>

      {/* IMMAGINI ADDIZIONALI DELLA SCENA (miniature) */}
      {sceneImages.length > 1 && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-28 z-10 flex gap-2">
          {sceneImages.slice(1).map((src, i) => (
            <img key={i} src={src} alt="" className="w-24 h-16 object-cover rounded-lg border border-zinc-700" />
          ))}
        </div>
      )}

      {/* CLOCK / COUNTDOWN (angolo in alto a sinistra) */}
      {(countdownItems.length > 0 || clocksItems.length > 0) && (
        <aside className="fixed top-3 left-3 z-40 space-y-3">
          {/* Countdown (lista o singolo) */}
          {countdownItems.length > 0 && (
            <div className="bg-zinc-900/80 backdrop-blur border border-zinc-700 rounded-2xl p-3 w-[320px]">
              <div className="text-xs text-zinc-400 mb-2">Countdown</div>
              <div className="space-y-2">
                {countdownItems.map((c: any, i: number) => {
                  const label = c.label || c.name || `Timer ${i + 1}`
                  const value = Number(c.value ?? c.current ?? 0)
                  const max = Number(c.max ?? c.total ?? 100)
                  const pct = Math.max(0, Math.min(100, Math.round((value / (max || 1)) * 100)))
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-300">{label}</span>
                        <span className="text-zinc-400">{value}/{max}</span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Clocks multipli */}
          {clocksItems.length > 0 && (
            <div className="bg-zinc-900/80 backdrop-blur border border-zinc-700 rounded-2xl p-3 w-[320px]">
              <div className="text-xs text-zinc-400 mb-2">Clocks</div>
              <div className="space-y-2">
                {clocksItems.map((ck: any, i: number) => {
                  const name = ck.name || ck.label || `Clock ${i + 1}`
                  const value = Number(ck.value ?? ck.progress ?? 0)
                  const max = Number(ck.max ?? ck.total ?? 4)
                  const pct = Math.max(0, Math.min(100, Math.round((value / (max || 1)) * 100)))
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-300">{name}</span>
                        <span className="text-zinc-400">{value}/{max}</span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </aside>
      )}

      {/* INIZIATIVA (barra in basso) */}
      {initiative.visible && initiative.entries.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-zinc-900/80 backdrop-blur rounded-2xl border border-zinc-700 px-4 py-2 shadow-2xl z-40">
          <div className="text-center text-xs text-zinc-400 mb-1">Round {initiative.round}</div>
          <div className="flex gap-2">
            {initiative.entries.map((e, i) => (
              <div
                key={e.id || e.name}
                className={`px-3 py-1 rounded-xl border ${i === initiative.active ? 'border-teal-500 bg-teal-600/20' : 'border-zinc-700 bg-zinc-800/50'}`}
              >
                <span className="font-semibold">{e.name}</span>
                <span className="text-xs text-zinc-400 ml-2">({e.init})</span>
                {i === initiative.active && <span className="ml-2 text-teal-400">● turno</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messaggio quando non c'è nulla */}
      {!sceneTitle && !sceneText && sceneImages.length === 0 && countdownItems.length === 0 && clocksItems.length === 0 && (!initiative.visible || initiative.entries.length === 0) && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-sm text-zinc-400 text-center px-4">
            In attesa di dati dal GM…<br />
            Scene, Countdown/Clocks e Iniziativa appariranno qui quando inviati.
          </div>
        </div>
      )}
    </main>
  )
}

function StatusDot({ connected, connecting }: { connected: boolean; connecting: boolean }) {
  const color = connecting ? 'bg-yellow-500' : connected ? 'bg-green-500' : 'bg-zinc-600'
  const label = connecting ? 'conn…' : connected ? 'online' : 'offline'
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-300">
      <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
      {label}
    </div>
  )
}
