/**
 * find-orphaned-media.mjs — identify media uploaded as chat attachments whose
 * message never persisted (the "attachment-message vanish" artifacts).
 *
 * When a message-with-attachment save rolled back (the pre-619efe3 connection bug),
 * the MEDIA committed independently (upload + analysis succeed on their own request)
 * but no message row references it. This finds those orphans: media rows with NO
 * entry in messages_attachments.
 *
 * READ-ONLY by default. Deletion is human-gated via --purge=<ids>.
 *
 * Usage (from C:\Dev\angels-os):
 *   node scripts/find-orphaned-media.mjs                 # recent (7d) chat-orphan candidates
 *   node scripts/find-orphaned-media.mjs --days=30       # widen the window
 *   node scripts/find-orphaned-media.mjs --all           # all-time (noisy — includes non-chat media)
 *   node scripts/find-orphaned-media.mjs --purge=76,77   # DELETE specific media ids (explicit)
 *
 * DB target = process.env.DATABASE_URI (your .env / .env.local). To target the other
 * node, point DATABASE_URI at .../kendev vs .../angels. SSL is forced rejectUnauthorized:false
 * to match the pooler (:6432, DATABASE_SSL=require) and prod.
 *
 * NOTE: --all flags ALL media not referenced by a message — that legitimately includes
 * logos, hero images, product photos, etc. The recent-window default is the right lens
 * for finding vanished chat posts. Only --purge ids you've confirmed are chat orphans.
 */
import { loadEnv } from 'payload/node'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
loadEnv(path.resolve(__dirname, '..'))

const require = createRequire(
  path.resolve(__dirname, '../node_modules/.pnpm/pg@8.16.3/node_modules/pg/package.json'),
)
const pg = require('./lib/index.js')

// ── args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const all = args.includes('--all')
const daysArg = args.find((a) => a.startsWith('--days='))
const days = daysArg ? Number(daysArg.split('=')[1]) || 7 : 7
const purgeArg = args.find((a) => a.startsWith('--purge='))
const purgeIds = purgeArg
  ? purgeArg
      .split('=')[1]
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0)
  : []

const conn = process.env.DATABASE_URI || process.env.DATABASE_URL
if (!conn) {
  console.error('No DATABASE_URI / DATABASE_URL in env. Aborting.')
  process.exit(1)
}
// Surface which DB we're hitting (last path segment only — no creds).
const dbName = (() => {
  try {
    return new URL(conn).pathname.replace(/^\//, '') || '(unknown)'
  } catch {
    return '(unparseable)'
  }
})()

// SSL is ALWAYS ON. Every DB connection goes through the :6432 pooler with SSL —
// prod and local alike. There is no non-SSL path.
const pool = new pg.Pool({ connectionString: conn, ssl: { rejectUnauthorized: false } })
const client = await pool.connect()

try {
  console.log(`\n🔎 Orphaned-media scan — DB: ${dbName}\n`)

  if (purgeIds.length > 0) {
    // Human-gated deletion of explicitly-named ids. Re-verify each is truly
    // unreferenced by any message before deleting, and report.
    for (const id of purgeIds) {
      const ref = await client.query(
        'SELECT count(*)::int AS n FROM messages_attachments WHERE media_id = $1',
        [id],
      )
      if (ref.rows[0].n > 0) {
        console.log(`  ⏭  media ${id}: referenced by ${ref.rows[0].n} message(s) — NOT deleting.`)
        continue
      }
      const del = await client.query(
        'DELETE FROM media WHERE id = $1 RETURNING id, filename',
        [id],
      )
      if (del.rowCount > 0) {
        console.log(`  🗑  deleted media ${id} (${del.rows[0].filename}).`)
      } else {
        console.log(`  ❓ media ${id}: not found.`)
      }
    }
    console.log('\nDone (purge).')
  } else {
    // Identify mode (default). Recent window unless --all.
    const where = all
      ? 'ma.media_id IS NULL'
      : `ma.media_id IS NULL AND m.created_at > now() - interval '${days} days'`

    const res = await client.query(`
      SELECT m.id, m.filename, m.mime_type, m.filesize, m.tenant_id, m.created_at
      FROM media m
      LEFT JOIN messages_attachments ma ON ma.media_id = m.id
      WHERE ${where}
      ORDER BY m.created_at DESC
      LIMIT 200
    `)

    const totalRes = await client.query(
      `SELECT count(*)::int AS n FROM media m
       LEFT JOIN messages_attachments ma ON ma.media_id = m.id
       WHERE ma.media_id IS NULL`,
    )

    console.log(
      all
        ? `All media not referenced by any message: ${res.rows.length} shown (total orphans: ${totalRes.rows[0].n})`
        : `Chat-orphan candidates (last ${days}d): ${res.rows.length}  |  all-time unreferenced: ${totalRes.rows[0].n}`,
    )
    console.log('─'.repeat(78))
    for (const r of res.rows) {
      const kb = r.filesize ? `${Math.round(r.filesize / 1024)}KB` : '?'
      console.log(
        `  id=${String(r.id).padEnd(6)} tenant=${String(r.tenant_id ?? '-').padEnd(4)} ` +
          `${String(r.mime_type || '?').padEnd(12)} ${kb.padEnd(8)} ${r.created_at.toISOString()}  ${r.filename}`,
      )
    }
    if (res.rows.length === 0) console.log('  (none)')
    console.log('─'.repeat(78))
    console.log(
      `\nTo delete confirmed chat orphans: node scripts/find-orphaned-media.mjs --purge=${res.rows
        .slice(0, 5)
        .map((r) => r.id)
        .join(',')}`,
    )
  }
} catch (e) {
  console.error('Scan failed:', e.message)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
