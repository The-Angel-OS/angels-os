import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

for (const f of ['.env.local', '.env']) {
  try {
    const txt = fs.readFileSync(path.join(process.cwd(), f), 'utf8')
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {}
}

const uri = process.env.DATABASE_URI || ''
const host = (uri.match(/@([^/]+)\//) || [])[1] || '?'
const db = (uri.match(/\/([^/?]+)(\?|$)/) || [])[1] || '?'
console.log(`Target: ${host} / ${db}`)

const pnpmDir = path.join(process.cwd(), 'node_modules', '.pnpm')
const pgDir = fs.readdirSync(pnpmDir).find((d) => /^pg@\d/.test(d))
const pgIndex = path.join(pnpmDir, pgDir, 'node_modules', 'pg', 'lib', 'index.js')
const { default: pg } = await import(pathToFileURL(pgIndex).href)

const pool = new pg.Pool({ connectionString: uri, max: 1, connectionTimeoutMillis: 12000 })
try {
  const who = await pool.query('SELECT current_database() AS db, current_user AS usr, version() AS v')
  console.log('Connected ✓', who.rows[0].db, '/', who.rows[0].usr)
  const tables = await pool.query(
    `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`,
  )
  console.log('public tables:', tables.rows[0].n)
  const mig = await pool.query(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='payload_migrations') AS has_migrations`,
  )
  console.log('payload_migrations table present:', mig.rows[0].has_migrations)
  if (mig.rows[0].has_migrations) {
    const applied = await pool.query(`SELECT count(*)::int AS n FROM payload_migrations`)
    console.log('migrations applied:', applied.rows[0].n)
  }
} catch (e) {
  console.error('CONNECT FAILED:', e.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
