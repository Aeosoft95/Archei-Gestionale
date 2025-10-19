// app/api/admin/make-gm/route.ts
import { NextResponse } from 'next/server'

// Se usi variabili d'ambiente lato server, stai su runtime Node.js
export const runtime = 'nodejs'

// TODO: sostituisci questa funzione con l’update reale sul DB
async function updateUserRoleByNickname(nickname: string): Promise<{ nickname: string } | null> {
  // Esempio con Prisma (scommenta e adatta):
  /**
  import { prisma } from '@/lib/prisma'
  const user = await prisma.user.update({
    where: { nickname },
    data: { role: 'gm' },
    select: { nickname: true },
  })
  return user
  */

  // Placeholder: fingi successo (sostituisci con DB reale)
  // Ritorna null se l’utente non esiste.
  return { nickname }
}

export async function POST(req: Request) {
  try {
    const { nickname, password } = await req.json?.() ?? {}

    if (!nickname || !password) {
      return NextResponse.json({ ok: false, error: 'Missing nickname or password' }, { status: 400 })
    }

    const secret = process.env.ADMIN_PROMOTE_PASSWORD
    if (!secret) {
      // Config errata lato server
      return NextResponse.json({ ok: false, error: 'Server not configured' }, { status: 500 })
    }

    if (password !== secret) {
      return NextResponse.json({ ok: false, error: 'Invalid password' }, { status: 403 })
    }

    const res = await updateUserRoleByNickname(String(nickname))
    if (!res) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, user: { nickname: res.nickname, role: 'gm' } })
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 })
  }
}

// Opzionale: rifiuta altri metodi
export async function GET() {
  return NextResponse.json({ ok: false, error: 'Method not allowed' }, { status: 405 })
}
