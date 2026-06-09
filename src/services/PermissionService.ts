/**
 * PermissionService — the ONE way to ask "can this user do X to this entity?".
 *
 * Mirrors Oqtane's `IPermissionService` / `UserSecurity.IsAuthorized`, plus the
 * Angel OS trust composition Oqtane lacks. The resolver is a PURE, DETERMINISTIC
 * function of a resolved grant context — never an LLM, never in doubt, no per-check
 * surprise. (Security + cost: an LLM must never be the authorization oracle.)
 *
 * Two layers, by design:
 *   1. isAuthorized(ctx, permissionName, rows)  — PURE. No DB, no IO. Fully tested.
 *   2. resolveGrantContext / can               — fetch the context + rows, then 1.
 *
 * NON-BREAKING ADOPTION: with zero Permission rows, the resolver reproduces today's
 * behavior by deriving grants from platform roles + tenant membership.permissions[]
 * + space role. Explicit `permissions` rows are an ADDITIVE override/refine layer.
 *
 * @see docs/architecture/OQTANE_SPINE.md  (Spine 2 — Permissions)
 */
import { ADMIN_ROLES, checkRole } from '@/access/utilities'

// ── Vocabulary ──────────────────────────────────────────────────────────────
/** Special pseudo-roles every grant set may include (Oqtane convention). */
export const ROLE_ALL_USERS = 'All Users' // everyone, incl. anonymous
export const ROLE_REGISTERED = 'Registered Users' // any authenticated user

export interface PermissionRow {
  permissionName: string
  roleName?: string | null
  /** May be a populated user object or a raw id. */
  user?: { id: string | number } | string | number | null
  isAuthorized?: boolean | null
}

/**
 * The user's resolved grants in a given context — assemble ONCE (into SiteState),
 * then every can() check is in-memory. This is the unit the pure resolver consumes.
 */
export interface GrantContext {
  userId: string | number | null
  /** Every role-name the user holds here: platform + tenant + space + specials. */
  roles: string[]
  /** Platform-level super/admin/archangel → unconditional allow. */
  isPlatformAdmin: boolean
  /**
   * The tenant membership's permissions[] (e.g. 'manage_users') — the legacy
   * grant surface, mapped to permissionNames via TENANT_PERMISSION_MAP so the
   * resolver stays backward-compatible before explicit rows are seeded.
   */
  tenantPermissions: string[]
}

const idEq = (a: unknown, b: unknown) => a != null && b != null && String(a) === String(b)

const rowUserId = (row: PermissionRow): string | number | null => {
  const u = row.user
  if (u == null) return null
  return typeof u === 'object' ? (u as { id: string | number }).id : u
}

/**
 * Map a high-level permissionName to the legacy tenant-membership permission keys
 * that should also satisfy it. Keeps `can('Manage', ...)` working off the existing
 * `permissions: ['manage_users', ...]` array during migration.
 */
const TENANT_PERMISSION_MAP: Record<string, string[]> = {
  Manage: ['manage_users', 'manage_spaces', 'manage_content', 'manage_settings', 'manage_billing'],
  Edit: ['manage_content', 'manage_products', 'manage_orders'],
  View: ['view_analytics'],
}

// ── 1. The pure resolver (no IO — exhaustively testable) ─────────────────────

/**
 * Oqtane semantics: an explicit DENY (isAuthorized:false) that matches the user
 * wins over any grant; otherwise any matching grant authorizes; platform admins
 * short-circuit; finally the legacy tenant-permission fallback; else deny-by-default.
 */
export function isAuthorized(
  ctx: GrantContext,
  permissionName: string,
  rows: PermissionRow[] = [],
): boolean {
  if (ctx.isPlatformAdmin) return true

  const roleSet = new Set([...ctx.roles, ROLE_ALL_USERS])

  const matches = (row: PermissionRow) => {
    if (row.roleName && roleSet.has(row.roleName)) return true
    if (rowUserId(row) != null && idEq(rowUserId(row), ctx.userId)) return true
    return false
  }
  const relevant = rows.filter((r) => r.permissionName === permissionName && matches(r))

  // Deny precedence.
  if (relevant.some((r) => r.isAuthorized === false)) return false
  // Any explicit grant.
  if (relevant.some((r) => r.isAuthorized !== false)) return true

  // Legacy fallback: tenant membership permissions cover this permissionName.
  const legacy = TENANT_PERMISSION_MAP[permissionName] || []
  if (legacy.some((k) => ctx.tenantPermissions.includes(k))) return true

  return false
}

// ── 2. Context resolution + can() (the IO layer) ─────────────────────────────

export interface ResolveOpts {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any
  tenantId?: string | number | null
  spaceId?: string | number | null
}

/**
 * Build the GrantContext for a user in a tenant (and optional space). One pass:
 * platform roles → tenant membership (role + permissions[]) → space membership role.
 *
 * SEAM — Enterprise/Diocese trust inheritance ("cool if their Enterprise is cool")
 * is intentionally NOT yet composed here; it slots in as one more roles[] source
 * once the federation re-grain lands. The resolver below is the single choke point,
 * so adding it is local. See [[project_federation_diocese_model]].
 */
export async function resolveGrantContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  opts: ResolveOpts,
): Promise<GrantContext> {
  const { user, tenantId, spaceId } = opts
  const userId = user?.id ?? null
  const isAuthenticated = Boolean(userId)
  const platformRoles: string[] = Array.isArray(user?.roles) ? user.roles : []

  const roles = new Set<string>(platformRoles)
  if (isAuthenticated) roles.add(ROLE_REGISTERED)

  let tenantPermissions: string[] = []

  if (isAuthenticated && tenantId != null) {
    try {
      const m = await payload.find({
        collection: 'tenant-memberships',
        where: {
          and: [
            { user: { equals: userId } },
            { tenant: { equals: tenantId } },
            { status: { equals: 'active' } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const doc = m.docs?.[0]
      if (doc?.role) roles.add(doc.role as string)
      if (Array.isArray(doc?.permissions)) tenantPermissions = doc.permissions as string[]
    } catch {
      /* membership lookup failed — fall through with platform roles only */
    }
  }

  if (isAuthenticated && spaceId != null) {
    try {
      const sm = await payload.find({
        collection: 'space-memberships',
        where: {
          and: [
            { user: { equals: userId } },
            { space: { equals: spaceId } },
            { status: { equals: 'active' } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const role = sm.docs?.[0]?.role
      if (role) roles.add(role as string)
    } catch {
      /* non-fatal */
    }
  }

  return {
    userId,
    roles: [...roles],
    isPlatformAdmin: Boolean(user) && checkRole(ADMIN_ROLES, user),
    tenantPermissions,
  }
}

export interface CanOpts extends ResolveOpts {
  permissionName: string
  entityName: string
  entityId: string | number
  /** Pre-resolved context (skip the membership queries) — the SiteState fast path. */
  grantContext?: GrantContext
}

/**
 * Resolve + check. Fetches the entity's Permission rows and the user's grant
 * context (unless `grantContext` is supplied), then runs the pure resolver.
 */
export async function can(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  opts: CanOpts,
): Promise<boolean> {
  const ctx = opts.grantContext ?? (await resolveGrantContext(payload, opts))

  // Platform admin short-circuits before we even hit the rows table.
  if (ctx.isPlatformAdmin) return true

  let rows: PermissionRow[] = []
  try {
    const res = await payload.find({
      collection: 'permissions',
      where: {
        and: [
          { entityName: { equals: opts.entityName } },
          { entityId: { equals: String(opts.entityId) } },
          { permissionName: { equals: opts.permissionName } },
        ],
      },
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })
    rows = (res.docs as PermissionRow[]) || []
  } catch {
    /* no rows / table missing → pure resolver falls back to membership-derived grants */
  }

  return isAuthorized(ctx, opts.permissionName, rows)
}

// ── Administration (Leo-capable; never in the enforcement path) ──────────────

/** Grant or deny a permission to a role or user on an entity. Upsert by identity. */
export async function setPermission(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  opts: {
    entityName: string
    entityId: string | number
    permissionName: string
    roleName?: string
    userId?: string | number
    isAuthorized?: boolean
    tenantId: string | number
  },
): Promise<void> {
  const where = {
    and: [
      { entityName: { equals: opts.entityName } },
      { entityId: { equals: String(opts.entityId) } },
      { permissionName: { equals: opts.permissionName } },
      opts.roleName
        ? { roleName: { equals: opts.roleName } }
        : { user: { equals: opts.userId } },
    ],
  }
  const existing = await payload.find({ collection: 'permissions', where, limit: 1, depth: 0, overrideAccess: true })
  const data = {
    entityName: opts.entityName,
    entityId: String(opts.entityId),
    permissionName: opts.permissionName,
    roleName: opts.roleName,
    user: opts.userId,
    isAuthorized: opts.isAuthorized !== false,
    tenant: opts.tenantId,
  }
  const doc = existing.docs?.[0]
  if (doc) {
    await payload.update({
      collection: 'permissions',
      id: doc.id,
      data,
      overrideAccess: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      overrideLock: true as any,
    })
  } else {
    await payload.create({ collection: 'permissions', data, overrideAccess: true })
  }
}
