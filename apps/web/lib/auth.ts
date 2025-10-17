import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import db from './db'

const JWT_NAME = 'archei_session'
const MAX_AGE = 60 * 60 * 24 * 14 // 14 giorni

export async function hashPassword(password: string) {
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(password, salt)
}
export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

export function signJWT(payload: { uid: number; email: string }) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET non configurato')
  return jwt.sign(payload, secret, { expiresIn: MAX_AGE })
}
export function decodeJWT(token: string) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET non configurato')
  return jwt.verify(token, secret) as { uid: number; email: string; iat: number; exp: number }
}

export function setSessionCookie(token: string) {
  cookies().set(JWT_NAME, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE, path: '/',
  })
}
export function clearSessionCookie() {
  cookies().set(JWT_NAME, '', { maxAge: 0, path: '/' })
}
export function getUserFromCookie(): { uid: number; email: string } | null {
  const token = cookies().get(JWT_NAME)?.value
  if (!token) return null
  try {
    const d = decodeJWT(token)
    return { uid: d.uid, email: d.email }
  } catch { return null }
}

// DB helpers
export function getUserByEmail(email: string) {
  return db.prepare(`SELECT * FROM users WHERE email = ?`).get(email) as any
}
export function createUser(email: string, password_hash: string, nickname: string) {
  const info = db.prepare(`INSERT INTO users (email, password_hash, nickname) VALUES (?,?,?)`).run(email, password_hash, nickname)
  return info.lastInsertRowid as number
}
export function getPlayerData(user_id: number) {
  return db.prepare(`SELECT * FROM player_data WHERE user_id = ?`).get(user_id) as any
}
export function upsertPlayerData(user_id: number, data_json: string) {
  const row = getPlayerData(user_id)
  if (row) db.prepare(`UPDATE player_data SET data_json=?, updated_at=datetime('now') WHERE user_id=?`).run(data_json, user_id)
  else db.prepare(`INSERT INTO player_data (user_id, data_json) VALUES (?,?)`).run(user_id, data_json)
}
