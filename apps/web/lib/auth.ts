// apps/web/lib/auth.ts
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import db from './db'

// ====== Costanti cookie/JWT ======
const JWT_NAME = 'archei_session'
const MAX_AGE = 60 * 60 * 24 * 14 // 14 giorni

// ====== Tipi ======
export type UserRole = 'player' | 'gm'
export type UserRow = {
  id: number
  email: string
  password_hash: string
  nickname: string
  role: UserRole
  created_at: string
}

export type JWTPayload = {
  uid: number
  email: string
  role?: UserRole
  iat?: number
  exp?: number
}

// ====== Password ======
export async function hashPassword(password: string) {
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(password, salt)
}
export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

// ====== JWT ======
export function signJWT(payload: { uid: number; email: string; role?: UserRole }) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET non configurato')
  return jwt.sign(payload, secret, { expiresIn: MAX_AGE })
}
export function decodeJWT(token: string) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET non configurato')
  return jwt.verify(token, secret) as JWTPayload
}

export function setSessionCookie(token: string) {
  cookies().set(JWT_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE,
    path: '/',
  })
}
export function clearSessionCookie() {
  cookies().set(JWT_NAME, '', { maxAge: 0, path: '/' })
}
export function getUserFromCookie(): { uid: number; email: string; role?: UserRole } | null {
  const token = cookies().get(JWT_NAME)?.value
  if (!token) return null
  try {
    const d = decodeJWT(token)
    return { uid: d.uid, email: d.email, role: d.role }
  } catch {
    return null
  }
}

// ====== DB helpers: utenti ======
export function getUserByEmail(email: string) {
  return db.prepare(`SELECT * FROM users WHERE email = ?`).get(email) as UserRow | undefined
}
export function getUserById(id: number) {
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as UserRow | undefined
}

// createUser: aggiunto parametro opzionale role (default 'player')
export function createUser(
  email: string,
  password_hash: string,
  nickname: string,
  role: UserRole = 'player',
) {
  const stmt = db.prepare(
    `INSERT INTO users (email, password_hash, nickname, role) VALUES (?,?,?,?)`,
  )
  const info = stmt.run(email, password_hash, nickname, role)
  return info.lastInsertRowid as number
}

// Ruolo
export function setUserRole(uid: number, role: UserRole) {
  db.prepare(`UPDATE users SET role = ? WHERE id = ?`).run(role, uid)
}
export function setUserRoleByEmail(email: string, role: UserRole) {
  db.prepare(`UPDATE users SET role = ? WHERE email = ?`).run(role, email)
}
export function getUserRole(uid: number): UserRole | undefined {
  const row = db.prepare(`SELECT role FROM users WHERE id = ?`).get(uid) as { role?: UserRole } | undefined
  return row?.role
}

// ====== DB helpers: dati player (profilo/scheda ecc.) ======
export function getPlayerData(user_id: number) {
  return db.prepare(`SELECT * FROM player_data WHERE user_id = ?`).get(user_id) as
    | { id: number; user_id: number; data_json: string; updated_at: string }
    | undefined
}

export function upsertPlayerData(user_id: number, data_json: string) {
  const row = getPlayerData(user_id)
  if (row) {
    db.prepare(
      `UPDATE player_data SET data_json = ?, updated_at = datetime('now') WHERE user_id = ?`,
    ).run(data_json, user_id)
  } else {
    db.prepare(`INSERT INTO player_data (user_id, data_json) VALUES (?,?)`).run(
      user_id,
      data_json,
    )
  }
}

// ====== Helper di login: emette JWT con ruolo attuale ======
export function issueSessionForUser(user: UserRow) {
  const token = signJWT({ uid: user.id, email: user.email, role: user.role })
  setSessionCookie(token)
  return token
}
