// apps/web/app/api/_health/route.ts
import { NextResponse } from 'next/server'
import db from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const row = db.prepare('SELECT 1 as ok').get()
    return NextResponse.json({ ok: row?.ok === 1 })
  } catch (e:any) {
    console.error('HEALTH error:', e)
    return NextResponse.json({ ok: false, error: e?.message || 'db error' }, { status: 500 })
  }
}
