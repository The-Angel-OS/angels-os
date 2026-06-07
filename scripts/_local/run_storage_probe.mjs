process.env.PAYLOAD_SKIP_PUSH = 'true'
import { config as dotenv } from 'dotenv'
dotenv({ path: '.env.local' }); dotenv({ path: '.env' })
process.env.PAYLOAD_SKIP_PUSH = 'true'
const { getPayload } = await import('payload')
const { default: config } = await import('../../src/payload.config.ts')
const payload = await getPayload({ config })
const { costStorageProbeHandler } = await import('../../src/endpoints/cost-storage-probe.ts')

// Minimal req: super_admin user + URL/header stubs
const req = {
  payload,
  user: { id: 1, roles: ['super_admin'] },
  url: 'http://localhost/api/cost-ops/storage-probe',
  headers: { get: () => null },
}
const res = await costStorageProbeHandler(req)
console.log('probe result:', JSON.stringify(await res.json()))
process.exit(0)
