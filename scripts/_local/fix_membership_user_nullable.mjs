/**
 * One-off prod fix: allow pending email invitations (no user account yet) to be
 * created. tenant_memberships.user_id was NOT NULL, which made every email invite
 * 500 with a Payload ValidationError. Dropping NOT NULL is non-destructive (only
 * permits null user_id for pending invites; user is linked on accept).
 * Idempotent + wrapped in a transaction.
 */
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
const client = await pool.connect()
try {
  const before = await client.query(
    `SELECT is_nullable FROM information_schema.columns WHERE table_name='tenant_memberships' AND column_name='user_id'`,
  )
  console.log('before is_nullable:', before.rows[0]?.is_nullable)

  await client.query('BEGIN')
  await client.query('ALTER TABLE tenant_memberships ALTER COLUMN user_id DROP NOT NULL')
  await client.query('COMMIT')

  const after = await client.query(
    `SELECT is_nullable FROM information_schema.columns WHERE table_name='tenant_memberships' AND column_name='user_id'`,
  )
  console.log('after  is_nullable:', after.rows[0]?.is_nullable)
  console.log('DONE')
} catch (e) {
  await client.query('ROLLBACK').catch(() => {})
  console.error('FAILED:', e.message)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
