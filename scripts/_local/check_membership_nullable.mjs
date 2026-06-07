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

const pnpmDir = path.join(process.cwd(), 'node_modules', '.pnpm')
const pgDir = fs.readdirSync(pnpmDir).find((d) => /^pg@\d/.test(d))
const pgIndex = path.join(pnpmDir, pgDir, 'node_modules', 'pg', 'lib', 'index.js')
const { default: pg } = await import(pathToFileURL(pgIndex).href)

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URI, max: 1, connectionTimeoutMillis: 15000 })
const q = await pool.query(
  `SELECT column_name, is_nullable, data_type
   FROM information_schema.columns
   WHERE table_name = 'tenant_memberships' AND column_name IN ('user_id','tenant_id','role','status')
   ORDER BY column_name`,
)
console.table(q.rows)
const c = await pool.query(`SELECT count(*)::int AS n_null_user FROM tenant_memberships WHERE user_id IS NULL`)
console.log('rows with null user_id:', c.rows[0].n_null_user)
await pool.end()
