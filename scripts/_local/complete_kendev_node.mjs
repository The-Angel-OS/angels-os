/** Finish Node B: a Command Center space (CIC/comms) + tenant memberships. */
const BASE = 'https://federation.kendev.co'
const EMAIL = 'kenneth.courtney@gmail.com'
const PASSWORD = 'KendevTemp2026!'

const j = async (r) => { const t = await r.text(); try { return JSON.parse(t) } catch { return { _raw: t.slice(0, 200) } } }

const login = await fetch(`${BASE}/api/users/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
}).then(j)
if (!login.token) throw new Error('login failed: ' + JSON.stringify(login).slice(0, 150))
const H = { 'Content-Type': 'application/json', Authorization: `JWT ${login.token}` }
console.log('✓ logged in')

// tenant id
const tj = await fetch(`${BASE}/api/tenants?where[slug][equals]=kendev&limit=1&depth=0`, { headers: H }).then(j)
const tenantId = tj?.docs?.[0]?.id
console.log('tenant id:', tenantId)

// users
const uj = await fetch(`${BASE}/api/users?limit=20&depth=0`, { headers: H }).then(j)
const users = (uj?.docs || []).map((u) => ({ id: u.id, email: u.email }))
console.log('users:', JSON.stringify(users))

// 1) Command Center space (creates default channels)
console.log('\nCreating Command Center space…')
const sp = await fetch(`${BASE}/api/space-ops/create`, {
  method: 'POST', headers: H, body: JSON.stringify({ name: 'Command Center' }),
})
console.log('  space-create status', sp.status, JSON.stringify(await j(sp)).slice(0, 220))

// 2) Tenant memberships (active ⇒ hooks sync user.tenants + auto-join spaces)
console.log('\nLinking team memberships…')
for (const u of users) {
  const r = await fetch(`${BASE}/api/tenant-memberships`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ user: u.id, tenant: tenantId, role: 'tenant_admin', status: 'active' }),
  })
  console.log(`  ${u.email}: ${r.status}`)
}

console.log('\nDone.')
