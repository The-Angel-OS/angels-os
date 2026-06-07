/**
 * One-shot: provision Node B (federation.kendev.co) end-to-end over its own HTTP
 * API — create the first super-admin, log in, and provision the Kendev portal
 * enterprise. Touches ONLY Node B (kendev DB) via HTTPS; never prod.
 */
const BASE = 'https://federation.kendev.co'
const EMAIL = 'kenneth.courtney@gmail.com'
const PASSWORD = 'KendevTemp2026!' // temporary — change / link Google after first login
const TARGET_COMMIT = '81af6a1'

const PORTAL = {
  name: 'Angel OS · Kendev',
  slug: 'kendev',
  domain: 'federation.kendev.co',
  tagline: 'Secondary Command Center — Angel OS Federation Node',
  primaryColor: '#7AB5B0',
  secondaryColor: '#9B8EC4',
  endeavorType: 'creator-content',
  missionStatement: 'A sovereign command center and federation peer in the Angel OS network.',
}

const j = async (res) => {
  const t = await res.text()
  try {
    return JSON.parse(t)
  } catch {
    return { _raw: t.slice(0, 300) }
  }
}

async function waitForDeploy() {
  for (let i = 1; i <= 16; i++) {
    try {
      const r = await fetch(`${BASE}/api/debug/connectivity`, { cache: 'no-store' })
      const d = await j(r)
      if (d?.node?.commit === TARGET_COMMIT && d?.database) {
        console.log(`✓ deploy live (commit ${d.node.commit}, db ${d.database}, data ${d.data})`)
        return d
      }
      console.log(`  waiting for deploy ${TARGET_COMMIT}… (have ${d?.node?.commit ?? '?'})`)
    } catch (e) {
      console.log('  probe error:', e.message)
    }
    await new Promise((r) => setTimeout(r, 15000))
  }
  throw new Error('deploy did not become live in time')
}

async function createFirstUser() {
  let res = await fetch(`${BASE}/api/users/first-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: 'Kenneth' }),
  })
  let body = await j(res)
  if (res.ok) return { created: true, body }
  // Fallbacks: maybe first-register route differs, or user already exists
  if (res.status === 404) {
    res = await fetch(`${BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: 'Kenneth' }),
    })
    body = await j(res)
    if (res.ok) return { created: true, body }
  }
  return { created: false, status: res.status, body }
}

async function login() {
  const res = await fetch(`${BASE}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const body = await j(res)
  if (!res.ok || !body.token) throw new Error(`login failed (${res.status}): ${JSON.stringify(body).slice(0, 200)}`)
  return body.token
}

async function provision(token) {
  const res = await fetch(`${BASE}/api/provision-ops/portal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
    body: JSON.stringify(PORTAL),
  })
  return { status: res.status, body: await j(res) }
}

// Additional operators on Node B — created via the super-admin token. Temp
// passwords; each links their Google account on first login. (Their existing
// passwords can be copied from `angels` later if they'd rather keep them.)
const EXTRA_USERS = [
  { email: 'clearwatercruisin@gmail.com', name: 'Clearwater Cruisin' },
  { email: 'tylersuzanne84@gmail.com', name: 'Tyler' },
]

async function createUser(token, email, name) {
  const res = await fetch(`${BASE}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
    body: JSON.stringify({ email, password: PASSWORD, name, roles: ['super_admin'] }),
  })
  const body = await j(res)
  return { ok: res.ok, status: res.status, body }
}

console.log('=== Provisioning Node B (federation.kendev.co) ===')
await waitForDeploy()

console.log('\n1) Create first super-admin…')
const u = await createFirstUser()
if (u.created) console.log(`   ✓ user created: ${EMAIL} (roles should include super_admin)`)
else console.log(`   • create returned ${u.status} — ${JSON.stringify(u.body).slice(0, 180)} (continuing to login)`)

console.log('\n2) Log in…')
const token = await login()
console.log('   ✓ logged in, token acquired')

console.log('\n3) Provision the Kendev portal…')
const p = await provision(token)
console.log(`   status ${p.status}`)
console.log('   ' + JSON.stringify(p.body, null, 2).split('\n').join('\n   '))

console.log('\n4) Create the other operators…')
for (const eu of EXTRA_USERS) {
  const r = await createUser(token, eu.email, eu.name)
  if (r.ok) console.log(`   ✓ ${eu.email} created (super_admin)`)
  else console.log(`   • ${eu.email}: ${r.status} — ${JSON.stringify(r.body).slice(0, 160)}`)
}

console.log('\n=== Done. Sign in at https://federation.kendev.co/admin ===')
console.log('   Accounts (all temp password — change / link Google after login):')
console.log(`     ${EMAIL}`)
for (const eu of EXTRA_USERS) console.log(`     ${eu.email}`)
console.log(`   temp password (all): ${PASSWORD}`)
