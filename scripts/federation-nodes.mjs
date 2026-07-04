/**
 * federation-nodes.mjs — read the live federation roster the health check counts,
 * to find the phantom/stale node records (SUBSAFE counted 4; only 2 are real).
 *
 * Mints a system token (like the MCP server) and queries the FederationPeers
 * collection + /api/federation/pulse via authed REST. Read-only.
 */
import 'dotenv/config'
import crypto from 'node:crypto'

const arg = (n, d = '') => { const h = process.argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d }
const TENANT = arg('tenant', 'clearwater-cruisin')
const BASE_URL = arg('url', `https://${TENANT}.spacesangels.com`)

async function mintToken() {
  const secret = process.env.PAYLOAD_SECRET
  const secretHash = crypto.createHash('sha256').update(secret).digest('hex').slice(0, 32)
  const res = await fetch(`${BASE_URL}/api/auth/system-token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secretHash, tenantSlug: TENANT }),
  })
  if (!res.ok) throw new Error(`system-token ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return (await res.json()).token
}

async function get(token, path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, 'x-tenant-id': TENANT },
  })
  const text = await res.text()
  try { return { status: res.status, json: JSON.parse(text) } } catch { return { status: res.status, raw: text.slice(0, 300) } }
}

async function main() {
  console.log(`target: ${BASE_URL}`)
  const token = await mintToken()

  // The FederationPeers roster (depth 1 to resolve endeavors).
  const peers = await get(token, '/api/federation-peers?limit=100&depth=1')
  const docs = peers.json?.docs || []
  console.log(`\n== federation-peers: ${peers.json?.totalDocs ?? docs.length} record(s) (HTTP ${peers.status}) ==`)
  for (const p of docs) {
    const endeavors = Array.isArray(p.endeavors) ? p.endeavors.length : 0
    console.log(`- id=${p.id} name=${p.name || p.slug || '?'} domain=${p.domain || p.origin || '?'} status=${p.status || '?'} lastSeen=${p.lastSeen || p.lastHeartbeat || p.updatedAt || '?'} endeavors=${endeavors} federationId=${(p.federationId || '').slice(0, 16)}`)
  }

  // Pulse = the live health view SUBSAFE summarizes.
  const pulse = await get(token, '/api/federation/pulse')
  console.log(`\n== /api/federation/pulse (HTTP ${pulse.status}) ==`)
  console.log(JSON.stringify(pulse.json ?? pulse.raw, null, 2).slice(0, 3000))
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
