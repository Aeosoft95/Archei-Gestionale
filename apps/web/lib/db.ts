// apps/web/lib/db.ts
import 'server-only'               // Garantisce che Next non lo usi mai lato client/edge
import fs from 'fs'
import path from 'path'

// Forziamo runtime Node in tutti i file che importano questo modulo
export const runtime = 'nodejs'

// Nota: better-sqlite3 è CommonJS con addon nativo, usare require è più solido in Node
// (evita edge e bundling strani).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Database = require('better-sqlite3') as typeof import('better-sqlite3')

// Dove mettere il DB (puoi lasciare così o cambiare)
const dataDir = path.join(process.cwd(), 'data')
const dbPath = path.join(dataDir, 'archei.sqlite')

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

// apps/web/lib/db.ts (estratto schema)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nickname TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)


export default db
