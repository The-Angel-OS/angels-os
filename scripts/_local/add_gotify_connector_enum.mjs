// Adds 'gotify' to the connectors.type enum on a target DB. Idempotent.
// Schema-discipline rule: enum value must exist in prod BEFORE deploy.
// Usage: node scripts/_local/add_gotify_connector_enum.mjs <kendev|angels>
import { config as dotenv } from 'dotenv'
import path from 'path'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { Client } = require(path.join(process.cwd(), 'node_modules/.pnpm/pg@8.16.3/node_modules/pg'))
dotenv({ path: '.env.local' }); dotenv({ path: '.env' })

const target = process.argv[2] || 'kendev'
const uri = process.env.DATABASE_URI.replace(/\/(kendev|angels)(\b|\?|$)/, `/${target}$2`)
const dbName = uri.match(/\/([^/?]+)(\?|$)/)[1]
const ENUM = 'enum_connectors_type'
const VALUE = 'gotify'

const listValues = async (client) => {
  const { rows } = await client.query(
    `SELECT e.enumlabel AS v FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = $1 ORDER BY e.enumsortorder`,
    [ENUM],
  )
  return rows.map((r) => r.v)
}

const run = async () => {
  const client = new Client({ connectionString: uri })
  await client.connect()
  try {
    const before = await listValues(client)
    if (before.length === 0) {
      console.error(`[${dbName}] ⚠ enum ${ENUM} not found — is this the right DB?`)
      process.exitCode = 1
      return
    }
    if (before.includes(VALUE)) {
      console.log(`[${dbName}] '${VALUE}' already present. Values: ${before.join(', ')}`)
      return
    }
    // ADD VALUE cannot run in a transaction block; pg autocommits single statements.
    await client.query(`ALTER TYPE ${ENUM} ADD VALUE IF NOT EXISTS '${VALUE}'`)
    const after = await listValues(client)
    console.log(`[${dbName}] ✓ added '${VALUE}'. Values: ${after.join(', ')}`)
  } finally {
    await client.end()
  }
}

run().catch((e) => { console.error(e); process.exitCode = 1 })
