import 'server-only'
import type { NextRequest } from 'next/server'
import db from '@/lib/db'
import bcrypt from 'bcryptjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(req: NextRequest) {
  try {
    const { displayName = null, email, password } = await req.json() as {
      displayName?: string | null,
      email: string,
      password: string,
    }

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email e password sono obbligatorie' }), { status: 400 })
    }
    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ error: 'Email non valida' }), { status: 400 })
    }
    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password troppo corta (min 8)' }), { status: 400 })
    }

    const exists = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email)
    if (exists) {
      return new Response(JSON.stringify({ error: 'Email già registrata' }), { status: 409 })
    }

    const passhash = await bcrypt.hash(password, 12)
    db.prepare(`
      INSERT INTO users (email, passhash, display_name, role)
      VALUES (?, ?, ?, 'player')
    `).run(email, passhash, displayName)

    return Response.json({ ok: true })
  } catch (err:any) {
    console.error('register error:', err)
    return new Response(JSON.stringify({ error: 'Errore interno' }), { status: 500 })
  }
}
