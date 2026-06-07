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
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URI, max: 1, connectionTimeoutMillis: 12000 })

async function colExists(table, col) {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2 LIMIT 1`,
    [table, col],
  )
  return r.rowCount > 0
}
async function nullable(table, col) {
  const r = await pool.query(
    `SELECT is_nullable FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`,
    [table, col],
  )
  return r.rows[0]?.is_nullable ?? 'MISSING'
}

try {
  // Recent / outage-prone columns
  console.log('tenants.branding_favicon_id present:', await colExists('tenants', 'branding_favicon_id'))
  // aiConfig (Sprint 44) — check a representative column (name may vary)
  const aiCols = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='tenants' AND column_name LIKE 'ai_config%' ORDER BY column_name`,
  )
  console.log('tenants ai_config* columns:', aiCols.rows.map((r) => r.column_name).join(', ') || '(none)')
  console.log('tenant_memberships.user_id is_nullable:', await nullable('tenant_memberships', 'user_id'))
  console.log('channels.data present:', await colExists('channels', 'data'))
  console.log('quests table present:', await colExists('quests', 'id'))
  // How many tenants / users already live here?
  const t = await pool.query(`SELECT count(*)::int AS n FROM tenants`).catch(() => ({ rows: [{ n: '?' }] }))
  const u = await pool.query(`SELECT count(*)::int AS n FROM users`).catch(() => ({ rows: [{ n: '?' }] }))
  console.log(`existing data — tenants: ${t.rows[0].n}, users: ${u.rows[0].n}`)
} catch (e) {
  console.error('CHECK FAILED:', e.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
