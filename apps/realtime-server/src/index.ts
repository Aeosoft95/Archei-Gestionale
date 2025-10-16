import http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import fs from 'fs'
import path from 'path'

type Ctx = { room: string; nick: string; role: 'gm'|'player' }

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' })
  res.end('ARCHEI realtime WS OK')
})

const wss = new WebSocketServer({ server })
const clients = new Map<WebSocket, Ctx>()

// === Stato persistente per stanza ===
type PersistState = {
  sceneByRoom: Record<string, any>
  countdownByRoom: Record<string, any>
  clocksByRoom: Record<string, any>
  initiativeByRoom: Record<string, any>
}
const state: PersistState = { sceneByRoom: {}, countdownByRoom: {}, clocksByRoom: {}, initiativeByRoom: {} }

// === Persistenza su disco ===
const DATA_DIR = path.resolve(process.cwd(), 'data')
const BACKUP_FILE = path.join(DATA_DIR, 'backup.json')
let dirty = false
function ensureDataDir(){ try{ fs.mkdirSync(DATA_DIR,{recursive:true}) }catch{} }
function saveNow(){
  try{ ensureDataDir(); fs.writeFileSync(BACKUP_FILE, JSON.stringify(state,null,2),'utf-8'); dirty=false; console.log('[WS] backup saved', BACKUP_FILE) }catch(e){ console.error('[WS] backup save error', e) }
}
function scheduleSave(){ dirty = true }
function loadBackup(){
  try{
    if(fs.existsSync(BACKUP_FILE)){
      const json = JSON.parse(fs.readFileSync(BACKUP_FILE,'utf-8')) as PersistState
      state.sceneByRoom = json.sceneByRoom || {}
      state.countdownByRoom = json.countdownByRoom || {}
      state.clocksByRoom = json.clocksByRoom || {}
      state.initiativeByRoom = json.initiativeByRoom || {}
      console.log('[WS] backup loaded', BACKUP_FILE)
    }
  }catch(e){ console.error('[WS] backup load error', e) }
}
setInterval(()=>{ if(dirty) saveNow() }, 5000)
process.on('SIGINT', ()=>{ if(dirty) saveNow(); process.exit(0) })
process.on('SIGTERM', ()=>{ if(dirty) saveNow(); process.exit(0) })

function broadcast(room: string, data: any) {
  const payload = JSON.stringify(data)
  for (const [ws, ctx] of clients)
    if (ctx.room === room && ws.readyState === ws.OPEN) ws.send(payload)
}

function presence(room: string) {
  const nicks = [...clients.values()].filter(c => c.room === room).map(c => c.nick)
  broadcast(room, { t: 'chat:presence', room, nicks })
}

wss.on('connection', (ws, req) => {
  const ip = (req.socket.remoteAddress || '').replace('::ffff:', '')
  console.log('[WS] conn', ip)
  const url = new URL(req.url || '', `http://${req.headers.host}`)
  const roomDefault = url.searchParams.get('room') || 'demo'
  clients.set(ws, { room: roomDefault, nick: 'anon', role: 'player' })

  // stato iniziale appena connesso
  const sc = state.sceneByRoom[roomDefault]; if (sc) ws.send(JSON.stringify(sc))
  const cd = state.countdownByRoom[roomDefault]; if (cd) ws.send(JSON.stringify(cd))
  const ck = state.clocksByRoom[roomDefault]; if (ck) ws.send(JSON.stringify(ck))
  const it = state.initiativeByRoom[roomDefault]; if (it) ws.send(JSON.stringify(it))

  ws.on('message', (buf) => {
    let msg: any
    try { msg = JSON.parse(buf.toString()) } catch { return }
    const ctx = clients.get(ws); if (!ctx) return

    if (msg.t === 'join') {
      ctx.room = msg.room || roomDefault
      ctx.nick = msg.nick || 'anon'
      ctx.role = msg.role || 'player'
      ws.send(JSON.stringify({ t: 'joined', room: ctx.room, nick: ctx.nick, role: ctx.role }))
      presence(ctx.room)
      const sc2 = state.sceneByRoom[ctx.room]; if (sc2) ws.send(JSON.stringify(sc2))
      const cd2 = state.countdownByRoom[ctx.room]; if (cd2) ws.send(JSON.stringify(cd2))
      const ck2 = state.clocksByRoom[ctx.room]; if (ck2) ws.send(JSON.stringify(ck2))
      const it2 = state.initiativeByRoom[ctx.room]; if (it2) ws.send(JSON.stringify(it2))
      return
    }

    const r = msg.room || ctx.room
    if (typeof msg.t === 'string') {
      if (msg.t.startsWith('DISPLAY_')) {
        if (msg.t === 'DISPLAY_SCENE_STATE') state.sceneByRoom[r] = msg
        if (msg.t === 'DISPLAY_COUNTDOWN') state.countdownByRoom[r] = msg
        if (msg.t === 'DISPLAY_CLOCKS_STATE') state.clocksByRoom[r] = msg
        if (msg.t === 'DISPLAY_INITIATIVE_STATE') state.initiativeByRoom[r] = msg
        scheduleSave()
        broadcast(r, msg); return
      }
      if (msg.t.startsWith('chat:')) {
        if (msg.t === 'chat:msg') msg.ts = msg.ts || Date.now()
        broadcast(r, msg); return
      }
    }
  })

  ws.on('close', () => { const ctx = clients.get(ws); clients.delete(ws); if (ctx) presence(ctx.room) })
})

const PORT = Number(process.env.PORT || 8787)
loadBackup()
server.listen(PORT, '0.0.0.0', () => console.log(`[WS] listening on 0.0.0.0:${PORT}`))
