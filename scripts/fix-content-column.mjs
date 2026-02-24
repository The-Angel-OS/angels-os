/**
 * Fix messages.content column type from text to jsonb.
 * Must run BEFORE Payload init since Drizzle pushDevSchema can't auto-cast.
 */
import { loadEnv } from 'payload/node'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
loadEnv(path.resolve(__dirname, '..'))

// Resolve pg from pnpm's hoisted location
const require = createRequire(
  path.resolve(__dirname, '../node_modules/.pnpm/pg@8.16.3/node_modules/pg/package.json')
)
const pg = require('./lib/index.js')

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URI || process.env.DATABASE_URL,
})

const client = await pool.connect()
try {
  console.log('Fixing messages.content column type (text -> jsonb)...')
  await client.query(
    'ALTER TABLE messages ALTER COLUMN content TYPE jsonb USING content::jsonb',
  )
  console.log('  Done!')
} catch (e) {
  console.log('  Result:', e.message)
} finally {
  client.release()
  await pool.end()
}
