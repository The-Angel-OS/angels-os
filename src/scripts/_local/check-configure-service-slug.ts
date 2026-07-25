/**
 * Check: configure_service writes into the portal named by `tenantSlug`, not the
 * ambient one. Drives the real executor, then reads the row back. Also covers the
 * hourly-rate branch. Cleans up after itself.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { executeToolCall } from '@/utilities/leo-data-tools'

const payload = await getPayload({ config })

const AMBIENT = 'clearwater-cruisin' // ctx tenant — must stay untouched
const TARGET = 'mobilmech1' // where the service must land

const idOf = async (slug: string) => {
  const r = await payload.find({
    collection: 'tenants', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true,
  })
  return Number((r.docs[0] as { id: number }).id)
}
const ambientId = await idOf(AMBIENT)
const targetId = await idOf(TARGET)

const out = await executeToolCall(
  'configure_service',
  { name: 'Diagnostic Check (probe)', hourlyRateUsd: 95, durationMinutes: 45, tenantSlug: TARGET },
  { payload, tenantId: ambientId, userId: 3, roles: ['super_admin'] },
)
console.log(out.split('\n').slice(0, 6).join('\n'))

const find = async (tenantId: number) =>
  await payload.find({
    collection: 'services',
    where: { and: [{ tenant: { equals: tenantId } }, { serviceId: { equals: 'diagnostic-check-probe' } }] },
    limit: 1, depth: 0, overrideAccess: true,
  })

const onTarget = await find(targetId)
const onAmbient = await find(ambientId)
const row = onTarget.docs[0] as { id: number; pricingModel?: string; hourlyRateUsd?: number } | undefined

console.log('---')
console.log('landed on target  :', onTarget.totalDocs === 1 ? 'PASS' : 'FAIL')
console.log('ambient untouched :', onAmbient.totalDocs === 0 ? 'PASS' : 'FAIL')
console.log('pricingModel      :', row?.pricingModel === 'hourly' ? 'PASS (hourly)' : `FAIL (${row?.pricingModel})`)
console.log('hourlyRateUsd     :', row?.hourlyRateUsd === 95 ? 'PASS (95)' : `FAIL (${row?.hourlyRateUsd})`)

if (row) {
  await payload.delete({ collection: 'services', id: row.id, overrideAccess: true })
  console.log('cleaned up probe service')
}
