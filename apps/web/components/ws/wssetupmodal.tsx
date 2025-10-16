'use client'
import { useEffect, useState } from 'react'
import { useWS } from './WSProvider'

export default function WSSetupModal() {
  const { config, setConfig, connect, connected, connecting, error, setupOpen, closeSetup } = useWS()
  const [wsUrl, setWsUrl] = useState(config?.wsUrl || '')
  const [room, setRoom] = useState(config?.room || 'demo')
  const [nick, setNick] = useState(config?.nick || 'Player')

  useEffect(() => {
    setWsUrl(config?.wsUrl || '')
    setRoom(config?.room || 'demo')
    setNick(config?.nick || 'Player')
  }, [config])

  if (!setupOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
        <div className="text-lg font-semibold">Configura WebSocket</div>
        <div>
          <div className="label">WS URL</div>
          <input className="input" value={wsUrl} onChange={e => setWsUrl(e.target.value)} placeholder="ws://host:8787" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="label">Room</div>
            <input className="input" value={room} onChange={e => setRoom(e.target.value)} />
          </div>
          <div>
            <div className="label">Nick</div>
            <input className="input" value={nick} onChange={e => setNick(e.target.value)} />
          </div>
        </div>
        {error && <div className="text-xs text-red-400">{error}</div>}
        <div className="flex gap-2">
          <button
            className="btn"
            disabled={!wsUrl.trim() || !room.trim() || !nick.trim() || connecting}
            onClick={() => {
              setConfig({ wsUrl: wsUrl.trim(), room: room.trim(), nick: nick.trim() })
              connect()
              // chiudo solo quando sono connesso
            }}
          >
            {connecting ? 'Connessione…' : (connected ? 'Connesso' : 'Connetti')}
          </button>
          <button className="btn !bg-zinc-800" onClick={closeSetup} disabled={!connected}>Chiudi</button>
        </div>
        <div className="text-xs text-zinc-500">Il profilo viene salvato e riusato automaticamente in tutto il sito.</div>
      </div>
    </div>
  )
}
