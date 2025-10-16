'use client'
import { useEffect, useState } from 'react'

type Clock = { id:string, name:string, segments:number, fill:number, visible:boolean }

export default function GmClockPage(){
  useEffect(() => {
    const role = localStorage.getItem('archei:role')
    if (role !== 'gm') window.location.href = '/'
  }, [])

  const [wsUrl, setWsUrl] = useState(process.env.NEXT_PUBLIC_WS_DEFAULT || 'ws://localhost:8787')
  const [room, setRoom] = useState(process.env.NEXT_PUBLIC_ROOM_DEFAULT || 'demo')
  const [socket, setSocket] = useState<WebSocket|null>(null)
  const [clocks, setClocks] = useState<Clock[]>([])
  const [mirrorWS, setMirrorWS] = useState(true)

  function connect(){
    const ws = new WebSocket(wsUrl + `?room=${encodeURIComponent(room)}`)
    ws.onopen = ()=> setSocket(ws)
    ws.onclose = ()=> setSocket(null)
  }

  function sendDisplay(){
    const msg = { t:'DISPLAY_CLOCKS_STATE', room, clocks: clocks.filter(c=>c.visible) }
    const bc = new BroadcastChannel('archei-display'); bc.postMessage(msg); bc.close()
    if(mirrorWS && socket && socket.readyState===socket.OPEN) socket.send(JSON.stringify(msg))
  }

  function addClock(){
    const id = Math.random().toString(36).slice(2,10)
    setClocks(prev=>[...prev, { id, name:'Nuovo Clock', segments:6, fill:0, visible:true }])
  }
  function update(id:string, d:number){
    setClocks(prev=>prev.map(c=>c.id===id?{...c, fill: Math.max(0, Math.min(c.segments, c.fill+d))}:c))
  }
  useEffect(()=>{ sendDisplay() }, [clocks])

  return (
    <div className="space-y-4">
      <div className="card grid md:grid-cols-3 gap-3">
        <div><div className="label">WS URL</div><input className="input" value={wsUrl} onChange={e=>setWsUrl(e.target.value)} /></div>
        <div><div className="label">Room</div><input className="input" value={room} onChange={e=>setRoom(e.target.value)} /></div>
        <div className="flex items-end gap-2">
          <button className="btn" onClick={connect}>Conn WS</button>
          <label className="label flex items-center gap-2"><input type="checkbox" checked={mirrorWS} onChange={e=>setMirrorWS(e.target.checked)} /> Mirror WS</label>
          <button className="btn" onClick={sendDisplay}>Invia a Display</button>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Clock (GM)</h2>
        <button className="btn" onClick={addClock}>+ Aggiungi</button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {clocks.map(c=>(
          <div key={c.id} className="card">
            <div className="flex items-center justify-between mb-2">
              <input className="input" value={c.name} onChange={e=>setClocks(v=>v.map(x=>x.id===c.id?{...x,name:e.target.value}:x))} />
              <label className="label flex items-center gap-2">
                <input type="checkbox" checked={c.visible} onChange={e=>setClocks(v=>v.map(x=>x.id===c.id?{...x,visible:e.target.checked}:x))}/>Visibile
              </label>
            </div>
            <div className="label">Segmenti</div><input className="input" type="number" value={c.segments} onChange={e=>setClocks(v=>v.map(x=>x.id===c.id?{...x,segments:Math.max(1,parseInt(e.target.value||'1'))}:x))}/>
            <div className="mt-3 flex items-center gap-2">
              <button className="btn" onClick={()=>update(c.id,-1)}>-1</button>
              <button className="btn" onClick={()=>update(c.id,+1)}>+1</button>
              <button className="btn" onClick={()=>update(c.id,+2)}>+2</button>
              <button className="btn" onClick={()=>update(c.id,+3)}>+3</button>
            </div>
            <div className="mt-3 grid grid-cols-6 gap-1">
              {Array.from({length:c.segments}, (_,i)=>i<c.fill).map((on,i)=>(<div key={i} className={`h-2 rounded ${on?'bg-teal-500':'bg-zinc-800'}`} />))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
