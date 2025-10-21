import http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import fs from 'fs'
import path from 'path'

type Role = 'gm'|'player'
type Ctx = { room: string; nick: string; role: Role; lastPongAt: number }

// ───────────────────────────────────────────────────────────────────────────────
// HTTP server “di cortesia” (healthcheck)
const server = http.createServer((_req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': '*',
  })
  res.end('ARCHEI realtime WS OK')
})

const wss = new WebSocketServer({ server })
const clients = new Map<WebSocket, Ctx>()

// ───────────────────────────────────────────────────────────────────────────────
// Stato persistente per stanza
type PersistState = {
  sceneByRoom: Record<string, any>
  countdownByRoom: Record<string, any>
  clocksByRoom: Record<string, any>
  initiativeByRoom: Record<string, any>
}
const state: PersistState = {
  sceneByRoom: {},
  countdownByRoom: {},
  clocksByRoom: {},
  initiativeByRoom: {}
}

// ───────────────────────────────────────────────────────────────────────────────
// Persistenza su disco
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), 'data')
const BACKUP_FILE = path.join(DATA_DIR, 'backup.json')
const BACKUP_PREV = path.join(DATA_DIR, 'backup.prev.json')

function ensureDataDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }) } catch {}
}

let dirty = false
let saveTimer: NodeJS.Timeout | null = null
function scheduleSave() {
  dirty = true
  if (saveTimer) clearTimeout(saveTimer)
  // debounce 2s: salva al massimo ogni 2 secondi
  saveTimer = setTimeout(saveNow, 2000)
}

function saveNow() {
  if (!dirty) return
  try {
    ensureDataDir()
    // rotazione semplice
    if (fs.existsSync(BACKUP_FILE)) {
      try { fs.copyFileSync(BACKUP_FILE, BACKUP_PREV) } catch {}
    }
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(state, null, 2), 'utf-8')
    dirty = false
    // console.log('[WS] backup saved', BACKUP_FILE)
  } catch (e) {
    console.error('[WS] backup save error', e)
  }
}

function loadBackup() {
  try {
    if (!fs.existsSync(BACKUP_FILE)) return
    const json = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf-8')) as PersistState
    state.sceneByRoom = json.sceneByRoom || {}
    state.countdownByRoom = json.countdownByRoom || {}
    state.clocksByRoom = json.clocksByRoom || {}
    state.initiativeByRoom = json.initiativeByRoom || {}
    console.log('[WS] backup loaded from', BACKUP_FILE)
  } catch (e) {
    console.error('[WS] backup load error', e)
  }
}

// Flush periodico e su segnali
setInterval(() => saveNow(), 5000)
process.on('SIGINT', () => { try { saveNow() } finally { process.exit(0) } })
process.on('SIGTERM', () => { try { saveNow() } finally { process.exit(0) } })

// ───────────────────────────────────────────────────────────────────────────────
// Utils
function broadcast(room: string, data: any) {
  const payload = JSON.stringify(data)
  for (const [ws, ctx] of clients) {
    if (ctx.room === room && ws.readyState === WebSocket.OPEN) {
      ws.send(payload)
    }
  }
}

function presence(room: string) {
  const nicks = [...clients.values()]
    .filter(c => c.room === room)
    .map(c => c.nick)
  broadcast(room, { t: 'chat:presence', room, nicks })
}

function sendRoomSnapshot(ws: WebSocket, room: string) {
  const sc = state.sceneByRoom[room];        if (sc) ws.send(JSON.stringify(sc))
  const cd = state.countdownByRoom[room];    if (cd) ws.send(JSON.stringify(cd))
  const ck = state.clocksByRoom[room];       if (ck) ws.send(JSON.stringify(ck))
  const it = state.initiativeByRoom[room];   if (it) ws.send(JSON.stringify(it))
}

// Heartbeat per rimuovere connessioni morte
const HEARTBEAT_MS = 30_000
setInterval(() => {
  const now = Date.now()
  for (const [ws, ctx] of clients) {
    if (ws.readyState !== WebSocket.OPEN) continue
    if (now - ctx.lastPongAt > HEARTBEAT_MS * 2) {
      try { ws.terminate() } catch {}
      clients.delete(ws)
      presence(ctx.room)
    } else {
      try { ws.ping() } catch {}
    }
  }
}, HEARTBEAT_MS)

// ───────────────────────────────────────────────────────────────────────────────
// Connessioni
wss.on('connection', (ws, req) => {
  const ip = (req.socket.remoteAddress || '').replace('::ffff:', '')
  const url = new URL(req.url || '', `http://${req.headers.host}`)
  const roomDefault = url.searchParams.get('room') || 'demo'

  const ctx: Ctx = {
    room: roomDefault,
    nick: 'anon',
    role: 'player',
    lastPongAt: Date.now(),
  }
  clients.set(ws, ctx)

  // primo snapshot
  sendRoomSnapshot(ws, roomDefault)
  presence(roomDefault)

  ws.on('pong', () => { ctx.lastPongAt = Date.now() })

  ws.on('message', (buf) => {
    // micro protezione per payload enormi
    if (buf.length > 256 * 1024) return // 256KB max
    let msg: any
    try { msg = JSON.parse(buf.toString()) } catch { return }

    const r = (msg.room || ctx.room) as string

    // handshake “join”
    if (msg.t === 'join') {
      ctx.room = typeof msg.room === 'string' && msg.room ? msg.room : roomDefault
      ctx.nick = typeof msg.nick === 'string' && msg.nick ? msg.nick : 'anon'
      ctx.role = (msg.role === 'gm') ? 'gm' : 'player'
      ws.send(JSON.stringify({ t: 'joined', room: ctx.room, nick: ctx.nick, role: ctx.role }))
      sendRoomSnapshot(ws, ctx.room)
      presence(ctx.room)
      return
    }

    // canali di display (solo GM)
    if (typeof msg.t === 'string' && msg.t.startsWith('DISPLAY_')) {
      if (ctx.role !== 'gm') return
      switch (msg.t) {
        case 'DISPLAY_SCENE_STATE':      state.sceneByRoom[r] = msg; break
        case 'DISPLAY_COUNTDOWN':        state.countdownByRoom[r] = msg; break
        case 'DISPLAY_CLOCKS_STATE':     state.clocksByRoom[r] = msg; break
        case 'DISPLAY_INITIATIVE_STATE': state.initiativeByRoom[r] = msg; break
        default: break
      }
      scheduleSave()
      broadcast(r, msg)
      return
    }

    // chat & legacy
    if (typeof msg.t === 'string' && msg.t.startsWith('chat:')) {
      if (msg.t === 'chat:msg') {
        msg.ts = msg.ts || Date.now()
        // normalizziamo mittente lato server
        msg.nick = ctx.nick || msg.nick || 'anon'
        msg.room = r
      }
      broadcast(r, msg)
      return
    }
  })

  ws.on('close', () => {
    clients.delete(ws)
    presence(ctx.room)
  })
})

// ───────────────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT || 8787)
ensureDataDir()
loadBackup()
server.listen(PORT, '0.0.0.0', () =>
  console.log(`[WS] listening on 0.0.0.0:${PORT} | data=${DATA_DIR}`)
)