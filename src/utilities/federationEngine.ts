/**
 * Federation Protocol Engine — Sprint 5
 *
 * Pure utility for cross-instance Angel OS federation.
 * Implements the "Ministries" model: sovereign instances that share a
 * constitution, communicate via AI Bus, and form a trust network.
 *
 * Key concepts:
 * - Ministry: A sovereign Angel OS instance (enterprise member)
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
// Mesh Tolerance — Edenist Distributed Governance
// ---------------------------------------------------------------------------
//
// Inspired by PFH's Edenists: every fully-trusted Enterprise IS the network.
// No single point of failure. No hierarchy. Any healthy node can serve any
// federation function. Governance data is replicated across all sentinels
// (active + full trust). If the Flagship goes down, the network
// continues — any sentinel can answer queries, accept pings, and coordinate.
//
// Key principles:
//   1. Every active+full-trust Enterprise replicates governance data
//   2. Deterministic ordering (rank) for coordination — not hierarchy
//   3. Any healthy sentinel can serve as coordinator when needed
//   4. Governance updates propagate via heartbeat cycle
//   5. The network heals itself — returning nodes sync from any peer
//

/** Role in the federation mesh. */
export type FederationRole =
  | 'flagship' // Original founding node — rank 1 by convention
  | 'sentinel'       // Active + full trust — replicates governance, can coordinate
  | 'member'         // Active but not yet fully trusted — participates, doesn't replicate

/** Extended ministry with mesh fields. */
export interface FederationNode extends Ministry {
  role: FederationRole
  federationRank: number            // Deterministic ordering (1 = highest priority coordinator)
  lastRegistrySync?: string         // When this node last synced governance data
  registryVersion: number           // Monotonic version of governance data held
  isHealthy: boolean                // Derived from heartbeat freshness
}

/** Replicated governance state — held by every sentinel. */
export interface GovernanceData {
  registryVersion: number           // Monotonic counter, incremented on every change
  ministries: Ministry[]            // Full federation registry
  catalogIndex: FederationCatalogEntry[] // Cross-instance product discovery
  constitutionHash: string          // Cryptographic integrity check
  trustScores: Record<string, number>   // Ministry ID → composite trust score
  vouchGraph: Array<{               // Who vouched for whom — reputational chain
    voucherId: string
    targetId: string
    vouchedAt: string
    isValid: boolean
  }>
  updatedAt: string                 // ISO timestamp of last governance change
}

/** Result of a governance sync attempt. */
export interface GovernanceSyncResult {
  accepted: boolean
  reason?: string
  localVersion: number
  remoteVersion: number
}

/** Minimum number of sentinels for healthy mesh (including flagship). */
export const MIN_SENTINEL_COUNT = 2

/** Maximum governance data age before a sentinel should re-sync (seconds). */
export const MAX_GOVERNANCE_AGE_SECONDS = 600 // 10 minutes

/** Quorum fraction for governance actions (>50% of healthy sentinels). */
export const GOVERNANCE_QUORUM_FRACTION = 0.5

// ── Mesh Functions ─────────────────────────────────────────────────────────

/**
 * Determine a ministry's role in the federation mesh.
 *
 * - flagship: explicitly flagged (only one per federation, rank 1)
 * - sentinel: active status + full trust (2+ valid vouches)
 * - member: active but not yet fully trusted
 *
 * Non-active ministries (applicant, probation, suspended, revoked) have no
 * mesh role — they don't participate in governance.
 */
export function determineFederationRole(
  ministry: Ministry,
  isFlagship: boolean = false,
): FederationRole {
  if (isFlagship && ministry.status === 'active') return 'flagship'

  if (ministry.status !== 'active') return 'member'

  const trust = calculateTrustLevel(ministry)
  if (trust === 'full') return 'sentinel'

  return 'member'
}

/**
 * Calculate a ministry's federation rank — deterministic ordering for
 * coordinator selection. Lower rank = higher priority.
 *
 * Rank factors (weighted):
 *   - Flagship flag: always rank 1
 *   - Trust level: full=100, vouched=50, probationary=10
 *   - Uptime: days since activation (capped at 365)
 *   - Vouch count: more diverse vouches = higher rank
 *   - Heartbeat reliability: healthy = +50
 *
 * This is NOT a hierarchy — it's a deterministic tiebreaker so all nodes
 * independently arrive at the same coordinator choice.
 */
export function calculateFederationRank(
  ministry: Ministry,
  allMinistries: Ministry[],
  isFlagship: boolean = false,
  currentDate: Date = new Date(),
): number {
  // Flagship always rank 1 (by convention, not privilege)
  if (isFlagship && ministry.status === 'active') return 1

  // Non-active ministries get max rank (lowest priority)
  if (ministry.status !== 'active') return allMinistries.length + 1

  // Score all active ministries, sort by score descending, assign ranks
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

      const score =
        trustScore +
        Math.min(uptimeDays, 365) +
        vouchCount * 25 +
        heartbeatBonus

      return { id: m.id, score }
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)) // Deterministic tiebreak

  const idx = scored.findIndex((s) => s.id === ministry.id)
  // +2 because rank 1 is reserved for flagship
  return idx >= 0 ? idx + 2 : allMinistries.length + 1
}

/**
 * Build the full mesh — convert ministries to FederationNodes with roles and ranks.
 */
export function buildFederationMesh(
  ministries: Ministry[],
  archentepriseId: string,
  currentDate: Date = new Date(),
): FederationNode[] {
  return ministries.map((m) => {
    const isArch = m.id === archentepriseId
    const role = determineFederationRole(m, isArch)
    const rank = calculateFederationRank(m, ministries, isArch, currentDate)
    const healthy = isHeartbeatHealthy(m.lastHeartbeat, currentDate)

    return {
      ...m,
      role,
      federationRank: rank,
      registryVersion: 0,
      isHealthy: healthy,
    }
  })
}

/**
 * Elect a coordinator from the mesh — the highest-ranked healthy sentinel.
 *
 * This is NOT a "leader" — it's a coordinator for operations that need a
 * single point of contact (e.g., accepting new members). Any sentinel can
 * serve this role. If the current coordinator goes down, the next sentinel
 * in rank order takes over automatically.
 *
 * Edenist principle: the coordinator is emergent, not appointed.
 */
export function electCoordinator(
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

/**
 * Get all sentinels (nodes eligible for governance replication).
 * Includes flagship + all active nodes with full trust.
 */
export function getSentinels(nodes: FederationNode[]): FederationNode[] {
  return nodes.filter(
    (n) => n.role === 'flagship' || n.role === 'sentinel',
  )
}

/**
 * Get healthy sentinels — nodes that can currently serve governance queries.
 */
export function getHealthySentinels(
  nodes: FederationNode[],
  currentDate: Date = new Date(),
): FederationNode[] {
  return getSentinels(nodes).filter((n) =>
    isHeartbeatHealthy(n.lastHeartbeat, currentDate),
  )
}

/**
 * Check if the mesh has sufficient redundancy.
 * Returns true if at least MIN_SENTINEL_COUNT healthy sentinels exist.
 */
export function isMeshHealthy(
  nodes: FederationNode[],
  currentDate: Date = new Date(),
): boolean {
  return getHealthySentinels(nodes, currentDate).length >= MIN_SENTINEL_COUNT
}

/**
 * Check if a governance quorum exists — enough healthy sentinels to
 * authorize governance changes (new member acceptance, revocation, etc.).
 */
export function hasGovernanceQuorum(
  nodes: FederationNode[],
  currentDate: Date = new Date(),
): boolean {
  const totalSentinels = getSentinels(nodes).length
  if (totalSentinels === 0) return false

  const healthyCount = getHealthySentinels(nodes, currentDate).length
  return healthyCount / totalSentinels > GOVERNANCE_QUORUM_FRACTION
}

/**
 * Validate incoming governance data for acceptance.
 *
 * Rules:
 *   1. Remote version must be higher than local version (monotonic)
 *   2. Constitution hash must match (same constitutional foundation)
 *   3. Data must have a valid timestamp
 */
export function validateGovernanceSync(
  local: GovernanceData | null,
  remote: GovernanceData,
  expectedConstitutionHash: string,
): GovernanceSyncResult {
  const localVersion = local?.registryVersion ?? 0
  const remoteVersion = remote.registryVersion

  // Version must advance monotonically
  if (remoteVersion <= localVersion) {
    return {
      accepted: false,
      reason: `Stale governance data: remote v${remoteVersion} <= local v${localVersion}`,
      localVersion,
      remoteVersion,
    }
  }

  // Constitutional foundation must match — non-negotiable
  if (remote.constitutionHash !== expectedConstitutionHash) {
    return {
      accepted: false,
      reason: `Constitution hash mismatch: expected ${expectedConstitutionHash}, got ${remote.constitutionHash}`,
      localVersion,
      remoteVersion,
    }
  }

  // Must have a valid timestamp
  if (!remote.updatedAt || isNaN(new Date(remote.updatedAt).getTime())) {
    return {
      accepted: false,
      reason: 'Invalid governance timestamp',
      localVersion,
      remoteVersion,
    }
  }

  return {
    accepted: true,
    localVersion,
    remoteVersion,
  }
}

/**
 * Calculate a composite trust score for a ministry (0-100).
 * Used in governance data's trustScores map.
 *
 * Factors:
 *   - Trust level: none=0, probationary=15, vouched=40, full=70
 *   - Vouch count bonus: +5 per valid vouch (max 15)
 *   - Heartbeat health: +15 if healthy
 *
 * This score feeds into federation rank calculations and governance
 * weighting. It's replicated across the mesh so all nodes agree.
 */
export function calculateCompositeTrustScore(
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

  const heartbeatBonus = isHeartbeatHealthy(ministry.lastHeartbeat, currentDate)
    ? 15
    : 0

  return Math.min(100, trustBase + vouchBonus + heartbeatBonus)
}

/**
 * Build a governance data snapshot from current federation state.
 *
 * Called by the coordinator (or any sentinel) when governance changes occur.
 * The snapshot is then propagated to all sentinels during heartbeat cycles.
 */
export function buildGovernanceSnapshot(
  ministries: Ministry[],
  catalogEntries: FederationCatalogEntry[],
  constitutionHash: string,
  currentVersion: number,
  currentDate: Date = new Date(),
): GovernanceData {
  // Build trust scores map
  const trustScores: Record<string, number> = {}
  for (const m of ministries) {
    trustScores[m.id] = calculateCompositeTrustScore(m, currentDate)
  }

  // Build vouch graph from all ministries
  const vouchGraph: GovernanceData['vouchGraph'] = []
  for (const m of ministries) {
    for (const v of m.vouchesReceived) {
      vouchGraph.push({
        voucherId: v.voucherId,
        targetId: m.id,
        vouchedAt: v.vouchedAt,
        isValid: v.isValid,
      })
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

/**
 * Select the best peer to sync governance data from.
 *
 * Prefers: highest-ranked healthy sentinel with the newest registryVersion.
 * Any sentinel can serve as sync source — no dependency on a single node.
 */
export function selectSyncPeer(
  nodes: FederationNode[],
  excludeId: string,
  currentDate: Date = new Date(),
): FederationNode | null {
  const candidates = getHealthySentinels(nodes, currentDate)
    .filter((n) => n.id !== excludeId)
    .sort((a, b) => {
      // Prefer higher registry version, then lower rank
      if (b.registryVersion !== a.registryVersion) {
        return b.registryVersion - a.registryVersion
      }
      return a.federationRank - b.federationRank
    })

  return candidates[0] ?? null
}

/**
 * Generate a mesh health report — extends the basic health report with
 * mesh-specific metrics.
 */
export interface MeshHealthReport extends FederationHealthReport {
  totalSentinels: number
  healthySentinels: number
  coordinatorId: string | null
  coordinatorDomain: string | null
  meshHealthy: boolean
  hasQuorum: boolean
  governanceVersion: number
}

export function generateMeshHealthReport(
  nodes: FederationNode[],
  catalogEntries: FederationCatalogEntry[],
  crossMinistryOrders: number,
  governanceVersion: number,
  currentDate: Date = new Date(),
): MeshHealthReport {
  // Get base health report from underlying ministries
  const baseReport = generateFederationHealthReport(
    nodes,
    catalogEntries,
    crossMinistryOrders,
    currentDate,
  )

  const sentinels = getSentinels(nodes)
  const healthySentinelNodes = getHealthySentinels(nodes, currentDate)
  const coordinator = electCoordinator(nodes, currentDate)

  return {
    ...baseReport,
    totalSentinels: sentinels.length,
    healthySentinels: healthySentinelNodes.length,
    coordinatorId: coordinator?.id ?? null,
    coordinatorDomain: coordinator?.domain ?? null,
    meshHealthy: isMeshHealthy(nodes, currentDate),
    hasQuorum: hasGovernanceQuorum(nodes, currentDate),
    governanceVersion,
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
