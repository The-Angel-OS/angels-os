/**
 * Portal API Keys & Constitutional Airlock Management — GET/POST /api/mcp-ops/keys
 *
 * Powers Settings → Advanced → Sovereign Remote MCP & API Keys.
 * Portal managers (tenant_admin / tenant_manager / super_admin) can:
 *   - GET  : list scoped portal keys, pending Constitutional Airlock approvals, and recent external-agent activity
 *   - POST :
 *       action = 'mint'            → mint a new tenant-pinned `aos_live_<tenantId>_...` key (plaintext returned once)
 *       action = 'revoke'          → 1-click revoke a key by `keyId`
 *       action = 'approve_airlock' → approve a pending Constitutional Airlock request
 *       action = 'deny_airlock'    → deny a pending Constitutional Airlock request
 */
import type { PayloadHandler } from 'payload'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { getUserTenantRoles } from '@/access/getUserTenantRoles'
import {
  getTenantMcpOverview,
  mintPortalApiKey,
  normalizeScopes,
  resolveAirlockApproval,
  revokePortalApiKey,
} from '@/lib/mcp/sovereignAuth'

const MANAGER_ROLES = new Set(['tenant_admin', 'tenant_manager'])

async function authorize(req: Parameters<PayloadHandler>[0]) {
  const { user, payload } = req
  if (!user?.id) {
    return { error: Response.json({ ok: false, error: 'Authentication required' }, { status: 401 }) }
  }
  const { tenantId } = await resolveTenantFromHeaders()
  if (!tenantId) {
    return { error: Response.json({ ok: false, error: 'No portal context' }, { status: 400 }) }
  }
  if (checkRole(ADMIN_ROLES, user)) {
    return { tenantId: Number(tenantId), userId: Number(user.id), payload }
  }
  const roles = await getUserTenantRoles(user.id)
  const ok = roles.some((m) => {
    const t = m.tenant as unknown
    const id = typeof t === 'object' && t !== null ? (t as { id: number | string }).id : t
    return String(id) === String(tenantId) && MANAGER_ROLES.has(m.role || '')
  })
  if (!ok) {
    return {
      error: Response.json(
        { ok: false, error: 'Only portal managers can manage Remote MCP keys.' },
        { status: 403 },
      ),
    }
  }
  return { tenantId: Number(tenantId), userId: Number(user.id), payload }
}

export const mcpKeysGetHandler: PayloadHandler = async (req) => {
  const auth = await authorize(req)
  if ('error' in auth && auth.error) return auth.error

  const overview = await getTenantMcpOverview(auth.payload, auth.tenantId)
  return Response.json({
    ok: true,
    tenantId: auth.tenantId,
    ...overview,
  })
}

export const mcpKeysPostHandler: PayloadHandler = async (req) => {
  const auth = await authorize(req)
  if ('error' in auth && auth.error) return auth.error

  let body: Record<string, unknown> = {}
  try {
    body = ((await req.json?.()) as Record<string, unknown>) || {}
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const action = typeof body.action === 'string' ? body.action : 'mint'

  if (action === 'mint') {
    const name = typeof body.name === 'string' ? body.name.trim() : 'External AI Agent'
    const scopes = normalizeScopes(body.scopes)
    const minted = await mintPortalApiKey(auth.payload, {
      tenantId: auth.tenantId,
      ownerUserId: auth.userId,
      name,
      scopes,
      source: 'api_key',
    })
    const overview = await getTenantMcpOverview(auth.payload, auth.tenantId)
    return Response.json({
      ok: true,
      plaintext: minted.plaintext,
      key: minted.key,
      ...overview,
    })
  }

  if (action === 'revoke') {
    const keyId = typeof body.keyId === 'string' ? body.keyId.trim() : ''
    if (!keyId) {
      return Response.json({ ok: false, error: 'keyId is required.' }, { status: 400 })
    }
    const res = await revokePortalApiKey(auth.payload, auth.tenantId, keyId)
    if (!res.revoked) {
      return Response.json({ ok: false, error: 'Key not found or already revoked.' }, { status: 404 })
    }
    const overview = await getTenantMcpOverview(auth.payload, auth.tenantId)
    return Response.json({ ok: true, revoked: true, ...overview })
  }

  if (action === 'approve_airlock' || action === 'deny_airlock') {
    const approvalId = typeof body.approvalId === 'string' ? body.approvalId.trim() : ''
    if (!approvalId) {
      return Response.json({ ok: false, error: 'approvalId is required.' }, { status: 400 })
    }
    const decision = action === 'approve_airlock' ? 'approved' : 'denied'
    const updated = await resolveAirlockApproval(auth.payload, {
      tenantId: auth.tenantId,
      approvalId,
      decision,
      resolvedByUserId: auth.userId,
    })
    if (!updated) {
      return Response.json(
        { ok: false, error: 'Pending approval not found or already resolved.' },
        { status: 404 },
      )
    }
    const overview = await getTenantMcpOverview(auth.payload, auth.tenantId)
    return Response.json({ ok: true, approval: updated, ...overview })
  }

  return Response.json({ ok: false, error: `Unknown action "${action}".` }, { status: 400 })
}
