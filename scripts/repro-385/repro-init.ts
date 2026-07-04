/**
 * repro-init.ts — reproduce the Payload 3.85.1 prod init failure in isolation,
 * and capture the FULL init stack that Next 16 prod hides behind "Failed to handle /…".
 *
 * Context: the 0f8da7c (3.85.1) deploy built clean but 500'd EVERY route from request #1
 * (/, /admin, every /api/*) — the signature of a getPayload() init-time throw. Prod runs
 * with push OFF, so 3.85's startup against the drifted live `angels` schema throws at init.
 * Vercel runtime logs only show the generic wrapper. This script makes the throw happen
 * locally where we can read the stack.
 *
 * Two modes (run in this order, across two git checkouts — see README.md):
 *   seed   — push the CURRENT checkout's Payload schema into the scratch DB (push ON).
 *            Run while checked out at the 3.77 rollback (tag v3.77-rollback) so the scratch
 *            DB ends up shaped exactly like live `angels`.
 *   probe  — run getPayload() with push OFF against the scratch DB and print the thrown
 *            init error + full stack. Run while checked out at 3.85 (a864a9a / PR #133).
 *            If it throws, you've reproduced prod and the stack names the exact culprit.
 *
 * SAFETY: operates ONLY on the scratch DB (SCRATCH_DB, default `angelsdev2`). A hard guard
 * aborts if the resolved target DB name is `angels` (live prod) — this script can never
 * touch prod. Read-only on `angels` is never even attempted.
 *
 * Usage (from repo root, IONOS box):
 *   npx tsx scripts/repro-385/repro-init.ts seed
 *   npx tsx scripts/repro-385/repro-init.ts probe
 *
 * Env (loaded from .env.local then .env, same as scripts/dev-with-env.mjs):
 *   DATABASE_URI / DATABASE_URL  — base connection string (its db-name is swapped out)
 *   DATABASE_SSL=require         — honored (matches prod/pooler)
 *   SCRATCH_DB=angelsdev2        — override the scratch db name if you like
 */
import { config as loadEnv } from 'dotenv'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { writeFileSync } from 'fs'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..', '..')

loadEnv({ path: path.join(root, '.env.local') })
loadEnv({ path: path.join(root, '.env') })

const PROD_DB = 'angels' // the live database — NEVER allowed as a target here
const scratchDb = process.env.SCRATCH_DB || 'angelsdev2'

const mode = process.argv[2]
if (mode !== 'seed' && mode !== 'probe') {
  console.error('Usage: npx tsx scripts/repro-385/repro-init.ts <seed|probe>')
  process.exit(1)
}

const baseUri = process.env.DATABASE_URI || process.env.DATABASE_URL || ''
if (!baseUri) {
  console.error('ERROR: DATABASE_URI/DATABASE_URL not set (check .env.local / .env).')
  process.exit(1)
}

// --- swap the db name in the connection string to the scratch db, with a hard guard ---
function withDbName(uri: string, dbName: string): string {
  const u = new URL(uri)
  u.pathname = '/' + dbName
  return u.toString()
}
function dbNameOf(uri: string): string {
  return new URL(uri).pathname.replace(/^\//, '')
}

if (scratchDb === PROD_DB) {
  console.error(`REFUSING: SCRATCH_DB resolves to "${PROD_DB}" (live prod). Aborting.`)
  process.exit(1)
}

const scratchUri = withDbName(baseUri, scratchDb)
if (dbNameOf(scratchUri) === PROD_DB) {
  console.error('REFUSING: resolved scratch URI points at live prod. Aborting.')
  process.exit(1)
}

// point Payload's config at the scratch db BEFORE we import the config module
process.env.DATABASE_URI = scratchUri
process.env.DATABASE_URL = scratchUri
// never let any inherited prod flag flip behavior unexpectedly
delete process.env.VERCEL

const ssl =
  process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: false } : undefined

async function ensureScratchDbExists() {
  // connect to the EXISTING angelsdev db (known to exist on this server) to issue CREATE DATABASE
  const adminUri = withDbName(baseUri, 'angelsdev')
  const client = new pg.Client({ connectionString: adminUri, ssl })
  await client.connect()
  try {
    const { rows } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      scratchDb,
    ])
    if (rows.length === 0) {
      console.log(`[seed] creating scratch database "${scratchDb}"…`)
      await client.query(`CREATE DATABASE "${scratchDb}"`)
    } else {
      console.log(`[seed] scratch database "${scratchDb}" already exists — reusing.`)
    }
  } finally {
    await client.end()
  }
}

async function run() {
  console.log(`mode=${mode}  scratchDb=${scratchDb}  ssl=${ssl ? 'on' : 'off'}`)

  if (mode === 'seed') {
    // push ON: leave PAYLOAD_SKIP_PUSH unset and NODE_ENV non-production so dev push runs
    delete process.env.PAYLOAD_SKIP_PUSH
    if (process.env.NODE_ENV === 'production') process.env.NODE_ENV = 'development'
    await ensureScratchDbExists()
  } else {
    // probe: push OFF — exactly reproduce prod's init behavior
    process.env.PAYLOAD_SKIP_PUSH = 'true'
  }

  // import AFTER env is finalized so buildConfig sees the scratch connection + push flag
  const { getPayload } = await import('payload')
  try {
    const pv = await import(pathToFileURL(path.join(root, 'node_modules', 'payload', 'package.json')).href, { with: { type: 'json' } } as any)
    console.log(`[${mode}] payload version in use: ${(pv as any).default?.version ?? (pv as any).version}`)
  } catch { /* best effort */ }
  console.log(`[${mode}] PAYLOAD_SKIP_PUSH=${process.env.PAYLOAD_SKIP_PUSH}  DB=${dbNameOf(process.env.DATABASE_URI || '')}`)
  // payload.config default export is the buildConfig promise
  const configModule = await import(pathToFileURL(path.join(root, 'src', 'payload.config.ts')).href)
  const config = configModule.default

  try {
    console.log(`[${mode}] initializing Payload (this is the step that throws on prod)…`)
    await getPayload({ config })
    if (mode === 'seed') {
      console.log(`[seed] ✅ schema pushed to "${scratchDb}". Now checkout 3.85 and run probe.`)
    } else {
      console.log(
        `[probe] ⚠️ Payload INITIALIZED WITHOUT THROWING against the 3.77-shaped schema.\n` +
          `        That means the outage is NOT a pure init-validation throw — re-check:\n` +
          `        was the scratch DB actually seeded from 3.77 code? Is push truly off?\n` +
          `        (Confirm with: this run had PAYLOAD_SKIP_PUSH=true.)`,
      )
    }
    process.exit(0)
  } catch (err: any) {
    const stack = err?.stack || String(err)
    const out = path.join(__dirname, `init-error-${mode}.txt`)
    const body =
      `Payload init ${mode} error against ${scratchDb}\n` +
      `=================================================\n` +
      `message: ${err?.message ?? '(none)'}\n\n` +
      `stack:\n${stack}\n\n` +
      `cause:\n${err?.cause ? (err.cause.stack || String(err.cause)) : '(none)'}\n`
    writeFileSync(out, body)
    console.error('\n================ CAPTURED INIT ERROR ================\n')
    console.error(body)
    console.error(`(also written to ${out})`)
    process.exit(2)
  }
}

run().catch((e) => {
  console.error('unexpected:', e)
  process.exit(3)
})
