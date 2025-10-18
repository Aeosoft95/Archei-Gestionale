// apps/web/app/api/admin/make-gm/route.ts
export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import { z } from 'zod'
import db from '@/lib/db'   // <-- usa l'export default del tuo db.ts

const Body = z.object({
  email: z.string().email(),
})

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') || ''
    const secret = auth.replace(/^Bearer\s+/i, '')
    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
      return Response.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { email } = Body.parse(await req.json())
    const stmt = db.prepare(`UPDATE users SET role='gm' WHERE email = ?`)
    const info = stmt.run(email)
    if (info.changes === 0) {
      return Response.json({ error: 'Utente non trovato' }, { status: 404 })
    }

    return Response.json({ ok: true, email, newRole: 'gm' })
  } catch (err:any) {
    return Response.json({ error: err?.message || 'Errore' }, { status: 400 })
  }
}
