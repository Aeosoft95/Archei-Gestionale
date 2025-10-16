'use client'
import { useEffect, useState } from 'react'

export default function GmScenePage(){
  useEffect(() => {
    const role = localStorage.getItem('archei:role')
    if (role !== 'gm') window.location.href = '/'
  }, [])

  const [wsUrl, setWsUrl] = useState(process.env.NEXT_PUBLIC_WS_DEFAULT || 'ws://localhost:8787')
  const [room, setRoom] = useState(process.env.NEXT_PUBLIC_ROOM_DEFAULT || 'demo')
  const [socket, setSocket] = useState<WebSocket|null>(null)

  const [title, setTitle] = useState('Scena di prova')
  const [color, setColor] = useState('#0b132b')
  const [image, setImage] = useState('')
  const [visible, setVisible] = useState(true)

  const [running,setRunning] = useState(false)
  const [total,setTotal] = useState(30)
  const [label,setLabel] = useState('Countdown')

  function conn(){
    const ws = new WebSocket(wsUrl + `?room=${encodeURIComponent(room)}`)
    ws.onopen = ()=> setSocket(ws)
    ws.onclose = ()=> setSocket(null)
  }
  function send(obj:any){
    if(socket && socket.readyState===socket.OPEN) socket.send(JSON.stringify(obj))
    const bc = new BroadcastChannel('archei-display'); bc.postMessage(obj); bc.close()
  }
  function sendScene(){ send({ t:'DISPLAY_SCENE_STATE', room, scene:{ title, color, image, visible } }) }
  function banner(text:string){ send({ t:'DISPLAY_BANNER', room, text }) }
  function toggleCountdown(){
    const run = !running; setRunning(run)
    send({ t:'DISPLAY_COUNTDOWN', room, countdown:{ running: run, totalMs: total*1000, remainMs: total*1000, label } })
  }

  useEffect(()=>{ sendScene() }, [title,color,image,visible])

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="card space-y-3">
        <div className="label">WS URL</div>
        <input className="input" value={wsUrl} onChange={e=>setWsUrl(e.target.value)} />
        <div className="label">Room</div>
        <input className="input" value={room} onChange={e=>setRoom(e.target.value)} />
        <button className="btn" onClick={conn}>Conn WS</button>

        <div className="border-t border-zinc-800 pt-3 space-y-2">
          <div className="label">Titolo</div>
          <input className="input" value={title} onChange={e=>setTitle(e.target.value)} />
          <div className="label">Colore</div>
          <input className="input" value={color} onChange={e=>setColor(e.target.value)} />
          <div className="label">Immagine (URL)</div>
          <input className="input" value={image} onChange={e=>setImage(e.target.value)} />
          <label className="label flex items-center gap-2"><input type="checkbox" checked={visible} onChange={e=>setVisible(e.target.checked)}/>Visibile</label>
          <button className="btn" onClick={sendScene}>Invia al Display</button>
          <button className="btn" onClick={()=>banner('Benvenuti!')}>Mostra Banner</button>
        </div>

        <div className="border-t border-zinc-800 pt-3 space-y-2">
          <div className="label">Countdown</div>
          <div className="grid grid-cols-3 gap-2">
            <input className="input" value={label} onChange={e=>setLabel(e.target.value)} />
            <input className="input" type="number" value={total} onChange={e=>setTotal(parseInt(e.target.value||'0'))} />
            <button className="btn" onClick={toggleCountdown}>{running?'Stop':'Start'}</button>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="text-sm text-zinc-400 mb-2">Anteprima</div>
        <div className="rounded-2xl overflow-hidden h-64 relative" style={{background:image?`url(${image}) center/cover` : (color as any)}}>
          <div className="absolute inset-0 bg-black/30 flex items-end p-4">
            <div className="text-2xl font-semibold">{title}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
