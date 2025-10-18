// apps/web/app/api/auth/me/route.ts
import { NextRequest } from 'next/server'
import { getUserFromCookie } from '@/lib/auth'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: NextRequest) {
  try {
    const sess = getUserFromCookie()
    if (!sess) return Response.json({ ok: false, error: 'No session' }, { status: 401 })

    const row = db.prepare(
      `SELECT id, email, nickname, role FROM users WHERE id = ?`
    ).get(sess.uid) as { id:number; email:string; nickname:string; role?:string } | undefined

    if (!row) return Response.json({ ok: false, error: 'User not found' }, { status: 404 })

    return Response.json({
      ok: true,
      user: {
        id: row.id,
        email: row.email,
        nickname: row.nickname,
        role: row.role || 'player',
      }
    })
  } catch (err:any) {
    return Response.json({ ok:false, error: err?.message || 'Errore' }, { status: 500 })
  }
}
