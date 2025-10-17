// apps/web/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createUser, getUserByEmail, hashPassword, signJWT } from '@/lib/auth'

export const runtime = 'nodejs' // necessario su Windows/better-sqlite3

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  nickname: z.string().min(2).max(32),
})

export async function POST(req: NextRequest) {
  const isDev = process.env.NODE_ENV !== 'production'
  try {
    const raw = await req.text()
    console.log('[REGISTER] raw body:', raw)
    const { email, password, nickname } = Body.parse(JSON.parse(raw || '{}'))
    console.log('[REGISTER] parsed:', { email, nickname })

    const existing = getUserByEmail(email)
    if (existing) {
      console.log('[REGISTER] email già registrata')
      return NextResponse.json({ error: 'Email già registrata' }, { status: 400 })
    }

    console.log('[REGISTER] hashing password…')
    const password_hash = await hashPassword(password)

    console.log('[REGISTER] createUser…')
    const uid = createUser(email, password_hash, nickname)

    console.log('[REGISTER] signJWT…')
    const token = signJWT({ uid, email })

    const res = NextResponse.json({ ok: true, uid, email, nickname })
    res.cookies.set('session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 giorni
    })
    console.log('[REGISTER] OK', { uid })
    return res
  } catch (err: any) {
    console.error('REGISTER /api/auth/register error:', err)
    const msg = err?.message || 'Errore interno'
    // in dev mostro l’errore vero per aiutarci a debug- gare
    return NextResponse.json({ error: isDev ? msg : 'Errore interno' }, { status: 500 })
  }
}
