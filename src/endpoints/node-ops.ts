/**
 * Node ops — Merlin nodes register their catalog UP to their endeavor; Core lists them.
 *
 *   POST /api/node-ops/register  { endeavor, node }  → store in the per-endeavor registry
 *   GET  /api/node-ops/list?tenant=<slug>            → the endeavor's registered nodes
 *
 * Phase 1 of the distributed-nodes adoption path (docs/strategy/DISTRIBUTED_NODES_ADOPTION.md):
 * "See it" — the catalog flows OUTBOUND from a NAT'd Merlin, so no tunnel is needed to
 * know what a node offers. Stored in the schema-drift-proof settings bag (no new column).
 *
 * Auth: super_admin OR ?key=<CRON_SECRET> (a node presents the key). ⚠️ ACL note: read
 * access is key/super_admin today; Phase 1 hardening = gate `list` to endeavor members +
 * the Remote-Desktop-grade per-node grant. Keep that in mind before exposing a UI.
 */
import type { PayloadHandler, Payload } from 'payload'
import { getJsonSetting, setJsonSetting } from '@/services/SettingService'
import { provisionNodeIdentity, resolveEndeavorTenant, listEndeavorNodes } from '@/utilities/nodeBus'

/** Is this user entitled to operate a node bound to `tenantId`? super_admin or a member. */
function userCanAccessEndeavor(user: unknown, tenantId: number | string): boolean {
  const u = user as { roles?: string[]; servesTenant?: unknown; tenants?: Array<{ tenant?: unknown }> } | null
  if (!u) return false
  if ((u.roles || []).includes('super_admin')) return true
  const serves = typeof u.servesTenant === 'object' && u.servesTenant !== null ? (u.servesTenant as { id?: unknown }).id : u.servesTenant
  if (serves != null && String(serves) === String(tenantId)) return true
  return (Array.isArray(u.tenants) ? u.tenants : []).some((t) => {
    const tt = t?.tenant
    const id = tt && typeof tt === 'object' ? (tt as { id?: unknown }).id : tt
    return id != null && String(id) === String(tenantId)
  })
}

const ENTITY = 'merlin-nodes'
const SETTING = 'nodes'

type NodeRecord = { id: string; lastSeen: string; [k: string]: unknown }

async function platformTenantId(payload: Payload): Promise<number | string> {
  try {
    const res = await payload.find({ collection: 'tenants', where: { type: { equals: 'platform' } }, limit: 1, depth: 0, overrideAccess: true })
    const id = (res.docs?.[0] as { id?: number | string } | undefined)?.id
    if (id != null) return id
  } catch { /* fall through */ }
  return 1
}

function authed(req: Parameters<PayloadHandler>[0]): boolean {
  const url = new URL(req.url || '', 'http://localhost')
  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(req.user && ((req.user as { roles?: string[] }).roles || []).includes('super_admin'))
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  return isSuperAdmin || keyOk
}

/** POST /api/node-ops/register */
export const nodeRegisterHandler: PayloadHandler = async (req) => {
  const { payload } = req
  if (!authed(req)) return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })

  let body: Record<string, unknown> = {}
  try { body = (await (req as unknown as Request).json()) as Record<string, unknown> } catch { /* empty */ }

  const endeavor = typeof body.endeavor === 'string' ? body.endeavor.trim() : ''
  const node = body.node as Record<string, unknown> | undefined
  if (!endeavor || !node) return Response.json({ error: 'endeavor and node are required' }, { status: 400 })

  // Stable node id: explicit id or hostname (a box = a node). Dedup on it.
  const nodeId = String(node.id || node.hostname || '').trim()
  if (!nodeId) return Response.json({ error: 'node.id or node.hostname required' }, { status: 400 })

  try {
    // Provision the node's bus identity (system-user + per-node channel + membership)
    // and mint a fresh token. Idempotent — re-register refreshes the token + lastSeen.
    // FAIL-SOFT: a provisioning hiccup must NOT break basic registration (the node would
    // vanish from MerlinControl). Bus identity is best-effort; the catalog always stores.
    let identity: Awaited<ReturnType<typeof provisionNodeIdentity>> | null = null
    let provisionError: string | undefined
    try {
      identity = await provisionNodeIdentity(payload, req, { endeavor, nodeId })
    } catch (pe) {
      provisionError = pe instanceof Error ? pe.message : String(pe)
      payload.logger?.error?.(`[node-register] bus-identity provisioning failed (non-fatal): ${provisionError}`)
    }

    const tenantId = await platformTenantId(payload)
    const scope = { entityName: ENTITY, entityId: endeavor, tenantId }
    const current = (await getJsonSetting<Record<string, NodeRecord>>(payload, scope, SETTING)) || {}
    // Persist the catalog + (when available) the bus address (channel + user); never the token.
    current[nodeId] = {
      ...node,
      id: nodeId,
      lastSeen: new Date().toISOString(),
      ...(identity ? { channel: identity.channel, spaceId: identity.spaceId, nodeUserId: identity.nodeUserId } : {}),
    }
    await setJsonSetting(payload, scope, SETTING, current)
    return Response.json({
      ok: true,
      endeavor,
      nodeId,
      total: Object.keys(current).length,
      ...(identity
        ? {
            channel: identity.channel,
            spaceId: identity.spaceId,
            nodeToken: identity.nodeToken,
            nodeTokenExpiresAt: identity.nodeTokenExpiresAt,
          }
        : { busIdentity: false, busIdentityError: provisionError }),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[node-register] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}

/** GET /api/node-ops/list?tenant=<slug> */
export const nodeListHandler: PayloadHandler = async (req) => {
  const { payload } = req
  if (!authed(req)) return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })

  const url = new URL(req.url || '', 'http://localhost')
  const endeavor = url.searchParams.get('tenant') || url.searchParams.get('endeavor') || ''
  if (!endeavor) return Response.json({ error: 'tenant (endeavor slug) is required' }, { status: 400 })

  try {
    const tenantId = await platformTenantId(payload)
    const map = (await getJsonSetting<Record<string, NodeRecord>>(payload, { entityName: ENTITY, entityId: endeavor, tenantId }, SETTING)) || {}
    const nodes = Object.values(map).sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || ''))
    return Response.json({ ok: true, endeavor, total: nodes.length, nodes })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[node-list] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}

/**
 * Merlin Console — talk to a node's LOCAL brain over the bus, as the logged-in user.
 *
 *   POST /api/node-ops/chat  { endeavor, nodeId, message, conversationId? }
 *        → posts a node-command(tool:'chat') on the node's channel; Merlin's poll
 *          loop runs runAgent (local brain + tools) and posts the reply back.
 *   GET  /api/node-ops/chat?endeavor=&nodeId=&since=
 *        → the console transcript (user prompts + the node's replies) since a cursor.
 */
export const nodeChatPostHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'authentication required' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = (await (req as unknown as Request).json()) as Record<string, unknown> } catch { /* empty */ }
  const endeavor = typeof body.endeavor === 'string' ? body.endeavor.trim() : ''
  const nodeId = typeof body.nodeId === 'string' ? body.nodeId.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const conversationId = typeof body.conversationId === 'string' ? body.conversationId : 'node-console'
  if (!endeavor || !nodeId || !message) return Response.json({ error: 'endeavor, nodeId and message are required' }, { status: 400 })

  try {
    const tenant = await resolveEndeavorTenant(payload, endeavor)
    if (!userCanAccessEndeavor(user, tenant.id)) return Response.json({ error: 'forbidden' }, { status: 403 })

    const node = (await listEndeavorNodes(payload, endeavor)).find((n) => n.id === nodeId)
    if (!node?.channel || !node?.spaceId) return Response.json({ error: 'node has no bus channel — it needs to re-register' }, { status: 404 })

    const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    await payload.create({
      collection: 'messages',
      data: {
        content: message,
        space: Number(node.spaceId),
        channel: node.channel,
        messageType: 'system',
        author: (user as { id: number }).id,
        tenant: tenant.id,
        visibility: 'tenant',
        metadata: { kind: 'node-command', requestId, tool: 'chat', args: { message, conversationId } },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic node-command message
      } as any,
      overrideAccess: true,
    })
    return Response.json({ ok: true, requestId, channel: node.channel, online: node.lastSeen && Date.now() - new Date(node.lastSeen).getTime() < 5 * 60 * 1000 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[node-chat] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}

export const nodeChatGetHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'authentication required' }, { status: 401 })

  const url = new URL(req.url || '', 'http://localhost')
  const endeavor = url.searchParams.get('endeavor') || ''
  const nodeId = url.searchParams.get('nodeId') || ''
  const since = url.searchParams.get('since') || ''
  if (!endeavor || !nodeId) return Response.json({ error: 'endeavor and nodeId are required' }, { status: 400 })

  try {
    const tenant = await resolveEndeavorTenant(payload, endeavor)
    if (!userCanAccessEndeavor(user, tenant.id)) return Response.json({ error: 'forbidden' }, { status: 403 })

    const node = (await listEndeavorNodes(payload, endeavor)).find((n) => n.id === nodeId)
    if (!node?.channel) return Response.json({ ok: true, messages: [], cursor: since })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic Where clause
    const and: any[] = [{ channel: { equals: node.channel } }]
    if (since) and.push({ createdAt: { greater_than: since } })
    const res = await payload.find({ collection: 'messages', where: { and }, sort: 'createdAt', limit: 100, depth: 0, overrideAccess: true })

    const messages = (res.docs as unknown as Array<Record<string, unknown>>)
      .map((m) => {
        const meta = (m.metadata || {}) as { kind?: string; tool?: string; args?: { message?: string } }
        const content = m.content as { text?: string } | string | undefined
        const text = typeof content === 'string' ? content : content?.text || ''
        const at = m.createdAt as string
        if (meta.kind === 'node-command' && meta.tool === 'chat') return { role: 'user', text: meta.args?.message || text, at }
        if (!meta.kind) return { role: 'assistant', text, at } // node-result (chat-send drops metadata)
        return null // other commands (list_media etc.) — not console turns
      })
      .filter((x): x is { role: string; text: string; at: string } => Boolean(x && x.text))

    const docs = res.docs as unknown as Array<{ createdAt?: string }>
    return Response.json({ ok: true, messages, cursor: docs.length ? docs[docs.length - 1].createdAt : since })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[node-chat] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}
