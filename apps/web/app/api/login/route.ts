import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getUserByEmail, verifyPassword, signJWT, setSessionCookie } from '@/lib/auth'

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export async function POST(req: NextRequest) {
  try {
    const { email, password } = Body.parse(await req.json())
    const user = getUserByEmail(email)
    if (!user) return Response.json({ error: 'Credenziali non valide' }, { status: 400 })

    const ok = await verifyPassword(password, user.password_hash)
    if (!ok) return Response.json({ error: 'Credenziali non valide' }, { status: 400 })

    const token = signJWT({ uid: user.id, email: user.email, role: user.role })
    setSessionCookie(token)

    return Response.json({
      ok: true,
      uid: user.id,
      email: user.email,
      nickname: user.nickname,
      role: user.role,
    })
  } catch (err:any) {
    return Response.json({ error: err?.message || 'Errore' }, { status: 400 })
  }
}
