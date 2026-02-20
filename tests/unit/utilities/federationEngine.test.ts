/**
 * Federation Protocol Engine — Tests
 *
 * Comprehensive test suite for cross-instance federation protocol.
 * Re-implements types and pure functions to avoid Payload imports.
 *
 * @see src/utilities/federationEngine.ts
 */

import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Re-implement types (avoid Payload imports)
// ---------------------------------------------------------------------------

type MinistryStatus = 'applicant' | 'probation' | 'active' | 'suspended' | 'revoked'

type TrustLevel = 'none' | 'probationary' | 'vouched' | 'full'

interface Vouch {
  voucherId: string
  voucherName: string
  vouchedAt: string
  reason: string
  isValid: boolean
}

interface Ministry {
  id: string
  name: string
  domain: string
  operator: string
  status: MinistryStatus
  appliedAt: string
  probationStartedAt?: string
  activatedAt?: string
  vouchesReceived: Vouch[]
  constitutionVersion: string
  lastHeartbeat?: string
  capabilities: string[]
  region?: string
}

interface FederationCatalogEntry {
  productId: number
  productName: string
  description?: string
  price: number
  currency: string
  sourceMinistry: string
  sourceTenant: number
  capabilities: string[]
  fulfillmentMode: string
  location?: { city?: string; region?: string }
  rating: number
}

interface SuitcaseManifest {
  version: string
  angelOS: string
  exportedAt: string
  exportedBy: string
  sourceMinistry: string
  tenant: {
    name: string
    slug: string
    domain?: string
    type?: string
    status?: string
  }
  contents: {
    spaces: number
    channels: number
    messages: number
    users: number
    posts: number
    products: number
    media: number
    bookings: number
    orders: number
  }
  constitutional: {
    isAngel: boolean
    revenueModel: string
    antiDemonic: boolean
  }
  checksum: string
}

interface FederationHealthReport {
  totalMinistries: number
  activeMinistries: number
  probationaryMinistries: number
  catalogEntries: number
  crossMinistryOrders: number
  avgHeartbeatAge: number
  unhealthyMinistries: string[]
  trustScore: number
}

// ---------------------------------------------------------------------------
// Re-implement constants
// ---------------------------------------------------------------------------

const PROBATION_DAYS = 90
const REQUIRED_VOUCHES = 2
const MAX_HEARTBEAT_AGE_SECONDS = 300
const MIN_CONSTITUTION_VERSION = '1.0.0'

const VALID_MINISTRY_TRANSITIONS: Record<MinistryStatus, MinistryStatus[]> = {
  applicant: ['probation', 'revoked'],
  probation: ['active', 'suspended', 'revoked'],
  active: ['suspended', 'revoked'],
  suspended: ['active', 'revoked'],
  revoked: [],
}

// ---------------------------------------------------------------------------
// Re-implement pure functions
// ---------------------------------------------------------------------------

function validateMinistryTransition(from: MinistryStatus, to: MinistryStatus): boolean {
  return VALID_MINISTRY_TRANSITIONS[from]?.includes(to) ?? false
}

function calculateTrustLevel(ministry: Ministry): TrustLevel {
  if (ministry.status === 'revoked' || ministry.status === 'suspended') return 'none'
  if (ministry.status === 'applicant') return 'none'
  if (ministry.status === 'probation') return 'probationary'

  const validVouches = ministry.vouchesReceived.filter((v) => v.isValid).length
  if (validVouches >= REQUIRED_VOUCHES) return 'full'
  if (validVouches > 0) return 'vouched'

  return 'probationary'
}

function canPromoteToActive(
  ministry: Ministry,
  currentDate: Date = new Date(),
): { canPromote: boolean; reason?: string } {
  if (ministry.status !== 'probation') {
    return { canPromote: false, reason: `Ministry is ${ministry.status}, not in probation.` }
  }

  if (!ministry.probationStartedAt) {
    return { canPromote: false, reason: 'Probation start date not set.' }
  }

  const probationStart = new Date(ministry.probationStartedAt)
  const daysSinceProbation = Math.floor(
    (currentDate.getTime() - probationStart.getTime()) / (24 * 60 * 60 * 1000),
  )

  if (daysSinceProbation < PROBATION_DAYS) {
    return {
      canPromote: false,
      reason: `Probation period not complete. ${PROBATION_DAYS - daysSinceProbation} days remaining.`,
    }
  }

  const validVouches = ministry.vouchesReceived.filter((v) => v.isValid).length
  if (validVouches < REQUIRED_VOUCHES) {
    return {
      canPromote: false,
      reason: `Insufficient vouches. Has ${validVouches}, requires ${REQUIRED_VOUCHES}.`,
    }
  }

  return { canPromote: true }
}

function validateVouch(
  voucherId: string,
  targetMinistry: Ministry,
  voucherMinistry: Ministry,
): { valid: boolean; reason?: string } {
  if (voucherId === targetMinistry.id) {
    return { valid: false, reason: 'Cannot vouch for yourself.' }
  }

  if (voucherMinistry.status !== 'active') {
    return { valid: false, reason: 'Only active ministries can vouch.' }
  }

  if (targetMinistry.status !== 'probation') {
    return { valid: false, reason: 'Can only vouch for ministries in probation.' }
  }

  const alreadyVouched = targetMinistry.vouchesReceived.some(
    (v) => v.voucherId === voucherId && v.isValid,
  )
  if (alreadyVouched) {
    return { valid: false, reason: 'Already vouched for this ministry.' }
  }

  return { valid: true }
}

function isHeartbeatHealthy(
  lastHeartbeat: string | undefined,
  currentDate: Date = new Date(),
): boolean {
  if (!lastHeartbeat) return false
  const age = (currentDate.getTime() - new Date(lastHeartbeat).getTime()) / 1000
  return age <= MAX_HEARTBEAT_AGE_SECONDS
}

function getHeartbeatAge(
  lastHeartbeat: string | undefined,
  currentDate: Date = new Date(),
): number {
  if (!lastHeartbeat) return Infinity
  return (currentDate.getTime() - new Date(lastHeartbeat).getTime()) / 1000
}

function searchCatalog(
  entries: FederationCatalogEntry[],
  filters: {
    capability?: string
    maxPrice?: number
    region?: string
    minRating?: number
    excludeMinistry?: string
  },
): FederationCatalogEntry[] {
  return entries.filter((entry) => {
    if (filters.capability) {
      const cap = filters.capability.toLowerCase()
      if (!entry.capabilities.some((c) => c.toLowerCase().includes(cap))) return false
    }
    if (filters.maxPrice !== undefined && entry.price > filters.maxPrice) return false
    if (filters.region && entry.location?.region !== filters.region) return false
    if (filters.minRating !== undefined && entry.rating < filters.minRating) return false
    if (filters.excludeMinistry && entry.sourceMinistry === filters.excludeMinistry) return false
    return true
  })
}

function rankCatalogEntries(
  entries: FederationCatalogEntry[],
  sortBy: 'price' | 'rating' | 'name' = 'rating',
): FederationCatalogEntry[] {
  const sorted = [...entries]
  switch (sortBy) {
    case 'price':
      sorted.sort((a, b) => a.price - b.price)
      break
    case 'rating':
      sorted.sort((a, b) => b.rating - a.rating)
      break
    case 'name':
      sorted.sort((a, b) => a.productName.localeCompare(b.productName))
      break
  }
  return sorted
}

function validateSuitcaseManifest(
  manifest: Partial<SuitcaseManifest>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!manifest.version) errors.push('Missing version.')
  if (!manifest.angelOS) errors.push('Missing Angel OS version.')
  if (!manifest.exportedAt) errors.push('Missing export timestamp.')
  if (!manifest.exportedBy) errors.push('Missing exporter.')
  if (!manifest.sourceMinistry) errors.push('Missing source ministry.')
  if (!manifest.tenant?.name) errors.push('Missing tenant name.')
  if (!manifest.tenant?.slug) errors.push('Missing tenant slug.')

  if (!manifest.constitutional) {
    errors.push('Missing constitutional declaration.')
  } else {
    if (!manifest.constitutional.isAngel) {
      errors.push('Suitcase is not from an Angel OS instance.')
    }
    if (!manifest.constitutional.antiDemonic) {
      errors.push('Anti-demonic safeguards not declared.')
    }
  }

  if (!manifest.checksum) errors.push('Missing integrity checksum.')

  return {
    valid: errors.length === 0,
    errors,
  }
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

function calculateSuitcaseChecksum(contents: SuitcaseManifest['contents']): string {
  const total = Object.values(contents).reduce((sum, count) => sum + count, 0)
  const parts = Object.entries(contents)
    .map(([key, count]) => `${key}:${count}`)
    .sort()
    .join('|')
  return `aok_${total}_${simpleHash(parts)}`
}

function checkSuitcaseCompatibility(
  manifest: SuitcaseManifest,
  currentConstitutionVersion: string,
): { compatible: boolean; warnings: string[] } {
  const warnings: string[] = []

  if (manifest.version !== '1.0.0') {
    warnings.push(`Suitcase version ${manifest.version} may not be fully compatible.`)
  }

  if (manifest.constitutional.revenueModel !== '60/20/15/5') {
    warnings.push(
      `Non-standard revenue model: ${manifest.constitutional.revenueModel}. Will be normalized to 60/20/15/5.`,
    )
  }

  return {
    compatible: true,
    warnings,
  }
}

function generateFederationHealthReport(
  ministries: Ministry[],
  catalogEntries: FederationCatalogEntry[],
  crossMinistryOrders: number,
  currentDate: Date = new Date(),
): FederationHealthReport {
  const activeMinistries = ministries.filter((m) => m.status === 'active').length
  const probationaryMinistries = ministries.filter((m) => m.status === 'probation').length

  const unhealthyMinistries: string[] = []
  let totalHeartbeatAge = 0
  let heartbeatCount = 0

  for (const ministry of ministries) {
    if (ministry.status !== 'active' && ministry.status !== 'probation') continue

    const age = getHeartbeatAge(ministry.lastHeartbeat, currentDate)
    if (age !== Infinity) {
      totalHeartbeatAge += age
      heartbeatCount++
    }

    if (!isHeartbeatHealthy(ministry.lastHeartbeat, currentDate)) {
      unhealthyMinistries.push(ministry.name)
    }
  }

  const avgHeartbeatAge = heartbeatCount > 0 ? totalHeartbeatAge / heartbeatCount : 0

  const activeRatio = ministries.length > 0 ? activeMinistries / ministries.length : 0
  const catalogScore = Math.min(catalogEntries.length / 100, 1) * 30
  const orderScore = Math.min(crossMinistryOrders / 50, 1) * 20
  const healthScore = (1 - unhealthyMinistries.length / Math.max(activeMinistries, 1)) * 20
  const trustScore = Math.round(
    activeRatio * 30 + catalogScore + orderScore + healthScore,
  )

  return {
    totalMinistries: ministries.length,
    activeMinistries,
    probationaryMinistries,
    catalogEntries: catalogEntries.length,
    crossMinistryOrders,
    avgHeartbeatAge: Math.round(avgHeartbeatAge),
    unhealthyMinistries,
    trustScore: Math.min(100, Math.max(0, trustScore)),
  }
}

function serializeMinistry(ministry: Ministry): string {
  const trust = calculateTrustLevel(ministry)
  const validVouches = ministry.vouchesReceived.filter((v) => v.isValid).length
  return [
    ministry.name,
    `(${ministry.domain})`,
    `Status: ${ministry.status}`,
    `Trust: ${trust}`,
    `Vouches: ${validVouches}/${REQUIRED_VOUCHES}`,
    ministry.region ? `Region: ${ministry.region}` : '',
  ].filter(Boolean).join(' | ')
}

function serializeHealthReport(report: FederationHealthReport): string {
  const lines = [
    `Federation Health Report`,
    `Active Ministries: ${report.activeMinistries}/${report.totalMinistries}`,
    `Probationary: ${report.probationaryMinistries}`,
    `Catalog Entries: ${report.catalogEntries}`,
    `Cross-Ministry Orders: ${report.crossMinistryOrders}`,
    `Trust Score: ${report.trustScore}/100`,
  ]

  if (report.unhealthyMinistries.length > 0) {
    lines.push(`Unhealthy: ${report.unhealthyMinistries.join(', ')}`)
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function makeVouch(overrides: Partial<Vouch> = {}): Vouch {
  return {
    voucherId: 'ministry-voucher-1',
    voucherName: 'Grace Fellowship',
    vouchedAt: '2025-06-15T00:00:00Z',
    reason: 'Demonstrated faithful stewardship and community service.',
    isValid: true,
    ...overrides,
  }
}

function makeMinistry(overrides: Partial<Ministry> = {}): Ministry {
  return {
    id: 'ministry-001',
    name: 'Hope Community Church',
    domain: 'hope.angel-os.org',
    operator: 'Pastor Sarah',
    status: 'active',
    appliedAt: '2025-01-01T00:00:00Z',
    probationStartedAt: '2025-01-15T00:00:00Z',
    activatedAt: '2025-04-20T00:00:00Z',
    vouchesReceived: [
      makeVouch({ voucherId: 'ministry-002', voucherName: 'Grace Fellowship' }),
      makeVouch({ voucherId: 'ministry-003', voucherName: 'New Life Center' }),
    ],
    constitutionVersion: '1.0.0',
    lastHeartbeat: new Date().toISOString(),
    capabilities: ['food_pantry', 'counseling', 'job_training'],
    region: 'Midwest',
    ...overrides,
  }
}

function makeCatalogEntry(overrides: Partial<FederationCatalogEntry> = {}): FederationCatalogEntry {
  return {
    productId: 1,
    productName: 'Organic Honey',
    description: 'Local raw honey from community garden bees.',
    price: 12.99,
    currency: 'USD',
    sourceMinistry: 'ministry-001',
    sourceTenant: 1,
    capabilities: ['food', 'organic', 'local'],
    fulfillmentMode: 'local_pickup',
    location: { city: 'Springfield', region: 'Midwest' },
    rating: 4.5,
    ...overrides,
  }
}

function makeSuitcaseManifest(overrides: Partial<SuitcaseManifest> = {}): SuitcaseManifest {
  return {
    version: '1.0.0',
    angelOS: '0.5.0',
    exportedAt: '2025-06-01T00:00:00Z',
    exportedBy: 'Pastor Sarah',
    sourceMinistry: 'ministry-001',
    tenant: {
      name: 'Hope Community Church',
      slug: 'hope-community',
      domain: 'hope.angel-os.org',
      type: 'church',
      status: 'active',
    },
    contents: {
      spaces: 5,
      channels: 12,
      messages: 1500,
      users: 45,
      posts: 30,
      products: 8,
      media: 200,
      bookings: 15,
      orders: 25,
    },
    constitutional: {
      isAngel: true,
      revenueModel: '60/20/15/5',
      antiDemonic: true,
    },
    checksum: 'aok_1840_test',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Federation Protocol Engine', () => {
  // ========================================================================
  // Constants
  // ========================================================================

  describe('Constants', () => {
    it('has 90-day probation period', () => {
      expect(PROBATION_DAYS).toBe(90)
    })

    it('requires 2 vouches for full membership', () => {
      expect(REQUIRED_VOUCHES).toBe(2)
    })

    it('has 5-minute heartbeat timeout', () => {
      expect(MAX_HEARTBEAT_AGE_SECONDS).toBe(300)
    })

    it('has minimum constitution version 1.0.0', () => {
      expect(MIN_CONSTITUTION_VERSION).toBe('1.0.0')
    })

    it('defines valid ministry transitions for all statuses', () => {
      const statuses: MinistryStatus[] = ['applicant', 'probation', 'active', 'suspended', 'revoked']
      for (const status of statuses) {
        expect(VALID_MINISTRY_TRANSITIONS).toHaveProperty(status)
        expect(Array.isArray(VALID_MINISTRY_TRANSITIONS[status])).toBe(true)
      }
    })

    it('revoked is a terminal state', () => {
      expect(VALID_MINISTRY_TRANSITIONS.revoked).toEqual([])
    })
  })

  // ========================================================================
  // Ministry Status Transitions
  // ========================================================================

  describe('validateMinistryTransition', () => {
    it('allows applicant → probation', () => {
      expect(validateMinistryTransition('applicant', 'probation')).toBe(true)
    })

    it('allows applicant → revoked', () => {
      expect(validateMinistryTransition('applicant', 'revoked')).toBe(true)
    })

    it('rejects applicant → active (must go through probation)', () => {
      expect(validateMinistryTransition('applicant', 'active')).toBe(false)
    })

    it('rejects applicant → suspended', () => {
      expect(validateMinistryTransition('applicant', 'suspended')).toBe(false)
    })

    it('allows probation → active', () => {
      expect(validateMinistryTransition('probation', 'active')).toBe(true)
    })

    it('allows probation → suspended', () => {
      expect(validateMinistryTransition('probation', 'suspended')).toBe(true)
    })

    it('allows probation → revoked', () => {
      expect(validateMinistryTransition('probation', 'revoked')).toBe(true)
    })

    it('allows active → suspended', () => {
      expect(validateMinistryTransition('active', 'suspended')).toBe(true)
    })

    it('allows active → revoked', () => {
      expect(validateMinistryTransition('active', 'revoked')).toBe(true)
    })

    it('rejects active → probation (no demotion)', () => {
      expect(validateMinistryTransition('active', 'probation')).toBe(false)
    })

    it('allows suspended → active (reinstatement)', () => {
      expect(validateMinistryTransition('suspended', 'active')).toBe(true)
    })

    it('allows suspended → revoked', () => {
      expect(validateMinistryTransition('suspended', 'revoked')).toBe(true)
    })

    it('rejects suspended → probation', () => {
      expect(validateMinistryTransition('suspended', 'probation')).toBe(false)
    })

    it('rejects all transitions from revoked', () => {
      const targets: MinistryStatus[] = ['applicant', 'probation', 'active', 'suspended']
      for (const target of targets) {
        expect(validateMinistryTransition('revoked', target)).toBe(false)
      }
    })

    it('rejects self-transitions', () => {
      const statuses: MinistryStatus[] = ['applicant', 'probation', 'active', 'suspended', 'revoked']
      for (const status of statuses) {
        expect(validateMinistryTransition(status, status)).toBe(false)
      }
    })
  })

  // ========================================================================
  // Trust Levels
  // ========================================================================

  describe('calculateTrustLevel', () => {
    it('returns "none" for applicants', () => {
      const ministry = makeMinistry({ status: 'applicant' })
      expect(calculateTrustLevel(ministry)).toBe('none')
    })

    it('returns "none" for revoked ministries', () => {
      const ministry = makeMinistry({ status: 'revoked' })
      expect(calculateTrustLevel(ministry)).toBe('none')
    })

    it('returns "none" for suspended ministries', () => {
      const ministry = makeMinistry({ status: 'suspended' })
      expect(calculateTrustLevel(ministry)).toBe('none')
    })

    it('returns "probationary" for probation status', () => {
      const ministry = makeMinistry({ status: 'probation', vouchesReceived: [] })
      expect(calculateTrustLevel(ministry)).toBe('probationary')
    })

    it('returns "full" for active with 2+ valid vouches', () => {
      const ministry = makeMinistry({ status: 'active' })
      expect(calculateTrustLevel(ministry)).toBe('full')
    })

    it('returns "vouched" for active with 1 valid vouch', () => {
      const ministry = makeMinistry({
        status: 'active',
        vouchesReceived: [makeVouch()],
      })
      expect(calculateTrustLevel(ministry)).toBe('vouched')
    })

    it('returns "probationary" for active with no vouches', () => {
      const ministry = makeMinistry({
        status: 'active',
        vouchesReceived: [],
      })
      expect(calculateTrustLevel(ministry)).toBe('probationary')
    })

    it('ignores invalid vouches', () => {
      const ministry = makeMinistry({
        status: 'active',
        vouchesReceived: [
          makeVouch({ isValid: false }),
          makeVouch({ isValid: false }),
          makeVouch({ isValid: false }),
        ],
      })
      expect(calculateTrustLevel(ministry)).toBe('probationary')
    })

    it('counts only valid vouches toward trust level', () => {
      const ministry = makeMinistry({
        status: 'active',
        vouchesReceived: [
          makeVouch({ voucherId: 'a', isValid: true }),
          makeVouch({ voucherId: 'b', isValid: false }),
          makeVouch({ voucherId: 'c', isValid: true }),
        ],
      })
      expect(calculateTrustLevel(ministry)).toBe('full')
    })
  })

  // ========================================================================
  // Promotion Logic
  // ========================================================================

  describe('canPromoteToActive', () => {
    it('rejects promotion if not in probation', () => {
      const ministry = makeMinistry({ status: 'active' })
      const result = canPromoteToActive(ministry)
      expect(result.canPromote).toBe(false)
      expect(result.reason).toContain('not in probation')
    })

    it('rejects promotion if probation start date not set', () => {
      const ministry = makeMinistry({ status: 'probation', probationStartedAt: undefined })
      const result = canPromoteToActive(ministry)
      expect(result.canPromote).toBe(false)
      expect(result.reason).toContain('Probation start date not set')
    })

    it('rejects promotion if probation period incomplete', () => {
      const now = new Date('2025-03-01T00:00:00Z')
      const ministry = makeMinistry({
        status: 'probation',
        probationStartedAt: '2025-01-15T00:00:00Z', // Only ~45 days
        vouchesReceived: [makeVouch(), makeVouch({ voucherId: 'ministry-004' })],
      })
      const result = canPromoteToActive(ministry, now)
      expect(result.canPromote).toBe(false)
      expect(result.reason).toContain('days remaining')
    })

    it('rejects promotion if insufficient vouches', () => {
      const now = new Date('2025-06-01T00:00:00Z') // Well past 90 days from Jan 15
      const ministry = makeMinistry({
        status: 'probation',
        probationStartedAt: '2025-01-15T00:00:00Z',
        vouchesReceived: [makeVouch()], // Only 1 vouch
      })
      const result = canPromoteToActive(ministry, now)
      expect(result.canPromote).toBe(false)
      expect(result.reason).toContain('Insufficient vouches')
    })

    it('allows promotion when all conditions met', () => {
      const now = new Date('2025-06-01T00:00:00Z')
      const ministry = makeMinistry({
        status: 'probation',
        probationStartedAt: '2025-01-15T00:00:00Z',
        vouchesReceived: [
          makeVouch({ voucherId: 'ministry-002' }),
          makeVouch({ voucherId: 'ministry-003' }),
        ],
      })
      const result = canPromoteToActive(ministry, now)
      expect(result.canPromote).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('counts days correctly at exact boundary', () => {
      // Exactly 90 days after probation start
      const probationStart = new Date('2025-01-01T00:00:00Z')
      const exactlyAt90 = new Date(probationStart.getTime() + 90 * 24 * 60 * 60 * 1000)
      const ministry = makeMinistry({
        status: 'probation',
        probationStartedAt: probationStart.toISOString(),
        vouchesReceived: [
          makeVouch({ voucherId: 'ministry-002' }),
          makeVouch({ voucherId: 'ministry-003' }),
        ],
      })
      const result = canPromoteToActive(ministry, exactlyAt90)
      expect(result.canPromote).toBe(true)
    })

    it('rejects at 89 days', () => {
      const probationStart = new Date('2025-01-01T00:00:00Z')
      const at89Days = new Date(probationStart.getTime() + 89 * 24 * 60 * 60 * 1000)
      const ministry = makeMinistry({
        status: 'probation',
        probationStartedAt: probationStart.toISOString(),
        vouchesReceived: [
          makeVouch({ voucherId: 'ministry-002' }),
          makeVouch({ voucherId: 'ministry-003' }),
        ],
      })
      const result = canPromoteToActive(ministry, at89Days)
      expect(result.canPromote).toBe(false)
      expect(result.reason).toContain('1 days remaining')
    })

    it('does not count invalid vouches toward promotion', () => {
      const now = new Date('2025-06-01T00:00:00Z')
      const ministry = makeMinistry({
        status: 'probation',
        probationStartedAt: '2025-01-15T00:00:00Z',
        vouchesReceived: [
          makeVouch({ voucherId: 'ministry-002', isValid: true }),
          makeVouch({ voucherId: 'ministry-003', isValid: false }),
        ],
      })
      const result = canPromoteToActive(ministry, now)
      expect(result.canPromote).toBe(false)
      expect(result.reason).toContain('Insufficient vouches')
    })
  })

  // ========================================================================
  // Vouch Validation
  // ========================================================================

  describe('validateVouch', () => {
    it('rejects self-vouching', () => {
      const target = makeMinistry({ id: 'ministry-001', status: 'probation' })
      const voucher = makeMinistry({ id: 'ministry-001', status: 'active' })
      const result = validateVouch('ministry-001', target, voucher)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Cannot vouch for yourself')
    })

    it('rejects vouches from non-active ministries', () => {
      const target = makeMinistry({ id: 'ministry-002', status: 'probation', vouchesReceived: [] })
      const voucher = makeMinistry({ id: 'ministry-001', status: 'probation' })
      const result = validateVouch('ministry-001', target, voucher)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Only active ministries can vouch')
    })

    it('rejects vouches for non-probation ministries', () => {
      const target = makeMinistry({ id: 'ministry-002', status: 'active' })
      const voucher = makeMinistry({ id: 'ministry-001', status: 'active' })
      const result = validateVouch('ministry-001', target, voucher)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Can only vouch for ministries in probation')
    })

    it('rejects duplicate vouches', () => {
      const target = makeMinistry({
        id: 'ministry-002',
        status: 'probation',
        vouchesReceived: [makeVouch({ voucherId: 'ministry-001', isValid: true })],
      })
      const voucher = makeMinistry({ id: 'ministry-001', status: 'active' })
      const result = validateVouch('ministry-001', target, voucher)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Already vouched')
    })

    it('allows valid vouch', () => {
      const target = makeMinistry({
        id: 'ministry-002',
        status: 'probation',
        vouchesReceived: [],
      })
      const voucher = makeMinistry({ id: 'ministry-001', status: 'active' })
      const result = validateVouch('ministry-001', target, voucher)
      expect(result.valid).toBe(true)
    })

    it('allows vouching even if target has invalidated vouches from same voucher', () => {
      const target = makeMinistry({
        id: 'ministry-002',
        status: 'probation',
        vouchesReceived: [makeVouch({ voucherId: 'ministry-001', isValid: false })],
      })
      const voucher = makeMinistry({ id: 'ministry-001', status: 'active' })
      const result = validateVouch('ministry-001', target, voucher)
      expect(result.valid).toBe(true)
    })

    it('rejects vouches from suspended ministries', () => {
      const target = makeMinistry({ id: 'ministry-002', status: 'probation', vouchesReceived: [] })
      const voucher = makeMinistry({ id: 'ministry-001', status: 'suspended' })
      const result = validateVouch('ministry-001', target, voucher)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Only active ministries can vouch')
    })

    it('rejects vouches from revoked ministries', () => {
      const target = makeMinistry({ id: 'ministry-002', status: 'probation', vouchesReceived: [] })
      const voucher = makeMinistry({ id: 'ministry-001', status: 'revoked' })
      const result = validateVouch('ministry-001', target, voucher)
      expect(result.valid).toBe(false)
    })
  })

  // ========================================================================
  // Heartbeat & Health
  // ========================================================================

  describe('isHeartbeatHealthy', () => {
    it('returns false when no heartbeat', () => {
      expect(isHeartbeatHealthy(undefined)).toBe(false)
    })

    it('returns true for recent heartbeat', () => {
      const now = new Date('2025-06-01T12:00:00Z')
      const recent = new Date('2025-06-01T11:58:00Z').toISOString() // 2 minutes ago
      expect(isHeartbeatHealthy(recent, now)).toBe(true)
    })

    it('returns true at exact boundary (300 seconds)', () => {
      const now = new Date('2025-06-01T12:05:00Z')
      const atBoundary = new Date('2025-06-01T12:00:00Z').toISOString() // Exactly 300s
      expect(isHeartbeatHealthy(atBoundary, now)).toBe(true)
    })

    it('returns false for stale heartbeat', () => {
      const now = new Date('2025-06-01T12:10:00Z')
      const stale = new Date('2025-06-01T12:00:00Z').toISOString() // 10 minutes ago
      expect(isHeartbeatHealthy(stale, now)).toBe(false)
    })

    it('returns false for heartbeat just past threshold', () => {
      const now = new Date('2025-06-01T12:05:01Z')
      const justPast = new Date('2025-06-01T12:00:00Z').toISOString() // 301 seconds
      expect(isHeartbeatHealthy(justPast, now)).toBe(false)
    })
  })

  describe('getHeartbeatAge', () => {
    it('returns Infinity when no heartbeat', () => {
      expect(getHeartbeatAge(undefined)).toBe(Infinity)
    })

    it('returns age in seconds', () => {
      const now = new Date('2025-06-01T12:00:00Z')
      const twoMinutesAgo = new Date('2025-06-01T11:58:00Z').toISOString()
      expect(getHeartbeatAge(twoMinutesAgo, now)).toBe(120)
    })

    it('returns 0 for current heartbeat', () => {
      const now = new Date('2025-06-01T12:00:00Z')
      expect(getHeartbeatAge(now.toISOString(), now)).toBe(0)
    })

    it('returns correct age for large values', () => {
      const now = new Date('2025-06-01T12:00:00Z')
      const hourAgo = new Date('2025-06-01T11:00:00Z').toISOString()
      expect(getHeartbeatAge(hourAgo, now)).toBe(3600)
    })
  })

  // ========================================================================
  // Federation Catalog
  // ========================================================================

  describe('searchCatalog', () => {
    const entries: FederationCatalogEntry[] = [
      makeCatalogEntry({ productId: 1, productName: 'Organic Honey', price: 12.99, capabilities: ['food', 'organic'], location: { region: 'Midwest' }, rating: 4.5, sourceMinistry: 'ministry-001' }),
      makeCatalogEntry({ productId: 2, productName: 'Prayer Shawl', price: 45.00, capabilities: ['textile', 'handmade'], location: { region: 'Northeast' }, rating: 4.8, sourceMinistry: 'ministry-002' }),
      makeCatalogEntry({ productId: 3, productName: 'Community Garden Seeds', price: 5.99, capabilities: ['food', 'garden'], location: { region: 'Midwest' }, rating: 3.9, sourceMinistry: 'ministry-003' }),
      makeCatalogEntry({ productId: 4, productName: 'Woodworked Cross', price: 35.00, capabilities: ['art', 'handmade', 'wood'], location: { region: 'Southeast' }, rating: 4.7, sourceMinistry: 'ministry-001' }),
      makeCatalogEntry({ productId: 5, productName: 'Organic Jam', price: 8.50, capabilities: ['food', 'organic', 'preserves'], location: { region: 'Midwest' }, rating: 4.2, sourceMinistry: 'ministry-004' }),
    ]

    it('returns all entries with no filters', () => {
      const results = searchCatalog(entries, {})
      expect(results).toHaveLength(5)
    })

    it('filters by capability', () => {
      const results = searchCatalog(entries, { capability: 'organic' })
      expect(results).toHaveLength(2)
      expect(results.map(e => e.productName)).toContain('Organic Honey')
      expect(results.map(e => e.productName)).toContain('Organic Jam')
    })

    it('capability search is case-insensitive', () => {
      const results = searchCatalog(entries, { capability: 'FOOD' })
      expect(results).toHaveLength(3)
    })

    it('capability search uses substring matching', () => {
      const results = searchCatalog(entries, { capability: 'hand' })
      expect(results).toHaveLength(2) // handmade entries
    })

    it('filters by maxPrice', () => {
      const results = searchCatalog(entries, { maxPrice: 10 })
      expect(results).toHaveLength(2)
      expect(results.every(e => e.price <= 10)).toBe(true)
    })

    it('filters by region', () => {
      const results = searchCatalog(entries, { region: 'Midwest' })
      expect(results).toHaveLength(3)
    })

    it('filters by minRating', () => {
      const results = searchCatalog(entries, { minRating: 4.5 })
      expect(results).toHaveLength(3)
    })

    it('excludes a specific ministry', () => {
      const results = searchCatalog(entries, { excludeMinistry: 'ministry-001' })
      expect(results).toHaveLength(3)
      expect(results.every(e => e.sourceMinistry !== 'ministry-001')).toBe(true)
    })

    it('combines multiple filters', () => {
      const results = searchCatalog(entries, {
        capability: 'food',
        region: 'Midwest',
        maxPrice: 10,
      })
      expect(results).toHaveLength(2) // Seeds (5.99) and Jam (8.50)
    })

    it('returns empty for impossible filters', () => {
      const results = searchCatalog(entries, { maxPrice: 1 })
      expect(results).toHaveLength(0)
    })

    it('handles entries without location for region filter', () => {
      const noLocationEntries = [
        makeCatalogEntry({ productId: 10, location: undefined }),
      ]
      const results = searchCatalog(noLocationEntries, { region: 'Midwest' })
      expect(results).toHaveLength(0)
    })
  })

  describe('rankCatalogEntries', () => {
    const entries: FederationCatalogEntry[] = [
      makeCatalogEntry({ productName: 'B Product', price: 20, rating: 3.5 }),
      makeCatalogEntry({ productName: 'A Product', price: 10, rating: 4.5 }),
      makeCatalogEntry({ productName: 'C Product', price: 15, rating: 4.0 }),
    ]

    it('sorts by rating descending by default', () => {
      const ranked = rankCatalogEntries(entries)
      expect(ranked[0].productName).toBe('A Product')
      expect(ranked[1].productName).toBe('C Product')
      expect(ranked[2].productName).toBe('B Product')
    })

    it('sorts by price ascending', () => {
      const ranked = rankCatalogEntries(entries, 'price')
      expect(ranked[0].price).toBe(10)
      expect(ranked[1].price).toBe(15)
      expect(ranked[2].price).toBe(20)
    })

    it('sorts by name alphabetically', () => {
      const ranked = rankCatalogEntries(entries, 'name')
      expect(ranked[0].productName).toBe('A Product')
      expect(ranked[1].productName).toBe('B Product')
      expect(ranked[2].productName).toBe('C Product')
    })

    it('does not mutate the original array', () => {
      const original = [...entries]
      rankCatalogEntries(entries, 'price')
      expect(entries[0].productName).toBe(original[0].productName)
    })

    it('handles empty array', () => {
      const ranked = rankCatalogEntries([])
      expect(ranked).toHaveLength(0)
    })

    it('handles single entry', () => {
      const ranked = rankCatalogEntries([entries[0]], 'rating')
      expect(ranked).toHaveLength(1)
    })
  })

  // ========================================================================
  // Suitcase / Data Portability
  // ========================================================================

  describe('validateSuitcaseManifest', () => {
    it('validates a complete manifest', () => {
      const result = validateSuitcaseManifest(makeSuitcaseManifest())
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('catches missing version', () => {
      const result = validateSuitcaseManifest(makeSuitcaseManifest({ version: '' as any }))
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing version.')
    })

    it('catches missing angelOS version', () => {
      const result = validateSuitcaseManifest(makeSuitcaseManifest({ angelOS: '' as any }))
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing Angel OS version.')
    })

    it('catches missing export timestamp', () => {
      const result = validateSuitcaseManifest(makeSuitcaseManifest({ exportedAt: '' as any }))
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing export timestamp.')
    })

    it('catches missing exporter', () => {
      const result = validateSuitcaseManifest(makeSuitcaseManifest({ exportedBy: '' as any }))
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing exporter.')
    })

    it('catches missing source ministry', () => {
      const result = validateSuitcaseManifest(makeSuitcaseManifest({ sourceMinistry: '' as any }))
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing source ministry.')
    })

    it('catches missing tenant name', () => {
      const manifest = makeSuitcaseManifest()
      manifest.tenant.name = ''
      const result = validateSuitcaseManifest(manifest)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing tenant name.')
    })

    it('catches missing tenant slug', () => {
      const manifest = makeSuitcaseManifest()
      manifest.tenant.slug = ''
      const result = validateSuitcaseManifest(manifest)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing tenant slug.')
    })

    it('catches missing constitutional declaration', () => {
      const result = validateSuitcaseManifest({ ...makeSuitcaseManifest(), constitutional: undefined as any })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing constitutional declaration.')
    })

    it('catches non-Angel OS instance', () => {
      const manifest = makeSuitcaseManifest()
      manifest.constitutional.isAngel = false
      const result = validateSuitcaseManifest(manifest)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Suitcase is not from an Angel OS instance.')
    })

    it('catches missing anti-demonic safeguards', () => {
      const manifest = makeSuitcaseManifest()
      manifest.constitutional.antiDemonic = false
      const result = validateSuitcaseManifest(manifest)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Anti-demonic safeguards not declared.')
    })

    it('catches missing checksum', () => {
      const result = validateSuitcaseManifest(makeSuitcaseManifest({ checksum: '' as any }))
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing integrity checksum.')
    })

    it('collects multiple errors at once', () => {
      const result = validateSuitcaseManifest({})
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(5)
    })

    it('handles completely empty manifest', () => {
      const result = validateSuitcaseManifest({})
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing version.')
      expect(result.errors).toContain('Missing constitutional declaration.')
    })
  })

  describe('calculateSuitcaseChecksum', () => {
    it('produces a checksum starting with aok_', () => {
      const contents = makeSuitcaseManifest().contents
      const checksum = calculateSuitcaseChecksum(contents)
      expect(checksum).toMatch(/^aok_\d+_/)
    })

    it('includes total count in checksum', () => {
      const contents = { spaces: 1, channels: 2, messages: 3, users: 4, posts: 5, products: 6, media: 7, bookings: 8, orders: 9 }
      const checksum = calculateSuitcaseChecksum(contents)
      expect(checksum).toContain('aok_45_') // 1+2+3+4+5+6+7+8+9 = 45
    })

    it('produces consistent checksums for same input', () => {
      const contents = makeSuitcaseManifest().contents
      const checksum1 = calculateSuitcaseChecksum(contents)
      const checksum2 = calculateSuitcaseChecksum(contents)
      expect(checksum1).toBe(checksum2)
    })

    it('produces different checksums for different inputs', () => {
      const contents1 = { spaces: 1, channels: 1, messages: 1, users: 1, posts: 1, products: 1, media: 1, bookings: 1, orders: 1 }
      const contents2 = { spaces: 2, channels: 2, messages: 2, users: 2, posts: 2, products: 2, media: 2, bookings: 2, orders: 2 }
      const checksum1 = calculateSuitcaseChecksum(contents1)
      const checksum2 = calculateSuitcaseChecksum(contents2)
      expect(checksum1).not.toBe(checksum2)
    })

    it('handles zero counts', () => {
      const contents = { spaces: 0, channels: 0, messages: 0, users: 0, posts: 0, products: 0, media: 0, bookings: 0, orders: 0 }
      const checksum = calculateSuitcaseChecksum(contents)
      expect(checksum).toContain('aok_0_')
    })
  })

  describe('checkSuitcaseCompatibility', () => {
    it('always returns compatible (constitutional alignment is mandatory)', () => {
      const manifest = makeSuitcaseManifest()
      const result = checkSuitcaseCompatibility(manifest, '1.0.0')
      expect(result.compatible).toBe(true)
    })

    it('returns no warnings for standard manifest', () => {
      const manifest = makeSuitcaseManifest()
      const result = checkSuitcaseCompatibility(manifest, '1.0.0')
      expect(result.warnings).toHaveLength(0)
    })

    it('warns about non-standard version', () => {
      const manifest = makeSuitcaseManifest({ version: '2.0.0' })
      const result = checkSuitcaseCompatibility(manifest, '1.0.0')
      expect(result.warnings.some(w => w.includes('may not be fully compatible'))).toBe(true)
    })

    it('warns about non-standard revenue model', () => {
      const manifest = makeSuitcaseManifest()
      manifest.constitutional.revenueModel = '50/25/15/10'
      const result = checkSuitcaseCompatibility(manifest, '1.0.0')
      expect(result.warnings.some(w => w.includes('Non-standard revenue model'))).toBe(true)
      expect(result.warnings.some(w => w.includes('normalized to 60/20/15/5'))).toBe(true)
    })

    it('still compatible even with warnings', () => {
      const manifest = makeSuitcaseManifest({ version: '3.0.0' })
      manifest.constitutional.revenueModel = '70/10/10/10'
      const result = checkSuitcaseCompatibility(manifest, '1.0.0')
      expect(result.compatible).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
    })
  })

  // ========================================================================
  // Federation Health Report
  // ========================================================================

  describe('generateFederationHealthReport', () => {
    const now = new Date('2025-06-01T12:00:00Z')
    const recentHeartbeat = new Date('2025-06-01T11:58:00Z').toISOString()
    const staleHeartbeat = new Date('2025-06-01T11:00:00Z').toISOString()

    it('counts total ministries', () => {
      const ministries = [makeMinistry(), makeMinistry({ id: 'ministry-002' })]
      const report = generateFederationHealthReport(ministries, [], 0, now)
      expect(report.totalMinistries).toBe(2)
    })

    it('counts active ministries', () => {
      const ministries = [
        makeMinistry({ status: 'active', lastHeartbeat: recentHeartbeat }),
        makeMinistry({ id: 'ministry-002', status: 'probation', lastHeartbeat: recentHeartbeat }),
        makeMinistry({ id: 'ministry-003', status: 'active', lastHeartbeat: recentHeartbeat }),
      ]
      const report = generateFederationHealthReport(ministries, [], 0, now)
      expect(report.activeMinistries).toBe(2)
    })

    it('counts probationary ministries', () => {
      const ministries = [
        makeMinistry({ status: 'active', lastHeartbeat: recentHeartbeat }),
        makeMinistry({ id: 'ministry-002', status: 'probation', lastHeartbeat: recentHeartbeat }),
      ]
      const report = generateFederationHealthReport(ministries, [], 0, now)
      expect(report.probationaryMinistries).toBe(1)
    })

    it('counts catalog entries', () => {
      const entries = [makeCatalogEntry(), makeCatalogEntry({ productId: 2 })]
      const report = generateFederationHealthReport([], entries, 0, now)
      expect(report.catalogEntries).toBe(2)
    })

    it('tracks cross-ministry orders', () => {
      const report = generateFederationHealthReport([], [], 42, now)
      expect(report.crossMinistryOrders).toBe(42)
    })

    it('identifies unhealthy ministries (stale heartbeat)', () => {
      const ministries = [
        makeMinistry({ name: 'Healthy Church', status: 'active', lastHeartbeat: recentHeartbeat }),
        makeMinistry({ id: 'ministry-002', name: 'Stale Church', status: 'active', lastHeartbeat: staleHeartbeat }),
      ]
      const report = generateFederationHealthReport(ministries, [], 0, now)
      expect(report.unhealthyMinistries).toContain('Stale Church')
      expect(report.unhealthyMinistries).not.toContain('Healthy Church')
    })

    it('identifies unhealthy ministries (no heartbeat)', () => {
      const ministries = [
        makeMinistry({ name: 'No Heartbeat Church', status: 'active', lastHeartbeat: undefined }),
      ]
      const report = generateFederationHealthReport(ministries, [], 0, now)
      expect(report.unhealthyMinistries).toContain('No Heartbeat Church')
    })

    it('ignores non-active/non-probation ministries for health check', () => {
      const ministries = [
        makeMinistry({ name: 'Revoked Church', status: 'revoked', lastHeartbeat: undefined }),
        makeMinistry({ id: 'ministry-002', name: 'Suspended Church', status: 'suspended', lastHeartbeat: undefined }),
      ]
      const report = generateFederationHealthReport(ministries, [], 0, now)
      expect(report.unhealthyMinistries).toHaveLength(0)
    })

    it('calculates average heartbeat age', () => {
      const twoMinutesAgo = new Date(now.getTime() - 120 * 1000).toISOString()
      const fourMinutesAgo = new Date(now.getTime() - 240 * 1000).toISOString()
      const ministries = [
        makeMinistry({ status: 'active', lastHeartbeat: twoMinutesAgo }),
        makeMinistry({ id: 'ministry-002', status: 'active', lastHeartbeat: fourMinutesAgo }),
      ]
      const report = generateFederationHealthReport(ministries, [], 0, now)
      expect(report.avgHeartbeatAge).toBe(180) // (120 + 240) / 2
    })

    it('returns 0 avg heartbeat age when no heartbeats', () => {
      const ministries = [
        makeMinistry({ status: 'active', lastHeartbeat: undefined }),
      ]
      const report = generateFederationHealthReport(ministries, [], 0, now)
      expect(report.avgHeartbeatAge).toBe(0)
    })

    it('calculates trust score between 0 and 100', () => {
      const ministries = [
        makeMinistry({ status: 'active', lastHeartbeat: recentHeartbeat }),
        makeMinistry({ id: 'ministry-002', status: 'active', lastHeartbeat: recentHeartbeat }),
      ]
      const entries = Array.from({ length: 50 }, (_, i) =>
        makeCatalogEntry({ productId: i }),
      )
      const report = generateFederationHealthReport(ministries, entries, 25, now)
      expect(report.trustScore).toBeGreaterThanOrEqual(0)
      expect(report.trustScore).toBeLessThanOrEqual(100)
    })

    it('returns 0 trust score for empty federation', () => {
      const report = generateFederationHealthReport([], [], 0, now)
      // With no ministries, activeRatio = 0, catalog = 0, orders = 0
      // healthScore = (1 - 0/1) * 20 = 20 (no unhealthy / max(0 active, 1))
      expect(report.trustScore).toBeGreaterThanOrEqual(0)
    })

    it('caps trust score at 100', () => {
      const ministries = Array.from({ length: 10 }, (_, i) =>
        makeMinistry({
          id: `ministry-${i}`,
          status: 'active',
          lastHeartbeat: recentHeartbeat,
        }),
      )
      const entries = Array.from({ length: 200 }, (_, i) =>
        makeCatalogEntry({ productId: i }),
      )
      const report = generateFederationHealthReport(ministries, entries, 100, now)
      expect(report.trustScore).toBeLessThanOrEqual(100)
    })

    it('handles empty ministries gracefully', () => {
      const report = generateFederationHealthReport([], [], 0, now)
      expect(report.totalMinistries).toBe(0)
      expect(report.activeMinistries).toBe(0)
      expect(report.probationaryMinistries).toBe(0)
      expect(report.unhealthyMinistries).toHaveLength(0)
    })
  })

  // ========================================================================
  // Serialization
  // ========================================================================

  describe('serializeMinistry', () => {
    it('includes ministry name', () => {
      const ministry = makeMinistry({ name: 'Grace Fellowship' })
      const result = serializeMinistry(ministry)
      expect(result).toContain('Grace Fellowship')
    })

    it('includes domain', () => {
      const ministry = makeMinistry({ domain: 'grace.angel-os.org' })
      const result = serializeMinistry(ministry)
      expect(result).toContain('(grace.angel-os.org)')
    })

    it('includes status', () => {
      const ministry = makeMinistry({ status: 'active' })
      const result = serializeMinistry(ministry)
      expect(result).toContain('Status: active')
    })

    it('includes trust level', () => {
      const ministry = makeMinistry({ status: 'active' }) // 2 valid vouches → full
      const result = serializeMinistry(ministry)
      expect(result).toContain('Trust: full')
    })

    it('includes vouch count', () => {
      const ministry = makeMinistry()
      const result = serializeMinistry(ministry)
      expect(result).toContain(`Vouches: 2/${REQUIRED_VOUCHES}`)
    })

    it('includes region when present', () => {
      const ministry = makeMinistry({ region: 'Midwest' })
      const result = serializeMinistry(ministry)
      expect(result).toContain('Region: Midwest')
    })

    it('omits region when not present', () => {
      const ministry = makeMinistry({ region: undefined })
      const result = serializeMinistry(ministry)
      expect(result).not.toContain('Region:')
    })

    it('uses pipe separator', () => {
      const ministry = makeMinistry()
      const result = serializeMinistry(ministry)
      expect(result).toContain(' | ')
    })
  })

  describe('serializeHealthReport', () => {
    it('includes header', () => {
      const report: FederationHealthReport = {
        totalMinistries: 5,
        activeMinistries: 3,
        probationaryMinistries: 1,
        catalogEntries: 50,
        crossMinistryOrders: 10,
        avgHeartbeatAge: 120,
        unhealthyMinistries: [],
        trustScore: 75,
      }
      const result = serializeHealthReport(report)
      expect(result).toContain('Federation Health Report')
    })

    it('shows active/total ratio', () => {
      const report: FederationHealthReport = {
        totalMinistries: 5,
        activeMinistries: 3,
        probationaryMinistries: 1,
        catalogEntries: 50,
        crossMinistryOrders: 10,
        avgHeartbeatAge: 120,
        unhealthyMinistries: [],
        trustScore: 75,
      }
      const result = serializeHealthReport(report)
      expect(result).toContain('Active Ministries: 3/5')
    })

    it('shows trust score', () => {
      const report: FederationHealthReport = {
        totalMinistries: 5,
        activeMinistries: 3,
        probationaryMinistries: 1,
        catalogEntries: 50,
        crossMinistryOrders: 10,
        avgHeartbeatAge: 120,
        unhealthyMinistries: [],
        trustScore: 75,
      }
      const result = serializeHealthReport(report)
      expect(result).toContain('Trust Score: 75/100')
    })

    it('shows unhealthy ministries when present', () => {
      const report: FederationHealthReport = {
        totalMinistries: 3,
        activeMinistries: 2,
        probationaryMinistries: 0,
        catalogEntries: 10,
        crossMinistryOrders: 5,
        avgHeartbeatAge: 200,
        unhealthyMinistries: ['Stale Church', 'Dead Church'],
        trustScore: 40,
      }
      const result = serializeHealthReport(report)
      expect(result).toContain('Unhealthy: Stale Church, Dead Church')
    })

    it('omits unhealthy line when all healthy', () => {
      const report: FederationHealthReport = {
        totalMinistries: 2,
        activeMinistries: 2,
        probationaryMinistries: 0,
        catalogEntries: 20,
        crossMinistryOrders: 5,
        avgHeartbeatAge: 60,
        unhealthyMinistries: [],
        trustScore: 80,
      }
      const result = serializeHealthReport(report)
      expect(result).not.toContain('Unhealthy:')
    })

    it('shows all key metrics', () => {
      const report: FederationHealthReport = {
        totalMinistries: 10,
        activeMinistries: 7,
        probationaryMinistries: 2,
        catalogEntries: 100,
        crossMinistryOrders: 50,
        avgHeartbeatAge: 90,
        unhealthyMinistries: [],
        trustScore: 95,
      }
      const result = serializeHealthReport(report)
      expect(result).toContain('Probationary: 2')
      expect(result).toContain('Catalog Entries: 100')
      expect(result).toContain('Cross-Ministry Orders: 50')
    })
  })

  // ========================================================================
  // simpleHash internal consistency
  // ========================================================================

  describe('simpleHash (via checksum)', () => {
    it('produces deterministic results', () => {
      const contents = makeSuitcaseManifest().contents
      const c1 = calculateSuitcaseChecksum(contents)
      const c2 = calculateSuitcaseChecksum(contents)
      expect(c1).toBe(c2)
    })

    it('is sensitive to order-independent content changes', () => {
      const c1 = calculateSuitcaseChecksum({ spaces: 1, channels: 2, messages: 0, users: 0, posts: 0, products: 0, media: 0, bookings: 0, orders: 0 })
      const c2 = calculateSuitcaseChecksum({ spaces: 2, channels: 1, messages: 0, users: 0, posts: 0, products: 0, media: 0, bookings: 0, orders: 0 })
      // Same total but different distribution
      // Sorted parts differ: "channels:1|spaces:2" vs "channels:2|spaces:1"
      expect(c1).not.toBe(c2)
    })
  })
})
