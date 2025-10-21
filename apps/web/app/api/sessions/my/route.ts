import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { getAuthUser } from '@/lib/getAuthUser'

export async function GET(req: Request) {
  const me = await getAuthUser(req)
  if (!me) return NextResponse.json({ ok:false, error:'unauthorized' }, { status: 401 })

  const rows = db.prepare(`
    SELECT gs.code, gs.name, gs.description, gs.kind,
           sm.role, gs.created_at
    FROM session_members sm
    JOIN game_sessions gs ON gs.id = sm.session_id
    WHERE sm.user_id = ?
    ORDER BY gs.created_at DESC
  `).all(me.id)

  return NextResponse.json({ ok:true, sessions: rows })
}
