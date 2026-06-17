import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..', '..')
config({ path: path.join(root, '.env.local') }); config({ path: path.join(root, '.env') })
const dbName = process.argv[2]
const base = process.env.DATABASE_URI || process.env.DATABASE_URL
const u = new URL(base)
if (dbName) u.pathname = '/' + dbName
console.log('DB:', u.host + u.pathname)
const c = new pg.Client({ connectionString: u.toString(), ssl: false })
await c.connect()
try {
  const r = await c.query(`SELECT id, federation_id, name, domain, ministry_status, network_visible, first_seen_at, last_heartbeat_at FROM federation_peers ORDER BY name, created_at`)
  console.log(`\nfederation_peers (${r.rowCount} rows):`)
  for (const row of r.rows) console.log(JSON.stringify(row))
} catch (e) { console.error('query failed:', e.message) } finally { await c.end() }
