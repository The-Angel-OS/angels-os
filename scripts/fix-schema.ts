/**
 * Quick schema fix script — adds missing columns to the shared database.
 * Run with: npx tsx scripts/fix-schema.ts
 */
// @ts-ignore — pg is a transitive dependency of @payloadcms/db-postgres
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const pg = require('pg')

const DATABASE_URI = process.env.DATABASE_URI || 'postgresql://postgres:K3nD3v!host@74.208.87.243:5432/angels'

async function main() {
  const client = new pg.Client(DATABASE_URI)
  await client.connect()
  console.log('Connected to database.')

  // Check current messages columns
  const msgCols = (await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'messages' ORDER BY ordinal_position`
  )).rows.map((r: Record<string, unknown>) => r.column_name as string)
  console.log('Messages columns:', msgCols.join(', '))

  // Check current channels columns
  const chCols = (await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'channels' ORDER BY ordinal_position`
  )).rows.map((r: Record<string, unknown>) => r.column_name as string)
  console.log('Channels columns:', chCols.join(', '))

  // Check content type
  const contentType = (await client.query(
    `SELECT data_type FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'content'`
  )).rows[0]?.data_type
  console.log('Messages.content type:', contentType)

  const statements: string[] = []

  // Messages: add missing columns
  if (!msgCols.includes('visibility'))
    statements.push(`ALTER TABLE messages ADD COLUMN visibility varchar DEFAULT 'tenant'`)
  if (!msgCols.includes('priority'))
    statements.push(`ALTER TABLE messages ADD COLUMN priority varchar DEFAULT 'normal'`)
  if (!msgCols.includes('status'))
    statements.push(`ALTER TABLE messages ADD COLUMN status varchar DEFAULT 'active'`)
  if (!msgCols.includes('metadata'))
    statements.push(`ALTER TABLE messages ADD COLUMN metadata jsonb`)
  if (!msgCols.includes('parent_message_id'))
    statements.push(`ALTER TABLE messages ADD COLUMN parent_message_id integer`)
  if (!msgCols.includes('federation_id'))
    statements.push(`ALTER TABLE messages ADD COLUMN federation_id varchar`)

  // Convert content from varchar to jsonb if needed
  if (contentType === 'character varying') {
    statements.push(`ALTER TABLE messages ALTER COLUMN content TYPE jsonb USING CASE WHEN content IS NULL THEN NULL WHEN content::text ~ '^[{\\[]' THEN content::jsonb ELSE jsonb_build_object('type', 'text', 'text', content) END`)
  }

  // Channels: add missing columns
  if (!chCols.includes('data'))
    statements.push(`ALTER TABLE channels ADD COLUMN data jsonb`)
  if (!chCols.includes('widgets'))
    statements.push(`ALTER TABLE channels ADD COLUMN widgets jsonb`)
  if (!chCols.includes('data_version'))
    statements.push(`ALTER TABLE channels ADD COLUMN data_version numeric DEFAULT 0`)

  // Drop NOT NULL on author_id (system messages may not have an author)
  statements.push(`ALTER TABLE messages ALTER COLUMN author_id DROP NOT NULL`)

  console.log(`\n${statements.length} statements to run:\n`)

  for (const sql of statements) {
    const display = sql.length > 100 ? sql.substring(0, 100) + '...' : sql
    process.stdout.write(`  ${display} ... `)
    try {
      await client.query(sql)
      console.log('✓')
    } catch (e: any) {
      console.log(`⚠ ${e.message.substring(0, 80)}`)
    }
  }

  console.log('\nDone! Schema updated.')
  await client.end()
}

main().catch(e => { console.error(e); process.exit(1) })
