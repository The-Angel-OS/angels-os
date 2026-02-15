// Direct SQL utility to drop UNIQUE slug indexes for multi-tenancy.
// Skips Payload migration system entirely — just run: node scripts/drop-unique-slugs.cjs
//
// In a multi-tenant system, different tenants can have the same slug
// (e.g. "general" channel). URL routing disambiguates by tenant/domain.
const path = require('path')
const { Client } = require(path.join(__dirname, '..', 'node_modules', '.pnpm', 'pg@8.16.3', 'node_modules', 'pg'))

const DB_URL = process.env.DATABASE_URI || 'postgresql://postgres:K3nD3v!host@74.208.87.243:5432/angels'
const client = new Client(DB_URL)

async function main() {
  await client.connect()
  console.log('Connected to database')

  // Check current indexes
  const res = await client.query(`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE tablename IN ('channels', 'spaces', 'pages', 'categories', 'products')
    AND indexname LIKE '%slug%'
    ORDER BY tablename, indexname
  `)
  console.log('Current slug indexes:')
  for (const row of res.rows) {
    console.log(`  ${row.indexname}: ${row.indexdef}`)
  }

  // Drop unique indexes and recreate as non-unique
  const tables = ['channels', 'spaces', 'pages', 'categories', 'products']
  for (const table of tables) {
    const idxName = `${table}_slug_idx`
    console.log(`\nProcessing ${idxName}...`)
    await client.query(`DROP INDEX IF EXISTS "${idxName}"`)
    await client.query(`CREATE INDEX IF NOT EXISTS "${idxName}" ON "${table}" USING btree ("slug")`)
    console.log(`  Done - recreated as non-unique`)
  }

  // Verify
  const verify = await client.query(`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE tablename IN ('channels', 'spaces', 'pages', 'categories', 'products')
    AND indexname LIKE '%slug%'
    ORDER BY tablename, indexname
  `)
  console.log('\nVerification - updated indexes:')
  for (const row of verify.rows) {
    const isUnique = row.indexdef.includes('UNIQUE') ? 'STILL UNIQUE' : 'non-unique OK'
    console.log(`  ${row.indexname}: ${isUnique}`)
  }

  await client.end()
  console.log('\nDone!')
}

main().catch(e => { console.error(e); process.exit(1) })
