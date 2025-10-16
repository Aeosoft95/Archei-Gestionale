import next from 'next'
import http from 'http'
import { parse } from 'url'
import { WebSocketServer, WebSocket } from 'ws'

type Ctx = { room: string; nick: string; role: 'gm' | 'player' }

const dev = true
const hostname = '0.0.0.0'
const port = 3000

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

const clients = new Map<WebSocket, Ctx>()
const sceneByRoom = new Map<string, any>()
const countdownByRoom = new Map<string, any>()

function broadcast(room: string, data: any) {
  const payload = JSON.stringify(data)
  for (const [ws, ctx] of clients)
    if (ctx.room === room && ws.readyState === ws.OPEN) ws.send(payload)
}
function presence(room: string) {
  const nicks = [...clients.values()].filter(c => c.room === room).map(c => c.nick)
  broadcast(room, { t: 'chat:presence', room, nicks })
}

async function main() {
  await app.prepare()
  const server = http.createServer(async (req, res) => {
    if (req.url?.startsWith('/ws') && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' })
      res.end('WS endpoint at /ws')
      return
    }
    const parsedUrl = parse(req.url || '', true)
    await handle(req, res, parsedUrl)
  })

  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (req, socket, head) => {
    const { pathname, query } = parse(req.url || '', true)
    if (pathname !== '/ws') { socket.destroy(); return }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, query)
    })
  })

  wss.on('connection', (ws, req: any, query: any) => {
    const ip = (req.socket?.remoteAddress || '').replace('::ffff:', '')
    const roomDefault = (query?.room as string) || 'demo'
    clients.set(ws, { room: roomDefault, nick: 'anon', role: 'player' })
    console.log(`[WS] conn ${ip} room=${roomDefault}`)

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
        const sc = sceneByRoom.get(ctx.room); if (sc) ws.send(JSON.stringify(sc))
        const cd = countdownByRoom.get(ctx.room); if (cd) ws.send(JSON.stringify(cd))
        return
      }

      const r = msg.room || ctx.room
      if (typeof msg.t === 'string') {
        if (msg.t.startsWith('DISPLAY_')) {
          if (msg.t === 'DISPLAY_SCENE_STATE') sceneByRoom.set(r, msg)
          if (msg.t === 'DISPLAY_COUNTDOWN') countdownByRoom.set(r, msg)
          broadcast(r, msg); return
        }
        if (msg.t.startsWith('chat:')) {
          if (msg.t === 'chat:msg') msg.ts = msg.ts || Date.now()
          broadcast(r, msg); return
        }
      }
    })

    ws.on('close', () => {
      const ctx = clients.get(ws)
      clients.delete(ws)
      if (ctx) presence(ctx.room)
    })
  })

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://localhost:${port} (LAN: http://<IP_LOCALE>:${port})`)
    console.log(`[WS] listening on ws://<IP_LOCALE>:${port}/ws`)
  })
}

main().catch(err => { console.error(err); process.exit(1) })
