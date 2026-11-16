import fs from 'fs'
import path from 'path'
import pg from 'pg'

const { Client } = pg

const databaseUri = process.env.DATABASE_URI
if (!databaseUri) {
  console.error('DATABASE_URI environment variable is not set.')
  process.exit(1)
}

const client = new Client({
  connectionString: databaseUri,
  ssl: databaseUri.includes('localhost') ? false : { rejectUnauthorized: false },
})

await client.connect()
console.log('Connected to PostgreSQL database.')

const backupDir = path.resolve(process.cwd(), 'backups')
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true })
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const backupFile = path.join(backupDir, `angel-os-prod-backup-${timestamp}.sql`)
const writeStream = fs.createWriteStream(backupFile, { flags: 'w' })

writeStream.write(`-- Angel OS Production Database Backup\n`)
writeStream.write(`-- Timestamp: ${new Date().toISOString()}\n`)
writeStream.write(`-- Database: ${databaseUri.split('@')[1] || 'railway'}\n\n`)
writeStream.write(`SET statement_timeout = 0;\n`)
writeStream.write(`SET client_encoding = 'UTF8';\n`)
writeStream.write(`SET standard_conforming_strings = on;\n\n`)

// Get all tables in public schema
const tablesRes = await client.query(`
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
  ORDER BY table_name;
`)

const tables = tablesRes.rows.map((r) => r.table_name)
console.log(`Found ${tables.length} tables in public schema. Exporting data...`)

let totalRowsExported = 0

for (const table of tables) {
  // Quote table name
  const qTable = `"${table}"`
  const countRes = await client.query(`SELECT count(*) as count FROM ${qTable}`)
  const count = parseInt(countRes.rows[0].count, 10)
  totalRowsExported += count

  writeStream.write(`-- Table: ${qTable} (${count} rows)\n`)

  if (count === 0) {
    writeStream.write(`\n`)
    continue
  }

  // Fetch rows
  const rowsRes = await client.query(`SELECT * FROM ${qTable}`)
  const columns = rowsRes.fields.map((f) => `"${f.name}"`).join(', ')

  for (const row of rowsRes.rows) {
    const values = rowsRes.fields.map((f) => {
      const val = row[f.name]
      if (val === null || val === undefined) return 'NULL'
      if (typeof val === 'number' || typeof val === 'boolean') return String(val)
      if (val instanceof Date) return `'${val.toISOString()}'`
      if (typeof val === 'object') {
        const jsonStr = JSON.stringify(val).replace(/'/g, "''")
        return `'${jsonStr}'::jsonb`
      }
      const strVal = String(val).replace(/'/g, "''")
      return `'${strVal}'`
    })

    writeStream.write(`INSERT INTO ${qTable} (${columns}) VALUES (${values.join(', ')});\n`)
  }
  writeStream.write(`\n`)
  console.log(`  Exported ${table}: ${count} rows`)
}

writeStream.end()
await client.end()

console.log(`\n✅ Backup complete!`)
console.log(`Total rows exported: ${totalRowsExported}`)
console.log(`Backup file saved to: ${backupFile}`)
console.log(`File size: ${(fs.statSync(backupFile).size / 1024 / 1024).toFixed(2)} MB`)
