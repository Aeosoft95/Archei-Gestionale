// apps/web/lib/db.ts
import 'server-only'
import fs from 'fs'
import path from 'path'

// Forziamo runtime Node per Next.js
export const runtime = 'nodejs'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Database = require('better-sqlite3') as typeof import('better-sqlite3')

/**
 * Percorso DB:
 * - in produzione/hosting usa DATA_DIR (es. /home/user/data)
 * - in locale fallback a ./data
 */
const baseDir = process.env.DATA_DIR || path.join(process.cwd(), 'data')
if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true })
const dbPath = path.join(baseDir, 'archei.sqlite')

// Inizializza DB
const db = new Database(dbPath)
// Pragma consigliati
db.pragma('foreign_keys = ON')
db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')

// === Schema base (idempotente) ===
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nickname TEXT NOT NULL,
    -- NB: 'role' può essere 'player' o 'gm', default player
    role TEXT NOT NULL DEFAULT 'player',
    -- Flag rapido (compat legacy); 0 = false, 1 = true
    is_gm INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS player_data (
    user_id INTEGER PRIMARY KEY,
    data_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS game_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    kind TEXT,
    owner_user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(owner_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS session_members (
    session_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('gm','player')),
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY(session_id, user_id),
    FOREIGN KEY(session_id) REFERENCES game_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`)

// === Migrazioni idempotenti su 'users' ===
const userCols = db.prepare(`PRAGMA table_info(users)`).all() as Array<{name:string}>
const colExists = (n: string) => userCols.some(c => c.name === n)

if (!colExists('role')) {
  db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'player';`)
}
if (!colExists('is_gm')) {
  db.exec(`ALTER TABLE users ADD COLUMN is_gm INTEGER NOT NULL DEFAULT 0;`)
}

// === Indici utili (idempotenti) ===
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_sessions_owner ON game_sessions(owner_user_id);
  CREATE INDEX IF NOT EXISTS idx_members_user ON session_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_members_session ON session_members(session_id);
`)

export default db