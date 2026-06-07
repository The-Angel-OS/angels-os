// Verify Payload can create + query cost-events against the live table.
process.env.PAYLOAD_SKIP_PUSH = 'true'
import { config as dotenv } from 'dotenv'
dotenv({ path: '.env.local' }); dotenv({ path: '.env' })
process.env.PAYLOAD_SKIP_PUSH = 'true'
const { getPayload } = await import('payload')
const { default: config } = await import('../../src/payload.config.ts')
const payload = await getPayload({ config })
const { recordAiUsage } = await import('../../src/utilities/recordCostEvent.ts')

await recordAiUsage(payload, {
  telemetry: { model: 'anthropic/claude-sonnet-4-6', provider: 'anthropic', tier: 'medium', inputTokens: 1200, outputTokens: 400, totalTokens: 1600, costCents: 0.96, costEstimated: true, latencyMs: 1500, ttftMs: 280, finishReason: 'stop', toolCallCount: 1 },
  tenantId: 1, conversationId: 'verify-conv', userId: 1,
})
const res = await payload.find({ collection: 'cost-events', where: { conversationId: { equals: 'verify-conv' } }, overrideAccess: true, depth: 0 })
console.log('found rows:', res.totalDocs)
console.log('sample:', JSON.stringify(res.docs[0] && { id: res.docs[0].id, category: res.docs[0].category, provider: res.docs[0].provider, model: res.docs[0].model, costCents: res.docs[0].costCents, totalTokens: res.docs[0].totalTokens, tenant: res.docs[0].tenant }, null, 0))
// cleanup verify rows
for (const d of res.docs) await payload.delete({ collection: 'cost-events', id: d.id, overrideAccess: true })
console.log('cleaned up', res.docs.length, 'verify rows')
process.exit(0)
