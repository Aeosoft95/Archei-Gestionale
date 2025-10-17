import { getUserFromCookie, getPlayerData, upsertPlayerData } from '@/lib/auth'
import { NextRequest } from 'next/server'

export async function GET() {
  const user = getUserFromCookie()
  if (!user) return Response.json({ error: 'Non autenticato' }, { status: 401 })
  const row = getPlayerData(user.uid)
  const data = row ? JSON.parse(row.data_json) : { sheet:{}, inventory:{}, notes:{}, lastSeen: Date.now() }
  return Response.json({ ok: true, data })
}
export async function PUT(req: NextRequest) {
  const user = getUserFromCookie()
  if (!user) return Response.json({ error: 'Non autenticato' }, { status: 401 })
  const body = await req.json()
  const data = { ...(body||{}), lastSeen: Date.now() }
  upsertPlayerData(user.uid, JSON.stringify(data))
  return Response.json({ ok: true })
}
