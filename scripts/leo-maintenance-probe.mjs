/**
 * leo-maintenance-probe.mjs — exercise the LEO maintenance loop against prod.
 *
 * Mirrors mcp-server/index.ts auth: mint a session-backed JWT from PAYLOAD_SECRET
 * via /api/auth/system-token, then ask LEO (via /api/leo) to perform its
 * maintenance role (a SUBSAFE / health diagnostic). Prints LEO's reply so we can
 * see (a) success, or (b) the errors LEO surfaces — proving the ask→do→report loop.
 *
 * Run:
 *   node scripts/leo-maintenance-probe.mjs --tenant=clearwater-cruisin [--url=https://clearwater-cruisin.spacesangels.com]
 */
import 'dotenv/config'
import crypto from 'node:crypto'

const arg = (name, fallback = '') => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const TENANT = arg('tenant', 'clearwater-cruisin')
const BASE_URL = arg('url', `https://${TENANT}.spacesangels.com`)
const MESSAGE = arg(
  'message',
  'Maintenance request: run a full SUBSAFE / system health check for this endeavor. ' +
    'Report status of orders, inventory, content, connectors, federation, and any errors in the application log. ' +
    'If everything is healthy say so plainly; if not, list each problem with its error-log detail.',
)

async function mintToken() {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) throw new Error('PAYLOAD_SECRET not in env')
  const secretHash = crypto.createHash('sha256').update(secret).digest('hex').slice(0, 32)
  const res = await fetch(`${BASE_URL}/api/auth/system-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secretHash, tenantSlug: TENANT }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`system-token ${res.status}: ${text.slice(0, 300)}`)
  const data = JSON.parse(text)
  console.log(`auth: ${data.user?.email} (expires ${data.expiresAt})`)
  return data.token
}

async function askLeo(token) {
  const t0 = Date.now()
  const res = await fetch(`${BASE_URL}/api/leo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-tenant-id': TENANT },
    body: JSON.stringify({ message: MESSAGE, channelSlug: 'leo' }),
  })
  const text = await res.text()
  const ms = Date.now() - t0
  let data
  try { data = JSON.parse(text) } catch { data = { _raw: text } }
  console.log(`\nLEO responded in ${(ms / 1000).toFixed(1)}s (HTTP ${res.status})`)
  console.log('agent:', data.agentName || data.agent || '(unknown)')
  console.log('conversationId:', data.conversationId || '(none)')
  if (data.toolsUsed || data.tools) console.log('tools used:', JSON.stringify(data.toolsUsed || data.tools))
  console.log('\n--- LEO reply ---\n')
  console.log(data.text || data.response || data.error || JSON.stringify(data, null, 2).slice(0, 4000))
}

async function main() {
  console.log(`target: ${BASE_URL}  tenant: ${TENANT}`)
  const token = await mintToken()
  await askLeo(token)
}
main().catch((e) => { console.error('\nPROBE FAILED:', e.message); process.exit(1) })
