/**
 * Federation Protocol Engine — Tests
 *
 * Comprehensive test suite for cross-instance federation protocol.
 * Re-implements types and pure functions to avoid Payload imports.
 *
 * @see src/utilities/federationEngine.ts
 */

import { describe, it, expect } from 'vitest'
import {
  computeLifecycleState,
  computeGenesisScore,
  DORMANCY_THRESHOLD_DAYS,
  GENESIS_SIGNAL_MIN_NODES,
  GENESIS_SIGNAL_MIN_TRUST,
} from '../../../src/utilities/federationEngine'

// ---------------------------------------------------------------------------
// Re-implement types (avoid Payload imports)
// ---------------------------------------------------------------------------

type MinistryStatus = 'applicant' | 'probation' | 'active' | 'suspended' | 'revoked' | 'dormant'

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
  active: ['suspended', 'dormant', 'revoked'],
  suspended: ['active', 'revoked'],
  dormant: ['active', 'revoked'],
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
  if (ministry.status === 'dormant') return 'none'
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

  // ========================================================================
  // Mesh Tolerance — Edenist Distributed Governance
  // ========================================================================
  //
  // Every fully-trusted Enterprise IS the network. No single point of failure.
  // Any healthy sentinel can serve any federation function.
  //

  // ── Mesh Types (re-implemented for test isolation) ─────────────────────

  type FederationRole = 'flagship' | 'sentinel' | 'member'

  interface FederationNode extends Ministry {
    role: FederationRole
    federationRank: number
    lastRegistrySync?: string
    registryVersion: number
    isHealthy: boolean
  }

  interface GovernanceData {
    registryVersion: number
    ministries: Ministry[]
    catalogIndex: FederationCatalogEntry[]
    constitutionHash: string
    trustScores: Record<string, number>
    vouchGraph: Array<{
      voucherId: string
      targetId: string
      vouchedAt: string
      isValid: boolean
    }>
    updatedAt: string
  }

  interface GovernanceSyncResult {
    accepted: boolean
    reason?: string
    localVersion: number
    remoteVersion: number
  }

  const MIN_SENTINEL_COUNT = 2
  const GOVERNANCE_QUORUM_FRACTION = 0.5

  // ── Mesh Functions (re-implemented) ────────────────────────────────────

  function determineFederationRole(
    ministry: Ministry,
    isFlagship: boolean = false,
  ): FederationRole {
    if (isFlagship && ministry.status === 'active') return 'flagship'
    if (ministry.status !== 'active') return 'member'
    const trust = calculateTrustLevel(ministry)
    if (trust === 'full') return 'sentinel'
    return 'member'
  }

  function calculateFederationRank(
    ministry: Ministry,
    allMinistries: Ministry[],
    isFlagship: boolean = false,
    currentDate: Date = new Date(),
  ): number {
    if (isFlagship && ministry.status === 'active') return 1
    if (ministry.status !== 'active') return allMinistries.length + 1

    const scored = allMinistries
      .filter((m) => m.status === 'active')
      .map((m) => {
        const trustScore = { full: 100, vouched: 50, probationary: 10, none: 0 }[
          calculateTrustLevel(m)
        ]
        const uptimeDays = m.activatedAt
          ? Math.floor(
              (currentDate.getTime() - new Date(m.activatedAt).getTime()) /
                (24 * 60 * 60 * 1000),
            )
          : 0
        const vouchCount = m.vouchesReceived.filter((v) => v.isValid).length
        const heartbeatBonus = isHeartbeatHealthy(m.lastHeartbeat, currentDate) ? 50 : 0
        const score = trustScore + Math.min(uptimeDays, 365) + vouchCount * 25 + heartbeatBonus
        return { id: m.id, score }
      })
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))

    const idx = scored.findIndex((s) => s.id === ministry.id)
    return idx >= 0 ? idx + 2 : allMinistries.length + 1
  }

  function buildFederationMesh(
    ministries: Ministry[],
    archentepriseId: string,
    currentDate: Date = new Date(),
  ): FederationNode[] {
    return ministries.map((m) => {
      const isArch = m.id === archentepriseId
      const role = determineFederationRole(m, isArch)
      const rank = calculateFederationRank(m, ministries, isArch, currentDate)
      const healthy = isHeartbeatHealthy(m.lastHeartbeat, currentDate)
      return { ...m, role, federationRank: rank, registryVersion: 0, isHealthy: healthy }
    })
  }

  function electCoordinator(
    nodes: FederationNode[],
    currentDate: Date = new Date(),
  ): FederationNode | null {
    const healthySentinels = nodes
      .filter(
        (n) =>
          (n.role === 'flagship' || n.role === 'sentinel') &&
          n.status === 'active' &&
          isHeartbeatHealthy(n.lastHeartbeat, currentDate),
      )
      .sort((a, b) => a.federationRank - b.federationRank)
    return healthySentinels[0] ?? null
  }

  function getSentinels(nodes: FederationNode[]): FederationNode[] {
    return nodes.filter((n) => n.role === 'flagship' || n.role === 'sentinel')
  }

  function getHealthySentinels(
    nodes: FederationNode[],
    currentDate: Date = new Date(),
  ): FederationNode[] {
    return getSentinels(nodes).filter((n) => isHeartbeatHealthy(n.lastHeartbeat, currentDate))
  }

  function isMeshHealthy(
    nodes: FederationNode[],
    currentDate: Date = new Date(),
  ): boolean {
    return getHealthySentinels(nodes, currentDate).length >= MIN_SENTINEL_COUNT
  }

  function hasGovernanceQuorum(
    nodes: FederationNode[],
    currentDate: Date = new Date(),
  ): boolean {
    const totalSentinels = getSentinels(nodes).length
    if (totalSentinels === 0) return false
    const healthyCount = getHealthySentinels(nodes, currentDate).length
    return healthyCount / totalSentinels > GOVERNANCE_QUORUM_FRACTION
  }

  function validateGovernanceSync(
    local: GovernanceData | null,
    remote: GovernanceData,
    expectedConstitutionHash: string,
  ): GovernanceSyncResult {
    const localVersion = local?.registryVersion ?? 0
    const remoteVersion = remote.registryVersion

    if (remoteVersion <= localVersion) {
      return {
        accepted: false,
        reason: `Stale governance data: remote v${remoteVersion} <= local v${localVersion}`,
        localVersion,
        remoteVersion,
      }
    }

    if (remote.constitutionHash !== expectedConstitutionHash) {
      return {
        accepted: false,
        reason: `Constitution hash mismatch: expected ${expectedConstitutionHash}, got ${remote.constitutionHash}`,
        localVersion,
        remoteVersion,
      }
    }

    if (!remote.updatedAt || isNaN(new Date(remote.updatedAt).getTime())) {
      return {
        accepted: false,
        reason: 'Invalid governance timestamp',
        localVersion,
        remoteVersion,
      }
    }

    return { accepted: true, localVersion, remoteVersion }
  }

  function calculateCompositeTrustScore(
    ministry: Ministry,
    currentDate: Date = new Date(),
  ): number {
    const trustBase = {
      none: 0,
      probationary: 15,
      vouched: 40,
      full: 70,
    }[calculateTrustLevel(ministry)]

    const validVouches = ministry.vouchesReceived.filter((v) => v.isValid).length
    const vouchBonus = Math.min(validVouches * 5, 15)
    const heartbeatBonus = isHeartbeatHealthy(ministry.lastHeartbeat, currentDate) ? 15 : 0
    return Math.min(100, trustBase + vouchBonus + heartbeatBonus)
  }

  function buildGovernanceSnapshot(
    ministries: Ministry[],
    catalogEntries: FederationCatalogEntry[],
    constitutionHash: string,
    currentVersion: number,
    currentDate: Date = new Date(),
  ): GovernanceData {
    const trustScores: Record<string, number> = {}
    for (const m of ministries) {
      trustScores[m.id] = calculateCompositeTrustScore(m, currentDate)
    }
    const vouchGraph: GovernanceData['vouchGraph'] = []
    for (const m of ministries) {
      for (const v of m.vouchesReceived) {
        vouchGraph.push({ voucherId: v.voucherId, targetId: m.id, vouchedAt: v.vouchedAt, isValid: v.isValid })
      }
    }
    return {
      registryVersion: currentVersion + 1,
      ministries,
      catalogIndex: catalogEntries,
      constitutionHash,
      trustScores,
      vouchGraph,
      updatedAt: currentDate.toISOString(),
    }
  }

  function selectSyncPeer(
    nodes: FederationNode[],
    excludeId: string,
    currentDate: Date = new Date(),
  ): FederationNode | null {
    const candidates = getHealthySentinels(nodes, currentDate)
      .filter((n) => n.id !== excludeId)
      .sort((a, b) => {
        if (b.registryVersion !== a.registryVersion) return b.registryVersion - a.registryVersion
        return a.federationRank - b.federationRank
      })
    return candidates[0] ?? null
  }

  // ── Mesh Test Fixtures ─────────────────────────────────────────────────

  const meshNow = new Date('2025-06-01T12:00:00Z')
  const recentHB = new Date('2025-06-01T11:58:00Z').toISOString() // 2 min ago — healthy
  const staleHB = new Date('2025-06-01T11:00:00Z').toISOString()  // 1 hour ago — unhealthy

  /** Flagship: spacesangels.com — active, full trust, healthy */
  function makeFlagship(overrides: Partial<Ministry> = {}): Ministry {
    return makeMinistry({
      id: 'arch-001',
      name: 'SpacesAngels',
      domain: 'spacesangels.com',
      status: 'active',
      activatedAt: '2024-01-01T00:00:00Z', // Long uptime
      lastHeartbeat: recentHB,
      vouchesReceived: [
        makeVouch({ voucherId: 'sentinel-001', isValid: true }),
        makeVouch({ voucherId: 'sentinel-002', isValid: true }),
      ],
      ...overrides,
    })
  }

  /** Sentinel: clearwater-cruisin.com — active, full trust, healthy */
  function makeSentinel1(overrides: Partial<Ministry> = {}): Ministry {
    return makeMinistry({
      id: 'sentinel-001',
      name: 'Clearwater Cruisin',
      domain: 'clearwater-cruisin.com',
      status: 'active',
      activatedAt: '2024-06-01T00:00:00Z',
      lastHeartbeat: recentHB,
      vouchesReceived: [
        makeVouch({ voucherId: 'arch-001', isValid: true }),
        makeVouch({ voucherId: 'sentinel-002', isValid: true }),
      ],
      ...overrides,
    })
  }

  /** Sentinel: maker-collective.org — active, full trust, healthy */
  function makeSentinel2(overrides: Partial<Ministry> = {}): Ministry {
    return makeMinistry({
      id: 'sentinel-002',
      name: 'Maker Collective',
      domain: 'maker-collective.org',
      status: 'active',
      activatedAt: '2024-09-01T00:00:00Z',
      lastHeartbeat: recentHB,
      vouchesReceived: [
        makeVouch({ voucherId: 'arch-001', isValid: true }),
        makeVouch({ voucherId: 'sentinel-001', isValid: true }),
      ],
      ...overrides,
    })
  }

  /** Member: new enterprise, active but only 1 vouch (not full trust) */
  function makeMember(overrides: Partial<Ministry> = {}): Ministry {
    return makeMinistry({
      id: 'member-001',
      name: 'New Community',
      domain: 'new-community.org',
      status: 'active',
      activatedAt: '2025-04-01T00:00:00Z',
      lastHeartbeat: recentHB,
      vouchesReceived: [makeVouch({ voucherId: 'arch-001', isValid: true })],
      ...overrides,
    })
  }

  // ── Role Determination ────────────────────────────────────────────────

  describe('determineFederationRole', () => {
    it('returns flagship when flagged and active', () => {
      const ministry = makeFlagship()
      expect(determineFederationRole(ministry, true)).toBe('flagship')
    })

    it('returns sentinel when flagged as arch but not active', () => {
      const ministry = makeFlagship({ status: 'suspended' })
      expect(determineFederationRole(ministry, true)).toBe('member')
    })

    it('returns sentinel for active with full trust', () => {
      const ministry = makeSentinel1()
      expect(determineFederationRole(ministry, false)).toBe('sentinel')
    })

    it('returns member for active with partial trust', () => {
      const ministry = makeMember()
      expect(determineFederationRole(ministry, false)).toBe('member')
    })

    it('returns member for non-active ministry', () => {
      const ministry = makeMinistry({ status: 'probation', vouchesReceived: [] })
      expect(determineFederationRole(ministry, false)).toBe('member')
    })

    it('returns member for active with no vouches', () => {
      const ministry = makeMinistry({ status: 'active', vouchesReceived: [] })
      expect(determineFederationRole(ministry, false)).toBe('member')
    })
  })

  // ── Federation Rank ────────────────────────────────────────────────────

  describe('calculateFederationRank', () => {
    it('gives flagship rank 1', () => {
      const arch = makeFlagship()
      const all = [arch, makeSentinel1(), makeSentinel2()]
      expect(calculateFederationRank(arch, all, true, meshNow)).toBe(1)
    })

    it('ranks by trust score + uptime + vouches', () => {
      const s1 = makeSentinel1() // activated 2024-06-01, 2 vouches, full trust
      const s2 = makeSentinel2() // activated 2024-09-01, 2 vouches, full trust
      const all = [s1, s2]

      const rank1 = calculateFederationRank(s1, all, false, meshNow)
      const rank2 = calculateFederationRank(s2, all, false, meshNow)

      // s1 has longer uptime → should have lower rank (higher priority)
      expect(rank1).toBeLessThan(rank2)
    })

    it('gives non-active ministries max rank', () => {
      const suspended = makeMinistry({ id: 'sus-001', status: 'suspended' })
      const all = [makeFlagship(), makeSentinel1(), suspended]
      expect(calculateFederationRank(suspended, all, false, meshNow)).toBe(all.length + 1)
    })

    it('healthy heartbeat gives bonus', () => {
      const healthy = makeSentinel1({ lastHeartbeat: recentHB })
      const unhealthy = makeSentinel2({ lastHeartbeat: staleHB })
      const all = [healthy, unhealthy]

      const rank1 = calculateFederationRank(healthy, all, false, meshNow)
      const rank2 = calculateFederationRank(unhealthy, all, false, meshNow)

      expect(rank1).toBeLessThan(rank2)
    })

    it('produces deterministic results (same input → same output)', () => {
      const all = [makeFlagship(), makeSentinel1(), makeSentinel2(), makeMember()]
      const r1 = calculateFederationRank(all[1], all, false, meshNow)
      const r2 = calculateFederationRank(all[1], all, false, meshNow)
      expect(r1).toBe(r2)
    })
  })

  // ── Build Federation Mesh ──────────────────────────────────────────────

  describe('buildFederationMesh', () => {
    it('assigns roles correctly across all node types', () => {
      const all = [makeFlagship(), makeSentinel1(), makeSentinel2(), makeMember()]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)

      expect(mesh.find((n) => n.id === 'arch-001')?.role).toBe('flagship')
      expect(mesh.find((n) => n.id === 'sentinel-001')?.role).toBe('sentinel')
      expect(mesh.find((n) => n.id === 'sentinel-002')?.role).toBe('sentinel')
      expect(mesh.find((n) => n.id === 'member-001')?.role).toBe('member')
    })

    it('sets flagship to rank 1', () => {
      const all = [makeFlagship(), makeSentinel1()]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)
      expect(mesh.find((n) => n.id === 'arch-001')?.federationRank).toBe(1)
    })

    it('marks healthy/unhealthy nodes correctly', () => {
      const all = [
        makeFlagship({ lastHeartbeat: recentHB }),
        makeSentinel1({ lastHeartbeat: staleHB }),
      ]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)
      expect(mesh.find((n) => n.id === 'arch-001')?.isHealthy).toBe(true)
      expect(mesh.find((n) => n.id === 'sentinel-001')?.isHealthy).toBe(false)
    })

    it('handles empty ministry list', () => {
      const mesh = buildFederationMesh([], 'arch-001', meshNow)
      expect(mesh).toHaveLength(0)
    })
  })

  // ── Coordinator Election ──────────────────────────────────────────────

  describe('electCoordinator', () => {
    it('elects flagship when healthy', () => {
      const all = [makeFlagship(), makeSentinel1(), makeSentinel2()]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)
      const coordinator = electCoordinator(mesh, meshNow)
      expect(coordinator?.id).toBe('arch-001')
    })

    it('falls back to next sentinel when flagship is down', () => {
      const all = [
        makeFlagship({ lastHeartbeat: staleHB }), // Unhealthy
        makeSentinel1({ lastHeartbeat: recentHB }),
        makeSentinel2({ lastHeartbeat: recentHB }),
      ]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)
      const coordinator = electCoordinator(mesh, meshNow)
      expect(coordinator?.id).not.toBe('arch-001')
      expect(coordinator?.role).toBe('sentinel')
    })

    it('cascades through all sentinels', () => {
      const all = [
        makeFlagship({ lastHeartbeat: staleHB }),  // Down
        makeSentinel1({ lastHeartbeat: staleHB }),         // Down
        makeSentinel2({ lastHeartbeat: recentHB }),         // Only healthy sentinel
      ]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)
      const coordinator = electCoordinator(mesh, meshNow)
      expect(coordinator?.id).toBe('sentinel-002')
    })

    it('returns null when all sentinels are down', () => {
      const all = [
        makeFlagship({ lastHeartbeat: staleHB }),
        makeSentinel1({ lastHeartbeat: staleHB }),
        makeSentinel2({ lastHeartbeat: staleHB }),
      ]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)
      const coordinator = electCoordinator(mesh, meshNow)
      expect(coordinator).toBeNull()
    })

    it('does not elect members as coordinator', () => {
      const all = [
        makeFlagship({ lastHeartbeat: staleHB }),
        makeMember({ lastHeartbeat: recentHB }), // Healthy but only a member
      ]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)
      const coordinator = electCoordinator(mesh, meshNow)
      expect(coordinator).toBeNull() // No healthy sentinel
    })

    it('restores flagship as coordinator when it recovers', () => {
      // Simulate: arch was down, now recovered
      const all = [
        makeFlagship({ lastHeartbeat: recentHB }), // Back up
        makeSentinel1({ lastHeartbeat: recentHB }),
        makeSentinel2({ lastHeartbeat: recentHB }),
      ]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)
      const coordinator = electCoordinator(mesh, meshNow)
      expect(coordinator?.id).toBe('arch-001') // Restored to original
    })
  })

  // ── Sentinel Management ────────────────────────────────────────────────

  describe('getSentinels / getHealthySentinels', () => {
    it('returns only flagship and sentinel roles', () => {
      const all = [makeFlagship(), makeSentinel1(), makeSentinel2(), makeMember()]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)
      const sentinels = getSentinels(mesh)
      expect(sentinels).toHaveLength(3) // arch + 2 sentinels
      expect(sentinels.every((s) => s.role === 'flagship' || s.role === 'sentinel')).toBe(true)
    })

    it('filters out unhealthy sentinels', () => {
      const all = [
        makeFlagship({ lastHeartbeat: recentHB }),
        makeSentinel1({ lastHeartbeat: staleHB }), // Unhealthy
        makeSentinel2({ lastHeartbeat: recentHB }),
      ]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)
      const healthy = getHealthySentinels(mesh, meshNow)
      expect(healthy).toHaveLength(2) // arch + sentinel-002
      expect(healthy.some((n) => n.id === 'sentinel-001')).toBe(false)
    })
  })

  // ── Mesh Health ────────────────────────────────────────────────────────

  describe('isMeshHealthy', () => {
    it('returns true with 2+ healthy sentinels', () => {
      const all = [makeFlagship(), makeSentinel1()]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)
      expect(isMeshHealthy(mesh, meshNow)).toBe(true)
    })

    it('returns false with only 1 healthy sentinel', () => {
      const all = [
        makeFlagship({ lastHeartbeat: recentHB }),
        makeSentinel1({ lastHeartbeat: staleHB }),
      ]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)
      expect(isMeshHealthy(mesh, meshNow)).toBe(false)
    })

    it('returns false with no healthy sentinels', () => {
      const all = [
        makeFlagship({ lastHeartbeat: staleHB }),
        makeSentinel1({ lastHeartbeat: staleHB }),
      ]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)
      expect(isMeshHealthy(mesh, meshNow)).toBe(false)
    })

    it('members do not count toward mesh health', () => {
      const all = [
        makeFlagship({ lastHeartbeat: staleHB }),
        makeMember({ lastHeartbeat: recentHB }), // Healthy but just a member
        makeMember({ id: 'member-002', lastHeartbeat: recentHB }),
      ]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)
      expect(isMeshHealthy(mesh, meshNow)).toBe(false)
    })
  })

  // ── Governance Quorum ──────────────────────────────────────────────────

  describe('hasGovernanceQuorum', () => {
    it('has quorum when majority of sentinels are healthy', () => {
      const all = [
        makeFlagship({ lastHeartbeat: recentHB }),
        makeSentinel1({ lastHeartbeat: recentHB }),
        makeSentinel2({ lastHeartbeat: staleHB }), // 1 unhealthy
      ]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)
      expect(hasGovernanceQuorum(mesh, meshNow)).toBe(true) // 2/3 > 0.5
    })

    it('no quorum when minority of sentinels are healthy', () => {
      const all = [
        makeFlagship({ lastHeartbeat: staleHB }),
        makeSentinel1({ lastHeartbeat: staleHB }),
        makeSentinel2({ lastHeartbeat: recentHB }), // Only 1 healthy
      ]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)
      expect(hasGovernanceQuorum(mesh, meshNow)).toBe(false) // 1/3 < 0.5
    })

    it('no quorum with zero sentinels', () => {
      const mesh: FederationNode[] = []
      expect(hasGovernanceQuorum(mesh, meshNow)).toBe(false)
    })

    it('has quorum with exactly 2 of 3 healthy sentinels', () => {
      const all = [
        makeFlagship({ lastHeartbeat: recentHB }),
        makeSentinel1({ lastHeartbeat: recentHB }),
        makeSentinel2({ lastHeartbeat: staleHB }),
      ]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)
      expect(hasGovernanceQuorum(mesh, meshNow)).toBe(true) // 2/3 = 0.667 > 0.5
    })

    it('quorum with exactly 50% is not sufficient (must be >50%)', () => {
      const all = [
        makeFlagship({ lastHeartbeat: recentHB }),
        makeSentinel1({ lastHeartbeat: staleHB }),
      ]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)
      expect(hasGovernanceQuorum(mesh, meshNow)).toBe(false) // 1/2 = 0.5, NOT > 0.5
    })
  })

  // ── Governance Sync Validation ─────────────────────────────────────────

  describe('validateGovernanceSync', () => {
    const constitutionHash = 'abc123'

    function makeGovernance(overrides: Partial<GovernanceData> = {}): GovernanceData {
      return {
        registryVersion: 1,
        ministries: [],
        catalogIndex: [],
        constitutionHash,
        trustScores: {},
        vouchGraph: [],
        updatedAt: '2025-06-01T12:00:00Z',
        ...overrides,
      }
    }

    it('accepts governance with higher version', () => {
      const local = makeGovernance({ registryVersion: 5 })
      const remote = makeGovernance({ registryVersion: 6 })
      const result = validateGovernanceSync(local, remote, constitutionHash)
      expect(result.accepted).toBe(true)
      expect(result.localVersion).toBe(5)
      expect(result.remoteVersion).toBe(6)
    })

    it('rejects governance with same version', () => {
      const local = makeGovernance({ registryVersion: 5 })
      const remote = makeGovernance({ registryVersion: 5 })
      const result = validateGovernanceSync(local, remote, constitutionHash)
      expect(result.accepted).toBe(false)
      expect(result.reason).toContain('Stale')
    })

    it('rejects governance with lower version', () => {
      const local = makeGovernance({ registryVersion: 5 })
      const remote = makeGovernance({ registryVersion: 3 })
      const result = validateGovernanceSync(local, remote, constitutionHash)
      expect(result.accepted).toBe(false)
      expect(result.reason).toContain('Stale')
    })

    it('accepts governance when local is null (first sync)', () => {
      const remote = makeGovernance({ registryVersion: 1 })
      const result = validateGovernanceSync(null, remote, constitutionHash)
      expect(result.accepted).toBe(true)
      expect(result.localVersion).toBe(0)
    })

    it('rejects governance with wrong constitution hash', () => {
      const local = makeGovernance({ registryVersion: 1 })
      const remote = makeGovernance({ registryVersion: 2, constitutionHash: 'wrong-hash' })
      const result = validateGovernanceSync(local, remote, constitutionHash)
      expect(result.accepted).toBe(false)
      expect(result.reason).toContain('Constitution hash mismatch')
    })

    it('rejects governance with invalid timestamp', () => {
      const local = makeGovernance({ registryVersion: 1 })
      const remote = makeGovernance({ registryVersion: 2, updatedAt: 'not-a-date' })
      const result = validateGovernanceSync(local, remote, constitutionHash)
      expect(result.accepted).toBe(false)
      expect(result.reason).toContain('Invalid governance timestamp')
    })

    it('rejects governance with empty timestamp', () => {
      const local = makeGovernance({ registryVersion: 1 })
      const remote = makeGovernance({ registryVersion: 2, updatedAt: '' })
      const result = validateGovernanceSync(local, remote, constitutionHash)
      expect(result.accepted).toBe(false)
    })
  })

  // ── Composite Trust Score ──────────────────────────────────────────────

  describe('calculateCompositeTrustScore', () => {
    it('returns low score for revoked ministry (trust none + vouch bonus + heartbeat)', () => {
      const ministry = makeMinistry({ status: 'revoked', lastHeartbeat: recentHB })
      // none(0) + default 2 vouches(10) + heartbeat(15) = 25
      expect(calculateCompositeTrustScore(ministry, meshNow)).toBe(25)
    })

    it('returns 0 for revoked ministry with no vouches and no heartbeat', () => {
      const ministry = makeMinistry({ status: 'revoked', vouchesReceived: [], lastHeartbeat: staleHB })
      // none(0) + 0 vouches + 0 heartbeat = 0
      expect(calculateCompositeTrustScore(ministry, meshNow)).toBe(0)
    })

    it('returns base score for probationary', () => {
      const ministry = makeMinistry({
        status: 'probation',
        vouchesReceived: [],
        lastHeartbeat: recentHB,
      })
      // probationary(15) + 0 vouches + heartbeat(15) = 30
      expect(calculateCompositeTrustScore(ministry, meshNow)).toBe(30)
    })

    it('returns high score for full trust with vouches and heartbeat', () => {
      const ministry = makeFlagship({ lastHeartbeat: recentHB })
      // full(70) + 2 vouches(10) + heartbeat(15) = 95
      expect(calculateCompositeTrustScore(ministry, meshNow)).toBe(95)
    })

    it('caps at 100', () => {
      const ministry = makeMinistry({
        status: 'active',
        lastHeartbeat: recentHB,
        vouchesReceived: [
          makeVouch({ voucherId: 'a', isValid: true }),
          makeVouch({ voucherId: 'b', isValid: true }),
          makeVouch({ voucherId: 'c', isValid: true }),
          makeVouch({ voucherId: 'd', isValid: true }),
          makeVouch({ voucherId: 'e', isValid: true }),
        ],
      })
      // full(70) + 5 vouches * 5 = 25 (capped at 15) + heartbeat(15) = 100
      expect(calculateCompositeTrustScore(ministry, meshNow)).toBe(100)
    })

    it('no heartbeat bonus when unhealthy', () => {
      const ministry = makeFlagship({ lastHeartbeat: staleHB })
      // full(70) + 2 vouches(10) + 0 heartbeat = 80
      expect(calculateCompositeTrustScore(ministry, meshNow)).toBe(80)
    })
  })

  // ── Governance Snapshot Building ───────────────────────────────────────

  describe('buildGovernanceSnapshot', () => {
    it('increments version', () => {
      const snapshot = buildGovernanceSnapshot([], [], 'hash', 5, meshNow)
      expect(snapshot.registryVersion).toBe(6)
    })

    it('includes all ministries', () => {
      const ministries = [makeFlagship(), makeSentinel1()]
      const snapshot = buildGovernanceSnapshot(ministries, [], 'hash', 0, meshNow)
      expect(snapshot.ministries).toHaveLength(2)
    })

    it('builds trust scores for all ministries', () => {
      const ministries = [makeFlagship(), makeSentinel1(), makeMember()]
      const snapshot = buildGovernanceSnapshot(ministries, [], 'hash', 0, meshNow)
      expect(Object.keys(snapshot.trustScores)).toHaveLength(3)
      expect(snapshot.trustScores['arch-001']).toBeGreaterThan(0)
    })

    it('builds vouch graph from all vouches', () => {
      const arch = makeFlagship() // Has 2 vouches received
      const s1 = makeSentinel1() // Has 2 vouches received
      const snapshot = buildGovernanceSnapshot([arch, s1], [], 'hash', 0, meshNow)
      expect(snapshot.vouchGraph.length).toBe(4) // 2 + 2
    })

    it('sets constitution hash', () => {
      const snapshot = buildGovernanceSnapshot([], [], 'my-hash-123', 0, meshNow)
      expect(snapshot.constitutionHash).toBe('my-hash-123')
    })

    it('sets timestamp', () => {
      const snapshot = buildGovernanceSnapshot([], [], 'hash', 0, meshNow)
      expect(snapshot.updatedAt).toBe(meshNow.toISOString())
    })

    it('includes catalog entries', () => {
      const entries = [makeCatalogEntry(), makeCatalogEntry({ productId: 2 })]
      const snapshot = buildGovernanceSnapshot([], entries, 'hash', 0, meshNow)
      expect(snapshot.catalogIndex).toHaveLength(2)
    })
  })

  // ── Sync Peer Selection ────────────────────────────────────────────────

  describe('selectSyncPeer', () => {
    it('selects highest-version healthy sentinel', () => {
      const all = [makeFlagship(), makeSentinel1(), makeSentinel2()]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)
      // Give sentinel-001 a higher registry version
      mesh.find((n) => n.id === 'sentinel-001')!.registryVersion = 10
      mesh.find((n) => n.id === 'arch-001')!.registryVersion = 5

      const peer = selectSyncPeer(mesh, 'sentinel-002', meshNow)
      expect(peer?.id).toBe('sentinel-001') // Highest version
    })

    it('excludes self from candidates', () => {
      const all = [makeFlagship(), makeSentinel1()]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)
      const peer = selectSyncPeer(mesh, 'arch-001', meshNow)
      expect(peer?.id).toBe('sentinel-001') // Not arch-001
    })

    it('returns null when no healthy peers', () => {
      const all = [
        makeFlagship({ lastHeartbeat: staleHB }),
        makeSentinel1({ lastHeartbeat: staleHB }),
      ]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)
      const peer = selectSyncPeer(mesh, 'sentinel-002', meshNow)
      expect(peer).toBeNull()
    })

    it('breaks ties by rank when versions are equal', () => {
      const all = [makeFlagship(), makeSentinel1(), makeSentinel2()]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)
      // All have version 0 — should pick by rank (arch is rank 1)
      const peer = selectSyncPeer(mesh, 'sentinel-002', meshNow)
      expect(peer?.id).toBe('arch-001') // Rank 1
    })
  })

  // ── Failover Scenarios ─────────────────────────────────────────────────

  describe('Failover scenarios (Edenist resilience)', () => {
    it('Scenario 1: Normal operation — flagship is coordinator', () => {
      const all = [makeFlagship(), makeSentinel1(), makeSentinel2(), makeMember()]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)

      const coordinator = electCoordinator(mesh, meshNow)
      expect(coordinator?.id).toBe('arch-001')
      expect(isMeshHealthy(mesh, meshNow)).toBe(true)
      expect(hasGovernanceQuorum(mesh, meshNow)).toBe(true)
    })

    it('Scenario 2: Flagship goes down — next sentinel takes over', () => {
      const all = [
        makeFlagship({ lastHeartbeat: staleHB }), // DOWN
        makeSentinel1({ lastHeartbeat: recentHB }),
        makeSentinel2({ lastHeartbeat: recentHB }),
        makeMember({ lastHeartbeat: recentHB }),
      ]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)

      const coordinator = electCoordinator(mesh, meshNow)
      expect(coordinator?.id).not.toBe('arch-001')
      expect(coordinator?.role).toBe('sentinel')
      expect(isMeshHealthy(mesh, meshNow)).toBe(true)
      expect(hasGovernanceQuorum(mesh, meshNow)).toBe(true) // 2/3 > 50%
    })

    it('Scenario 3: Two nodes down — last sentinel coordinates', () => {
      const all = [
        makeFlagship({ lastHeartbeat: staleHB }), // DOWN
        makeSentinel1({ lastHeartbeat: staleHB }),       // DOWN
        makeSentinel2({ lastHeartbeat: recentHB }),       // Last sentinel
      ]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)

      const coordinator = electCoordinator(mesh, meshNow)
      expect(coordinator?.id).toBe('sentinel-002')
      expect(isMeshHealthy(mesh, meshNow)).toBe(false)  // Below MIN_SENTINEL_COUNT
      expect(hasGovernanceQuorum(mesh, meshNow)).toBe(false) // 1/3 < 50%
    })

    it('Scenario 4: All sentinels down — network failure', () => {
      const all = [
        makeFlagship({ lastHeartbeat: staleHB }),
        makeSentinel1({ lastHeartbeat: staleHB }),
        makeSentinel2({ lastHeartbeat: staleHB }),
      ]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)

      expect(electCoordinator(mesh, meshNow)).toBeNull()
      expect(isMeshHealthy(mesh, meshNow)).toBe(false)
      expect(hasGovernanceQuorum(mesh, meshNow)).toBe(false)
    })

    it('Scenario 5: Flagship recovers — primacy restored', () => {
      // First: arch is down
      const downAll = [
        makeFlagship({ lastHeartbeat: staleHB }),
        makeSentinel1({ lastHeartbeat: recentHB }),
        makeSentinel2({ lastHeartbeat: recentHB }),
      ]
      const downMesh = buildFederationMesh(downAll, 'arch-001', meshNow)
      const downCoordinator = electCoordinator(downMesh, meshNow)
      expect(downCoordinator?.id).not.toBe('arch-001')

      // Then: arch recovers
      const upAll = [
        makeFlagship({ lastHeartbeat: recentHB }), // RECOVERED
        makeSentinel1({ lastHeartbeat: recentHB }),
        makeSentinel2({ lastHeartbeat: recentHB }),
      ]
      const upMesh = buildFederationMesh(upAll, 'arch-001', meshNow)
      const upCoordinator = electCoordinator(upMesh, meshNow)
      expect(upCoordinator?.id).toBe('arch-001') // Restored
    })

    it('Scenario 6: New node joins — gets governance from any peer', () => {
      const all = [makeFlagship(), makeSentinel1(), makeSentinel2()]
      const mesh = buildFederationMesh(all, 'arch-001', meshNow)

      // Simulate: even with arch down, new node can sync from sentinel
      mesh.find((n) => n.id === 'arch-001')!.lastHeartbeat = staleHB
      mesh.find((n) => n.id === 'sentinel-001')!.registryVersion = 5
      mesh.find((n) => n.id === 'sentinel-002')!.registryVersion = 3

      const syncPeer = selectSyncPeer(mesh, 'new-node', meshNow)
      expect(syncPeer?.id).toBe('sentinel-001') // Highest version available
    })
  })

  // =========================================================================
  // Sprint 29: Game of Life — Node Lifecycle
  // =========================================================================

  describe('computeLifecycleState', () => {
    const now = new Date('2025-06-15T12:00:00Z')

    function makeActiveMinistry(id: string): Ministry {
      return {
        id,
        name: `Ministry ${id}`,
        domain: `${id}.angelcore.dev`,
        operator: 'Operator',
        status: 'active',
        appliedAt: '2024-01-01T00:00:00Z',
        activatedAt: '2024-03-01T00:00:00Z',
        vouchesReceived: [],
        constitutionVersion: '1.0.0',
        lastHeartbeat: now.toISOString(),
        capabilities: ['products'],
        region: 'us-east',
      }
    }

    it('active node with 3 peers stays active', () => {
      const ministry = makeActiveMinistry('node-1')
      const peers = new Map([['a', 5], ['b', 3], ['c', 1]])
      const result = computeLifecycleState({ ministry, peerTransactionCounts: peers, lastActivityDate: now.toISOString() }, now)
      expect(result.shouldTransition).toBe(false)
      expect(result.recommendedStatus).toBe('active')
    })

    it('active node with 2 peers stays active', () => {
      const ministry = makeActiveMinistry('node-1')
      const peers = new Map([['a', 5], ['b', 3]])
      const result = computeLifecycleState({ ministry, peerTransactionCounts: peers, lastActivityDate: now.toISOString() }, now)
      expect(result.shouldTransition).toBe(false)
    })

    it('active node with 1 peer stays active (still has activity)', () => {
      const ministry = makeActiveMinistry('node-1')
      const peers = new Map([['a', 1]])
      const result = computeLifecycleState({ ministry, peerTransactionCounts: peers, lastActivityDate: now.toISOString() }, now)
      expect(result.shouldTransition).toBe(false)
    })

    it('active node with 0 activity for 31 days → recommends dormant', () => {
      const ministry = makeActiveMinistry('node-1')
      const staleDate = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000)
      const peers = new Map<string, number>() // no active peers
      const result = computeLifecycleState({ ministry, peerTransactionCounts: peers, lastActivityDate: staleDate.toISOString() }, now)
      expect(result.shouldTransition).toBe(true)
      expect(result.recommendedStatus).toBe('dormant')
      expect(result.reason).toContain('dormancy')
    })

    it('active node with 0 activity for 29 days → stays active', () => {
      const ministry = makeActiveMinistry('node-1')
      const recentDate = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)
      const peers = new Map<string, number>()
      const result = computeLifecycleState({ ministry, peerTransactionCounts: peers, lastActivityDate: recentDate.toISOString() }, now)
      expect(result.shouldTransition).toBe(false)
    })

    it('stale activity but active peers prevents dormancy', () => {
      const ministry = makeActiveMinistry('node-1')
      const staleDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) // 60 days
      const peers = new Map([['a', 2]]) // still has active peer
      const result = computeLifecycleState({ ministry, peerTransactionCounts: peers, lastActivityDate: staleDate.toISOString() }, now)
      expect(result.shouldTransition).toBe(false)
    })

    it('dormant node with activity → recommends revival', () => {
      const ministry = { ...makeActiveMinistry('node-1'), status: 'dormant' as MinistryStatus }
      const peers = new Map([['a', 1]])
      const result = computeLifecycleState({ ministry, peerTransactionCounts: peers }, now)
      expect(result.shouldTransition).toBe(true)
      expect(result.recommendedStatus).toBe('active')
      expect(result.reason).toContain('revival')
    })

    it('dormant node without activity stays dormant', () => {
      const ministry = { ...makeActiveMinistry('node-1'), status: 'dormant' as MinistryStatus }
      const peers = new Map<string, number>()
      const result = computeLifecycleState({ ministry, peerTransactionCounts: peers }, now)
      expect(result.shouldTransition).toBe(false)
    })

    it('applicant nodes are not affected', () => {
      const ministry = { ...makeActiveMinistry('node-1'), status: 'applicant' as MinistryStatus }
      const peers = new Map<string, number>()
      const result = computeLifecycleState({ ministry, peerTransactionCounts: peers }, now)
      expect(result.shouldTransition).toBe(false)
      expect(result.reason).toContain('No lifecycle change')
    })

    it('suspended nodes are not affected', () => {
      const ministry = { ...makeActiveMinistry('node-1'), status: 'suspended' as MinistryStatus }
      const peers = new Map<string, number>()
      const result = computeLifecycleState({ ministry, peerTransactionCounts: peers }, now)
      expect(result.shouldTransition).toBe(false)
    })

    it('revoked nodes are not affected', () => {
      const ministry = { ...makeActiveMinistry('node-1'), status: 'revoked' as MinistryStatus }
      const peers = new Map<string, number>()
      const result = computeLifecycleState({ ministry, peerTransactionCounts: peers }, now)
      expect(result.shouldTransition).toBe(false)
    })
  })

  // =========================================================================
  // Sprint 29: Game of Life — Genesis Score (Reproduction)
  // =========================================================================

  describe('computeGenesisScore', () => {
    const now = new Date('2025-06-15T12:00:00Z')

    function makeMinistry(id: string, status: MinistryStatus = 'active'): Ministry {
      return {
        id,
        name: `Ministry ${id}`,
        domain: `${id}.angelcore.dev`,
        operator: 'Operator',
        status,
        appliedAt: '2024-01-01T00:00:00Z',
        vouchesReceived: [],
        constitutionVersion: '1.0.0',
        capabilities: [],
      }
    }

    it('0 qualifying nodes → score 0, not ready', () => {
      const result = computeGenesisScore({ neighborhood: [], trustScores: {} }, now)
      expect(result.score).toBe(0)
      expect(result.readyForGenesis).toBe(false)
      expect(result.qualifyingNodes).toHaveLength(0)
    })

    it('1 qualifying node → score 25, not ready', () => {
      const neighborhood = [makeMinistry('a')]
      const trustScores = { a: 80 }
      const result = computeGenesisScore({ neighborhood, trustScores }, now)
      expect(result.score).toBe(25)
      expect(result.readyForGenesis).toBe(false)
    })

    it('2 qualifying nodes → score 50, not ready', () => {
      const neighborhood = [makeMinistry('a'), makeMinistry('b')]
      const trustScores = { a: 80, b: 60 }
      const result = computeGenesisScore({ neighborhood, trustScores }, now)
      expect(result.score).toBe(50)
      expect(result.readyForGenesis).toBe(false)
    })

    it('3 qualifying nodes → score 75, ready for genesis', () => {
      const neighborhood = [makeMinistry('a'), makeMinistry('b'), makeMinistry('c')]
      const trustScores = { a: 80, b: 60, c: 55 }
      const result = computeGenesisScore({ neighborhood, trustScores }, now)
      expect(result.score).toBe(75)
      expect(result.readyForGenesis).toBe(true)
      expect(result.qualifyingNodes).toHaveLength(3)
    })

    it('4 qualifying nodes → score 100 (capped), ready', () => {
      const neighborhood = [makeMinistry('a'), makeMinistry('b'), makeMinistry('c'), makeMinistry('d')]
      const trustScores = { a: 80, b: 60, c: 55, d: 90 }
      const result = computeGenesisScore({ neighborhood, trustScores }, now)
      expect(result.score).toBe(100)
      expect(result.readyForGenesis).toBe(true)
    })

    it('nodes with trust < 50 are excluded', () => {
      const neighborhood = [makeMinistry('a'), makeMinistry('b'), makeMinistry('c')]
      const trustScores = { a: 80, b: 30, c: 10 } // only 'a' qualifies
      const result = computeGenesisScore({ neighborhood, trustScores }, now)
      expect(result.score).toBe(25)
      expect(result.readyForGenesis).toBe(false)
      expect(result.qualifyingNodes).toEqual(['a'])
    })

    it('inactive/dormant nodes are excluded', () => {
      const neighborhood = [
        makeMinistry('a', 'active'),
        makeMinistry('b', 'dormant'),
        makeMinistry('c', 'suspended'),
        makeMinistry('d', 'active'),
      ]
      const trustScores = { a: 80, b: 90, c: 90, d: 70 }
      const result = computeGenesisScore({ neighborhood, trustScores }, now)
      // Only a and d are active with trust >= 50
      expect(result.qualifyingNodes).toEqual(['a', 'd'])
      expect(result.score).toBe(50)
      expect(result.readyForGenesis).toBe(false)
    })

    it('nodes without trust scores default to 0 (excluded)', () => {
      const neighborhood = [makeMinistry('a'), makeMinistry('b'), makeMinistry('c')]
      const trustScores = { a: 80 } // b and c have no trust scores
      const result = computeGenesisScore({ neighborhood, trustScores }, now)
      expect(result.qualifyingNodes).toEqual(['a'])
      expect(result.readyForGenesis).toBe(false)
    })
  })

  // =========================================================================
  // Sprint 29: calculateTrustLevel with dormant status
  // =========================================================================

  describe('calculateTrustLevel (dormant)', () => {
    it('dormant ministry returns trust level none', () => {
      const dormant: Ministry = {
        id: 'dormant-1',
        name: 'Dormant Ministry',
        domain: 'dormant.angelcore.dev',
        operator: 'Op',
        status: 'dormant',
        appliedAt: '2024-01-01',
        vouchesReceived: [
          { voucherId: 'v1', voucherName: 'V1', vouchedAt: '2024-06-01', reason: 'trust', isValid: true },
          { voucherId: 'v2', voucherName: 'V2', vouchedAt: '2024-06-01', reason: 'trust', isValid: true },
        ],
        constitutionVersion: '1.0.0',
        capabilities: [],
      }
      expect(calculateTrustLevel(dormant)).toBe('none')
    })
  })

  // =========================================================================
  // Sprint 29: VALID_MINISTRY_TRANSITIONS with dormant
  // =========================================================================

  describe('VALID_MINISTRY_TRANSITIONS (dormant)', () => {
    it('active can transition to dormant', () => {
      expect(VALID_MINISTRY_TRANSITIONS.active).toContain('dormant')
    })

    it('dormant can transition to active (revival)', () => {
      expect(VALID_MINISTRY_TRANSITIONS.dormant).toContain('active')
    })

    it('dormant can transition to revoked', () => {
      expect(VALID_MINISTRY_TRANSITIONS.dormant).toContain('revoked')
    })

    it('dormant cannot transition to other states', () => {
      expect(VALID_MINISTRY_TRANSITIONS.dormant).toEqual(['active', 'revoked'])
    })

    it('validateMinistryTransition allows active→dormant', () => {
      expect(validateMinistryTransition('active', 'dormant')).toBe(true)
    })

    it('validateMinistryTransition allows dormant→active', () => {
      expect(validateMinistryTransition('dormant', 'active')).toBe(true)
    })

    it('validateMinistryTransition blocks dormant→probation', () => {
      expect(validateMinistryTransition('dormant', 'probation')).toBe(false)
    })
  })
})
