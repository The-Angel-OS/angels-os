/**
 * Federation Governance Sync — POST/GET /api/federation/governance-sync
 *
 * Edenist mesh replication endpoint. Every sentinel (active + full trust)
 * holds a complete copy of governance data. This endpoint enables:
 *
 *   POST: Receive governance snapshot from another sentinel (push replication)
 *   GET:  Serve governance data to any node requesting a sync
 *
 * The mesh has no single coordinator — any sentinel can push updates and any
 * sentinel can serve data. Version numbers are monotonic: a node only accepts
 * governance data with a higher version than its current copy.
 *
 * Constitutional Reference: Article VII — Federation protocol
 *
 * @see src/utilities/federationEngine.ts — mesh tolerance types and functions
 */

import type { PayloadHandler, Payload } from 'payload'
import {
  validateGovernanceSync,
  buildGovernanceSnapshot,
  type GovernanceData,
  type Ministry,
} from '@/utilities/federationEngine'
import { getActiveConstitution } from '@/federation/constitution'

/**
 * Governance cache — in-memory for fast reads, persisted to the tenants
 * collection for crash recovery and cross-instance consistency.
 *
 * Flow:
 *   1. On first read/write, load from DB into memory (lazy hydration)
 *   2. Every accepted update writes through to both memory AND DB
 *   3. On process restart, the cache is hydrated from DB on first access
 *
 * Persistence key: tenants[0].setup.governanceData (JSON field)
 */
let governanceCache: GovernanceData | null = null
let cacheHydrated = false

/** Get the current cached governance data (used by heartbeat-cron). */
export function getCachedGovernance(): GovernanceData | null {
  return governanceCache
}

/** Set governance data directly (used by heartbeat-cron when building snapshots). */
export function setCachedGovernance(data: GovernanceData): void {
  governanceCache = data
}

/**
 * Set governance data and persist to database.
 * Use this variant from cron/heartbeat where a Payload instance is available.
 */
export function setCachedGovernanceWithPersist(data: GovernanceData, payload: Payload): void {
  governanceCache = data
  persistGovernance(payload, data).catch((err) => {
    console.error('[FederationGov] Failed to persist governance to DB:', err)
  })
}

/**
 * Hydrate governance cache from database on first access.
 * This ensures governance data survives process restarts (Vercel cold starts,
 * deploys, crashes).
 */
async function hydrateGovernanceCache(payload: Payload): Promise<void> {
  if (cacheHydrated) return
  cacheHydrated = true

  try {
    const tenants = await payload.find({
      collection: 'tenants',
      limit: 1,
      depth: 0,
      overrideAccess: true,
      sort: 'createdAt',
    })
    const tenant = tenants.docs[0] as unknown as Record<string, unknown> | undefined
    const setup = tenant?.setup as Record<string, unknown> | undefined
    const stored = setup?.governanceData as GovernanceData | undefined

    if (stored && typeof stored.registryVersion === 'number') {
      governanceCache = stored
    }
  } catch (err) {
    console.warn('[Federation Governance] Failed to hydrate from DB:', err)
  }
}

/**
 * Persist governance data to the tenant record.
 * Fire-and-forget — failures are logged but don't block the sync response.
 */
async function persistGovernance(payload: Payload, data: GovernanceData): Promise<void> {
  try {
    const tenants = await payload.find({
      collection: 'tenants',
      limit: 1,
      depth: 0,
      overrideAccess: true,
      sort: 'createdAt',
    })
    const tenant = tenants.docs[0]
    if (!tenant) return

    const existingSetup = (tenant as unknown as Record<string, unknown>).setup as Record<string, unknown> | undefined

    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        setup: {
          ...(existingSetup || {}),
          governanceData: data,
        },
      } as any,
      overrideAccess: true,
    })
  } catch (err) {
    console.warn('[Federation Governance] Failed to persist to DB:', err)
  }
}

/**
 * Build a governance snapshot from THIS node's live mesh view — its own identity
 * plus its federation-peers (Dioceses). Lets any node serve the current network
 * roster on demand, even before a sentinel pushes a synced copy. The Diocese is
 * the unit; endeavors inherit and are not listed here.
 */
async function buildGovernanceFromMesh(payload: Payload): Promise<GovernanceData> {
  const constitution = getActiveConstitution()
  const constitutionHash = constitution.checksum || constitution.version
  const now = new Date()
  const ministries: Ministry[] = []

  // Self (the local Enterprise/Diocese)
  const tenants = await payload.find({ collection: 'tenants', limit: 1, depth: 0, overrideAccess: true, sort: 'createdAt' })
  const tenant = tenants.docs[0] as unknown as Record<string, unknown> | undefined
  const setup = (tenant?.setup as Record<string, unknown>) || {}
  const selfFedId = setup.federationId as string | undefined
  if (selfFedId && tenant) {
    ministries.push({
      id: selfFedId,
      name: (tenant.name as string) || 'This Enterprise',
      domain: (tenant.domain as string) || '',
      operator: '',
      status: 'active',
      appliedAt: String(tenant.createdAt || now.toISOString()),
      vouchesReceived: [],
      constitutionVersion: constitution.version,
      lastHeartbeat: now.toISOString(),
      capabilities: [],
    })
  }

  // Peer Dioceses
  const peers = await payload.find({
    collection: 'federation-peers',
    where: { networkVisible: { equals: true } },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  for (const p of peers.docs as unknown as Array<Record<string, unknown>>) {
    ministries.push({
      id: (p.federationId as string) || String(p.id),
      name: (p.name as string) || 'Unknown Diocese',
      domain: (p.domain as string) || '',
      operator: '',
      status: (p.ministryStatus as Ministry['status']) || 'active',
      appliedAt: String(p.firstSeenAt || p.createdAt || now.toISOString()),
      vouchesReceived: Array.isArray(p.vouchesReceived) ? (p.vouchesReceived as Ministry['vouchesReceived']) : [],
      constitutionVersion: (p.constitutionVersion as string) || constitution.version,
      lastHeartbeat: (p.lastHeartbeatAt as string) || undefined,
      capabilities: Array.isArray(p.capabilities) ? (p.capabilities as string[]) : [],
    })
  }

  return buildGovernanceSnapshot(ministries, [], constitutionHash, governanceCache?.registryVersion ?? 0, now)
}

export const federationGovernanceSyncHandler: PayloadHandler = async (req) => {
  const method = req.method?.toUpperCase() ?? (req as Request).method?.toUpperCase()

  // Hydrate cache from DB on first access (survives cold starts)
  await hydrateGovernanceCache(req.payload)

  // ── GET: Serve governance data ─────────────────────────────────
  // No synced copy yet? Build the current roster from our own live mesh view
  // (self + federation-peers) so the endpoint always reflects the network.
  if (method === 'GET') {
    if (!governanceCache) {
      try {
        governanceCache = await buildGovernanceFromMesh(req.payload)
      } catch (err) {
        console.warn('[Federation Governance] Failed to build from mesh:', err)
      }
    }

    return Response.json({
      success: true,
      governance: governanceCache,
      source: governanceCache ? 'live-mesh' : 'empty',
    })
  }

  // ── POST: Receive governance snapshot from peer ────────────────
  if (method === 'POST') {
    let body: Record<string, unknown>
    try {
      body = (await (req as Request).json()) as Record<string, unknown>
    } catch {
      return Response.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const remoteGovernance = body.governance as GovernanceData | undefined
    if (!remoteGovernance || typeof remoteGovernance.registryVersion !== 'number') {
      return Response.json(
        { success: false, error: 'Missing or invalid governance data' },
        { status: 400 },
      )
    }

    // Validate against our constitution
    const constitution = getActiveConstitution()
    const constitutionHash = constitution.checksum || constitution.version

    const result = validateGovernanceSync(
      governanceCache,
      remoteGovernance,
      constitutionHash,
    )

    if (!result.accepted) {
      return Response.json({
        success: false,
        error: result.reason,
        localVersion: result.localVersion,
        remoteVersion: result.remoteVersion,
      }, { status: 409 }) // Conflict
    }

    // Accept the governance update — write through to memory AND database
    governanceCache = remoteGovernance
    persistGovernance(req.payload, remoteGovernance).catch((err) => {
      console.error('[FederationGov] Failed to persist governance update to DB:', err)
    })

    return Response.json({
      success: true,
      accepted: true,
      previousVersion: result.localVersion,
      currentVersion: result.remoteVersion,
      message: `Governance data updated: v${result.localVersion} → v${result.remoteVersion}`,
    })
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 })
}
