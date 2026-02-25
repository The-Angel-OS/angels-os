/**
 * Maker Opportunities Endpoint — GET /api/maker-opportunities
 *
 * Public, no auth required. Returns aggregate Angel Token queue data
 * showing demand per capability. This is the hook that attracts
 * manufacturers to join the network.
 *
 * No PII exposed — just skill demand signals and revenue potential.
 *
 * @see src/utilities/angelTokens.ts — getActiveTokensByCapability()
 */
import type { PayloadHandler } from 'payload'
import { getActiveTokensByCapability } from '@/utilities/angelTokens'

export const makerOpportunitiesHandler: PayloadHandler = async (req) => {
  const { payload } = req

  try {
    const opportunities = await getActiveTokensByCapability(payload)

    return Response.json({
      opportunities,
      totalQueuedOrders: opportunities.reduce((sum, o) => sum + o.queuedOrders, 0),
      totalVendorRevenue: Math.round(
        opportunities.reduce((sum, o) => sum + o.estimatedVendorRevenue, 0) * 100,
      ) / 100,
      message: opportunities.length > 0
        ? `${opportunities.length} capability areas with waiting orders. Register your workshop to start earning.`
        : 'No orders in the queue yet. Check back soon!',
    })
  } catch (err) {
    console.error('Maker opportunities error:', err)
    return Response.json({ error: 'Failed to fetch opportunities.' }, { status: 500 })
  }
}
