/**
 * Retire the bookable services a demo site seeded under the WRONG trade pack.
 *
 * Re-running demo-site fixes the pages, because pages overwrite by slug. It does
 * not fix the booking catalog: seedDemoServices keys on a serviceId derived from
 * the service NAME, so a second pass under a different pack ADDS its rows and
 * leaves the first pack's behind. The Celersoft site was provisioned once
 * against a build that predated the enterprise pack, so its /book page offered
 * "Virus & Malware Removal" beside "ERP Solutions".
 *
 * Disables rather than deletes: `enabled=false` takes them off the booking page
 * and is one UPDATE to undo, where a delete is not. Verifies by RE-QUERYING,
 * because a write that reports success and did nothing is the failure mode that
 * costs the most here.
 *
 *   node scripts/_local/disable-stale-demo-services.mjs <tenantId> <keep,ids>
 */
import pg from 'pg'
import { execFileSync } from 'node:child_process'

const [tenantId, keepArg] = process.argv.slice(2)
if (!tenantId || !keepArg) {
  console.error('usage: disable-stale-demo-services.mjs <tenantId> <comma,separated,serviceIds-to-keep>')
  process.exit(1)
}
const keep = keepArg.split(',').map((s) => s.trim()).filter(Boolean)

// Read the connection string from Railway at run time rather than from a file.
// Production credentials belong in the process that needs them, not on disk.
const vars = JSON.parse(
  execFileSync('railway', ['variables', '-s', 'Postgres', '--json'], { encoding: 'utf8', shell: true }),
)

const client = new pg.Client({ connectionString: vars.DATABASE_PUBLIC_URL })
await client.connect()

const before = await client.query(
  'select service_id, label, enabled from services where tenant_id = $1 order by id',
  [tenantId],
)
console.log(`tenant ${tenantId}: ${before.rows.length} services`)

const stale = before.rows.filter((r) => !keep.includes(r.service_id) && r.enabled)
if (!stale.length) {
  console.log('nothing to disable')
} else {
  console.log('disabling:', stale.map((r) => r.label).join(', '))
  await client.query(
    'update services set enabled = false where tenant_id = $1 and service_id = any($2::text[])',
    [tenantId, stale.map((r) => r.service_id)],
  )
}

// Re-query. The response is not the evidence.
const after = await client.query(
  'select service_id, label, enabled from services where tenant_id = $1 order by id',
  [tenantId],
)
for (const r of after.rows) console.log(`  ${r.enabled ? 'ON ' : 'off'}  ${r.label}`)

const stillWrong = after.rows.filter((r) => !keep.includes(r.service_id) && r.enabled)
await client.end()
if (stillWrong.length) {
  console.error(`FAILED: ${stillWrong.length} stale services still enabled`)
  process.exit(1)
}
console.log(`ok — ${after.rows.filter((r) => r.enabled).length} enabled`)
