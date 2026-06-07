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

const pnpmDir = path.join(process.cwd(), 'node_modules', '.pnpm')
const pgDir = fs.readdirSync(pnpmDir).find((d) => /^pg@\d/.test(d))
const pgIndex = path.join(pnpmDir, pgDir, 'node_modules', 'pg', 'lib', 'index.js')
const { default: pg } = await import(pathToFileURL(pgIndex).href)
const pool = new pg.Pool({ connectionString: uri, max: 1, connectionTimeoutMillis: 12000 })
try {
  console.log('Connection target (from local .env):')
  console.log('  host     :', host)
  console.log('  database :', db)
  const cur = await pool.query('SELECT current_database() AS d, current_schema() AS s')
  console.log('  current_database():', cur.rows[0].d, '| current_schema():', cur.rows[0].s)
  // databases on this server
  const dbs = await pool.query(`SELECT datname FROM pg_database WHERE datistemplate=false ORDER BY datname`)
  console.log('Databases on this server:', dbs.rows.map((r) => r.datname).join(', '))
  // schemas + table counts
  const sc = await pool.query(
    `SELECT table_schema, count(*)::int AS n FROM information_schema.tables
     WHERE table_schema NOT IN ('pg_catalog','information_schema')
     GROUP BY table_schema ORDER BY n DESC`,
  )
  console.log('Schemas with tables:', sc.rows.map((r) => `${r.table_schema}(${r.n})`).join(', ') || '(none)')
  const sample = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name LIMIT 8`,
  )
  console.log('Sample public tables:', sample.rows.map((r) => r.table_name).join(', '))
} catch (e) {
  console.error('FAILED:', e.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
