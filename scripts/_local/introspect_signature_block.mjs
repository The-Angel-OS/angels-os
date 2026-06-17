import 'dotenv/config'
process.env.PAYLOAD_SKIP_PUSH = 'true'
import { getPayload } from 'payload'
import config from '../../src/payload.config.ts'
import { getTableColumns } from 'drizzle-orm'

const payload = await getPayload({ config })
const tables = payload.db.tables
const names = Object.keys(tables).filter((n) => n.toLowerCase().includes('signature'))
console.log('matching tables:', names)
for (const n of names) {
  const cols = getTableColumns(tables[n])
  console.log(`\n=== ${n} ===`)
  for (const [k, c] of Object.entries(cols)) {
    console.log(`  ${c.name}  type=${c.columnType}  notNull=${c.notNull}  default=${c.hasDefault ? JSON.stringify(c.default) : '-'}  primary=${c.primary || false}`)
  }
}
process.exit(0)
