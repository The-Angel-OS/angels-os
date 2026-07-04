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
import { provisionNodeIdentity, resolveEndeavorTenant, listEndeavorNodes, resolveProviderNodes, type RegisteredNode } from '@/utilities/nodeBus'
import { postBusMessage } from '@/lib/busEnvelope'
import { recordCostEvent } from '@/utilities/recordCostEvent'

/**
 * Dispatch a skill to a node via its tunnel URL when available.
 * Returns the direct result on success, or null to trigger bus fallback.
 */
async function dispatchToNodeTunnel(
  node: RegisteredNode,
  skill: string,
  args: Record<string, unknown>,
  timeoutMs = 30_000,
): Promise<{ ok: boolean; data?: unknown; error?: string } | null> {
  const tunnelUrl = typeof (node as Record<string, unknown>).tunnelUrl === 'string'
    ? ((node as Record<string, unknown>).tunnelUrl as string)
    : undefined
  if (!tunnelUrl) return null

  const nodeKey = process.env.CRON_SECRET || ''
  if (!nodeKey) return null

  try {
    const res = await fetch(`${tunnelUrl.replace(/\/$/, '')}/api/node/skill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skill, args, key: nodeKey }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: `node returned ${res.status}: ${(data as Record<string, unknown>).error || 'unknown'}` }
    }
    return { ok: true, data }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `tunnel dispatch failed: ${msg}` }
  }
}

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

/**
 * Sentinel a node uses to embed a structured skill payload in a result message's
 * text (Core's chat-send drops metadata). MUST stay in sync with Merlin's
 * RESULT_SENTINEL in src/lib/node-bus.ts. Format: `<SENTINEL>:<requestId>:<json>`.
 */
const RESULT_SENTINEL = '@@ANGELS_RESULT@@'

/** Parse an embedded structured payload out of a result message's text, if present. */
function parseResultPayload(text: string, requestId: string): unknown | undefined {
  const idx = text.indexOf(`${RESULT_SENTINEL}:${requestId}:`)
  if (idx < 0) return undefined
  const json = text.slice(idx + RESULT_SENTINEL.length + 1 + requestId.length + 1)
  try {
    return JSON.parse(json.trim())
  } catch {
    return undefined
  }
}

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
 * Merlin Console — talk to a node's LOCAL brain, as the logged-in user.
 *
 *   POST /api/node-ops/chat  { endeavor, nodeId, message, conversationId? }
 *        → tries tunnel dispatch first (direct POST to node's /api/node/skill);
 *          falls back to posting a node-command on the bus channel (poll loop).
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
    if (!node) return Response.json({ error: 'unknown node' }, { status: 404 })

    // Try tunnel dispatch first (real-time, no polling)
    const tunnelResult = await dispatchToNodeTunnel(node, 'chat', { message, conversationId })
    if (tunnelResult?.ok && tunnelResult.data) {
      const d = tunnelResult.data as Record<string, unknown>
      return Response.json({
        ok: true,
        response: d.response || '',
        provider: d.provider,
        steps: d.steps,
        toolsUsed: d.toolsUsed,
        conversationId: d.conversationId || conversationId,
        via: 'tunnel',
        elapsedMs: d.elapsedMs,
      })
    }

    // Fall back to bus channel (poll loop)
    if (!node.channel || !node.spaceId) return Response.json({ error: 'node has no bus channel and no tunnel — it needs to re-register' }, { status: 404 })

    const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    await postBusMessage(payload, {
      space: node.spaceId,
      channel: node.channel,
      text: message,
      author: (user as { id: number }).id,
      tenant: tenant.id,
      messageType: 'system',
      kind: 'node-command',
      metadata: { requestId, tool: 'chat', args: { message, conversationId } },
    })
    return Response.json({
      ok: true,
      requestId,
      channel: node.channel,
      online: node.lastSeen && Date.now() - new Date(node.lastSeen).getTime() < 5 * 60 * 1000,
      via: 'bus',
      tunnelError: tunnelResult?.error,
    })
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
        const id = m.id as number | string
        if (meta.kind === 'node-command' && meta.tool === 'chat') return { id, role: 'user', text: meta.args?.message || text, at }
        if (!meta.kind) return { id, role: 'assistant', text, at } // node-result (chat-send drops metadata)
        return null // other commands (list_media etc.) — not console turns
      })
      .filter((x): x is { id: number | string; role: string; text: string; at: string } => Boolean(x && x.text))

    const docs = res.docs as unknown as Array<{ createdAt?: string }>
    const online = Boolean(node.lastSeen && Date.now() - new Date(node.lastSeen).getTime() < 5 * 60 * 1000)
    return Response.json({ ok: true, online, messages, cursor: docs.length ? docs[docs.length - 1].createdAt : since })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[node-chat] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}

/**
 * POST /api/node-ops/media — the FILE BRIDGE: a node submits a file (e.g. a camera
 * snapshot) UP into the endeavor's Media library. Authenticated as the node
 * system-user (payload-token cookie). Body is JSON with the bytes base64-encoded
 * (fine for snapshots; large files get signed-blob later). Creates a tenant-scoped
 * Media doc → routes to Vercel Blob in prod → returns its URL so LEO can see it.
 */
export const nodeMediaHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'authentication required' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = (await (req as unknown as Request).json()) as Record<string, unknown> } catch { /* empty */ }
  const endeavor = typeof body.endeavor === 'string' ? body.endeavor.trim() : ''
  const dataBase64 = typeof body.dataBase64 === 'string' ? body.dataBase64 : ''
  const filename =
    typeof body.filename === 'string' && body.filename.trim() ? body.filename.trim() : `node-${Date.now()}.jpg`
  const mimetype = typeof body.mimetype === 'string' && body.mimetype ? body.mimetype : 'image/jpeg'
  const alt = typeof body.alt === 'string' && body.alt.trim() ? body.alt.trim() : filename
  if (!endeavor) return Response.json({ error: 'endeavor is required' }, { status: 400 })
  if (!dataBase64) return Response.json({ error: 'dataBase64 is required' }, { status: 400 })

  try {
    const tenant = await resolveEndeavorTenant(payload, endeavor)
    if (!userCanAccessEndeavor(user, tenant.id)) return Response.json({ error: 'forbidden' }, { status: 403 })

    const buf = Buffer.from(dataBase64, 'base64')
    if (!buf.length) return Response.json({ error: 'empty media payload' }, { status: 400 })

    const media = await payload.create({
      collection: 'media',
      overrideAccess: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tenant set server-side
      data: { alt, tenant: tenant.id } as any,
      file: { data: buf, mimetype, name: filename, size: buf.length },
    })
    const url = String((media as { url?: string }).url || '')
    const mediaId = (media as { id: unknown }).id

    // Record the submittal in the per-node bag (schema-drift-proof) so MerlinControl's
    // Screenshots tab can list it. Derive the node from the authed system-user.
    try {
      const nodes = await listEndeavorNodes(payload, endeavor)
      const node = nodes.find((n) => n.nodeUserId != null && String(n.nodeUserId) === String((user as { id: unknown }).id))
      if (node) {
        const key = { entityName: 'merlin-node-submittals', entityId: endeavor, tenantId: tenant.id }
        const prev = (await getJsonSetting<Record<string, unknown[]>>(payload, key, 'byNode')) || {}
        const list = Array.isArray(prev[node.id]) ? (prev[node.id] as unknown[]) : []
        list.unshift({ id: mediaId, url, filename, alt, at: new Date().toISOString() })
        prev[node.id] = list.slice(0, 200) // cap retention
        await setJsonSetting(payload, key, 'byNode', prev)
      }
    } catch (recErr) {
      payload.logger?.warn?.(`[node-media] submittal record failed: ${recErr instanceof Error ? recErr.message : recErr}`)
    }

    payload.logger?.info?.(`[node-media] ${endeavor} ← ${filename} (${buf.length}b) → media ${mediaId}`)
    return Response.json({ ok: true, id: mediaId, url, filename, bytes: buf.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[node-media] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}

/**
 * GET /api/node-ops/media?endeavor=&nodeId= — a node's recent submittals (snapshots).
 * Reads the per-node bag written by the file bridge. Powers MerlinControl's Screenshots tab.
 */
export const nodeMediaListHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'authentication required' }, { status: 401 })

  const url = new URL(req.url || '', 'http://localhost')
  const endeavor = url.searchParams.get('endeavor') || ''
  const nodeId = url.searchParams.get('nodeId') || ''
  if (!endeavor || !nodeId) return Response.json({ error: 'endeavor and nodeId are required' }, { status: 400 })

  try {
    const tenant = await resolveEndeavorTenant(payload, endeavor)
    if (!userCanAccessEndeavor(user, tenant.id)) return Response.json({ error: 'forbidden' }, { status: 403 })
    const byNode =
      (await getJsonSetting<Record<string, unknown[]>>(
        payload,
        { entityName: 'merlin-node-submittals', entityId: endeavor, tenantId: tenant.id },
        'byNode',
      )) || {}
    const items = Array.isArray(byNode[nodeId]) ? byNode[nodeId] : []
    return Response.json({ ok: true, items })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[node-media-list] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}

/**
 * The DIRECTORY BROWSER — list a node's SHARED files (the killer-app feature).
 *
 *   POST /api/node-ops/files { endeavor, nodeId, query? }
 *        → tries tunnel dispatch first (real-time); falls back to bus channel (poll).
 *   GET  /api/node-ops/files?endeavor=&nodeId=&requestId=&since=
 *        → polls the node's channel for the structured result (sentinel-embedded).
 *
 * Files are addressed by an opaque `ref` (rootLabel::relpath) — never a system path.
 * Each file carries a tunnelUrl when the node advertises a tunnel (open direct, zero
 * Core bandwidth); otherwise the browser falls back to GET /api/node-ops/file (proxy).
 */
export const nodeFilesPostHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'authentication required' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = (await (req as unknown as Request).json()) as Record<string, unknown> } catch { /* empty */ }
  const endeavor = typeof body.endeavor === 'string' ? body.endeavor.trim() : ''
  const nodeId = typeof body.nodeId === 'string' ? body.nodeId.trim() : ''
  const query = typeof body.query === 'string' ? body.query.trim() : ''
  if (!endeavor || !nodeId) return Response.json({ error: 'endeavor and nodeId are required' }, { status: 400 })

  try {
    const tenant = await resolveEndeavorTenant(payload, endeavor)
    if (!userCanAccessEndeavor(user, tenant.id)) return Response.json({ error: 'forbidden' }, { status: 403 })

    const node = (await listEndeavorNodes(payload, endeavor)).find((n) => n.id === nodeId)
    if (!node) return Response.json({ error: 'unknown node' }, { status: 404 })

    // Try tunnel dispatch first (real-time, no polling)
    const tunnelResult = await dispatchToNodeTunnel(node, 'list_files', { query: query || undefined })
    if (tunnelResult?.ok && tunnelResult.data) {
      const d = tunnelResult.data as Record<string, unknown>
      return Response.json({
        ok: true,
        ready: true,
        files: Array.isArray(d.files) ? d.files : [],
        roots: Array.isArray(d.roots) ? d.roots : [],
        tunnelUrl: typeof d.tunnelUrl === 'string' ? d.tunnelUrl : undefined,
        lanUrl: typeof d.lanUrl === 'string' ? d.lanUrl : undefined,
        count: typeof d.count === 'number' ? d.count : 0,
        via: 'tunnel',
      })
    }

    // Fall back to bus channel (poll loop)
    if (!node.channel || !node.spaceId) return Response.json({ error: 'node has no bus channel and no tunnel' }, { status: 404 })

    const requestId = `files-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    await postBusMessage(payload, {
      space: node.spaceId,
      channel: node.channel,
      text: `list files${query ? ` matching "${query}"` : ''}`,
      author: (user as { id: number }).id,
      tenant: tenant.id,
      messageType: 'system',
      kind: 'node-command',
      metadata: { requestId, tool: 'list_files', args: { query: query || undefined } },
    })
    const online = Boolean(node.lastSeen && Date.now() - new Date(node.lastSeen).getTime() < 5 * 60 * 1000)
    return Response.json({ ok: true, requestId, online, via: 'bus', tunnelError: tunnelResult?.error })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[node-files] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}

export const nodeFilesGetHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'authentication required' }, { status: 401 })

  const url = new URL(req.url || '', 'http://localhost')
  const endeavor = url.searchParams.get('endeavor') || ''
  const nodeId = url.searchParams.get('nodeId') || ''
  const requestId = url.searchParams.get('requestId') || ''
  const since = url.searchParams.get('since') || ''
  if (!endeavor || !nodeId || !requestId) return Response.json({ error: 'endeavor, nodeId and requestId are required' }, { status: 400 })

  try {
    const tenant = await resolveEndeavorTenant(payload, endeavor)
    if (!userCanAccessEndeavor(user, tenant.id)) return Response.json({ error: 'forbidden' }, { status: 403 })

    const node = (await listEndeavorNodes(payload, endeavor)).find((n) => n.id === nodeId)
    if (!node?.channel) return Response.json({ ok: true, ready: false, files: [] })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic Where clause
    const and: any[] = [{ channel: { equals: node.channel } }]
    if (since) and.push({ createdAt: { greater_than: since } })
    const res = await payload.find({ collection: 'messages', where: { and }, sort: '-createdAt', limit: 50, depth: 0, overrideAccess: true })

    for (const m of res.docs as unknown as Array<Record<string, unknown>>) {
      const content = m.content as { text?: string } | string | undefined
      const text = typeof content === 'string' ? content : content?.text || ''
      if (!text.includes(`${RESULT_SENTINEL}:${requestId}:`)) continue
      const payloadData = parseResultPayload(text, requestId) as
        | { ok?: boolean; error?: string; files?: unknown[]; roots?: string[]; tunnelUrl?: string; lanUrl?: string }
        | undefined
      if (!payloadData) continue
      return Response.json({
        ok: true,
        ready: true,
        files: Array.isArray(payloadData.files) ? payloadData.files : [],
        roots: payloadData.roots || [],
        tunnelUrl: payloadData.tunnelUrl,
        lanUrl: payloadData.lanUrl,
        error: payloadData.ok === false ? payloadData.error : undefined,
      })
    }
    const online = Boolean(node.lastSeen && Date.now() - new Date(node.lastSeen).getTime() < 5 * 60 * 1000)
    return Response.json({ ok: true, ready: false, online, files: [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[node-files] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}

/**
 * Intelligence broker (Thread 7) — GET /api/ai-broker/resolve?endeavor=&model=
 *
 * Core as the compute DIRECTORY: returns the ranked provider gateways that can
 * serve the requested model, drawn from the node registry (each Merlin advertises
 * compute.models on register). A node asking for a brain calls this, picks the top
 * provider, and POSTs its turns to that node's /api/ai. If nothing's available,
 * `fallback: "cloud"` tells the caller to use its own Ollama :cloud token directly.
 *
 * Auth: any endeavor member (same gate as the other node-ops surfaces). Read-only.
 */
export const aiBrokerResolveHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'authentication required' }, { status: 401 })

  const url = new URL(req.url || '', 'http://localhost')
  const endeavor = url.searchParams.get('endeavor') || ''
  const model = url.searchParams.get('model') || undefined
  if (!endeavor) return Response.json({ error: 'endeavor is required' }, { status: 400 })

  try {
    const tenant = await resolveEndeavorTenant(payload, endeavor)
    if (!userCanAccessEndeavor(user, tenant.id)) return Response.json({ error: 'forbidden' }, { status: 403 })

    const providers = await resolveProviderNodes(payload, endeavor, model)
    // Only providers Core/peers can actually reach (have a tunnel gateway) count as
    // routable; a LAN-only node is returned too (for same-network short-circuit).
    const routable = providers.filter((p) => p.providerUrl)
    return Response.json({
      ok: true,
      endeavor,
      model: model || null,
      providers,
      best: routable[0] || providers[0] || null,
      fallback: routable.length ? null : 'cloud',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[ai-broker] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}

/**
 * Core-proxy fallback — GET /api/node-ops/file?endeavor=&nodeId=&ref=
 *
 * Streams a node's shared file THROUGH Core when the node has no public tunnel.
 * Tunnel-first is preferred (the browser links straight to node.tunnelUrl, zero
 * Core bandwidth); this is the no-tunnel path. Requires the node to advertise a
 * tunnelUrl OR localIp reachable from Core — if neither, returns 502 (open on LAN).
 */
export const nodeFileProxyHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'authentication required' }, { status: 401 })

  const url = new URL(req.url || '', 'http://localhost')
  const endeavor = url.searchParams.get('endeavor') || ''
  const nodeId = url.searchParams.get('nodeId') || ''
  const ref = url.searchParams.get('ref') || ''
  if (!endeavor || !nodeId || !ref) return Response.json({ error: 'endeavor, nodeId and ref are required' }, { status: 400 })

  try {
    const tenant = await resolveEndeavorTenant(payload, endeavor)
    if (!userCanAccessEndeavor(user, tenant.id)) return Response.json({ error: 'forbidden' }, { status: 403 })

    const node = (await listEndeavorNodes(payload, endeavor)).find((n) => n.id === nodeId) as
      | (Record<string, unknown> & { tunnelUrl?: string; localIp?: string; url?: string })
      | undefined
    if (!node) return Response.json({ error: 'node not found' }, { status: 404 })

    // Core (Vercel) can only reach a PUBLIC origin — i.e. the node's cloudflared
    // tunnel. Private LAN addresses (192.168.x / 10.x / localhost) are unreachable
    // from Core, so we must NOT pretend to proxy them; the browser handles the
    // same-LAN case by hitting the node's lanUrl directly (no Core, no install).
    const isPublic = (u: string) => {
      try {
        const h = new URL(u).hostname
        if (h === 'localhost' || h.startsWith('127.')) return false
        if (h.startsWith('192.168.') || h.startsWith('10.') || h.startsWith('169.254.')) return false
        // 172.16.0.0–172.31.255.255 private range
        const m = /^172\.(\d+)\./.exec(h)
        if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return false
        return true
      } catch {
        return false
      }
    }
    const candidates = [node.tunnelUrl, node.url].filter((u): u is string => typeof u === 'string' && Boolean(u))
    const origin = candidates.find(isPublic) || ''
    if (!origin) {
      return Response.json(
        {
          error:
            'This node has no public tunnel, so Core can\u2019t relay the file. Open it from a device on the node\u2019s network, or enable tunnel sharing on the node.',
          code: 'no_public_origin',
        },
        { status: 409 },
      )
    }

    const target = `${origin.replace(/\/$/, '')}/api/shared/file?ref=${encodeURIComponent(ref)}`
    const range = req.headers?.get('range') || undefined
    const upstream = await fetch(target, { headers: range ? { range } : {} })
    if (!upstream.ok && upstream.status !== 206) {
      return Response.json({ error: `node returned ${upstream.status}` }, { status: 502 })
    }
    const headers = new Headers()
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'content-disposition']) {
      const v = upstream.headers.get(h)
      if (v) headers.set(h, v)
    }
    headers.set('cache-control', 'no-store')
    return new Response(upstream.body, { status: upstream.status, headers })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[node-file-proxy] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}

/**
 * Node usage ingestion — POST /api/node-ops/usage
 *
 * A Merlin/Nimue node reports a unit of intelligence it served LOCALLY (its own
 * Ollama/gateway turn, which never touched Core's brain) so the AI Costs ledger
 * accounts for ALL inference across the federation — not just Core-served turns.
 * This is the metering point for the compute-commons economy (Thread 7 addendum):
 * every local turn becomes a CostEvent the broker/Core can later mint against.
 *
 * Body: { endeavor, nodeId?, usage: { provider, model, inputTokens?, outputTokens?,
 *         totalTokens?, latencyMs?, ttftMs?, finishReason?, toolCallCount?,
 *         costCents?, backend?, tokensPerSec?, conversationId?, occurredAt? } }
 *
 * Auth: node key (CRON_SECRET) or super_admin — same gate as register. The node
 * proves it belongs to the endeavor; tenant is resolved server-side (never trusted
 * from the body). Writes are FAIL-SOFT (recordCostEvent never throws), so a node
 * reporting usage can never break, and the table's absence degrades to a no-op.
 */
export const nodeUsageHandler: PayloadHandler = async (req) => {
  const { payload } = req
  if (!authed(req)) return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })

  let body: Record<string, unknown> = {}
  try { body = (await (req as unknown as Request).json()) as Record<string, unknown> } catch { /* empty */ }
  const endeavor = typeof body.endeavor === 'string' ? body.endeavor.trim() : ''
  const nodeId = typeof body.nodeId === 'string' ? body.nodeId.trim() : ''
  const usage = (body.usage && typeof body.usage === 'object' ? body.usage : null) as Record<string, unknown> | null
  if (!endeavor || !usage) return Response.json({ error: 'endeavor and usage are required' }, { status: 400 })

  const num = (k: string): number | undefined => (typeof usage[k] === 'number' ? (usage[k] as number) : undefined)
  const str = (k: string): string | undefined => (typeof usage[k] === 'string' ? (usage[k] as string) : undefined)

  try {
    const tenant = await resolveEndeavorTenant(payload, endeavor)

    const inputTokens = num('inputTokens')
    const outputTokens = num('outputTokens')
    const totalTokens = num('totalTokens') ?? (inputTokens != null && outputTokens != null ? inputTokens + outputTokens : undefined)
    // Node-local inference (Ollama/gateway) has no per-token platform bill — it's the
    // node owner's own compute/quota. Cost defaults to 0 unless the node supplies one
    // (e.g. a proxied :cloud turn it wants to attribute). Honest by construction.
    const costCents = num('costCents') ?? 0

    await recordCostEvent(payload, {
      tenantId: tenant.id,
      category: 'intelligence',
      source: 'merlin-node',
      provider: str('provider') || str('backend') || 'ollama',
      model: str('model'),
      costCents,
      costEstimated: costCents > 0 || undefined,
      // Local node turns are served on the node owner's OWN compute/quota — never
      // billed to the platform's keys.
      billedToTenantKey: true,
      quantity: totalTokens,
      unit: 'tokens',
      inputTokens,
      outputTokens,
      totalTokens,
      latencyMs: num('latencyMs'),
      ttftMs: num('ttftMs'),
      finishReason: str('finishReason'),
      toolCallCount: num('toolCallCount'),
      conversationId: str('conversationId'),
      occurredAt: str('occurredAt'),
      metadata: {
        nodeId: nodeId || undefined,
        backend: str('backend'),
        tokensPerSec: num('tokensPerSec'),
      },
    })

    return Response.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[node-usage] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}

/**
 * Generic node dispatch — POST /api/node-ops/dispatch
 *
 * Routes a skill command to a Merlin node. Tries tunnel dispatch first (direct HTTP
 * POST to the node's public URL — real-time, no polling). Falls back to the bus
 * channel (poll loop) when no tunnel is available.
 *
 * Body: { endeavor, nodeId, skill, args }
 *   skill — one of: list_media, list_files, snap_camera, chat
 *   args  — skill-specific parameters (varies by skill)
 *
 * Auth: super_admin or CRON_SECRET
 */
export const nodeDispatchHandler: PayloadHandler = async (req) => {
  const { payload } = req
  if (!authed(req)) return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })

  let body: {
    endeavor?: string
    nodeId?: string
    skill?: string
    args?: Record<string, unknown>
  } = {}
  try { body = (await (req as unknown as Request).json()) as typeof body } catch { /* empty */ }

  const endeavor = (body.endeavor || '').trim()
  const nodeId = (body.nodeId || '').trim()
  const skill = (body.skill || '').trim()
  const args = body.args || {}
  if (!endeavor || !nodeId || !skill) {
    return Response.json({ error: 'endeavor, nodeId and skill are required' }, { status: 400 })
  }

  try {
    const node = (await listEndeavorNodes(payload, endeavor)).find((n) => n.id === nodeId)
    if (!node) return Response.json({ error: 'unknown node' }, { status: 404 })

    // Try tunnel dispatch first (real-time)
    const tunnelResult = await dispatchToNodeTunnel(node, skill, args)
    if (tunnelResult?.ok && tunnelResult.data) {
      return Response.json({ ok: true, via: 'tunnel', result: tunnelResult.data })
    }
    if (tunnelResult && !tunnelResult.ok) {
      // Tunnel was present but the call failed — return the error so callers know
      return Response.json({ ok: false, via: 'tunnel', error: tunnelResult.error })
    }

    // No tunnel — fall back to bus channel if the node has one
    if (!node.channel || !node.spaceId) {
      return Response.json({ error: 'node has no tunnel and no bus channel' }, { status: 404 })
    }

    const requestId = `dispatch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    await postBusMessage(payload, {
      space: node.spaceId,
      channel: node.channel,
      text: `${skill}${Object.keys(args).length ? ` ${JSON.stringify(args)}` : ''}`,
      author: undefined as unknown as number,
      tenant: undefined as unknown as number,
      messageType: 'system',
      kind: 'node-command',
      metadata: { requestId, tool: skill, args },
    })
    const online = Boolean(node.lastSeen && Date.now() - new Date(node.lastSeen).getTime() < 5 * 60 * 1000)
    return Response.json({ ok: true, via: 'bus', requestId, online })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[node-dispatch] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}
