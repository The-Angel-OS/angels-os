/**
 * Point a one-off script at PRODUCTION from a developer machine.
 *
 * Core's own DATABASE_URI is `pgbouncer.railway.internal`, which resolves only
 * inside Railway, so `railway run -s Core` alone gets you a script that cannot
 * connect. The Postgres service publishes a TCP proxy for exactly this; this
 * swaps it in and leaves every other variable alone, so media still lands in
 * the real bucket and Payload still uses the real secret.
 *
 * Secrets stay in the process. Nothing is written to disk -- an earlier attempt
 * that dumped the whole variable set to a .env file was refused, correctly.
 *
 *   railway run -s Core -- node src/scripts/_local/_prod.mjs <script.ts> [args]
 *
 * `railway run` supplies Core's environment; this only rewrites the one value
 * that cannot work from outside.
 */
import { execFileSync, spawnSync } from 'node:child_process'

const vars = JSON.parse(
  execFileSync('railway', ['variables', '-s', 'Postgres', '--json'], {
    encoding: 'utf8',
    shell: true,
  }),
)

const url = vars.DATABASE_PUBLIC_URL
if (!url) {
  console.error('Postgres service has no DATABASE_PUBLIC_URL — enable its TCP proxy first')
  process.exit(1)
}

const [script, ...rest] = process.argv.slice(2)
if (!script) {
  console.error('usage: _prod.mjs <script.ts|migrate|migrate:status> [args]')
  process.exit(1)
}

console.error(`[_prod] DATABASE_URI -> ${url.split('@')[1]}`)

const env = { ...process.env, DATABASE_URI: url }
delete env.DATABASE_SSL

// `migrate` and `migrate:status` are payload's own commands, not scripts to run.
// Worth supporting here because the ordering rule in CLAUDE.md -- prod columns
// BEFORE the deploy that selects them -- needs a way to migrate prod from a
// machine that is not prod, and the alternative is a deploy that boots, fails
// its healthcheck, and takes the site with it.
const isCommand = script === 'migrate' || script === 'migrate:status'
const args = isCommand ? [script, ...rest] : ['run', script, ...rest]

const r = spawnSync(
  'pnpm',
  ['exec', 'cross-env', 'NODE_OPTIONS=--no-deprecation', 'payload', ...args],
  { stdio: 'inherit', env, shell: true },
)
process.exit(r.status ?? 1)
