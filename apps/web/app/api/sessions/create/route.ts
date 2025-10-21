import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { getAuthUser } from '@/lib/getAuthUser' // vedi nota sotto

function genCode(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random()*chars.length)]
  return s
}

export async function POST(req: Request) {
  const me = await getAuthUser(req)
  if (!me) return NextResponse.json({ ok:false, error:'unauthorized' }, { status: 401 })

  const { name, description, kind } = await req.json().catch(()=>({}))
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ ok:false, error:'missing name' }, { status: 400 })
  }

  // genera codice univoco
  let code = ''
  const existsStmt = db.prepare(`SELECT 1 FROM game_sessions WHERE code = ?`)
  do { code = genCode(8) } while (existsStmt.get(code))

  const insertSession = db.prepare(`
    INSERT INTO game_sessions (code, name, description, kind, owner_user_id)
    VALUES (?, ?, ?, ?, ?)
  `)
  const result = insertSession.run(code, name.trim(), (description||'').trim(), (kind||'').trim(), me.id)

  const sessionId = Number(result.lastInsertRowid)
  const addMember = db.prepare(`
    INSERT OR IGNORE INTO session_members (session_id, user_id, role)
    VALUES (?, ?, 'gm')
  `)
  addMember.run(sessionId, me.id)

  return NextResponse.json({ ok:true, code })
}
