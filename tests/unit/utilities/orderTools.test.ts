/**
 * Unit tests for Order Routing & Fulfillment LEO tools — Sprint 4.
 *
 * Tests tool definitions, input validation, result formatting, and
 * vendor share calculations for the 6 new fulfillment tools.
 *
 * Uses the project pattern of re-implementing pure validation logic
 * to avoid Payload-coupled imports.
 *
 * @see src/utilities/leo-data-tools.ts — find_producers, browse_network,
 *      query_orders, route_order, accept_order, update_fulfillment
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Tool Definition Validation
// ---------------------------------------------------------------------------

const ORDER_TOOLS = [
  'find_producers',
  'browse_network',
  'query_orders',
  'route_order',
  'accept_order',
  'update_fulfillment',
] as const

const TOOL_REQUIRED_FIELDS: Record<string, string[]> = {
  find_producers: ['skill'],
  browse_network: [],
  query_orders: [],
  route_order: ['orderId'],
  accept_order: ['orderId', 'itemIndex'],
  update_fulfillment: ['orderId', 'itemIndex', 'status'],
}

const TOOL_LABELS: Record<string, string> = {
  find_producers: 'Finding capable producers',
  browse_network: 'Browsing network catalog',
  query_orders: 'Looking up orders',
  route_order: 'Routing order to vendor',
  accept_order: 'Accepting order',
  update_fulfillment: 'Updating fulfillment',
}

// ---------------------------------------------------------------------------
// Re-implement validation logic (mirrors leo-data-tools.ts handlers)
// ---------------------------------------------------------------------------

interface FindProducersInput {
  skill?: string
  city?: string
  region?: string
  lat?: number
  lng?: number
  radius?: number
  limit?: number
}

function validateFindProducers(input: FindProducersInput): string | null {
  if (!input.skill || !input.skill.trim()) {
    return 'Error: Skill is required (e.g., "screen-printing", "3d-printing").'
  }
  if (input.radius !== undefined) {
    if (typeof input.radius !== 'number' || input.radius <= 0 || !isFinite(input.radius)) {
      return 'Error: Radius must be a positive number (miles).'
    }
  }
  if (input.limit !== undefined) {
    if (typeof input.limit !== 'number' || input.limit < 1 || input.limit > 20) {
      return 'Error: Limit must be between 1 and 20.'
    }
  }
  return null
}

interface BrowseNetworkInput {
  search?: string
  category?: string
  radius?: number
  limit?: number
}

function validateBrowseNetwork(input: BrowseNetworkInput): string | null {
  if (input.radius !== undefined) {
    if (typeof input.radius !== 'number' || input.radius <= 0 || !isFinite(input.radius)) {
      return 'Error: Radius must be a positive number (miles).'
    }
  }
  if (input.limit !== undefined) {
    if (typeof input.limit !== 'number' || input.limit < 1 || input.limit > 50) {
      return 'Error: Limit must be between 1 and 50.'
    }
  }
  return null
}

interface RouteOrderInput {
  orderId?: number
  itemIndex?: number
  preferredHolonId?: number
}

function validateRouteOrder(input: RouteOrderInput): string | null {
  if (!input.orderId) {
    return 'Error: orderId is required.'
  }
  if (input.itemIndex !== undefined && input.itemIndex < 0) {
    return 'Error: itemIndex must be non-negative.'
  }
  return null
}

interface AcceptOrderInput {
  orderId?: number
  itemIndex?: number
  estimatedCompletionDate?: string
}

function validateAcceptOrder(input: AcceptOrderInput): string | null {
  if (!input.orderId) {
    return 'Error: orderId is required.'
  }
  if (input.itemIndex === undefined || input.itemIndex === null) {
    return 'Error: itemIndex is required.'
  }
  if (input.estimatedCompletionDate !== undefined) {
    const date = new Date(input.estimatedCompletionDate)
    if (isNaN(date.getTime())) {
      return 'Error: estimatedCompletionDate must be a valid ISO 8601 date.'
    }
  }
  return null
}

interface UpdateFulfillmentInput {
  orderId?: number
  itemIndex?: number
  status?: string
  trackingNumber?: string
  trackingUrl?: string
  rejectionReason?: string
}

const VALID_FULFILLMENT_STATUSES = [
  'in_production',
  'shipped',
  'delivered',
  'rejected',
]

function validateUpdateFulfillment(input: UpdateFulfillmentInput): string | null {
  if (!input.orderId) {
    return 'Error: orderId is required.'
  }
  if (input.itemIndex === undefined || input.itemIndex === null) {
    return 'Error: itemIndex is required.'
  }
  if (!input.status || !VALID_FULFILLMENT_STATUSES.includes(input.status)) {
    return `Error: status must be one of: ${VALID_FULFILLMENT_STATUSES.join(', ')}.`
  }
  if (input.status === 'shipped' && (!input.trackingNumber || !input.trackingNumber.trim())) {
    return 'Error: trackingNumber is required when status is "shipped".'
  }
  if (input.status === 'rejected' && (!input.rejectionReason || !input.rejectionReason.trim())) {
    return 'Error: rejectionReason is required when status is "rejected".'
  }
  return null
}

// ---------------------------------------------------------------------------
// Result formatting
// ---------------------------------------------------------------------------

interface ProducerMatch {
  businessName: string
  distance: number
  score: number
  rating: number
  nodeType: string
  skills: string[]
}

function formatProducerResult(match: ProducerMatch): string {
  return [
    `**${match.businessName}**`,
    `${match.distance.toFixed(1)} mi away`,
    `Score: ${match.score.toFixed(0)}/100`,
    `Rating: ${match.rating}/5`,
    `Type: ${match.nodeType}`,
    `Skills: ${match.skills.join(', ')}`,
  ].join(' | ')
}

function formatVendorShare(orderAmount: number, providerPercent: number = 60): string {
  const share = Math.round(((orderAmount * providerPercent) / 100) * 100) / 100
  return `Your share (${providerPercent}%): $${share.toFixed(2)}`
}

interface QueryOrdersViewConfig {
  viewAs: 'customer' | 'vendor'
}

function getOrderQueryLabel(config: QueryOrdersViewConfig): string {
  return config.viewAs === 'customer' ? 'Your Orders' : 'Assigned Orders'
}

// ═══════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Order LEO Tools — Tool Definitions', () => {
  it('defines all 6 order tools', () => {
    expect(ORDER_TOOLS).toHaveLength(6)
  })

  it('has required fields for find_producers', () => {
    expect(TOOL_REQUIRED_FIELDS.find_producers).toContain('skill')
  })

  it('has required fields for route_order', () => {
    expect(TOOL_REQUIRED_FIELDS.route_order).toContain('orderId')
  })

  it('has required fields for accept_order', () => {
    expect(TOOL_REQUIRED_FIELDS.accept_order).toContain('orderId')
    expect(TOOL_REQUIRED_FIELDS.accept_order).toContain('itemIndex')
  })

  it('has required fields for update_fulfillment', () => {
    expect(TOOL_REQUIRED_FIELDS.update_fulfillment).toContain('orderId')
    expect(TOOL_REQUIRED_FIELDS.update_fulfillment).toContain('itemIndex')
    expect(TOOL_REQUIRED_FIELDS.update_fulfillment).toContain('status')
  })

  it('has TOOL_LABELS for all 6 tools', () => {
    for (const tool of ORDER_TOOLS) {
      expect(TOOL_LABELS[tool]).toBeTruthy()
    }
  })
})

describe('Order LEO Tools — find_producers validation', () => {
  it('requires skill', () => {
    expect(validateFindProducers({})).toContain('Skill is required')
  })

  it('rejects empty skill', () => {
    expect(validateFindProducers({ skill: '' })).toContain('Skill is required')
  })

  it('rejects whitespace skill', () => {
    expect(validateFindProducers({ skill: '   ' })).toContain('Skill is required')
  })

  it('accepts valid skill', () => {
    expect(validateFindProducers({ skill: 'screen-printing' })).toBeNull()
  })

  it('rejects negative radius', () => {
    expect(validateFindProducers({ skill: 'printing', radius: -10 })).toContain('positive number')
  })

  it('rejects zero radius', () => {
    expect(validateFindProducers({ skill: 'printing', radius: 0 })).toContain('positive number')
  })

  it('accepts valid radius', () => {
    expect(validateFindProducers({ skill: 'printing', radius: 50 })).toBeNull()
  })

  it('rejects limit > 20', () => {
    expect(validateFindProducers({ skill: 'printing', limit: 25 })).toContain('between 1 and 20')
  })

  it('rejects limit < 1', () => {
    expect(validateFindProducers({ skill: 'printing', limit: 0 })).toContain('between 1 and 20')
  })

  it('accepts valid limit', () => {
    expect(validateFindProducers({ skill: 'printing', limit: 10 })).toBeNull()
  })
})

describe('Order LEO Tools — browse_network validation', () => {
  it('accepts no params (browse all)', () => {
    expect(validateBrowseNetwork({})).toBeNull()
  })

  it('accepts search term', () => {
    expect(validateBrowseNetwork({ search: 't-shirts' })).toBeNull()
  })

  it('rejects negative radius', () => {
    expect(validateBrowseNetwork({ radius: -5 })).toContain('positive number')
  })

  it('rejects limit > 50', () => {
    expect(validateBrowseNetwork({ limit: 100 })).toContain('between 1 and 50')
  })
})

describe('Order LEO Tools — route_order validation', () => {
  it('requires orderId', () => {
    expect(validateRouteOrder({})).toContain('orderId is required')
  })

  it('rejects zero orderId', () => {
    expect(validateRouteOrder({ orderId: 0 })).toContain('orderId is required')
  })

  it('accepts valid orderId', () => {
    expect(validateRouteOrder({ orderId: 42 })).toBeNull()
  })

  it('accepts optional preferredHolonId', () => {
    expect(validateRouteOrder({ orderId: 42, preferredHolonId: 5 })).toBeNull()
  })

  it('rejects negative itemIndex', () => {
    expect(validateRouteOrder({ orderId: 42, itemIndex: -1 })).toContain('non-negative')
  })
})

describe('Order LEO Tools — accept_order validation', () => {
  it('requires orderId', () => {
    expect(validateAcceptOrder({})).toContain('orderId is required')
  })

  it('requires itemIndex', () => {
    expect(validateAcceptOrder({ orderId: 42 })).toContain('itemIndex is required')
  })

  it('accepts valid input', () => {
    expect(validateAcceptOrder({ orderId: 42, itemIndex: 0 })).toBeNull()
  })

  it('accepts optional estimatedCompletionDate', () => {
    expect(
      validateAcceptOrder({
        orderId: 42,
        itemIndex: 0,
        estimatedCompletionDate: '2026-03-01T00:00:00Z',
      }),
    ).toBeNull()
  })

  it('rejects invalid date', () => {
    expect(
      validateAcceptOrder({
        orderId: 42,
        itemIndex: 0,
        estimatedCompletionDate: 'not-a-date',
      }),
    ).toContain('valid ISO 8601')
  })
})

describe('Order LEO Tools — update_fulfillment validation', () => {
  it('requires orderId', () => {
    expect(validateUpdateFulfillment({ itemIndex: 0, status: 'shipped' })).toContain(
      'orderId is required',
    )
  })

  it('requires itemIndex', () => {
    expect(validateUpdateFulfillment({ orderId: 42, status: 'shipped' })).toContain(
      'itemIndex is required',
    )
  })

  it('requires valid status', () => {
    expect(
      validateUpdateFulfillment({ orderId: 42, itemIndex: 0, status: 'invalid' }),
    ).toContain('status must be one of')
  })

  it('rejects pending_match as update status', () => {
    expect(
      validateUpdateFulfillment({ orderId: 42, itemIndex: 0, status: 'pending_match' }),
    ).toContain('status must be one of')
  })

  it('requires trackingNumber for shipped', () => {
    expect(
      validateUpdateFulfillment({ orderId: 42, itemIndex: 0, status: 'shipped' }),
    ).toContain('trackingNumber is required')
  })

  it('accepts shipped with trackingNumber', () => {
    expect(
      validateUpdateFulfillment({
        orderId: 42,
        itemIndex: 0,
        status: 'shipped',
        trackingNumber: '1Z999AA10123456784',
      }),
    ).toBeNull()
  })

  it('requires rejectionReason for rejected', () => {
    expect(
      validateUpdateFulfillment({ orderId: 42, itemIndex: 0, status: 'rejected' }),
    ).toContain('rejectionReason is required')
  })

  it('accepts rejected with reason', () => {
    expect(
      validateUpdateFulfillment({
        orderId: 42,
        itemIndex: 0,
        status: 'rejected',
        rejectionReason: 'Out of cotton material',
      }),
    ).toBeNull()
  })

  it('accepts in_production with no extras', () => {
    expect(
      validateUpdateFulfillment({ orderId: 42, itemIndex: 0, status: 'in_production' }),
    ).toBeNull()
  })

  it('accepts delivered with no extras', () => {
    expect(
      validateUpdateFulfillment({ orderId: 42, itemIndex: 0, status: 'delivered' }),
    ).toBeNull()
  })
})

describe('Order LEO Tools — result formatting', () => {
  it('formats producer match for display', () => {
    const result = formatProducerResult({
      businessName: 'HIT Promotional Products',
      distance: 5.2,
      score: 92,
      rating: 4.5,
      nodeType: 'print',
      skills: ['screen-printing', 'embroidery'],
    })
    expect(result).toContain('HIT Promotional Products')
    expect(result).toContain('5.2 mi')
    expect(result).toContain('Score: 92/100')
    expect(result).toContain('screen-printing, embroidery')
  })

  it('formats vendor share correctly', () => {
    expect(formatVendorShare(100)).toBe('Your share (60%): $60.00')
  })

  it('formats vendor share with custom percent', () => {
    expect(formatVendorShare(100, 70)).toBe('Your share (70%): $70.00')
  })

  it('formats vendor share with cents', () => {
    expect(formatVendorShare(99.99)).toBe('Your share (60%): $59.99')
  })
})

describe('Order LEO Tools — query_orders view config', () => {
  it('customer view label', () => {
    expect(getOrderQueryLabel({ viewAs: 'customer' })).toBe('Your Orders')
  })

  it('vendor view label', () => {
    expect(getOrderQueryLabel({ viewAs: 'vendor' })).toBe('Assigned Orders')
  })
})
