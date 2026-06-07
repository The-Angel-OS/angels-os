/** Trigger federation first-contact on both nodes, then we verify via DB. */
import fs from 'node:fs'
import path from 'node:path'

for (const f of ['.env.local', '.env']) {
  try {
    const txt = fs.readFileSync(path.join(process.cwd(), f), 'utf8')
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {}
}
const PROD_CRON = (process.env.CRON_SECRET || '').trim()
const NODE_B = 'https://federation.kendev.co'
const NODE_A = 'https://www.spacesangels.com'
const TARGET_COMMIT = 'd1a4532'

const j = async (r) => { const t = await r.text(); try { return JSON.parse(t) } catch { return { _raw: t.slice(0, 200) } } }

async function waitDeploy(base) {
  for (let i = 0; i < 18; i++) {
    try {
      const d = await fetch(`${base}/api/debug/connectivity`, { cache: 'no-store' }).then(j)
      if (d?.node?.commit === TARGET_COMMIT) { console.log(`  ${base} live @ ${TARGET_COMMIT}`); return true }
      console.log(`  ${base} has ${d?.node?.commit ?? '?'}, waiting…`)
    } catch (e) { console.log('  probe err', e.message) }
    await new Promise((r) => setTimeout(r, 15000))
  }
  return false
}

console.log('Waiting for deploys…')
await waitDeploy(NODE_B)
await waitDeploy(NODE_A)

// Node B — bootstrap via super-admin token
console.log('\nNode B bootstrap (super-admin)…')
const login = await fetch(`${NODE_B}/api/users/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'kenneth.courtney@gmail.com', password: 'KendevTemp2026!' }),
}).then(j)
if (login.token) {
  const r = await fetch(`${NODE_B}/api/federation/bootstrap`, { method: 'POST', headers: { Authorization: `JWT ${login.token}` } }).then(j)
  console.log('  ', JSON.stringify(r))
} else console.log('  login failed:', JSON.stringify(login).slice(0, 150))

// Node A — bootstrap via prod CRON_SECRET key
console.log('\nNode A bootstrap (cron key)…')
if (PROD_CRON) {
  const r = await fetch(`${NODE_A}/api/federation/bootstrap?key=${encodeURIComponent(PROD_CRON)}`, { method: 'POST' }).then(j)
  console.log('  ', JSON.stringify(r))
} else console.log('  no CRON_SECRET locally')

console.log('\nDone.')
