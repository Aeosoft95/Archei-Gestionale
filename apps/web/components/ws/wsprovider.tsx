'use client'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

type WSConfig = { wsUrl: string; room: string; nick: string }
type WSState = {
  config: WSConfig | null
  connected: boolean
  connecting: boolean
  error: string | null
  // azioni
  setConfig: (c: WSConfig) => void
  connect: () => void
  disconnect: () => void
  send: (obj: any) => void
  // modal
  openSetup: () => void
  closeSetup: () => void
  setupOpen: boolean
}

const LS_KEY = 'archei:ws:config'
const WSContext = createContext<WSState | null>(null)

function wsDefault(): string {
  if (typeof window !== 'undefined') {
    const env = (window as any).ENV_WS_DEFAULT as string | undefined
    if (env) return env
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.hostname}:8787`
  }
  return 'ws://localhost:8787'
}

export function WSProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<WebSocket | null>(null)
  const [config, setConfigState] = useState<WSConfig | null>(null)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)

  // Restore config
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) {
        const c = JSON.parse(raw) as WSConfig
        setConfigState(c)
      } else {
        // prima volta → apri setup
        setSetupOpen(true)
        setConfigState({ wsUrl: wsDefault(), room: 'demo', nick: 'Player' })
      }
    } catch {
      setSetupOpen(true)
      setConfigState({ wsUrl: wsDefault(), room: 'demo', nick: 'Player' })
    }
  }, [])

  // Connetti se c'è una config
  const connect = useCallback(() => {
    const c = config
    if (!c) return
    try {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) return
      if (connecting) return
      setConnecting(true)
      setError(null)
      const ws = new WebSocket(`${c.wsUrl}?room=${encodeURIComponent(c.room)}`)
      socketRef.current = ws

      ws.onopen = () => {
        setConnecting(false)
        setConnected(true)
        // annuncia join
        try {
          ws.send(JSON.stringify({ t: 'join', room: c.room, nick: c.nick, role: (localStorage.getItem('archei:role') || 'player') }))
          ws.send(JSON.stringify({ t: 'chat:join', room: c.room, nick: c.nick }))
        } catch {}
      }
      ws.onmessage = (ev) => {
        // rilancia come CustomEvent globale
        try {
          const data = JSON.parse(ev.data)
          window.dispatchEvent(new CustomEvent('archei:ws:message', { detail: data }))
        } catch {}
      }
      ws.onclose = () => {
        setConnected(false)
        setConnecting(false)
      }
      ws.onerror = () => {
        setError(`Connessione fallita a ${c.wsUrl}.`)
      }
    } catch (e: any) {
      setConnecting(false); setConnected(false); setError(e?.message || 'Errore WS')
    }
  }, [config, connecting])

  const disconnect = useCallback(() => {
    try { socketRef.current?.close() } catch {}
    setConnected(false)
  }, [])

  const send = useCallback((obj: any) => {
    const ws = socketRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj))
    }
  }, [])

  const setConfig = useCallback((c: WSConfig) => {
    setConfigState(c)
    localStorage.setItem(LS_KEY, JSON.stringify(c))
  }, [])

  // autoconnect quando cambia config
  useEffect(() => {
    if (!config) return
    connect()
  }, [config, connect])

  // API modal
  const openSetup = useCallback(() => setSetupOpen(true), [])
  const closeSetup = useCallback(() => setSetupOpen(false), [])

  const value: WSState = useMemo(() => ({
    config, connected, connecting, error,
    setConfig, connect, disconnect, send,
    openSetup, closeSetup, setupOpen
  }), [config, connected, connecting, error, setConfig, connect, disconnect, send, openSetup, closeSetup, setupOpen])

  return (
    <WSContext.Provider value={value}>
      {children}
    </WSContext.Provider>
  )
}

export function useWS() {
  const ctx = useContext(WSContext)
  if (!ctx) throw new Error('useWS must be used within WSProvider')
  return ctx
}

/** Hook helper: ascolta i messaggi WS globali */
export function useWSMessages(onMessage: (msg: any) => void) {
  useEffect(() => {
    function handler(e: Event) {
      const ce = e as CustomEvent
      onMessage(ce.detail)
    }
    window.addEventListener('archei:ws:message', handler as any)
    return () => window.removeEventListener('archei:ws:message', handler as any)
  }, [onMessage])
}
