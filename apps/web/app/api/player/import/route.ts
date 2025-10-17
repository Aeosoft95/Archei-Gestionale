import { NextRequest } from 'next/server'
import { getUserFromCookie, upsertPlayerData } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = getUserFromCookie()
  if (!user) return Response.json({ error: 'Non autenticato' }, { status: 401 })

  const raw = await req.text()
  try {
    const parsed = JSON.parse(raw)
    upsertPlayerData(user.uid, JSON.stringify(parsed))
    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: 'File non valido' }, { status: 400 })
  }
}
