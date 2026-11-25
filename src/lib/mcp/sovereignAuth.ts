/**
 * Sovereign Agent-to-LEO Remote MCP Auth, OAuth 2.1 PKCE & Constitutional Airlock
 *
 * Zero Postgres schema migrations: stores hashed tenant-pinned Portal API Keys
 * (`aos_live_<tenantId>_<hex>`), short-lived OAuth 2.1 PKCE authorization codes,
 * pending Constitutional Airlock approvals, and external-agent audit logs inside
 * `SettingService` (private per-tenant JSON store).
 *
 * Security invariants:
 *   1. Tenant Pinning: Every `aos_live_` token is cryptographically bound to a
 *      single `tenantId` (encoded in the prefix AND verified against that tenant's
 *      SettingService record). Client-supplied `x-tenant-id` headers are IGNORED.
 *   2. Active Standing Check: On every request, the token owner's active
 *      `tenant_admin` / `tenant_manager` membership on the pinned tenant (or
 *      `super_admin` platform role) is re-verified server-side.
 *   3. Least-Privilege Scopes: `portal:read`, `portal:content`, `portal:admin`,
 *      `portal:provision` — strictly intersected with the caller's role map.
 *   4. Constitutional Airlock: High-risk / destructive mutations never execute
 *      blindly from an external agent; they create a time-limited approval ticket
 *      and return a human-approval link in Creator Studio → Settings → Advanced.
 */
import crypto from 'node:crypto'
import type { Payload } from 'payload'
import { getJsonSetting, setJsonSetting } from '@/services/SettingService'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'

// ─── Types ────────────────────────────────────────────────────────────────

export type SovereignMcpScope =
  | 'portal:read'
  | 'portal:content'
  | 'portal:admin'
  | 'portal:provision'

export const ALL_MCP_SCOPES: readonly SovereignMcpScope[] = [
  'portal:read',
  'portal:content',
  'portal:admin',
  'portal:provision',
] as const

export interface StoredPortalApiKey {
  id: string
  name: string
  prefix: string
  tokenHash: string
  tenantId: number
  ownerUserId: number
  scopes: SovereignMcpScope[]
  source: 'api_key' | 'oauth2'
  clientId?: string
  createdAt: string
  lastUsedAt?: string
  revokedAt?: string
}

export interface SanitizedPortalApiKey {
  id: string
  name: string
  prefix: string
  tenantId: number
  scopes: SovereignMcpScope[]
  source: 'api_key' | 'oauth2'
  clientId?: string
  createdAt: string
  lastUsedAt?: string
  revokedAt?: string
  active: boolean
}

export interface PendingOAuthCode {
  codeHash: string
  clientId: string
  redirectUri: string
  codeChallenge: string
  scopes: SovereignMcpScope[]
  tenantId: number
  ownerUserId: number
  expiresAt: string
  usedAt?: string
}

export interface AirlockApprovalRequest {
  id: string
  toolName: string
  summary: string
  argsPreview: string
  keyId: string
  keyName: string
  requestedAt: string
  expiresAt: string
  status: 'pending' | 'approved' | 'denied' | 'expired'
  resolvedAt?: string
  resolvedByUserId?: number
}

export interface ExternalAgentActivityEntry {
  id: string
  timestamp: string
  keyId: string
  keyName: string
  tool: string
  status: 'ok' | 'denied' | 'airlock' | 'revoked' | 'minted'
  summary: string
}

export interface SovereignMcpContext {
  tenantId: number
  ownerUserId: number
  keyId: string
  keyName: string
  scopes: SovereignMcpScope[]
  source: 'api_key' | 'oauth2'
}

interface TenantMcpStore {
  keys: StoredPortalApiKey[]
  oauthCodes: PendingOAuthCode[]
  airlock: AirlockApprovalRequest[]
  activity: ExternalAgentActivityEntry[]
}

const ENTITY_NAME = 'mcp-sovereign'
const ENTITY_ID = 'config'
const SETTING_NAME = 'store'
const TOKEN_PREFIX_RE = /^aos_live_(\d+)_([a-f0-9]{40,64})$/
const MANAGER_ROLES = new Set(['tenant_admin', 'tenant_manager'])
const MAX_ACTIVITY_ENTRIES = 50
const AIRLOCK_TTL_MS = 15 * 60 * 1000
const OAUTH_CODE_TTL_MS = 5 * 60 * 1000

/**
 * Tools that require human-in-the-loop approval via Constitutional Airlock
 * whenever invoked by an external agent (`aos_live_...`).
 */
export const AIRLOCK_GATED_TOOLS = new Set<string>([
  'disconnect_square',
  'delete_portal',
  'delete_tenant',
  'delete_space',
  'export_secrets',
  'revoke_all_tokens',
  'update_payment_config',
  'delete_product',
  'delete_page',
])

/**
 * Read-only LEO tools allowed under `portal:read`.
 * Any `query_*`, `list_*`, `get_*`, `search_*`, `check_*`, or `leo_respond`
 * is permitted for `portal:read`.
 */
export function isToolAllowedByScopes(
  toolName: string,
  scopes: readonly SovereignMcpScope[],
): boolean {
  const scopeSet = new Set(scopes)
  if (scopeSet.has('portal:admin')) return true

  // Provisioning scope permits portal creation + read
  if (toolName === 'provision_tenant' || toolName === 'self_provision_portal') {
    return scopeSet.has('portal:provision')
  }

  // Read-only tools
  if (
    toolName === 'leo_respond' ||
    /^(query_|list_|get_|search_|check_|read_|find_)/.test(toolName)
  ) {
    return (
      scopeSet.has('portal:read') ||
      scopeSet.has('portal:content') ||
      scopeSet.has('portal:provision')
    )
  }

  // Content creation/update tools
  if (
    /^(create_|update_|publish_|draft_|ingest_|sync_|attach_|tag_)/.test(toolName) &&
    !/(tenant|payment|payout|secret|token|domain|user|role)/.test(toolName)
  ) {
    return scopeSet.has('portal:content')
  }

  return false
}

// ─── Crypto & Parsing Helpers ─────────────────────────────────────────────

export function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex')
}

export function verifyPkceS256(codeVerifier: string, codeChallenge: string): boolean {
  if (!codeVerifier || !codeChallenge) return false
  const computed = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
  const a = new Uint8Array(Buffer.from(computed))
  const b = new Uint8Array(Buffer.from(codeChallenge))
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export function parsePortalApiKey(
  rawToken: string | null | undefined,
): { tenantId: number; raw: string } | null {
  if (!rawToken) return null
  const trimmed = rawToken.trim()
  const m = trimmed.match(TOKEN_PREFIX_RE)
  if (!m) return null
  const tenantId = Number(m[1])
  if (!Number.isInteger(tenantId) || tenantId <= 0) return null
  return { tenantId, raw: trimmed }
}

export function normalizeScopes(raw: unknown): SovereignMcpScope[] {
  const valid = new Set<string>(ALL_MCP_SCOPES)
  const items =
    typeof raw === 'string'
      ? raw.split(/[\s,]+/).filter(Boolean)
      : Array.isArray(raw)
        ? raw.filter((v): v is string => typeof v === 'string')
        : []
  const filtered = items.filter((s): s is SovereignMcpScope => valid.has(s))
  return filtered.length > 0 ? Array.from(new Set(filtered)) : ['portal:read']
}

// ─── SettingService Store Helpers ─────────────────────────────────────────

async function readStore(payload: Payload, tenantId: number): Promise<TenantMcpStore> {
  try {
    const raw = await getJsonSetting<Partial<TenantMcpStore>>(
      payload,
      { entityName: ENTITY_NAME, entityId: ENTITY_ID, tenantId },
      SETTING_NAME,
    )
    return {
      keys: Array.isArray(raw?.keys) ? raw.keys : [],
      oauthCodes: Array.isArray(raw?.oauthCodes) ? raw.oauthCodes : [],
      airlock: Array.isArray(raw?.airlock) ? raw.airlock : [],
      activity: Array.isArray(raw?.activity) ? raw.activity : [],
    }
  } catch {
    return { keys: [], oauthCodes: [], airlock: [], activity: [] }
  }
}

async function writeStore(
  payload: Payload,
  tenantId: number,
  store: TenantMcpStore,
): Promise<void> {
  // Prune expired OAuth codes & cap activity ring buffer
  const now = Date.now()
  const cleaned: TenantMcpStore = {
    keys: store.keys.slice(-50),
    oauthCodes: store.oauthCodes.filter((c) => !c.usedAt && Date.parse(c.expiresAt) > now).slice(-25),
    airlock: store.airlock.slice(-30),
    activity: store.activity.slice(-MAX_ACTIVITY_ENTRIES),
  }
  await setJsonSetting(
    payload,
    { entityName: ENTITY_NAME, entityId: ENTITY_ID, tenantId },
    SETTING_NAME,
    cleaned,
    { isPrivate: true },
  )
}

export function sanitizeKey(k: StoredPortalApiKey): SanitizedPortalApiKey {
  return {
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    tenantId: k.tenantId,
    scopes: k.scopes,
    source: k.source,
    ...(k.clientId ? { clientId: k.clientId } : {}),
    createdAt: k.createdAt,
    ...(k.lastUsedAt ? { lastUsedAt: k.lastUsedAt } : {}),
    ...(k.revokedAt ? { revokedAt: k.revokedAt } : {}),
    active: !k.revokedAt,
  }
}

// ─── Key Minting, Listing, Revocation ─────────────────────────────────────

export async function mintPortalApiKey(
  payload: Payload,
  opts: {
    tenantId: number
    ownerUserId: number
    name: string
    scopes: SovereignMcpScope[]
    source?: 'api_key' | 'oauth2'
    clientId?: string
  },
): Promise<{ plaintext: string; key: SanitizedPortalApiKey }> {
  const randomHex = crypto.randomBytes(24).toString('hex')
  const plaintext = `aos_live_${opts.tenantId}_${randomHex}`
  const id = `key_${crypto.randomBytes(8).toString('hex')}`
  const now = new Date().toISOString()

  const record: StoredPortalApiKey = {
    id,
    name: opts.name.trim().slice(0, 80) || 'External AI Agent',
    prefix: `${plaintext.slice(0, 18)}…`,
    tokenHash: hashSecret(plaintext),
    tenantId: opts.tenantId,
    ownerUserId: opts.ownerUserId,
    scopes: normalizeScopes(opts.scopes),
    source: opts.source || 'api_key',
    ...(opts.clientId ? { clientId: opts.clientId } : {}),
    createdAt: now,
  }

  const store = await readStore(payload, opts.tenantId)
  store.keys.push(record)
  store.activity.push({
    id: `act_${crypto.randomBytes(6).toString('hex')}`,
    timestamp: now,
    keyId: id,
    keyName: record.name,
    tool: 'key_minted',
    status: 'minted',
    summary: `Minted ${record.source} key (${record.scopes.join(', ')})`,
  })
  await writeStore(payload, opts.tenantId, store)

  return { plaintext, key: sanitizeKey(record) }
}

export async function revokePortalApiKey(
  payload: Payload,
  tenantId: number,
  keyIdOrPlaintext: string,
): Promise<{ revoked: boolean; key?: SanitizedPortalApiKey }> {
  const store = await readStore(payload, tenantId)
  const maybeHash = keyIdOrPlaintext.startsWith('aos_live_')
    ? hashSecret(keyIdOrPlaintext.trim())
    : null

  const found = store.keys.find(
    (k) =>
      !k.revokedAt &&
      (k.id === keyIdOrPlaintext || (maybeHash !== null && k.tokenHash === maybeHash)),
  )
  if (!found) return { revoked: false }

  const now = new Date().toISOString()
  found.revokedAt = now
  store.activity.push({
    id: `act_${crypto.randomBytes(6).toString('hex')}`,
    timestamp: now,
    keyId: found.id,
    keyName: found.name,
    tool: 'key_revoked',
    status: 'revoked',
    summary: `Revoked key "${found.name}"`,
  })
  await writeStore(payload, tenantId, store)
  return { revoked: true, key: sanitizeKey(found) }
}

export async function getTenantMcpOverview(
  payload: Payload,
  tenantId: number,
): Promise<{
  keys: SanitizedPortalApiKey[]
  airlock: AirlockApprovalRequest[]
  activity: ExternalAgentActivityEntry[]
}> {
  const store = await readStore(payload, tenantId)
  const now = Date.now()
  const airlock = store.airlock.map((a) =>
    a.status === 'pending' && Date.parse(a.expiresAt) <= now
      ? { ...a, status: 'expired' as const }
      : a,
  )
  return {
    keys: store.keys.map(sanitizeKey).reverse(),
    airlock: airlock.reverse(),
    activity: [...store.activity].reverse(),
  }
}

// ─── Token Verification + Server-Side Standing Check ──────────────────────

async function verifyOwnerStanding(
  payload: Payload,
  ownerUserId: number,
  tenantId: number,
): Promise<{ ok: boolean; user?: Record<string, unknown>; roles?: string[] }> {
  const user = (await payload
    .findByID({
      collection: 'users',
      id: ownerUserId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)) as { id: number; roles?: string[]; email?: string } | null

  if (!user) return { ok: false }
  if (checkRole(ADMIN_ROLES, user as never)) {
    return { ok: true, user: user as unknown as Record<string, unknown>, roles: user.roles }
  }

  const memberships = await payload
    .find({
      collection: 'tenant-memberships',
      where: {
        and: [
          { user: { equals: ownerUserId } },
          { tenant: { equals: tenantId } },
          { status: { equals: 'active' } },
        ],
      },
      limit: 10,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => ({ docs: [] }))

  const hasManagerRole = (memberships.docs || []).some((m) => {
    const role = (m as { role?: string }).role || ''
    return MANAGER_ROLES.has(role)
  })

  if (!hasManagerRole) return { ok: false }
  const effectiveRoles = Array.from(new Set([...(user.roles || []), 'tenant_admin']))
  return { ok: true, user: user as unknown as Record<string, unknown>, roles: effectiveRoles }
}

/**
 * Authenticate an incoming `Authorization: Bearer aos_live_...` header.
 * Returns null if the header is not a sovereign portal key, or `{ error }` if
 * invalid/revoked/standing-lost, or `{ ctx, user, roles }` on success.
 */
export async function authenticateSovereignBearer(
  payload: Payload,
  authHeader: string | null | undefined,
): Promise<
  | null
  | { ok: false; error: string }
  | {
      ok: true
      ctx: SovereignMcpContext
      user: Record<string, unknown>
      roles: string[]
    }
> {
  if (!authHeader) return null
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match) return null
  const rawToken = match[1].trim()
  if (!rawToken.startsWith('aos_live_')) return null

  const parsed = parsePortalApiKey(rawToken)
  if (!parsed) {
    return { ok: false, error: 'Malformed portal API key.' }
  }

  const store = await readStore(payload, parsed.tenantId)
  const incomingHash = hashSecret(parsed.raw)
  const key = store.keys.find((k) => {
    if (k.revokedAt) return false
    const a = new Uint8Array(Buffer.from(k.tokenHash))
    const b = new Uint8Array(Buffer.from(incomingHash))
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  })

  if (!key) {
    return { ok: false, error: 'Invalid or revoked portal API key.' }
  }

  const standing = await verifyOwnerStanding(payload, key.ownerUserId, key.tenantId)
  if (!standing.ok || !standing.user) {
    return {
      ok: false,
      error: 'Portal API key owner no longer holds active manager standing on this portal.',
    }
  }

  // Update lastUsedAt asynchronously (best-effort)
  key.lastUsedAt = new Date().toISOString()
  void writeStore(payload, parsed.tenantId, store).catch(() => {})

  return {
    ok: true,
    ctx: {
      tenantId: key.tenantId,
      ownerUserId: key.ownerUserId,
      keyId: key.id,
      keyName: key.name,
      scopes: key.scopes,
      source: key.source,
    },
    user: standing.user,
    roles: standing.roles || ['tenant_admin'],
  }
}

// ─── OAuth 2.1 Authorization Code + PKCE ──────────────────────────────────

export async function createOAuthAuthorizationCode(
  payload: Payload,
  opts: {
    tenantId: number
    ownerUserId: number
    clientId: string
    redirectUri: string
    codeChallenge: string
    scopes: SovereignMcpScope[]
  },
): Promise<{ code: string; expiresAt: string }> {
  const randomHex = crypto.randomBytes(20).toString('hex')
  const code = `aos_code_${opts.tenantId}_${randomHex}`
  const expiresAt = new Date(Date.now() + OAUTH_CODE_TTL_MS).toISOString()

  const store = await readStore(payload, opts.tenantId)
  store.oauthCodes.push({
    codeHash: hashSecret(code),
    clientId: opts.clientId,
    redirectUri: opts.redirectUri,
    codeChallenge: opts.codeChallenge,
    scopes: normalizeScopes(opts.scopes),
    tenantId: opts.tenantId,
    ownerUserId: opts.ownerUserId,
    expiresAt,
  })
  await writeStore(payload, opts.tenantId, store)
  return { code, expiresAt }
}

export async function exchangeOAuthCodeForToken(
  payload: Payload,
  opts: {
    code: string
    codeVerifier: string
    clientId: string
    redirectUri: string
  },
): Promise<
  | { ok: false; error: string; errorDescription: string }
  | { ok: true; accessToken: string; scope: string; tenantId: number }
> {
  const m = opts.code.trim().match(/^aos_code_(\d+)_([a-f0-9]{40})$/)
  if (!m) {
    return {
      ok: false,
      error: 'invalid_grant',
      errorDescription: 'Malformed authorization code.',
    }
  }
  const tenantId = Number(m[1])
  const store = await readStore(payload, tenantId)
  const targetHash = hashSecret(opts.code.trim())
  const record = store.oauthCodes.find((c) => c.codeHash === targetHash)

  if (!record || record.usedAt || Date.parse(record.expiresAt) <= Date.now()) {
    return {
      ok: false,
      error: 'invalid_grant',
      errorDescription: 'Authorization code is expired or already used.',
    }
  }
  if (record.clientId !== opts.clientId || record.redirectUri !== opts.redirectUri) {
    return {
      ok: false,
      error: 'invalid_grant',
      errorDescription: 'client_id or redirect_uri mismatch.',
    }
  }
  if (!verifyPkceS256(opts.codeVerifier, record.codeChallenge)) {
    return {
      ok: false,
      error: 'invalid_grant',
      errorDescription: 'PKCE S256 code_verifier verification failed.',
    }
  }

  record.usedAt = new Date().toISOString()
  await writeStore(payload, tenantId, store)

  const minted = await mintPortalApiKey(payload, {
    tenantId,
    ownerUserId: record.ownerUserId,
    name: `OAuth Client (${record.clientId.slice(0, 32)})`,
    scopes: record.scopes,
    source: 'oauth2',
    clientId: record.clientId,
  })

  return {
    ok: true,
    accessToken: minted.plaintext,
    scope: record.scopes.join(' '),
    tenantId,
  }
}

// ─── Constitutional Airlock & Activity Logging ────────────────────────────

export async function createAirlockApproval(
  payload: Payload,
  opts: {
    tenantId: number
    toolName: string
    args: Record<string, unknown>
    keyId: string
    keyName: string
    portalDomain?: string
  },
): Promise<{ approval: AirlockApprovalRequest; approvalUrl: string }> {
  const id = `air_${crypto.randomBytes(8).toString('hex')}`
  const now = new Date()
  const expiresAt = new Date(now.getTime() + AIRLOCK_TTL_MS).toISOString()
  const argsPreview = JSON.stringify(opts.args || {}).slice(0, 240)
  const approval: AirlockApprovalRequest = {
    id,
    toolName: opts.toolName,
    summary: `External agent "${opts.keyName}" requested high-risk tool "${opts.toolName}"`,
    argsPreview,
    keyId: opts.keyId,
    keyName: opts.keyName,
    requestedAt: now.toISOString(),
    expiresAt,
    status: 'pending',
  }

  const store = await readStore(payload, opts.tenantId)
  store.airlock.push(approval)
  store.activity.push({
    id: `act_${crypto.randomBytes(6).toString('hex')}`,
    timestamp: now.toISOString(),
    keyId: opts.keyId,
    keyName: opts.keyName,
    tool: opts.toolName,
    status: 'airlock',
    summary: `Paused by Constitutional Airlock (${id}) — awaiting human approval`,
  })
  await writeStore(payload, opts.tenantId, store)

  const base = opts.portalDomain
    ? `https://${opts.portalDomain.replace(/^https?:\/\//, '')}`
    : process.env.NEXT_PUBLIC_SERVER_URL || 'https://spacesangels.com'
  const approvalUrl = `${base.replace(/\/$/, '')}/dashboard/admin/settings?tab=advanced&airlock=${id}`
  return { approval, approvalUrl }
}

export async function resolveAirlockApproval(
  payload: Payload,
  opts: {
    tenantId: number
    approvalId: string
    decision: 'approved' | 'denied'
    resolvedByUserId: number
  },
): Promise<AirlockApprovalRequest | null> {
  const store = await readStore(payload, opts.tenantId)
  const item = store.airlock.find((a) => a.id === opts.approvalId)
  if (!item || item.status !== 'pending') return null

  const now = new Date().toISOString()
  item.status = opts.decision
  item.resolvedAt = now
  item.resolvedByUserId = opts.resolvedByUserId
  store.activity.push({
    id: `act_${crypto.randomBytes(6).toString('hex')}`,
    timestamp: now,
    keyId: item.keyId,
    keyName: item.keyName,
    tool: item.toolName,
    status: opts.decision === 'approved' ? 'ok' : 'denied',
    summary: `Constitutional Airlock ${opts.decision} by portal manager (${item.id})`,
  })
  await writeStore(payload, opts.tenantId, store)
  return item
}

export async function recordExternalAgentActivity(
  payload: Payload,
  tenantId: number,
  entry: Omit<ExternalAgentActivityEntry, 'id' | 'timestamp'>,
): Promise<void> {
  try {
    const store = await readStore(payload, tenantId)
    store.activity.push({
      id: `act_${crypto.randomBytes(6).toString('hex')}`,
      timestamp: new Date().toISOString(),
      ...entry,
    })
    await writeStore(payload, tenantId, store)
  } catch {
    // Audit logging must never break tool execution
  }
}
