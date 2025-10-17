import { getUserFromCookie, getPlayerData } from '@/lib/auth'

export async function GET() {
  const user = getUserFromCookie()
  if (!user) return new Response('Non autenticato', { status: 401 })
  const row = getPlayerData(user.uid)
  const json = row ? row.data_json : JSON.stringify({ sheet:{}, inventory:{}, notes:{}, lastSeen: Date.now() })
  return new Response(json, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="archei-player-${user.uid}.json"`,
    },
  })
}
