import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { getAuthUser } from '@/lib/getAuthUser'

export async function POST(req: Request) {
  const me = await getAuthUser(req)
  if (!me) return NextResponse.json({ ok:false, error:'unauthorized' }, { status: 401 })

  const { code } = await req.json().catch(()=>({}))
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ ok:false, error:'missing code' }, { status: 400 })
  }

  const s = db.prepare(`SELECT id, owner_user_id FROM game_sessions WHERE code = ?`).get(code.trim().toUpperCase())
  if (!s) return NextResponse.json({ ok:false, error:'not found' }, { status: 404 })

  // Owner è già GM. Gli altri entrano come player (se non già dentro)
  const role = (me.id === s.owner_user_id) ? 'gm' : 'player'
  db.prepare(`
    INSERT OR IGNORE INTO session_members (session_id, user_id, role)
    VALUES (?, ?, ?)
  `).run(s.id, me.id, role)

  return NextResponse.json({ ok:true, role, code: code.trim().toUpperCase() })
}
