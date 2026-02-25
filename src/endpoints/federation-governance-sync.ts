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

import type { PayloadHandler } from 'payload'
import { validateGovernanceSync, type GovernanceData } from '@/utilities/federationEngine'
import { getActiveConstitution } from '@/federation/constitution'

/**
 * In-memory governance cache. In production this would be persisted to a
 * dedicated Payload collection (federation-governance), but for the initial
 * implementation we keep it in memory with heartbeat-cron responsible for
 * periodic persistence.
 */
let governanceCache: GovernanceData | null = null

/** Get the current cached governance data (used by heartbeat-cron). */
export function getCachedGovernance(): GovernanceData | null {
  return governanceCache
}

/** Set governance data directly (used by heartbeat-cron when building snapshots). */
export function setCachedGovernance(data: GovernanceData): void {
  governanceCache = data
}

export const federationGovernanceSyncHandler: PayloadHandler = async (req) => {
  const method = req.method?.toUpperCase() ?? (req as Request).method?.toUpperCase()

  // ── GET: Serve governance data ─────────────────────────────────
  if (method === 'GET') {
    if (!governanceCache) {
      return Response.json(
        {
          success: false,
          error: 'No governance data available. This node may not yet be a sentinel.',
        },
        { status: 404 },
      )
    }

    return Response.json({
      success: true,
      governance: governanceCache,
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

    // Accept the governance update
    governanceCache = remoteGovernance

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
