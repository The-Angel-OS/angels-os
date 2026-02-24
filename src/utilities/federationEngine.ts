/**
 * Federation Protocol Engine — Sprint 5
 *
 * Pure utility for cross-instance Angel OS federation.
 * Implements the "Ministries" model: sovereign instances that share a
 * constitution, communicate via AI Bus, and form a trust network.
 *
 * Key concepts:
 * - Ministry: A sovereign Angel OS instance (diocese member)
 * - Trust Chain: Application → 90-day probation → 2 vouches → full membership
 * - Federation Catalog: Cross-instance product discovery (networkListing: true)
 * - Data Portability: Suitcase export/import for constitutional mobility
 *
 * Zero Payload imports — fully testable and usable in edge functions.
 *
 * @see docs/angel-os-architecture/ — federation architecture docs
 * @see tests/unit/utilities/federationEngine.test.ts
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MinistryStatus =
  | 'applicant'
  | 'probation'
  | 'active'
  | 'suspended'
  | 'revoked'

export type TrustLevel =
  | 'none'
  | 'probationary'
  | 'vouched'
  | 'full'

export interface Ministry {
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

export interface Vouch {
  voucherId: string
  voucherName: string
  vouchedAt: string
  reason: string
  isValid: boolean
}

export interface FederationCatalogEntry {
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

export interface SuitcaseManifest {
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

export interface FederationHealthReport {
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
// Constants
// ---------------------------------------------------------------------------

/** Probation period in days. */
export const PROBATION_DAYS = 90

/** Required vouches for full membership. */
export const REQUIRED_VOUCHES = 2

/** Maximum heartbeat age before marking unhealthy (in seconds). */
export const MAX_HEARTBEAT_AGE_SECONDS = 300 // 5 minutes

/** Minimum constitution version for federation. */
export const MIN_CONSTITUTION_VERSION = '1.0.0'

/** Valid ministry status transitions. */
export const VALID_MINISTRY_TRANSITIONS: Record<MinistryStatus, MinistryStatus[]> = {
  applicant: ['probation', 'revoked'],
  probation: ['active', 'suspended', 'revoked'],
  active: ['suspended', 'revoked'],
  suspended: ['active', 'revoked'],
  revoked: [], // Terminal state
}

// ---------------------------------------------------------------------------
// Ministry Lifecycle
// ---------------------------------------------------------------------------

/** Validate a ministry status transition. */
export function validateMinistryTransition(
  from: MinistryStatus,
  to: MinistryStatus,
): boolean {
  return VALID_MINISTRY_TRANSITIONS[from]?.includes(to) ?? false
}

/** Determine trust level from ministry status and vouches. */
export function calculateTrustLevel(ministry: Ministry): TrustLevel {
  if (ministry.status === 'revoked' || ministry.status === 'suspended') return 'none'
  if (ministry.status === 'applicant') return 'none'
  if (ministry.status === 'probation') return 'probationary'

  const validVouches = ministry.vouchesReceived.filter((v) => v.isValid).length
  if (validVouches >= REQUIRED_VOUCHES) return 'full'
  if (validVouches > 0) return 'vouched'

  return 'probationary'
}

/** Check if a ministry can be promoted from probation to active. */
export function canPromoteToActive(
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

/** Validate a vouch request. */
export function validateVouch(
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

// ---------------------------------------------------------------------------
// Heartbeat & Health
// ---------------------------------------------------------------------------

/** Check if a ministry heartbeat is healthy. */
export function isHeartbeatHealthy(
  lastHeartbeat: string | undefined,
  currentDate: Date = new Date(),
): boolean {
  if (!lastHeartbeat) return false
  const age = (currentDate.getTime() - new Date(lastHeartbeat).getTime()) / 1000
  return age <= MAX_HEARTBEAT_AGE_SECONDS
}

/** Calculate heartbeat age in seconds. */
export function getHeartbeatAge(
  lastHeartbeat: string | undefined,
  currentDate: Date = new Date(),
): number {
  if (!lastHeartbeat) return Infinity
  return (currentDate.getTime() - new Date(lastHeartbeat).getTime()) / 1000
}

// ---------------------------------------------------------------------------
// Federation Catalog
// ---------------------------------------------------------------------------

/** Filter catalog entries by capability. */
export function searchCatalog(
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

/** Sort catalog entries by relevance. */
export function rankCatalogEntries(
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

// ---------------------------------------------------------------------------
// Data Portability — Suitcase Validation
// ---------------------------------------------------------------------------

/** Validate a suitcase manifest for import. */
export function validateSuitcaseManifest(
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

/** Calculate a simple checksum for suitcase contents. */
export function calculateSuitcaseChecksum(
  contents: SuitcaseManifest['contents'],
): string {
  const total = Object.values(contents).reduce((sum, count) => sum + count, 0)
  const parts = Object.entries(contents)
    .map(([key, count]) => `${key}:${count}`)
    .sort()
    .join('|')
  return `aok_${total}_${simpleHash(parts)}`
}

/** Simple hash for checksum (not cryptographic — for integrity checking). */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}

/** Check if a suitcase is compatible with the current instance. */
export function checkSuitcaseCompatibility(
  manifest: SuitcaseManifest,
  currentConstitutionVersion: string,
): { compatible: boolean; warnings: string[] } {
  const warnings: string[] = []

  // Version check
  if (manifest.version !== '1.0.0') {
    warnings.push(`Suitcase version ${manifest.version} may not be fully compatible.`)
  }

  // Constitutional compatibility
  if (manifest.constitutional.revenueModel !== '70/20/4/1/5') {
    warnings.push(
      `Non-standard revenue model: ${manifest.constitutional.revenueModel}. Will be normalized to 70/20/4/1/5 (Toward-53).`,
    )
  }

  return {
    compatible: true, // Always attempt import — constitutional alignment is mandatory
    warnings,
  }
}

// ---------------------------------------------------------------------------
// Federation Health Report
// ---------------------------------------------------------------------------

/** Generate a federation health report. */
export function generateFederationHealthReport(
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

  // Trust score: 0-100 based on active ratio, catalog size, and order volume
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

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/** Format a ministry for display. */
export function serializeMinistry(ministry: Ministry): string {
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

/** Format a health report for display. */
export function serializeHealthReport(report: FederationHealthReport): string {
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
