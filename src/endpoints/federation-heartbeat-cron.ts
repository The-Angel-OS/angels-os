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
import { getCachedGovernance, setCachedGovernanceWithPersist } from './federation-governance-sync'

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

    // ── Send heartbeats ─────────────────────────────────────────
    const heartbeat: HeartbeatPayload = {
      federationId,
      domain,
      name: identity.name,
      timestamp: new Date().toISOString(),
      constitutionVersion: constitution.version,
      status: 'healthy',
      capabilities: ['products'], // TODO: derive from tenant commerce config
      catalogEntryCount,
    }

    // Process peers in parallel (with concurrency limit)
    const CONCURRENCY = 5
    const peerDocs = peers.docs as unknown as Array<Record<string, unknown>>

    for (let i = 0; i < peerDocs.length; i += CONCURRENCY) {
      const batch = peerDocs.slice(i, i + CONCURRENCY)
      const batchResults = await Promise.allSettled(
        batch.map(async (peer) => {
          const peerFederation = peer.federation as unknown as Record<string, unknown> | undefined
          const peerDomain = peerFederation?.federationId
            ? (peer.name as string) // We'd need the domain from discovery cache
            : undefined

          // For now, we don't have a stored domain for peers. Skip unknown domains.
          // This will be improved in Phase 2 when we have a catalog cache with domains.
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

      console.log(
        `[Heartbeat Cron] Governance snapshot built: v${governanceVersion}, ${knownMinistries.length} ministries`,
      )
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
