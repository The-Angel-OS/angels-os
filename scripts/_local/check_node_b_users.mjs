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
try {
  const total = await pool.query('SELECT count(*)::int AS n FROM users')
  console.log('total users:', total.rows[0].n)
  // super admins (roles is an array column or jsonb depending on schema)
  const supers = await pool.query(
    `SELECT u.email FROM users u
     JOIN users_roles r ON r.parent_id = u.id
     WHERE r.value = 'super_admin' LIMIT 10`,
  ).catch(async () => {
    // fallback if roles stored differently
    return pool.query(`SELECT email FROM users LIMIT 10`)
  })
  console.log('super_admin emails:', supers.rows.map((r) => r.email).join(', ') || '(none found)')
  const ken = await pool.query(
    `SELECT id, email, name FROM users WHERE lower(email) = lower($1)`,
    ['kenneth.courtney@gmail.com'],
  )
  console.log('kenneth account:', ken.rows[0] ? `id ${ken.rows[0].id}, ${ken.rows[0].email}` : 'NOT FOUND')
} catch (e) {
  console.error('CHECK FAILED:', e.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
