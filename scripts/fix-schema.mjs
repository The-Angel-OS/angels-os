import { getPayload } from 'payload'
import { loadEnv } from 'payload/node'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
loadEnv(path.resolve(__dirname, '..'))

// Dynamically import the Payload config
const configModule = await import('../src/payload.config.ts')
const config = configModule.default

const payload = await getPayload({ config })

// Use the drizzle adapter to execute raw SQL
const db = payload.db
const drizzle = db.drizzle

console.log('Fixing content column type...')
try {
  await drizzle.execute({sql: 'ALTER TABLE messages ALTER COLUMN content TYPE jsonb USING content::jsonb'})
  console.log('  content column fixed')
} catch (e) {
  console.log('  (already fixed or not needed)')
}

console.log('\nSchema fix complete. Now run seed:reset again.')
process.exit(0)
