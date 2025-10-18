import 'server-only'
import { NextRequest } from 'next/server'
import { getUserFromCookie, getPlayerData, upsertPlayerData } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET() {
  const me = getUserFromCookie()
  if (!me) return Response.json({ error: 'Non autenticato' }, { status: 401 })

  const row = getPlayerData(me.uid)
  const data = row?.data_json ? JSON.parse(row.data_json) : null
  return Response.json({ ok: true, data })
}

export async function POST(req: NextRequest) {
  const me = getUserFromCookie()
  if (!me) return Response.json({ error: 'Non autenticato' }, { status: 401 })

  try {
    const body = await req.json()
    // salva tutto come json (lo schema può evolvere senza migrazioni)
    upsertPlayerData(me.uid, JSON.stringify(body))
    return Response.json({ ok: true })
  } catch (err: any) {
    return Response.json({ error: err?.message || 'Errore' }, { status: 400 })
  }
}
