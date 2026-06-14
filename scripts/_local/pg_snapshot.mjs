// pg_snapshot — the reversibility floor (LEO capability ladder rung 4).
//
// "Snapshot before any schema- or data-touching change." A one-command pg_dump of
// a prod DB to a timestamped, restorable custom-format archive — the Postgres analog
// of MSSQL `BACKUP DATABASE`, and the save-point discipline Kenneth asked for.
//
//   node scripts/_local/pg_snapshot.mjs               # snapshot kendev (DATABASE_URI)
//   node scripts/_local/pg_snapshot.mjs angels        # snapshot the angels DB
//   node scripts/_local/pg_snapshot.mjs both pre-sig  # both DBs, labeled "pre-sig"
//
// Restore (when you must roll back):
//   pg_restore --clean --if-exists --dbname="<uri>" _snapshots/<file>.dump
//
// Needs the pg_dump binary on PATH (Postgres client tools). Fails with a clear
// install hint if missing. Writes to ./_snapshots (gitignored).
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

function readUri() {
  if (process.env.DATABASE_URI) return process.env.DATABASE_URI
  const line = fs.readFileSync('.env', 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URI='))
  if (!line) throw new Error('DATABASE_URI not found in env or .env')
  return line.split('=').slice(1).join('=').replace(/^["']|["'\r]$/g, '')
}

const args = process.argv.slice(2)
const targetArg = (args[0] || 'kendev').toLowerCase()
const label = (args[1] || '').replace(/[^a-z0-9_-]/gi, '')

const kendev = readUri()
const angels = kendev.replace('/kendev', '/angels')
const dbName = (uri) => (uri.match(/\/([^/?]+)(\?|$)/) || [])[1] || 'db'

const targets =
  targetArg === 'both' ? [['kendev', kendev], ['angels', angels]]
  : targetArg === 'angels' ? [['angels', angels]]
  : [['kendev', kendev]]

const outDir = path.resolve(process.cwd(), '_snapshots')
fs.mkdirSync(outDir, { recursive: true })

// Timestamp: YYYYMMDD-HHMMSS (local). Date.now ok here — plain script, not a workflow.
const d = new Date()
const z = (n) => String(n).padStart(2, '0')
const stamp = `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`

function dumpOne(name, uri) {
  return new Promise((resolve) => {
    const file = path.join(outDir, `${dbName(uri)}-${stamp}${label ? `-${label}` : ''}.dump`)
    const proc = spawn('pg_dump', ['-Fc', '--no-owner', '--no-privileges', '-f', file, uri], {
      stdio: ['ignore', 'inherit', 'inherit'],
    })
    proc.on('error', (err) => {
      if (err.code === 'ENOENT') {
        console.error(
          `\n[${name}] pg_dump not found on PATH. Install the Postgres client tools:\n` +
            `  Windows: install PostgreSQL (or just the command-line tools), then add its \\bin to PATH\n` +
            `  macOS:   brew install libpq && brew link --force libpq\n` +
            `  Linux:   apt-get install postgresql-client\n`,
        )
      } else {
        console.error(`[${name}] pg_dump error:`, err.message)
      }
      resolve(false)
    })
    proc.on('close', (code) => {
      if (code === 0) {
        const mb = (fs.statSync(file).size / 1024 / 1024).toFixed(1)
        console.log(`[${name}] ✓ ${file} (${mb} MB)`)
        resolve(true)
      } else {
        console.error(`[${name}] pg_dump exited ${code}`)
        resolve(false)
      }
    })
  })
}

let ok = true
for (const [name, uri] of targets) {
  // eslint-disable-next-line no-await-in-loop
  const r = await dumpOne(name, uri)
  ok = ok && r
}
console.log(ok ? 'snapshot complete' : 'snapshot finished with errors')
process.exit(ok ? 0 : 1)
