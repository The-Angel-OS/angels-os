/**
 * Federation Bootstrap — POST/GET /api/federation/bootstrap
 *
 * Closes the federation chicken-and-egg: the heartbeat-cron only contacts peers
 * already in the endeavors table, and `ping` only *updates* known peers — so a
 * fresh node could never make first contact even with FEDERATION_REGISTRY_URL set.
 *
 * This endpoint performs first contact: it ensures this node has a federation
 * identity (federationId + keys), then sends ONE signed heartbeat to the
 * FEDERATION_REGISTRY_URL peer. That heartbeat:
 *   - onboards US with the peer (the peer's heartbeat handler creates our endeavor), and
 *   - returns the peer's federationId, which we record as a peer endeavor here —
 *     so discovery becomes mutual from a single call. After this, the 5-minute
 *     heartbeat-cron on both sides keeps the mesh alive.
 *
 * Reusable for every future node: deploy → set FEDERATION_REGISTRY_URL → call
 * bootstrap once → it's clipped onto the network.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET> (so it can run before login works).
 */
import type { Payload, PayloadHandler } from 'payload'
import crypto from 'crypto'
import { signData } from '@/federation/protocol'
import { getOrCreateFederationKeyPair } from '@/federation/keyStore'
import { getActiveConstitution } from '@/federation/constitution'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'

const stripProto = (u: string) => u.replace(/^https?:\/\//, '').replace(/\/$/, '')

async function ensureFederationId(payload: Payload, tenantId: number, setup: Record<string, unknown>): Promise<string> {
  const existing = setup?.federationId as string | undefined
  if (existing) return existing
  const federationId = crypto.randomUUID()
  await payload.update({
    collection: 'tenants',
    id: tenantId,
    data: { setup: { ...setup, federationId } } as never,
    overrideAccess: true,
  })
  return federationId
}

export const federationBootstrapHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')
  const key = url.searchParams.get('key')
  const authorized =
    Boolean(user && checkRole(ADMIN_ROLES, user)) ||
    Boolean(key && process.env.CRON_SECRET && key === process.env.CRON_SECRET)
  if (!authorized) return Response.json({ error: 'super_admin or ?key=CRON_SECRET required' }, { status: 403 })

  const registryUrl = process.env.FEDERATION_REGISTRY_URL
  if (!registryUrl) return Response.json({ error: 'FEDERATION_REGISTRY_URL is not set — no peer to bootstrap with' }, { status: 400 })

  // ── Our identity ───────────────────────────────────────────────────────────
  const tenants = await payload.find({ collection: 'tenants', limit: 1, depth: 0, overrideAccess: true, sort: 'createdAt' })
  const tenant = tenants.docs[0] as unknown as Record<string, unknown> | undefined
  if (!tenant) return Response.json({ error: 'No tenant configured' }, { status: 400 })
  const tenantId = tenant.id as number
  const setup = (tenant.setup as Record<string, unknown>) || {}

  const federationId = await ensureFederationId(payload, tenantId, setup)
  let keyPair: { publicKey: string; privateKey: string }
  try {
    keyPair = await getOrCreateFederationKeyPair(payload, tenantId)
  } catch (e) {
    return Response.json({ error: `key error: ${e instanceof Error ? e.message : e}` }, { status: 500 })
  }

  const ourDomain =
    stripProto((tenant.domain as string) || process.env.NEXT_PUBLIC_SERVER_URL || '') || 'localhost'
  const constitution = getActiveConstitution()

  // ── Send ONE signed heartbeat to the registry peer (first contact) ──────────
  const heartbeat = {
    federationId,
    domain: ourDomain,
    name: (tenant.name as string) || 'Angel OS Instance',
    timestamp: new Date().toISOString(),
    constitutionVersion: constitution.version,
    status: 'healthy' as const,
    capabilities: ['federation', 'catalog', 'works'],
    catalogEntryCount: 0,
  }
  const body = JSON.stringify(heartbeat)
  const ts = new Date().toISOString()
  const headers = {
    'Content-Type': 'application/json',
    'X-Federation-Id': federationId,
    'X-Federation-Signature': signData(`${ts}\n${body}`, keyPair.privateKey),
    'X-Federation-Key': keyPair.publicKey,
    'X-Federation-Timestamp': ts,
    'X-Federation-Protocol': 'angel-os/1.0',
  }

  const peerDomain = stripProto(registryUrl)
  let peerFederationId: string | undefined
  let peerAck = false
  let peerError: string | undefined
  try {
    const res = await fetch(`${registryUrl.replace(/\/$/, '')}/api/federation/heartbeat`, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(15_000),
    })
    if (res.ok) {
      const data = (await res.json()) as { acknowledged?: boolean; theirFederationId?: string; theirName?: string }
      peerAck = Boolean(data.acknowledged)
      peerFederationId = data.theirFederationId
    } else {
      peerError = `peer returned HTTP ${res.status}`
    }
  } catch (e) {
    peerError = e instanceof Error ? e.message : 'network error'
  }

  // ── Record the peer on our side (mutual discovery from one call) ────────────
  let recorded = false
  if (peerFederationId) {
    try {
      const existing = await payload.find({
        collection: 'endeavors',
        where: { 'federation.federationId': { equals: peerFederationId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const fed = {
        networkVisible: true,
        ministryStatus: 'active',
        federationId: peerFederationId,
        domain: peerDomain,
        lastPingAt: new Date().toISOString(),
      }
      if (existing.docs.length > 0) {
        await payload.update({ collection: 'endeavors', id: existing.docs[0]!.id, data: { federation: fed } as never, overrideAccess: true })
      } else {
        await payload.create({
          collection: 'endeavors',
          data: { name: `Peer · ${peerDomain}`, endeavorType: 'custom', status: 'active', federation: fed } as never,
          overrideAccess: true,
        })
      }
      recorded = true
    } catch (e) {
      peerError = (peerError ? peerError + '; ' : '') + `record failed: ${e instanceof Error ? e.message : e}`
    }
  }

  payload.logger.info(`[federation-bootstrap] us=${federationId} peer=${peerDomain} ack=${peerAck} peerFed=${peerFederationId ?? 'none'} recorded=${recorded}`)

  return Response.json({
    ok: peerAck && recorded,
    ourFederationId: federationId,
    ourDomain,
    peer: { domain: peerDomain, federationId: peerFederationId ?? null, acknowledged: peerAck, recorded },
    ...(peerError ? { warning: peerError } : {}),
    message:
      peerAck && recorded
        ? `Handshake complete with ${peerDomain}. Mutual discovery established; the heartbeat-cron will keep the mesh alive.`
        : `First contact attempted with ${peerDomain}.${peerError ? ` Issue: ${peerError}` : ''}`,
  })
}
