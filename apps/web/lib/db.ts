// apps/web/lib/db.ts
import 'server-only'
import fs from 'fs'
import path from 'path'

// Forziamo runtime Node
export const runtime = 'nodejs'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Database = require('better-sqlite3') as typeof import('better-sqlite3')

const dataDir = path.join(process.cwd(), 'data')
const dbPath = path.join(dataDir, 'archei.sqlite')
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nickname TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS player_data (
    user_id INTEGER PRIMARY KEY,
    data_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`)

// Migrazione: aggiungi colonna is_gm se non esiste
const hasIsGm = db.prepare(`PRAGMA table_info(users)`).all()
  .some((c: any) => c.name === 'is_gm')
if (!hasIsGm) {
  db.exec(`ALTER TABLE users ADD COLUMN is_gm INTEGER NOT NULL DEFAULT 0;`)
}
// --- Session tables (idempotenti)
db.exec(`
  CREATE TABLE IF NOT EXISTS game_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    kind TEXT,
    owner_user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(owner_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS session_members (
    session_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('gm','player')),
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY(session_id, user_id),
    FOREIGN KEY(session_id) REFERENCES game_sessions(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

export default db
