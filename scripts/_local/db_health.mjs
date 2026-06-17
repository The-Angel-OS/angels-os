import { config } from 'dotenv'; import path from 'path'; import { fileURLToPath } from 'url'; import pg from 'pg'
const __dirname = path.dirname(fileURLToPath(import.meta.url)); const root = path.resolve(__dirname,'..','..')
config({ path: path.join(root,'.env.local') }); config({ path: path.join(root,'.env') })
const u = new URL(process.env.DATABASE_URI||process.env.DATABASE_URL); u.pathname='/angels'
const c = new pg.Client({ connectionString:u.toString(), ssl:false }); await c.connect()
try {
  const mx = (await c.query('SHOW max_connections')).rows[0].max_connections
  const tot = (await c.query('SELECT count(*)::int n FROM pg_stat_activity')).rows[0].n
  const byDb = await c.query(`SELECT datname, count(*)::int n, count(*) FILTER (WHERE state='active')::int active, count(*) FILTER (WHERE state='idle')::int idle FROM pg_stat_activity WHERE datname IS NOT NULL GROUP BY datname ORDER BY n DESC`)
  console.log(`max_connections=${mx}  total_in_use=${tot}`)
  for (const r of byDb.rows) console.log(`  ${r.datname}: total=${r.n} active=${r.active} idle=${r.idle}`)
  const longest = await c.query(`SELECT datname, state, now()-query_start AS dur, left(query,80) q FROM pg_stat_activity WHERE state<>'idle' AND query_start IS NOT NULL ORDER BY query_start ASC LIMIT 5`)
  console.log('oldest non-idle:')
  for (const r of longest.rows) console.log(`  ${r.datname} ${r.state} ${r.dur} :: ${r.q}`)
  // quick sanity query on a key table
  const t0=Date.now(); await c.query('SELECT count(*) FROM tenants'); console.log('tenants count query ms:', Date.now()-t0)
} catch(e){ console.error('HEALTH PROBE FAILED:', e.message) } finally { await c.end() }
