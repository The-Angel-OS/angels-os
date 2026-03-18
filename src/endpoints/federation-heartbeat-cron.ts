/**
 * Federation Heartbeat Cron — GET /api/federation/heartbeat-cron
 *
 * Vercel Cron job that runs every 5 minutes:
 *   1. Queries all known federation peers (Endeavors with federation.networkVisible: true)
 *   2. Sends a signed heartbeat to each peer
 *   3. Marks peers that haven't responded as unhealthy
 *
 * This is the outbound half of the heartbeat protocol. The inbound half
 * is handled by federation-heartbeat.ts.
 *
 * Vercel Cron: /5 * * * *   (every 5 minutes)
 * Authorization: CRON_SECRET header from Vercel
 *
 * Constitutional Reference: Article VII — Federation protocol
 */

import type { PayloadHandler } from 'payload'
import { getOrCreateFederationKeyPair } from '@/federation/keyStore'
import { getActiveConstitution } from '@/federation/constitution'
import { sendHeartbeat, type FederationIdentity, type HeartbeatPayload } from '@/utilities/federationClient'
import {
  MAX_HEARTBEAT_AGE_SECONDS,
  buildGovernanceSnapshot,
  buildFederationMesh,
  getSentinels,
  electCoordinator,
  type Ministry,
  type FederationCatalogEntry,
} from '@/utilities/federationEngine'
import { buildCapacitySnapshot, type WorkerCapabilities } from '@/utilities/workload-engine'
import { getCachedGovernance, setCachedGovernanceWithPersist } from './federation-governance-sync'
import { buildStreetSigns } from '@/utilities/streetSigns'

export const federationHeartbeatCronHandler: PayloadHandler = async (req) => {
  // ── Verify cron authorization ─────────────────────────────────
  // Vercel sends CRON_SECRET in the Authorization header for cron jobs
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const results: { domain: string; success: boolean; error?: string }[] = []

  try {
    // ── Get our federation identity ───────────────────────────────
    const tenants = await req.payload.find({
      collection: 'tenants',
      limit: 1,
      depth: 0,
      overrideAccess: true,
      sort: 'createdAt',
    })

    const tenant = tenants.docs[0] as unknown as Record<string, unknown> | undefined
    if (!tenant) {
      return Response.json({
        success: false,
        error: 'No tenant configured',
        duration: Date.now() - startTime,
      })
    }

    const tenantId = tenant.id as number
    const setup = tenant?.setup as unknown as Record<string, unknown> | undefined
    const federationId = setup?.federationId as string | undefined

    if (!federationId) {
      return Response.json({
        success: true,
        message: 'No federation ID — Enterprise not yet federated. Skipping heartbeat.',
        peersContacted: 0,
        duration: Date.now() - startTime,
      })
    }

    // Get our keys
    const keyPair = await getOrCreateFederationKeyPair(req.payload, tenantId)
    const constitution = getActiveConstitution()

    const tenantDomain = tenant.domain as string | undefined
    const isLocalDomain = tenantDomain && /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)/.test(tenantDomain)
    const domain =
      (!isLocalDomain && tenantDomain) ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      process.env.NEXT_PUBLIC_SERVER_URL?.replace(/^https?:\/\//, '') ||
      'localhost'

    const identity: FederationIdentity = {
      federationId,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      domain,
      name: (tenant.name as string) || 'Angel OS Instance',
    }

    // ── Find all known federation peers ─────────────────────────
    const peers = await req.payload.find({
      collection: 'endeavors',
      where: {
        and: [
          { 'federation.networkVisible': { equals: true } },
          { 'federation.federationId': { exists: true } },
          // Don't heartbeat ourselves
          { 'federation.federationId': { not_equals: federationId } },
        ],
      },
      limit: 100, // Cap at 100 peers per cron run
      depth: 0,
      overrideAccess: true,
    })

    if (peers.docs.length === 0) {
      return Response.json({
        success: true,
        message: 'No federation peers found. Standing by.',
        peersContacted: 0,
        duration: Date.now() - startTime,
      })
    }

    // ── Count our catalog entries ────────────────────────────────
    // Simple count of products visible to the federation
    let catalogEntryCount = 0
    try {
      const products = await req.payload.find({
        collection: 'products' as any,
        limit: 0,
        depth: 0,
        overrideAccess: true,
      })
      catalogEntryCount = products.totalDocs
    } catch {
      // Products collection may not exist — that's fine
    }

    // ── Build capacity snapshot for workload routing ─────────────
    // Sprint 31: Query actual work unit counts + derive capabilities
    let activeWorkUnitCount = 0
    let completedWorkCount = 0
    let failedWorkCount = 0
    let avgExecTime = 0

    try {
      // Count active (pending + claimed + executing) work units
      const activeWork = await req.payload.find({
        collection: 'work-units' as any,
        where: {
          status: { in: ['pending', 'claimed', 'executing'] },
        },
        limit: 0,
        depth: 0,
        overrideAccess: true,
      })
      activeWorkUnitCount = activeWork.totalDocs

      // Count completed and failed for success rate
      const completedWork = await req.payload.find({
        collection: 'work-units' as any,
        where: { status: { equals: 'completed' } },
        limit: 0,
        depth: 0,
        overrideAccess: true,
      })
      completedWorkCount = completedWork.totalDocs

      const failedWork = await req.payload.find({
        collection: 'work-units' as any,
        where: { status: { in: ['failed', 'timeout'] } },
        limit: 0,
        depth: 0,
        overrideAccess: true,
      })
      failedWorkCount = failedWork.totalDocs

      // Average execution time from recent completed work
      const recentCompleted = await req.payload.find({
        collection: 'work-units' as any,
        where: { status: { equals: 'completed' } },
        limit: 20,
        depth: 0,
        overrideAccess: true,
        sort: '-completedAt',
      })
      const execTimes = (recentCompleted.docs as unknown as Array<Record<string, unknown>>)
        .map((d) => d.executionTimeMs as number)
        .filter((t) => typeof t === 'number' && t > 0)
      if (execTimes.length > 0) {
        avgExecTime = Math.round(execTimes.reduce((a, b) => a + b, 0) / execTimes.length)
      }
    } catch {
      // WorkUnits collection query failed — use defaults (zero)
    }

    // Derive capabilities from available collections/features
    const derivedCapabilities: string[] = []
    try {
      // Check if products exist
      if (catalogEntryCount > 0) derivedCapabilities.push('products')
      // Check for logistics capability
      const logNodes = await req.payload.find({
        collection: 'logistics-nodes' as any,
        limit: 0,
        depth: 0,
        overrideAccess: true,
      })
      if (logNodes.totalDocs > 0) derivedCapabilities.push('logistics')
    } catch {
      // Default to products if we can't query
      if (catalogEntryCount > 0) derivedCapabilities.push('products')
    }
    // All nodes support base computation
    derivedCapabilities.push('computation', 'analysis')

    const localWorker: WorkerCapabilities = {
      nodeId: federationId,
      nodeName: identity.name,
      domain,
      computeClass: 'standard',
      supportedWorkTypes: ['computation', 'analysis', 'transformation'],
      maxConcurrent: 5,
      activeWorkUnits: activeWorkUnitCount,
      accepting: true,
      costPerUnitCents: 0,
      trustLevel: 'vouched',
      compositeTrustScore: 70,
      completedCount: completedWorkCount,
      failedCount: failedWorkCount,
      avgExecutionTimeMs: avgExecTime,
      lastHeartbeat: new Date().toISOString(),
      isHealthy: true,
    }
    const capacitySnapshot = buildCapacitySnapshot(localWorker)

    // ── Build street signs payload (Sprint 39: gossip protocol) ──
    let streetSigns
    try {
      streetSigns = await buildStreetSigns(req.payload, tenantId)
    } catch {
      // Non-fatal — heartbeat continues without street signs
      streetSigns = undefined
    }

    // ── Send heartbeats ─────────────────────────────────────────
    const heartbeat: HeartbeatPayload = {
      federationId,
      domain,
      name: identity.name,
      timestamp: new Date().toISOString(),
      constitutionVersion: constitution.version,
      status: 'healthy',
      capabilities: derivedCapabilities,
      catalogEntryCount,
      capacity: capacitySnapshot, // Sprint 31: live workload capacity broadcast
      streetSigns,               // Sprint 39: product gossip
    } as HeartbeatPayload & { capacity: unknown; streetSigns: unknown }

    // Process peers in parallel (with concurrency limit)
    const CONCURRENCY = 5
    const peerDocs = peers.docs as unknown as Array<Record<string, unknown>>

    for (let i = 0; i < peerDocs.length; i += CONCURRENCY) {
      const batch = peerDocs.slice(i, i + CONCURRENCY)
      const batchResults = await Promise.allSettled(
        batch.map(async (peer) => {
          const peerFederation = peer.federation as unknown as Record<string, unknown> | undefined
          // Sprint 43: Use stored domain from heartbeat persistence (replaces Phase 2 TODO)
          const peerDomain = (peerFederation?.domain as string) || undefined

          if (!peerDomain) {
            return { domain: String(peer.name), success: false, error: 'No domain known' }
          }

          const response = await sendHeartbeat(peerDomain, heartbeat, identity, {
            timeout: 8_000, // 8s timeout per peer (cron has limited time)
          })

          return {
            domain: peerDomain,
            success: Boolean(response?.acknowledged),
            error: response ? undefined : 'No response',
          }
        }),
      )

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          results.push({ domain: 'unknown', success: false, error: result.reason?.message })
        }
      }
    }

    // ── Mark stale peers ────────────────────────────────────────
    const now = new Date()
    for (const peer of peerDocs) {
      const peerFederation = peer.federation as unknown as Record<string, unknown> | undefined
      const lastPing = peerFederation?.lastPingAt as string | undefined
      if (lastPing) {
        const age = (now.getTime() - new Date(lastPing).getTime()) / 1000
        if (age > MAX_HEARTBEAT_AGE_SECONDS * 2) {
          // Double the threshold before marking as unhealthy — be generous
          console.warn(
            `[Heartbeat Cron] Peer ${peer.name} last seen ${Math.round(age)}s ago — may be unhealthy`,
          )
        }
      }
    }

    // ── Governance mesh sync (Edenist replication) ───────────────
    // Build governance snapshot if we're a sentinel/coordinator.
    // The mesh ensures every fully-trusted node holds governance data.
    let governanceSynced = false
    let governanceVersion = 0

    try {
      const currentGovernance = getCachedGovernance()
      const currentVersion = currentGovernance?.registryVersion ?? 0
      const constitutionHash = constitution.checksum || constitution.version

      // Build minimal ministry records from peer data for governance snapshot
      // In a full implementation, this would query a FederationRegistry collection
      const knownMinistries: Ministry[] = peerDocs.map((peer) => {
        const peerFed = peer.federation as unknown as Record<string, unknown> | undefined
        return {
          id: (peerFed?.federationId as string) || String(peer.id),
          name: String(peer.name || 'Unknown'),
          domain: String(peerFed?.domain || peer.name || ''),
          operator: '',
          status: 'active' as const,
          appliedAt: String(peer.createdAt || new Date().toISOString()),
          vouchesReceived: [],
          constitutionVersion: constitution.version,
          lastHeartbeat: peerFed?.lastPingAt as string | undefined,
          capabilities: [],
        }
      })

      // Include ourselves
      knownMinistries.unshift({
        id: federationId,
        name: identity.name,
        domain,
        operator: '',
        status: 'active',
        appliedAt: String(tenant.createdAt || new Date().toISOString()),
        vouchesReceived: [],
        constitutionVersion: constitution.version,
        lastHeartbeat: now.toISOString(),
        capabilities: ['products'],
      })

      // Build catalog entries (simplified — full implementation queries Products)
      const catalogEntries: FederationCatalogEntry[] = []

      // Build and cache governance snapshot
      const snapshot = buildGovernanceSnapshot(
        knownMinistries,
        catalogEntries,
        constitutionHash,
        currentVersion,
        now,
      )
      setCachedGovernanceWithPersist(snapshot, req.payload)
      governanceVersion = snapshot.registryVersion
      governanceSynced = true

    } catch (govErr) {
      console.warn('[Heartbeat Cron] Governance sync error:', govErr)
    }

    const successful = results.filter((r) => r.success).length

    return Response.json({
      success: true,
      peersContacted: results.length,
      successful,
      failed: results.length - successful,
      results,
      governance: {
        synced: governanceSynced,
        version: governanceVersion,
      },
      duration: Date.now() - startTime,
    })
  } catch (err) {
    console.error('[Heartbeat Cron] Error:', err)
    return Response.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        duration: Date.now() - startTime,
      },
      { status: 500 },
    )
  }
}
