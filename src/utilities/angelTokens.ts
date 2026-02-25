/**
 * Angel Tokens — Pay Now, Receive Value Later
 *
 * Angel Tokens are the foundational unit of the Angel OS token economy.
 * When a customer pays for a product that has no manufacturer yet, they
 * receive an Angel Token — a paid claim on future production.
 *
 * Phase 1 (current): Stripe-backed fulfillment queue tokens
 * Phase 2 (future): Karma Coins (KC) for micro-transactions
 * Phase 3 (future): Native blockchain with Proof of Human Worth consensus
 * Phase 4 (future): Legacy Tokens (LT) for long-term governance
 *
 * @see docs/ANGEL_TOKENS_BLOCKCHAIN_ECONOMY.md — full token economy vision
 * @see src/collections/Orders/index.ts — fulfillment array with token fields
 */

import type { Payload } from 'payload'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AngelToken {
  angelTokenId: string
  tokenStatus: 'active' | 'redeemed' | 'refunded'
  queuedAt: string
  queueReason: string
  orderId: number
  orderItemIndex: number
  productTitle: string
  productId: number
  requiredSkills: string[]
  priceInCents: number
  vendorShareCents: number
  selectedConfiguration?: Record<string, unknown>
  customerNotifiedAt?: string
}

export interface MakerOpportunity {
  skill: string
  equipment?: string
  queuedOrders: number
  estimatedVendorRevenue: number
  oldestQueuedAt: string
  exampleProducts: string[]
}

// ---------------------------------------------------------------------------
// Token ID Generation
// ---------------------------------------------------------------------------

/** In-memory sequence counter. Resets on server restart — collision-safe via unique DB constraint. */
let sequenceCounter = 0

/**
 * Generate a human-readable Angel Token ID.
 * Format: AT-YYYY-NNNNN (e.g. AT-2026-00042)
 *
 * The sequence is in-memory and resets on restart. The DB unique constraint
 * on angelTokenId prevents collisions. On conflict, caller should retry.
 */
export function generateAngelTokenId(): string {
  sequenceCounter += 1
  const year = new Date().getFullYear()
  const seq = String(sequenceCounter).padStart(5, '0')
  return `AT-${year}-${seq}`
}

/**
 * Initialize the sequence counter from existing tokens in the database.
 * Call once at server startup to avoid ID collisions after restart.
 */
export async function initializeTokenSequence(payload: Payload): Promise<void> {
  try {
    const year = new Date().getFullYear()
    const prefix = `AT-${year}-`

    // Find the highest token ID for this year
    const orders = await payload.find({
      collection: 'orders' as any,
      where: {
        'fulfillment.angelTokenId': {
          like: `${prefix}%`,
        },
      },
      sort: '-createdAt',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    let maxSeq = 0
    for (const order of orders.docs as any[]) {
      const fulfillment = order.fulfillment || []
      for (const entry of fulfillment) {
        if (entry.angelTokenId?.startsWith(prefix)) {
          const seqStr = entry.angelTokenId.replace(prefix, '')
          const seq = parseInt(seqStr, 10)
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq
        }
      }
    }

    sequenceCounter = maxSeq
    console.log(`[Angel Tokens] Sequence initialized at ${maxSeq} for year ${year}`)
  } catch (err) {
    console.error('[Angel Tokens] Failed to initialize sequence:', err)
    // Non-fatal: unique constraint will catch collisions
  }
}

// ---------------------------------------------------------------------------
// Token Lifecycle
// ---------------------------------------------------------------------------

/**
 * Create an Angel Token entry for a queued fulfillment item.
 * Called when order routing finds 0 matching Holons.
 */
export function createAngelTokenEntry(params: {
  orderItemIndex: number
  requiredSkills: string[]
  selectedConfiguration?: Record<string, unknown>
}): {
  orderItemIndex: number
  fulfillmentStatus: 'pending_match'
  angelTokenId: string
  tokenStatus: 'active'
  queuedAt: string
  queueReason: string
  selectedConfiguration?: Record<string, unknown>
} {
  const { orderItemIndex, requiredSkills, selectedConfiguration } = params
  const skills = requiredSkills.length > 0
    ? requiredSkills.join(', ')
    : 'general manufacturing'

  return {
    orderItemIndex,
    fulfillmentStatus: 'pending_match' as const,
    angelTokenId: generateAngelTokenId(),
    tokenStatus: 'active' as const,
    queuedAt: new Date().toISOString(),
    queueReason: `Waiting for a maker with: ${skills}`,
    ...(selectedConfiguration ? { selectedConfiguration } : {}),
  }
}

// ---------------------------------------------------------------------------
// Query Helpers
// ---------------------------------------------------------------------------

/**
 * Get all active (unfulfilled) Angel Tokens for a user.
 */
export async function getActiveTokensForUser(
  payload: Payload,
  userId: number,
): Promise<AngelToken[]> {
  const orders = await payload.find({
    collection: 'orders' as any,
    where: {
      orderedBy: { equals: userId },
      'fulfillment.tokenStatus': { equals: 'active' },
    },
    depth: 2,
    limit: 100,
    overrideAccess: true,
  })

  const tokens: AngelToken[] = []

  for (const order of orders.docs as any[]) {
    const fulfillment = order.fulfillment || []
    const items = order.items || []

    for (const entry of fulfillment) {
      if (entry.tokenStatus !== 'active') continue

      const item = items[entry.orderItemIndex]
      const product = typeof item?.product === 'object' ? item.product : null

      tokens.push({
        angelTokenId: entry.angelTokenId,
        tokenStatus: entry.tokenStatus,
        queuedAt: entry.queuedAt,
        queueReason: entry.queueReason || '',
        orderId: order.id,
        orderItemIndex: entry.orderItemIndex,
        productTitle: product?.title || 'Unknown product',
        productId: product?.id || 0,
        requiredSkills: extractSkillsFromProduct(product),
        priceInCents: Math.round((item?.price || 0) * 100),
        vendorShareCents: Math.round((item?.price || 0) * 0.6 * 100), // 60% vendor share
        selectedConfiguration: entry.selectedConfiguration,
        customerNotifiedAt: entry.customerNotifiedAt,
      })
    }
  }

  return tokens
}

/**
 * Get aggregate Angel Token data by capability — for the Maker Opportunity Board.
 * No PII exposed, just demand signals.
 */
export async function getActiveTokensByCapability(
  payload: Payload,
): Promise<MakerOpportunity[]> {
  const orders = await payload.find({
    collection: 'orders' as any,
    where: {
      'fulfillment.tokenStatus': { equals: 'active' },
    },
    depth: 2,
    limit: 500,
    overrideAccess: true,
  })

  // Aggregate by skill
  const skillMap = new Map<string, {
    equipment: Map<string, number>
    orders: number
    revenue: number
    oldestQueuedAt: string
    products: Set<string>
  }>()

  for (const order of orders.docs as any[]) {
    const fulfillment = order.fulfillment || []
    const items = order.items || []

    for (const entry of fulfillment) {
      if (entry.tokenStatus !== 'active') continue

      const item = items[entry.orderItemIndex]
      const product = typeof item?.product === 'object' ? item.product : null
      if (!product) continue

      const skills = extractSkillsFromProduct(product)
      const vendorRevenue = (item.price || 0) * 0.6

      for (const skill of skills) {
        const existing = skillMap.get(skill) || {
          equipment: new Map<string, number>(),
          orders: 0,
          revenue: 0,
          oldestQueuedAt: entry.queuedAt || new Date().toISOString(),
          products: new Set<string>(),
        }

        existing.orders += 1
        existing.revenue += vendorRevenue
        existing.products.add(product.title || 'Unnamed')

        if (entry.queuedAt && entry.queuedAt < existing.oldestQueuedAt) {
          existing.oldestQueuedAt = entry.queuedAt
        }

        // Track equipment mentions
        const reqCaps = product.requiredCapabilities || []
        for (const cap of reqCaps as any[]) {
          if (cap.equipment) {
            existing.equipment.set(
              cap.equipment,
              (existing.equipment.get(cap.equipment) || 0) + 1,
            )
          }
        }

        skillMap.set(skill, existing)
      }
    }
  }

  // Convert to output format
  const opportunities: MakerOpportunity[] = []
  for (const [skill, data] of skillMap) {
    // Find most common equipment mention
    let topEquipment: string | undefined
    let topCount = 0
    for (const [eq, count] of data.equipment) {
      if (count > topCount) {
        topEquipment = eq
        topCount = count
      }
    }

    opportunities.push({
      skill,
      equipment: topEquipment,
      queuedOrders: data.orders,
      estimatedVendorRevenue: Math.round(data.revenue * 100) / 100,
      oldestQueuedAt: data.oldestQueuedAt,
      exampleProducts: Array.from(data.products).slice(0, 3),
    })
  }

  return opportunities.sort((a, b) => b.estimatedVendorRevenue - a.estimatedVendorRevenue)
}

/**
 * Mark an Angel Token as redeemed (maker fulfilled the order).
 */
export async function redeemToken(
  payload: Payload,
  orderId: number,
  orderItemIndex: number,
): Promise<void> {
  const order = await payload.findByID({
    collection: 'orders' as any,
    id: orderId,
    depth: 0,
    overrideAccess: true,
  }) as any

  const fulfillment = (order.fulfillment || []).slice()
  const idx = fulfillment.findIndex(
    (f: any) => f.orderItemIndex === orderItemIndex && f.tokenStatus === 'active',
  )

  if (idx < 0) return // No active token for this item

  fulfillment[idx] = {
    ...fulfillment[idx],
    tokenStatus: 'redeemed',
  }

  await payload.update({
    collection: 'orders' as any,
    id: orderId,
    data: { fulfillment } as any,
    overrideAccess: true,
  })
}

/**
 * Mark an Angel Token as refunded and trigger Stripe refund.
 * Only works for tokens in 'active' status (pending_match).
 */
export async function refundToken(
  payload: Payload,
  orderId: number,
  orderItemIndex: number,
): Promise<{ success: boolean; message: string }> {
  const order = await payload.findByID({
    collection: 'orders' as any,
    id: orderId,
    depth: 0,
    overrideAccess: true,
  }) as any

  const fulfillment = (order.fulfillment || []).slice()
  const idx = fulfillment.findIndex(
    (f: any) => f.orderItemIndex === orderItemIndex && f.tokenStatus === 'active',
  )

  if (idx < 0) {
    return { success: false, message: 'No active Angel Token found for this item.' }
  }

  if (fulfillment[idx].fulfillmentStatus !== 'pending_match') {
    return {
      success: false,
      message: 'Cannot refund — a maker has already started working on this item.',
    }
  }

  // Update fulfillment entry
  fulfillment[idx] = {
    ...fulfillment[idx],
    tokenStatus: 'refunded',
    fulfillmentStatus: 'cancelled',
  }

  await payload.update({
    collection: 'orders' as any,
    id: orderId,
    data: { fulfillment } as any,
    overrideAccess: true,
  })

  // Note: Stripe refund should be issued by the caller (order-cancel endpoint)
  // This utility only updates the token state.

  return {
    success: true,
    message: `Angel Token ${fulfillment[idx].angelTokenId} refunded. Stripe refund should be issued separately.`,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractSkillsFromProduct(product: any): string[] {
  if (!product?.requiredCapabilities || !Array.isArray(product.requiredCapabilities)) {
    return []
  }
  return product.requiredCapabilities
    .map((cap: any) => cap.skill)
    .filter(Boolean) as string[]
}
