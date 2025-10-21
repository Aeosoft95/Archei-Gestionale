// apps/web/components/MapBoard.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useWS, useWSMessages } from '@/components/ws/WSProvider'

type Role = 'gm' | 'player'
type Point = { x:number; y:number }
type Stroke = { id:string; color:string; size:number; points:Point[]; erase?:boolean }
type MapState = { strokes: Stroke[]; grid:{ cols:number; rows:number; size:number } }

const uid = () => Math.random().toString(36).slice(2,9)
const DEFAULT_GRID = { cols: 100, rows: 100, size: 32 }

export default function MapBoard({
  roomId,
  role,
  embedHeight,               // se passato: altezza fissa per l’embed (es. 280)
}: {
  roomId: string
  role: Role
  embedHeight?: number
}) {
  const { send, connected } = useWS()

  const canvasRef = useRef<HTMLCanvasElement|null>(null)
  const wrapRef = useRef<HTMLDivElement|null>(null)
  const [map, setMap] = useState<MapState>({ strokes:[], grid: DEFAULT_GRID })

  // tool
  const [tool, setTool] = useState<'pen'|'erase'>('pen')
  const [color, setColor] = useState('#ffffff')
  const [size, setSize] = useState(3)

  // camera
  const [cam, setCam] = useState({ x:0, y:0, zoom:1 })
  const dragging = useRef(false)
  const lastPos = useRef<{x:number;y:number}|null>(null)

  // drawing
  const drawing = useRef<Stroke|null>(null)

  // === WS: ricezione
  useWSMessages((msg)=>{
    if (!msg || msg.room !== roomId) return
    if (msg.t === 'MAP:STATE' && msg.state) {
      setMap(msg.state as MapState)
      return
    }
    if (msg.t === 'MAP:PATCH' && Array.isArray(msg.add)) {
      setMap(m => ({ ...m, strokes: [...m.strokes, ...(msg.add as Stroke[])] }))
      return
    }
    if (msg.t === 'MAP:CLEAR') {
      setMap(m => ({ ...m, strokes: [] }))
      return
    }
  })

  // === disegno canvas
  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const ctx = cvs.getContext('2d')
    if (!ctx) return

    const DPR = window.devicePixelRatio || 1
    const wrap = wrapRef.current
    // embed: larghezza contenitore, altezza fissa se fornita
    const w = wrap?.clientWidth || 800
    const h = embedHeight ? embedHeight : (wrap?.clientHeight || 600)

    // reset canvas
    cvs.width = Math.floor(w * DPR)
    cvs.height = Math.floor(h * DPR)
    cvs.style.width = `${w}px`
    cvs.style.height = `${h}px`
    ctx.setTransform(1,0,0,1,0,0)  // reset
    ctx.scale(DPR, DPR)

    // bg
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0,0,w,h)

    // world
    ctx.save()
    ctx.translate(cam.x, cam.y)
    ctx.scale(cam.zoom, cam.zoom)

    // grid
    const { size:cell, cols, rows } = map.grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i=0;i<=cols;i++){
      const x = i*cell
      ctx.moveTo(x,0); ctx.lineTo(x, rows*cell)
    }
    for (let j=0;j<=rows;j++){
      const y = j*cell
      ctx.moveTo(0,y); ctx.lineTo(cols*cell, y)
    }
    ctx.stroke()

    // strokes
    for (const s of map.strokes) {
      ctx.strokeStyle = s.erase ? '#0a0a0a' : s.color
      ctx.lineWidth = s.size
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      s.points.forEach((p, idx)=>{
        if (idx===0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      })
      ctx.stroke()
    }

    ctx.restore()
  }, [map, cam, embedHeight])

  // helpers coordinate
  function toWorld(e: React.MouseEvent) {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
    const x = (e.clientX - rect.left - cam.x) / cam.zoom
    const y = (e.clientY - rect.top - cam.y) / cam.zoom
    return { x, y }
  }

  // input
  function onCanvasDown(e: React.MouseEvent) {
    if (e.button === 1 || (e.button===0 && e.altKey)) {
      dragging.current = true
      lastPos.current = { x: e.clientX, y:e.clientY }
      return
    }
    if (role !== 'gm') return
    if (e.button !== 0) return
    const p = toWorld(e)
    const st: Stroke = { id: uid(), color, size, points:[p], erase: (tool==='erase') }
    drawing.current = st
    setMap(m => ({ ...m, strokes: [...m.strokes, st] }))
  }
  function onCanvasMove(e: React.MouseEvent) {
    if (dragging.current && lastPos.current) {
      const dx = e.clientX - lastPos.current.x
      const dy = e.clientY - lastPos.current.y
      setCam(c => ({ ...c, x: c.x + dx, y: c.y + dy }))
      lastPos.current = { x:e.clientX, y:e.clientY }
      return
    }
    if (!drawing.current) return
    const p = toWorld(e)
    drawing.current.points.push(p)
    setMap(m => ({ ...m })) // trigger repaint
  }
  function onCanvasUp() {
    if (dragging.current) {
      dragging.current = false
      lastPos.current = null
      return
    }
    if (!drawing.current) return
    if (connected) {
      send({ t:'MAP:PATCH', room: roomId, add: [drawing.current], ts: Date.now() })
    }
    drawing.current = null
  }
  function onWheel(e: React.WheelEvent) {
    const delta = -e.deltaY
    const factor = delta > 0 ? 1.1 : 0.9
    setCam(c => ({ ...c, zoom: Math.max(0.2, Math.min(4, c.zoom*factor)) }))
  }

  // azioni
  function clearBoard() {
    if (role !== 'gm') return
    setMap(m => ({ ...m, strokes: [] }))
    if (connected) send({ t:'MAP:CLEAR', room: roomId, ts: Date.now() })
  }
  function centerBoard() {
    setCam({ x:0, y:0, zoom:1 })
  }
  function sendFullState() {
    if (role !== 'gm' || !connected) return
    send({ t:'MAP:STATE', room: roomId, state: map, ts: Date.now() })
  }

  // rispondi ai player che chiedono sync
  useWSMessages((msg)=>{
    if (msg.t === 'MAP:REQ_STATE' && msg.room === roomId && role === 'gm') {
      send({ t:'MAP:STATE', room: roomId, state: map, ts: Date.now() })
    }
  })

  const canDraw = role==='gm'
  const status = useMemo(()=> canDraw ? 'GM — puoi disegnare' : 'PLAYER — sola visualizzazione', [canDraw])

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar compatta */}
      <div className="flex items-center gap-2 text-xs text-zinc-400 mb-2">
        <span>{status}</span>
        <div className="ml-auto flex items-center gap-2">
          <button className={`btn ${canDraw && tool==='pen' ? '' : '!bg-zinc-800'}`} disabled={!canDraw} onClick={()=>setTool('pen')}>✏️</button>
          <button className={`btn ${canDraw && tool==='erase' ? '' : '!bg-zinc-800'}`} disabled={!canDraw} onClick={()=>setTool('erase')}>🧽</button>
          <input type="color" value={color} onChange={e=>setColor(e.target.value)} disabled={!canDraw} className="h-8 w-8 rounded border border-zinc-700 bg-zinc-900"/>
          <input type="range" min={1} max={20} value={size} onChange={e=>setSize(parseInt(e.target.value||'3'))} disabled={!canDraw}/>
          <button className="btn !bg-zinc-800" onClick={centerBoard}>Centra</button>
          <button className="btn !bg-zinc-800" onClick={sendFullState}>Sync</button>
          <button className="btn !bg-red-600 text-white" disabled={!canDraw} onClick={clearBoard}>Pulisci</button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={wrapRef} className="bg-black/60 rounded-xl border border-zinc-800 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair block"
          style={embedHeight ? { height: embedHeight } : undefined}
          onMouseDown={onCanvasDown}
          onMouseMove={onCanvasMove}
          onMouseUp={onCanvasUp}
          onMouseLeave={onCanvasUp}
          onWheel={onWheel}
        />
      </div>
    </div>
  )
}
