/**
 * Node bus — provisioning + addressing for node↔LEO comms over the message bus.
 *
 * Model B (docs/architecture/NODE_BUS_COMMS.md): a registered Merlin node gets a
 * dedicated per-node channel in its endeavor's AI Bus space, a dedicated system-user
 * identity, and a short-lived minted JWT it uses to poll its channel + post results.
 * Command/result messages ride `metadata.kind` (no messageType enum migration).
 */
import type { Payload, PayloadRequest } from 'payload'
import * as crypto from 'node:crypto'
import { SignJWT } from 'jose'
import { findOrCreateSystemAgent, findOrCreateSpaceMembership } from '@/endpoints/seed/seed-helpers'
import { resolveAiBusSpaceId } from '@/utilities/ensureSystemSpace'
import { getJsonSetting } from '@/services/SettingService'

const NODES_ENTITY = 'merlin-nodes'
const NODES_SETTING = 'nodes'
const ONLINE_MS = 5 * 60 * 1000

export type RegisteredNode = {
  id: string
  lastSeen?: string
  channel?: string
  spaceId?: string
  nodeUserId?: number | string
  capabilities?: string[]
  [k: string]: unknown
}

/** Resolve a tenant's slug from its id (for mapping ctx.tenantId → endeavor slug). */
export async function tenantSlugById(payload: Payload, tenantId: number | string): Promise<string | undefined> {
  try {
    const t = await payload.findByID({ collection: 'tenants', id: tenantId as number, depth: 0, overrideAccess: true })
    return (t as { slug?: string } | undefined)?.slug
  } catch {
    return undefined
  }
}

async function platformTenantId(payload: Payload): Promise<number | string> {
  try {
    const res = await payload.find({ collection: 'tenants', where: { type: { equals: 'platform' } }, limit: 1, depth: 0, overrideAccess: true })
    const id = (res.docs?.[0] as { id?: number | string } | undefined)?.id
    if (id != null) return id
  } catch { /* fall through */ }
  return 1
}

/** Read the registered nodes for an endeavor (newest lastSeen first). */
export async function listEndeavorNodes(payload: Payload, endeavor: string): Promise<RegisteredNode[]> {
  const tenantId = await platformTenantId(payload)
  const map = (await getJsonSetting<Record<string, RegisteredNode>>(payload, { entityName: NODES_ENTITY, entityId: endeavor, tenantId }, NODES_SETTING)) || {}
  return Object.values(map).sort((a, b) => String(b.lastSeen || '').localeCompare(String(a.lastSeen || '')))
}

/** A node is online if it re-registered within the heartbeat window. */
export function isNodeOnline(node: RegisteredNode): boolean {
  if (!node.lastSeen) return false
  return Date.now() - new Date(node.lastSeen).getTime() < ONLINE_MS
}

/** Canonical per-node channel slug. Stable for a given (endeavor, nodeId). */
export function nodeChannelSlug(endeavor: string, nodeId: string): string {
  return `node:${endeavor}:${nodeId}`
}

/** Metadata.kind discriminators for bus messages (no messageType enum needed). */
export const NODE_COMMAND_KIND = 'node-command'
export const NODE_RESULT_KIND = 'node-result'

/** Resolve the tenant that owns an endeavor slug. Falls back to platform tenant. */
export async function resolveEndeavorTenant(
  payload: Payload,
  endeavor: string,
): Promise<{ id: number | string; slug: string }> {
  try {
    const res = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: endeavor } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const t = res.docs?.[0] as { id?: number | string; slug?: string } | undefined
    if (t?.id != null) return { id: t.id, slug: t.slug || endeavor }
  } catch {
    /* fall through to platform */
  }
  try {
    const res = await payload.find({
      collection: 'tenants',
      where: { type: { equals: 'platform' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const id = (res.docs?.[0] as { id?: number | string } | undefined)?.id
    if (id != null) return { id, slug: endeavor }
  } catch {
    /* fall through */
  }
  return { id: 1, slug: endeavor }
}

/** Mint a short-lived Payload JWT for a system user (same scheme as auth-system-token). */
export async function mintNodeToken(
  payload: Payload,
  user: { id: number | string; email: string; sessions?: Array<{ id: string; expiresAt: string }> },
  ttlMs = 6 * 60 * 60 * 1000, // 6h — refreshed by the heartbeat re-register
): Promise<{ token: string; expiresAt: string }> {
  const sid = crypto.randomUUID()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ttlMs)
  const session = { id: sid, createdAt: now.toISOString(), expiresAt: expiresAt.toISOString() }

  const existing: Array<{ expiresAt: string }> = (user.sessions as Array<{ expiresAt: string }>) || []
  const valid = existing.filter((s) => new Date(s.expiresAt) > now)
  valid.push(session)

  await payload.update({
    collection: 'users',
    id: user.id as number,
    data: { sessions: valid } as Record<string, unknown>,
    depth: 0,
    overrideAccess: true,
  })

  const secretKey = new TextEncoder().encode(payload.secret)
  const issuedAt = Math.floor(now.getTime() / 1000)
  const token = await new SignJWT({ id: user.id, email: user.email, collection: 'users', sid })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(issuedAt)
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey)

  return { token, expiresAt: expiresAt.toISOString() }
}

export type NodeIdentity = {
  channel: string
  spaceId: string
  nodeUserId: number | string
  nodeToken: string
  nodeTokenExpiresAt: string
}

/**
 * Idempotently provision a node's bus identity on (re-)register:
 *   - dedicated system-user (authored-as identity)
 *   - per-node channel in the endeavor's AI Bus space
 *   - space-membership (grants read + post)
 *   - a freshly-minted node token (refreshed every register/heartbeat)
 */
export async function provisionNodeIdentity(
  payload: Payload,
  req: PayloadRequest,
  args: { endeavor: string; nodeId: string },
): Promise<NodeIdentity> {
  const { endeavor, nodeId } = args
  const tenant = await resolveEndeavorTenant(payload, endeavor)

  const spaceId = await resolveAiBusSpaceId(payload, tenant.id)
  if (!spaceId) throw new Error(`could not resolve AI Bus space for endeavor ${endeavor}`)
  // resolveAiBusSpaceId returns a STRING id; relationship fields need the numeric id or
  // Postgres's integer-FK validation rejects it ("field is invalid: Space").
  const spaceNum = Number(spaceId)

  const channel = nodeChannelSlug(endeavor, nodeId)

  // 1. Node system-user — keyed by node + endeavor so it's stable + unique per node.
  const agent = await findOrCreateSystemAgent(payload, req, {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    agentType: 'integration',
    displayName: `Node ${nodeId}`,
    // Payload lowercases stored emails; keep ours lowercase so the find-by-email matches
    // on re-register (an uppercase nodeId like "Iam0" otherwise misses → dup-create → 500).
    email: `node-${nodeId}-${endeavor}@system.spacesangels.com`.toLowerCase(),
    routingRules: { channels: [{ channelSlug: channel }], isDefault: false },
  })

  // 2. Per-node channel in the AI Bus space.
  const existingCh = await payload.find({
    collection: 'channels',
    where: { and: [{ space: { equals: spaceNum } }, { slug: { equals: channel } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (!existingCh.docs?.[0]) {
    await payload.create({
      collection: 'channels',
      data: {
        name: `Node ${nodeId}`,
        slug: channel,
        description: `Command/result bus for Merlin node ${nodeId} (${endeavor}).`,
        type: 'general',
        space: spaceNum,
        isDefault: false,
        tenant: tenant.id as number,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic channel seed
      } as any,
      overrideAccess: true,
    })
  }

  // 3. Membership — grants the node user read + post on the space.
  await findOrCreateSpaceMembership(payload, req, {
    userId: agent.id,
    spaceId: spaceNum,
    role: 'member',
    tenantId: tenant.id,
  })

  // 4. Fresh token (re-read the user to pick up current sessions).
  const userDoc = await payload.findByID({
    collection: 'users',
    id: agent.id as number,
    depth: 0,
    overrideAccess: true,
  })
  const { token, expiresAt } = await mintNodeToken(
    payload,
    userDoc as unknown as { id: number | string; email: string; sessions?: Array<{ id: string; expiresAt: string }> },
  )

  return {
    channel,
    spaceId: String(spaceId),
    nodeUserId: agent.id,
    nodeToken: token,
    nodeTokenExpiresAt: expiresAt,
  }
}
